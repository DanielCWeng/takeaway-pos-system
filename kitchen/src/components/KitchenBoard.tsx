import { useEffect, useState } from "react";
import type { MenuItem } from "../types/kitchen";
import { useActiveOrders } from "../hooks/useActiveOrders";
import { OrderCard } from "./OrderCard";

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
  const { orders, isLoading, connected, updateStatus } = useActiveOrders(menu);

  const handleDone = (orderId: number) => {
    void updateStatus(orderId, "complete");
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
          {orders.length > 0 && (
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-400 bg-zinc-800 border border-zinc-700/40 px-3 py-1 rounded-full">
              {orders.length} active
            </span>
          )}
          <ConnectionDot connected={connected} />
          <LiveClock />
        </div>
      </header>

      {/* ── Order grid ──────────────────────────────────────────────── */}
      <main className="flex-1 p-4 overflow-y-auto min-h-0">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-700 gap-3">
            <span className="text-5xl">○</span>
            <span className="text-sm uppercase tracking-widest">No active orders</span>
            <span className="font-chinese text-zinc-800">暂无订单</span>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
            {orders.map((o) => (
              <OrderCard key={o.orderId} kitchenOrder={o} onDone={handleDone} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
