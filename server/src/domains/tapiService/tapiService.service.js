/**
 * domains/tapiService/tapiService.service.js
 *
 * Orchestrates the full TAPI call lifecycle:
 *
 *  OFFERING     → delegate to callerIdService (customer lookup + WS broadcast)
 *               → track call metadata keyed by callId
 *  CONNECTED    → record answer time (authoritative call start for duration)
 *  DISCONNECTED → log completed call to call_logs table
 *
 * init() must be called once at server startup with a reference to the
 * callerIdService's handlePhoneDetected so we reuse all the existing debounce,
 * lookup, and broadcast logic without duplicating it here.
 */

import { getDb } from "../../infrastructure/db.js";
import { logger } from "../../infrastructure/logger.js";

/**
 * @type {((phone: string) => Promise<void>) | null}
 */
let _handlePhoneDetected = null;

/**
 * Active calls: callId (number) → { phone: string, offeredAt: Date, connectedAt: Date | null }
 * @type {Map<number, { phone: string, offeredAt: Date, connectedAt: Date | null }>}
 */
const activeCalls = new Map();

/**
 * Inject the callerIdService.handlePhoneDetected dependency.
 * Must be called once before any TAPI events arrive.
 *
 * @param {{ handlePhoneDetected: (phone: string) => Promise<void> }} deps
 */
export function init({ handlePhoneDetected }) {
  if (typeof handlePhoneDetected !== "function") {
    throw new TypeError("tapiService.init() requires handlePhoneDetected function");
  }
  _handlePhoneDetected = handlePhoneDetected;
}

/**
 * Called when a TAPI OFFERING event fires (the phone is ringing).
 *
 * @param {string} phone  - Normalised digits-only phone number
 * @param {number} callId - Opaque call handle from the bridge
 */
export async function handleOffering(phone, callId) {
  if (!phone) return;

  activeCalls.set(callId, { phone, offeredAt: new Date(), connectedAt: null });

  if (!_handlePhoneDetected) {
    logger.error("tapiService: handlePhoneDetected not initialised — call init() at startup");
    return;
  }

  // Delegate to callerIdService: debounce + DB lookup + WS broadcast
  try {
    await _handlePhoneDetected(phone);
  } catch (err) {
    logger.error("tapiService: handlePhoneDetected threw", {
      phone,
      callId,
      error: err?.message,
    });
  }
}

/**
 * Called when a TAPI CONNECTED event fires.
 * Updates the call start time to the moment the call was actually answered
 * (more accurate for duration tracking than the OFFERING timestamp).
 *
 * @param {number} callId
 */
export function handleConnected(callId) {
  const call = activeCalls.get(callId);
  if (call) {
    activeCalls.set(callId, { ...call, connectedAt: new Date() });
  } else {
    // Connected arrived without a prior OFFERING — record it anyway
    const now = new Date();
    activeCalls.set(callId, { phone: "", offeredAt: now, connectedAt: now });
  }
}

/**
 * Called when a TAPI DISCONNECTED event fires.
 * Logs the completed call to the call_logs table.
 *
 * @param {number} callId
 * @param {string} phone         - May be empty if bridge couldn't extract it; fall back to tracked value
 * @param {number} durationSeconds - Bridge-reported duration (fallback when call state is missing)
 */
export async function handleDisconnected(callId, phone, durationSeconds) {
  const call = activeCalls.get(callId);
  activeCalls.delete(callId);

  const resolvedPhone = phone || call?.phone || "";
  if (!resolvedPhone) {
    logger.warn("tapiService: DISCONNECTED with no phone number — skipping log", { callId });
    return;
  }

  const endedAt = new Date();
  const startedAt =
    call?.connectedAt ?? new Date(endedAt.getTime() - Math.max(0, (durationSeconds || 0) * 1_000));
  const resolvedDurationSeconds = Math.max(
    0,
    Math.round((endedAt.getTime() - startedAt.getTime()) / 1_000),
  );

  try {
    const db = getDb();

    // Snapshot customer name at call-end time for the log (best-effort)
    let customerName = null;
    try {
      const row = db.prepare("SELECT name FROM customers WHERE phone = ?").get(resolvedPhone);
      customerName = row?.name ?? null;
    } catch {
      // Non-fatal — log without name
    }

    db.prepare(
      `
      INSERT INTO call_logs (phone, call_started_at, call_ended_at, duration_seconds, customer_name)
      VALUES (?, ?, ?, ?, ?)
    `,
    ).run(
      resolvedPhone,
      startedAt.toISOString(),
      endedAt.toISOString(),
      resolvedDurationSeconds,
      customerName,
    );

    logger.info("Call logged", {
      phone: resolvedPhone,
      durationSeconds: resolvedDurationSeconds,
      customerName,
    });
  } catch (err) {
    logger.error("tapiService: Failed to log call", {
      phone: resolvedPhone,
      error: err?.message,
    });
  }
}

/**
 * Returns a snapshot of currently active calls (for diagnostics/telemetry).
 * @returns {Array<{ callId: number, phone: string, startedAt: string }>}
 */
export function getActiveCalls() {
  return [...activeCalls.entries()].map(([callId, { phone, offeredAt, connectedAt }]) => ({
    callId,
    phone,
    startedAt: (connectedAt ?? offeredAt).toISOString(),
  }));
}
