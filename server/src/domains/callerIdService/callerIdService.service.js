/**
 * domains/callerIdService/callerIdService.service.js
 *
 * Orchestrates the flow for an incoming call detected by hardware.
 *
 * Responsibilities:
 *  - Debounce rapid-fire events from the HID device (common on LAN/USB).
 *  - Trigger customer lookup/creation.
 *  - Trigger address enrichment if a postcode is known.
 *  - Broadcast the result to all connected clients via WebSocket.
 *
 * The `broadcast` function is injected via `init()` rather than imported
 * directly. This keeps the domain layer free of transport-layer imports
 * and makes the dependency explicit and testable.
 */

import * as customerService from "../customers/customers.service.js";
import { logger } from "../../infrastructure/logger.js";

// Debounce map: phone -> timestamp
const lastCallSeen = new Map();
/** Tracks eviction timer handles so clearDebounceMap() can cancel them cleanly. */
const evictionTimers = new Map();
const DEBOUNCE_MS = 2000;

/** @type {((type: string, payload: object) => void) | null} */
let broadcastFn = null;

/**
 * Inject dependencies. Must be called once at server startup before any
 * hardware events can arrive.
 *
 * @param {{ broadcast: (type: string, payload: object) => void }} deps
 */
export function init({ broadcast }) {
  if (typeof broadcast !== "function") {
    throw new TypeError("callerIdService.init() requires a broadcast function");
  }
  broadcastFn = broadcast;
}

/**
 * Handle a new phone number detected by the hardware layer.
 *
 * @param {string} phone - Raw phone number string from HID device
 */
export async function handlePhoneDetected(phone) {
  if (!phone) return;
  // Normalise: Strip all non-digit characters (except maybe leading + for future-proofing)
  // This ensures "(0115) 123 4567" and "01151234567" are treated identically.
  const normPhone = phone.replace(/[^\d+]/g, "");

  if (!normPhone) {
    logger.warn("Received empty phone number");
    return;
  }

  const now = Date.now();
  const lastSeen = lastCallSeen.get(normPhone) || 0;

  if (now - lastSeen < DEBOUNCE_MS) {
    logger.debug("Call debounced", { phone: normPhone });
    return;
  }

  lastCallSeen.set(normPhone, now);
  // Evict entry exactly after the debounce window so a call at t=1999ms is still blocked but t=2001ms passes.
  const evictTimer = setTimeout(() => {
    lastCallSeen.delete(normPhone);
    evictionTimers.delete(normPhone);
  }, DEBOUNCE_MS);
  evictionTimers.set(normPhone, evictTimer);

  logger.info("Handling incoming call", { phone: normPhone });

  let customer = null;
  let enrichedCustomer = null;
  let addresses = [];

  try {
    // 1. Get or create the customer record
    customer = await customerService.getOrCreateCustomer(normPhone);

    // 2. If the customer has a postcode, ask the customer service to enrich it.
    enrichedCustomer = customer;
    if (customer.postcode) {
      const enrichedResult = await customerService.enrichCustomerAddress(
        normPhone,
        customer.postcode,
      );
      enrichedCustomer = enrichedResult.customer;
      addresses = enrichedResult.addresses || [];
    }
  } catch (err) {
    logger.error("Failed to lookup/enrich customer for incoming call", {
      phone: normPhone,
      error: err.message,
    });
    // Continue anyway — we still want to broadcast the phone number if possible
  }

  try {
    // 3. Prepare payload for the frontend
    const payload = {
      phone: normPhone,
      customer: enrichedCustomer || customer,
      addresses,
      distance: enrichedCustomer?.distance || customer?.distance || null,
    };

    // 4. Push to all connected UIs
    if (!broadcastFn) {
      logger.error("callerIdService.broadcast is not initialised — call init() at startup");
      return;
    }
    broadcastFn("incoming_call", payload);
  } catch (err) {
    logger.error("Failed to broadcast incoming call", {
      phone: normPhone,
      error: err.message,
      stack: err.stack,
    });
  }
}

/**
 * Cleanup function to clear the debounce map.
 */
export function clearDebounceMap() {
  for (const timer of evictionTimers.values()) clearTimeout(timer);
  evictionTimers.clear();
  lastCallSeen.clear();
}
