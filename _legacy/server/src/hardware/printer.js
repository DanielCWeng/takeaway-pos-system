/**
 * Printer Hardware Module
 *
 * Handles all ESC/POS thermal printer operations including:
 * - USB device communication
 * - Bitmap generation for Chinese text
 * - Receipt formatting and printing
 */

import usb from "usb";
import { createCanvas } from "canvas";

// ===================================================================
//                      PRINTER CONFIGURATION
// ===================================================================
const VENDOR_ID = 0x154f;
const PRODUCT_ID = 0x154f;

// ESC/POS command constants
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

// Receipt formatting
const LINE_WIDTH = 42;

// ===================================================================
//                      HELPER FUNCTIONS
// ===================================================================

/**
 * Right-align a value on a receipt line
 * @param {string} left - Left text
 * @param {string|number} right - Right text/number
 * @returns {string} Formatted line
 */
function rightAlign(left, right) {
  const r = typeof right === "number" ? right.toFixed(2) : right.toString();
  const spaces = Math.max(0, LINE_WIDTH - left.length - r.length);
  return left + " ".repeat(spaces) + r + "\n";
}

/**
 * Convert text to bitmap for printing (supports Chinese characters)
 * @param {string} text - Text to convert
 * @param {number} fontSize - Font size in pixels
 * @param {string} align - Alignment: 'left', 'center', 'right'
 * @param {boolean} bold - Whether to use bold font
 * @returns {Object} Bitmap data with width, height, data, bytesPerLine
 */
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

/**
 * Convert bitmap to ESC/POS command bytes
 * @param {Object} bitmap - Bitmap object from textToBitmap
 * @returns {Buffer} ESC/POS command buffer
 */
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

// ===================================================================
//                      MAIN PRINT FUNCTION
// ===================================================================

/**
 * Print a receipt for an order
 * @param {Object} orderData - Order data including items, totals, customer info
 * @returns {Promise<string>} Resolves with success message, rejects on error
 */
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
        Buffer.from([ESC, 0x61, 0x00]), // Left alignment
      );

      // ---- Items ----
      // Modifier translations
      const commandTranslations = {
        REMOVE: "走",
        LESS: "少",
        MORE: "加",
        WANT: "要",
        ONLY: "只要",
      };

      orderData.items.forEach((item) => {
        console.log(
          `Rendering: ${item.hideQuantity ? "" : item.quantity} ${
            item.menuItem.name.zh || item.menuItem.name.en
          }`,
        );

        // Print English name with price (bold)
        const itemRef = item.menuItem.id || "";
        let englishName = `(${itemRef}) ${item.menuItem.name.en}`;

        if (item.isSwapped) {
          englishName += " (SWAP)";
        }

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
                })`,
            )
            .join(" ");
        }

        if (englishModifierString) {
          englishName += ` ${englishModifierString}`;
        }

        const itemTotal = item.finalPrice * item.quantity;
        const priceDisplay = item.hidePrice ? "" : itemTotal;

        receiptParts.push(
          Buffer.from([ESC, 0x45, 0x01]), // Bold on
          Buffer.from(rightAlign(englishName, priceDisplay)),
          Buffer.from([ESC, 0x45, 0x00]), // Bold off
        );

        // Print Chinese name as bitmap (large, bold)
        if (item.menuItem.name.zh) {
          const quantityPrefix = item.hideQuantity ? "  " : `${item.quantity} `;
          let chineseText = `${quantityPrefix}${item.menuItem.name.zh}`;

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
        0,
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
        Buffer.from([ESC, 0x61, 0x00, GS, 0x21, 0x00, ESC, 0x45, 0x00]), // Reset
      );

      // ---- Totals (left aligned) ----
      receiptParts.push(
        Buffer.from(rightAlign("Sub-total", orderData.subtotal)),
      );

      if (orderData.orderType === "Delivery") {
        receiptParts.push(
          Buffer.from(rightAlign("+Delivery", orderData.deliveryCharge)),
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
        Buffer.from([ESC, 0x61, 0x00, GS, 0x21, 0x00, ESC, 0x45, 0x00]), // Reset
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
        ]),
      );

      // Map reference (if available)
      if (orderData.customerInfo.mapRef) {
        receiptParts.push(
          Buffer.from(`Map ref: ${orderData.customerInfo.mapRef}\n`),
        );
      }

      // Mileage as bitmap (if available and is delivery)
      if (
        orderData.orderType === "Delivery" &&
        orderData.customerInfo.distance
      ) {
        console.log(
          `Rendering: Mileage: ${orderData.customerInfo.distance} 公里`,
        );
        const mileageBitmap = textToBitmap(
          `Mileage: ${parseFloat(orderData.customerInfo.distance).toFixed(
            2,
          )} 公里`,
          28 * 2,
          "left",
        );
        receiptParts.push(bitmapToESCPOS(mileageBitmap));
      }

      // Address lines
      if (orderData.customerInfo.name) {
        receiptParts.push(Buffer.from(`${orderData.customerInfo.name}\n`));
      }

      if (orderData.customerInfo.houseNumber && orderData.customerInfo.street) {
        receiptParts.push(
          Buffer.from(
            `${orderData.customerInfo.houseNumber}, ${orderData.customerInfo.street}\n`,
          ),
        );
      } else if (orderData.customerInfo.address) {
        receiptParts.push(Buffer.from(`${orderData.customerInfo.address}\n`));
      }

      if (orderData.customerInfo.town) {
        receiptParts.push(Buffer.from(`${orderData.customerInfo.town}\n`));
      }

      if (orderData.customerInfo.postcode) {
        receiptParts.push(
          Buffer.from(`${orderData.customerInfo.postcode.toUpperCase()}\n`),
        );
      }

      if (orderData.customerInfo.phone) {
        receiptParts.push(Buffer.from(`${orderData.customerInfo.phone}\n`));
      }

      if (orderData.customerInfo.deliveryTime) {
        receiptParts.push(Buffer.from("\n"));
        receiptParts.push(
          Buffer.from([ESC, 0x61, 0x01, GS, 0x21, 0x11, ESC, 0x45, 0x01]),
        ); // Center, Double size, Bold
        receiptParts.push(
          Buffer.from(`Time: ${orderData.customerInfo.deliveryTime}\n`),
        );
        receiptParts.push(
          Buffer.from([ESC, 0x61, 0x00, GS, 0x21, 0x00, ESC, 0x45, 0x00]),
        ); // Reset
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
        Buffer.from([GS, 0x56, 0x00]), // Cut paper
      );

      const receipt = Buffer.concat(receiptParts);

      console.log(`\nReceipt built (${receipt.length} bytes)`);
      console.log("Sending to printer...\n");

      endpoint.transfer(receipt, { timeout: 5000 }, (error) => {
        iface.release(true, () => {
          device.close();
          if (error) {
            reject(
              new Error("Failed to send data to printer: " + error.message),
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

/**
 * Check if printer is connected
 */
function checkPrinterStatus() {
  if (usb.findByIds(VENDOR_ID, PRODUCT_ID)) {
    console.log(`✅ Printer found.`);
  } else {
    console.error(`🔴 Printer not found.`);
  }
}

// ===================================================================
//                      EXPORTS
// ===================================================================
export { printReceipt, checkPrinterStatus, LINE_WIDTH, rightAlign };
