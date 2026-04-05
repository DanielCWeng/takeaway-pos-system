/**
 * domains/orders/orders.service.js
 *
 * Order business rules. No Express types.
 *
 * The service receives plain objects from the route handler and returns plain objects.
 * It delegates persistence to the repo and (in Phase 2) printing to the hardware adapter.
 *
 * Bugs fixed vs. the old system:
 *  - The silent delivery→collection conversion is gone. A delivery order without a
 *    valid address is a ValidationError, not a quiet schema mutation.
 *  - ID generation is delegated entirely to the repo (which uses AUTOINCREMENT).
 */

import * as repo from "./orders.repo.js";
import * as customers from "../customers/customers.service.js";
import { config } from "../../config/index.js";
import { getDb } from "../../infrastructure/db.js";
import { logger } from "../../infrastructure/logger.js";
import { printReceipt } from "../../hardware/printer.js";
import { HardwareError, ValidationError, NotFoundError } from "../../shared/errors.js";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate an incoming order payload.
 * Throws ValidationError with a descriptive message if any rule is violated.
 *
 * @param {object} order - The order object to validate
 * @throws {ValidationError}
 */
function validateOrder(order) {
  if (!order || typeof order !== "object") {
    throw new ValidationError("Order must be a non-null object");
  }

  if (!Array.isArray(order.items) || order.items.length === 0) {
    throw new ValidationError("Order must contain at least one item", {
      field: "items",
    });
  }

  // Validate item payloads
  for (const [i, item] of order.items.entries()) {
    if (!item.name || typeof item.name !== "string") {
      throw new ValidationError(`Item at index ${i} is missing a name`, {
        field: `items[${i}].name`,
      });
    }
    if (typeof item.price !== "number" || item.price < 0) {
      throw new ValidationError(`Item at index ${i} has an invalid price`, {
        field: `items[${i}].price`,
      });
    }
    if (typeof item.quantity !== "number" || item.quantity < 1) {
      throw new ValidationError(`Item at index ${i} has an invalid quantity`, {
        field: `items[${i}].quantity`,
      });
    }
  }

  const validOrderTypes = ["collection", "delivery"];
  if (!validOrderTypes.includes(order.orderType)) {
    throw new ValidationError(`Order type must be one of: ${validOrderTypes.join(", ")}`, {
      field: order.orderType,
      received: order.orderType,
    });
  }

  // Delivery orders MUST have a customer address.
  // The old system silently converted these to collection orders — that bug is fixed here.
  // NOTE: Phone number is intentionally optional for delivery as some customers call with no ID.
  if (order.orderType === "delivery") {
    const info = order.customerInfo;
    if (!info || !info.address || !info.postcode) {
      throw new ValidationError(
        "Delivery orders require a valid customer address and postcode. " +
          "Confirm the address before submitting.",
        { field: "customerInfo", orderType: "delivery" },
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * Validate and persist a new order.
 *
 * @param {object} orderData - Raw order payload from the route handler
 * @returns {{ id: number, data: object, archivedAt: string }}
 * @throws {ValidationError} if the order fails business rules
 */
export function createOrder(orderData) {
  validateOrder(orderData);

  // Auto-sync the customer profile so that Name/Address aren't missing in future searches/exports
  if (orderData.customerInfo) {
    customers.syncCustomerFromOrder(orderData.customerInfo);
  }

  return repo.createOrder({ data: orderData });
}

/**
 * Archive an order and attempt to print it.
 *
 * Saving the order is the critical operation; printing is best-effort (mirrors legacy behaviour).
 *
 * @param {object} orderData - Raw order payload from the route handler
 * @returns {Promise<{ orderId: number, printed: boolean }>}
 */
export async function printAndArchiveOrder(orderData) {
  const archived = createOrder(orderData);

  try {
    const result = await printReceipt(archived);
    return { orderId: archived.id, printed: result.printed === true };
  } catch (err) {
    const isHardwareError = err instanceof HardwareError;
    logger.error("Order saved but printing failed", {
      hardware: true,
      orderId: archived.id,
      error: err?.message ?? String(err),
      ...(isHardwareError ? { details: err.details } : {}),
    });
    return { orderId: archived.id, printed: false };
  }
}

/**
 * Delete an order by ID.
 * Returns nothing on success; throws NotFoundError if the order does not exist.
 *
 * @param {number} id
 * @throws {NotFoundError}
 */
export function deleteOrder(id) {
  const db = getDb();
  const deleteTx = db.transaction(() => {
    const existing = repo.findOrderById(id);
    if (!existing) {
      throw new NotFoundError(`Order with id ${id} not found`, { id });
    }
    repo.deleteOrder(id);
  });
  deleteTx();
}

/**
 * Delete all archived orders for a specific date.
 *
 * @param {string} date - ISO date string (YYYY-MM-DD)
 */
export function deleteOrdersByDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ValidationError("Invalid date format. Expected YYYY-MM-DD", { date });
  }
  repo.deleteOrdersByDate(date);
}

/**
 * Delete archived orders older than the configured years (Retention Policy).
 *
 * @returns {number} Number of deleted rows
 */
export function cleanupOldOrders() {
  const years = config.business.dataRetentionYears ?? 6;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - years);

  const isoCutoff = cutoff.toISOString();
  const deletedCount = repo.deleteOrdersBefore(isoCutoff);

  logger.info(`Retention cleanup: deleted ${deletedCount} orders older than ${years} years`, {
    cutoff: isoCutoff,
    deletedCount,
  });

  return deletedCount;
}

/**
 * Scrub all PII from orders for a specific phone number.
 *
 * @param {string} phone
 * @param {string} anonId
 * @returns {number}
 */
export function scrubOrdersByPhone(phone, anonId) {
  return repo.anonymizeOrdersByPhone(phone, anonId);
}

/**
 * Find all order history for a specific phone number.
 * (Used for Data Export / Access requests)
 *
 * @param {string} phone
 * @returns {Array<{ id: number, data: object, archivedAt: string }>}
 */
export function getOrdersByPhone(phone) {
  return repo.findOrdersByPhone(phone);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * List archived orders, optionally filtered by date.
 *
 * @param {string} [date] - Optional ISO date string (YYYY-MM-DD)
 * @returns {Array<{ id: number, data: object, archivedAt: string }>}
 */
export function listOrders(date) {
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new ValidationError("Invalid date format. Expected YYYY-MM-DD", { date });
    }
    return repo.findOrdersByDate(date);
  }
  return repo.findAllOrders();
}

/**
 * Find a single order by ID.
 *
 * @param {number} id
 * @returns {{ id: number, data: object, archivedAt: string }}
 * @throws {NotFoundError}
 */
export function getOrderById(id) {
  const order = repo.findOrderById(id);
  if (!order) {
    throw new NotFoundError(`Order with id ${id} not found`, { id });
  }
  return order;
}

// ---------------------------------------------------------------------------
// Printing (Phase 2)
// ---------------------------------------------------------------------------

/**
 * Reprint an archived order to the thermal printer.
 * NOT IMPLEMENTED — requires hardware access (Phase 2).
 *
 * @throws {NotFoundError}
 */
export async function reprintOrder(id) {
  const archived = repo.findOrderById(id);
  if (!archived) {
    throw new NotFoundError(`Order with id ${id} not found`, { id });
  }

  try {
    const result = await printReceipt(archived);
    return { printed: result.printed === true };
  } catch (err) {
    logger.error("Reprint failed", {
      hardware: true,
      orderId: id,
      error: err?.message ?? String(err),
    });
    return { printed: false };
  }
}
