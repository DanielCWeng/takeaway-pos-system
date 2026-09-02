import { getDb } from "../../infrastructure/db.js";

function rowToCustomer(row) {
  return {
    phone: row.phone,
    name: row.name ?? null,
    firstCall: row.first_call,
    lastCall: row.last_call,
    callCount: row.call_count,
  };
}

function rowToAddress(row) {
  return {
    id: row.id,
    customerPhone: row.customer_phone,
    line1: row.line1,
    line2: row.line2 ?? "",
    town: row.town ?? "",
    postcode: row.postcode ?? "",
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    usageCount: row.usage_count,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function findByPhone(phone) {
  const row = getDb().prepare("SELECT * FROM customers WHERE phone = ?").get(phone);
  return row ? rowToCustomer(row) : null;
}

export function upsertCustomer(data) {
  const row = getDb()
    .prepare(
      `INSERT INTO customers (phone, name, first_call, last_call, call_count)
       VALUES (@phone, @name, @firstCall, @lastCall, @callCount)
       ON CONFLICT(phone) DO UPDATE SET
         name = COALESCE(excluded.name, customers.name),
         last_call = excluded.last_call,
         call_count = excluded.call_count
       RETURNING *`,
    )
    .get({
      phone: data.phone,
      name: data.name ?? null,
      firstCall: data.firstCall,
      lastCall: data.lastCall,
      callCount: data.callCount ?? 1,
    });
  return rowToCustomer(row);
}

export function upsertAndIncrementCallCount(phone, data = {}) {
  const now = new Date().toISOString();
  const row = getDb()
    .prepare(
      `INSERT INTO customers (phone, name, first_call, last_call, call_count)
       VALUES (@phone, @name, @now, @now, 1)
       ON CONFLICT(phone) DO UPDATE SET
         name = COALESCE(excluded.name, customers.name),
         last_call = excluded.last_call,
         call_count = customers.call_count + 1
       RETURNING *`,
    )
    .get({ phone, name: data.name ?? null, now });
  return rowToCustomer(row);
}

export function incrementCallCountAndReturn(phone) {
  const row = getDb()
    .prepare(
      `UPDATE customers SET call_count = call_count + 1, last_call = ?
       WHERE phone = ? RETURNING *`,
    )
    .get(new Date().toISOString(), phone);
  return row ? rowToCustomer(row) : null;
}

export function updateName(phone, name) {
  getDb().prepare("UPDATE customers SET name = ? WHERE phone = ?").run(name, phone);
}

export function deleteByPhone(phone) {
  getDb().prepare("DELETE FROM customers WHERE phone = ?").run(phone);
}

export function listAddressesByCustomer(phone) {
  return getDb()
    .prepare(
      `SELECT * FROM customer_addresses WHERE customer_phone = ?
       ORDER BY last_used_at DESC, id DESC`,
    )
    .all(phone)
    .map(rowToAddress);
}

export function upsertCustomerAddress(phone, address) {
  const line1 = typeof address?.line1 === "string" ? address.line1.trim() : "";
  if (!line1) return null;
  const now = new Date().toISOString();
  const row = getDb()
    .prepare(
      `INSERT INTO customer_addresses (
         customer_phone, line1, line2, town, postcode, latitude, longitude,
         usage_count, last_used_at, created_at, updated_at
       ) VALUES (
         @customerPhone, @line1, @line2, @town, @postcode, @latitude, @longitude,
         1, @now, @now, @now
       )
       ON CONFLICT(customer_phone, line1, line2, postcode) DO UPDATE SET
         town = excluded.town,
         latitude = excluded.latitude,
         longitude = excluded.longitude,
         usage_count = customer_addresses.usage_count + 1,
         last_used_at = excluded.last_used_at,
         updated_at = excluded.updated_at
       RETURNING *`,
    )
    .get({
      customerPhone: phone,
      line1,
      line2: address.line2?.trim() ?? "",
      town: address.town?.trim() ?? "",
      postcode: address.postcode?.trim() ?? "",
      latitude: Number.isFinite(address.latitude) ? address.latitude : null,
      longitude: Number.isFinite(address.longitude) ? address.longitude : null,
      now,
    });
  return row ? rowToAddress(row) : null;
}
