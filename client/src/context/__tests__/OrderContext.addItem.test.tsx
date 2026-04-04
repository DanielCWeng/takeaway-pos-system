import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import type { ReactNode } from "react";
import { OrderProvider, useOrder } from "../OrderContext";

import { CallerProvider } from "../CallerContext";

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

import { beforeEach } from "vitest";

describe("OrderContext - addItem zhName handling", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <CallerProvider socketFactory={(url) => new MockWebSocket(url) as unknown as WebSocket}>
      <OrderProvider>{children}</OrderProvider>
    </CallerProvider>
  );

  it("safely extracts zhName when a full { en, zh } name object is passed", () => {
    const { result } = renderHook(() => useOrder(), { wrapper });

    act(() => {
      // Calling addItem just like the updated pos-dashboard.tsx does
      result.current.addItem({
        id: "T1",
        name: { en: "Sweet & Sour Pork", zh: "咕咾肉" },
        price: 7.5,
        uniqueId: "test-123",
      });
    });

    const items = result.current.order.items;
    expect(items).toHaveLength(1);

    // The context correctly strips out the object to english for `name`,
    // but saves `zhName` for the printer to use!
    expect(items[0].name).toBe("Sweet & Sour Pork");
    expect(items[0].zhName).toBe("咕咾肉");
  });

  it("gracefully handles items that only have a string name (no Chinese)", () => {
    const { result } = renderHook(() => useOrder(), { wrapper });

    act(() => {
      // Calling addItem with just an English string (legacy style)
      result.current.addItem({
        id: "T2",
        name: "Chips", // Just English
        price: 2.5,
        uniqueId: "test-456",
      });
    });

    const items = result.current.order.items;

    expect(items[0].name).toBe("Chips");
    expect(items[0].zhName).toBeUndefined(); // Printer code handles undefined gracefully
  });
});
