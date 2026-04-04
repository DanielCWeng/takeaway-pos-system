/**
 * api/websocket.js
 *
 * Simple WebSocket server wrapper.
 *
 * Responsibilities:
 *  - Attach WS server to an existing HTTP server.
 *  - Manage active client connections.
 *  - Provide a singleton broadcast() function for push notifications.
 *  - Handle basic ping/pong/heartbeat to keep connections alive on LAN.
 */

import { WebSocketServer, WebSocket } from "ws";
import { logger } from "../infrastructure/logger.js";
import { config } from "../config/index.js";

/** @type {WebSocketServer | null} */
let wss = null;

/** @type {ReturnType<typeof setInterval> | null} */
let heartbeatInterval = null;

/**
 * Tracks liveness state for each WebSocket client without mutating the ws instance directly.
 * @type {WeakMap<WebSocket, boolean>}
 */
const aliveMap = new WeakMap();

/**
 * Creates and attaches a WebSocket server to the provided HTTP server.
 * Throws if called more than once, preventing silent instance replacement.
 *
 * @param {import('http').Server} httpServer
 */
export function createWsServer(httpServer) {
  if (wss) {
    throw new Error("WS server already initialised — createWsServer() must only be called once");
  }

  // Read at call time, not module load time — avoids setInterval(fn, undefined) if the
  // module is imported before env vars are loaded in test environments.
  const HEARTBEAT_INTERVAL_MS = config.ws.heartbeatInterval;

  wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", (ws, req) => {
    const ip = req.socket.remoteAddress;
    logger.info("WS Client connected", { ip });

    aliveMap.set(ws, true);

    ws.on("error", (err) => {
      logger.error("WS Client error", { ip, error: err.message });
    });

    ws.on("pong", () => {
      aliveMap.set(ws, true);
    });

    ws.on("message", (data) => {
      logger.debug("WS Message received (unhandled)", { ip, data: data.toString() });
    });

    ws.on("close", () => {
      aliveMap.delete(ws);
      logger.info("WS Client disconnected", { ip });
    });
  });

  // Heartbeat interval: check every HEARTBEAT_INTERVAL_MS if clients are still alive
  heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (aliveMap.get(ws) === false) {
        logger.debug("WS Terminating inactive client");
        return ws.terminate();
      }

      aliveMap.set(ws, false);
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  // Do not keep the process alive solely for the heartbeat (helps tests/tooling).
  heartbeatInterval.unref?.();

  wss.on("close", () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  });

  logger.info("WebSocket server initialised", { heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS });
}

/**
 * Broadcast a JSON message to all connected clients.
 *
 * @param {string} type - Message type (e.g. 'incoming_call', 'order_update')
 * @param {object} payload - Plain object data
 * @returns {number} The number of clients the message was dispatched to, or -1 if the server is not initialised
 */
export function broadcast(type, payload) {
  if (!wss) {
    logger.warn("WS Broadcast attempted before server initialised");
    return -1;
  }

  const message = JSON.stringify({ type, payload });
  let count = 0;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message, (err) => {
        if (err) {
          logger.error("WS Send failed", { type, error: err.message });
        }
      });
      count++;
    }
  });

  if (count > 0) {
    logger.debug("WS Broadcast sent", { type, clientCount: count });
  }

  return count;
}

/**
 * Close the WebSocket server and release resources.
 * Primarily used for tests and graceful shutdown.
 */
export function closeWsServer() {
  if (!wss) return;

  try {
    wss.clients.forEach((client) => {
      try {
        client.terminate();
      } catch {
        // ignore
      }
    });
    wss.close();
  } finally {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    wss = null;
  }
}
