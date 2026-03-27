-- Migration: 002_coordinate_integrity.sql
-- Enforces WGS84 coordinate ranges at the database level.
-- SQLite doesn't support ADD CONSTRAINT, so we recreate the table.
-- WARNING: There is a narrow window between DROP TABLE and rename where a crash
-- could leave the system in an inconsistent state (customers table missing).
-- Mitigation: Re-running migrations on next start will detect the state.

PRAGMA foreign_keys=OFF;

-- 1. Create a new table with the constraints
CREATE TABLE customers_new (
  phone         TEXT    PRIMARY KEY,
  name          TEXT,
  postcode      TEXT,
  house_number  TEXT,
  street        TEXT,
  town          TEXT,
  latitude      REAL    CHECK (latitude IS NULL OR (latitude BETWEEN -90 AND 90)),
  longitude     REAL    CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180)),
  distance      REAL,
  first_call    TEXT    NOT NULL,
  last_call     TEXT    NOT NULL,
  call_count    INTEGER NOT NULL DEFAULT 1
);

-- 2. Copy data from the old table
INSERT INTO customers_new SELECT * FROM customers;

-- 3. Replace the old table
DROP TABLE customers;
ALTER TABLE customers_new RENAME TO customers;

PRAGMA foreign_keys=ON;
