import React, { useRef, useState, useLayoutEffect, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { MenuItem } from "../../types";
import { ChevronDown, ChevronUp, Plus, BookOpen } from "lucide-react";
import { formatCurrency } from "../../lib/format";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";

interface MenuTableProps {
  items: MenuItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddSelected: () => void;
  onNavigate: (direction: "up" | "down", pageSize: number) => void;
  onOpenMenuRef: () => void;
  onAddItem: (item: MenuItem) => void;
  className?: string;
  onHeightAdjust?: (adjustment: number) => void;
  style?: React.CSSProperties;
}

const MenuTableComponent = React.forwardRef<HTMLDivElement, MenuTableProps>((props, ref) => {
  const {
    items,
    selectedId,
    onSelect,
    onAddSelected,
    onNavigate,
    onOpenMenuRef,
    onAddItem,
    className,
    onHeightAdjust,
    style,
  } = props;

  const empty = "\u2014";
  const viewportRef = useRef<HTMLDivElement>(null);
  const firstRowRef = useRef<HTMLButtonElement>(null);
  const [itemsPerPage, setItemsPerPage] = useState(1);

  // Measure row and viewport height to calculate visible items
  useLayoutEffect(() => {
    const calculateItems = () => {
      if (viewportRef.current && firstRowRef.current) {
        const viewportHeight = viewportRef.current.clientHeight;
        const rowHeight = firstRowRef.current.offsetHeight;
        if (rowHeight > 0) {
          const count = Math.floor(viewportHeight / rowHeight);
          const remainder = viewportHeight % rowHeight;
          setItemsPerPage(Math.max(1, count));

          if (onHeightAdjust) {
            const adjustment = remainder > rowHeight / 2 ? rowHeight - remainder : -remainder;
            onHeightAdjust(adjustment);
          }
        }
      }
    };

    calculateItems();

    // Recalculate on window resize
    window.addEventListener("resize", calculateItems);
    return () => window.removeEventListener("resize", calculateItems);
  }, [items, onHeightAdjust]);

  // Scroll current selection into view
  useEffect(() => {
    if (selectedId && viewportRef.current) {
      const selectedEl = viewportRef.current.querySelector(`[data-id="${selectedId}"]`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    }
  }, [selectedId]);

  // Calculate the current visible range for the indicator
  const { rangeText, pageKey } = useMemo(() => {
    if (!items.length) return { rangeText: "0 items", pageKey: "empty" };

    const currentIndex = selectedId ? items.findIndex((item) => item.id === selectedId) : 0;
    const safeIndex = currentIndex === -1 ? 0 : currentIndex;

    const start = safeIndex + 1;
    const end = Math.min(safeIndex + itemsPerPage, items.length);
    const total = items.length;

    return {
      rangeText: `${start}-${end} of ${total}`,
      pageKey: Math.floor(safeIndex / itemsPerPage),
    };
  }, [items, selectedId, itemsPerPage]);

  return (
    <div ref={ref} className={cn("pos-panel flex h-full flex-col", className)} style={style}>
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="pos-kicker">Menu</span>
          <span className="font-display text-sm font-semibold tracking-tight text-foreground">
            Items
          </span>
        </div>
        <Badge
          variant="accent"
          className="font-mono text-[10px] px-2 py-0.5 whitespace-nowrap min-w-0"
        >
          {rangeText}
        </Badge>
      </div>

      <div className="grid grid-cols-[3.25rem_1fr_4.5rem_4.5rem] gap-2 border-b border-border/60 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        <span>ID</span>
        <span>Name</span>
        <span>CN</span>
        <span className="text-right">Price</span>
      </div>

      <ScrollArea viewportRef={viewportRef} className="min-h-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={pageKey}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="divide-y divide-border/40"
          >
            {items.map((item, index) => {
              const isSelected = item.id === selectedId;
              const showOptions = !!item.options || !!item.contents;

              return (
                <button
                  key={item.id}
                  ref={index === 0 ? firstRowRef : null}
                  data-id={item.id}
                  onClick={() => {
                    onSelect(item.id);
                    onAddItem(item);
                  }}
                  className={cn(
                    "group relative grid w-full grid-cols-[3.25rem_1fr_4.5rem_4.5rem] items-center gap-2 px-3 py-2 text-left text-xs transition-all duration-300 pos-menu-row",
                    isSelected ? "bg-primary/10 text-foreground" : "hover:bg-white/5",
                  )}
                >
                  <span
                    className={cn(
                      "absolute left-0 top-0 h-full w-[3px] opacity-0 transition-opacity",
                      isSelected
                        ? "bg-primary opacity-100 shadow-[0_0_15px_hsl(var(--primary))]"
                        : "bg-primary opacity-0 group-hover:opacity-20",
                    )}
                  />
                  <span className="pos-value font-mono text-[11px] font-semibold text-muted-foreground">
                    {item.id}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{item.name.en}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {item.secondaryCategory || empty}
                    </p>
                  </div>
                  <span className="truncate text-[11px] text-muted-foreground">{item.name.zh}</span>
                  <span className="pos-value text-right font-mono text-xs font-semibold">
                    {item.price != null
                      ? formatCurrency(item.price)
                      : showOptions
                        ? "OPTS"
                        : formatCurrency(0)}
                  </span>
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </ScrollArea>

      <div className="flex items-center gap-2 border-t border-border/60 px-3 py-2">
        <Button
          variant="outline"
          size="sm"
          className="pos-menu-action h-10 px-3 text-xs"
          onClick={onOpenMenuRef}
        >
          <BookOpen className="h-4 w-4" />
          Ref
        </Button>
        <Button
          className="pos-menu-action h-10 flex-1 text-xs tracking-[0.14em]"
          onClick={onAddSelected}
          disabled={!selectedId}
        >
          <Plus className="h-4 w-4" />
          Add to Order
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="pos-menu-action h-10 w-10 flex flex-col items-center justify-center p-0"
          onClick={() => onNavigate("up", itemsPerPage)}
          aria-label="Move selection up"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="pos-menu-action h-10 w-10 flex flex-col items-center justify-center p-0"
          onClick={() => onNavigate("down", itemsPerPage)}
          aria-label="Move selection down"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});

MenuTableComponent.displayName = "MenuTable";

export const MenuTable = React.memo(MenuTableComponent);
