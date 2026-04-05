import { useCallback, useEffect, useRef, useState } from "react";
import { WS_URL } from "../config";
import type { KitchenSocketEvent } from "../types/kitchen";

const MIN_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;

/**
 * Maintains a WebSocket connection to the POS server.
 * Reconnects with exponential backoff on disconnect (1s → 30s max).
 * Delivers parsed events to the provided callback without re-subscribing on every render.
 */
export function useKitchenSocket(onEvent: (event: KitchenSocketEvent) => void) {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  });

  const connect = useCallback(() => {
    let ws: WebSocket | null = null;
    let delay = MIN_DELAY_MS;
    let unmounted = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function attempt() {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        setConnected(true);
        delay = MIN_DELAY_MS;
      };

      ws.onmessage = (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data as string) as KitchenSocketEvent;
          if (msg.type) onEventRef.current(msg);
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!unmounted) {
          retryTimer = setTimeout(() => {
            delay = Math.min(delay * 2, MAX_DELAY_MS);
            attempt();
          }, delay);
        }
      };

      ws.onerror = () => {
        ws?.close();
      };
    }

    attempt();

    return () => {
      unmounted = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      ws?.close();
    };
  }, []);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);

  return { connected };
}
