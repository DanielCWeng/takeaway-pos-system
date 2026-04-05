import React, { useRef, useState, useLayoutEffect, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
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
  } = props;

  const viewportRef = useRef<HTMLDivElement>(null);
  const firstRowRef = useRef<HTMLButtonElement>(null);
  const [itemsPerPage, setItemsPerPage] = useState(1);
  // Index of the first visible item — drives scrolling independently of selection
  const [viewStartIndex, setViewStartIndex] = useState(0);

  // Measure how many whole rows fit so the range badge stays accurate
  useLayoutEffect(() => {
    const calculate = () => {
      if (viewportRef.current && firstRowRef.current) {
        const viewportHeight = viewportRef.current.clientHeight;
        const rowHeight = firstRowRef.current.offsetHeight;
        if (rowHeight > 0) {
          setItemsPerPage(Math.max(1, Math.floor(viewportHeight / rowHeight)));
        }
      }
    };
    calculate();
    window.addEventListener("resize", calculate);
    return () => window.removeEventListener("resize", calculate);
  }, []);

  // Keep a ref so the snap effect can read viewStartIndex without depending on it
  const viewStartIndexRef = useRef(viewStartIndex);
  viewStartIndexRef.current = viewStartIndex;

  // Snap the view whenever the selected item is outside the visible range.
  // This covers category switches, Show All, and any external selection jump.
  // It does NOT fire on normal within-page navigation (selection stays in range).
  useEffect(() => {
    const idx = selectedId ? items.findIndex((i) => i.id === selectedId) : 0;
    const safeIdx = idx === -1 ? 0 : idx;
    const vsi = viewStartIndexRef.current;
    if (safeIdx < vsi || safeIdx >= vsi + itemsPerPage) {
      setViewStartIndex(Math.floor(safeIdx / itemsPerPage) * itemsPerPage);
    }
  }, [selectedId, items, itemsPerPage]);

  // Distinguish programmatic scrolls from user scrolls to avoid feedback loops
  const isProgrammaticScroll = useRef(false);

  // Apply scroll snap + sync viewStartIndex when user manually scrolls
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.style.scrollSnapType = "y mandatory";

    const onScroll = () => {
      if (isProgrammaticScroll.current) return;
      if (!firstRowRef.current) return;
      const rowHeight = firstRowRef.current.offsetHeight;
      if (rowHeight <= 0) return;
      const newStart = Math.round(viewport.scrollTop / rowHeight);
      setViewStartIndex(newStart);
    };

    viewport.addEventListener("scroll", onScroll);
    return () => viewport.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll only when viewStartIndex changes programmatically
  useEffect(() => {
    if (!viewportRef.current) return;
    const anchor = items[viewStartIndex];
    if (!anchor) return;
    const el = viewportRef.current.querySelector(`[data-id="${anchor.id}"]`);
    if (!el) return;
    isProgrammaticScroll.current = true;
    el.scrollIntoView({ block: "start", behavior: "instant" });
    requestAnimationFrame(() => { isProgrammaticScroll.current = false; });
  }, [viewStartIndex, items]);

  const { rangeText, pageKey } = useMemo(() => {
    if (!items.length) return { rangeText: "0 items", pageKey: "empty" };
    const end = Math.min(viewStartIndex + itemsPerPage, items.length);
    return {
      rangeText: `${viewStartIndex + 1}-${end} of ${items.length}`,
      pageKey: viewStartIndex,
    };
  }, [items, viewStartIndex, itemsPerPage]);

  return (
    <div ref={ref} className={cn("pos-panel flex h-full flex-col", className)}>
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="pos-kicker">Menu</span>
          <span className="font-display text-sm font-semibold tracking-tight text-foreground">
            Items
          </span>
        </div>
        <Badge variant="accent" className="font-mono text-[10px] px-2 py-0.5 whitespace-nowrap min-w-0">
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
        <motion.div
          key={pageKey}
          initial={{ opacity: 0.6, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
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
                  "group relative grid w-full snap-start grid-cols-[3.25rem_1fr_4.5rem_4.5rem] items-center gap-2 px-3 py-3 text-left text-xs transition-all duration-300 pos-menu-row",
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
          className="pos-menu-action h-10 flex-[3] text-xs tracking-[0.14em]"
          onClick={onAddSelected}
          disabled={!selectedId}
        >
          <Plus className="h-4 w-4" />
          Add to Order
        </Button>
        <Button
          variant="outline"
          className="pos-menu-action h-10 flex-1 p-0"
          onClick={() => {
            const currentIndex = items.findIndex((i) => i.id === selectedId);
            if (currentIndex === viewStartIndex && viewStartIndex > 0) {
              // At top of view — flip back, selected item stays, view scrolls back
              setViewStartIndex(Math.max(0, viewStartIndex - itemsPerPage + 1));
            } else {
              onNavigate("up", 1);
            }
          }}
          aria-label="Move selection up"
        >
          <ChevronUp className="h-5 w-5" />
        </Button>
        <Button
          variant="outline"
          className="pos-menu-action h-10 flex-1 p-0"
          onClick={() => {
            const currentIndex = items.findIndex((i) => i.id === selectedId);
            const lastOnView = Math.min(viewStartIndex + itemsPerPage - 1, items.length - 1);
            if (currentIndex === lastOnView && lastOnView < items.length - 1) {
              // At bottom of view — flip forward, selected item stays, becomes first on new page
              setViewStartIndex(currentIndex);
            } else {
              onNavigate("down", 1);
            }
          }}
          aria-label="Move selection down"
        >
          <ChevronDown className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
});

MenuTableComponent.displayName = "MenuTable";

export const MenuTable = React.memo(MenuTableComponent);
