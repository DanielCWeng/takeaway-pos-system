/**
 * Orders Domain Module
 *
 * Handles order-related business logic including:
 * - Order validation
 * - Order archiving to database
 * - Order retrieval and deletion
 */

import { getDb } from "../../database.js";

// ===================================================================
//                      VALIDATION
// ===================================================================

/**
 * Validate and potentially modify a delivery order
 * If delivery order is missing address, converts to Collection
 * @param {Object} orderData - Order data from frontend
 * @returns {Object} Validated/modified order data
 */
function validateDeliveryOrder(orderData) {
  if (orderData.orderType === "Delivery") {
    const { customerInfo } = orderData;
    const hasAddress =
      customerInfo && (customerInfo.address || (customerInfo.houseNumber && customerInfo.street));

    if (!hasAddress) {
      console.log("[Orders] Delivery order missing address - enforcing Collection type.");
      orderData.orderType = "Collection";
      if (orderData.deliveryCharge) {
        orderData.total -= orderData.deliveryCharge;
        orderData.deliveryCharge = 0;
      }
    }
  }
  return orderData;
}

// ===================================================================
//                      ORDER CRUD
// ===================================================================

/**
 * Create and archive a new order
 * @param {Object} orderData - Order data from frontend
 * @returns {Promise<Object>} Archived order with ID and timestamp
 */
async function createOrder(orderData) {
  const db = getDb();

  // Get max ID from DB
  const result = await db.get("SELECT MAX(id) as maxId FROM orders");
  const maxId = result.maxId || 0;
  const newOrderId = maxId + 1;

  const orderToArchive = {
    ...orderData,
    id: newOrderId,
    archivedAt: new Date().toISOString(),
  };

  await db.run(
    "INSERT INTO orders (id, data, archivedAt) VALUES (?, ?, ?)",
    newOrderId,
    JSON.stringify(orderToArchive),
    orderToArchive.archivedAt,
  );

  console.log(`[Orders] Order #${newOrderId} saved successfully to SQLite.`);

  return orderToArchive;
}

/**
 * Get archived orders, optionally filtered by date
 * @param {string} [date] - Optional date filter (YYYY-MM-DD format)
 * @returns {Promise<Array>} Array of order objects
 */
async function getArchivedOrders(date) {
  const db = getDb();
  let query = "SELECT data FROM orders";
  let params = [];

  if (date) {
    query += " WHERE archivedAt LIKE ?";
    params.push(`${date}%`);
  }

  const rows = await db.all(query, params);
  return rows.map((row) => JSON.parse(row.data));
}

/**
 * Delete archived orders for a specific date
 * @param {string} date - Date to delete orders for (YYYY-MM-DD format)
 * @returns {Promise<Object>} Result with success status and count
 */
async function deleteArchivedOrders(date) {
  const db = getDb();

  // Check if there are orders to delete
  const countResult = await db.get(
    "SELECT COUNT(*) as count FROM orders WHERE archivedAt LIKE ?",
    `${date}%`,
  );

  if (countResult.count === 0) {
    console.log(`[Orders] No orders found for ${date}. No changes made.`);
    return {
      success: true,
      count: 0,
      message: `No orders found for ${date} to delete.`,
    };
  }

  await db.run("DELETE FROM orders WHERE archivedAt LIKE ?", `${date}%`);

  console.log(`[Orders] Successfully deleted ${countResult.count} orders for ${date}.`);

  return {
    success: true,
    count: countResult.count,
    message: `Successfully deleted ${countResult.count} orders.`,
  };
}

// ===================================================================
//                      EXPORTS
// ===================================================================
export { validateDeliveryOrder, createOrder, getArchivedOrders, deleteArchivedOrders };
