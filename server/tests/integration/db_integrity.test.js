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
    const insert = db.prepare(`
      INSERT INTO customers (phone, first_call, last_call, latitude, longitude)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Valid
    expect(() => insert.run("0123456789", "now", "now", 45, 45)).not.toThrow();

    // Invalid
    expect(() => insert.run("0123456780", "now", "now", 91, 0)).toThrow(/CHECK constraint failed/);
    expect(() => insert.run("0123456781", "now", "now", -91, 0)).toThrow(/CHECK constraint failed/);
  });

  it("rejects longitudes outside [-180, 180]", () => {
    const db = getDb();
    const insert = db.prepare(`
      INSERT INTO customers (phone, first_call, last_call, latitude, longitude)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Valid
    expect(() => insert.run("0223456789", "now", "now", 0, 179)).not.toThrow();

    // Invalid
    expect(() => insert.run("0223456780", "now", "now", 0, 181)).toThrow(/CHECK constraint failed/);
    expect(() => insert.run("0223456781", "now", "now", 0, -181)).toThrow(
      /CHECK constraint failed/,
    );
  });
});
