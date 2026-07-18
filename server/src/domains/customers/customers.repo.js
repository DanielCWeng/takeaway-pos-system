/**
 * domains/customers/customers.repo.js
 *
 * All SQL for the `customers` table. No business logic lives here.
 *
 * Rules:
 *  - JSON serialisation/deserialisation of `distance`
 *    column happens here ONLY. No other module touches raw JSON
 *    strings for customer fields.
 *  - snake_case column names in SQL ↔ camelCase field names in returned objects.
 *  - No SQLite row objects or driver internals are ever returned to callers.
 */

import { getDb } from "../../infrastructure/db.js";

// ---------------------------------------------------------------------------
// Row → domain object mapper
// ---------------------------------------------------------------------------

/**
 * Map a raw SQLite row to a plain customer object (camelCase fields, parsed JSON).
 * @param {object} row
 * @returns {object}
 */
function rowToCustomer(row) {
  return {
    phone: row.phone,
    name: row.name ?? null,
    postcode: row.postcode ?? null,
    houseNumber: row.house_number ?? null,
    street: row.street ?? null,
    town: row.town ?? null,
    // Safe-parse: fall back to empty array/null if stored value is corrupt
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    distance: row.distance ?? null,
    firstCall: row.first_call,
    lastCall: row.last_call,
    callCount: row.call_count,
  };
}

function rowToCustomerAddress(row) {
  return {
    id: row.id,
    customerPhone: row.customer_phone,
    houseNumber: row.house_number ?? null,
    line1: row.line1,
    line2: row.line2 ?? null,
    town: row.town ?? null,
    postcode: row.postcode ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    usageCount: row.usage_count ?? 1,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Statement Cache
// ---------------------------------------------------------------------------

const stmts = {
  findByPhone: null,
  upsert: null,
  upsertIncrement: null,
  increment: null,
  deleteByPhone: null,
  listAddressesByCustomer: null,
  upsertCustomerAddress: null,
};

function getStmts() {
  const db = getDb();
  return {
    findByPhone: (stmts.findByPhone ??= db.prepare("SELECT * FROM customers WHERE phone = ?")),
    upsert: (stmts.upsert ??= db.prepare(`
      INSERT INTO customers
        (phone, name, postcode, house_number, street, town,
         latitude, longitude, distance, first_call, last_call, call_count)
      VALUES
        (@phone, @name, @postcode, @houseNumber, @street, @town,
         @latitude, @longitude, @distance, @firstCall, @lastCall, @callCount)
      ON CONFLICT(phone) DO UPDATE SET
        name          = excluded.name,
        postcode      = excluded.postcode,
        house_number  = excluded.house_number,
        street        = excluded.street,
        town          = excluded.town,
        latitude      = excluded.latitude,
        longitude     = excluded.longitude,
        distance      = excluded.distance,
        last_call     = excluded.last_call,
        call_count    = excluded.call_count
      RETURNING *
    `)),
    upsertIncrement: (stmts.upsertIncrement ??= db.prepare(`
      INSERT INTO customers
        (phone, name, postcode, house_number, street, town,
         latitude, longitude, distance, first_call, last_call, call_count)
      VALUES
        (@phone, @name, @postcode, @houseNumber, @street, @town,
         @latitude, @longitude, @distance, @now, @now, 1)
      ON CONFLICT(phone) DO UPDATE SET
        last_call  = excluded.last_call,
        call_count = call_count + 1
      RETURNING *
    `)),
    increment: (stmts.increment ??= db.prepare(`
      UPDATE customers
      SET call_count = call_count + 1,
          last_call  = ?
      WHERE phone = ?
      RETURNING *
    `)),
    deleteByPhone: (stmts.deleteByPhone ??= db.prepare("DELETE FROM customers WHERE phone = ?")),
    listAddressesByCustomer: (stmts.listAddressesByCustomer ??= db.prepare(`
      SELECT *
      FROM customer_addresses
      WHERE customer_phone = ?
      ORDER BY last_used_at DESC, id DESC
    `)),
    upsertCustomerAddress: (stmts.upsertCustomerAddress ??= db.prepare(`
      INSERT INTO customer_addresses (
        customer_phone, house_number, line1, line2, town, postcode,
        latitude, longitude, usage_count, last_used_at, created_at, updated_at
      )
      VALUES (
        @customerPhone, @houseNumber, @line1, @line2, @town, @postcode,
        @latitude, @longitude, 1, @now, @now, @now
      )
      ON CONFLICT(customer_phone, line1, line2, postcode)
      DO UPDATE SET
        house_number = COALESCE(excluded.house_number, customer_addresses.house_number),
        town = COALESCE(excluded.town, customer_addresses.town),
        latitude = COALESCE(excluded.latitude, customer_addresses.latitude),
        longitude = COALESCE(excluded.longitude, customer_addresses.longitude),
        usage_count = customer_addresses.usage_count + 1,
        last_used_at = excluded.last_used_at,
        updated_at = excluded.updated_at
      RETURNING *
    `)),
  };
}

// ---------------------------------------------------------------------------
// Repository functions
// ---------------------------------------------------------------------------

/**
 * Find a customer by phone number. Returns null if not found.
 *
 * @param {string} phone
 * @returns {object | null}
 */
export function findByPhone(phone) {
  const row = getStmts().findByPhone.get(phone);
  return row ? rowToCustomer(row) : null;
}

/**
 * Insert a new customer, or update all fields if a customer with this phone
 * already exists (full upsert via INSERT OR REPLACE).
 *
 * @param {object} data
 * @param {string} data.phone
 * @param {string} [data.name]
 * @param {string} [data.postcode]
 * @param {string} [data.houseNumber]
 * @param {string} [data.street]
 * @param {string} [data.town]
 * @param {number|null} [data.latitude]
 * @param {number|null} [data.longitude]
 * @param {number|null} [data.distance]
 * @param {string} data.firstCall
 * @param {string} data.lastCall
 * @param {number} data.callCount
 * @returns {object} The upserted customer
 */
export function upsertCustomer(data) {
  const row = getStmts().upsert.get({
    phone: data.phone,
    name: data.name ?? null,
    postcode: data.postcode ?? null,
    houseNumber: data.houseNumber ?? null,
    street: data.street ?? null,
    town: data.town ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    distance: data.distance ?? null,
    firstCall: data.firstCall,
    lastCall: data.lastCall,
    callCount: data.callCount ?? 1,
  });

  return rowToCustomer(row);
}

/**
 * Update the address-related fields for an existing customer.
 *
 * @param {string} phone
 * @param {{ houseNumber?: string, street?: string, town?: string, postcode?: string, latitude?: number|null, longitude?: number|null, distance?: number|null }} addressData
 * @returns {void}
 */
export function updateAddress(phone, addressData) {
  const db = getDb();

  const fields = {
    postcode: addressData.postcode,
    house_number: addressData.houseNumber,
    street: addressData.street,
    town: addressData.town,
    latitude: addressData.latitude,
    longitude: addressData.longitude,
    distance: addressData.distance,
  };

  // Only include keys that were explicitly provided (not undefined)
  const updates = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([col]) => `${col} = @${col}`);

  if (updates.length === 0) return;

  const params = {
    phone,
    ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)),
  };

  db.prepare(
    `
    UPDATE customers SET ${updates.join(", ")} WHERE phone = @phone
  `,
  ).run(params);

  const line1 = addressData.line1 ?? addressData.street;
  if (line1 && typeof line1 === "string") {
    upsertCustomerAddress(phone, {
      houseNumber: addressData.houseNumber,
      line1,
      line2: addressData.line2,
      town: addressData.town,
      postcode: addressData.postcode,
      latitude: addressData.latitude,
      longitude: addressData.longitude,
    });
  }
}

/**
 * Atomic UPSERT that increments call_count if the phone already exists.
 * Returns the final customer record.
 *
 * @param {string} phone
 * @param {object} data - Initial data if customer is new
 * @returns {object}
 */
export function upsertAndIncrementCallCount(phone, data) {
  const now = new Date().toISOString();

  const row = getStmts().upsertIncrement.get({
    phone,
    name: data.name ?? null,
    postcode: data.postcode ?? null,
    houseNumber: data.houseNumber ?? null,
    street: data.street ?? null,
    town: data.town ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    distance: data.distance ?? null,
    now,
  });

  return rowToCustomer(row);
}

/**
 * Atomically increment call_count, update last_call, and return the updated row.
 * Returns null if the phone does not exist.
 *
 * @param {string} phone
 * @returns {object | null}
 */
export function incrementCallCountAndReturn(phone) {
  const row = getStmts().increment.get(new Date().toISOString(), phone);

  return row ? rowToCustomer(row) : null;
}

/**
 * Delete a customer by phone number.
 *
 * @param {string} phone
 * @returns {void}
 */
export function deleteByPhone(phone) {
  getStmts().deleteByPhone.run(phone);
}

/**
 * List known addresses for a customer (most recently used first).
 *
 * @param {string} phone
 * @returns {Array<object>}
 */
export function listAddressesByCustomer(phone) {
  return getStmts().listAddressesByCustomer.all(phone).map(rowToCustomerAddress);
}

/**
 * Upsert a normalized customer-linked address row.
 *
 * @param {string} phone
 * @param {{
 *   houseNumber?: string,
 *   line1?: string,
 *   line2?: string,
 *   town?: string,
 *   postcode?: string,
 *   latitude?: number|null,
 *   longitude?: number|null
 * }} address
 * @returns {object | null}
 */
export function upsertCustomerAddress(phone, address) {
  const line1 = typeof address?.line1 === "string" ? address.line1.trim() : "";
  if (!line1) return null;

  const now = new Date().toISOString();
  const row = getStmts().upsertCustomerAddress.get({
    customerPhone: phone,
    houseNumber: address?.houseNumber ?? null,
    line1,
    line2: address?.line2 ?? "",
    town: address?.town ?? null,
    postcode: address?.postcode ?? "",
    latitude: address?.latitude ?? null,
    longitude: address?.longitude ?? null,
    now,
  });

  return row ? rowToCustomerAddress(row) : null;
}
/**
 * Update a customer's name by their phone number.
 *
 * @param {string} phone
 * @param {string} name
 * @returns {void}
 */
export function updateName(phone, name) {
  const db = getDb();
  db.prepare("UPDATE customers SET name = ? WHERE phone = ?").run(name, phone);
}
