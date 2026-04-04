/**
 * hardware/printer.js
 *
 * ESC/POS thermal printer transport adapter.
 * Receipt byte construction lives in ./printer/receiptBuilder.js
 */

import { config } from "../config/index.js";
import { logger } from "../infrastructure/logger.js";
import { HardwareError } from "../shared/errors.js";
import { buildReceiptBuffer } from "./printer/receiptBuilder.js";

/**
 * Dynamic-load the `usb` package.
 *
 * @returns {Promise<any>}
 */
async function loadUsb() {
  logger.info("[PRINTER] Loading usb package...", { hardware: true });
  try {
    const mod = await import("usb");
    const usb = mod.default ?? mod;
    logger.info("[PRINTER] usb package loaded OK", { hardware: true });
    return usb;
  } catch (err) {
    logger.error("[PRINTER] FAILED to load usb package", {
      hardware: true,
      error: err?.message ?? String(err),
    });
    throw new HardwareError("Printer dependency missing: install the `usb` package", {
      dependency: "usb",
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
    const mod = await import("canvas");
    const createCanvas = mod.createCanvas ?? mod.default?.createCanvas;
    if (typeof createCanvas !== "function") {
      logger.warn("Printer: canvas loaded but createCanvas is not a function — bitmap disabled", {
        hardware: true,
        dependency: "canvas",
      });
      return null;
    }
    logger.info("Printer: canvas loaded OK — Chinese bitmap rendering enabled", {
      hardware: true,
      dependency: "canvas",
    });
    return { createCanvas };
  } catch (err) {
    logger.warn("Printer: canvas FAILED to load — Chinese text will be skipped", {
      hardware: true,
      dependency: "canvas",
      error: err?.message ?? String(err),
    });
    return null;
  }
}

function safeCloseDevice(device) {
  try {
    device.close();
    logger.info("[PRINTER] Device closed", { hardware: true });
  } catch (err) {
    logger.warn("[PRINTER] device.close() threw (non-fatal)", {
      hardware: true,
      error: err?.message ?? String(err),
    });
  }
}

function claimInterface(device, vendorId, productId) {
  logger.info("[PRINTER] Claiming USB interface 0...", { hardware: true });
  const iface = device.interface(0);

  try {
    const kernelActive =
      typeof iface.isKernelDriverActive === "function" && iface.isKernelDriverActive();
    logger.info(`[PRINTER] Kernel driver active: ${kernelActive}`, { hardware: true });
    if (kernelActive) {
      iface.detachKernelDriver();
      logger.info("[PRINTER] Kernel driver detached", { hardware: true });
    }
  } catch (err) {
    logger.warn("[PRINTER] isKernelDriverActive/detach threw (non-fatal, platform-specific)", {
      hardware: true,
      error: err?.message ?? String(err),
    });
  }

  try {
    iface.claim();
    logger.info("[PRINTER] Interface claimed OK", { hardware: true });
  } catch (err) {
    logger.error("[PRINTER] FAILED to claim interface", {
      hardware: true,
      vendorId,
      productId,
      error: err?.message ?? String(err),
    });
    safeCloseDevice(device);
    throw new HardwareError("Could not claim printer interface", {
      vendorId,
      productId,
      error: err?.message ?? String(err),
    });
  }

  return iface;
}

function getOutEndpointOrThrow(iface, vendorId, productId) {
  logger.info(`[PRINTER] Scanning endpoints (count: ${iface.endpoints.length})...`, {
    hardware: true,
  });
  iface.endpoints.forEach((ep, i) => {
    logger.info(
      `[PRINTER]   endpoint[${i}]: direction=${ep.direction} type=${ep.transferType} address=0x${ep.address?.toString(16)}`,
      {
        hardware: true,
      },
    );
  });

  const endpoint = iface.endpoints.find((ep) => ep.direction === "out");
  if (!endpoint) {
    logger.error("[PRINTER] No OUT endpoint found — cannot print", {
      hardware: true,
      vendorId,
      productId,
    });
    throw new HardwareError("Printer OUT endpoint not found", { vendorId, productId });
  }
  logger.info(`[PRINTER] OUT endpoint selected: address=0x${endpoint.address?.toString(16)}`, {
    hardware: true,
  });
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

  logger.info("[PRINTER] ========== PRINT JOB START ==========", { hardware: true });
  logger.info(
    `[PRINTER] Order id=${order?.id ?? "(none)"} orderId=${order?.data?.orderType ?? "?"}`,
    { hardware: true },
  );
  logger.info(
    `[PRINTER] Config vendorId=0x${vendorId?.toString(16)} productId=0x${productId?.toString(16)} timeoutMs=${timeoutMs}`,
    { hardware: true },
  );

  const usb = await loadUsb();

  logger.info("[PRINTER] Scanning for USB device...", { hardware: true });
  const device = usb.findByIds(vendorId, productId);
  if (!device) {
    logger.warn("[PRINTER] Printer NOT found on USB bus — receipt not printed", {
      hardware: true,
      vendorId: `0x${vendorId?.toString(16)}`,
      productId: `0x${productId?.toString(16)}`,
    });
    return { printed: false };
  }
  logger.info("[PRINTER] Printer found on USB bus", { hardware: true });

  const canvasApi = await tryLoadCanvas();
  logger.info(`[PRINTER] Building receipt buffer (canvasApi available: ${!!canvasApi})...`, {
    hardware: true,
  });
  const receiptParts = buildReceiptBuffer(order, { canvasApi });
  const totalBytes = receiptParts.reduce((sum, p) => sum + p.length, 0);
  logger.info(`[PRINTER] Receipt built: ${receiptParts.length} parts, ${totalBytes} bytes total`, {
    hardware: true,
  });
  receiptParts.forEach((p, i) => {
    // Only log non-trivial parts to avoid spam
    if (p.length > 4) {
      logger.info(
        `[PRINTER]   part[${i}]: ${p.length} bytes, firstBytes=[${[...p.slice(0, 4)].map((b) => "0x" + b.toString(16)).join(",")}]`,
        { hardware: true },
      );
    }
  });

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
          new HardwareError("Printer transfer timed out", {
            vendorId,
            productId,
            timeoutMs,
          }),
        );
      }, timeoutMs);

      let partIndex = 0;
      const printStartMs = Date.now();

      const sendNextPart = () => {
        if (completed) return;

        if (partIndex >= receiptParts.length) {
          completed = true;
          clearTimeout(timeout);
          const elapsed = Date.now() - printStartMs;
          logger.info(
            `[PRINTER] All ${receiptParts.length} parts transferred in ${elapsed}ms. Releasing interface...`,
            { hardware: true },
          );
          iface.release(true, (releaseErr) => {
            safeCloseDevice(device);
            if (releaseErr) {
              logger.error("[PRINTER] Interface release failed", {
                hardware: true,
                error: releaseErr.message,
              });
              return reject(
                new HardwareError("Failed to release printer interface", {
                  vendorId,
                  productId,
                  error: releaseErr.message,
                }),
              );
            }
            logger.info("[PRINTER] ========== PRINT JOB COMPLETE ==========", {
              hardware: true,
              orderId: order?.id ?? null,
              bytes: totalBytes,
              elapsedMs: elapsed,
            });
            return resolve({ printed: true });
          });
          return;
        }

        const part = receiptParts[partIndex];
        const isRaster = part.length > 200;
        logger.info(
          `[PRINTER] Transferring part[${partIndex}/${receiptParts.length - 1}]: ${part.length} bytes${isRaster ? " [RASTER IMAGE]" : ""}`,
          { hardware: true },
        );

        endpoint.transfer(part, (error) => {
          if (completed) return;

          if (error) {
            completed = true;
            clearTimeout(timeout);
            logger.error(`[PRINTER] Transfer FAILED on part[${partIndex}]`, {
              hardware: true,
              partIndex,
              partBytes: part.length,
              error: error.message,
              errorCode: error.errno,
            });
            iface.release(true, () => {
              safeCloseDevice(device);
              reject(
                new HardwareError("Failed to send data to printer", {
                  vendorId,
                  productId,
                  error: error.message,
                }),
              );
            });
            return;
          }

          logger.info(`[PRINTER] part[${partIndex}] OK`, { hardware: true });
          partIndex++;

          // Large parts are ESC/POS raster images. Give the thermal head time
          // to burn the image before the next command arrives.
          if (isRaster) {
            logger.info("[PRINTER] Raster image sent — pausing 60ms for printhead burn", {
              hardware: true,
            });
            setTimeout(sendNextPart, 60);
          } else {
            sendNextPart();
          }
        });
      };

      logger.info("[PRINTER] Opening USB device...", { hardware: true });
      sendNextPart();
    } catch (err) {
      safeCloseDevice(device);
      return reject(
        err instanceof HardwareError
          ? err
          : new HardwareError("Printer error", { error: err?.message ?? String(err) }),
      );
    }
  });
}
