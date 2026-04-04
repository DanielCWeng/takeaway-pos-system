import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "http";
import { WebSocket } from "ws";
import { createWsServer, broadcast, closeWsServer } from "../../src/api/websocket.js";

describe("WebSocket broadcast integration", () => {
  /** @type {import('http').Server} */
  let httpServer;
  /** @type {number} */
  let port;

  beforeAll(async () => {
    httpServer = createServer();
    await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    port = httpServer.address().port;
    createWsServer(httpServer);
  });

  afterAll(async () => {
    closeWsServer();
    await new Promise((resolve) => httpServer.close(resolve));
  });

  it("delivers broadcast messages to connected clients", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);

    await new Promise((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });

    const msgPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out waiting for WS message")), 2000);
      ws.once("message", (data) => {
        clearTimeout(timer);
        resolve(data.toString());
      });
    });

    const count = broadcast("incoming_call", { phone: "01151234567" });
    expect(count).toBe(1);

    const raw = await msgPromise;
    expect(JSON.parse(raw)).toEqual({
      type: "incoming_call",
      payload: { phone: "01151234567" },
    });

    ws.close();
  });
});
