import React, { useMemo, useState, useCallback } from "react";
import type { MenuItem } from "../../types";
import { MenuTable } from "./menu-table";
import { CategoryStrip } from "./category-strip";
import { CategoryGrid } from "./category-grid";
import { cn } from "../../lib/utils";

interface RightPanelProps {
  menuItems: MenuItem[];
  onAddItem: (item: MenuItem) => void;
}

const REF_KEY_ROWS = [
  ["1", "2", "3", "C", "E"],
  ["4", "5", "6", "H", "M"],
  ["7", "8", "9", "S", "T"],
];

export const RightPanel = React.memo(function RightPanel({
  menuItems,
  onAddItem,
}: RightPanelProps) {
  const [selectedPrimary, setSelectedPrimary] = useState<string | null>(null);
  const [selectedSecondary, setSelectedSecondary] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isRefMode, setIsRefMode] = useState(false);
  const [refCode, setRefCode] = useState("");

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (isRefMode && refCode) {
        return item.id.toUpperCase().startsWith(refCode);
      }
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
  }, [menuItems, selectedPrimary, selectedSecondary, isRefMode, refCode]);

  const activeSelectedId = useMemo(() => {
    if (!filteredItems.length) return null;
    const exists = filteredItems.some((item) => item.id === selectedId);
    return exists ? selectedId : filteredItems[0].id;
  }, [filteredItems, selectedId]);

  const resetToShowAll = useCallback(() => {
    setSelectedPrimary(null);
    setSelectedSecondary(null);
    setSelectedId(null);
    setIsRefMode(false);
    setRefCode("");
  }, []);

  const handleRefKey = useCallback((key: string) => {
    setRefCode((current) => {
      const candidate = `${current}${key}`;
      const hasCandidate = menuItems.some((item) =>
        item.id.toUpperCase().startsWith(candidate),
      );
      if (hasCandidate) return candidate;
      const hasRestart = menuItems.some((item) => item.id.toUpperCase().startsWith(key));
      return hasRestart ? key : "";
    });
    setSelectedId(null);
  }, [menuItems]);

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
    (direction: "up" | "down", pageSize: number = 7) => {
      if (!filteredItems.length) return;
      const currentIndex = filteredItems.findIndex((item) => item.id === activeSelectedId);
      const pageStart = Math.floor(currentIndex / pageSize) * pageSize;
      const pageEnd = Math.min(filteredItems.length - 1, pageStart + pageSize - 1);
      const nextIndex = direction === "up"
        ? currentIndex > pageStart
          ? pageStart
          : Math.max(0, currentIndex - 1)
        : currentIndex < pageEnd
          ? pageEnd
          : Math.min(filteredItems.length - 1, currentIndex + 1);
      const nextItem = filteredItems[nextIndex];
      if (nextItem) setSelectedId(nextItem.id);
    },
    [filteredItems, activeSelectedId],
  );

  const handleSelectPrimary = useCallback(
    (category: string) => {
      const shortcutId = category === "Rice" ? "232" : category === "Chips" ? "234" : null;
      if (shortcutId) {
        const shortcutItem = menuItems.find((item) => item.id === shortcutId);
        if (shortcutItem) handleAddItem(shortcutItem);
        return;
      }
      setSelectedPrimary((prev) => (prev === category ? null : category));
    },
    [menuItems, handleAddItem],
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
        onAddItem={handleAddItem}
        className="min-h-0 flex-[5]"
      />
      <CategoryStrip
        selectedPrimary={selectedPrimary}
        onSelectPrimary={handleSelectPrimary}
        isRefMode={isRefMode}
        onOpenRef={() => {
          setIsRefMode(true);
          setRefCode("");
          setSelectedId(null);
        }}
        onShowGrid={() => {
          setIsRefMode(false);
          setRefCode("");
          setSelectedId(null);
        }}
      />
      {/* Category grid — flex-[4] is ~20% smaller than the original flex-1 split */}
      <div className="pos-panel min-h-0 flex-[5] p-2">
        {isRefMode ? (
          <div className="flex h-full min-h-0 flex-col gap-1">
            <div className="flex h-10 items-center border-2 border-border bg-white px-3 font-mono text-xl font-bold uppercase">
              {refCode || "REF"}
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-5 grid-rows-4 gap-1">
              {REF_KEY_ROWS.flat().map((key, index) => {
                const isLetter = index % 5 >= 3;
                return (
                  <button
                    key={key}
                    onClick={() => handleRefKey(key)}
                    className={cn(
                      "pos-grid-btn text-base font-bold text-black",
                      isLetter ? "bg-blue-300" : "bg-green-400",
                    )}
                  >
                    {key}
                  </button>
                );
              })}
              <button
                onClick={() => setRefCode("")}
                className="pos-grid-btn bg-red-400 text-sm font-bold text-black"
              >
                Clear
              </button>
              <button
                onClick={() => handleRefKey("0")}
                className="pos-grid-btn bg-green-400 text-base font-bold text-black"
              >
                0
              </button>
              <button
                onClick={() => setRefCode((current) => current.slice(0, -1))}
                className="pos-grid-btn col-span-3 bg-yellow-300 text-sm font-bold text-black"
              >
                Backspace
              </button>
            </div>
          </div>
        ) : (
          <CategoryGrid
            page={page}
            selectedSecondary={selectedSecondary}
            onSelectSecondary={handleSelectSecondary}
            onChangePage={setPage}
          />
        )}
      </div>
    </div>
  );
});
