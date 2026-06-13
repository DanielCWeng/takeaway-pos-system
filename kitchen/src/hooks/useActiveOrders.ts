import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL } from "../config";
import type {
  KitchenOrder,
  KitchenSocketEvent,
  MenuItem,
  OrderStatus,
} from "../types/kitchen";
import { calcDeadline, calcEstimatedReady } from "./useCookTimer";
import { useKitchenSocket } from "./useKitchenSocket";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INACTIVE: OrderStatus[] = ["complete", "cancelled"];

function mapApiRow(
  row: {
    orderId: number;
    order: KitchenOrder["order"];
    status: OrderStatus;
    archivedAt: string;
    estimatedReadyAt?: string | null;
    actualReadyAt?: string | null;
  },
  menu: MenuItem[],
  busyMode: boolean,
): KitchenOrder {
  return {
    orderId: row.orderId,
    order: row.order,
    status: row.status,
    archivedAt: row.archivedAt,
    estimatedReadyAt: row.estimatedReadyAt ?? calcEstimatedReady(row.order, menu, row.archivedAt).toISOString(),
    actualReadyAt: row.actualReadyAt ?? undefined,
    deadline: calcDeadline(row.order.orderType, row.archivedAt, busyMode).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches active orders on mount, then keeps state in sync with WebSocket events.
 *
 * Race-condition safe: WS events that arrive before the initial fetch resolves
 * are buffered and replayed after the fetch completes.
 */
export function useActiveOrders(menu: MenuItem[]) {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyMode, setBusyMode] = useState(false);

  // Keep a stable ref to the current menu so callbacks don't go stale
  const menuRef = useRef(menu);
  useEffect(() => { menuRef.current = menu; });

  const busyModeRef = useRef(busyMode);
  useEffect(() => { busyModeRef.current = busyMode; });

  // Buffer WS events received before the fetch completes
  const fetchedRef = useRef(false);
  const pendingRef = useRef<KitchenSocketEvent[]>([]);

  const applyEvent = useCallback(
    (event: KitchenSocketEvent, prev: KitchenOrder[]): KitchenOrder[] => {
      switch (event.type) {
        case "order_created": {
          if (prev.some((o) => o.orderId === event.payload.orderId)) return prev;
          const mapped = mapApiRow(
            {
              orderId: event.payload.orderId,
              order: event.payload.order,
              status: event.payload.status,
              archivedAt: event.payload.archivedAt,
              estimatedReadyAt: event.payload.estimatedReadyAt ?? null,
            },
            menuRef.current,
            busyModeRef.current,
          );
          return [...prev, mapped];
        }

        case "order_status_changed": {
          return prev
            .map((o) =>
              o.orderId === event.payload.orderId
                ? {
                    ...o,
                    status: event.payload.status,
                    actualReadyAt:
                      event.payload.status === "ready"
                        ? event.payload.updatedAt
                        : o.actualReadyAt,
                  }
                : o,
            )
            .filter((o) => !INACTIVE.includes(o.status));
        }

        case "order_cancelled":
          return prev.filter((o) => o.orderId !== event.payload.orderId);

        case "order_eta_updated":
          return prev.map((o) =>
            o.orderId === event.payload.orderId
              ? { ...o, estimatedReadyAt: event.payload.estimatedReadyAt }
              : o,
          );

        default:
          return prev;
      }
    },
    [],
  );

  const handleSocketEvent = useCallback(
    (event: KitchenSocketEvent) => {
      if (!fetchedRef.current) {
        pendingRef.current.push(event);
        return;
      }
      setOrders((prev) => applyEvent(event, prev));
    },
    [applyEvent],
  );

  const { connected } = useKitchenSocket(handleSocketEvent);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/api/orders/active`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ orders: Parameters<typeof mapApiRow>[0][] }>;
      })
      .then(({ orders: rows }) => {
        if (cancelled) return;

        // Derive initial busyMode from queue depth
        const isBusy = rows.length >= 4;
        setBusyMode(isBusy);
        busyModeRef.current = isBusy;

        let merged: KitchenOrder[] = rows.map((row) =>
          mapApiRow(row, menuRef.current, isBusy),
        );

        // Replay buffered WS events
        for (const evt of pendingRef.current) {
          merged = applyEvent(evt, merged);
        }
        pendingRef.current = [];
        fetchedRef.current = true;

        setOrders(merged);
        setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          fetchedRef.current = true;
          setIsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [applyEvent]);

  // Recalculate deadlines whenever busyMode changes (delivery windows shift)
  useEffect(() => {
    setOrders((prev) =>
      prev.map((o) => ({
        ...o,
        deadline: calcDeadline(o.order.orderType, o.archivedAt, busyMode).toISOString(),
      })),
    );
  }, [busyMode]);

  const updateStatus = useCallback(
    async (orderId: number, status: OrderStatus) => {
      // Optimistic update
      setOrders((prev) =>
        prev
          .map((o) =>
            o.orderId === orderId
              ? {
                  ...o,
                  status,
                  actualReadyAt: status === "ready" ? new Date().toISOString() : o.actualReadyAt,
                }
              : o,
          )
          .filter((o) => !INACTIVE.includes(o.status)),
      );

      try {
        await fetch(`${API_URL}/api/orders/${orderId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
      } catch {
        // WS event from server will reconcile if the request eventually succeeds
      }
    },
    [],
  );

  return { orders, isLoading, connected, busyMode, setBusyMode, updateStatus };
}
