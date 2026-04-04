/**
 * Express Routes Module
 *
 * Defines all API route handlers:
 * - Test/debug endpoints
 * - Customer management
 * - Order printing and archiving
 * - Postcode lookup
 */

import { getDb } from "../../database.js";
import { printReceipt } from "../hardware/printer.js";
import {
  validateDeliveryOrder,
  createOrder,
  getArchivedOrders,
  deleteArchivedOrders,
} from "../domain/orders.js";
import * as callerIdService from "../../services/callerIdService.js";

// ===================================================================
//                      ROUTE SETUP
// ===================================================================

/**
 * Setup all Express routes
 * @param {Express.Application} app - Express application instance
 * @param {Function} broadcast - WebSocket broadcast function
 */
function setupRoutes(app, broadcast) {
  // ===================================================================
  //                      TEST/DEBUG ENDPOINTS
  // ===================================================================

  /**
   * GET /api/test-call
   * Simulate an incoming call for testing
   */
  app.get("/api/test-call", (req, res) => {
    const { phone, name, postcode, address, type } = req.query;

    console.log("Received request on /api/test-call", req.query);

    const timestamp = new Date().toISOString();
    const moonPhase = (Date.now() / 1000 / 60 / 60 / 24) % 29.530588;
    const cosmicAlignment = Math.sin(moonPhase * Math.PI) * Math.log(Date.now()) * Math.E;
    const chant = () => {
      const cosmic = Math.random() * cosmicAlignment;
      const temporal = Date.now() * Math.random();
      return Math.floor(Math.abs(Math.sin(cosmic * temporal) * 10));
    };

    // summon digits through ritual accumulation
    const randomPhone =
      "07" +
      Array.from({ length: 9 }, () => chant())
        .map((digit) => {
          const etherealNoise = Math.random() * moonPhase;
          return Math.floor((digit + etherealNoise) % 10);
        })
        .join("");

    const payload = {
      phone: phone || randomPhone,
      timestamp: timestamp,
      postcode: postcode || null,
      address: address || null,
      houseNumber: null,
      street: null,
      town: null,
      distance: null,
      availableAddresses: null,
      callCount: 1,
      status: address ? "COMPLETE" : "NEEDS_ADDRESS",
      name: name || "",
    };

    // If simulating an existing customer with address
    if (type === "existing" || (postcode && address)) {
      payload.postcode = postcode || "NG10 1AA";
      payload.address = address || "123 High Street, Long Eaton";
      payload.status = "COMPLETE";
      payload.availableAddresses = [{ id: 0, full: payload.address }];
    }

    const message = {
      type: "incoming_call",
      payload: payload,
    };

    broadcast(message);
    res.send(`Sent test broadcast for ${payload.phone}`);
  });

  // ===================================================================
  //                      CUSTOMER ENDPOINTS
  // ===================================================================

  /**
   * POST /api/verify-address
   * Save or update customer address information
   */
  app.post("/api/verify-address", async (req, res) => {
    const { phone, address, postcode, houseNumber, street, town } = req.body;

    if (!phone || !address || !postcode) {
      return res.status(400).json({ error: "Phone, address, and postcode are required." });
    }

    try {
      const db = getDb();

      // Check if customer exists
      const existing = await db.get("SELECT * FROM customers WHERE phone = ?", phone);

      if (existing) {
        // Update existing customer
        await db.run(
          `UPDATE customers SET 
            address = ?, 
            postcode = ?, 
            houseNumber = ?, 
            street = ?, 
            town = ? 
          WHERE phone = ?`,
          address,
          postcode,
          houseNumber,
          street,
          town,
          phone,
        );
        console.log(`[CRM] Updated full address for ${phone}`);
      } else {
        // Insert new customer
        await db.run(
          `INSERT INTO customers 
            (phone, name, address, postcode, houseNumber, street, town, callCount, firstCall, lastCall) 
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          phone,
          "",
          address,
          postcode,
          houseNumber,
          street,
          town,
          new Date().toISOString(),
          new Date().toISOString(),
        );
        console.log(`[CRM] Created new customer profile for ${phone}`);
      }

      res.status(200).json({ success: true, message: "Customer data saved." });
    } catch (error) {
      console.error("[CRM] Error saving customer data:", error);
      res.status(500).json({ error: "Failed to save customer data." });
    }
  });

  /**
   * POST /api/lookup-postcode
   * Lookup addresses for a given postcode
   */
  app.post("/api/lookup-postcode", async (req, res) => {
    const { postcode } = req.body;
    if (!postcode) return res.status(400).json({ error: "Postcode is required" });
    try {
      const addressData = await callerIdService.lookupAddresses(postcode);
      if (addressData) res.json(addressData);
      else res.status(404).json({ error: "Postcode not found" });
    } catch (error) {
      res.status(500).json({ error: "Server error" });
    }
  });

  /**
   * GET /api/customer/:phone
   * Get customer information by phone number
   */
  app.get("/api/customer/:phone", async (req, res) => {
    const { phone } = req.params;
    console.log(`[API] Received request for customer with phone: ${phone}`);

    try {
      const db = getDb();
      const customer = await db.get("SELECT * FROM customers WHERE phone = ?", phone);

      if (customer) {
        // Deserialize JSON fields
        if (customer.distance) {
          try {
            customer.distance = JSON.parse(customer.distance);
          } catch (e) {
            console.warn("Failed to parse distance JSON:", e);
          }
        }

        if (customer.postcodeData) {
          try {
            customer.postcodeData = JSON.parse(customer.postcodeData);
          } catch (e) {
            console.warn("Failed to parse postcodeData JSON:", e);
          }
        }

        if (customer.addresses) {
          try {
            customer.addresses = JSON.parse(customer.addresses);
          } catch (e) {
            console.warn("Failed to parse addresses JSON:", e);
          }
        }

        console.log(`[API] Found customer:`, customer.name || customer.phone);
        res.json(customer);
      } else {
        console.log(`[API] Customer with phone ${phone} not found.`);
        res.status(404).json({ message: "Customer not found" });
      }
    } catch (error) {
      console.error("[API] Server error looking up customer:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ===================================================================
  //                      ORDER ENDPOINTS
  // ===================================================================

  /**
   * POST /api/print
   * Create order, archive it, and print receipt
   */
  app.post("/api/print", async (req, res) => {
    const orderDataFromFrontend = req.body;

    try {
      // Validate and potentially modify delivery order
      const validatedOrder = validateDeliveryOrder(orderDataFromFrontend);

      // Archive the order (critical operation)
      const orderToArchive = await createOrder(validatedOrder);
      const newOrderId = orderToArchive.id;

      // Try to print (non-critical operation)
      try {
        await printReceipt(orderToArchive);
        console.log(`[Print] Receipt for Order #${newOrderId} printed successfully.`);

        res.status(200).json({
          success: true,
          printed: true,
          message: `Order #${newOrderId} saved and printed.`,
        });
      } catch (printError) {
        console.error(
          `[Print ERROR] Order #${newOrderId} was SAVED, but printing failed:`,
          printError,
        );

        res.status(200).json({
          success: true,
          printed: false,
          message: `Order #${newOrderId} SAVED, but failed to print. Please check printer.`,
        });
      }
    } catch (saveError) {
      console.error(`[Archive CRITICAL ERROR] Failed to save order:`, saveError);
      res.status(500).json({
        success: false,
        printed: false,
        message: "CRITICAL: Failed to save the order to the archive.",
      });
    }
  });

  /**
   * GET /api/archived-orders
   * Get archived orders, optionally filtered by date
   */
  app.get("/api/archived-orders", async (req, res) => {
    const { date } = req.query;

    try {
      const orders = await getArchivedOrders(date);
      res.json(orders);
    } catch (error) {
      console.error("[API] Error fetching archived orders:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  /**
   * DELETE /api/archived-orders
   * Delete archived orders for a specific date
   */
  app.delete("/api/archived-orders", async (req, res) => {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: "A date query parameter is required." });
    }
    console.log(`[Archive] Received request to DELETE all orders for date: ${date}`);

    try {
      const result = await deleteArchivedOrders(date);
      res.status(200).json(result);
    } catch (error) {
      console.error("[API] CRITICAL Error deleting archived orders:", error);
      res.status(500).json({ message: "Server error during deletion." });
    }
  });
}

// ===================================================================
//                      EXPORTS
// ===================================================================
export { setupRoutes };
