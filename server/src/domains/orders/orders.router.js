/**
 * domains/orders/orders.router.js
 *
 * Express route handlers for /orders.
 *
 * Rules enforced here:
 *  - Request body validation via zod (shape only, not business rules)
 *  - Delegation to orders.service.js for all business logic
 *  - ValidationError → 400, NotFoundError → 404, NotImplementedError → 501
 *  - No business logic in this file
 */

import { Router } from 'express';
import { z } from 'zod';
import * as service from './orders.service.js';
import { sendValidationError } from '../../shared/middleware/sendValidationError.js';

export const ordersRouter = Router();

// ---------------------------------------------------------------------------
// Request body schemas
// ---------------------------------------------------------------------------

const orderItemSchema = z.object({
  name: z.string().min(1),
  price: z.number().nonnegative(),
  // Option A — Keep defaults, but document the intent explicitly
  // "Defaults are canonical — absence and false/empty are equivalent in this system"
  quantity: z.number().int().positive().optional().default(1),
  modifiers: z.array(z.string()).optional().default([]),
  finalPrice: z.number().nonnegative().optional(),
  hidePrice: z.boolean().optional().default(false),
  hideQuantity: z.boolean().optional().default(false),
});

const customerInfoSchema = z
  .object({
    name: z.string().optional(),
    phone: z.string().optional(),
    postcode: z.string().optional(),
    address: z.string().optional(),
    houseNumber: z.string().optional(),
    street: z.string().optional(),
    town: z.string().optional(),
  })
  .optional();

const createOrderSchema = z.object({
  orderType: z.enum(['collection', 'delivery']),
  items: z.array(orderItemSchema).min(1, 'Order must contain at least one item'),
  customerInfo: customerInfoSchema,
  subtotal: z.number().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
  deliveryCharge: z.number().nonnegative().optional(),
  paymentMethod: z.string().optional(),
  cashGiven: z.number().nonnegative().optional(),
  change: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

const paymentSchema = z.object({
  method: z.enum(['cash', 'card']),
  amount: z.number().nonnegative(),
});

const printableOrderSchema = z.object({
  orderType: z.enum(['collection', 'delivery']),
  items: z.array(
    z.object({
      name: z.string().min(1),
      price: z.number().nonnegative(),
      quantity: z.number().int().positive(),
    }),
  ),
  customerInfo: z
    .object({
      name: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      postcode: z.string().optional(),
      distance: z.number().optional(),
    })
    .optional(),
  payment: paymentSchema.optional(),
  total: z.number().nonnegative(),
  notes: z.string().optional(),
});

const printOrderRequestSchema = z.object({
  order: printableOrderSchema,
  payment: paymentSchema.optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a route param as a positive integer. Returns null if invalid.
 * @param {string} raw
 * @returns {number | null}
 */
function parseId(raw) {
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/orders
 * Create and archive a new order.
 */
ordersRouter.post('/', (req, res, next) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    const details = parsed.error.flatten().fieldErrors;
    return sendValidationError(res, details);
  }

  try {
    const order = service.createOrder(parsed.data);
    return res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/orders/print
 * Validate, archive, and attempt to print a receipt.
 *
 * Printing is best-effort: the order is always saved first; failures return { printed: false }.
 */
ordersRouter.post('/print', async (req, res, next) => {
  const parsed = printOrderRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const details = parsed.error.flatten().fieldErrors;
    return sendValidationError(res, details);
  }

  const { order, payment } = parsed.data;
  const orderData = { ...order, payment: payment ?? order.payment };

  if (!orderData.payment) {
    return sendValidationError(res, { payment: ['Payment details are required'] });
  }

  try {
    const result = await service.printAndArchiveOrder(orderData);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/orders
 * List archived orders, optionally filtered by date (?date=YYYY-MM-DD).
 */
ordersRouter.get('/', (req, res, next) => {
  const { date } = req.query;
  try {
    const orders = service.listOrders(date);
    return res.json({ orders });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/orders/:id
 * Fetch a single order by ID.
 */
ordersRouter.get('/:id', (req, res, next) => {
  const id = parseId(req.params.id);
  if (!id) {
    return sendValidationError(res, {}, 'Order id must be a positive integer');
  }

  try {
    const order = service.getOrderById(id);
    return res.json({ order });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/orders/:id OR DELETE /api/orders?date=YYYY-MM-DD
 * Delete specific order or all orders for a day.
 */
ordersRouter.delete(['/', '/:id'], (req, res, next) => {
  const { id: idParam } = req.params;
  const { date } = req.query;

  try {
    if (idParam) {
      const id = parseId(idParam);
      if (!id) {
        return sendValidationError(res, {}, 'Order id must be a positive integer');
      }
      service.deleteOrder(id);
    } else if (date) {
      service.deleteOrdersByDate(date);
    } else {
      return sendValidationError(res, {}, 'Must provide either an order ID or a date');
    }
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/orders/:id/reprint
 * Reprint an archived order. Phase 2 stub — returns 501.
 */
ordersRouter.post('/:id/reprint', async (req, res, next) => {
  const id = parseId(req.params.id);
  if (!id) {
    return sendValidationError(res, {}, 'Order id must be a positive integer');
  }

  try {
    const result = await service.reprintOrder(id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});
