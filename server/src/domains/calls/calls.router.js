/**
 * domains/calls/calls.router.js
 *
 * Routes:
 *   POST /api/calls/dial  — click-to-dial via TAPI bridge
 */

import { Router } from "express";
import {
  dial,
  isTelephonyConnected,
  isDialEnabled,
  getTelephonyProvider,
} from "../../hardware/telephonyDevice.js";
import { upsertCallSession } from "./callSessions.service.js";
import { normaliseUkPhone } from "../../shared/phones.js";

export const callsRouter = Router();

/**
 * POST /api/calls/session
 * Body: {
 *   callId: number,
 *   selectedCustomerPhone?: string,
 *   selectedCustomerName?: string,
 *   selectedAddress?: string,
 *   notes?: string
 * }
 */
callsRouter.post("/session", (req, res, next) => {
  const { callId, selectedCustomerPhone, selectedCustomerName, selectedAddress, notes } =
    req.body ?? {};

  const id = Number(callId);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      error: { code: "INVALID_CALL_ID", message: "callId must be a positive integer." },
    });
  }

  try {
    upsertCallSession(id, {
      selectedCustomerPhone:
        typeof selectedCustomerPhone === "string" && selectedCustomerPhone.trim()
          ? normaliseUkPhone(selectedCustomerPhone)
          : undefined,
      selectedCustomerName:
        typeof selectedCustomerName === "string" ? selectedCustomerName.trim() || null : undefined,
      selectedAddress:
        typeof selectedAddress === "string" ? selectedAddress.trim() || null : undefined,
      notes: typeof notes === "string" ? notes.trim() || null : undefined,
    });

    return res.status(202).json({ ok: true, callId: id });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/calls/dial
 * Body: { phone: string }
 *
 * Passes the dial command to the configured telephony provider.
 * Returns 503 when dial integration is disabled or provider is unavailable.
 */
callsRouter.post("/dial", (req, res) => {
  const provider = getTelephonyProvider();
  if (!isDialEnabled()) {
    return res.status(503).json({
      error: {
        code: "TELEPHONY_DISABLED",
        message: "Telephony dial integration is not enabled on this server.",
      },
    });
  }

  if (!isTelephonyConnected()) {
    return res.status(503).json({
      error: {
        code: "TELEPHONY_UNAVAILABLE",
        message: `Telephony provider '${provider}' is not currently connected.`,
      },
    });
  }

  const { phone } = req.body ?? {};
  if (!phone || typeof phone !== "string") {
    return res.status(400).json({
      error: { code: "INVALID_PHONE", message: "phone must be a non-empty string." },
    });
  }

  // Strip non-digits for safety — never forward raw user input to the bridge
  const normalised = normaliseUkPhone(phone).replace(/\D/g, "");
  if (!normalised) {
    return res.status(400).json({
      error: { code: "INVALID_PHONE", message: "phone contains no digits." },
    });
  }

  const accepted = dial(normalised);
  if (!accepted) {
    return res.status(503).json({
      error: {
        code: "TELEPHONY_UNAVAILABLE",
        message: `Telephony provider '${provider}' did not accept the dial command.`,
      },
    });
  }

  res.status(202).json({ ok: true, phone: normalised, provider });
});
