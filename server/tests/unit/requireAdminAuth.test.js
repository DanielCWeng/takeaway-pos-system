import { describe, it, expect, beforeEach, vi } from "vitest";

function makeReq({ ip = "127.0.0.1", authorization = "", headers = {} } = {}) {
  const lowered = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ip,
    socket: { remoteAddress: ip },
    get(name) {
      if (name.toLowerCase() === "authorization") return authorization;
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

async function loadMiddleware({
  token = "test-admin-token",
  maxAttempts = 2,
  windowMs = 60_000,
  maxBuckets = 2000,
  trustProxy = false,
} = {}) {
  vi.resetModules();
  process.env.ADMIN_API_TOKEN = token;
  process.env.ADMIN_AUTH_FAILURE_MAX_ATTEMPTS = String(maxAttempts);
  process.env.ADMIN_AUTH_FAILURE_WINDOW_MS = String(windowMs);
  process.env.ADMIN_AUTH_FAILURE_MAX_BUCKETS = String(maxBuckets);
  process.env.TRUST_PROXY = trustProxy ? "true" : "false";
  const mod = await import("../../src/shared/middleware/requireAdminAuth.js");
  return mod.requireAdminAuth;
}

describe("requireAdminAuth", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("returns 403 for invalid bearer token", async () => {
    const requireAdminAuth = await loadMiddleware({ maxAttempts: 5 });
    const req = makeReq({ authorization: "Bearer wrong-token" });
    const res = makeRes();
    const next = vi.fn();

    requireAdminAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 429 after repeated failed auth attempts", async () => {
    const requireAdminAuth = await loadMiddleware({ maxAttempts: 2 });
    const next = vi.fn();

    requireAdminAuth(
      makeReq({ ip: "10.10.0.1", authorization: "Bearer wrong-1" }),
      makeRes(),
      next,
    );

    const blockedRes = makeRes();
    requireAdminAuth(
      makeReq({ ip: "10.10.0.1", authorization: "Bearer wrong-2" }),
      blockedRes,
      next,
    );

    expect(blockedRes.status).toHaveBeenCalledWith(429);
    expect(blockedRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: "RATE_LIMITED" }),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("clears failure bucket after successful auth", async () => {
    const requireAdminAuth = await loadMiddleware({ maxAttempts: 2 });
    const next = vi.fn();
    const ip = "10.10.0.2";

    requireAdminAuth(makeReq({ ip, authorization: "Bearer wrong" }), makeRes(), next);

    requireAdminAuth(makeReq({ ip, authorization: "Bearer test-admin-token" }), makeRes(), next);

    const resAfterReset = makeRes();
    requireAdminAuth(makeReq({ ip, authorization: "Bearer wrong-again" }), resAfterReset, next);

    expect(resAfterReset.status).toHaveBeenCalledWith(403);
  });

  it("does not trust X-Forwarded-For when trust proxy is disabled", async () => {
    const requireAdminAuth = await loadMiddleware({ maxAttempts: 2, trustProxy: false });
    const next = vi.fn();

    requireAdminAuth(
      makeReq({
        ip: "10.10.1.1",
        authorization: "Bearer wrong",
        headers: { "x-forwarded-for": "198.51.100.1" },
      }),
      makeRes(),
      next,
    );

    const secondRes = makeRes();
    requireAdminAuth(
      makeReq({
        ip: "10.10.1.2",
        authorization: "Bearer wrong",
        headers: { "x-forwarded-for": "198.51.100.1" },
      }),
      secondRes,
      next,
    );

    expect(secondRes.status).toHaveBeenCalledWith(403);
  });

  it("uses a bounded overflow bucket when auth failure bucket limit is reached", async () => {
    const requireAdminAuth = await loadMiddleware({
      maxAttempts: 2,
      maxBuckets: 1,
    });
    const next = vi.fn();

    requireAdminAuth(
      makeReq({ ip: "10.10.2.1", authorization: "Bearer wrong-1" }),
      makeRes(),
      next,
    );

    requireAdminAuth(
      makeReq({ ip: "10.10.2.2", authorization: "Bearer wrong-2" }),
      makeRes(),
      next,
    );

    const blockedRes = makeRes();
    requireAdminAuth(
      makeReq({ ip: "10.10.2.3", authorization: "Bearer wrong-3" }),
      blockedRes,
      next,
    );

    expect(blockedRes.status).toHaveBeenCalledWith(429);
  });
});
