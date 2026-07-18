import React from "react";
import { SECONDARY_CATEGORY_PAGES } from "../../constants/menu-categories";
import { cn } from "../../lib/utils";

interface CategoryGridProps {
  page: number;
  selectedSecondary: string | null;
  onSelectSecondary: (category: string) => void;
  onChangePage: (nextPage: number) => void;
}

export const CategoryGrid = React.memo(function CategoryGrid({
  page,
  selectedSecondary,
  onSelectSecondary,
  onChangePage,
}: CategoryGridProps) {
  const categories = SECONDARY_CATEGORY_PAGES[page] || [];

  return (
    <div className="grid h-full grid-cols-7 grid-rows-5 gap-px bg-gray-500 p-px">
      {categories.map((category, index) => {
        const isPager = category.en === "<<" || category.en === ">>";
        const isEmpty = !category.en;
        const isSelected = selectedSecondary === category.en;
        const handleClick = () => {
          if (isPager) {
            const nextPage =
              category.en === ">>"
                ? Math.min(SECONDARY_CATEGORY_PAGES.length - 1, page + 1)
                : Math.max(0, page - 1);
            onChangePage(nextPage);
            return;
          }
          if (!isEmpty) onSelectSecondary(category.en);
        };

        return (
          <button
            key={`${category.en}-${index}`}
            disabled={isEmpty}
            onClick={handleClick}
            className={cn(
              "relative flex h-full w-full flex-col items-center justify-center border-0 px-1 text-center text-[11px] font-semibold transition-none pos-grid-btn",
              isEmpty
                ? "cursor-not-allowed opacity-20 bg-muted"
                : isSelected
                  ? "bg-blue-600 text-white"
                  : isPager
                    ? "bg-red-400"
                    : category.en === "Show All"
                      ? "bg-orange-400 text-black"
                      : "bg-green-300 text-black",
            )}
          >
            <span className="font-display text-sm tracking-tight">{category.zh}</span>
            <span className="pos-kicker text-[10px]">{category.en}</span>
          </button>
        );
      })}
    </div>
  );
});
