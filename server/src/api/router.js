/**
 * api/router.js
 *
 * Root API router. Mounts all domain routers under their respective paths.
 * Also defines the global Express error handler.
 *
 * Rules:
 *  - No business logic here.
 *  - No direct DB access here.
 *  - The error handler is the single point where uncaught domain errors
 *    are formatted into the standard error envelope before sending.
 */

import { Router } from 'express';
import { ordersRouter } from '../domains/orders/orders.router.js';
import { customersRouter } from '../domains/customers/customers.router.js';
import { addressesRouter } from '../domains/addresses/addresses.router.js';
import { telemetryRouter } from '../domains/telemetry/telemetry.router.js';
import { errorHandler as globalErrorHandler } from '../shared/middleware/errorHandler.js';

export const apiRouter = Router();

// ---------------------------------------------------------------------------
// Mount domain routers
// ---------------------------------------------------------------------------

apiRouter.use('/orders', ordersRouter);
apiRouter.use('/customers', customersRouter);
apiRouter.use('/addresses', addressesRouter);
apiRouter.use('/telemetry', telemetryRouter);

// ---------------------------------------------------------------------------
// 404 handler - unknown API route
// Note: Express skips this for next(err) calls (error middleware requires 4 params)
// ---------------------------------------------------------------------------

apiRouter.use((_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested API endpoint does not exist',
      details: {},
    },
  });
});

// Re-export the shared handler as globalErrorHandler for server.js
export { globalErrorHandler };
