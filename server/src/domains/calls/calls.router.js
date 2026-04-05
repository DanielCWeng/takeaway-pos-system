/**
 * domains/calls/calls.router.js
 *
 * Routes:
 *   POST /api/calls/dial  — click-to-dial via TAPI bridge
 */

import { Router } from "express";
import { dial } from "../../hardware/tapiDevice.js";
import { config } from "../../config/index.js";

export const callsRouter = Router();

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

  const { phone } = req.body ?? {};
  if (!phone || typeof phone !== "string") {
    return res.status(400).json({
      error: { code: "INVALID_PHONE", message: "phone must be a non-empty string." },
    });
  }

  // Strip non-digits for safety — never forward raw user input to the bridge
  const normalised = phone.replace(/\D/g, "");
  if (!normalised) {
    return res.status(400).json({
      error: { code: "INVALID_PHONE", message: "phone contains no digits." },
    });
  }

  dial(normalised);
  res.status(202).json({ ok: true, phone: normalised });
});
