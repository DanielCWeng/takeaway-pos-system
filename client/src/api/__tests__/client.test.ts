import { describe, it, expect, beforeEach, vi } from "vitest";
vi.mock("../../lib/runtime-monitor", () => ({
  reportClientError: vi.fn(),
}));

import { apiClient } from "../client";
import { reportClientError } from "../../lib/runtime-monitor";
import type { FullOrder } from "../../types";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("apiClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("submits orders to /orders/print and returns parsed payload", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ orderId: 12, printed: true }));

    const result = await apiClient.submitOrder({
      orderType: "collection",
      items: [],
      payment: { method: "cash", amount: 10 },
      total: 10,
    } as FullOrder);

    expect(result).toEqual({ orderId: 12, printed: true });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/orders/print"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns void for 204 responses", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    const result = await apiClient.deleteOrdersByDate("2026-04-04");
    expect(result).toEqual({});
  });

  it("maps fetch rejections to NETWORK_ERROR", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("offline"));

    await expect(apiClient.fetchOrders()).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      message: "offline",
    });
  });

  it("maps backend error envelope code/details/status", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid payload",
            details: { field: "postcode" },
          },
        },
        { status: 400, statusText: "Bad Request" },
      ),
    );

    await expect(apiClient.lookupPostcode("bad")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Invalid payload",
      details: { field: "postcode" },
      status: 400,
    });
    expect(reportClientError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "api.error",
        source: "/addresses/lookup",
      }),
    );
  });

  it("falls back to UNKNOWN_ERROR when backend response is not json", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response("not-json", { status: 500, statusText: "Internal Server Error" }),
      );

    await expect(apiClient.fetchOrders()).rejects.toMatchObject({
      code: "UNKNOWN_ERROR",
      message: "Internal Server Error",
      status: 500,
    });
  });

  it("sends redacted telemetry for sensitive GDPR endpoints", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "FORBIDDEN",
            message: "Admin authentication required",
          },
        },
        { status: 403, statusText: "Forbidden" },
      ),
    );

    await expect(apiClient.exportCustomer("07911123456")).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
    expect(reportClientError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "api.error",
        source: "/customers/[redacted]/export",
      }),
    );
  });

  it("posts dial commands to /calls/dial", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true, phone: "07123456789" }));

    const result = await apiClient.dial("07 123 456 789");

    expect(result).toEqual({ ok: true, phone: "07123456789" });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/calls/dial"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});
