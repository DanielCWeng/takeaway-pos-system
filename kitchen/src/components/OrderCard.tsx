import { useState } from "react";
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
  const [completedItems, setCompletedItems] = useState<Set<string>>(() => new Set());

  const toggleItem = (uniqueId: string) => {
    setCompletedItems((current) => {
      const next = new Set(current);
      if (next.has(uniqueId)) next.delete(uniqueId);
      else next.add(uniqueId);
      return next;
    });
  };

  const renderItem = (item: (typeof order.items)[number], isChild = false) => {
    const completed = completedItems.has(item.uniqueId);
    const modifiers = (item.modifiers ?? [])
      .map((modifier) => {
        if (typeof modifier === "string") return modifier;
        return [modifier.command, modifier.ingredient?.name, modifier.name].filter(Boolean).join(" ");
      })
      .filter(Boolean);

    return (
      <button
        key={item.uniqueId}
        type="button"
        aria-pressed={completed}
        onClick={() => toggleItem(item.uniqueId)}
        className={`w-full rounded-md px-2 py-1.5 text-left ${
          completed ? "bg-black/15 opacity-55" : "hover:bg-white/10 active:bg-white/15"
        }`}
      >
        <div className={`flex items-baseline gap-2 ${isChild ? "pl-6" : ""}`}>
          {isChild && <span className="shrink-0 text-zinc-300">↳</span>}
          {!item.hideQuantity && (
            <span className="w-6 shrink-0 text-right font-mono text-base font-bold text-zinc-200">
              {item.quantity}×
            </span>
          )}
          <span className={`text-lg font-semibold leading-snug text-white ${completed ? "line-through decoration-2" : ""}`}>
            {item.name}
            {item.zhName && !item.name.includes(item.zhName) && (
              <span className="ml-2 font-chinese text-base text-zinc-200">{item.zhName}</span>
            )}
            {item.isFoc && (
              <span className="ml-2 rounded bg-green-400/10 px-1.5 py-0.5 text-xs font-bold text-green-300">
                {item.isIncluded ? "INCLUDED" : "FOC"}
              </span>
            )}
          </span>
        </div>
        {modifiers.length > 0 && (
          <div className={`mt-1 pl-14 text-sm font-bold text-amber-300 ${completed ? "line-through" : ""}`}>
            {modifiers.join(" · ")}
          </div>
        )}
      </button>
    );
  };

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
            <div className="text-[10px] text-zinc-300 uppercase tracking-widest">Ready</div>
            <div className="font-mono font-semibold text-white text-lg tabular-nums">
              {fmtTime(readyTime)}
            </div>
          </div>
        </div>

        {/* ── Divider ─────────────────────────────────────────────── */}
        <div className="border-t border-[#6b7078]" />

        {/* ── Items ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-1">
          {topItems.map((item) => {
            const children = order.items.filter((child) => child.parentId === item.uniqueId);
            return (
              <div key={item.uniqueId} className="border-b border-white/10 pb-1 last:border-0">
                {renderItem(item)}
                {children.map((child) => renderItem(child, true))}
              </div>
            );
          })}
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
            <div className="border-t border-[#6b7078]" />
            <div className="text-zinc-200 text-base">
              {order.customerInfo.name && (
                <span className="text-zinc-300 mr-1">{order.customerInfo.name} ·</span>
              )}
              {order.customerInfo.postcode}
            </div>
            {order.customerInfo.deliveryInstructions && (
              <div className="text-zinc-300 text-sm italic">
                {order.customerInfo.deliveryInstructions}
              </div>
            )}
          </>
        )}

        {/* ── Delivery time (if specified) ─────────────────────────── */}
        {order.customerInfo?.deliveryTime && (
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <span>🕐</span>
            <span>For {order.customerInfo.deliveryTime}</span>
          </div>
        )}

        {/* ── Done button ──────────────────────────────────────────── */}
        <div className="border-t border-[#6b7078]" />
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
