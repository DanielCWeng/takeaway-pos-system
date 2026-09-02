-- Persistent cache of successful getAddress.io postcode lookups.
-- This table is a cache, never an authoritative postcode dataset.

CREATE TABLE IF NOT EXISTS address_lookup_cache (
  postcode       TEXT PRIMARY KEY,
  addresses_json TEXT NOT NULL CHECK (json_valid(addresses_json)),
  latitude       REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude      REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  fetched_at     TEXT NOT NULL
);
