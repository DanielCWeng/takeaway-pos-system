import { useEffect, useState } from "react";
import type { MenuItem, OrderStatus } from "../types/kitchen";
import { useActiveOrders } from "../hooks/useActiveOrders";
import { useBusyMode } from "../hooks/useBusyMode";
import { useStationLoad } from "../hooks/useStationLoad";
import { useBatchDetection } from "../hooks/useBatchDetection";
import { BusyModeBanner } from "./BusyModeBanner";
import { KanbanColumn } from "./KanbanColumn";
import { StationLoadPanel } from "./StationLoadPanel";

// ---------------------------------------------------------------------------
// Clock
// ---------------------------------------------------------------------------

function LiveClock() {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="text-right">
      <div className="font-mono font-bold text-2xl text-white tabular-nums leading-none">
        {time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>
      <div className="text-zinc-600 text-xs mt-0.5 tracking-wide">
        {time.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connection indicator
// ---------------------------------------------------------------------------

function ConnectionDot({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={[
          "w-2 h-2 rounded-full",
          connected ? "bg-green-500 shadow-[0_0_6px_1px_rgba(34,197,94,0.6)]" : "bg-red-500 animate-pulse",
        ].join(" ")}
      />
      <span className={`text-xs font-medium uppercase tracking-widest ${connected ? "text-green-500" : "text-red-400"}`}>
        {connected ? "Live" : "Offline"}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main board
// ---------------------------------------------------------------------------

interface Props {
  menu: MenuItem[];
}

export function KitchenBoard({ menu }: Props) {
  const { orders, isLoading, connected, busyMode, setBusyMode, updateStatus } =
    useActiveOrders(menu);

  const { busyMode: derivedBusy, priorityOrderId, missWindowIds } =
    useBusyMode(orders, busyMode);

  // Sync derived busy mode back so useActiveOrders can recalculate delivery deadlines
  useEffect(() => {
    setBusyMode(derivedBusy);
  }, [derivedBusy, setBusyMode]);

  const stationLoad = useStationLoad(orders, menu);
  const batchMap    = useBatchDetection(orders);

  // Split orders into columns
  const newOrders      = orders.filter((o) => o.status === "new");
  const cookingOrders  = orders.filter((o) => o.status === "accepted" || o.status === "cooking");
  const readyOrders    = orders.filter((o) => o.status === "ready");

  const handleStatusChange = (orderId: number, status: OrderStatus) => {
    void updateStatus(orderId, status);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-zinc-600">
          <div className="w-10 h-10 rounded-full border-2 border-zinc-700 border-t-amber-500 animate-spin" />
          <span className="text-sm uppercase tracking-widest">Connecting to kitchen...</span>
          <span className="font-chinese text-zinc-700">连接厨房系统中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-3 bg-[#0c0c0c] border-b border-[#181818] shrink-0">
        <div className="flex flex-col">
          <span className="font-bold text-white text-lg tracking-wide leading-none">
            Kitchen Screen
          </span>
          <span className="font-chinese text-zinc-600 text-sm mt-0.5">厨房显示屏</span>
        </div>

        <div className="flex items-center gap-5">
          <ConnectionDot connected={connected} />
          {derivedBusy && (
            <span className="text-xs font-bold uppercase tracking-widest text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-full">
              {orders.length} active
            </span>
          )}
          <LiveClock />
        </div>
      </header>

      {/* ── Busy mode banner ────────────────────────────────────────── */}
      {derivedBusy && <BusyModeBanner />}

      {/* ── Station load panel ──────────────────────────────────────── */}
      <StationLoadPanel load={stationLoad} />

      {/* ── Kanban columns ──────────────────────────────────────────── */}
      <main className="flex-1 flex gap-3 p-3 min-h-0 overflow-hidden">
        <KanbanColumn
          title="New"
          titleZh="新订单"
          accentClass="bg-kitchen-new"
          orders={newOrders}
          priorityOrderId={derivedBusy ? priorityOrderId : null}
          missWindowIds={missWindowIds}
          batchMap={batchMap}
          onStatusChange={handleStatusChange}
        />
        <KanbanColumn
          title="Cooking"
          titleZh="烹饪中"
          accentClass="bg-kitchen-cooking"
          orders={cookingOrders}
          priorityOrderId={derivedBusy ? priorityOrderId : null}
          missWindowIds={missWindowIds}
          batchMap={batchMap}
          onStatusChange={handleStatusChange}
        />
        <KanbanColumn
          title="Ready"
          titleZh="已就绪"
          accentClass="bg-kitchen-ready"
          orders={readyOrders}
          priorityOrderId={null}
          missWindowIds={[]}
          batchMap={batchMap}
          onStatusChange={handleStatusChange}
        />
      </main>
    </div>
  );
}
