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

describe("Orders API Integration", () => {
  const seededByDate = {
    jan1: null,
    jan2: null,
  };

  beforeAll(() => {
    openDb(":memory:");
    runMigrations();

    const db = getDb();
    const insert = db.prepare("INSERT INTO orders (data, archived_at) VALUES (?, ?)");
    const sample = {
      orderType: "collection",
      items: [{ name: "Seeded Chips", price: 3.5, quantity: 1 }],
      total: 3.5,
      payment: { method: "cash", amount: 3.5 },
    };

    seededByDate.jan1 = Number(
      insert.run(JSON.stringify(sample), "2026-01-01T12:00:00.000Z").lastInsertRowid,
    );
    seededByDate.jan2 = Number(
      insert.run(JSON.stringify(sample), "2026-01-02T12:00:00.000Z").lastInsertRowid,
    );
  });

  afterAll(() => {
    closeDb();
  });

  let createdId = null;
  let printedOrderId = null;

  it("POST /api/orders - creates a valid collection order", async () => {
    const payload = {
      orderType: "collection",
      items: [{ name: "Chips", price: 2.5, quantity: 2 }],
      subtotal: 5.0,
      total: 5.0,
      paymentMethod: "cash",
    };

    const res = await request(app).post("/api/orders").send(payload);

    expect(res.status).toBe(201);
    expect(res.body.order).toBeDefined();
    expect(res.body.order.id).toBeTypeOf("number");
    expect(res.body.order.data).toEqual({
      ...payload,
      items: payload.items.map((item) => ({
        modifiers: [],
        hidePrice: false,
        hideQuantity: false,
        ...item,
      })),
    });

    createdId = res.body.order.id;
  });

  it("POST /api/orders/print - archives and returns printed flag", async () => {
    const payload = {
      order: {
        orderType: "collection",
        items: [{ name: "Spring Roll", price: 3.0, quantity: 1 }],
        total: 3.0,
        payment: { method: "cash", amount: 3.0 },
      },
      payment: { method: "cash", amount: 3.0 },
    };

    const res = await request(app).post("/api/orders/print").send(payload);

    expect(res.status).toBe(200);
    expect(res.body.orderId).toBeTypeOf("number");
    expect(res.body.printed).toBeTypeOf("boolean");

    printedOrderId = res.body.orderId;
  });

  it("POST /api/orders/print - returns 400 if payment is missing from both root and order payload", async () => {
    const payload = {
      order: {
        orderType: "collection",
        items: [{ name: "Salt & Pepper Chips", price: 4.5, quantity: 1 }],
        total: 4.5,
      },
    };

    const res = await request(app).post("/api/orders/print").send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.payment).toEqual(["Payment details are required"]);
  });

  it("POST /api/orders/:id/reprint - returns printed flag (best-effort)", async () => {
    const res = await request(app).post(`/api/orders/${printedOrderId}/reprint`);

    expect(res.status).toBe(200);
    expect(res.body.printed).toBeTypeOf("boolean");
  });

  it("POST /api/orders - returns 400 for a delivery order without an address", async () => {
    const payload = {
      orderType: "delivery",
      items: [{ name: "Burger", price: 6 }],
      customerInfo: { name: "Bob" }, // Missing address/postcode
    };

    const res = await request(app).post("/api/orders").send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toMatch(/require a valid customer address/);
  });

  it("POST /api/orders - returns 400 for an empty items array", async () => {
    const payload = {
      orderType: "collection",
      items: [],
    };

    const res = await request(app).post("/api/orders").send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /api/orders - lists archived orders", async () => {
    const res = await request(app).get("/api/orders");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(res.body.orders.length).toBeGreaterThanOrEqual(1);
    expect(res.body.orders.some((o) => o.id === createdId)).toBe(true);
  });

  it("GET /api/orders?date=YYYY-MM-DD - filters by archive date", async () => {
    const res = await request(app).get("/api/orders").query({ date: "2026-01-01" });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(res.body.orders.some((o) => o.id === seededByDate.jan1)).toBe(true);
    expect(res.body.orders.some((o) => o.id === seededByDate.jan2)).toBe(false);
  });

  it("GET /api/orders/:id - fetches a single order", async () => {
    const res = await request(app).get(`/api/orders/${createdId}`);

    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe(createdId);
  });

  it("GET /api/orders/:id - returns 404 for unknown order", async () => {
    const res = await request(app).get("/api/orders/9999");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("GET /api/orders/:id - returns 400 for invalid ID format", async () => {
    const res = await request(app).get("/api/orders/abc");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("DELETE /api/orders/:id - deletes an order", async () => {
    const delRes = await request(app).delete(`/api/orders/${createdId}`);
    expect(delRes.status).toBe(204);

    const getRes = await request(app).get(`/api/orders/${createdId}`);
    expect(getRes.status).toBe(404);
  });

  it("DELETE /api/orders?date=YYYY-MM-DD - deletes only orders for the provided date", async () => {
    const deleteRes = await request(app).delete("/api/orders").query({ date: "2026-01-01" });
    expect(deleteRes.status).toBe(204);

    const jan1 = await request(app).get("/api/orders").query({ date: "2026-01-01" });
    const jan2 = await request(app).get("/api/orders").query({ date: "2026-01-02" });

    expect(jan1.status).toBe(200);
    expect(jan1.body.orders.some((o) => o.id === seededByDate.jan1)).toBe(false);
    expect(jan2.status).toBe(200);
    expect(jan2.body.orders.some((o) => o.id === seededByDate.jan2)).toBe(true);
  });

  it("POST /api/orders/:id/reprint - returns 404 for unknown archived order", async () => {
    const res = await request(app).post(`/api/orders/${createdId}/reprint`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
