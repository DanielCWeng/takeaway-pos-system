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
      "002_coordinate_integrity.sql",
      "003_orders_customer_phone_index.sql",
    ]);

    const orderCount = getDb().prepare("SELECT COUNT(*) AS n FROM orders").get().n;
    const customerCount = getDb().prepare("SELECT COUNT(*) AS n FROM customers").get().n;

    expect(orderCount).toBe(0);
    expect(customerCount).toBe(0);
  });
});
