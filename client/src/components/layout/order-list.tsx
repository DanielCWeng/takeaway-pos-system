import React, { useEffect, useRef } from "react";
import type { OrderItem } from "../../types";
import { formatCurrency } from "../../lib/format";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";

interface OrderListProps {
  items: OrderItem[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

export const OrderList = React.memo(function OrderList({
  items,
  selectedIndex,
  onSelect,
}: OrderListProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (selectedIndex === null) return;
    const el = itemRefs.current[selectedIndex];
    const viewport = viewportRef.current;
    if (!el || !viewport) return;

    const elTop = el.offsetTop;
    const elBottom = elTop + el.offsetHeight;
    const vpTop = viewport.scrollTop;
    const vpBottom = vpTop + viewport.clientHeight;

    if (elTop < vpTop) {
      viewport.scrollTop = elTop - 8;
    } else if (elBottom > vpBottom) {
      viewport.scrollTop = elBottom - viewport.clientHeight + 8;
    }
  }, [selectedIndex]);

  return (
    <div className="pos-panel pos-order-list flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="pos-kicker">Items</span>
          <span className="font-display text-sm font-semibold tracking-tight text-foreground">
            Current Order
          </span>
        </div>
        <Badge variant="accent" className="font-mono text-[11px]">
          {items.length}
        </Badge>
      </div>
      <div
        ref={viewportRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted/65 [&::-webkit-scrollbar-thumb:hover]:bg-accent/60"
        style={{ touchAction: "pan-y", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        <div className="flex min-h-full flex-col">
          {items.length === 0 && (
            <div className="h-11 w-full flex-none border-b border-blue-800 bg-blue-600" />
          )}
          {items.map((item, index) => {
              const isSelected = selectedIndex === index;
              const isChild = !!item.parentId;

              return (
                <button
                  key={item.uniqueId || `${item.name}-${index}`}
                  ref={(el) => { itemRefs.current[index] = el; }}
                  onClick={() => onSelect(index)}
                  className={cn(
                    "group relative flex w-full flex-none items-center justify-between border-x-0 border-t-0 border-b px-3 py-2.5 text-left text-xs pos-order-row",
                    isSelected
                      ? "pos-order-row-selected border-blue-800 font-semibold"
                      : "border-border/40 bg-transparent text-foreground hover:bg-blue-300",
                    isChild && "pl-7",
                  )}
                >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs font-semibold">{item.name}</p>
                        {item.isFoc && !item.isIncluded && (
                          <Badge
                            variant="outline"
                            className="bg-green-200 text-green-800 border-green-600 px-1 py-0 h-3 text-[8px] uppercase font-bold"
                          >
                            FOC
                          </Badge>
                        )}
                        {item.isIncluded && (
                          <Badge
                            variant="outline"
                            className="bg-yellow-200 text-yellow-800 border-yellow-600 px-1 py-0 h-3 text-[8px] uppercase font-bold"
                          >
                            Inc
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Qty <span className="pos-value font-mono">{item.quantity}</span>
                      </p>
                    </div>
                    <div className="pos-value flex flex-col items-end whitespace-nowrap font-mono text-xs font-semibold">
                      <span className={cn(item.price === 0 && "text-green-500/80")}>
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
});
