/**
 * hardware/callerIdDevice.js
 *
 * Owns the `node-hid` connection lifecycle for the JD-2000S caller ID device.
 * Parses raw HID bytes into phone number strings and invokes a callback when a
 * valid number is detected.
 *
 * Notes:
 * - Debounce lives in domains/callerIdService/callerIdService.service.js.
 * - This module must never import any domain modules.
 */

import { config } from '../config/index.js';
import { logger } from '../infrastructure/logger.js';

// Known VID/PID for JD-2000S (from legacy system)
const DEFAULT_VENDOR_ID = 0x0483;
const DEFAULT_PRODUCT_ID = 0x5750;

const RECONNECT_DELAY_MS = 3000;

/** @type {any | null} */
let hid = null;

/** @type {any | null} */
let device = null;

/** @type {ReturnType<typeof setTimeout> | null} */
let reconnectTimer = null;

/** @type {((phone: string) => void) | null} */
let onPhoneDetected = null;

let stopped = true;

/**
 * Extract a UK phone number from a raw HID data packet.
 * The legacy algorithm is intentionally simple and proven against the real device:
 *  - Collect all ASCII digit bytes
 *  - Find the first 11-digit UK-style number starting with 0
 *
 * @param {Uint8Array} data
 * @returns {string | null}
 */
export function extractPhone(data) {
  if (!data || typeof data.length !== 'number') return null;

  let digits = '';
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    if (byte >= 48 && byte <= 57) digits += String.fromCharCode(byte);
  }

  const match = digits.match(/0\d{10}/);
  return match ? match[0] : null;
}

async function loadNodeHid() {
  if (hid) return hid;

  try {
    const mod = await import('node-hid');
    hid = mod.default ?? mod;
    return hid;
  } catch (err) {
    logger.error('node-hid is not available (caller ID hardware disabled)', {
      hardware: true,
      error: err?.message ?? String(err),
    });
    return null;
  }
}

/**
 * Attempt to auto-detect the JD-2000S device path via node-hid.
 *
 * @param {any} HID
 * @returns {string | null}
 */
function findCallerIdDevicePath(HID) {
  try {
    const devices = HID.devices();
    const match = devices.find(
      (d) =>
        (d.product && String(d.product).includes('JD-2000S')) ||
        (d.manufacturer && String(d.manufacturer).includes('KOSEN')) ||
        (d.vendorId === DEFAULT_VENDOR_ID && d.productId === DEFAULT_PRODUCT_ID),
    );
    return match?.path ?? null;
  } catch (err) {
    logger.warn('Failed to scan HID devices for JD-2000S', {
      hardware: true,
      error: err?.message ?? String(err),
    });
    return null;
  }
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function closeDevice() {
  if (!device) return;
  try {
    device.close();
  } catch (err) {
    logger.warn('Failed to close caller ID HID device cleanly', {
      hardware: true,
      error: err?.message ?? String(err),
    });
  } finally {
    device = null;
  }
}

function scheduleReconnect(reason) {
  if (stopped) return;
  if (reconnectTimer) return;

  logger.warn('Scheduling caller ID device reconnect', {
    hardware: true,
    reason,
    delayMs: RECONNECT_DELAY_MS,
  });

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connect();
  }, RECONNECT_DELAY_MS);
}

async function connect() {
  if (stopped) return;

  const HID = await loadNodeHid();
  if (!HID) return;

  clearReconnectTimer();
  closeDevice();

  const configuredPath = config.callerDevice.path?.trim();
  const path = configuredPath || findCallerIdDevicePath(HID);

  if (!path) {
    logger.warn('Caller ID device not found (will keep retrying)', {
      hardware: true,
      vendorId: DEFAULT_VENDOR_ID,
      productId: DEFAULT_PRODUCT_ID,
    });
    scheduleReconnect('device_not_found');
    return;
  }

  try {
    device = new HID.HID(path);
  } catch (err) {
    logger.error('Failed to open caller ID HID device', {
      hardware: true,
      path,
      error: err?.message ?? String(err),
    });
    scheduleReconnect('open_failed');
    return;
  }

  logger.info('Caller ID device connected', { hardware: true, path });

  device.on('data', (data) => {
    const phone = extractPhone(data);
    if (!phone) return;

    logger.info('Caller ID phone detected', { hardware: true, phone });
    try {
      onPhoneDetected?.(phone);
    } catch (err) {
      logger.error('Caller ID onPhoneDetected callback threw', {
        hardware: true,
        phone,
        error: err?.message ?? String(err),
      });
    }
  });

  device.on('error', (err) => {
    logger.warn('Caller ID device error', {
      hardware: true,
      error: err?.message ?? String(err),
    });
    scheduleReconnect('device_error');
  });
}

/**
 * Start listening to the caller ID HID device.
 *
 * @param {(phone: string) => void} handler
 * @returns {Promise<void>}
 */
export async function startListening(handler) {
  if (typeof handler !== 'function') {
    throw new TypeError('startListening(handler) requires a function');
  }

  if (!stopped) {
    throw new Error(
      'startListening() called while already listening — call stopListening() first',
    );
  }

  onPhoneDetected = handler;
  stopped = false;

  await connect();
}

/**
 * Stop listening and release hardware resources.
 */
export function stopListening() {
  stopped = true;
  onPhoneDetected = null;
  clearReconnectTimer();
  closeDevice();
  hid = null; // Clear cached module so the next startListening() re-resolves import cleanly
  logger.info('Caller ID device listener stopped', { hardware: true });
}
