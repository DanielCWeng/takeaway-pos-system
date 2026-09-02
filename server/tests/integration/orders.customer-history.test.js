import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, getDb, openDb, runMigrations } from "../../src/infrastructure/db.js";

vi.mock("../../src/hardware/printer.js", () => ({
  printReceipt: vi.fn().mockResolvedValue({ printed: true }),
}));

import { printReceipt } from "../../src/hardware/printer.js";
import * as service from "../../src/domains/orders/orders.service.js";

const baseCustomer = {
  phone: "07911123456",
  name: "Alice",
  line1: "10 Copeland Avenue",
  line2: "",
  town: "Nottingham",
  postcode: "NG9 8DQ",
  latitude: null,
  longitude: null,
};

function order(orderType = "delivery") {
  return {
    orderType,
    items: [{ name: "Chips", price: 2, quantity: 1 }],
    customerInfo: { ...baseCustomer },
  };
}

describe("order/customer history transaction", () => {
  beforeAll(() => {
    openDb(":memory:");
    runMigrations();
  });

  beforeEach(() => {
    const db = getDb();
    db.exec(`
      DROP TRIGGER IF EXISTS reject_order_insert;
      DROP TRIGGER IF EXISTS reject_history_insert;
      DELETE FROM order_status;
      DELETE FROM orders;
      DELETE FROM customer_addresses;
      DELETE FROM customers;
    `);
    vi.clearAllMocks();
  });

  afterAll(() => closeDb());

  it("does not leave customer or history rows when order persistence fails", () => {
    getDb().exec(`
      CREATE TRIGGER reject_order_insert
      BEFORE INSERT ON orders
      BEGIN
        SELECT RAISE(ABORT, 'forced order failure');
      END;
    `);

    expect(() => service.createOrder(order())).toThrow("forced order failure");
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM orders").get().n).toBe(0);
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM customers").get().n).toBe(0);
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM customer_addresses").get().n).toBe(0);
  });

  it("rolls the order and customer identity back when history synchronization fails", () => {
    getDb().exec(`
      CREATE TRIGGER reject_history_insert
      BEFORE INSERT ON customer_addresses
      BEGIN
        SELECT RAISE(ABORT, 'forced history failure');
      END;
    `);

    expect(() => service.createOrder(order())).toThrow("forced history failure");
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM orders").get().n).toBe(0);
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM customers").get().n).toBe(0);
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM customer_addresses").get().n).toBe(0);
    getDb().exec("DROP TRIGGER reject_history_insert");
  });

  it("does not create address history from a collection order", () => {
    service.createOrder(order("collection"));

    expect(getDb().prepare("SELECT COUNT(*) AS n FROM orders").get().n).toBe(1);
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM customers").get().n).toBe(1);
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM customer_addresses").get().n).toBe(0);
  });

  it("makes a duplicate print retry a no-op for history, status, and printing", async () => {
    const clientOrderId = "550e8400-e29b-41d4-a716-446655440000";

    const first = await service.printAndArchiveOrder(order(), clientOrderId);
    const second = await service.printAndArchiveOrder(order(), clientOrderId);

    expect(second.orderId).toBe(first.orderId);
    expect(second.created).toBe(false);
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM orders").get().n).toBe(1);
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM order_status").get().n).toBe(1);
    expect(getDb().prepare("SELECT usage_count FROM customer_addresses").get().usage_count).toBe(1);
    expect(printReceipt).toHaveBeenCalledOnce();
  });
});
