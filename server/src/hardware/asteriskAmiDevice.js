/**
 * hardware/asteriskAmiDevice.js
 *
 * Linux-native telephony adapter for Asterisk AMI.
 *
 * This module exposes the same shape as tapiDevice.js:
 *   startListening({ onOffering, onConnected, onDisconnected })
 *   stopListening()
 *   dial(phone)
 *   isBridgeConnected()
 */

import net from "node:net";
import { config } from "../config/index.js";
import { logger } from "../infrastructure/logger.js";
import { normaliseUkPhone } from "../shared/phones.js";

const INITIAL_RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

/** @type {net.Socket | null} */
let socket = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let reconnectTimer = null;
let reconnectAttempt = 0;
let stopped = true;
let ready = false;
let buffer = "";

let nextActionId = 1;
let nextCallId = 1;
let loginActionId = null;

/** @type {((phone: string, callId: number) => void) | null} */
let _onOffering = null;
/** @type {((callId: number) => void) | null} */
let _onConnected = null;
/** @type {((callId: number, phone: string, durationSeconds: number) => void) | null} */
let _onDisconnected = null;

/**
 * @type {Map<string, { callId: number, phone: string, offeredAt: Date | null, connectedAt: Date | null }>}
 */
const callsByUniqueId = new Map();

function getAsteriskConfig() {
  return config.telephony.asterisk;
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function closeSocket() {
  if (!socket) return;
  try {
    socket.removeAllListeners();
    socket.end();
    socket.destroy();
  } catch {
    // ignore shutdown cleanup errors
  } finally {
    socket = null;
    ready = false;
  }
}

function scheduleReconnect(reason) {
  if (stopped || reconnectTimer) return;

  const delay = Math.min(
    INITIAL_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempt),
    MAX_RECONNECT_DELAY_MS,
  );

  reconnectAttempt++;
  logger.warn("Asterisk AMI reconnect scheduled", {
    hardware: true,
    reason,
    delayMs: delay,
    attempt: reconnectAttempt,
  });

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connect();
  }, delay);
}

function formatAction(action, actionId) {
  const lines = [`Action: ${action.Action}`, `ActionID: ${actionId}`];
  for (const [key, value] of Object.entries(action)) {
    if (key === "Action" || value === undefined || value === null) continue;
    lines.push(`${key}: ${value}`);
  }
  return `${lines.join("\r\n")}\r\n\r\n`;
}

function sendAction(action) {
  if (!socket || socket.destroyed) return null;
  const actionId = `node-${Date.now()}-${nextActionId++}`;
  socket.write(formatAction(action, actionId));
  return actionId;
}

function parseFrame(rawFrame) {
  const frame = {};
  const lines = rawFrame
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    const value = line.slice(sep + 1).trim();
    frame[key] = value;
  }

  return frame;
}

function ensureCall(uniqueId, phone = "") {
  const existing = callsByUniqueId.get(uniqueId);
  if (existing) {
    if (phone && !existing.phone) existing.phone = phone;
    return existing;
  }

  const created = {
    callId: nextCallId++,
    phone: phone || "",
    offeredAt: null,
    connectedAt: null,
  };
  callsByUniqueId.set(uniqueId, created);
  return created;
}

function toInboundPhone(frame) {
  const candidates = [frame.CallerIDNum, frame.ConnectedLineNum, frame.CallerIDName];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = normaliseUkPhone(candidate);
    const digits = normalized.replace(/\D/g, "");
    if (digits.length >= 10) return digits;
  }
  return "";
}

function looksLikeOutboundEvent(frame) {
  const outboundContext = getAsteriskConfig().outboundContext?.trim().toLowerCase();
  if (!outboundContext) return false;
  const context = (frame.Context || "").trim().toLowerCase();
  return Boolean(context && context === outboundContext);
}

function handleEvent(frame) {
  const eventType = (frame.Event || "").toUpperCase();
  const uniqueId = frame.Uniqueid || frame.Linkedid;
  if (!uniqueId) return;

  if (eventType === "NEWSTATE") {
    const state = (frame.ChannelStateDesc || "").toLowerCase();
    const phone = toInboundPhone(frame);
    const call = ensureCall(uniqueId, phone);

    if (
      (state.includes("ring") || state.includes("ringing")) &&
      phone &&
      !looksLikeOutboundEvent(frame)
    ) {
      if (!call.offeredAt) {
        call.offeredAt = new Date();
        try {
          _onOffering?.(phone, call.callId);
        } catch (err) {
          logger.error("Asterisk AMI onOffering callback threw", {
            hardware: true,
            error: err?.message ?? String(err),
          });
        }
      }
      return;
    }

    if (state === "up" && !call.connectedAt) {
      call.connectedAt = new Date();
      try {
        _onConnected?.(call.callId);
      } catch (err) {
        logger.error("Asterisk AMI onConnected callback threw", {
          hardware: true,
          error: err?.message ?? String(err),
        });
      }
    }
    return;
  }

  if (eventType === "HANGUP") {
    const call = callsByUniqueId.get(uniqueId);
    const phone = call?.phone || toInboundPhone(frame);
    const endedAt = new Date();
    const connectedAt = call?.connectedAt;
    const durationSeconds = connectedAt
      ? Math.max(0, Math.round((endedAt.getTime() - connectedAt.getTime()) / 1000))
      : 0;

    if (call) callsByUniqueId.delete(uniqueId);

    try {
      _onDisconnected?.(call?.callId ?? nextCallId++, phone, durationSeconds);
    } catch (err) {
      logger.error("Asterisk AMI onDisconnected callback threw", {
        hardware: true,
        error: err?.message ?? String(err),
      });
    }
  }
}

function processFrame(frame) {
  if (frame.Response && frame.ActionID && frame.ActionID === loginActionId) {
    if ((frame.Response || "").toLowerCase() === "success") {
      ready = true;
      reconnectAttempt = 0;
      logger.info("Asterisk AMI authenticated", {
        hardware: true,
        host: getAsteriskConfig().host,
        port: getAsteriskConfig().port,
      });
    } else {
      ready = false;
      logger.error("Asterisk AMI authentication failed", {
        hardware: true,
        response: frame.Response,
        message: frame.Message,
      });
      scheduleReconnect("auth_failed");
      closeSocket();
    }
    return;
  }

  if (frame.Event) handleEvent(frame);
}

function processBuffer() {
  let sep = buffer.indexOf("\r\n\r\n");
  while (sep !== -1) {
    const rawFrame = buffer.slice(0, sep);
    buffer = buffer.slice(sep + 4);
    const frame = parseFrame(rawFrame);
    if (Object.keys(frame).length > 0) processFrame(frame);
    sep = buffer.indexOf("\r\n\r\n");
  }
}

async function connect() {
  if (stopped) return;

  const { host, port, username, secret } = getAsteriskConfig();
  if (!username || !secret) {
    throw new Error(
      "ASTERISK_AMI_USERNAME and ASTERISK_AMI_SECRET are required when TELEPHONY_PROVIDER=asterisk_ami",
    );
  }

  clearReconnectTimer();
  closeSocket();
  buffer = "";
  ready = false;

  logger.info("Connecting to Asterisk AMI", {
    hardware: true,
    host,
    port,
  });

  socket = net.createConnection({ host, port });
  socket.setEncoding("utf8");

  socket.on("connect", () => {
    logger.info("Asterisk AMI socket connected", { hardware: true, host, port });
    loginActionId = sendAction({
      Action: "Login",
      Username: username,
      Secret: secret,
      Events: "on",
    });
  });

  socket.on("data", (chunk) => {
    buffer += chunk;
    processBuffer();
  });

  socket.on("error", (err) => {
    logger.warn("Asterisk AMI socket error", {
      hardware: true,
      error: err?.message ?? String(err),
    });
  });

  socket.on("close", () => {
    const wasReady = ready;
    ready = false;
    loginActionId = null;
    if (stopped) return;

    logger.warn("Asterisk AMI socket closed", {
      hardware: true,
      wasReady,
    });
    scheduleReconnect(wasReady ? "socket_closed_after_ready" : "socket_closed_before_ready");
  });
}

export async function startListening({ onOffering, onConnected, onDisconnected }) {
  if (typeof onOffering !== "function") {
    throw new TypeError("startListening() requires onOffering callback");
  }
  if (!stopped) {
    throw new Error("startListening() called while already listening — call stopListening() first");
  }

  _onOffering = onOffering;
  _onConnected = onConnected ?? null;
  _onDisconnected = onDisconnected ?? null;
  stopped = false;
  reconnectAttempt = 0;
  callsByUniqueId.clear();

  await connect();
}

export function stopListening() {
  stopped = true;
  ready = false;
  _onOffering = null;
  _onConnected = null;
  _onDisconnected = null;
  callsByUniqueId.clear();
  loginActionId = null;
  clearReconnectTimer();
  closeSocket();
  logger.info("Asterisk AMI listener stopped", { hardware: true });
}

function applyTemplate(template, number) {
  return template.replaceAll("{number}", number);
}

export function dial(phone) {
  if (!isBridgeConnected()) {
    logger.warn("asteriskAmiDevice.dial() called but AMI is not connected", {
      hardware: true,
      phone,
    });
    return false;
  }

  const digits = normaliseUkPhone(phone).replace(/\D/g, "");
  if (!digits) return false;

  const ast = getAsteriskConfig();
  const accepted = sendAction({
    Action: "Originate",
    Channel: applyTemplate(ast.channelTemplate, digits),
    Context: ast.context,
    Exten: applyTemplate(ast.extenTemplate, digits),
    Priority: ast.priority,
    CallerID: ast.callerId || undefined,
    Async: "true",
  });
  return Boolean(accepted);
}

export function isBridgeConnected() {
  return Boolean(socket && !socket.destroyed && ready);
}
