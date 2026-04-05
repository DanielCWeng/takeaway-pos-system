/**
 * hardware/tapiDevice.js
 *
 * Node.js WebSocket client for the TapiBridge C# process.
 *
 * The C# bridge (tapi-bridge/TapiBridge.cs) owns the TAPI connection and
 * publishes JSON events over a local WebSocket server. This module connects
 * to it, maps the events to callbacks, and reconnects automatically if the
 * bridge restarts.
 *
 * Interface mirrors callerIdDevice.js so the two sources are interchangeable
 * from server.js's perspective.
 *
 *   startListening({ onOffering, onConnected, onDisconnected })
 *   stopListening()
 *   dial(phone)  — click-to-dial; no-op if not connected
 *
 * Events from bridge:
 *   { type: "READY" }
 *   { type: "OFFERING",     callId, phone }
 *   { type: "CONNECTED",    callId }
 *   { type: "DISCONNECTED", callId, phone, durationSeconds }
 *   { type: "ERROR",        message }
 */

import { WebSocket } from "ws";
import { config } from "../config/index.js";
import { logger } from "../infrastructure/logger.js";

const INITIAL_RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

/** @type {WebSocket | null} */
let ws = null;

/** @type {ReturnType<typeof setTimeout> | null} */
let reconnectTimer = null;

let reconnectAttempt = 0;
let stopped = true;

/** @type {((phone: string) => void) | null} */
let _onOffering = null;

/** @type {((callId: number) => void) | null} */
let _onConnected = null;

/** @type {((callId: number, phone: string, durationSeconds: number) => void) | null} */
let _onDisconnected = null;

function bridgeUrl() {
  return `ws://127.0.0.1:${config.tapi.bridgePort}`;
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function closeSocket() {
  if (!ws) return;
  try {
    ws.removeAllListeners();
    ws.terminate();
  } catch {
    // ignore
  } finally {
    ws = null;
  }
}

function scheduleReconnect(reason) {
  if (stopped) return;
  if (reconnectTimer) return;

  const delay = Math.min(
    INITIAL_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempt),
    MAX_RECONNECT_DELAY_MS,
  );

  logger.warn("TAPI bridge reconnect scheduled", {
    hardware: true,
    reason,
    delayMs: delay,
    attempt: reconnectAttempt + 1,
  });

  reconnectAttempt++;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function connect() {
  if (stopped) return;

  clearReconnectTimer();
  closeSocket();

  const url = bridgeUrl();
  logger.info("Connecting to TAPI bridge", { hardware: true, url });

  ws = new WebSocket(url);

  ws.once("open", () => {
    reconnectAttempt = 0;
    logger.info("TAPI bridge connected", { hardware: true, url });
  });

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      logger.warn("TAPI bridge sent non-JSON message", { hardware: true, data: data.toString() });
      return;
    }

    handleMessage(msg);
  });

  ws.once("close", (code, reason) => {
    if (!stopped) {
      logger.warn("TAPI bridge connection closed", {
        hardware: true,
        code,
        reason: reason?.toString(),
      });
      scheduleReconnect("connection_closed");
    }
  });

  ws.once("error", (err) => {
    logger.warn("TAPI bridge connection error", {
      hardware: true,
      error: err?.message ?? String(err),
    });
    // 'close' fires after 'error', so reconnect is handled there
  });
}

function handleMessage(msg) {
  switch (msg.type) {
    case "READY":
      logger.info("TAPI bridge ready", { hardware: true });
      break;

    case "OFFERING": {
      const phone = typeof msg.phone === "string" ? msg.phone.replace(/\D/g, "") : "";
      if (!phone) {
        logger.warn("TAPI OFFERING event has no phone number", { hardware: true, msg });
        return;
      }
      logger.info("TAPI incoming call", { hardware: true, phone, callId: msg.callId });
      try {
        _onOffering?.(phone, msg.callId);
      } catch (err) {
        logger.error("onOffering callback threw", { hardware: true, error: err?.message });
      }
      break;
    }

    case "CONNECTED":
      logger.info("TAPI call connected", { hardware: true, callId: msg.callId });
      try {
        _onConnected?.(msg.callId);
      } catch (err) {
        logger.error("onConnected callback threw", { hardware: true, error: err?.message });
      }
      break;

    case "DISCONNECTED":
      logger.info("TAPI call disconnected", {
        hardware: true,
        callId: msg.callId,
        durationSeconds: msg.durationSeconds,
      });
      try {
        _onDisconnected?.(msg.callId, msg.phone ?? "", msg.durationSeconds ?? 0);
      } catch (err) {
        logger.error("onDisconnected callback threw", { hardware: true, error: err?.message });
      }
      break;

    case "ERROR":
      logger.error("TAPI bridge reported error", { hardware: true, message: msg.message });
      break;

    default:
      logger.debug("Unknown TAPI bridge message type", { hardware: true, type: msg.type });
  }
}

/**
 * Start listening to the TAPI bridge.
 *
 * @param {{
 *   onOffering:     (phone: string, callId: number) => void,
 *   onConnected?:   (callId: number) => void,
 *   onDisconnected?: (callId: number, phone: string, durationSeconds: number) => void,
 * }} callbacks
 */
export function startListening({ onOffering, onConnected, onDisconnected }) {
  if (typeof onOffering !== "function") {
    throw new TypeError("startListening() requires onOffering callback");
  }
  if (!stopped) {
    throw new Error("startListening() called while already listening — call stopListening() first");
  }

  _onOffering    = onOffering;
  _onConnected   = onConnected ?? null;
  _onDisconnected = onDisconnected ?? null;

  stopped = false;
  reconnectAttempt = 0;

  connect();
}

/**
 * Stop listening and release the WebSocket connection.
 */
export function stopListening() {
  stopped = true;
  _onOffering    = null;
  _onConnected   = null;
  _onDisconnected = null;

  clearReconnectTimer();
  closeSocket();

  logger.info("TAPI bridge listener stopped", { hardware: true });
}

/**
 * Send a click-to-dial command to the bridge.
 * Silently no-ops if the bridge is not connected.
 *
 * @param {string} phone
 */
export function dial(phone) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    logger.warn("dial() called but TAPI bridge is not connected", { hardware: true, phone });
    return;
  }

  const payload = JSON.stringify({ type: "DIAL", phone });
  ws.send(payload, (err) => {
    if (err) logger.error("Failed to send DIAL command", { hardware: true, error: err.message });
    else logger.info("DIAL command sent", { hardware: true, phone });
  });
}
