import { describe, it, expect, beforeEach, vi } from "vitest";

class MockWebSocket {
  static OPEN = 1;
  static instances = [];

  constructor() {
    this.readyState = 0;
    this.handlers = new Map();
    MockWebSocket.instances.push(this);
  }

  once(event, cb) {
    this.handlers.set(`once:${event}`, cb);
  }

  on(event, cb) {
    this.handlers.set(`on:${event}`, cb);
  }

  send(payload, cb) {
    this.lastPayload = payload;
    cb?.();
  }

  removeAllListeners() {}
  terminate() {
    this.readyState = 3;
  }

  emitOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.handlers.get("once:open")?.();
  }

  emitMessage(payload) {
    this.handlers.get("on:message")?.(Buffer.from(JSON.stringify(payload)));
  }
}

describe("tapiDevice", () => {
  beforeEach(() => {
    vi.resetModules();
    MockWebSocket.instances = [];
  });

  async function loadModule() {
    const markBridgeHealthy = vi.fn();
    vi.doMock("ws", () => ({ WebSocket: MockWebSocket }));
    vi.doMock("../../src/config/index.js", () => ({
      config: { tapi: { bridgePort: 8765, bridgeToken: "secret-token" } },
    }));
    vi.doMock("../../src/infrastructure/logger.js", () => ({
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    }));
    vi.doMock("../../src/hardware/tapiBridgeProcess.js", () => ({
      markBridgeHealthy,
    }));

    const mod = await import("../../src/hardware/tapiDevice.js");
    return { ...mod, markBridgeHealthy };
  }

  it("marks bridge connected only after READY and includes token in dial command", async () => {
    const mod = await loadModule();
    mod.startListening({ onOffering: vi.fn() });

    const ws = MockWebSocket.instances[0];
    ws.emitOpen();
    expect(mod.isBridgeConnected()).toBe(false);

    ws.emitMessage({ type: "READY" });
    expect(mod.isBridgeConnected()).toBe(true);
    expect(mod.markBridgeHealthy).toHaveBeenCalledTimes(1);

    const accepted = mod.dial("07123456789");
    expect(accepted).toBe(true);
    expect(JSON.parse(ws.lastPayload)).toEqual({
      type: "DIAL",
      phone: "07123456789",
      token: "secret-token",
    });

    mod.stopListening();
  });

  it("rejects dial attempts before READY handshake completes", async () => {
    const mod = await loadModule();
    mod.startListening({ onOffering: vi.fn() });

    const ws = MockWebSocket.instances[0];
    ws.emitOpen();

    expect(mod.isBridgeConnected()).toBe(false);
    expect(mod.dial("07123456789")).toBe(false);

    mod.stopListening();
  });
});
