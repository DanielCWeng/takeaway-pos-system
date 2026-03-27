/**
 * hardware/printer.js
 *
 * ESC/POS thermal printer adapter.
 *
 * Responsibilities:
 *  - Build an ESC/POS byte buffer from an archived order.
 *  - Transfer the buffer to a USB printer.
 *
 * Notes:
 *  - This module intentionally performs I/O (USB) and may throw HardwareError.
 *  - It uses dynamic imports for native deps (`usb`, `canvas`) so the rest of the
 *    codebase (tests/CI) can run without hardware libraries installed.
 */

import { config } from '../config/index.js';
import { logger } from '../infrastructure/logger.js';
import { HardwareError } from '../shared/errors.js';

// ESC/POS command constants
const ESC = 0x1b;
const GS = 0x1d;

// Receipt formatting
const LINE_WIDTH = 42;

/**
 * Right-align a value on a receipt line.
 *
 * @param {string} left
 * @param {string | number} right
 * @returns {string}
 */
function rightAlign(left, right) {
  const r = typeof right === 'number' ? right.toFixed(2) : String(right);
  const spaces = Math.max(0, LINE_WIDTH - left.length - r.length);
  return left + ' '.repeat(spaces) + r + '\n';
}

function formatOrderType(raw) {
  if (!raw) return 'ORDER';
  const v = String(raw).toLowerCase();
  if (v === 'delivery') return 'DELIVERY';
  if (v === 'collection') return 'COLLECTION';
  return raw;
}

function containsNonAscii(text) {
  if (!text) return false;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 127) return true;
  }
  return false;
}

/**
 * Dynamic-load the `usb` package.
 * @returns {Promise<any>}
 */
async function loadUsb() {
  try {
    const mod = await import('usb');
    return mod.default ?? mod;
  } catch (err) {
    throw new HardwareError('Printer dependency missing: install the `usb` package', {
      dependency: 'usb',
      error: err?.message ?? String(err),
    });
  }
}

/**
 * Best-effort dynamic-load of `canvas` for bitmap rendering.
 * If unavailable, we still print using plain text (may not render Chinese).
 *
 * @returns {Promise<null | { createCanvas: Function }>}
 */
async function tryLoadCanvas() {
  try {
    const mod = await import('canvas');
    const createCanvas = mod.createCanvas ?? mod.default?.createCanvas;
    if (typeof createCanvas !== 'function') return null;
    return { createCanvas };
  } catch {
    logger.warn('Printer bitmap rendering disabled (canvas not installed)', {
      hardware: true,
      dependency: 'canvas',
    });
    return null;
  }
}

/**
 * Convert text to a monochrome bitmap for printing (supports non-ASCII when a font is available).
 *
 * @param {{ createCanvas: Function }} canvasApi
 * @param {string} text
 * @param {{ fontSize?: number, align?: 'left'|'center'|'right', bold?: boolean }} opts
 * @returns {{ width: number, height: number, data: number[], bytesPerLine: number }}
 */
function textToBitmap(canvasApi, text, opts = {}) {
  const fontSize = opts.fontSize ?? 24;
  const align = opts.align ?? 'left';
  const bold = opts.bold ?? false;

  const width = 384; // common 58mm printer width in dots
  const canvas = canvasApi.createCanvas(width, fontSize * 2);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'black';
  const weight = bold ? '500 ' : '';
  ctx.font = `${weight}${fontSize}px "Noto Sans SC", "WenQuanYi Micro Hei", sans-serif`;
  ctx.textBaseline = 'top';

  let xPos = 0;
  const textWidth = ctx.measureText(text).width;
  if (align === 'center') xPos = (canvas.width - textWidth) / 2;
  if (align === 'right') xPos = canvas.width - textWidth;

  ctx.fillText(text, Math.max(0, xPos), 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let maxY = 0;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const brightness =
        (imageData.data[idx] + imageData.data[idx + 1] + imageData.data[idx + 2]) / 3;
      if (brightness < 128) maxY = y;
    }
  }

  const actualHeight = Math.max(maxY + 1, fontSize);
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
            (imageData.data[idx] + imageData.data[idx + 1] + imageData.data[idx + 2]) / 3;
          if (brightness < 128) byte |= 1 << (7 - bit);
        }
      }
      bitmapData.push(byte);
    }
  }

  return { width, height: actualHeight, data: bitmapData, bytesPerLine };
}

/**
 * Convert a bitmap to ESC/POS raster image command bytes.
 *
 * @param {{ height: number, data: number[], bytesPerLine: number }} bitmap
 * @returns {Buffer}
 */
function bitmapToESCPOS(bitmap) {
  const height = bitmap.height;
  const bytesPerLine = bitmap.bytesPerLine;
  const xL = bytesPerLine & 0xff;
  const xH = (bytesPerLine >> 8) & 0xff;
  const yL = height & 0xff;
  const yH = (height >> 8) & 0xff;
  return Buffer.from([GS, 0x76, 0x30, 0x00, xL, xH, yL, yH, ...bitmap.data]);
}

/**
 * Build a receipt buffer for an archived order.
 *
 * @param {{ id?: number, data?: any, archivedAt?: string } | any} archivedOrder
 * @param {{ canvasApi: null | { createCanvas: Function } }} deps
 * @returns {Buffer}
 */
function buildReceiptBuffer(archivedOrder, deps) {
  const order = archivedOrder?.data ?? archivedOrder;
  const items = Array.isArray(order?.items) ? order.items : [];

  // Use archivedAt so reprints show the original order time, not the reprint time.
  const now = archivedOrder?.archivedAt ? new Date(archivedOrder.archivedAt) : new Date();
  const dateStr = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
  const timeStr = now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const receiptParts = [];

  receiptParts.push(
    Buffer.from('\n\n'),
    Buffer.from([ESC, 0x40, ESC, 0x61, 0x01, ESC, 0x45, 0x01]), // init, center, bold
    Buffer.from(`${dateStr}  ${timeStr}\n`),
    Buffer.from([ESC, 0x45, 0x00]), // bold off
    Buffer.from('-'.repeat(LINE_WIDTH) + '\n'),
  );

  // Order type + optional order id
  const orderTypeLabel = formatOrderType(order?.orderType);
  const orderId = archivedOrder?.id;
  receiptParts.push(
    Buffer.from([ESC, 0x61, 0x01, ESC, 0x45, 0x01]),
    Buffer.from(orderId ? `${orderTypeLabel}  #${orderId}\n` : `${orderTypeLabel}\n`),
    Buffer.from([ESC, 0x45, 0x00, ESC, 0x61, 0x00]),
  );

  receiptParts.push(Buffer.from('-'.repeat(LINE_WIDTH) + '\n'));

  // Items
  for (const item of items) {
    const name = String(item?.name ?? '').trim() || 'Item';
    const qty = Number.isFinite(item?.quantity) ? item.quantity : 1;
    const price = Number.isFinite(item?.price) ? item.price : 0;
    const lineTotal = qty * price;

    const lineLeft = `${qty} x ${name}`;

    // If the line includes non-ASCII and canvas is available, render it as a bitmap.
    const needsBitmap = containsNonAscii(lineLeft);
    if (needsBitmap && deps.canvasApi) {
      receiptParts.push(Buffer.from([ESC, 0x45, 0x01])); // bold on
      const bmp = textToBitmap(deps.canvasApi, lineLeft, {
        fontSize: 32,
        align: 'left',
        bold: true,
      });
      receiptParts.push(bitmapToESCPOS(bmp), Buffer.from('\n'));
      receiptParts.push(Buffer.from([ESC, 0x45, 0x00])); // bold off
      receiptParts.push(Buffer.from(rightAlign(' ', lineTotal)));
      continue;
    }

    receiptParts.push(
      Buffer.from([ESC, 0x45, 0x01]), // bold on
      Buffer.from(rightAlign(lineLeft, lineTotal)),
      Buffer.from([ESC, 0x45, 0x00]), // bold off
    );
  }

  receiptParts.push(Buffer.from('-'.repeat(LINE_WIDTH) + '\n'));

  const subtotal = items.reduce((sum, i) => {
    const qty = Number.isFinite(i?.quantity) ? i.quantity : 1;
    const price = Number.isFinite(i?.price) ? i.price : 0;
    return sum + qty * price;
  }, 0);

  const total = Number.isFinite(order?.total) ? order.total : subtotal;

  receiptParts.push(Buffer.from(rightAlign('Sub-total', subtotal)));
  receiptParts.push(Buffer.from(rightAlign('Total', total)));

  if (order?.notes) {
    receiptParts.push(Buffer.from('\n'));
    receiptParts.push(Buffer.from([ESC, 0x45, 0x01])); // bold on
    receiptParts.push(Buffer.from('Notes:\n'));
    receiptParts.push(Buffer.from([ESC, 0x45, 0x00])); // bold off
    receiptParts.push(Buffer.from(String(order.notes).trim() + '\n'));
  }

  // Customer details (mainly for delivery)
  const info = order?.customerInfo ?? {};
  if (info?.name || info?.address || info?.postcode || info?.phone) {
    receiptParts.push(Buffer.from('\n'));
    receiptParts.push(Buffer.from([ESC, 0x45, 0x01]));
    receiptParts.push(Buffer.from('Customer:\n'));
    receiptParts.push(Buffer.from([ESC, 0x45, 0x00]));

    if (info.name) receiptParts.push(Buffer.from(String(info.name).trim() + '\n'));
    if (info.address) receiptParts.push(Buffer.from(String(info.address).trim() + '\n'));
    if (info.postcode)
      receiptParts.push(Buffer.from(String(info.postcode).trim().toUpperCase() + '\n'));
    if (info.phone) receiptParts.push(Buffer.from(String(info.phone).trim() + '\n'));

    if (Number.isFinite(info.distance)) {
      receiptParts.push(Buffer.from(`Distance: ${Number(info.distance).toFixed(2)} miles\n`));
    }
  }

  // Payment
  const payment = order?.payment;
  if (payment?.method) {
    receiptParts.push(Buffer.from('\n'));
    receiptParts.push(Buffer.from([ESC, 0x61, 0x01])); // center
    const isCash = payment.method === 'cash';
    receiptParts.push(
      Buffer.from(`${isCash ? '[X]' : '[ ]'} Cash   ${!isCash ? '[X]' : '[ ]'} Card\n`),
    );
    receiptParts.push(Buffer.from([ESC, 0x61, 0x00])); // left
  }

  // Feed & cut
  receiptParts.push(Buffer.from([ESC, 0x64, 3])); // feed 3 lines
  receiptParts.push(Buffer.from([GS, 0x56, 0x00])); // cut

  return Buffer.concat(receiptParts);
}

function safeCloseDevice(device) {
  try {
    device.close();
  } catch {
    // ignore
  }
}

/**
 * Print a receipt for an archived order.
 *
 * @param {{ id: number, data: any, archivedAt: string } | any} order
 * @param {{ timeoutMs?: number }} [opts] - Optional printer settings (e.g. timeout)
 * @returns {Promise<{ printed: boolean }>}
 */
export async function printReceipt(order, opts = {}) {
  const { timeoutMs = 10000 } = opts;
  const { vendorId, productId } = config.printer;

  const usb = await loadUsb();
  const device = usb.findByIds(vendorId, productId);
  if (!device) {
    logger.warn('Printer not found — receipt not printed', { hardware: true, vendorId, productId });
    return { printed: false };
  }

  const canvasApi = await tryLoadCanvas();

  return new Promise((resolve, reject) => {
    try {
      device.open();
      const iface = device.interface(0);

      try {
        if (typeof iface.isKernelDriverActive === 'function' && iface.isKernelDriverActive()) {
          iface.detachKernelDriver();
        }
      } catch {
        // Non-fatal: detachKernelDriver is platform-specific
      }

      try {
        iface.claim();
      } catch (err) {
        safeCloseDevice(device);
        return reject(
          new HardwareError('Could not claim printer interface', {
            vendorId,
            productId,
            error: err?.message ?? String(err),
          }),
        );
      }

      const endpoint = iface.endpoints.find((ep) => ep.direction === 'out');
      if (!endpoint) {
        iface.release(true, () => safeCloseDevice(device));
        return reject(new HardwareError('Printer OUT endpoint not found', { vendorId, productId }));
      }

      const receipt = buildReceiptBuffer(order, { canvasApi });

      const PRINTER_TIMEOUT_MS = timeoutMs;
      let completed = false;

      const timeout = setTimeout(() => {
        if (completed) return;
        completed = true;
        iface.release(true, () => safeCloseDevice(device));
        reject(
          new HardwareError('Printer transfer timed out', {
            vendorId,
            productId,
            timeoutMs: PRINTER_TIMEOUT_MS,
          }),
        );
      }, PRINTER_TIMEOUT_MS);

      endpoint.transfer(receipt, (error) => {
        if (completed) return;
        completed = true;
        clearTimeout(timeout);

        iface.release(true, (releaseErr) => {
          safeCloseDevice(device);

          if (error || releaseErr) {
            const errMsg = error?.message ?? releaseErr?.message ?? 'Unknown printer error';
            return reject(
              new HardwareError('Failed to send data to printer', {
                vendorId,
                productId,
                error: errMsg,
              }),
            );
          }

          logger.info('Receipt printed', {
            hardware: true,
            orderId: order?.id ?? null,
            bytes: receipt.length,
          });
          return resolve({ printed: true });
        });
      });
    } catch (err) {
      safeCloseDevice(device);
      return reject(
        err instanceof HardwareError
          ? err
          : new HardwareError('Printer error', { error: err?.message ?? String(err) }),
      );
    }
  });
}
