import React, { useMemo, useState, useCallback } from "react";
import type { MenuItem } from "../../types";
import { MenuTable } from "./menu-table";
import { CategoryStrip } from "./category-strip";
import { CategoryGrid } from "./category-grid";

interface RightPanelProps {
  menuItems: MenuItem[];
  onAddItem: (item: MenuItem) => void;
  onOpenMenuRef: () => void;
}

export const RightPanel = React.memo(function RightPanel({
  menuItems,
  onAddItem,
  onOpenMenuRef,
}: RightPanelProps) {
  const [selectedPrimary, setSelectedPrimary] = useState<string | null>(null);
  const [selectedSecondary, setSelectedSecondary] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [heightAdjustment, setHeightAdjustment] = useState(0);

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const primaryList = [item.primaryCategory, ...(item.primaryCategories || [])].filter(
        Boolean,
      ) as string[];
      const matchesPrimary = selectedPrimary ? primaryList.includes(selectedPrimary) : true;
      const matchesSecondary =
        selectedSecondary && selectedSecondary !== "Show All"
          ? item.secondaryCategory === selectedSecondary
          : true;
      return matchesPrimary && matchesSecondary;
    });
  }, [menuItems, selectedPrimary, selectedSecondary]);

  const activeSelectedId = useMemo(() => {
    if (!filteredItems.length) return null;
    const exists = filteredItems.some((item) => item.id === selectedId);
    return exists ? selectedId : filteredItems[0].id;
  }, [filteredItems, selectedId]);

  const handleAddSelected = useCallback(() => {
    const item = filteredItems.find((menuItem) => menuItem.id === activeSelectedId);
    if (item) onAddItem(item);
  }, [filteredItems, activeSelectedId, onAddItem]);

  const handleNavigate = useCallback(
    (direction: "up" | "down", pageSize: number = 1) => {
      if (!filteredItems.length) return;
      const currentIndex = filteredItems.findIndex((item) => item.id === activeSelectedId);
      const nextIndex =
        direction === "up"
          ? Math.max(0, currentIndex - pageSize)
          : Math.min(filteredItems.length - 1, currentIndex + pageSize);
      const nextItem = filteredItems[nextIndex];
      if (nextItem) setSelectedId(nextItem.id);
    },
    [filteredItems, activeSelectedId],
  );

  const handleSelectPrimary = useCallback((category: string) => {
    setSelectedPrimary((prev) => (prev === category ? null : category));
  }, []);

  const handleSelectSecondary = useCallback((category: string) => {
    if (category === "Show All") {
      setSelectedPrimary(null);
      setSelectedSecondary(null);
      return;
    }
    setSelectedSecondary((prev) => (prev === category ? null : category));
  }, []);

  const handleHeightAdjust = useCallback((adjustment: number) => {
    setHeightAdjustment((prev) => {
      // Prevent infinite loops or micro-oscillation by only updating if difference is significant
      return Math.abs(prev - adjustment) > 1 ? adjustment : prev;
    });
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <MenuTable
        items={filteredItems}
        selectedId={activeSelectedId}
        onSelect={setSelectedId}
        onAddSelected={handleAddSelected}
        onNavigate={handleNavigate}
        onOpenMenuRef={onOpenMenuRef}
        onAddItem={onAddItem}
        onHeightAdjust={handleHeightAdjust}
        className="transition-all duration-300 ease-in-out"
        style={{
          flex: `0 0 calc(40% + ${heightAdjustment}px)`,
        }}
      />
      <CategoryStrip selectedPrimary={selectedPrimary} onSelectPrimary={handleSelectPrimary} />
      <div className="pos-panel min-h-0 flex-1 p-2">
        <CategoryGrid
          page={page}
          selectedSecondary={selectedSecondary}
          onSelectSecondary={handleSelectSecondary}
          onChangePage={setPage}
        />
      </div>
    </div>
  );
});
