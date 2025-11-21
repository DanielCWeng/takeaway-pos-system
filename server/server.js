import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";
import usb from "usb";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { createCanvas } from "canvas";

import * as callerIdService from "./services/callerIdService.js";

// ESM setup for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to your customer data file
const CUSTOMERS_DB_PATH = path.join(__dirname, "data", "customers.json");
const ARCHIVED_ORDERS_PATH = path.join(
  __dirname,
  "data",
  "archived_orders.json"
);

// ===================================================================
//                        SERVER SETUP
// ===================================================================
const app = express();
app.use(cors());
app.use(express.json());
const PORT = 4000;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
let activeClients = [];

wss.on("connection", (ws) => {
  console.log("🔌 WebSocket client connected");
  activeClients.push(ws);
  ws.on("close", () => {
    console.log("🔌 WebSocket client disconnected");
    activeClients = activeClients.filter((client) => client !== ws);
  });
  ws.on("error", (err) => console.error("WebSocket Error:", err));
});

function broadcast(data) {
  if (activeClients.length === 0) return;
  const jsonData = JSON.stringify(data);
  activeClients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(jsonData);
    }
  });
}

// ===================================================================
//                      PRINTER LOGIC WITH CHINESE SUPPORT
// ===================================================================
const VENDOR_ID = 0x154f;
const PRODUCT_ID = 0x154f;

// ESC/POS command constants
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

// ---------- Helper: right-aligned line ----------
const LINE_WIDTH = 42;
const rightAlign = (left, right) => {
  const r = typeof right === "number" ? right.toFixed(2) : right.toString();
  const spaces = Math.max(0, LINE_WIDTH - left.length - r.length);
  return left + " ".repeat(spaces) + r + "\n";
};

// ---------- Helper: Convert text to bitmap ----------
function textToBitmap(text, fontSize, align, bold) {
  fontSize = fontSize || 24;
  align = align || "left";
  bold = bold || false;

  const canvas = createCanvas(384, fontSize * 2);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "black";
  const weight = bold ? "500 " : "";
  ctx.font =
    weight + fontSize + 'px "Noto Sans SC", "WenQuanYi Micro Hei", sans-serif';
  ctx.textBaseline = "top";

  let xPos = 0;
  if (align === "center") {
    const textWidth = ctx.measureText(text).width;
    xPos = (canvas.width - textWidth) / 2;
  } else if (align === "right") {
    const textWidth = ctx.measureText(text).width;
    xPos = canvas.width - textWidth;
  }

  ctx.fillText(text, xPos, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let maxY = 0;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const brightness =
        (imageData.data[idx] +
          imageData.data[idx + 1] +
          imageData.data[idx + 2]) /
        3;
      if (brightness < 128) {
        maxY = y;
      }
    }
  }

  const actualHeight = Math.max(maxY + 1, fontSize);
  const width = 384;
  const bytesPerLine = Math.ceil(width / 8);
  const bitmapData = [];

  for (let y = 0; y < actualHeight; y++) {
    for (let byteIndex = 0; byteIndex < bytesPerLine; byteIndex++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = byteIndex * 8 + bit;
        if (x < width) {
          const idx = (y * canvas.width + x) * 4;
          const brightness =
            (imageData.data[idx] +
              imageData.data[idx + 1] +
              imageData.data[idx + 2]) /
            3;
          if (brightness < 128) {
            byte |= 1 << (7 - bit);
          }
        }
      }
      bitmapData.push(byte);
    }
  }

  return {
    width: width,
    height: actualHeight,
    data: bitmapData,
    bytesPerLine: bytesPerLine,
  };
}

// ---------- Helper: Bitmap to ESC/POS ----------
function bitmapToESCPOS(bitmap) {
  const height = bitmap.height;
  const data = bitmap.data;
  const bytesPerLine = bitmap.bytesPerLine;
  const xL = bytesPerLine & 0xff;
  const xH = (bytesPerLine >> 8) & 0xff;
  const yL = height & 0xff;
  const yH = (height >> 8) & 0xff;

  return Buffer.from([GS, 0x76, 0x30, 0x00, xL, xH, yL, yH].concat(data));
}

function printReceipt(orderData) {
  const device = usb.findByIds(VENDOR_ID, PRODUCT_ID);
  if (!device) return Promise.reject(new Error("Printer not found"));

  return new Promise((resolve, reject) => {
    try {
      device.open();
      const iface = device.interface(0);

      try {
        if (iface.isKernelDriverActive()) {
          iface.detachKernelDriver();
        }
        iface.claim();
      } catch (e) {
        device.close();
        return reject(new Error("Could not claim printer interface."));
      }

      const endpoint = iface.endpoints.find((ep) => ep.direction === "out");
      if (!endpoint) {
        device.close();
        return reject(new Error("No OUT endpoint found"));
      }

      console.log("Building receipt...");

      const receiptParts = [];

      // ---- Header: Date/Time centered and bold ----
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      });
      const timeStr = now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      receiptParts.push(
        Buffer.from("\n\n\n"), // Gap at top

        Buffer.from([
          ESC,
          0x40, // Initialize
          ESC,
          0x61,
          0x01, // Center alignment
          ESC,
          0x45,
          0x01, // Bold on
        ]),
        Buffer.from(`${dateStr}  ${timeStr}\n`),
        Buffer.from([ESC, 0x45, 0x00]), // Bold off
        Buffer.from("-".repeat(42) + "\n"),
        Buffer.from([ESC, 0x61, 0x00]) // Left alignment
      );

      // ---- Items ----
      orderData.items.forEach((item) => {
        console.log(
          `Rendering: ${item.quantity} ${
            item.menuItem.name.zh || item.menuItem.name.en
          }`
        );

        // Print English name with price (bold)
        const itemRef = item.menuItem.id || "";
        let englishName = `(${itemRef}) ${item.menuItem.name.en}`;

        // --- MODIFIER LOGIC ---
        const commandTranslations = {
          REMOVE: "走",
          LESS: "少",
          MORE: "加",
          WANT: "要",
          ONLY: "只要",
        };

        let englishModifierString = "";
        let chineseModifierString = "";

        if (item.modifiers && item.modifiers.length > 0) {
          englishModifierString = item.modifiers
            .map((mod) => `(${mod.command} ${mod.ingredient.name})`)
            .join(" ");
          chineseModifierString = item.modifiers
            .map(
              (mod) =>
                `(${commandTranslations[mod.command] || mod.command} ${
                  mod.ingredient.zh
                })`
            )
            .join(" ");
        }

        if (englishModifierString) {
          englishName += ` ${englishModifierString}`;
        }
        // ---------------------

        const itemTotal = item.finalPrice * item.quantity;

        receiptParts.push(
          Buffer.from([ESC, 0x45, 0x01]), // Bold on
          Buffer.from(rightAlign(englishName, itemTotal)),
          Buffer.from([ESC, 0x45, 0x00]) // Bold off
        );

        // Print Chinese name as bitmap (large, bold)
        if (item.menuItem.name.zh) {
          let chineseText = `${item.quantity} ${item.menuItem.name.zh}`;
          if (chineseModifierString) {
            chineseText += ` ${chineseModifierString}`;
          }
          const bitmap = textToBitmap(chineseText, 48, "left", true);
          receiptParts.push(bitmapToESCPOS(bitmap));
          receiptParts.push(Buffer.from("\n"));
        }
      });

      // ---- Separator ----
      receiptParts.push(Buffer.from("-".repeat(42) + "\n"));

      // ---- "X Items" centered on its own line (2x width, 2x height + bold) ----
      const itemCount = orderData.items.reduce(
        (sum, item) => sum + item.quantity,
        0
      );
      receiptParts.push(
        Buffer.from([
          ESC,
          0x61,
          0x01, // Center alignment
          GS,
          0x21,
          0x11, // 2x width, 2x height
          ESC,
          0x45,
          0x01, // Bold
        ]),
        Buffer.from(`${itemCount} Items\n`),
        Buffer.from([ESC, 0x61, 0x00, GS, 0x21, 0x00, ESC, 0x45, 0x00]) // Reset
      );

      // ---- Totals (left aligned) ----
      receiptParts.push(
        Buffer.from(rightAlign("Sub-total", orderData.subtotal))
      );

      if (orderData.orderType === "Delivery") {
        receiptParts.push(
          Buffer.from(rightAlign("+Delivery", orderData.deliveryCharge))
        );
      }

      receiptParts.push(Buffer.from(rightAlign("", "--------------")));

      // ---- Grand Total (centered, 3x width, 3x height, bold) ----
      receiptParts.push(
        Buffer.from([
          ESC,
          0x61,
          0x01, // Center
          GS,
          0x21,
          0x22, // 3x width, 3x height
          ESC,
          0x45,
          0x01, // Bold
        ]),
        Buffer.from(`Total ${orderData.total.toFixed(2)}\n`),
        Buffer.from([ESC, 0x61, 0x00, GS, 0x21, 0x00, ESC, 0x45, 0x00]) // Reset
      );

      // ---- Separator ----
      receiptParts.push(Buffer.from("-".repeat(42) + "\n"));

      // ---- Extra info: scale up by 2 (2x width, 2x height) ----
      receiptParts.push(
        Buffer.from([
          ESC,
          0x61,
          0x00,
          GS,
          0x21,
          0x11, // 2x width, 2x height
        ])
      );

      // Map reference (if available)
      if (orderData.customerInfo.mapRef) {
        receiptParts.push(
          Buffer.from(`Map ref: ${orderData.customerInfo.mapRef}\n`)
        );
      }

      // Mileage as bitmap (if available and is delivery)
      if (
        orderData.orderType === "Delivery" &&
        orderData.customerInfo.distance
      ) {
        console.log(
          `Rendering: Mileage: ${orderData.customerInfo.distance} 公里`
        );
        const mileageBitmap = textToBitmap(
          `Mileage: ${parseFloat(orderData.customerInfo.distance).toFixed(
            2
          )} 公里`,
          28 * 2,
          "left"
        );
        receiptParts.push(bitmapToESCPOS(mileageBitmap));
      }

      // Address lines
      if (orderData.customerInfo.houseNumber && orderData.customerInfo.street) {
        receiptParts.push(
          Buffer.from(
            `${orderData.customerInfo.houseNumber}, ${orderData.customerInfo.street}\n`
          )
        );
      } else if (orderData.customerInfo.address) {
        receiptParts.push(Buffer.from(`${orderData.customerInfo.address}\n`));
      }

      if (orderData.customerInfo.town) {
        receiptParts.push(Buffer.from(`${orderData.customerInfo.town}\n`));
      }

      if (orderData.customerInfo.postcode) {
        receiptParts.push(
          Buffer.from(`${orderData.customerInfo.postcode.toUpperCase()}\n`)
        );
      }

      if (orderData.customerInfo.phone) {
        receiptParts.push(Buffer.from(`${orderData.customerInfo.phone}\n`));
      }

      receiptParts.push(Buffer.from("\n")); // Gap

      // ---- Payment status (centered) ----
      receiptParts.push(Buffer.from([ESC, 0x61, 0x01])); // Center

      if (orderData.paymentDetails) {
        receiptParts.push(Buffer.from("[X] Cash   [ ] Unpaid\n"));
      } else {
        receiptParts.push(Buffer.from("[ ] Cash   [X] Unpaid\n"));
      }

      receiptParts.push(Buffer.from([GS, 0x21, 0x00])); // Back to normal size

      // ---- Feed & Cut ----
      receiptParts.push(
        Buffer.from([ESC, 0x64, 3]), // Feed 3 lines
        Buffer.from([GS, 0x56, 0x00]) // Cut paper
      );

      const receipt = Buffer.concat(receiptParts);

      console.log(`\nReceipt built (${receipt.length} bytes)`);
      console.log("Sending to printer...\n");

      endpoint.transfer(receipt, { timeout: 5000 }, (error) => {
        iface.release(true, () => {
          device.close();
          if (error) {
            reject(
              new Error("Failed to send data to printer: " + error.message)
            );
          } else {
            console.log("Print successful!");
            resolve("Print successful");
          }
        });
      });
    } catch (e) {
      console.error("Fatal error:", e);
      reject(e);
    }
  });
}

function checkPrinterStatus() {
  if (usb.findByIds(VENDOR_ID, PRODUCT_ID)) {
    console.log(`✅ Printer found.`);
  } else {
    console.error(`🔴 Printer not found.`);
  }
}

// ===================================================================
//                     API ENDPOINTS
// ===================================================================
app.get("/api/test-call", (req, res) => {
  console.log("Received request on /api/test-call");

  const newCustomerPayload = {
    type: "incoming_call",
    payload: {
      phone: "07111222333",
      timestamp: new Date().toISOString(),
      postcode: null,
      address: null,
      houseNumber: null,
      street: null,
      town: null,
      distance: null,
      availableAddresses: null,
      callCount: 1,
      status: "NEEDS_ADDRESS",
    },
  };

  const existingCustomerPayload = {
    type: "incoming_call",
    payload: {
      phone: "07987654321",
      timestamp: new Date().toISOString(),
      postcode: "NG10 1AA",
      address: "123 High Street, Long Eaton",
      houseNumber: "123",
      street: "High Street",
      town: "Long Eaton",
      distance: 2.5,
      availableAddresses: [{ id: 0, full: "123 High Street, Long Eaton" }],
      callCount: 8,
      status: "COMPLETE",
    },
  };

  if (req.query.type === "existing") {
    broadcast(existingCustomerPayload);
    res.send("Sent test broadcast for an EXISTING customer.");
  } else {
    broadcast(newCustomerPayload);
    res.send("Sent test broadcast for a NEW customer.");
  }
});

app.post("/api/verify-address", async (req, res) => {
  const { phone, address, postcode, houseNumber, street, town } = req.body;

  if (!phone || !address || !postcode) {
    return res
      .status(400)
      .json({ error: "Phone, address, and postcode are required." });
  }

  try {
    const data = await fs.readFile(CUSTOMERS_DB_PATH, "utf8");
    const customers = JSON.parse(data);
    let customer = customers.find((c) => c.phone === phone);

    if (customer) {
      customer.address = address;
      customer.postcode = postcode;
      customer.houseNumber = houseNumber;
      customer.street = street;
      customer.town = town;
      console.log(`[CRM] Updated full address for ${phone}`);
    } else {
      const newCustomer = {
        phone,
        name: "",
        address,
        postcode,
        houseNumber,
        street,
        town,
      };
      customers.push(newCustomer);
      console.log(`[CRM] Created new customer profile for ${phone}`);
    }

    await fs.writeFile(CUSTOMERS_DB_PATH, JSON.stringify(customers, null, 2));
    res.status(200).json({ success: true, message: "Customer data saved." });
  } catch (error) {
    if (error.code === "ENOENT") {
      const newCustomer = {
        phone,
        name: "",
        address,
        postcode,
        houseNumber,
        street,
        town,
      };
      await fs.writeFile(
        CUSTOMERS_DB_PATH,
        JSON.stringify([newCustomer], null, 2)
      );
      return res
        .status(200)
        .json({ success: true, message: "Customer data saved." });
    }
    console.error("[CRM] Error saving customer data:", error);
    res.status(500).json({ error: "Failed to save customer data." });
  }
});

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

app.post("/api/print", async (req, res) => {
  const orderDataFromFrontend = req.body;
  let newOrderId;

  try {
    // --- Part 1: CRITICAL - SAVE THE ORDER ---
    let archivedOrders = [];
    try {
      const data = await fs.readFile(ARCHIVED_ORDERS_PATH, "utf8");
      archivedOrders = JSON.parse(data);
    } catch (readError) {
      if (readError.code !== "ENOENT") throw readError;
    }

    const maxId = Math.max(0, ...archivedOrders.map((o) => o.id));
    newOrderId = maxId + 1;

    const orderToArchive = {
      ...orderDataFromFrontend,
      id: newOrderId,
      archivedAt: new Date().toISOString(),
    };

    archivedOrders.push(orderToArchive);
    await fs.writeFile(
      ARCHIVED_ORDERS_PATH,
      JSON.stringify(archivedOrders, null, 2)
    );
    console.log(`[Archive] Order #${newOrderId} saved successfully.`);

    // --- Part 2: NON-CRITICAL - TRY TO PRINT ---
    try {
      await printReceipt(orderToArchive);
      console.log(
        `[Print] Receipt for Order #${newOrderId} printed successfully.`
      );

      res.status(200).json({
        success: true,
        printed: true,
        message: `Order #${newOrderId} saved and printed.`,
      });
    } catch (printError) {
      console.error(
        `[Print ERROR] Order #${newOrderId} was SAVED, but printing failed:`,
        printError
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

app.get("/api/customer/:phone", async (req, res) => {
  const { phone } = req.params;
  console.log(`[API] Received request for customer with phone: ${phone}`);

  try {
    const data = await fs.readFile(CUSTOMERS_DB_PATH, "utf8");
    const customers = JSON.parse(data);
    const customer = customers.find((c) => c.phone === phone);

    if (customer) {
      console.log(`[API] Found customer:`, customer.name || customer.phone);
      res.json(customer);
    } else {
      console.log(`[API] Customer with phone ${phone} not found.`);
      res.status(404).json({ message: "Customer not found" });
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log(`[API] customers.json not found. Cannot look up customer.`);
      return res.status(404).json({ message: "Customer file not found" });
    }
    console.error("[API] Server error looking up customer:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/archived-orders", async (req, res) => {
  const { date } = req.query;

  try {
    const data = await fs.readFile(ARCHIVED_ORDERS_PATH, "utf8");
    let orders = JSON.parse(data);

    if (date) {
      orders = orders.filter((order) => order.archivedAt.startsWith(date));
    }

    res.json(orders);
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.json([]);
    }
    console.error("[API] Error fetching archived orders:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/api/archived-orders", async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res
      .status(400)
      .json({ message: "A date query parameter is required." });
  }
  console.log(
    `[Archive] Received request to DELETE all orders for date: ${date}`
  );

  try {
    let allOrders = [];
    try {
      const data = await fs.readFile(ARCHIVED_ORDERS_PATH, "utf8");
      allOrders = JSON.parse(data);
    } catch (readError) {
      if (readError.code === "ENOENT") {
        console.log("[Archive] No orders file found. Nothing to delete.");
        return res
          .status(200)
          .json({ success: true, message: "No orders to delete." });
      }
      throw readError;
    }

    const initialCount = allOrders.length;
    const ordersToKeep = allOrders.filter(
      (order) => !order.archivedAt.startsWith(date)
    );

    if (ordersToKeep.length === initialCount) {
      console.log(`[Archive] No orders found for ${date}. No changes made.`);
      return res.status(200).json({
        success: true,
        message: `No orders found for ${date} to delete.`,
      });
    }

    await fs.writeFile(
      ARCHIVED_ORDERS_PATH,
      JSON.stringify(ordersToKeep, null, 2)
    );

    const deletedCount = initialCount - ordersToKeep.length;
    console.log(
      `[Archive] Successfully deleted ${deletedCount} orders for ${date}.`
    );
    res.status(200).json({
      success: true,
      message: `Successfully deleted ${deletedCount} orders.`,
    });
  } catch (error) {
    console.error("[API] CRITICAL Error deleting archived orders:", error);
    res.status(500).json({ message: "Server error during deletion." });
  }
});

// ===================================================================
//                          STARTUP
// ===================================================================
server.listen(PORT, () => {
  console.log(
    `🚀 API & WebSocket Server listening on http://localhost:${PORT}`
  );
  checkPrinterStatus();
  console.log("⚡ Initializing Caller ID Service...");

  const onCallDetected = async (cust, addrData, dist) => {
    console.log(
      "[onCallDetected] Received customer profile from callerIdService:",
      cust
    );

    const data = {
      type: "incoming_call",
      payload: {
        phone: cust.phone,
        timestamp: new Date().toISOString(),
        postcode: cust.postcode,
        address: cust.address,
        houseNumber: cust.houseNumber,
        street: cust.street,
        distance: dist,
        town: cust.town,
        availableAddresses: addrData?.addresses || null,
        callCount: cust.callCount,
        status: cust.address ? "COMPLETE" : "NEEDS_ADDRESS",
      },
    };

    console.log(
      "[onCallDetected] Broadcasting payload to frontend:",
      data.payload
    );

    broadcast(data);
  };

  callerIdService.startCallerIdService(onCallDetected).catch((error) => {
    console.error("🔴 FATAL: Caller ID Service failed to start.", error);
  });
});
