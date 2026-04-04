/**
 * domains/addresses/addresses.service.js
 *
 * Postcode lookup and address verification orchestration.
 *
 * Endpoints:
 *  - POST /api/addresses/lookup
 *  - POST /api/addresses/verify
 */

import { config } from "../../config/index.js";
import { logger } from "../../infrastructure/logger.js";
import * as postcodes from "../../shared/postcodes.js";
import { haversineInMiles } from "../../shared/haversine.js";
import { ValidationError } from "../../shared/errors.js";
import * as customersService from "../customers/customers.service.js";
import * as addressClient from "../callerIdService/addressClient.js";

// Matches formats: A9 9AA, A99 9AA, AA9 9AA, AA99 9AA, A9A 9AA, AA9A 9AA
const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/;

/**
 * Validate and normalise a UK postcode.
 *
 * @param {string} postcode
 * @returns {string} Normalised postcode with space (e.g. "NG9 8GF")
 * @throws {ValidationError}
 */
function normaliseAndValidatePostcode(postcode) {
  const norm = postcodes.normalisePostcode(postcode);
  if (!norm || !UK_POSTCODE_RE.test(norm)) {
    throw new ValidationError("Postcode must be a valid UK postcode", {
      field: "postcode",
      received: postcode,
    });
  }
  return norm;
}

/**
 * Convert a local postcode DB row to the address shape expected by the client.
 *
 * @param {{ postcode: string, street: string, latitude: number, longitude: number }} row
 * @returns {{ line1: string, line2: string, town: string, postcode: string, latitude: number, longitude: number }}
 */
function localRowToAddress(row) {
  // Handle both API-style rows (line1/town) and legacy rows (street/ward).
  return {
    line1: row.line1 || row.street || "",
    line2: row.line2 || "",
    town: row.town || row.ward || "",
    postcode: row.postcode || "",
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

/**
 * Lookup addresses for a postcode using local DB first, then API fallback.
 *
 * Response sources:
 *  - local_db: returned from postcodes.db
 *  - api: returned from getaddress.io
 *  - no_api_key: API key missing and not in local DB
 *  - not_found: not in local DB and API returned null
 *
 * @param {string} postcode
 * @returns {Promise<{ addresses: any[], source: string }>}
 */
export async function lookupPostcode(postcode) {
  const norm = normaliseAndValidatePostcode(postcode);

  const local = postcodes.findAddressesLocally(norm);
  if (local.length > 0) {
    return {
      addresses: local.map(localRowToAddress),
      source: "local_db",
    };
  }

  if (!config.address.apiKey) {
    return { addresses: [], source: "no_api_key" };
  }

  const apiResults = await addressClient.findAddressesFromApi(norm);
  if (!apiResults) {
    return { addresses: [], source: "not_found" };
  }

  const addresses = apiResults.map((addr) => ({
    line1: addr.line1 || "",
    line2: addr.line2 || "",
    town: addr.town || "",
    postcode: norm,
    latitude: addr.latitude,
    longitude: addr.longitude,
  }));

  if (addresses.length > 0) {
    postcodes.saveAddresses(
      norm,
      {
        street: addresses[0].line1,
        latitude: addresses[0].latitude,
        longitude: addresses[0].longitude,
      },
      addresses,
    );
  }

  return { addresses, source: "api" };
}

/**
 * Verify an address selection and persist it to the customer record.
 * Computes distance in miles if coordinates are provided.
 *
 * @param {string} phone
 * @param {{ line1?: string, town?: string, postcode?: string, latitude?: number, longitude?: number }} addressData
 * @returns {object} Updated customer
 */
export function verifyAddress(phone, addressData) {
  let effectivePhone = phone;

  // If no phone or placeholder '0000' or otherwise invalid numeric phone, generate an UNKNOWN- identifier
  const isInvalidNumeric =
    !effectivePhone ||
    effectivePhone === "0000" ||
    (!effectivePhone.startsWith("UNKNOWN-") && effectivePhone.length < 10);

  if (isInvalidNumeric) {
    effectivePhone = `UNKNOWN-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
  }

  // Ensure customer exists in the system (creates a stub if new)
  customersService.getOrCreateCustomer(effectivePhone);

  const update = {
    postcode: addressData.postcode ? normaliseAndValidatePostcode(addressData.postcode) : undefined,
    street: addressData.line1,
    town: addressData.town,
    latitude: addressData.latitude,
    longitude: addressData.longitude,
  };

  if (Number.isFinite(update.latitude) && Number.isFinite(update.longitude)) {
    const miles = haversineInMiles(
      config.address.storeLatitude,
      config.address.storeLongitude,
      update.latitude,
      update.longitude,
    );

    update.distance = parseFloat(miles.toFixed(2));
    logger.debug("Computed delivery distance for verified address", {
      phone: effectivePhone,
      postcode: update.postcode ?? null,
      distance: update.distance,
    });
  }

  return customersService.updateCustomerAddress(effectivePhone, update);
}
