/**
 * config/index.js
 *
 * Loads .env and validates all required environment variables using zod.
 * If any variable is missing or invalid, the process exits immediately with
 * a clear error message — before the server binds to any port.
 *
 * This is the ONLY module that reads process.env directly.
 * All other modules import the `config` object from here.
 */

import "dotenv/config";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const envSchema = z.object({
  PORT: z
    .string()
    .regex(/^\d+$/, "PORT must be a numeric string")
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535)),

  CORS_ORIGIN: z
    .string()
    .min(1, "CORS_ORIGIN must contain at least one URL")
    .default("http://localhost:5173"),

  DB_PATH: z.string().min(1, "DB_PATH must be a non-empty path"),

  POSTCODES_DB_PATH: z.string().min(1, "POSTCODES_DB_PATH must be a non-empty path"),

  // Optional — system runs in degraded mode without it
  GETADDRESS_API_KEY: z.string().optional().default(""),

  STORE_POSTCODE: z.string().min(1, "STORE_POSTCODE must be set (e.g. NG9 8GF)"),

  STORE_LATITUDE: z
    .string()
    .regex(/^-?\d+(\.\d+)?$/, "STORE_LATITUDE must be a valid finite number")
    .transform(Number)
    .pipe(z.number().min(-90).max(90)),

  STORE_LONGITUDE: z
    .string()
    .regex(/^-?\d+(\.\d+)?$/, "STORE_LONGITUDE must be a valid finite number")
    .transform(Number)
    .pipe(z.number().min(-180).max(180)),

  PRINTER_VENDOR_ID: z
    .string()
    .regex(/^0x[0-9a-fA-F]+$|^\d+$/, "PRINTER_VENDOR_ID must be a hex (0x...) or decimal integer")
    .transform((v) => parseInt(v, v.startsWith("0x") ? 16 : 10))
    .pipe(z.number().int().min(1)),

  PRINTER_PRODUCT_ID: z
    .string()
    .regex(/^0x[0-9a-fA-F]+$|^\d+$/, "PRINTER_PRODUCT_ID must be a hex (0x...) or decimal integer")
    .transform((v) => parseInt(v, v.startsWith("0x") ? 16 : 10))
    .pipe(z.number().int().min(1)),

  // Optional — auto-detected if blank
  CALLER_DEVICE_PATH: z.string().optional().default(""),

  // Optional — TAPI bridge WebSocket port (default 8765). Set to 0 to disable.
  TAPI_BRIDGE_PORT: z
    .string()
    .regex(/^\d+$/, "TAPI_BRIDGE_PORT must be a non-negative integer")
    .optional()
    .default("8765")
    .transform(Number)
    .pipe(z.number().int().min(0).max(65535)),

  // Optional — override path to TapiBridge.exe (absolute or relative to repo root)
  TAPI_BRIDGE_EXE_PATH: z.string().optional().default(""),
  // Optional — shared secret used by Node <-> bridge DIAL commands
  TAPI_BRIDGE_TOKEN: z.string().optional().default(""),

  TELEPHONY_PROVIDER: z.enum(["none", "tapi", "asterisk_ami"]).optional(),
  ASTERISK_AMI_HOST: z.string().optional().default("127.0.0.1"),
  ASTERISK_AMI_PORT: z
    .string()
    .regex(/^\d+$/, "ASTERISK_AMI_PORT must be a positive integer")
    .optional()
    .default("5038")
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535)),
  ASTERISK_AMI_USERNAME: z.string().optional().default(""),
  ASTERISK_AMI_SECRET: z.string().optional().default(""),
  ASTERISK_AMI_CHANNEL_TEMPLATE: z.string().optional().default("PJSIP/{number}"),
  ASTERISK_AMI_CONTEXT: z.string().optional().default("from-internal"),
  ASTERISK_AMI_EXTEN_TEMPLATE: z.string().optional().default("{number}"),
  ASTERISK_AMI_PRIORITY: z
    .string()
    .regex(/^\d+$/, "ASTERISK_AMI_PRIORITY must be a positive integer")
    .optional()
    .default("1")
    .transform(Number)
    .pipe(z.number().int().min(1)),
  ASTERISK_AMI_CALLER_ID: z.string().optional().default(""),
  ASTERISK_AMI_OUTBOUND_CONTEXT: z.string().optional().default("from-internal"),

  DELIVERY_BASE_CHARGE: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "DELIVERY_BASE_CHARGE must be a decimal number")
    .transform(Number)
    .pipe(z.number().min(0)),

  DELIVERY_DISTANCE_THRESHOLD_MILES: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "DELIVERY_DISTANCE_THRESHOLD_MILES must be a decimal number")
    .transform(Number)
    .pipe(z.number().min(0)),

  DELIVERY_RATE_PER_MILE: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "DELIVERY_RATE_PER_MILE must be a decimal number")
    .transform(Number)
    .pipe(z.number().min(0)),

  ORDER_AUTO_RELOAD_COUNT: z
    .string()
    .regex(/^\d+$/, "ORDER_AUTO_RELOAD_COUNT must be a positive integer")
    .transform(Number)
    .pipe(z.number().int().min(1)),

  ORDER_AUTO_CLEANUP_MINUTES: z
    .string()
    .regex(/^\d+$/, "ORDER_AUTO_CLEANUP_MINUTES must be a positive integer")
    .transform(Number)
    .pipe(z.number().int().min(1)),

  MAX_CONCURRENT_ORDERS: z
    .string()
    .regex(/^\d+$/, "MAX_CONCURRENT_ORDERS must be a positive integer")
    .transform(Number)
    .pipe(z.number().int().min(1)),

  DATA_RETENTION_YEARS: z
    .string()
    .regex(/^\d+$/, "DATA_RETENTION_YEARS must be a positive integer")
    .default("6")
    .transform(Number)
    .pipe(z.number().int().min(1)),

  // Required for privileged GDPR/admin endpoints (export/erase/retention cleanup).
  // Leave blank only if those endpoints are intentionally disabled.
  ADMIN_API_TOKEN: z.string().optional().default(""),

  API_RATE_LIMIT_WINDOW_MS: z
    .string()
    .regex(/^\d+$/, "API_RATE_LIMIT_WINDOW_MS must be a positive integer")
    .default("60000")
    .transform(Number)
    .pipe(z.number().int().min(1)),

  API_RATE_LIMIT_MAX_REQUESTS: z
    .string()
    .regex(/^\d+$/, "API_RATE_LIMIT_MAX_REQUESTS must be a positive integer")
    .default("600")
    .transform(Number)
    .pipe(z.number().int().min(1)),

  API_RATE_LIMIT_MAX_BUCKETS: z
    .string()
    .regex(/^\d+$/, "API_RATE_LIMIT_MAX_BUCKETS must be a positive integer")
    .default("5000")
    .transform(Number)
    .pipe(z.number().int().min(1)),

  ADMIN_AUTH_FAILURE_WINDOW_MS: z
    .string()
    .regex(/^\d+$/, "ADMIN_AUTH_FAILURE_WINDOW_MS must be a positive integer")
    .default("60000")
    .transform(Number)
    .pipe(z.number().int().min(1)),

  ADMIN_AUTH_FAILURE_MAX_ATTEMPTS: z
    .string()
    .regex(/^\d+$/, "ADMIN_AUTH_FAILURE_MAX_ATTEMPTS must be a positive integer")
    .default("25")
    .transform(Number)
    .pipe(z.number().int().min(1)),

  ADMIN_AUTH_FAILURE_MAX_BUCKETS: z
    .string()
    .regex(/^\d+$/, "ADMIN_AUTH_FAILURE_MAX_BUCKETS must be a positive integer")
    .default("2000")
    .transform(Number)
    .pipe(z.number().int().min(1)),

  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  WS_HEARTBEAT_MS: z
    .string()
    .regex(/^\d+$/, "WS_HEARTBEAT_MS must be a positive integer")
    .default("30000")
    .transform(Number),
});

// ---------------------------------------------------------------------------
// Validate — fail loudly on first problem
// ---------------------------------------------------------------------------

const result = envSchema.safeParse(process.env);

if (!result.success) {
  // Format each issue clearly before dying
  const issues = result.error.issues
    .map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  // Use process.stderr directly — logger isn't initialised yet
  process.stderr.write(
    `\n[FATAL] Server configuration is invalid. Fix the following before starting:\n\n${issues}\n\n` +
      `Check your .env file against .env.example.\n\n`,
  );

  process.exit(1);
}

const env = result.data;

const corsOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
for (const origin of corsOrigins) {
  try {
    new URL(origin);
  } catch {
    process.stderr.write(
      `\n[FATAL] Server configuration is invalid. Fix the following before starting:\n\n` +
        `  • CORS_ORIGIN: invalid URL "${origin}"\n\n` +
        `Use a single URL or a comma-separated list, e.g. http://localhost:5173,http://192.168.1.50:5173\n\n`,
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Exported config — the single source of truth for all env-derived values
// ---------------------------------------------------------------------------

export const config = {
  port: env.PORT,
  corsOrigins,

  db: {
    path: env.DB_PATH,
    postcodesPath: env.POSTCODES_DB_PATH,
  },

  address: {
    apiKey: env.GETADDRESS_API_KEY,
    storePostcode: env.STORE_POSTCODE,
    storeLatitude: env.STORE_LATITUDE,
    storeLongitude: env.STORE_LONGITUDE,
  },

  printer: {
    vendorId: env.PRINTER_VENDOR_ID,
    productId: env.PRINTER_PRODUCT_ID,
  },

  callerDevice: {
    path: env.CALLER_DEVICE_PATH,
  },

  tapi: {
    bridgePort: env.TAPI_BRIDGE_PORT,
    bridgeExePath: env.TAPI_BRIDGE_EXE_PATH,
    bridgeToken: env.TAPI_BRIDGE_TOKEN,
  },

  telephony: {
    provider: env.TELEPHONY_PROVIDER ?? (env.TAPI_BRIDGE_PORT > 0 ? "tapi" : "none"),
    asterisk: {
      host: env.ASTERISK_AMI_HOST,
      port: env.ASTERISK_AMI_PORT,
      username: env.ASTERISK_AMI_USERNAME,
      secret: env.ASTERISK_AMI_SECRET,
      channelTemplate: env.ASTERISK_AMI_CHANNEL_TEMPLATE,
      context: env.ASTERISK_AMI_CONTEXT,
      extenTemplate: env.ASTERISK_AMI_EXTEN_TEMPLATE,
      priority: env.ASTERISK_AMI_PRIORITY,
      callerId: env.ASTERISK_AMI_CALLER_ID,
      outboundContext: env.ASTERISK_AMI_OUTBOUND_CONTEXT,
    },
  },

  business: {
    deliveryBaseCharge: env.DELIVERY_BASE_CHARGE,
    deliveryDistanceThresholdMiles: env.DELIVERY_DISTANCE_THRESHOLD_MILES,
    deliveryRatePerMile: env.DELIVERY_RATE_PER_MILE,
    orderAutoReloadCount: env.ORDER_AUTO_RELOAD_COUNT,
    orderAutoCleanupMinutes: env.ORDER_AUTO_CLEANUP_MINUTES,
    maxConcurrentOrders: env.MAX_CONCURRENT_ORDERS,
    dataRetentionYears: env.DATA_RETENTION_YEARS,
  },

  security: {
    adminApiToken: env.ADMIN_API_TOKEN,
    trustProxy: env.TRUST_PROXY,
    apiRateLimitWindowMs: env.API_RATE_LIMIT_WINDOW_MS,
    apiRateLimitMaxRequests: env.API_RATE_LIMIT_MAX_REQUESTS,
    apiRateLimitMaxBuckets: env.API_RATE_LIMIT_MAX_BUCKETS,
    adminAuthFailureWindowMs: env.ADMIN_AUTH_FAILURE_WINDOW_MS,
    adminAuthFailureMaxAttempts: env.ADMIN_AUTH_FAILURE_MAX_ATTEMPTS,
    adminAuthFailureMaxBuckets: env.ADMIN_AUTH_FAILURE_MAX_BUCKETS,
  },

  ws: {
    heartbeatInterval: env.WS_HEARTBEAT_MS,
  },

  kitchen: {
    // Number of active orders that triggers busy mode on the kitchen screen.
    // Tune this after observing real usage — 4 is a conservative starting point.
    busyThreshold: 4,
  },

  logLevel: env.LOG_LEVEL,
};
