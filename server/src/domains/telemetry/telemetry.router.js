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
    message: payload.message,
    source: payload.source,
    stack: payload.stack,
    userAgent: payload.userAgent,
    route: payload.route,
    clientTime: payload.time,
  });

  return res.status(204).send();
});
