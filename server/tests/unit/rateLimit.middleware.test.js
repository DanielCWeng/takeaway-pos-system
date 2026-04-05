import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRateLimiter } from "../../src/shared/middleware/rateLimit.js";

function makeReq(ip = "127.0.0.1", headers = {}) {
  const lowered = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ip,
    socket: { remoteAddress: ip },
    get(name) {
      return lowered[name.toLowerCase()];
    },
  };
}

function makeRes() {
  return {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe("rateLimit middleware", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the configured maximum", () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      maxRequests: 2,
      scope: "test",
    });
    const req = makeReq("10.0.0.1");
    const next = vi.fn();

    limiter(req, makeRes(), next);
    limiter(req, makeRes(), next);

    expect(next).toHaveBeenCalledTimes(2);
  });

  it("returns 429 once the limit is exceeded", () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      maxRequests: 1,
      scope: "test",
    });
    const req = makeReq("10.0.0.2");
    const next = vi.fn();

    limiter(req, makeRes(), next);

    const blockedRes = makeRes();
    limiter(req, blockedRes, next);

    expect(blockedRes.status).toHaveBeenCalledWith(429);
    expect(blockedRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: "RATE_LIMITED" }),
      }),
    );
  });

  it("resets counters after the window elapses", () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({
      windowMs: 1_000,
      maxRequests: 1,
      scope: "test",
    });
    const req = makeReq("10.0.0.3");
    const next = vi.fn();

    limiter(req, makeRes(), next);

    const blockedRes = makeRes();
    limiter(req, blockedRes, next);
    expect(blockedRes.status).toHaveBeenCalledWith(429);

    vi.advanceTimersByTime(1_100);

    limiter(req, makeRes(), next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("does not trust X-Forwarded-For unless trustProxy is enabled", () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      maxRequests: 1,
      scope: "test",
      trustProxy: false,
    });
    const next = vi.fn();

    limiter(
      makeReq("10.0.0.10", {
        "x-forwarded-for": "203.0.113.1",
      }),
      makeRes(),
      next,
    );

    limiter(
      makeReq("10.0.0.11", {
        "x-forwarded-for": "203.0.113.1",
      }),
      makeRes(),
      next,
    );

    expect(next).toHaveBeenCalledTimes(2);
  });

  it("uses a bounded overflow bucket once maxBuckets is reached", () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      maxRequests: 1,
      maxBuckets: 1,
      scope: "test",
    });
    const next = vi.fn();

    limiter(makeReq("10.0.0.20"), makeRes(), next); // first keyed bucket
    limiter(makeReq("10.0.0.21"), makeRes(), next); // overflow bucket (first hit)

    const blockedRes = makeRes();
    limiter(makeReq("10.0.0.22"), blockedRes, next); // overflow bucket (second hit)

    expect(blockedRes.status).toHaveBeenCalledWith(429);
    expect(next).toHaveBeenCalledTimes(2);
  });
});
