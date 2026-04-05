import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

describe("calls router", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function buildApp({ provider = "tapi", connected = true, dialAccepted = true } = {}) {
    const dial = vi.fn().mockReturnValue(dialAccepted);
    const isTelephonyConnected = vi.fn().mockReturnValue(connected);
    const isDialEnabled = vi.fn().mockReturnValue(provider !== "none");
    const getTelephonyProvider = vi.fn().mockReturnValue(provider);
    const upsertCallSession = vi.fn();

    vi.doMock("../../src/hardware/telephonyDevice.js", () => ({
      dial,
      isTelephonyConnected,
      isDialEnabled,
      getTelephonyProvider,
    }));
    vi.doMock("../../src/domains/calls/callSessions.service.js", () => ({
      upsertCallSession,
    }));

    const { callsRouter } = await import("../../src/domains/calls/calls.router.js");

    const app = express();
    app.use(express.json());
    app.use("/api/calls", callsRouter);

    return {
      app,
      dial,
      isTelephonyConnected,
      isDialEnabled,
      getTelephonyProvider,
      upsertCallSession,
    };
  }

  it("returns 503 when telephony dial is disabled", async () => {
    const { app, isDialEnabled } = await buildApp({ provider: "none" });

    const res = await request(app).post("/api/calls/dial").send({ phone: "07123456789" });

    expect(isDialEnabled).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("TELEPHONY_DISABLED");
  });

  it("returns 503 when telephony provider is enabled but disconnected", async () => {
    const { app, isTelephonyConnected } = await buildApp({
      provider: "asterisk_ami",
      connected: false,
    });

    const res = await request(app).post("/api/calls/dial").send({ phone: "07123456789" });

    expect(isTelephonyConnected).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("TELEPHONY_UNAVAILABLE");
  });

  it("returns 400 when phone is invalid", async () => {
    const { app, dial } = await buildApp();

    const res = await request(app).post("/api/calls/dial").send({ phone: "---" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_PHONE");
    expect(dial).not.toHaveBeenCalled();
  });

  it("returns 202 and sends dial command when provider is ready", async () => {
    const { app, dial } = await buildApp({ connected: true, dialAccepted: true });

    const res = await request(app).post("/api/calls/dial").send({ phone: "07 123 456 789" });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ ok: true, phone: "07123456789", provider: "tapi" });
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
