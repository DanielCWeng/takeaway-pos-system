import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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

function seedQueue() {
  window.localStorage.setItem(
    "pos.print-queue.v2",
    JSON.stringify([
      {
        clientOrderId: "queued-1",
        order: {
          orderType: "collection",
          items: [{ id: "Q1", name: "Queued Item", price: 10, quantity: 1 }],
          payment: { method: "cash", amount: 10 },
          total: 10,
        },
        queuedAt: Date.now(),
        attempts: 0,
      },
    ]),
  );
}

describe("OrderContext retry timing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    MockWebSocket.instances = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("schedules 15s retry interval while disconnected and flushes on interval tick", async () => {
    seedQueue();
    const submitSpy = vi
      .spyOn(apiClient, "submitOrder")
      .mockResolvedValue({ orderId: 91, printed: true });
    const clearIntervalSpy = vi.spyOn(window, "clearInterval").mockImplementation(() => {});
    let retryTick: (() => void) | null = null;
    const setIntervalSpy = vi
      .spyOn(window, "setInterval")
      .mockImplementation((handler: TimerHandler, timeout?: number) => {
        if (timeout === 15_000 && typeof handler === "function") {
          retryTick = handler as () => void;
        }
        return 1 as unknown as ReturnType<typeof setInterval>;
      });

    const { result } = renderHook(() => useOrder(), { wrapper: Providers });

    expect(result.current.pendingPrintJobs).toBe(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 15_000);
    expect(clearIntervalSpy).not.toHaveBeenCalled();
    expect(submitSpy).toHaveBeenCalledTimes(0);
    expect(retryTick).toBeTruthy();

    await act(async () => {
      retryTick?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledTimes(1);
      expect(result.current.pendingPrintJobs).toBe(0);
    });
  });

  it("switches to 5s interval and triggers immediate flush when connection opens", async () => {
    seedQueue();
    const submitSpy = vi
      .spyOn(apiClient, "submitOrder")
      .mockResolvedValue({ orderId: 92, printed: true });
    const setIntervalSpy = vi
      .spyOn(window, "setInterval")
      .mockImplementation(() => 1 as unknown as ReturnType<typeof setInterval>);

    const { result } = renderHook(() => useOrder(), { wrapper: Providers });
    expect(result.current.pendingPrintJobs).toBe(1);

    await act(async () => {
      MockWebSocket.instances[0]?.onopen?.();
    });

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledTimes(1);
      expect(result.current.pendingPrintJobs).toBe(0);
    });

    expect(setIntervalSpy.mock.calls.some(([, delay]) => delay === 5_000)).toBe(true);
  });
});
