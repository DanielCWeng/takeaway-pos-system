import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

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
    <div className="pos-panel flex h-full flex-col">
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
        <motion.div layout className="flex flex-col gap-1.5 p-2">
          <AnimatePresence initial={false} mode="popLayout">
            {items.map((item, index) => {
              const isSelected = selectedIndex === index;
              const isChild = !!item.parentId;

              return (
                <motion.div
                  layout
                  key={item.uniqueId || `${item.name}-${index}`}
                  ref={(el) => { itemRefs.current[index] = el; }}
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 6 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{
                    duration: 0.2,
                    ease: "circOut",
                  }}
                  className="overflow-hidden"
                >
                  <motion.button
                    onClick={() => onSelect(index)}
                    className={cn(
                      "group relative flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-xs transition-all duration-200 pos-order-row",
                      isSelected
                        ? "border-primary/40 bg-primary/10 text-foreground font-semibold shadow-sm"
                        : "border-border/40 bg-transparent text-foreground hover:bg-muted/50 hover:border-border/60",
                      isChild &&
                        "ml-4 w-[calc(100%-1rem)] border-dashed border-border/30 bg-muted/20",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute left-0 top-2 h-[calc(100%-1rem)] w-[4px] rounded-full opacity-0 transition-all",
                        isSelected
                          ? "bg-primary opacity-100 scale-y-100"
                          : "bg-primary/30 group-hover:opacity-40 scale-y-50",
                        isChild &&
                          "left-[-4px] w-[2px] h-[calc(100%+8px)] top-[-4px] rounded-none opacity-10 bg-foreground/20",
                      )}
                    />
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs font-semibold">{item.name}</p>
                        {item.isFoc && !item.isIncluded && (
                          <Badge
                            variant="outline"
                            className="bg-green-500/10 text-green-500 border-green-500/20 px-1 py-0 h-3 text-[8px] uppercase font-bold"
                          >
                            FOC
                          </Badge>
                        )}
                        {item.isIncluded && (
                          <Badge
                            variant="outline"
                            className="bg-blue-500/10 text-blue-500 border-blue-500/20 px-1 py-0 h-3 text-[8px] uppercase font-bold"
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
                  </motion.button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
});
