/**
 * domains/customers/customers.router.js
 *
 * Express route handlers for /customers.
 *
 * Rules:
 *  - Request body validation via zod (shape only, not business rules)
 *  - Delegation to customers.service.js for all business logic
 *  - No business logic in this file
 */

import { Router } from "express";
import { z } from "zod";
import * as service from "./customers.service.js";

export const customersRouter = Router();

// ---------------------------------------------------------------------------
// Request body schemas
// ---------------------------------------------------------------------------

const updateAddressSchema = z.object({
  houseNumber: z.string().optional(),
  street: z.string().optional(),
  town: z.string().optional(),
  postcode: z.string().optional(),
  address: z.string().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  distance: z.number().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/customers/:phone
 * Fetch a customer by phone number. Returns 404 if not found.
 */
customersRouter.get("/:phone", (req, res, next) => {
  const { phone } = req.params;

  // Basic sanity check before hitting service
  if (!phone || phone.length < 10) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Phone number must contain between 10 and 13 digits",
        details: { phone: ["Phone number is too short or missing"] },
      },
    });
  }

  try {
    const customer = service.getCustomerByPhone(phone);
    return res.json({ customer });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/customers/:phone/address
 * Update address fields for an existing customer.
 */
customersRouter.post("/:phone/address", (req, res, next) => {
  const parsed = updateAddressSchema.safeParse(req.body);
  if (!parsed.success) {
    const details = parsed.error.flatten().fieldErrors;
    return res
      .status(400)
      .json({ error: { code: "VALIDATION_ERROR", message: "Invalid request body", details } });
  }

  try {
    const customer = service.updateCustomerAddress(req.params.phone, parsed.data);
    return res.json({ customer });
  } catch (err) {
    next(err);
  }
});
