/**
 * server.js
 *
 * Application entry point.
 *
 * Startup order (strict):
 *  1. Load and validate config — process exits immediately if config is invalid.
 *  2. Open database connection.
 *  3. Run migrations — server does NOT listen until all migrations have completed.
 *  4. Create Express app, wire middleware and routers.
 *  5. Start listening.
 *
 * This ordering fixes the DB initialisation race condition in the old system,
 * where `initializeDatabase()` was called *inside* the listen callback, meaning
 * the server was accepting requests before the DB was ready.
 */

// Step 1: Config — must be first. Will call process.exit(1) if invalid.
import { config } from "./config/index.js";

import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { openDb, runMigrations, closeDb } from "./infrastructure/db.js";
import { logger } from "./infrastructure/logger.js";
import { apiRouter, globalErrorHandler } from "./api/router.js";
import { createWsServer, broadcast, closeWsServer } from "./api/websocket.js";
import { createRateLimiter } from "./shared/middleware/rateLimit.js";
import { closePostcodeDb } from "./shared/postcodes.js";
import {
  startListening as startCallerIdListening,
  stopListening as stopCallerIdListening,
} from "./hardware/callerIdDevice.js";
import {
  startListening as startTelephonyListening,
  stopListening as stopTelephonyListening,
} from "./hardware/telephonyDevice.js";
import {
  init as initCallerIdService,
  handlePhoneDetected,
} from "./domains/callerIdService/callerIdService.service.js";
import {
  init as initTapiService,
  handleOffering,
  handleConnected,
  handleDisconnected,
} from "./domains/tapiService/tapiService.service.js";

// ---------------------------------------------------------------------------
// Database — open connection and run migrations synchronously
// (better-sqlite3 is sync, so this all completes before we proceed)
// ---------------------------------------------------------------------------

openDb();
runMigrations();

if (!config.security.adminApiToken) {
  logger.warn(
    "ADMIN_API_TOKEN is not configured. GDPR/admin endpoints are disabled and will return 503.",
  );
}

// ---------------------------------------------------------------------------
// Express app setup
// ---------------------------------------------------------------------------

const app = express();
const apiRateLimiter = createRateLimiter({
  windowMs: config.security.apiRateLimitWindowMs,
  maxRequests: config.security.apiRateLimitMaxRequests,
  maxBuckets: config.security.apiRateLimitMaxBuckets,
  trustProxy: config.security.trustProxy,
  scope: "api",
});
app.set("trust proxy", config.security.trustProxy);

// Enable Cross-Origin Resource Sharing (CORS) for the frontend
app.use(
  cors({
    origin: config.corsOrigin,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Parse JSON request bodies — enforce a 10kb limit
app.use(express.json({ limit: "10kb" }));

// Attach a unique request ID to every request for structured log correlation
app.use((req, _res, next) => {
  req.requestId = randomUUID();
  next();
});

// Log every incoming request and its duration upon completion
app.use((req, res, next) => {
  const start = process.hrtime.bigint();

  logger.info("Incoming request", {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
  });

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;

    logger.info("Request completed", {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: parseFloat(durationMs.toFixed(3)),
    });
  });

  next();
});

// Mount all API routes under /api
app.use("/api", apiRateLimiter, apiRouter);

// Global error handler — must be last
app.use(globalErrorHandler);

// ---------------------------------------------------------------------------
// Start listening
// ---------------------------------------------------------------------------

const server = app.listen(config.port, () => {
  logger.info(`Server listening`, { port: config.port });

  // Step 6: Initialise WebSocket server
  createWsServer(server);

  // Step 7: Inject broadcast into callerIdService (transport → domain boundary)
  initCallerIdService({ broadcast });

  // Step 8: Wire tapiService → callerIdService (reuse lookup + broadcast logic)
  initTapiService({ handlePhoneDetected });

  // Step 9: Start hardware listeners (both degrade gracefully if unavailable)
  startCallerIdListening((phone) => {
    void handlePhoneDetected(phone);
  }).catch((err) => {
    logger.error("Caller ID listener failed to start", {
      hardware: true,
      error: err?.message ?? String(err),
    });
  });

  Promise.resolve(
    startTelephonyListening({
      onOffering: (phone, callId) => void handleOffering(phone, callId),
      onConnected: (callId) => handleConnected(callId),
      onDisconnected: (callId, phone, duration) => void handleDisconnected(callId, phone, duration),
    }),
  ).catch((err) => {
    logger.error("Telephony listener failed to start", {
      hardware: true,
      error: err?.message ?? String(err),
    });
  });
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

function shutdown(signal) {
  logger.info(`Received ${signal} — shutting down gracefully`);

  // 1. Run explicit cleanup immediately
  try {
    stopCallerIdListening();
  } catch (e) {
    // ignore shutdown cleanup errors
  }
  try {
    stopTelephonyListening();
  } catch (e) {
    // ignore shutdown cleanup errors
  }
  try {
    closePostcodeDb();
  } catch (e) {
    // ignore shutdown cleanup errors
  }
  try {
    closeWsServer();
  } catch (e) {
    // ignore shutdown cleanup errors
  }

  // 2. Force close any idle keep-alive connections on Node 18+
  server.closeAllConnections?.();
  server.closeIdleConnections?.();

  // 3. Gracefully wait for active HTTP requests to complete
  server.close(() => {
    logger.info("HTTP server closed");
    try {
      closeDb();
    } catch (e) {
      // ignore shutdown cleanup errors
    }
    process.exit(0);
  });

  // Force-quit if shutdown takes too long
  setTimeout(() => {
    logger.error("Shutdown timed out — forcing exit");
    process.exit(1);
  }, 10_000).unref();
}

// Handle uncaught errors — log and exit (do not attempt to limp on)
process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", { message: err.message, stack: err.stack });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  process.exit(1);
});

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default app;
