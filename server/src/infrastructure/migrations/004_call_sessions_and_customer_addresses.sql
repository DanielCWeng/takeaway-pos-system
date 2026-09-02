-- migration: 004_call_sessions_and_customer_addresses
-- Adds:
--  1) customer_addresses: normalized multi-address model per customer identity
--  2) call_sessions: CTI session correlation keyed by bridge callId
--  3) additional call_logs columns for correlated metadata at disconnect

CREATE TABLE IF NOT EXISTS customer_addresses (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_phone    TEXT    NOT NULL,
  line1             TEXT    NOT NULL,
  line2             TEXT    NOT NULL DEFAULT '',
  town              TEXT,
  postcode          TEXT    NOT NULL DEFAULT '',
  latitude          REAL    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude         REAL    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  usage_count       INTEGER NOT NULL DEFAULT 1,
  last_used_at      TEXT    NOT NULL,
  created_at        TEXT    NOT NULL,
  updated_at        TEXT    NOT NULL,
  FOREIGN KEY (customer_phone) REFERENCES customers(phone) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_addresses_unique
  ON customer_addresses(customer_phone, line1, line2, postcode);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_phone
  ON customer_addresses(customer_phone);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_last_used
  ON customer_addresses(last_used_at DESC);

CREATE TABLE IF NOT EXISTS call_sessions (
  call_id                 INTEGER PRIMARY KEY,
  phone                   TEXT,
  offered_at              TEXT,
  connected_at            TEXT,
  ended_at                TEXT,
  selected_customer_phone TEXT,
  selected_customer_name  TEXT,
  selected_address        TEXT,
  notes                   TEXT,
  updated_at              TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_updated_at
  ON call_sessions(updated_at DESC);

ALTER TABLE call_logs ADD COLUMN call_id INTEGER;
ALTER TABLE call_logs ADD COLUMN selected_customer_phone TEXT;
ALTER TABLE call_logs ADD COLUMN selected_address TEXT;

CREATE INDEX IF NOT EXISTS idx_call_logs_call_id
  ON call_logs(call_id);
