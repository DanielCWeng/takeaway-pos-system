import { Router } from "express";
import { z } from "zod";
import { predict } from "./eta.service.js";
import { getActiveOrders } from "../orders/orders.repo.js";
import { sendValidationError } from "../../shared/middleware/sendValidationError.js";

export const etaRouter = Router();

const querySchema = z.object({
  orderType: z.enum(["collection", "delivery"]),
  itemCount: z.coerce.number().int().positive(),
  complexity: z.coerce.number().int().min(1).max(3).optional(),
});

/**
 * GET /api/eta
 * Returns a prep-time prediction for an order about to be placed.
 * Queue depth is computed server-side from currently active orders.
 */
etaRouter.get("/", (req, res, next) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return sendValidationError(res, parsed.error.flatten().fieldErrors);
  }

  const { orderType, itemCount, complexity } = parsed.data;
  const isDelivery = orderType === "delivery";
  const c = complexity ?? (itemCount <= 2 ? 1 : itemCount <= 4 ? 2 : 3);

  try {
    const queueDepth = getActiveOrders().length;
    const { predictedMins, rangeLow, rangeHigh } = predict(itemCount, c, queueDepth, isDelivery);
    return res.json({ predictedMins, rangeLow, rangeHigh, queueDepth });
  } catch (err) {
    next(err);
  }
});
