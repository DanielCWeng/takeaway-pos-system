import { useMemo } from "react";
import type { KitchenOrder, MenuItem, StationLoadMap, StationType } from "../types/kitchen";
import { STATION_CONFIG, TRACKED_STATIONS } from "../types/kitchen";

/**
 * Derives per-station slot usage from currently cooking orders.
 *
 * Rules:
 * - Only orders with status 'cooking' or 'accepted' occupy stations.
 * - Item quantity is divided by station portionCapacity to get runs needed.
 * - Same item ID across multiple concurrent orders batches into shared runs.
 * - Child items (set meal components) are evaluated independently.
 */
export function useStationLoad(
  orders: KitchenOrder[],
  menu: MenuItem[],
): StationLoadMap {
  return useMemo(() => {
    // Accumulate: stationId → { totalPortions }
    const portionsByStation = new Map<StationType, number>();

    const activeOrders = orders.filter(
      (o) => o.status === "cooking" || o.status === "accepted",
    );

    for (const kitchenOrder of activeOrders) {
      for (const item of kitchenOrder.order.items) {
        const menuItem = menu.find((m) => m.id === item.id);
        if (!menuItem) continue;

        const qty = item.quantity ?? 1;

        if (menuItem.primaryStation) {
          const st = menuItem.primaryStation;
          portionsByStation.set(st, (portionsByStation.get(st) ?? 0) + qty);
        }

        if (menuItem.secondaryStation) {
          const st = menuItem.secondaryStation;
          portionsByStation.set(st, (portionsByStation.get(st) ?? 0) + qty);
        }
      }
    }

    const result: StationLoadMap = {};

    for (const station of TRACKED_STATIONS) {
      const cfg = STATION_CONFIG[station];
      const totalPortions = portionsByStation.get(station) ?? 0;
      const totalSlotUses = Math.ceil(totalPortions / cfg.portionCapacity);
      const used = Math.min(totalSlotUses, cfg.slots);
      const queued = Math.max(0, totalSlotUses - cfg.slots);

      result[station] = { used, capacity: cfg.slots, queued };
    }

    return result;
  }, [orders, menu]);
}
