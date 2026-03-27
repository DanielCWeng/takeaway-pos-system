import React from 'react';
import { SECONDARY_CATEGORY_PAGES } from '../../constants/menu-categories';
import { cn } from '../../lib/utils';

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
    <div className="grid h-full grid-cols-7 grid-rows-5 gap-2">
      {categories.map((category, index) => {
        const isPager = category.en === '<<' || category.en === '>>';
        const isEmpty = !category.en;
        const isSelected = selectedSecondary === category.en;
        const handleClick = () => {
          if (isPager) {
            const nextPage =
              category.en === '>>'
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
              'relative flex h-full w-full flex-col items-center justify-center rounded-md px-1 text-center text-[11px] font-semibold transition pos-grid-btn',
              isEmpty
                ? 'cursor-not-allowed opacity-30 border-white/5 bg-white/5'
                : isSelected
                ? 'pos-btn-tactile-primary'
                : isPager
                ? 'pos-btn-tactile text-muted-foreground opacity-80 hover:opacity-100 hover:bg-white/10'
                : category.en === 'Show All'
                ? 'pos-btn-tactile text-primary'
                : 'pos-btn-tactile hover:bg-white/5 text-foreground',
            )}
          >
            <span className="font-display text-sm tracking-tight">{category.zh}</span>
            <span className="pos-kicker text-[10px]">
              {category.en}
            </span>
          </button>
        );
      })}
    </div>
  );
});
