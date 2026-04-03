/**
 * shared/postcodes.js
 *
 * All access to the local postcodes.db.
 *
 * Responsibilities:
 *  - Provide synchronous postcode validation and address lookup.
 *  - Normalise postcode format (e.g. "ng98gf" -> "NG9 8GF").
 *  - Save API-sourced address data back to the local DB.
 *
 * Connection strategy: Dedicated singleton connection separate from orders.db.
 *
 * NOTE: This is the local DB variant of address lookup (findAddressesLocally).
 * See domains/callerIdService/addressClient.js for the remote API variant.
 */

import Database from 'better-sqlite3';
import { config } from '../config/index.js';
import { logger } from '../infrastructure/logger.js';

/** @type {import('better-sqlite3').Database | null} */
let _db = null;

// ---------------------------------------------------------------------------
// Cached prepared statements — compiled once per connection, reused thereafter
// ---------------------------------------------------------------------------

/** @type {import('better-sqlite3').Statement | null} */
let _stmtIsValid = null;

/**
 * Return the open postcodes database connection.
 * Opens it on demand if not already open.
 */
function getPostcodeDb() {
  if (!_db) {
    _db = new Database(config.db.postcodesPath, {
      readonly: false, // Must be writable to save API results
    });
    // Bootstrap table if it doesn't exist (e.g. if seed script hasn't run yet)
    _db.exec(`
      CREATE TABLE IF NOT EXISTS addresses (
        postcode  TEXT PRIMARY KEY,
        street    TEXT,
        latitude  REAL,
        longitude REAL,
        source    TEXT DEFAULT 'api',
        data      TEXT
      )
    `);
    // Ensure 'data' column exists for existing installations
    try {
      _db.exec('ALTER TABLE addresses ADD COLUMN data TEXT');
    } catch {
      // Column already exists, ignore
    }
    logger.info('Postcodes database opened', { path: config.db.postcodesPath });
  }
  return _db;
}

/**
 * Return (and lazily compile) the isValid prepared statement.
 * @returns {import('better-sqlite3').Statement}
 */
function getIsValidStmt() {
  return (_stmtIsValid ??= getPostcodeDb().prepare('SELECT 1 FROM addresses WHERE postcode = ?'));
}

// ---------------------------------------------------------------------------
// UK postcode regex (uppercase, space already inserted)
// Matches formats: A9 9AA, A99 9AA, AA9 9AA, AA99 9AA, A9A 9AA, AA9A 9AA
// ---------------------------------------------------------------------------
const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/;

/**
 * Normalise a postcode to uppercase with a space (e.g. "NG9 8GF").
 * Returns an empty string if input is falsy.
 * Returns the cleaned string unchanged if it does not match UK postcode format.
 *
 * @param {string} postcode
 * @returns {string}
 */
export function normalisePostcode(postcode) {
  if (!postcode) return '';

  const clean = postcode.replace(/\s/g, '').toUpperCase();

  // Insert space before the last 3 characters (standard UK postcode structure)
  const spaced = clean.slice(0, -3) + ' ' + clean.slice(-3);

  if (!UK_POSTCODE_RE.test(spaced)) {
    logger.warn('normalisePostcode: input does not match UK postcode format', { postcode });
    return clean; // Return cleaned but un-spaced so callers can detect malformed input
  }

  return spaced;
}

/**
 * Check if a postcode exists in the local database.
 *
 * @param {string} postcode
 * @returns {boolean}
 */
export function isValidPostcode(postcode) {
  const norm = normalisePostcode(postcode);
  const row = getIsValidStmt().get(norm);
  return !!row;
}

/**
 * Find address data for a postcode in the local database.
 * This is the local DB variant — see addressClient.js for the remote API variant.
 *
 * @param {string} postcode
 * @returns {Array<{ postcode: string, street: string, latitude: number, longitude: number, source: string }>}
 */
export function findAddressesLocally(postcode) {
  const norm = normalisePostcode(postcode);
  const db = getPostcodeDb();
  const row = db.prepare('SELECT * FROM addresses WHERE postcode = ?').get(norm);

  if (!row) return [];

  // If we have full JSON data, return that
  if (row.data) {
    try {
      const parsedData = JSON.parse(row.data);
      if (Array.isArray(parsedData)) {
        return parsedData;
      }
      logger.warn('findAddressesLocally: Stored data is not an array for postcode', {
        postcode: norm,
        data: row.data,
      });
      // Fall through to legacy if JSON is not an array
    } catch (e) {
      logger.warn('findAddressesLocally: Failed to parse JSON data for postcode', {
        postcode: norm,
        error: e.message,
      });
      // Corrupt JSON? Fall back to basic street-only row
    }
  }

  // Legacy fallback: single-element array from street column
  // This handles cases where 'data' column is null or parsing failed,
  // and relies on the old 'street', 'latitude', 'longitude', 'source' columns.
  if (row.street || row.latitude || row.longitude) {
    return [
      {
        postcode: row.postcode,
        street: row.street,
        latitude: row.latitude,
        longitude: row.longitude,
        source: row.source,
      },
    ];
  }

  return []; // No data found even in legacy columns
}

export function saveAddresses(postcode, bestMatch, fullList = []) {
  const norm = normalisePostcode(postcode);
  const db = getPostcodeDb();

  // Hardening: Ensure we have the minimum required fields before a write
  if (
    !bestMatch ||
    typeof bestMatch.latitude !== 'number' ||
    typeof bestMatch.longitude !== 'number'
  ) {
    logger.warn('Failed to save postcode data: missing or invalid coordinates', {
      postcode: norm,
      bestMatch,
    });
    return;
  }

  try {
    const upsert = db.prepare(`
      INSERT INTO addresses (postcode, street, latitude, longitude, data)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(postcode) DO UPDATE SET
        street = excluded.street,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        data = excluded.data
    `);

    upsert.run(
      norm,
      bestMatch.street || '',
      bestMatch.latitude,
      bestMatch.longitude,
      fullList && fullList.length > 0 ? JSON.stringify(fullList) : null,
    );
    logger.debug('Postcode data saved locally', { postcode: norm });
  } catch (err) {
    logger.error('Failed to save postcode data', {
      postcode: norm,
      error: err.message,
    });
  }
}

/**
 * Close the postcodes database connection.
 * Mainly used for cleanup in tests.
 */
export function closePostcodeDb() {
  if (_db) {
    _db.close();
    _db = null;
    _stmtIsValid = null;
    logger.info('Postcodes database closed');
  }
}
