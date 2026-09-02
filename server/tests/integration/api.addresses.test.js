import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { apiRouter, globalErrorHandler } from "../../src/api/router.js";
import { config } from "../../src/config/index.js";
import { closeDb, getDb, openDb, runMigrations } from "../../src/infrastructure/db.js";

const app = express();
app.use(express.json());
app.use("/api", apiRouter);
app.use(globalErrorHandler);

function providerResponse(line1 = "10 Copeland Avenue") {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({
      latitude: 52.91,
      longitude: -1.25,
      addresses: [{ line_1: line1, line_2: "", town_or_city: "Nottingham" }],
    }),
  };
}

describe("addresses API", () => {
  beforeAll(() => {
    openDb(":memory:");
    runMigrations();
  });

  beforeEach(() => {
    getDb().prepare("DELETE FROM address_lookup_cache").run();
    config.address.apiKey = "test-key";
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => vi.unstubAllGlobals());
  afterAll(() => closeDb());

  it("returns 400 for malformed syntax without calling getAddress", async () => {
    const response = await request(app).post("/api/addresses/lookup").send({ postcode: "bad" });
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("calls getAddress once, persists the result, then serves the cache", async () => {
    fetch.mockResolvedValue(providerResponse());

    const first = await request(app).post("/api/addresses/lookup").send({ postcode: "ng98dq" });
    fetch.mockRejectedValue(new Error("offline"));
    const second = await request(app).post("/api/addresses/lookup").send({ postcode: "NG9 8DQ" });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(fetch).toHaveBeenCalledOnce();
    expect(first.body.addresses[0].line1).toBe("10 Copeland Avenue");
    expect(first.body.addresses[0].line1).not.toBe("Saville Close");
    expect(getDb().prepare("SELECT COUNT(*) AS count FROM address_lookup_cache").get().count).toBe(
      1,
    );
  });

  it("returns 404 and does not cache a nonexistent postcode", async () => {
    fetch.mockResolvedValue({ ok: false, status: 404 });
    const response = await request(app).post("/api/addresses/lookup").send({ postcode: "NG9 8DQ" });
    expect(response.status).toBe(404);
    expect(getDb().prepare("SELECT COUNT(*) AS count FROM address_lookup_cache").get().count).toBe(
      0,
    );
  });

  it("returns 502 and does not cache an unavailable provider", async () => {
    fetch.mockRejectedValue(new Error("offline"));
    const response = await request(app).post("/api/addresses/lookup").send({ postcode: "NG9 8DQ" });
    expect(response.status).toBe(502);
    expect(getDb().prepare("SELECT COUNT(*) AS count FROM address_lookup_cache").get().count).toBe(
      0,
    );
  });

  it.each([
    ["rate limiting", () => ({ ok: false, status: 429 })],
    ["provider 5xx", () => ({ ok: false, status: 503 })],
    [
      "malformed JSON",
      () => ({
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(new SyntaxError("Unexpected token")),
      }),
    ],
    [
      "malformed response shape",
      () => ({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ latitude: 52.91, longitude: -1.25, addresses: {} }),
      }),
    ],
    [
      "invalid coordinates",
      () => ({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          latitude: 91,
          longitude: -1.25,
          addresses: [{ line_1: "10 Copeland Avenue" }],
        }),
      }),
    ],
  ])("returns 502 and does not cache %s", async (_case, responseFactory) => {
    fetch.mockResolvedValue(responseFactory());

    const response = await request(app).post("/api/addresses/lookup").send({ postcode: "NG9 8DQ" });

    expect(response.status).toBe(502);
    expect(getDb().prepare("SELECT COUNT(*) AS count FROM address_lookup_cache").get().count).toBe(
      0,
    );
  });

  it("treats corrupt cache data as a miss and replaces it after provider success", async () => {
    getDb()
      .prepare(
        `INSERT INTO address_lookup_cache
           (postcode, addresses_json, latitude, longitude, fetched_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run("NG9 8DQ", '[{"town":"Missing line one"}]', 52.91, -1.25, "2026-01-01");
    fetch.mockResolvedValue(providerResponse("12 Copeland Avenue"));

    const response = await request(app).post("/api/addresses/lookup").send({ postcode: "NG9 8DQ" });

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledOnce();
    expect(response.body.addresses[0].line1).toBe("12 Copeland Avenue");
  });

  it("does not expose the retired verification endpoint", async () => {
    const response = await request(app).post("/api/addresses/verify").send({});
    expect(response.status).toBe(404);
  });
});
