import { describe, it, expect, beforeEach, vi } from "vitest";
import { apiClient } from "../client";

describe("apiClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("submits orders to /orders/print and returns parsed payload", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ orderId: 12, printed: true }),
    } as Response);

    const result = await apiClient.submitOrder({
      orderType: "collection",
      items: [],
      payment: { method: "cash", amount: 10 },
      total: 10,
    } as any);

    expect(result).toEqual({ orderId: 12, printed: true });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/orders/print"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns void for 204 responses", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => ({}),
    } as Response);

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
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid payload",
          details: { field: "postcode" },
        },
      }),
    } as Response);

    await expect(apiClient.lookupPostcode("bad")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Invalid payload",
      details: { field: "postcode" },
      status: 400,
    });
  });

  it("falls back to UNKNOWN_ERROR when backend response is not json", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => {
        throw new Error("not json");
      },
    } as Response);

    await expect(apiClient.fetchOrders()).rejects.toMatchObject({
      code: "UNKNOWN_ERROR",
      message: "Internal Server Error",
      status: 500,
    });
  });
});
