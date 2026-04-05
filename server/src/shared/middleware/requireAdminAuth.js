import { timingSafeEqual } from "crypto";
import { config } from "../../config/index.js";
import { getClientIp } from "./rateLimit.js";

function safeTokenEquals(expected, provided) {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const authFailureBuckets = new Map();
let authFailureSweepCounter = 0;
const OVERFLOW_AUTH_BUCKET = "__overflow__";

function removeExpiredAuthBuckets(now) {
  for (const [key, value] of authFailureBuckets.entries()) {
    if (now >= value.resetAt) authFailureBuckets.delete(key);
  }
}

function resolveAuthBucketKey(ip, now) {
  if (authFailureBuckets.has(ip)) return ip;

  const maxBuckets = config.security.adminAuthFailureMaxBuckets;
  if (authFailureBuckets.size >= maxBuckets) {
    removeExpiredAuthBuckets(now);
  }

  if (authFailureBuckets.has(ip) || authFailureBuckets.size < maxBuckets) {
    return ip;
  }

  if (authFailureBuckets.has(OVERFLOW_AUTH_BUCKET)) {
    return OVERFLOW_AUTH_BUCKET;
  }

  // Keep map bounded when creating the shared overflow bucket.
  const oldestKey = authFailureBuckets.keys().next().value;
  if (oldestKey !== undefined) {
    authFailureBuckets.delete(oldestKey);
  }

  return OVERFLOW_AUTH_BUCKET;
}

function markAuthFailure(ip, now) {
  const windowMs = config.security.adminAuthFailureWindowMs;
  const maxAttempts = config.security.adminAuthFailureMaxAttempts;
  const key = resolveAuthBucketKey(ip, now);
  const existing = authFailureBuckets.get(key);

  let bucket = existing;
  if (!bucket || now >= bucket.resetAt) {
    bucket = { failures: 0, resetAt: now + windowMs };
  }
  bucket.failures += 1;
  authFailureBuckets.set(key, bucket);

  const isRateLimited = bucket.failures >= maxAttempts;
  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

  // Opportunistic cleanup so map cannot grow forever.
  authFailureSweepCounter += 1;
  if (authFailureSweepCounter >= 250) {
    authFailureSweepCounter = 0;
    removeExpiredAuthBuckets(now);
  }

  return { isRateLimited, retryAfterSeconds };
}

function isAuthFailureRateLimited(ip, now) {
  const bucket = authFailureBuckets.get(ip);
  if (bucket) {
    if (now >= bucket.resetAt) {
      authFailureBuckets.delete(ip);
      return { blocked: false, retryAfterSeconds: 0 };
    }

    const blocked = bucket.failures >= config.security.adminAuthFailureMaxAttempts;
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return { blocked, retryAfterSeconds };
  }

  const overflowBucket = authFailureBuckets.get(OVERFLOW_AUTH_BUCKET);
  if (!overflowBucket) return { blocked: false, retryAfterSeconds: 0 };
  if (now >= overflowBucket.resetAt) {
    authFailureBuckets.delete(OVERFLOW_AUTH_BUCKET);
    return { blocked: false, retryAfterSeconds: 0 };
  }

  const blocked = overflowBucket.failures >= config.security.adminAuthFailureMaxAttempts;
  const retryAfterSeconds = Math.max(1, Math.ceil((overflowBucket.resetAt - now) / 1000));
  return { blocked, retryAfterSeconds };
}

function clearAuthFailures(ip) {
  authFailureBuckets.delete(ip);
}

/**
 * Guard sensitive admin/GDPR routes with a server-side bearer token.
 *
 * Expected header:
 *   Authorization: Bearer <ADMIN_API_TOKEN>
 */
export function requireAdminAuth(req, res, next) {
  const expected = config.security.adminApiToken;
  if (!expected) {
    return res.status(503).json({
      error: {
        code: "ADMIN_AUTH_NOT_CONFIGURED",
        message: "Admin API authentication is not configured on the server",
        details: {},
      },
    });
  }

  const now = Date.now();
  const ip = getClientIp(req, { trustProxy: config.security.trustProxy });
  const rateLimitState = isAuthFailureRateLimited(ip, now);
  if (rateLimitState.blocked) {
    res.setHeader("Retry-After", String(rateLimitState.retryAfterSeconds));
    return res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Too many admin authentication attempts. Please retry later.",
        details: { retryAfterSeconds: rateLimitState.retryAfterSeconds },
      },
    });
  }

  const authHeader = req.get("authorization") ?? "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token || !safeTokenEquals(expected, token)) {
    const failure = markAuthFailure(ip, now);
    if (failure.isRateLimited) {
      res.setHeader("Retry-After", String(failure.retryAfterSeconds));
      return res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Too many admin authentication attempts. Please retry later.",
          details: { retryAfterSeconds: failure.retryAfterSeconds },
        },
      });
    }
    return res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Admin authentication required",
        details: {},
      },
    });
  }

  clearAuthFailures(ip);
  return next();
}
