import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("../../src/infrastructure/db.js", () => ({
  getDb: vi.fn(),
}));

vi.mock("../../src/infrastructure/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const callSessions = vi.hoisted(() => ({
  markCallOffered: vi.fn(),
  markCallConnected: vi.fn(),
  markCallEnded: vi.fn(),
  getCallSession: vi.fn(),
}));

vi.mock("../../src/domains/calls/callSessions.service.js", () => ({
  markCallOffered: callSessions.markCallOffered,
  markCallConnected: callSessions.markCallConnected,
  markCallEnded: callSessions.markCallEnded,
  getCallSession: callSessions.getCallSession,
}));

import { getDb } from "../../src/infrastructure/db.js";
import {
  init,
  handleOffering,
  handleConnected,
  handleDisconnected,
} from "../../src/domains/tapiService/tapiService.service.js";

describe("tapiService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    callSessions.getCallSession.mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  function mockDb(customerName = "Alice") {
    const insertRun = vi.fn();
    const selectGet = vi.fn().mockReturnValue(customerName ? { name: customerName } : undefined);
    const prepare = vi.fn((sql) => {
      if (sql.includes("SELECT name FROM customers")) return { get: selectGet };
      return { run: insertRun };
    });
    vi.mocked(getDb).mockReturnValue({ prepare });
    return { insertRun, selectGet, prepare };
  }

  it("logs call duration from CONNECTED to DISCONNECTED when connected timestamp exists", async () => {
    const { insertRun } = mockDb();
    const detected = vi.fn().mockResolvedValue(undefined);
    init({ handlePhoneDetected: detected });

    vi.setSystemTime(new Date("2026-04-05T10:00:00.000Z"));
    await handleOffering("07911123456", 10);
    expect(detected).toHaveBeenCalledWith("07911123456", { callId: 10, source: "tapi" });

    vi.setSystemTime(new Date("2026-04-05T10:00:05.000Z"));
    handleConnected(10);

    vi.setSystemTime(new Date("2026-04-05T10:00:17.000Z"));
    await handleDisconnected(10, "07911123456", 999);

    expect(insertRun).toHaveBeenCalledTimes(1);
    const [phone, startedAtIso, endedAtIso, durationSeconds, customerName] =
      insertRun.mock.calls[0];
    expect(phone).toBe("07911123456");
    expect(startedAtIso).toBe("2026-04-05T10:00:05.000Z");
    expect(endedAtIso).toBe("2026-04-05T10:00:17.000Z");
    expect(durationSeconds).toBe(12);
    expect(customerName).toBe("Alice");
  });

  it("falls back to bridge duration when disconnected arrives without tracked call", async () => {
    const { insertRun } = mockDb(null);
    init({ handlePhoneDetected: vi.fn().mockResolvedValue(undefined) });

    vi.setSystemTime(new Date("2026-04-05T11:00:00.000Z"));
    await handleDisconnected(999, "07911120000", 7);

    const [, startedAtIso, endedAtIso, durationSeconds] = insertRun.mock.calls[0];
    expect(durationSeconds).toBe(7);
    expect(endedAtIso).toBe("2026-04-05T11:00:00.000Z");
    expect(startedAtIso).toBe("2026-04-05T10:59:53.000Z");
  });

  it("uses selected call-session metadata when available", async () => {
    const { insertRun } = mockDb("Fallback");
    callSessions.getCallSession.mockReturnValue({
      callId: 88,
      selectedCustomerPhone: "07911000000",
      selectedCustomerName: "Chosen Customer",
      selectedAddress: "42 Chosen Road, NG9 8GF",
      notes: "Gate code 1234",
    });
    init({ handlePhoneDetected: vi.fn().mockResolvedValue(undefined) });

    vi.setSystemTime(new Date("2026-04-05T12:00:00.000Z"));
    await handleDisconnected(88, "", 5);

    const [phone, , , , customerName, notes, callId, selectedPhone, selectedAddress] =
      insertRun.mock.calls[0];
    expect(phone).toBe("07911000000");
    expect(customerName).toBe("Chosen Customer");
    expect(notes).toBe("Gate code 1234");
    expect(callId).toBe(88);
    expect(selectedPhone).toBe("07911000000");
    expect(selectedAddress).toBe("42 Chosen Road, NG9 8GF");
  });
});
