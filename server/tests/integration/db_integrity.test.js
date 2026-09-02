import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { openDb, closeDb, getDb } from "../../src/infrastructure/db.js";
import path from "path";
import fs from "fs";

describe("Database Integrity (Phase 2 Hardening)", () => {
  const testDbPath = path.join(process.cwd(), "data", "test_integrity.db");

  beforeAll(async () => {
    // Ensure data dir exists
    if (!fs.existsSync(path.dirname(testDbPath))) {
      fs.mkdirSync(path.dirname(testDbPath), { recursive: true });
    }
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    openDb(testDbPath);
    // runMigrations handles bootstrapping the schema
    const { runMigrations } = await import("../../src/infrastructure/db.js");
    runMigrations();
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it("rejects latitudes outside [-90, 90]", () => {
    const db = getDb();
    db.prepare(`INSERT INTO customers (phone, first_call, last_call) VALUES (?, ?, ?)`).run(
      "0123456789",
      "now",
      "now",
    );
    const insert = db.prepare(`
      INSERT INTO customer_addresses
        (customer_phone, line1, postcode, latitude, longitude, last_used_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Valid
    expect(() =>
      insert.run("0123456789", "Valid", "NG1 1AA", 45, 45, "now", "now", "now"),
    ).not.toThrow();

    // Invalid
    expect(() =>
      insert.run("0123456789", "Too north", "NG1 1AA", 91, 0, "now", "now", "now"),
    ).toThrow(/CHECK constraint failed/);
    expect(() =>
      insert.run("0123456789", "Too south", "NG1 1AA", -91, 0, "now", "now", "now"),
    ).toThrow(/CHECK constraint failed/);
  });

  it("rejects longitudes outside [-180, 180]", () => {
    const db = getDb();
    const insert = db.prepare(`
      INSERT INTO address_lookup_cache (postcode, addresses_json, latitude, longitude, fetched_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Valid
    expect(() => insert.run("NG1 1AA", '[{"line1":"Valid"}]', 0, 179, "now")).not.toThrow();

    // Invalid
    expect(() => insert.run("NG1 1AB", "[]", 0, 181, "now")).toThrow(/CHECK constraint failed/);
    expect(() => insert.run("NG1 1AC", "[]", 0, -181, "now")).toThrow(/CHECK constraint failed/);
  });
});
