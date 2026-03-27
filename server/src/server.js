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
import { config } from './config/index.js';

import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { openDb, runMigrations, closeDb } from './infrastructure/db.js';
import { logger } from './infrastructure/logger.js';
import { apiRouter, globalErrorHandler } from './api/router.js';
import { createWsServer, broadcast } from './api/websocket.js';
import { closePostcodeDb } from './shared/postcodes.js';
import {
  startListening as startCallerIdListening,
  stopListening as stopCallerIdListening,
} from './hardware/callerIdDevice.js';
import {
  init as initCallerIdService,
  handlePhoneDetected,
} from './domains/callerIdService/callerIdService.service.js';

// ---------------------------------------------------------------------------
// Database — open connection and run migrations synchronously
// (better-sqlite3 is sync, so this all completes before we proceed)
// ---------------------------------------------------------------------------

openDb();
runMigrations();

// ---------------------------------------------------------------------------
// Express app setup
// ---------------------------------------------------------------------------

const app = express();

// Enable Cross-Origin Resource Sharing (CORS) for the frontend
app.use(
  cors({
    origin: config.corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Parse JSON request bodies — enforce a 10kb limit
app.use(express.json({ limit: '10kb' }));

// Attach a unique request ID to every request for structured log correlation
app.use((req, _res, next) => {
  req.requestId = randomUUID();
  next();
});

// Log every incoming request at info level
app.use((req, _res, next) => {
  logger.info('Incoming request', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
  });
  next();
});

// Mount all API routes under /api
app.use('/api', apiRouter);

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

  // Step 8: Start hardware listeners (degrades gracefully if hardware is missing)
  startCallerIdListening((phone) => {
    void handlePhoneDetected(phone);
  }).catch((err) => {
    logger.error('Caller ID listener failed to start', {
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
  server.close(() => {
    logger.info('HTTP server closed');
    stopCallerIdListening();
    closePostcodeDb();
    closeDb();
    process.exit(0);
  });

  // Force-quit if shutdown takes too long
  setTimeout(() => {
    logger.error('Shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000).unref();
}

// Handle uncaught errors — log and exit (do not attempt to limp on)
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { message: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  process.exit(1);
});

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
