import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

describe("calls router", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function buildApp({ bridgePort = 8765, connected = true, dialAccepted = true } = {}) {
    const dial = vi.fn().mockReturnValue(dialAccepted);
    const isBridgeConnected = vi.fn().mockReturnValue(connected);
    const upsertCallSession = vi.fn();

    vi.doMock("../../src/config/index.js", () => ({
      config: { tapi: { bridgePort } },
    }));
    vi.doMock("../../src/hardware/tapiDevice.js", () => ({
      dial,
      isBridgeConnected,
    }));
    vi.doMock("../../src/domains/calls/callSessions.service.js", () => ({
      upsertCallSession,
    }));

    const { callsRouter } = await import("../../src/domains/calls/calls.router.js");

    const app = express();
    app.use(express.json());
    app.use("/api/calls", callsRouter);

    return { app, dial, isBridgeConnected, upsertCallSession };
  }

  it("returns 503 when TAPI is disabled", async () => {
    const { app } = await buildApp({ bridgePort: 0 });

    const res = await request(app).post("/api/calls/dial").send({ phone: "07123456789" });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("TAPI_DISABLED");
  });

  it("returns 503 when bridge is enabled but disconnected", async () => {
    const { app, isBridgeConnected } = await buildApp({ connected: false });

    const res = await request(app).post("/api/calls/dial").send({ phone: "07123456789" });

    expect(isBridgeConnected).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("TAPI_UNAVAILABLE");
  });

  it("returns 400 when phone is invalid", async () => {
    const { app, dial } = await buildApp();

    const res = await request(app).post("/api/calls/dial").send({ phone: "---" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_PHONE");
    expect(dial).not.toHaveBeenCalled();
  });

  it("returns 202 and sends dial command when bridge is ready", async () => {
    const { app, dial } = await buildApp({ connected: true, dialAccepted: true });

    const res = await request(app).post("/api/calls/dial").send({ phone: "07 123 456 789" });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ ok: true, phone: "07123456789" });
    expect(dial).toHaveBeenCalledWith("07123456789");
  });

  it("returns 400 when session callId is invalid", async () => {
    const { app, upsertCallSession } = await buildApp();

    const res = await request(app).post("/api/calls/session").send({
      callId: "abc",
      selectedCustomerPhone: "07123456789",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_CALL_ID");
    expect(upsertCallSession).not.toHaveBeenCalled();
  });

  it("returns 202 and upserts call session metadata", async () => {
    const { app, upsertCallSession } = await buildApp();

    const res = await request(app).post("/api/calls/session").send({
      callId: 42,
      selectedCustomerPhone: "+44 7911 123456",
      selectedCustomerName: "  Test Customer  ",
      selectedAddress: "  10 Test Street  ",
      notes: "  Leave at door  ",
    });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ ok: true, callId: 42 });
    expect(upsertCallSession).toHaveBeenCalledWith(42, {
      selectedCustomerPhone: "07911123456",
      selectedCustomerName: "Test Customer",
      selectedAddress: "10 Test Street",
      notes: "Leave at door",
    });
  });
});
