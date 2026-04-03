/**
 * domains/addresses/addresses.router.js
 *
 * Express route handlers for /addresses.
 *
 * Rules:
 *  - Request body validation via zod (shape only)
 *  - Delegation to addresses.service.js for all business logic
 */

import { Router } from 'express';
import { z } from 'zod';
import * as service from './addresses.service.js';
import { sendValidationError } from '../../shared/middleware/sendValidationError.js';

export const addressesRouter = Router();

const lookupSchema = z.object({
  postcode: z.string().min(1),
});

const verifySchema = z.object({
  phone: z.string().optional(),
  addressData: z.object({
    line1: z.string().optional(),
    line2: z.string().optional(),
    town: z.string().optional(),
    postcode: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }),
});

/**
 * POST /api/addresses/lookup
 */
addressesRouter.post('/lookup', async (req, res, next) => {
  const parsed = lookupSchema.safeParse(req.body);
  if (!parsed.success) {
    const details = parsed.error.flatten().fieldErrors;
    return sendValidationError(res, details);
  }

  try {
    const result = await service.lookupPostcode(parsed.data.postcode);
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/addresses/verify
 */
addressesRouter.post('/verify', (req, res, next) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    const details = parsed.error.flatten().fieldErrors;
    return sendValidationError(res, details);
  }

  try {
    const customer = service.verifyAddress(parsed.data.phone, parsed.data.addressData);
    return res.json({ customer });
  } catch (err) {
    next(err);
  }
});
