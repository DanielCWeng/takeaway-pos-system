import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { CallerProvider } from "../../context/CallerContext";
import { OrderProvider } from "../../context/OrderContext";
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
    <CallerProvider
      socketFactory={(url) =>
        new MockWebSocket(url) as unknown as WebSocket
      }
    >
      <UIProvider>
        <OrderProvider>{children}</OrderProvider>
      </UIProvider>
    </CallerProvider>
  );
}

const useCombined = () => {
  const call = useCallHandler();
  const ui = useUI();
  return { call, ui };
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
});
