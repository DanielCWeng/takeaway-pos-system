import { Router } from "express";
import { z } from "zod";
import * as service from "./addresses.service.js";
import { sendValidationError } from "../../shared/middleware/sendValidationError.js";

export const addressesRouter = Router();

const lookupSchema = z.object({ postcode: z.string().min(1) });

addressesRouter.post("/lookup", async (req, res, next) => {
  const parsed = lookupSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error.flatten().fieldErrors);
  try {
    return res.json(await service.lookupPostcode(parsed.data.postcode));
  } catch (error) {
    next(error);
  }
});
