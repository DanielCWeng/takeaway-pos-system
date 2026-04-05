/**
 * shared/middleware/rateLimit.js
 *
 * Lightweight in-memory rate limiter.
 * Designed for single-node deployments of this POS backend.
 */

/**
 * Resolve client IP safely across environments.
 *
 * @param {import("express").Request} req
 * @param {{ trustProxy?: boolean }} [options]
 * @returns {string}
 */
export function getClientIp(req, options = {}) {
  const { trustProxy = false } = options;

  if (trustProxy) {
    const forwarded = req.get("x-forwarded-for");
    if (forwarded) {
      const first = forwarded.split(",")[0]?.trim();
      if (first) return first;
    }
  }

  const direct = req.ip || req.socket?.remoteAddress;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }
  return "unknown";
}

function removeExpiredBuckets(buckets, now) {
  for (const [bucketKey, value] of buckets.entries()) {
    if (now >= value.resetAt) buckets.delete(bucketKey);
  }
}

function resolveBucketKey({ buckets, candidateKey, overflowKey, maxBuckets, now }) {
  if (buckets.has(candidateKey)) return candidateKey;

  if (buckets.size >= maxBuckets) {
    removeExpiredBuckets(buckets, now);
  }
  if (buckets.has(candidateKey) || buckets.size < maxBuckets) {
    return candidateKey;
  }

  if (buckets.has(overflowKey)) {
    return overflowKey;
  }

  // Ensure we stay within maxBuckets even when introducing an overflow bucket.
  const oldestKey = buckets.keys().next().value;
  if (oldestKey !== undefined) {
    buckets.delete(oldestKey);
  }
  return overflowKey;
}

/**
 * Create an IP-based rate limiter middleware.
 *
 * @param {{
 *   windowMs: number,
 *   maxRequests: number,
 *   scope?: string,
 *   trustProxy?: boolean,
 *   maxBuckets?: number,
 *   keyGenerator?: (req: import("express").Request) => string
 * }} options
 * @returns {import("express").RequestHandler}
 */
export function createRateLimiter(options) {
  const {
    windowMs,
    maxRequests,
    scope = "api",
    trustProxy = false,
    maxBuckets = 5000,
    keyGenerator = (req) => getClientIp(req, { trustProxy }),
  } = options;

  const buckets = new Map();
  let sweepCounter = 0;
  const overflowKey = `${scope}:__overflow__`;

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const requestedKey = `${scope}:${keyGenerator(req) || "unknown"}`;
    const key = resolveBucketKey({
      buckets,
      candidateKey: requestedKey,
      overflowKey,
      maxBuckets,
      now,
    });
    const existing = buckets.get(key);

    let bucket = existing;
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
    }

    bucket.count += 1;
    buckets.set(key, bucket);

    const remaining = Math.max(0, maxRequests - bucket.count);
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    res.setHeader("X-RateLimit-Limit", String(maxRequests));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.floor(bucket.resetAt / 1000)));

    if (bucket.count > maxRequests) {
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please retry later.",
          details: { scope, retryAfterSeconds },
        },
      });
    }

    // Opportunistic cleanup so the map does not grow forever.
    sweepCounter += 1;
    if (sweepCounter >= 250) {
      sweepCounter = 0;
      removeExpiredBuckets(buckets, now);
    }

    return next();
  };
}
