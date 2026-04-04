import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { config } from "../../src/config/index.js";

const wsMock = vi.hoisted(() => {
  const instances = [];

  class MockWebSocketServer {
    constructor() {
      this.clients = new Set();
      this.handlers = new Map();
      instances.push(this);
    }

    on(event, handler) {
      this.handlers.set(event, handler);
    }

    emit(event, ...args) {
      const handler = this.handlers.get(event);
      if (handler) handler(...args);
    }

    close() {
      this.emit("close");
    }
  }

  return { instances, MockWebSocketServer };
});

vi.mock("ws", () => ({
  WebSocketServer: wsMock.MockWebSocketServer,
  WebSocket: {
    OPEN: 1,
  },
}));

vi.mock("../../src/infrastructure/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { createWsServer, broadcast, closeWsServer } from "../../src/api/websocket.js";

function createClient() {
  const handlers = new Map();
  return {
    readyState: 1,
    send: vi.fn((_message, cb) => cb?.()),
    ping: vi.fn(),
    terminate: vi.fn(),
    on: vi.fn((event, handler) => {
      handlers.set(event, handler);
    }),
    emit: (event, payload) => {
      const handler = handlers.get(event);
      if (handler) handler(payload);
    },
  };
}

describe("websocket transport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    wsMock.instances.length = 0;
    closeWsServer();
  });

  afterEach(() => {
    closeWsServer();
    vi.useRealTimers();
  });

  it("returns -1 when broadcast is called before init", () => {
    expect(broadcast("incoming_call", { phone: "07911123456" })).toBe(-1);
  });

  it("pings first and terminates stale clients on next heartbeat", async () => {
    config.ws.heartbeatInterval = 10;
    createWsServer({});

    const server = wsMock.instances[0];
    const client = createClient();
    server.clients.add(client);

    server.emit("connection", client, { socket: { remoteAddress: "127.0.0.1" } });

    await vi.advanceTimersByTimeAsync(10);
    expect(client.ping).toHaveBeenCalledTimes(1);
    expect(client.terminate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(10);
    expect(client.terminate).toHaveBeenCalledTimes(1);
  });

  it("closeWsServer is idempotent", () => {
    config.ws.heartbeatInterval = 10;
    createWsServer({});

    const server = wsMock.instances[0];
    const client = createClient();
    server.clients.add(client);

    expect(() => closeWsServer()).not.toThrow();
    expect(client.terminate).toHaveBeenCalledTimes(1);
    expect(() => closeWsServer()).not.toThrow();
  });
});
