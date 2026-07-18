/**
 * domains/telemetry/telemetry.router.js
 *
 * Accepts client-side runtime error reports so browser-only failures
 * are visible in server logs.
 */

import { Router } from "express";
import { z } from "zod";
import { logger } from "../../infrastructure/logger.js";
import { sendValidationError } from "../../shared/middleware/sendValidationError.js";

export const telemetryRouter = Router();

function redactSensitiveText(value) {
  if (!value || typeof value !== "string") return value;

  return value
    .replace(/\b(?:\+?44|0)\d{9,12}\b/g, "[REDACTED_PHONE]")
    .replace(/\b(?:ANON|UNKNOWN)-[A-Za-z0-9-]+\b/g, "[REDACTED_ID]")
    .replace(/\/customers\/[^/\s?]+/gi, "/customers/[redacted]")
    .replace(/\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi, "Bearer [REDACTED_TOKEN]");
}

const clientErrorSchema = z.object({
  type: z.string().min(1).max(64),
  message: z.string().min(1).max(2000),
  source: z.string().max(2000).optional(),
  stack: z.string().max(12000).optional(),
  userAgent: z.string().max(600).optional(),
  route: z.string().max(400).optional(),
  time: z.string().max(64).optional(),
});

telemetryRouter.post("/client-error", (req, res) => {
  const parsed = clientErrorSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendValidationError(res, parsed.error.flatten().fieldErrors);
  }

  const payload = parsed.data;
  logger.error("Client runtime error reported", {
    requestId: req.requestId,
    client: true,
    errorType: payload.type,
    message: redactSensitiveText(payload.message),
    source: redactSensitiveText(payload.source),
    stack: redactSensitiveText(payload.stack),
    userAgent: payload.userAgent,
    route: redactSensitiveText(payload.route),
    clientTime: payload.time,
  });

  return res.status(204).send();
});
