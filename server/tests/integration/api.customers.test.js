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
});
