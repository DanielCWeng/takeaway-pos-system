import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { telemetryRouter } from "../../src/domains/telemetry/telemetry.router.js";

vi.mock("../../src/infrastructure/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { logger } from "../../src/infrastructure/logger.js";

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.requestId = "req-telemetry";
  next();
});
app.use("/api/telemetry", telemetryRouter);

describe("telemetry router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts valid client-error payload and returns 204", async () => {
    const res = await request(app).post("/api/telemetry/client-error").send({
      type: "window.error",
      message: "Chunk load failed",
      source: "app.js",
      stack: "stack",
      route: "/orders",
      userAgent: "UA",
      time: "2026-04-04T12:00:00.000Z",
    });

    expect(res.status).toBe(204);
    expect(logger.error).toHaveBeenCalledWith(
      "Client runtime error reported",
      expect.objectContaining({
        requestId: "req-telemetry",
        client: true,
        errorType: "window.error",
        message: "Chunk load failed",
      }),
    );
  });

  it("rejects invalid payloads with validation envelope", async () => {
    const res = await request(app).post("/api/telemetry/client-error").send({
      type: "",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toHaveProperty("type");
    expect(res.body.error.details).toHaveProperty("message");
  });

  it("redacts phone-like values and customer path params in logs", async () => {
    const res = await request(app).post("/api/telemetry/client-error").send({
      type: "api.error",
      message: "GET /api/customers/07911123456 failed",
      source: "/customers/07911123456/export",
      stack: "Bearer abc.def.ghi 07911123456",
      route: "/customers/07911123456",
    });

    expect(res.status).toBe(204);
    expect(logger.error).toHaveBeenCalledWith(
      "Client runtime error reported",
      expect.objectContaining({
        message: "GET /api/customers/[redacted] failed",
        source: "/customers/[redacted]/export",
        route: "/customers/[redacted]",
      }),
    );
  });
});
