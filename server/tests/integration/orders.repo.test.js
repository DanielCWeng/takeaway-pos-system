import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { openDb, closeDb, runMigrations, getDb } from "../../src/infrastructure/db.js";
import { AppError } from "../../src/shared/errors.js";
import * as repo from "../../src/domains/orders/orders.repo.js";

describe("Orders Repository (Integration)", () => {
  beforeAll(() => {
    // Open a real in-memory SQLite database
    openDb(":memory:");
    runMigrations();
  });

  beforeEach(() => {
    getDb().prepare("DELETE FROM orders").run();
  });

  afterAll(() => {
    closeDb();
  });

  it("creates an order, generates an ID via AUTOINCREMENT, and retrieves it", () => {
    const data = { orderType: "collection", items: [{ name: "Chips", price: 2 }] };

    const created = repo.createOrder({ data });

    expect(created.id).toBeTypeOf("number");
    expect(created.id).toBeGreaterThan(0);
    expect(created.data).toEqual(data);
    expect(created.archivedAt).toBeTypeOf("string");

    const fetched = repo.findOrderById(created.id);
    expect(fetched).toEqual(created);
  });

  it("returns null for an unknown ID", () => {
    const fetched = repo.findOrderById(99999);
    expect(fetched).toBeNull();
  });

  it("lists all orders newest first", () => {
    const data1 = { note: "first" };
    const data2 = { note: "second" };

    repo.createOrder({ data: data1, archivedAt: "2026-01-01T10:00:00Z" });
    repo.createOrder({ data: data2, archivedAt: "2026-01-01T11:00:00Z" });

    const all = repo.findAllOrders();
    expect(all.length).toBeGreaterThanOrEqual(2);

    // Verify ordering by archived_at DESC (the second order is newer)
    const d1Index = all.findIndex((o) => o.data.note === "first");
    const d2Index = all.findIndex((o) => o.data.note === "second");

    expect(d2Index).toBeLessThan(d1Index);
  });

  it("deletes an order", () => {
    const created = repo.createOrder({ data: { note: "to delete" } });
    expect(repo.findOrderById(created.id)).not.toBeNull();

    repo.deleteOrder(created.id);

    expect(repo.findOrderById(created.id)).toBeNull();
  });

  it("properly serialises JSON in the data column", () => {
    const complexData = { nested: { array: [1, 2, 3] }, bool: true };
    const created = repo.createOrder({ data: complexData });

    // Read directly from DB to verify it's stored as TEXT
    const db = getDb();
    const rawRow = db.prepare("SELECT data FROM orders WHERE id = ?").get(created.id);
    expect(typeof rawRow.data).toBe("string");
    expect(JSON.parse(rawRow.data)).toEqual(complexData);

    // Read via repo to verify deserialisation
    const fetched = repo.findOrderById(created.id);
    expect(fetched.data).toEqual(complexData);
  });

  it("limits list results to 500 rows", () => {
    const db = getDb();
    // Insert 505 orders directly to bypass application logic if needed
    const stmt = db.prepare("INSERT INTO orders (data, archived_at) VALUES (?, ?)");
    for (let i = 0; i < 505; i++) {
      stmt.run(JSON.stringify({ i }), new Date().toISOString());
    }

    const all = repo.findAllOrders();
    expect(all.length).toBe(500);
  });

  it("throws AppError when database row contains corrupted JSON data", () => {
    const db = getDb();
    // Manually insert corrupted JSON
    const result = db
      .prepare("INSERT INTO orders (data, archived_at) VALUES (?, ?)")
      .run("NOT_JSON", new Date().toISOString());
    const id = Number(result.lastInsertRowid);

    expect(() => repo.findOrderById(id)).toThrow(/corrupted data/);
    expect(() => repo.findOrderById(id)).toThrow(AppError);
  });

  describe("findByDate / deleteByDate", () => {
    it("should find orders by date string", () => {
      const date = "2026-03-27";
      const orderId = repo.createOrder({
        data: { total: 100 },
        archivedAt: `${date}T10:00:00Z`,
      }).id;
      repo.createOrder({ data: { total: 50 }, archivedAt: `2026-03-26T10:00:00Z` });

      const orders = repo.findOrdersByDate(date);
      expect(orders).toHaveLength(1);
      expect(orders[0].id).toBe(orderId);
    });

    it("should delete orders by date string", () => {
      const date = "2026-03-27";
      repo.createOrder({ data: { total: 100 }, archivedAt: `${date}T10:00:00Z` });
      repo.createOrder({ data: { total: 50 }, archivedAt: `2026-03-26T10:00:00Z` });

      repo.deleteOrdersByDate(date);
      const remaining = repo.findAllOrders();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].archivedAt).toContain("2026-03-26");
    });
  });
});
