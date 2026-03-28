/**
 * scripts/seedPostcodes.js
 *
 * One-time setup script to populate postcodes.db from postcodes_detailed.json.
 *
 * Responsibilities:
 *  1. Read raw JSON data (Easting/Northing).
 *  2. Convert to WGS84 Latitude/Longitude via proj4.
 *  3. Initialise the 'addresses' table in the local SQLite DB.
 *  4. Batch insert all records in a single transaction.
 *  5. Mark source as 'seed'.
 *
 * Usage:
 *   node scripts/seedPostcodes.js
 *   npm run db:seed-postcodes
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import proj4 from 'proj4';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Setup & Config
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// We don't import the full app config here to avoid triggering environment validation
// for unrelated variables (like printer IDs) during a simple seed task.
// Instead, we just look for the expected file locations.
const JSON_PATH = path.join(ROOT, 'data', 'postcodes_detailed.json');
const DB_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DB_DIR, 'postcodes.db');

// Proj4 Definitions:
// EPSG:27700 = British National Grid (OSGB36)
// EPSG:4326 = WGS84 (Standard GPS Lat/Lng)
proj4.defs(
  'EPSG:27700',
  '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs',
);
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

// Minimal normalisation (mirroring shared/postcodes.js without the full import)
function normalisePostcode(pc) {
  if (!pc) return '';
  const clean = pc.replace(/\s/g, '').toUpperCase();
  if (clean.length < 5) return clean;
  return clean.slice(0, -3) + ' ' + clean.slice(-3);
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

async function seed() {
  console.log('--- Initial Postcode Seed ---');

  // 1. Validation
  if (!fs.existsSync(JSON_PATH)) {
    console.error(`[ERROR] Source file not found: ${JSON_PATH}`);
    console.error('Please ensure postcodes_detailed.json is in the server/data directory.');
    process.exit(1);
  }

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  // 2. Load Data
  console.log(`Loading JSON from ${JSON_PATH}...`);
  const startTime = Date.now();
  let rawData;
  try {
    rawData = fs.readFileSync(JSON_PATH, 'utf8');
  } catch (err) {
    console.error(`[ERROR] Failed to read JSON file: ${err.message}`);
    process.exit(1);
  }

  let postcodes;
  try {
    postcodes = JSON.parse(rawData);
  } catch (err) {
    console.error(`[ERROR] Failed to parse JSON: ${err.message}`);
    process.exit(1);
  }

  const entries = Object.entries(postcodes);
  console.log(`Found ${entries.length} postcodes to process.`);

  // 3. Prepare Database
  console.log(`Opening database at ${DB_PATH}...`);
  const db = new Database(DB_PATH);

  // Create table if it doesn't exist (matching shared/postcodes.js schema)
  db.exec(`
        CREATE TABLE IF NOT EXISTS addresses (
            postcode  TEXT PRIMARY KEY,
            street    TEXT,
            latitude  REAL,
            longitude REAL,
            source    TEXT DEFAULT 'api',
            data      TEXT
        )
    `);

  // Prepare transformation and insertion
  const insert = db.prepare(`
        INSERT OR REPLACE INTO addresses (postcode, street, latitude, longitude, source, data)
        VALUES (@postcode, @street, @latitude, @longitude, @source, @data)
    `);

  // 4. Transform and Insert (Atomic Transaction)
  console.log('Transforming coordinates and seeding database...');
  let count = 0;
  let skipCount = 0;

  const seedTransaction = db.transaction((items) => {
    for (const [code, details] of items) {
      const { easting, northing, street } = details;

      if (!easting || !northing) {
        skipCount++;
        continue;
      }

      try {
        // Convert Easting/Northing to [Lng, Lat]
        const [lng, lat] = proj4('EPSG:27700', 'EPSG:4326', [easting, northing]);

        insert.run({
          postcode: normalisePostcode(code),
          street: street || '',
          latitude: lat,
          longitude: lng,
          source: 'seed',
          data: null, // Historical seed data doesn't have the full extra JSON blob
        });
        count++;

        if (count % 1000 === 0) {
          process.stdout.write(`\rProcessed ${count} records...`);
        }
      } catch (err) {
        console.warn(`\n[WARN] Failed to convert ${code}: ${err.message}`);
        skipCount++;
      }
    }
  });

  try {
    seedTransaction(entries);
    console.log(`\n\rSuccess!`);
  } catch (err) {
    console.error(`\n[FATAL] Transaction failed: ${err.message}`);
    process.exit(1);
  }

  // 5. Cleanup
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('------------------------------');
  console.log(`Finished in ${duration}s`);
  console.log(`Inserted: ${count}`);
  console.log(`Skipped:  ${skipCount}`);
  console.log('------------------------------');

  db.close();
  console.log('Database connection closed.');

  // Per the plan, we should suggest deleting the JSON file now
  console.log('\n[PLAN ADVISORY] As per the rebuild plan, you may now safely delete');
  console.log('server/data/postcodes_detailed.json to reduce repository weight.');
}

seed();
