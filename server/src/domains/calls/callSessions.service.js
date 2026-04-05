/**
 * domains/calls/callSessions.service.js
 *
 * Persists CTI call-session metadata keyed by bridge callId.
 */

import { getDb } from "../../infrastructure/db.js";
import { normaliseUkPhone } from "../../shared/phones.js";
import { ValidationError } from "../../shared/errors.js";

const stmts = {
  findByCallId: null,
  upsert: null,
};

function getStmts() {
  const db = getDb();
  return {
    findByCallId: (stmts.findByCallId ??= db.prepare(
      "SELECT * FROM call_sessions WHERE call_id = ?",
    )),
    upsert: (stmts.upsert ??= db.prepare(`
      INSERT INTO call_sessions (
        call_id, phone, offered_at, connected_at, ended_at,
        selected_customer_phone, selected_customer_name, selected_address, notes, updated_at
      ) VALUES (
        @callId, @phone, @offeredAt, @connectedAt, @endedAt,
        @selectedCustomerPhone, @selectedCustomerName, @selectedAddress, @notes, @updatedAt
      )
      ON CONFLICT(call_id) DO UPDATE SET
        phone = excluded.phone,
        offered_at = excluded.offered_at,
        connected_at = excluded.connected_at,
        ended_at = excluded.ended_at,
        selected_customer_phone = excluded.selected_customer_phone,
        selected_customer_name = excluded.selected_customer_name,
        selected_address = excluded.selected_address,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `)),
  };
}

function validateCallId(callId) {
  const num = Number(callId);
  if (!Number.isInteger(num) || num <= 0) {
    throw new ValidationError("callId must be a positive integer", { field: "callId" });
  }
  return num;
}

function rowToSession(row) {
  if (!row) return null;
  return {
    callId: row.call_id,
    phone: row.phone ?? null,
    offeredAt: row.offered_at ?? null,
    connectedAt: row.connected_at ?? null,
    endedAt: row.ended_at ?? null,
    selectedCustomerPhone: row.selected_customer_phone ?? null,
    selectedCustomerName: row.selected_customer_name ?? null,
    selectedAddress: row.selected_address ?? null,
    notes: row.notes ?? null,
    updatedAt: row.updated_at,
  };
}

function toDbParams(session) {
  return {
    callId: session.callId,
    phone: session.phone ?? null,
    offeredAt: session.offeredAt ?? null,
    connectedAt: session.connectedAt ?? null,
    endedAt: session.endedAt ?? null,
    selectedCustomerPhone: session.selectedCustomerPhone ?? null,
    selectedCustomerName: session.selectedCustomerName ?? null,
    selectedAddress: session.selectedAddress ?? null,
    notes: session.notes ?? null,
    updatedAt: session.updatedAt,
  };
}

export function getCallSession(callId) {
  const normalizedCallId = validateCallId(callId);
  const row = getStmts().findByCallId.get(normalizedCallId);
  return rowToSession(row);
}

export function upsertCallSession(callId, patch) {
  const normalizedCallId = validateCallId(callId);
  const current = getCallSession(normalizedCallId) ?? {
    callId: normalizedCallId,
    phone: null,
    offeredAt: null,
    connectedAt: null,
    endedAt: null,
    selectedCustomerPhone: null,
    selectedCustomerName: null,
    selectedAddress: null,
    notes: null,
    updatedAt: null,
  };

  const merged = {
    ...current,
    ...patch,
    selectedCustomerPhone: patch?.selectedCustomerPhone
      ? normaliseUkPhone(patch.selectedCustomerPhone)
      : patch?.selectedCustomerPhone === null
        ? null
        : current.selectedCustomerPhone,
    updatedAt: new Date().toISOString(),
  };

  getStmts().upsert.run(toDbParams(merged));
  return merged;
}

export function markCallOffered(callId, phone) {
  return upsertCallSession(callId, {
    phone: normaliseUkPhone(phone),
    offeredAt: new Date().toISOString(),
  });
}

export function markCallConnected(callId) {
  return upsertCallSession(callId, {
    connectedAt: new Date().toISOString(),
  });
}

export function markCallEnded(callId) {
  return upsertCallSession(callId, {
    endedAt: new Date().toISOString(),
  });
}
