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

  const resetToShowAll = useCallback(() => {
    setSelectedPrimary(null);
    setSelectedSecondary(null);
    setSelectedId(null);
  }, []);

  const handleAddItem = useCallback(
    (item: MenuItem) => {
      onAddItem(item);
      resetToShowAll();
    },
    [onAddItem, resetToShowAll],
  );

  const handleAddSelected = useCallback(() => {
    const item = filteredItems.find((menuItem) => menuItem.id === activeSelectedId);
    if (item) handleAddItem(item);
  }, [filteredItems, activeSelectedId, handleAddItem]);

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

  const handleSelectPrimary = useCallback(
    (category: string) => {
      if (category === "Rice" || category === "Chips") {
        setSelectedSecondary(null);
      }
      setSelectedPrimary((prev) => (prev === category ? null : category));
    },
    [setSelectedSecondary],
  );

  const handleSelectSecondary = useCallback((category: string) => {
    if (category === "Show All") {
      setSelectedPrimary(null);
      setSelectedSecondary(null);
      setSelectedId(null);
      return;
    }
    setSelectedSecondary((prev) => (prev === category ? null : category));
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* Menu table — flex-[5] takes the majority of space */}
      <MenuTable
        items={filteredItems}
        selectedId={activeSelectedId}
        onSelect={setSelectedId}
        onAddSelected={handleAddSelected}
        onNavigate={handleNavigate}
        onOpenMenuRef={onOpenMenuRef}
        onAddItem={handleAddItem}
        className="min-h-0 flex-[5]"
      />
      <CategoryStrip selectedPrimary={selectedPrimary} onSelectPrimary={handleSelectPrimary} />
      {/* Category grid — flex-[4] is ~20% smaller than the original flex-1 split */}
      <div className="pos-panel min-h-0 flex-[5] p-2">
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
