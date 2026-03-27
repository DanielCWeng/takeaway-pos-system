import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWebSocket } from "../useWebSocket";
import type { WebSocketMessage } from "../../types";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  url = "";
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    // Defer open so React state updates happen inside act with fake timers
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

describe("useWebSocket", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("connects once and forwards incoming messages to subscribers", async () => {
    const handler = vi.fn();

    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useWebSocket({
        createSocket: (url) => new MockWebSocket(url) as unknown as WebSocket,
        reconnectJitterRatio: 0,
      }),
    );
    expect(result.current.status).toBe("connecting");
    act(() => {
      vi.runAllTimers(); // flush onopen
    });
    expect(MockWebSocket.instances.length).toBe(1);
    expect(result.current.isConnected).toBe(true);
    expect(result.current.status).toBe("connected");

    act(() => {
      result.current.subscribe(handler);
      MockWebSocket.instances[0].triggerMessage({
        type: "incoming_call",
        payload: {
          phone: "07123456789",
          customer: null,
          addresses: [],
          distance: null,
        },
      });
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].type).toBe("incoming_call");
  });

  it("reconnects with exponential backoff starting at 1s", async () => {
    vi.useFakeTimers();

    const { result, unmount } = renderHook(() =>
      useWebSocket({
        createSocket: (url) => new MockWebSocket(url) as unknown as WebSocket,
        reconnectJitterRatio: 0,
      }),
    );
    act(() => {
      vi.runAllTimers(); // initial onopen
    });
    expect(MockWebSocket.instances.length).toBe(1);

    act(() => {
      MockWebSocket.instances[0].close();
    });
    expect(result.current.status).toBe("reconnecting");

    // Before 1s, no new connection
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(MockWebSocket.instances.length).toBe(1);

    // At 1s the first retry should fire
    act(() => {
      vi.advanceTimersByTime(1);
      vi.runOnlyPendingTimers(); // flush zero-delay open
    });
    expect(MockWebSocket.instances.length).toBe(2);

    // Next retry should wait 2s
    act(() => {
      MockWebSocket.instances[1].close();
    });
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(MockWebSocket.instances.length).toBe(2);

    act(() => {
      vi.advanceTimersByTime(1);
      vi.runOnlyPendingTimers();
    });

    expect(MockWebSocket.instances.length).toBe(3);

    unmount();
  });

  it("does not reconnect after unmount", () => {
    vi.useFakeTimers();

    const { unmount } = renderHook(() =>
      useWebSocket({
        createSocket: (url) => new MockWebSocket(url) as unknown as WebSocket,
        reconnectJitterRatio: 0,
      }),
    );

    act(() => {
      vi.runAllTimers(); // initial onopen
    });
    expect(MockWebSocket.instances.length).toBe(1);

    unmount();

    act(() => {
      vi.advanceTimersByTime(60_000);
      vi.runOnlyPendingTimers();
    });

    expect(MockWebSocket.instances.length).toBe(1);
  });
});
