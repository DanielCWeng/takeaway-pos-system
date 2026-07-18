import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import { openDb, closeDb, runMigrations, getDb } from "../../src/infrastructure/db.js";
import { apiRouter, globalErrorHandler } from "../../src/api/router.js";

// Setup an Express app just for this test suite
const app = express();
app.use(express.json());
app.use("/api", apiRouter);
app.use(globalErrorHandler);
const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN ?? "";

describe("Customers API Integration", () => {
  beforeAll(() => {
    openDb(":memory:");
    runMigrations();

    // Seed one customer so we have something to read/update
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(
      `
      INSERT INTO customers (phone, name, first_call, last_call, call_count)
      VALUES ('07911123456', 'Alice', ?, ?, 1)
    `,
    ).run(now, now);

    db.prepare("INSERT INTO orders (data, archived_at) VALUES (?, ?)").run(
      JSON.stringify({
        orderType: "delivery",
        customerInfo: {
          name: "Alice",
          phone: "07911123456",
          address: "42 Main Street, Beeston",
          houseNumber: "42",
          street: "Main Street",
          town: "Beeston",
          postcode: "NG9 8GF",
          latitude: 52.95,
          longitude: -1.21,
          deliveryInstructions: "Blue door",
        },
        items: [{ name: "Chips", price: 2.5, quantity: 1 }],
        total: 2.5,
        payment: { method: "cash", amount: 2.5 },
      }),
      "2026-01-03T12:00:00.000Z",
    );
  });

  afterAll(() => {
    closeDb();
  });

  it("GET /api/customers/:phone — returns 200 and customer for known phone", async () => {
    const res = await request(app).get("/api/customers/07911123456");

    expect(res.status).toBe(200);
    expect(res.body.customer.phone).toBe("07911123456");
    expect(res.body.customer.name).toBe("Alice");
    expect(res.body.customer.callCount).toBe(1);
    expect(res.body.customer.latitude).toBeNull();
  });

  it("GET /api/customers/:phone — returns 404 for unknown phone", async () => {
    const res = await request(app).get("/api/customers/00000000000");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("GET /api/customers/:phone — returns 400 for invalid phone format", async () => {
    const res = await request(app).get("/api/customers/123"); // Too short

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toMatch(/between 10 and 13 digits/);
  });

  it("POST /api/customers/:phone/address — returns 400 for invalid body", async () => {
    const res = await request(app)
      .post("/api/customers/07911123456/address")
      .send({ distance: "two miles" }); // Distance must be numeric

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /api/customers/:phone/address — updates and returns 200", async () => {
    const payload = {
      houseNumber: "42",
      postcode: "W1A 1AA",
      distance: 2.5,
    };

    const res = await request(app).post("/api/customers/07911123456/address").send(payload);

    expect(res.status).toBe(200);
    expect(res.body.customer.phone).toBe("07911123456");
    expect(res.body.customer.houseNumber).toBe("42");
    expect(res.body.customer.postcode).toBe("W1A 1AA");
    expect(res.body.customer.distance).toBe(2.5);

    // Name should not have been cleared by the update
    expect(res.body.customer.name).toBe("Alice");
  });

  it("POST /api/customers/:phone/address — returns 404 for unknown customer", async () => {
    const res = await request(app)
      .post("/api/customers/00000000000/address")
      .send({ houseNumber: "1" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("GET /api/customers/:phone/export — requires admin auth", async () => {
    const res = await request(app).get("/api/customers/07911123456/export");

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("GET /api/customers/:phone/export — returns customer + order history for authorized admin", async () => {
    const res = await request(app)
      .get("/api/customers/07911123456/export")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.customer.phone).toBe("07911123456");
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(res.body.orders.length).toBeGreaterThanOrEqual(1);
    expect(res.body.orders[0].archivedAt).toBeTypeOf("string");
    expect(res.body.exportedAt).toBeTypeOf("string");
  });

  it("DELETE /api/customers/:phone — requires admin auth", async () => {
    const res = await request(app).delete("/api/customers/07911123456");

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("DELETE /api/customers/:phone — deletes profile and anonymizes order PII for authorized admin", async () => {
    const res = await request(app)
      .delete("/api/customers/07911123456")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.ordersAnonymized).toBeGreaterThanOrEqual(1);

    const lookupAfterDelete = await request(app).get("/api/customers/07911123456");
    expect(lookupAfterDelete.status).toBe(404);

    const row = getDb().prepare("SELECT data FROM orders LIMIT 1").get();
    const order = JSON.parse(row.data);
    expect(order.customerInfo.name).toBe("ANONYMISED");
    expect(order.customerInfo.phone).toMatch(/^ANON-/);
    expect(order.customerInfo.address).toBe("REMOVED");
    expect(order.customerInfo.town).toBe("REMOVED");
    expect(order.customerInfo.latitude).toBeNull();
    expect(order.customerInfo.longitude).toBeNull();
    expect(order.customerInfo.deliveryInstructions).toBe("REMOVED");
    expect(order.customerInfo.isAnonymised).toBe(true);
  });

  it("GET /api/customers/:phone/export — returns 400 for anonymised identifiers", async () => {
    const row = getDb().prepare("SELECT data FROM orders LIMIT 1").get();
    const order = JSON.parse(row.data);
    const anonymisedPhone = order.customerInfo.phone;

    const res = await request(app)
      .get(`/api/customers/${anonymisedPhone}/export`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toMatch(/anonymised/i);
  });
});
