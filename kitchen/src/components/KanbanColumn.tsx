import type { KitchenOrder, OrderStatus } from "../types/kitchen";
import { OrderCard } from "./OrderCard";

interface Props {
  title: string;
  titleZh: string;
  accentClass: string;
  orders: KitchenOrder[];
  priorityOrderId: number | null;
  missWindowIds: number[];
  batchMap: Map<number, number[]>;
  onStatusChange: (orderId: number, status: OrderStatus) => void;
}

/**
 * One of the three kanban columns (NEW / COOKING / READY).
 * Scrolls internally so the header always stays visible.
 */
export function KanbanColumn({
  title,
  titleZh,
  accentClass,
  orders,
  priorityOrderId,
  missWindowIds,
  batchMap,
  onStatusChange,
}: Props) {
  return (
    <div className="kanban-col flex flex-col flex-1 min-h-0">
      {/* Column header */}
      <div className="kanban-col-header">
        <div className="flex items-baseline gap-2">
          <div className={`w-2 h-2 rounded-full ${accentClass} shrink-0`} />
          <div className="flex flex-col">
            <span className="font-bold tracking-widest uppercase text-white text-sm">
              {title}
            </span>
            <span className="font-chinese text-zinc-600 text-xs">{titleZh}</span>
          </div>
        </div>
        <span
          className={[
            "text-sm font-mono font-bold px-2.5 py-0.5 rounded-full",
            orders.length > 0
              ? `${accentClass.replace("bg-", "bg-").replace("500", "500/15")} text-white border border-${accentClass.replace("bg-", "").replace("500", "500/40")}`
              : "bg-zinc-800/60 text-zinc-600 border border-zinc-700/40",
          ].join(" ")}
        >
          {orders.length}
        </span>
      </div>

      {/* Scrollable card list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-zinc-700">
            <span className="text-3xl mb-2">○</span>
            <span className="text-sm uppercase tracking-widest">Empty</span>
          </div>
        ) : (
          orders.map((o) => (
            <OrderCard
              key={o.orderId}
              kitchenOrder={o}
              isPriority={o.orderId === priorityOrderId}
              isMissWindow={missWindowIds.includes(o.orderId)}
              batchWith={batchMap.get(o.orderId) ?? []}
              onStatusChange={onStatusChange}
            />
          ))
        )}
      </div>
    </div>
  );
}
