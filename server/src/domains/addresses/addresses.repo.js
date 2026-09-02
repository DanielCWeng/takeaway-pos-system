import { getDb } from "../../infrastructure/db.js";

export function findCached(postcode) {
  const row = getDb()
    .prepare(
      `SELECT postcode, addresses_json, latitude, longitude, fetched_at
       FROM address_lookup_cache WHERE postcode = ?`,
    )
    .get(postcode);
  if (!row) return null;

  try {
    const addresses = JSON.parse(row.addresses_json);
    if (
      !Array.isArray(addresses) ||
      addresses.length === 0 ||
      !addresses.every(
        (address) =>
          address &&
          typeof address === "object" &&
          typeof address.line1 === "string" &&
          address.line1.trim().length > 0 &&
          (address.line2 === undefined || typeof address.line2 === "string") &&
          (address.town === undefined || typeof address.town === "string"),
      )
    ) {
      return null;
    }
    return {
      postcode: row.postcode,
      addresses,
      latitude: row.latitude,
      longitude: row.longitude,
      fetchedAt: row.fetched_at,
    };
  } catch {
    return null;
  }
}

export function saveCached({ postcode, addresses, latitude, longitude }) {
  getDb()
    .prepare(
      `INSERT INTO address_lookup_cache
         (postcode, addresses_json, latitude, longitude, fetched_at)
       VALUES (@postcode, @addressesJson, @latitude, @longitude, @fetchedAt)
       ON CONFLICT(postcode) DO UPDATE SET
         addresses_json = excluded.addresses_json,
         latitude = excluded.latitude,
         longitude = excluded.longitude,
         fetched_at = excluded.fetched_at`,
    )
    .run({
      postcode,
      addressesJson: JSON.stringify(addresses),
      latitude,
      longitude,
      fetchedAt: new Date().toISOString(),
    });
}
