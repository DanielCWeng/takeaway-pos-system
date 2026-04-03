/**
 * hardware/printer.js
 *
 * ESC/POS thermal printer transport adapter.
 * Receipt byte construction lives in ./printer/receiptBuilder.js
 */

import { config } from '../config/index.js';
import { logger } from '../infrastructure/logger.js';
import { HardwareError } from '../shared/errors.js';
import { buildReceiptBuffer } from './printer/receiptBuilder.js';

/**
 * Dynamic-load the `usb` package.
 *
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
 * If unavailable, we still print using plain text fallback.
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

function safeCloseDevice(device) {
  try {
    device.close();
  } catch {
    // ignore
  }
}

function claimInterface(device, vendorId, productId) {
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
    throw new HardwareError('Could not claim printer interface', {
      vendorId,
      productId,
      error: err?.message ?? String(err),
    });
  }

  return iface;
}

function getOutEndpointOrThrow(iface, vendorId, productId) {
  const endpoint = iface.endpoints.find((ep) => ep.direction === 'out');
  if (!endpoint) {
    throw new HardwareError('Printer OUT endpoint not found', { vendorId, productId });
  }
  return endpoint;
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
  const receipt = buildReceiptBuffer(order, { canvasApi });

  return new Promise((resolve, reject) => {
    try {
      device.open();
      const iface = claimInterface(device, vendorId, productId);
      const endpoint = getOutEndpointOrThrow(iface, vendorId, productId);

      let completed = false;
      const timeout = setTimeout(() => {
        if (completed) return;
        completed = true;
        iface.release(true, () => safeCloseDevice(device));
        reject(
          new HardwareError('Printer transfer timed out', {
            vendorId,
            productId,
            timeoutMs,
          }),
        );
      }, timeoutMs);

      endpoint.transfer(receipt, (error) => {
        if (completed) return;
        completed = true;
        clearTimeout(timeout);

        iface.release(true, (releaseErr) => {
          safeCloseDevice(device);

          if (error || releaseErr) {
            return reject(
              new HardwareError('Failed to send data to printer', {
                vendorId,
                productId,
                error: error?.message ?? releaseErr?.message ?? 'Unknown printer error',
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
