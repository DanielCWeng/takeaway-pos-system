import { useEffect, useMemo, useRef, useState } from "react";
import type { KitchenOrder } from "../types/kitchen";
import { willMissWindow } from "./useCookTimer";

const BUSY_THRESHOLD = 4;
const SUSTAINED_MS = 2 * 60 * 1_000;   // must exceed threshold for 2 min to activate
const WINDOW_MS     = 10 * 60 * 1_000;  // rolling window for arrival rate
const ARRIVAL_TRIGGER = 3;              // orders in WINDOW_MS triggers busy mode

/**
 * Derives busy mode state with smoothing to prevent false positives.
 *
 * Triggers when EITHER:
 *   1. Active order count ≥ BUSY_THRESHOLD for ≥ 2 continuous minutes
 *   2. 3+ new orders arrive within any 10-minute rolling window
 *
 * Returns:
 *   busyMode        — whether busy mode is active
 *   priorityOrderId — the single order the system recommends acting on next
 *   missWindowIds   — orders where estimatedReadyAt > deadline
 */
export function useBusyMode(orders: KitchenOrder[], externalBusyMode: boolean) {
  const [sustainedBusy, setSustainedBusy] = useState(false);
  const [rateBusy, setRateBusy] = useState(false);

  const thresholdExceededSince = useRef<number | null>(null);
  const arrivalTimestamps = useRef<number[]>([]);

  // Track when threshold was first exceeded for sustained detection
  useEffect(() => {
    const active = orders.filter(
      (o) => o.status !== "complete" && o.status !== "cancelled",
    ).length;

    if (active >= BUSY_THRESHOLD) {
      if (thresholdExceededSince.current === null) {
        thresholdExceededSince.current = Date.now();
      }
    } else {
      thresholdExceededSince.current = null;
      setSustainedBusy(false);
    }
  }, [orders]);

  // Poll to check if sustained threshold has been met
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        thresholdExceededSince.current !== null &&
        Date.now() - thresholdExceededSince.current >= SUSTAINED_MS
      ) {
        setSustainedBusy(true);
      }
    }, 10_000);
    return () => clearInterval(timer);
  }, []);

  // Track arrival rate — record when new orders appear
  const prevOrderIds = useRef(new Set<number>());
  useEffect(() => {
    const now = Date.now();
    for (const o of orders) {
      if (!prevOrderIds.current.has(o.orderId)) {
        arrivalTimestamps.current.push(now);
      }
    }
    prevOrderIds.current = new Set(orders.map((o) => o.orderId));

    // Purge timestamps outside the rolling window
    arrivalTimestamps.current = arrivalTimestamps.current.filter(
      (t) => now - t < WINDOW_MS,
    );

    setRateBusy(arrivalTimestamps.current.length >= ARRIVAL_TRIGGER);
  }, [orders]);

  const busyMode = externalBusyMode || sustainedBusy || rateBusy;

  const { priorityOrderId, missWindowIds } = useMemo(() => {
    const actionable = orders.filter(
      (o) => o.status !== "complete" && o.status !== "cancelled" && o.status !== "ready",
    );

    const missed = actionable.filter((o) =>
      willMissWindow(o.estimatedReadyAt, o.deadline, o.status),
    );

    // Sort by priority:
    // 1. Won't make window (estimatedReadyAt > deadline)
    // 2. Closest deadline
    // 3. Oldest unaccepted
    const sorted = [...actionable].sort((a, b) => {
      const aMissed = willMissWindow(a.estimatedReadyAt, a.deadline, a.status);
      const bMissed = willMissWindow(b.estimatedReadyAt, b.deadline, b.status);
      if (aMissed !== bMissed) return aMissed ? -1 : 1;

      const aDeadline = new Date(a.deadline).getTime();
      const bDeadline = new Date(b.deadline).getTime();
      if (aDeadline !== bDeadline) return aDeadline - bDeadline;

      return new Date(a.archivedAt).getTime() - new Date(b.archivedAt).getTime();
    });

    return {
      priorityOrderId: sorted[0]?.orderId ?? null,
      missWindowIds: missed.map((o) => o.orderId),
    };
  }, [orders]);

  return { busyMode, priorityOrderId, missWindowIds };
}
