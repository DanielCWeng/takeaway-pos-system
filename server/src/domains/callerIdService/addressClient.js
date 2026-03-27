/**
 * domains/callerIdService/addressClient.js
 *
 * All HTTP calls to getaddress.io.
 *
 * Responsibilities:
 *  - Fetch address lists for a given postcode.
 *  - LRU cache results per session to minimize API costs.
 *  - Graceful degradation if API key is missing.
 *  - Standardise response shape for the rest of the app.
 */

import { LRUCache } from 'lru-cache';
import { config } from '../../config/index.js';
import { logger } from '../../infrastructure/logger.js';

// Cache up to 100 postcodes for 24 hours
const cache = new LRUCache({
  max: 100,
  ttl: 1000 * 60 * 60 * 24,
});

/**
 * @typedef {Object} AddressRecord
 * @property {string} line1
 * @property {string} line2
 * @property {string} town
 * @property {number} latitude
 * @property {number} longitude
 */

/**
 * Fetch addresses from getaddress.io.
 * Returns null if API key is missing, postcode is not found, or API fails.
 *
 * NOTE: This is the remote API variant of address lookup.
 * See shared/postcodes.js for the local DB variant (findAddressesLocally).
 *
 * @param {string} postcode - Normalised UK postcode
 * @returns {Promise<AddressRecord[] | null>}
 */
export async function findAddressesFromApi(postcode) {
  const apiKey = config.address.apiKey;

  if (!apiKey) {
    logger.warn('Address lookup skipped: GETADDRESS_API_KEY not configured');
    return null;
  }

  // Normalise before cache lookup and URL construction so that "ng9 8gf" and "NG9 8GF"
  // resolve to the same cache entry and don't trigger duplicate API calls.
  const normPostcode = postcode.trim().toUpperCase().replace(/\s+/g, '');

  // Check cache first
  const cached = cache.get(normPostcode);
  if (cached) {
    logger.debug('Address lookup: cache hit', { postcode: normPostcode });
    return cached;
  }

  // API key is sent as a header to avoid it appearing in server logs or URLs
  const url = `https://api.getaddress.io/find/${normPostcode}?expand=true`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      headers: { 'api-key': apiKey },
      signal: controller.signal,
    });

    if (response.status === 429) {
      logger.error('Address lookup: RATE LIMIT REACHED (HTTP 429)', {
        postcode,
        message: 'The getaddress.io API limit for this day/key has been exceeded.',
      });
      return null;
    }

    if (response.status === 404) {
      logger.info('Address lookup: postcode not found', { postcode });
      return null;
    }

    if (!response.ok) {
      const text = await response.text();
      logger.error('Address lookup: API error', {
        postcode,
        status: response.status,
        error: text,
      });
      return null;
    }

    const data = await response.json();

    // Guard against unexpected response shapes before attempting to map
    if (!Array.isArray(data.addresses)) {
      logger.error('Address lookup: unexpected response shape', { postcode, data });
      return null;
    }

    // Latitude/longitude validation: must be numbers
    if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
      logger.error('Address lookup: missing or invalid coordinates in API response', {
        postcode,
        latitude: data.latitude,
        longitude: data.longitude,
      });
      return null;
    }

    // latitude/longitude are postcode-level fields on the API response, not
    // per-address — it is correct to apply them to every address in the list.
    const results = data.addresses.map((addr) => ({
      line1: addr.line_1 || '',
      line2: addr.line_2 || '',
      town: addr.town_or_city || '',
      latitude: data.latitude,
      longitude: data.longitude,
    }));

    // Intentionally cache empty arrays — a valid postcode with no listed
    // addresses is a known API state and should not trigger repeat calls.
    cache.set(normPostcode, results);
    logger.info('Address lookup: API success', {
      postcode: normPostcode,
      resultCount: results.length,
    });

    return results;
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.error('Address lookup: request timed out (5s)', { postcode });
    } else {
      logger.error('Address lookup: network error', {
        postcode,
        error: err.message,
      });
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
