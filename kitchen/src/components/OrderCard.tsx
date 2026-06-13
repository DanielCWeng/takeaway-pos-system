import type { KitchenOrder } from "../types/kitchen";
import { DeliveryBadge } from "./DeliveryBadge";

function fmtTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

interface Props {
  kitchenOrder: KitchenOrder;
  onDone: (orderId: number) => void;
}

export function OrderCard({ kitchenOrder, onDone }: Props) {
  const { orderId, order, estimatedReadyAt } = kitchenOrder;
  const isDelivery = order.orderType === "delivery";
  const readyTime = new Date(estimatedReadyAt);

  const topItems = order.items.filter((i) => !i.parentId);

  return (
    <article className="order-card">
      <div className="status-bar bg-kitchen-cooking" />

      <div className="pl-3 pr-4 pt-3 pb-4 flex flex-col gap-3">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-3xl text-white tracking-tight leading-none">
              #{String(orderId).padStart(3, "0")}
            </span>
            <DeliveryBadge orderType={order.orderType} />
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] text-zinc-600 uppercase tracking-widest">Ready</div>
            <div className="font-mono font-semibold text-white text-lg tabular-nums">
              {fmtTime(readyTime)}
            </div>
          </div>
        </div>

        {/* ── Divider ─────────────────────────────────────────────── */}
        <div className="border-t border-[#1e1e1e]" />

        {/* ── Items ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          {topItems.map((item) => (
            <div key={item.uniqueId} className="flex items-baseline gap-2">
              {!item.hideQuantity && (
                <span className="text-zinc-400 font-mono font-bold text-base shrink-0 w-6 text-right">
                  {item.quantity}×
                </span>
              )}
              <span className="font-semibold text-white text-lg leading-snug">
                {item.name}
                {item.isFoc && (
                  <span className="ml-2 text-xs font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">
                    FOC
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>

        {/* ── Notes ───────────────────────────────────────────────── */}
        {order.notes && (
          <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2">
            <span className="text-amber-400 shrink-0">📝</span>
            <span className="text-amber-300 text-sm font-medium">{order.notes}</span>
          </div>
        )}

        {/* ── Customer info — delivery only ────────────────────────── */}
        {isDelivery && order.customerInfo && (
          <>
            <div className="border-t border-[#1e1e1e]" />
            <div className="text-zinc-400 text-base">
              {order.customerInfo.name && (
                <span className="text-zinc-300 mr-1">{order.customerInfo.name} ·</span>
              )}
              {order.customerInfo.postcode}
            </div>
            {order.customerInfo.deliveryInstructions && (
              <div className="text-zinc-500 text-sm italic">
                {order.customerInfo.deliveryInstructions}
              </div>
            )}
          </>
        )}

        {/* ── Delivery time (if specified) ─────────────────────────── */}
        {order.customerInfo?.deliveryTime && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span>🕐</span>
            <span>For {order.customerInfo.deliveryTime}</span>
          </div>
        )}

        {/* ── Done button ──────────────────────────────────────────── */}
        <div className="border-t border-[#1e1e1e]" />
        <button
          onClick={() => onDone(orderId)}
          className="action-btn action-btn-ready"
        >
          ORDER DONE
        </button>
      </div>
    </article>
  );
}
