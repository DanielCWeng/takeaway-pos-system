import { useMemo } from "react";
import type { KitchenOrder } from "../types/kitchen";

/**
 * Detects delivery orders that are good candidates to batch together —
 * i.e. send with the same driver in one run.
 *
 * Criteria (all must be true for a pair):
 *  - Both are delivery orders
 *  - Both are 'new' (not yet accepted — once accepted the cook is started)
 *  - Both have coordinates
 *  - Placed within BATCH_TIME_WINDOW_MS of each other
 *  - Delivery addresses are within BATCH_DISTANCE_MILES of each other
 *
 * Returns a Map<orderId, orderId[]> — each entry lists orders that can be
 * batched with that order.
 */

const BATCH_DISTANCE_MILES  = 1.2;   // addresses this close = same direction
const BATCH_TIME_WINDOW_MS  = 20 * 60_000; // placed within 20 min of each other

function distanceMiles(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R    = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useBatchDetection(
  orders: KitchenOrder[],
): Map<number, number[]> {
  return useMemo(() => {
    // Only 'new' delivery orders with coordinates are candidates
    const candidates = orders.filter((o) => {
      if (o.order.orderType !== "delivery") return false;
      if (o.status !== "new") return false;
      const ci = o.order.customerInfo;
      return ci?.latitude != null && ci?.longitude != null;
    });

    const batchMap = new Map<number, number[]>();

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const a = candidates[i];
        const b = candidates[j];

        // Time window check
        const timeDiff = Math.abs(
          new Date(a.archivedAt).getTime() - new Date(b.archivedAt).getTime(),
        );
        if (timeDiff > BATCH_TIME_WINDOW_MS) continue;

        // Distance check
        const ciA = a.order.customerInfo!;
        const ciB = b.order.customerInfo!;
        const dist = distanceMiles(
          ciA.latitude!,  ciA.longitude!,
          ciB.latitude!,  ciB.longitude!,
        );
        if (dist > BATCH_DISTANCE_MILES) continue;

        // They're batchable — add each to the other's list
        if (!batchMap.has(a.orderId)) batchMap.set(a.orderId, []);
        if (!batchMap.has(b.orderId)) batchMap.set(b.orderId, []);
        batchMap.get(a.orderId)!.push(b.orderId);
        batchMap.get(b.orderId)!.push(a.orderId);
      }
    }

    return batchMap;
  }, [orders]);
}
