/**
 * domains/calls/calls.router.js
 *
 * Routes:
 *   POST /api/calls/dial  — click-to-dial via TAPI bridge
 */

import { Router } from "express";
import { dial, isBridgeConnected } from "../../hardware/tapiDevice.js";
import { config } from "../../config/index.js";
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
 * Passes the dial command to the TAPI bridge.
 * Returns 503 if TAPI integration is disabled (TAPI_BRIDGE_PORT=0).
 */
callsRouter.post("/dial", (req, res) => {
  if (config.tapi.bridgePort === 0) {
    return res.status(503).json({
      error: { code: "TAPI_DISABLED", message: "TAPI integration is not enabled on this server." },
    });
  }

  if (!isBridgeConnected()) {
    return res.status(503).json({
      error: {
        code: "TAPI_UNAVAILABLE",
        message: "TAPI bridge is enabled but not currently connected.",
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
        code: "TAPI_UNAVAILABLE",
        message: "TAPI bridge is not ready to accept dial commands.",
      },
    });
  }

  res.status(202).json({ ok: true, phone: normalised });
});
