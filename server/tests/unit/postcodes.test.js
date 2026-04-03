import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as postcodes from '../../src/shared/postcodes.js';
import fs from 'fs';
import Database from 'better-sqlite3';

describe('Postcodes Module (Address Granularity)', () => {
  // Use a fixed path relative to the test runner or /tmp/ for tests
  const testDbPath = './data/test_postcodes.db';

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    // Explicitly mock the config for this test
    vi.mock('../../src/config/index.js', async (importOriginal) => {
      const actual = await importOriginal();
      return {
        ...actual,
        config: {
          ...actual.config,
          db: { ...actual.config.db, postcodesPath: './data/test_postcodes.db' },
        },
      };
    });
  });

  afterEach(() => {
    postcodes.closePostcodeDb();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (err) {
        /* ignore */
      }
    }
    vi.resetAllMocks();
  });

  it('saves and retrieves a full address list as JSON', () => {
    const postcode = 'NG9 8GF';
    const bestMatch = { street: 'High St', latitude: 52.9, longitude: -1.2 };
    const fullList = [
      { line1: '1 High St', town: 'Beeston', latitude: 52.9, longitude: -1.2 },
      { line1: '2 High St', town: 'Beeston', latitude: 52.9, longitude: -1.2 },
    ];

    postcodes.saveAddresses(postcode, bestMatch, fullList);
    const results = postcodes.findAddressesLocally(postcode);

    expect(results).toHaveLength(2);
    expect(results[0].line1).toBe('1 High St');
    expect(results[1].line1).toBe('2 High St');
  });

  it('falls back to legacy street column if JSON data is missing', () => {
    // Manually insert a legacy row into the DB
    const db = new Database(testDbPath);
    db.exec(`
      CREATE TABLE addresses (
        postcode  TEXT PRIMARY KEY,
        street    TEXT,
        latitude  REAL,
        longitude REAL,
        source    TEXT DEFAULT 'api',
        data      TEXT
      )
    `);
    db.prepare(
      'INSERT INTO addresses (postcode, street, latitude, longitude) VALUES (?, ?, ?, ?)',
    ).run('DE1 1AA', 'Derby St', 52.9, -1.4);
    db.close();

    const results = postcodes.findAddressesLocally('DE1 1AA');
    expect(results).toHaveLength(1);
    expect(results[0].street).toBe('Derby St');
  });
});
