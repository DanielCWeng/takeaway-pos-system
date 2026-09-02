import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb, runMigrations, closeDb, getDb } from "../../src/infrastructure/db.js";

describe("db migrations", () => {
  beforeEach(() => {
    openDb(":memory:");
  });

  afterEach(() => {
    closeDb();
  });

  it("applies migrations in filename order and is idempotent", () => {
    runMigrations();
    runMigrations();

    const rows = getDb().prepare("SELECT filename FROM _migrations ORDER BY filename ASC").all();

    expect(rows.map((r) => r.filename)).toEqual([
      "001_initial_schema.sql",
      "003_call_logs.sql",
      "003_orders_customer_phone_index.sql",
      "004_call_sessions_and_customer_addresses.sql",
      "004_orders_client_order_id.sql",
      "005_order_status.sql",
      "006_eta_model.sql",
      "007_address_lookup_cache.sql",
    ]);

    const orderCount = getDb().prepare("SELECT COUNT(*) AS n FROM orders").get().n;
    const customerCount = getDb().prepare("SELECT COUNT(*) AS n FROM customers").get().n;
    const cacheCount = getDb().prepare("SELECT COUNT(*) AS n FROM address_lookup_cache").get().n;

    expect(orderCount).toBe(0);
    expect(customerCount).toBe(0);
    expect(cacheCount).toBe(0);

    const customerColumns = getDb()
      .prepare("PRAGMA table_info(customers)")
      .all()
      .map((r) => r.name);
    expect(customerColumns).toEqual(["phone", "name", "first_call", "last_call", "call_count"]);
    const historyColumns = getDb()
      .prepare("PRAGMA table_info(customer_addresses)")
      .all()
      .map((r) => r.name);
    expect(historyColumns).toContain("line1");
    expect(historyColumns).not.toContain("house_number");
  });
});
