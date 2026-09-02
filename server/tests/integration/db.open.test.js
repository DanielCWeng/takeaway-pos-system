import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { closeDb, getDb, openDb, runMigrations } from "../../src/infrastructure/db.js";

describe("database startup", () => {
  let tempRoot;

  afterEach(() => {
    closeDb();
    if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  });

  it("creates a missing parent directory for a fresh filesystem database", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "pos-db-open-"));
    const dbPath = join(tempRoot, "nested", "data", "orders.db");

    openDb(dbPath);
    runMigrations();

    expect(existsSync(dbPath)).toBe(true);
  });

  it("continues to support an in-memory database", () => {
    openDb(":memory:");
    runMigrations();
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM _migrations").get().n).toBeGreaterThan(0);
  });
});
