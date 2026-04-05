import type { KitchenOrder, OrderItem, OrderModifier, OrderStatus } from "../types/kitchen";
import { willMissWindow } from "../hooks/useCookTimer";
import { CountdownTimer } from "./CountdownTimer";
import { DeliveryBadge } from "./DeliveryBadge";
import { WaitingTime } from "./WaitingTime";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderModifier(mod: string | OrderModifier): { en: string; zh?: string } {
  if (typeof mod === "string") return { en: mod };
  if (mod.ingredient) {
    return { en: mod.ingredient.name ?? "", zh: mod.ingredient.zh };
  }
  return { en: mod.name ?? "", zh: mod.zh };
}

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  new:      "accepted",
  accepted: "cooking",
  cooking:  "ready",
  ready:    "complete",
};

const BUTTON_LABEL: Record<string, string> = {
  new:      "ACCEPT ORDER",
  accepted: "START COOKING",
  cooking:  "MARK READY",
  "ready-collection": "COMPLETE",
  "ready-delivery":   "DISPATCHED",
};

const STATUS_BAR: Partial<Record<OrderStatus, string>> = {
  new:      "bg-kitchen-new",
  accepted: "bg-kitchen-accepted",
  cooking:  "bg-kitchen-cooking",
  ready:    "bg-kitchen-ready",
};

const BUTTON_CLASS: Partial<Record<OrderStatus, string>> = {
  new:      "action-btn action-btn-new",
  accepted: "action-btn action-btn-accepted",
  cooking:  "action-btn action-btn-cooking",
  ready:    "action-btn action-btn-ready",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ItemRow({ item }: { item: OrderItem }) {
  const isChild = !!item.parentId;
  const modifiers = item.modifiers?.filter(
    (m): m is string | OrderModifier => m !== null && m !== undefined,
  ) ?? [];

  return (
    <div className={`${isChild ? "pl-4 opacity-80" : ""}`}>
      {/* Name row */}
      <div className="flex items-baseline gap-2">
        {!item.hideQuantity && (
          <span className="text-zinc-400 font-mono font-bold text-base shrink-0 w-6 text-right">
            {item.quantity}×
          </span>
        )}
        <div className="flex flex-col min-w-0">
          <span className={`font-semibold text-white leading-snug ${isChild ? "text-base" : "text-lg"}`}>
            {item.name}
            {item.isFoc && (
              <span className="ml-2 text-xs font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">
                FOC
              </span>
            )}
            {item.isSwapped && (
              <span className="ml-2 text-xs font-bold text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">
                SWAP
              </span>
            )}
          </span>
          {item.zhName && (
            <span className="font-chinese text-amber-400/70 text-sm leading-snug">
              {item.zhName}
            </span>
          )}
        </div>
      </div>

      {/* Modifiers */}
      {modifiers.length > 0 && (
        <div className="mt-1 pl-8 space-y-0.5">
          {modifiers.map((mod, i) => {
            const { en, zh } = renderModifier(mod);
            if (!en && !zh) return null;
            return (
              <div key={i} className="flex items-baseline gap-2">
                <span className="text-amber-400 text-sm">⚠</span>
                <span className="text-amber-400 font-bold text-sm uppercase tracking-wide">
                  {en}
                  {zh && (
                    <span className="font-chinese font-normal normal-case ml-2 text-amber-400/70">
                      {zh}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Early/late badge shown once order is 'ready'
function ScheduleBadge({ estimatedReadyAt, actualReadyAt }: { estimatedReadyAt: string; actualReadyAt: string }) {
  const diffMs = new Date(estimatedReadyAt).getTime() - new Date(actualReadyAt).getTime();
  const diffMin = Math.round(Math.abs(diffMs) / 60_000);
  const early = diffMs > 0;

  if (diffMin === 0) return null;

  return (
    <span
      className={[
        "text-xs font-bold px-2 py-0.5 rounded-full",
        early
          ? "bg-green-500/15 text-green-400 border border-green-500/30"
          : "bg-red-500/15 text-red-400 border border-red-500/30",
      ].join(" ")}
    >
      {early ? `✓ ${diffMin} min early` : `✗ ${diffMin} min late`}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// ETA helpers
// ---------------------------------------------------------------------------

/** Minutes of drive time per mile — conservative local estimate */
const DRIVE_MINS_PER_MILE = 3.5;

function fmtTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function deliveryEta(estimatedReadyAt: string, distanceMiles: number | null | undefined): Date | null {
  if (distanceMiles == null || distanceMiles <= 0) return null;
  const driveMs = distanceMiles * DRIVE_MINS_PER_MILE * 60_000;
  return new Date(new Date(estimatedReadyAt).getTime() + driveMs);
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

interface Props {
  kitchenOrder: KitchenOrder;
  isPriority: boolean;
  isMissWindow: boolean;
  batchWith: number[];
  onStatusChange: (orderId: number, status: OrderStatus) => void;
}

export function OrderCard({ kitchenOrder, isPriority, isMissWindow, batchWith, onStatusChange }: Props) {
  const { orderId, order, status, archivedAt, estimatedReadyAt, actualReadyAt, deadline } = kitchenOrder;
  const isDelivery = order.orderType === "delivery";

  const nextStatus = NEXT_STATUS[status];
  const labelKey =
    status === "ready"
      ? isDelivery ? "ready-delivery" : "ready-collection"
      : status;
  const buttonLabel = BUTTON_LABEL[labelKey] ?? "";

  const missWindow = willMissWindow(estimatedReadyAt, deadline, status);
  const etaDelivery = isDelivery
    ? deliveryEta(estimatedReadyAt, order.customerInfo?.distance)
    : null;
  const readyTime = new Date(estimatedReadyAt);

  // Card styling
  const cardClass = [
    "order-card",
    isPriority ? "order-card-priority" : "",
    isMissWindow && !isPriority ? "order-card-urgent" : "",
  ].filter(Boolean).join(" ");

  // Top-left status bar colour — urgent overrides status colour
  const barClass = missWindow
    ? "bg-red-500 animate-pulse-red"
    : (STATUS_BAR[status] ?? "bg-zinc-700");

  // Top items: exclude children (set meal components shown under their parent)
  const topItems = order.items.filter((i) => !i.parentId);

  return (
    <article className={cardClass}>
      {/* Status bar — left edge colour indicator */}
      <div className={`status-bar ${barClass}`} />

      {/* Card content — left-padded to clear status bar */}
      <div className="pl-3 pr-4 pt-3 pb-4 flex flex-col gap-3">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            {/* Order number */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-3xl text-white tracking-tight leading-none">
                #{String(orderId).padStart(3, "0")}
              </span>
              <DeliveryBadge orderType={order.orderType} />
              {isPriority && (
                <span className="text-xs font-bold tracking-widest uppercase text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full animate-pulse-red">
                  DO THIS NOW
                </span>
              )}
              {batchWith.length > 0 && (
                <span className="text-xs font-bold tracking-wide uppercase text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                  BATCH w/ {batchWith.map((id) => `#${String(id).padStart(3, "0")}`).join(" ")}
                </span>
              )}
            </div>

            {/* ETA row — shown while order is not yet complete */}
            {status !== "complete" && status !== "cancelled" && (
              <div className="flex items-center gap-3 text-xs text-zinc-500 flex-wrap">
                <span>
                  Ready <span className="text-zinc-300 font-semibold">{fmtTime(readyTime)}</span>
                </span>
                {etaDelivery && (
                  <>
                    <span className="text-zinc-700">·</span>
                    <span>
                      Delivery ETA{" "}
                      <span className="text-amber-400 font-semibold">{fmtTime(etaDelivery)}</span>
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Won't make window warning */}
            {missWindow && (
              <div className="flex items-center gap-1.5 text-sm font-bold text-red-400 animate-pulse-red">
                <span>⚠</span>
                <span className="uppercase tracking-wide">Won't make window</span>
              </div>
            )}

            {/* Waiting time — new orders only */}
            {status === "new" && <WaitingTime archivedAt={archivedAt} />}

            {/* Early/late badge — ready orders only */}
            {status === "ready" && actualReadyAt && (
              <ScheduleBadge estimatedReadyAt={estimatedReadyAt} actualReadyAt={actualReadyAt} />
            )}
          </div>

          {/* Countdown timer */}
          <div className="shrink-0 text-right">
            <CountdownTimer deadline={deadline} status={status} />
            <div className="text-[10px] text-zinc-600 uppercase tracking-widest mt-0.5">deadline</div>
          </div>
        </div>

        {/* ── Divider ─────────────────────────────────────────────── */}
        <div className="border-t border-[#1e1e1e]" />

        {/* ── Items ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2.5">
          {topItems.map((item) => {
            const children = order.items.filter((c) => c.parentId === item.uniqueId);
            return (
              <div key={item.uniqueId}>
                <ItemRow item={item} />
                {children.map((child) => (
                  <div key={child.uniqueId} className="mt-1.5">
                    <ItemRow item={child} />
                  </div>
                ))}
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
            <div className="border-t border-[#1e1e1e]" />
            <div className="flex items-center gap-2 text-zinc-400 text-base">
              <span className="text-zinc-600">📍</span>
              <span className="font-medium">
                {order.customerInfo.name && (
                  <span className="text-zinc-300 mr-1">{order.customerInfo.name} ·</span>
                )}
                {order.customerInfo.postcode}
              </span>
            </div>
            {order.customerInfo.deliveryInstructions && (
              <div className="text-zinc-500 text-sm pl-6 italic">
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

        {/* ── Action button ────────────────────────────────────────── */}
        {nextStatus && (
          <>
            <div className="border-t border-[#1e1e1e]" />
            <button
              onClick={() => onStatusChange(orderId, nextStatus)}
              className={[
                BUTTON_CLASS[status] ?? "action-btn",
                isPriority ? "action-btn-priority" : "",
              ].filter(Boolean).join(" ")}
            >
              {buttonLabel}
            </button>
          </>
        )}

        {/* Completed state — no button */}
        {status === "complete" && (
          <div className="text-center text-zinc-600 text-sm uppercase tracking-widest py-2">
            Complete
          </div>
        )}
      </div>
    </article>
  );
}
