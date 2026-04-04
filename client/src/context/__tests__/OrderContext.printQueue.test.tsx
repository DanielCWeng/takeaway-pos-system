import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
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
  onerror: (() => void) | null = null;

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

describe("OrderContext print queue", () => {
  beforeEach(() => {
    window.localStorage.clear();
    MockWebSocket.instances = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deduplicates queued retries for the same order and queues new orders separately", async () => {
    vi.spyOn(apiClient, "submitOrder").mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useOrder(), { wrapper: Providers });

    act(() => {
      result.current.addItem({
        id: "TEST1",
        name: "Item 1",
        price: 10,
        quantity: 1,
        uniqueId: "item-1",
      });
    });

    await act(async () => {
      await Promise.all([result.current.printOrder(), result.current.printOrder()]);
    });

    await waitFor(() => {
      expect(result.current.pendingPrintJobs).toBe(1);
    });

    act(() => {
      result.current.addItem({
        id: "TEST2",
        name: "Item 2",
        price: 12,
        quantity: 1,
        uniqueId: "item-2",
      });
    });

    await act(async () => {
      await result.current.printOrder();
    });

    await waitFor(() => {
      expect(result.current.pendingPrintJobs).toBe(2);
    });
  });
});
