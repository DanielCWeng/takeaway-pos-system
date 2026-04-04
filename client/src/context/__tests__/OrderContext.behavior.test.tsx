import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ReactNode } from "react";
import { CallerProvider } from "../CallerContext";
import { OrderProvider, useOrder } from "../OrderContext";
import { apiClient } from "../../api/client";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url = "";
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <CallerProvider socketFactory={(url) => new MockWebSocket(url) as unknown as WebSocket}>
      <OrderProvider>{children}</OrderProvider>
    </CallerProvider>
  );
}

describe("OrderContext behaviors", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("supports update/duplicate/setFoc/remove item mutation paths", () => {
    const { result } = renderHook(() => useOrder(), { wrapper: Providers });

    act(() => {
      result.current.addItem({
        id: "PARENT",
        name: "Set Meal",
        price: 10,
        uniqueId: "parent-1",
      });
      result.current.addItem(
        { id: "CHILD", name: "Included Rice", price: 0, uniqueId: "child-1" },
        { parentId: "parent-1", isIncluded: true },
      );
    });

    expect(result.current.order.items).toHaveLength(2);

    act(() => {
      result.current.duplicateItem(0);
      result.current.updateItem(0, (item) => ({ ...item, name: "Updated Set Meal" }));
      result.current.setFocItem(0);
    });

    expect(result.current.order.items[0].quantity).toBe(2);
    expect(result.current.order.items[0].name).toContain("FOC");
    expect(result.current.order.items[0].price).toBe(0);

    act(() => {
      result.current.removeItem(0);
    });

    expect(result.current.order.items).toHaveLength(0);
  });

  it("restores persisted draft and ignores mismatched draft versions", () => {
    window.localStorage.setItem(
      "pos.order-draft.v1",
      JSON.stringify({
        version: 1,
        activeOrderIndex: 0,
        orders: [
          {
            id: 9,
            clientOrderId: "draft-1",
            orderType: "delivery",
            items: [{ id: "A1", name: "Draft Item", price: 5, quantity: 2, uniqueId: "u1" }],
            payment: { method: "cash", amount: 0 },
            total: 10,
          },
        ],
      }),
    );

    const restored = renderHook(() => useOrder(), { wrapper: Providers });
    expect(restored.result.current.order.id).toBe(9);
    expect(restored.result.current.order.items[0].name).toBe("Draft Item");

    restored.unmount();
    window.localStorage.setItem(
      "pos.order-draft.v1",
      JSON.stringify({ version: 999, orders: [{ id: 44, items: [{ name: "Old" }] }] }),
    );

    const mismatch = renderHook(() => useOrder(), { wrapper: Providers });
    expect(mismatch.result.current.order.id).toBe(1);
    expect(mismatch.result.current.order.items).toHaveLength(0);
  });

  it("queues retryable print failures", async () => {
    const queueableError = new Error("offline");
    const submitSpy = vi.spyOn(apiClient, "submitOrder");

    const { result } = renderHook(() => useOrder(), { wrapper: Providers });

    act(() => {
      result.current.addItem({ id: "I1", name: "Queue Me", price: 8, uniqueId: "i1" });
    });

    submitSpy.mockRejectedValueOnce(queueableError);

    await act(async () => {
      const response = await result.current.printOrder();
      expect(response.status).toBe("queued");
    });

    expect(result.current.pendingPrintJobs).toBe(1);
    expect(result.current.lastPrintAlert).toContain("queued for retry");

    expect(result.current.lastPrintAlert).toContain("queued for retry");
  });

  it("throws and does not queue non-retryable print errors", async () => {
    const badRequestError = Object.assign(new Error("bad request"), { status: 400 });
    vi.spyOn(apiClient, "submitOrder").mockRejectedValueOnce(badRequestError);

    const { result } = renderHook(() => useOrder(), { wrapper: Providers });

    act(() => {
      result.current.addItem({ id: "I2", name: "Bad Request", price: 9, uniqueId: "i2" });
    });

    await act(async () => {
      await expect(result.current.printOrder()).rejects.toThrow("bad request");
    });
    expect(result.current.pendingPrintJobs).toBe(0);
    await waitFor(() => {
      expect(result.current.lastPrintAlert).toContain("not queued");
    });
  });

  it("flushes persisted queue entries when retryQueuedPrints succeeds", async () => {
    window.localStorage.setItem(
      "pos.print-queue.v1",
      JSON.stringify([
        {
          clientOrderId: "queued-1",
          order: {
            orderType: "collection",
            items: [{ id: "I1", name: "Queued", price: 10, quantity: 1 }],
            payment: { method: "cash", amount: 10 },
            total: 10,
          },
          queuedAt: Date.now(),
          attempts: 0,
        },
      ]),
    );

    vi.spyOn(apiClient, "submitOrder").mockResolvedValue({ orderId: 55, printed: true });

    const { result } = renderHook(() => useOrder(), { wrapper: Providers });

    expect(result.current.pendingPrintJobs).toBe(1);

    await act(async () => {
      await result.current.retryQueuedPrints();
    });

    await waitFor(() => {
      expect(result.current.pendingPrintJobs).toBe(0);
    });
  });
});
