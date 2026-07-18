import { useMemo } from "react";
import type { FullOrder, MenuItem, OrderStatus } from "../types/kitchen";

const DEFAULT_COOK_MS = 480_000; // 8 min fallback

/**
 * Calculate when an order will be physically ready based on the longest
 * cook time among its items. Uses reduce to avoid RangeError on large arrays.
 */
export function calcEstimatedReady(
  order: FullOrder,
  menu: MenuItem[],
  archivedAt: string,
): Date {
  const created = new Date(archivedAt);
  const maxCookMs = order.items.reduce((max, item) => {
    const menuItem = menu.find((m) => m.id === item.id);
    const cookSecs =
      (menuItem?.primaryCookTime ?? 0) + (menuItem?.secondaryCookTime ?? 0);
    return Math.max(max, cookSecs * 1_000);
  }, 0);
  return new Date(created.getTime() + (maxCookMs || DEFAULT_COOK_MS));
}

/**
 * Calculate the customer-facing deadline for an order.
 * Collection: 15 min (midpoint of 10–20 min window), fixed regardless of busy state.
 * Delivery:   37 min normal | 60 min when kitchen is busy.
 */
export function calcDeadline(
  orderType: "collection" | "delivery",
  archivedAt: string,
  busyMode: boolean,
): Date {
  const created = new Date(archivedAt);
  const mins =
    orderType === "collection" ? 15 : busyMode ? 60 : 37;
  return new Date(created.getTime() + mins * 60_000);
}

/**
 * Hook: given a single order and the full menu, returns estimated ready time
 * and deadline as ISO strings. Recomputes only when inputs change.
 */
export function useCookTimer(
  order: FullOrder,
  archivedAt: string,
  menu: MenuItem[],
  busyMode: boolean,
): { estimatedReadyAt: string; deadline: string } {
  return useMemo(() => ({
    estimatedReadyAt: calcEstimatedReady(order, menu, archivedAt).toISOString(),
    deadline: calcDeadline(order.orderType, archivedAt, busyMode).toISOString(),
  }), [order, archivedAt, menu, busyMode]);
}

/**
 * Returns seconds remaining until the target time (positive = future, negative = overdue).
 */
export function secondsUntil(isoTarget: string): number {
  return Math.round((new Date(isoTarget).getTime() - Date.now()) / 1_000);
}

/**
 * Formats a second count as MM:SS. Handles negative (overdue) values.
 */
export function formatCountdown(totalSeconds: number): string {
  const abs = Math.abs(totalSeconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const str = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return totalSeconds < 0 ? `-${str}` : str;
}

/**
 * Derive the urgency colour for a countdown timer.
 */
export function timerColour(secondsRemaining: number): "green" | "amber" | "red" {
  if (secondsRemaining > 5 * 60) return "green";
  if (secondsRemaining > 2 * 60) return "amber";
  return "red";
}

/**
 * True when the order cannot physically be ready before the deadline.
 */
export function willMissWindow(
  estimatedReadyAt: string,
  deadline: string,
  status: OrderStatus,
): boolean {
  if (status === "ready" || status === "complete" || status === "cancelled") return false;
  return new Date(estimatedReadyAt) > new Date(deadline);
}
