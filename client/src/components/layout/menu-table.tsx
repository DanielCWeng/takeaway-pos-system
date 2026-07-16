import React, { useRef, useState, useLayoutEffect, useEffect } from "react";
import type { MenuItem } from "../../types";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { formatCurrency } from "../../lib/format";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";

interface MenuTableProps {
  items: MenuItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddSelected: () => void;
  onNavigate: (direction: "up" | "down", pageSize: number) => void;
  onAddItem: (item: MenuItem) => void;
  className?: string;
}

const ITEMS_PER_PAGE = 7;

const MenuTableComponent = React.forwardRef<HTMLDivElement, MenuTableProps>((props, ref) => {
  const {
    items,
    selectedId,
    onSelect,
    onAddSelected,
    onNavigate,
    onAddItem,
    className,
  } = props;

  const viewportRef = useRef<HTMLDivElement>(null);
  const firstRowRef = useRef<HTMLButtonElement>(null);
  const itemsPerPage = ITEMS_PER_PAGE;
  const [rowHeight, setRowHeight] = useState<number | null>(null);
  // Index of the first visible item — drives scrolling independently of selection
  const [viewStartIndex, setViewStartIndex] = useState(0);

  // Recalculate on resize and browser zoom so exactly seven whole rows fit.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const calculate = () => setRowHeight(viewport.clientHeight / ITEMS_PER_PAGE);
    calculate();
    const observer = new ResizeObserver(calculate);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  // Snap the view whenever the selected item falls outside the visible range.
  // Uses the "derived state during render" pattern to avoid setState-in-effect.
  const [snapDeps, setSnapDeps] = useState({ selectedId, items, itemsPerPage });
  if (snapDeps.selectedId !== selectedId || snapDeps.items !== items || snapDeps.itemsPerPage !== itemsPerPage) {
    setSnapDeps({ selectedId, items, itemsPerPage });
    const idx = selectedId ? items.findIndex((i) => i.id === selectedId) : 0;
    const safeIdx = idx === -1 ? 0 : idx;
    if (safeIdx < viewStartIndex || safeIdx >= viewStartIndex + itemsPerPage) {
      setViewStartIndex(Math.floor(safeIdx / itemsPerPage) * itemsPerPage);
    }
  }

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

  return (
    <div ref={ref} className={cn("pos-panel pos-menu-table flex h-full flex-col", className)}>
      <ScrollArea viewportRef={viewportRef} className="min-h-0 flex-1 border-t border-border/60">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-16 z-10 w-px bg-border/60" />
          <div className="pointer-events-none absolute inset-y-0 right-[9.75rem] z-10 w-px bg-border/60" />
          <div className="pointer-events-none absolute inset-y-0 right-[5.25rem] z-10 w-px bg-border/60" />
          {items.map((item, index) => {
            const isSelected = item.id === selectedId;
            const showOptions = !!item.options || !!item.contents;

            return (
              <button
                key={item.id}
                ref={index === 0 ? firstRowRef : null}
                data-id={item.id}
                style={rowHeight ? { height: `${rowHeight}px`, minHeight: 0 } : undefined}
                onClick={() => {
                  onSelect(item.id);
                  onAddItem(item);
                }}
                className={cn(
                  "group relative grid w-full snap-start grid-cols-[3.25rem_1fr_4.5rem_4.5rem] items-center border-b border-border/60 px-3 py-3 text-left text-xs pos-menu-row",
                  isSelected ? "pos-menu-row-selected" : "text-black hover:bg-yellow-200",
                )}
              >
                <span
                  className={cn(
                    "absolute left-0 top-0 h-full w-[3px] opacity-0",
                    isSelected
                      ? "bg-primary opacity-100"
                      : "bg-primary opacity-0 group-hover:opacity-20",
                  )}
                />
                <span className="pos-value font-mono text-[11px] font-semibold text-muted-foreground">
                  {item.id}
                </span>
                <div className="flex min-w-0 self-stretch items-center pl-2">
                  <p className="truncate font-semibold">{item.name.en}</p>
                </div>
                <span className="flex self-stretch items-center truncate pl-2 text-[11px] text-muted-foreground">{item.name.zh}</span>
                <span className="pos-value flex self-stretch items-center justify-end pl-2 text-right font-mono text-xs font-semibold">
                  {item.price != null
                    ? formatCurrency(item.price)
                    : showOptions
                      ? "OPTS"
                      : formatCurrency(0)}
                </span>
              </button>
            );
          })}
        </div>
      </ScrollArea>

      <div className="flex h-14 items-stretch gap-0 border-t border-border/60 p-0">
        <Button
          className="pos-menu-action h-full flex-[3] rounded-none border-y-0 border-l-0 text-xs tracking-[0.14em]"
          onClick={onAddSelected}
          disabled={!selectedId}
        >
          <Plus className="h-4 w-4" />
          Add to Order
        </Button>
        <Button
          variant="outline"
          className="pos-menu-action h-full flex-1 rounded-none border-y-0 border-l-0 p-0"
          onClick={() => {
            const currentIndex = items.findIndex((i) => i.id === selectedId);
            if (false && currentIndex === viewStartIndex && viewStartIndex > 0) {
              // At top of view — flip back, selected item stays, view scrolls back
              setViewStartIndex(Math.max(0, viewStartIndex - itemsPerPage + 1));
            } else {
              onNavigate("up", itemsPerPage);
            }
          }}
          aria-label="Move selection up"
        >
          <ChevronUp className="h-5 w-5" />
        </Button>
        <Button
          variant="outline"
          className="pos-menu-action h-full flex-1 rounded-none border-0 p-0"
          onClick={() => {
            const currentIndex = items.findIndex((i) => i.id === selectedId);
            const lastOnView = Math.min(viewStartIndex + itemsPerPage - 1, items.length - 1);
            if (false && currentIndex === lastOnView && lastOnView < items.length - 1) {
              // At bottom of view — flip forward, selected item stays, becomes first on new page
              setViewStartIndex(currentIndex);
            } else {
              onNavigate("down", itemsPerPage);
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
