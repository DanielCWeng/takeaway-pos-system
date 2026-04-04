import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { CallerProvider } from "../../context/CallerContext";
import { OrderProvider } from "../../context/OrderContext";
import { useOrder } from "../../context/OrderContext";
import { UIProvider, useUI } from "../../context/UIContext";
import { useCallHandler } from "../useCallHandler";
import type { WebSocketMessage } from "../../types";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  url = "";
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.();
    }, 0);
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  triggerMessage(payload: WebSocketMessage) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CallerProvider socketFactory={(url) => new MockWebSocket(url) as unknown as WebSocket}>
      <UIProvider>
        <OrderProvider>{children}</OrderProvider>
      </UIProvider>
    </CallerProvider>
  );
}

const useCombined = () => {
  const call = useCallHandler();
  const ui = useUI();
  const order = useOrder();
  return { call, ui, order };
};

describe("useCallHandler", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens address-selection modal when multiple addresses arrive", async () => {
    const { result } = renderHook(() => useCombined(), {
      wrapper: Providers,
    });
    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
    expect(MockWebSocket.instances.length).toBe(1);

    const payload: WebSocketMessage = {
      type: "incoming_call",
      payload: {
        phone: "07000",
        customer: {
          phone: "07000",
          name: "Alex",
          postcode: null,
          town: null,
          houseNumber: null,
          street: null,
          latitude: null,
          longitude: null,
          distance: null,
          firstCall: "",
          lastCall: "",
          callCount: 1,
        },
        addresses: [
          { line1: "1 High St", postcode: "AB1", latitude: 0, longitude: 0 },
          { line1: "2 Low St", postcode: "AB2", latitude: 0, longitude: 0 },
        ],
        distance: null,
      },
    };

    act(() => {
      MockWebSocket.instances[0].triggerMessage(payload);
    });

    expect(result.current.call.pendingCall?.phone).toBe("07000");
    expect(result.current.call.addressOptions.length).toBe(2);
    expect(result.current.ui.activeModal).toBe("address-selection");
  });

  it("auto-applies single address payload when there is no active order", async () => {
    const { result } = renderHook(() => useCombined(), {
      wrapper: Providers,
    });
    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1));

    act(() => {
      MockWebSocket.instances[0].triggerMessage({
        type: "incoming_call",
        payload: {
          phone: "07111",
          customer: { phone: "07111", name: "Sam", postcode: null },
          addresses: [{ line1: "10 High St", town: "Nottingham", postcode: "NG9 8GF" }],
          distance: 1.2,
        },
      } as WebSocketMessage);
    });

    expect(result.current.call.pendingCall).toBeNull();
    expect(result.current.order.order.customerInfo?.address).toContain("10 High St");
    expect(result.current.order.order.orderType).toBe("delivery");
    expect(result.current.ui.activeModal).toBe("none");
  });

  it("keeps collection mode when call has no addresses and no postcode data", async () => {
    const { result } = renderHook(() => useCombined(), { wrapper: Providers });
    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1));

    act(() => {
      MockWebSocket.instances[0].triggerMessage({
        type: "incoming_call",
        payload: {
          phone: "07222",
          customer: { phone: "07222", name: "No Address" },
          addresses: [],
          distance: null,
        },
      } as WebSocketMessage);
    });

    expect(result.current.order.order.customerInfo?.phone).toBe("07222");
    expect(result.current.order.order.orderType).toBe("collection");
  });

  it("opens customer modal instead of address picker when an order is already active", async () => {
    const { result } = renderHook(() => useCombined(), { wrapper: Providers });
    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1));

    act(() => {
      result.current.order.addItem({
        id: "ITEM1",
        name: "Chips",
        price: 3,
        uniqueId: "item-1",
      });
    });

    act(() => {
      MockWebSocket.instances[0].triggerMessage({
        type: "incoming_call",
        payload: {
          phone: "07333",
          customer: { phone: "07333", name: "Busy Order" },
          addresses: [{ line1: "1 Test", postcode: "NG1 1AA" }],
          distance: null,
        },
      } as WebSocketMessage);
    });

    expect(result.current.call.pendingCall?.phone).toBe("07333");
    expect(result.current.ui.activeModal).toBe("customer");
  });

  it("selectAddress resolves pending call and clearCall resets modal state", async () => {
    const { result } = renderHook(() => useCombined(), { wrapper: Providers });
    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1));

    act(() => {
      MockWebSocket.instances[0].triggerMessage({
        type: "incoming_call",
        payload: {
          phone: "07444",
          customer: { phone: "07444", name: "Choice User" },
          addresses: [
            { line1: "1 High St", postcode: "NG1 1AA" },
            { line1: "2 Low St", postcode: "NG1 1AB" },
          ],
          distance: null,
        },
      } as WebSocketMessage);
    });

    expect(result.current.call.pendingCall?.phone).toBe("07444");
    expect(result.current.call.addressOptions).toHaveLength(2);

    act(() => {
      result.current.call.selectAddress({ line1: "2 Low St", postcode: "NG1 1AB" } as any);
    });

    expect(result.current.call.pendingCall).toBeNull();
    expect(result.current.order.order.customerInfo?.postcode).toBe("NG1 1AB");

    act(() => {
      result.current.call.clearCall();
    });

    expect(result.current.call.lastCall).toBeNull();
    expect(result.current.call.addressOptions).toHaveLength(0);
    expect(result.current.ui.activeModal).toBe("none");
  });
});
