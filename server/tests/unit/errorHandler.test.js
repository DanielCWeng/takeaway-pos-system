import { describe, it, expect, vi, beforeEach } from "vitest";
import { errorHandler } from "../../src/shared/middleware/errorHandler.js";
import {
  AppError,
  ValidationError,
  NotFoundError,
  NotImplementedError,
  ExternalServiceError,
} from "../../src/shared/errors.js";

vi.mock("../../src/infrastructure/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { logger } from "../../src/infrastructure/logger.js";

function makeRes() {
  return {
    status: vi.fn(function status() {
      return this;
    }),
    json: vi.fn(function json() {
      return this;
    }),
  };
}

describe("errorHandler middleware", () => {
  const req = {
    requestId: "req-1",
    method: "POST",
    path: "/api/test",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps ValidationError to 400 envelope", () => {
    const res = makeRes();

    errorHandler(new ValidationError("Bad payload", { field: "x" }), req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: "VALIDATION_ERROR",
        message: "Bad payload",
        details: { field: "x" },
      },
    });
  });

  it("maps NotFoundError to 404 envelope", () => {
    const res = makeRes();

    errorHandler(new NotFoundError("Missing", { id: 1 }), req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: "NOT_FOUND",
        message: "Missing",
        details: { id: 1 },
      },
    });
  });

  it("maps NotImplementedError to 501 envelope", () => {
    const res = makeRes();

    errorHandler(new NotImplementedError("Not built yet"), req, res);

    expect(res.status).toHaveBeenCalledWith(501);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Not built yet",
        details: {},
      },
    });
  });

  it("maps AppError codes via status map", () => {
    const res = makeRes();

    errorHandler(new ExternalServiceError("API down", { upstream: "x" }), req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: "EXTERNAL_SERVICE_ERROR",
        message: "API down",
        details: { upstream: "x" },
      },
    });
    expect(logger.warn).toHaveBeenCalled();
  });

  it("maps unknown errors to generic 500 and logs at error level", () => {
    const res = makeRes();

    errorHandler(new Error("boom"), req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    });
    expect(logger.error).toHaveBeenCalledWith(
      "Unhandled error in request",
      expect.objectContaining({
        requestId: "req-1",
        method: "POST",
        path: "/api/test",
      }),
    );
  });

  it("maps unknown AppError codes to 500", () => {
    const res = makeRes();

    errorHandler(new AppError("unknown app", "SOME_NEW_CODE", { a: 1 }), req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: "SOME_NEW_CODE",
        message: "unknown app",
        details: { a: 1 },
      },
    });
  });
});
