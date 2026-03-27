import { useMemo, useState } from 'react';
import type { MenuItem } from '../../types';
import { MenuTable } from './menu-table';
import { CategoryStrip } from './category-strip';
import { CategoryGrid } from './category-grid';

interface RightPanelProps {
  menuItems: MenuItem[];
  onAddItem: (item: MenuItem) => void;
  onOpenMenuRef: () => void;
}

export function RightPanel({ menuItems, onAddItem, onOpenMenuRef }: RightPanelProps) {
  const [selectedPrimary, setSelectedPrimary] = useState<string | null>(null);
  const [selectedSecondary, setSelectedSecondary] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      const primaryList = [
        item.primaryCategory,
        ...(item.primaryCategories || []),
      ].filter(Boolean) as string[];
      const matchesPrimary = selectedPrimary ? primaryList.includes(selectedPrimary) : true;
      const matchesSecondary =
        selectedSecondary && selectedSecondary !== 'Show All'
          ? item.secondaryCategory === selectedSecondary
          : true;
      return matchesPrimary && matchesSecondary;
    });
  }, [menuItems, selectedPrimary, selectedSecondary]);

  const activeSelectedId = useMemo(() => {
    if (!filteredItems.length) return null;
    const exists = filteredItems.some(item => item.id === selectedId);
    return exists ? selectedId : filteredItems[0].id;
  }, [filteredItems, selectedId]);

  const handleAddSelected = () => {
    const item = filteredItems.find(menuItem => menuItem.id === activeSelectedId);
    if (item) onAddItem(item);
  };

  const handleNavigate = (direction: 'up' | 'down') => {
    if (!filteredItems.length) return;
    const currentIndex = filteredItems.findIndex(item => item.id === activeSelectedId);
    const nextIndex =
      direction === 'up'
        ? Math.max(0, currentIndex - 1)
        : Math.min(filteredItems.length - 1, currentIndex + 1);
    const nextItem = filteredItems[nextIndex];
    if (nextItem) setSelectedId(nextItem.id);
  };

  const handleSelectPrimary = (category: string) => {
    setSelectedPrimary(prev => (prev === category ? null : category));
  };

  const handleSelectSecondary = (category: string) => {
    if (category === 'Show All') {
      setSelectedPrimary(null);
      setSelectedSecondary(null);
      return;
    }
    setSelectedSecondary(prev => (prev === category ? null : category));
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <MenuTable
        items={filteredItems}
        selectedId={activeSelectedId}
        onSelect={setSelectedId}
        onAddSelected={handleAddSelected}
        onNavigate={handleNavigate}
        onOpenMenuRef={onOpenMenuRef}
        className="flex-[0_0_40%]"
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
}
