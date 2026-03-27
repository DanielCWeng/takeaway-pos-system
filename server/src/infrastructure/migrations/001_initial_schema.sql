-- Migration: 001_initial_schema.sql
-- Creates the core tables for orders and customers.
-- The _migrations table itself is created by the migration runner before this runs.

CREATE TABLE IF NOT EXISTS orders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  data        TEXT    NOT NULL,        -- Full order JSON blob (serialised in orders.repo.js only)
  archived_at TEXT    NOT NULL         -- ISO 8601 timestamp string
);

CREATE INDEX IF NOT EXISTS idx_orders_archived_at ON orders(archived_at DESC);

CREATE TABLE IF NOT EXISTS customers (
  phone         TEXT    PRIMARY KEY,   -- UK mobile or landline number (e.g. 07911123456)
  name          TEXT,
  postcode      TEXT,
  house_number  TEXT,
  street        TEXT,
  town          TEXT,
  latitude      REAL,
  longitude     REAL,
  distance      REAL,                             -- Miles or null
  first_call    TEXT    NOT NULL,      -- ISO 8601 timestamp
  last_call     TEXT    NOT NULL,      -- ISO 8601 timestamp
  call_count    INTEGER NOT NULL DEFAULT 1
);
