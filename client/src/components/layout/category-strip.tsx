import React, { useEffect, useRef, useState } from "react";
import { PRIMARY_CATEGORIES } from "../../constants/menu-categories";
import { cn } from "../../lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import {
  ChickenIcon,
  BeefIcon,
  PorkIcon,
  DuckIcon,
  LambIcon,
  KingPrawnIcon,
  ShrimpIcon,
  FishIcon,
  MushroomIcon,
  VegIcon,
  SpecialIcon,
  RiceIcon,
  ChipsIcon,
} from "../icons";
import type { AnimatedIconProps } from "../icons/chicken-icon";

type IconComponent = React.FC<AnimatedIconProps>;

const ICON_MAP: Record<string, IconComponent> = {
  Chicken: ChickenIcon,
  Beef: BeefIcon,
  Pork: PorkIcon,
  Duck: DuckIcon,
  Lamb: LambIcon,
  "King Prawn": KingPrawnIcon,
  Shrimp: ShrimpIcon,
  Fish: FishIcon,
  Mushroom: MushroomIcon,
  Veg: VegIcon,
  Special: SpecialIcon,
  Rice: RiceIcon,
  Chips: ChipsIcon,
};

const DEFAULT_ANIMATION_DURATION_MS = 1400;
const ICON_DURATION_MS: Record<string, number> = {
  Duck: 1200,
};
const ANIMATION_BREAK_MS = 1000;

interface CategoryStripProps {
  selectedPrimary: string | null;
  onSelectPrimary: (category: string) => void;
}

export const CategoryStrip = React.memo(function CategoryStrip({
  selectedPrimary,
  onSelectPrimary,
}: CategoryStripProps) {
  const [animationKeys, setAnimationKeys] = useState<Record<string, number>>({});
  const animationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCategoryClick = (categoryName: string) => {
    onSelectPrimary(categoryName);
  };

  useEffect(() => {
    if (!selectedPrimary) {
      if (animationTimer.current) {
        clearTimeout(animationTimer.current);
        animationTimer.current = null;
      }
      return;
    }

    // Ensure the selected category has a counter entry so the key flips when it becomes active.
    const initTimer = setTimeout(() => {
      setAnimationKeys((prev) => ({
        ...prev,
        [selectedPrimary]: prev[selectedPrimary] ?? 0,
      }));
    }, 0);

    const cycleMs =
      (ICON_DURATION_MS[selectedPrimary] ?? DEFAULT_ANIMATION_DURATION_MS) + ANIMATION_BREAK_MS;

    const scheduleNext = () => {
      setAnimationKeys((prev) => ({
        ...prev,
        [selectedPrimary]: (prev[selectedPrimary] ?? 0) + 1,
      }));
      animationTimer.current = setTimeout(scheduleNext, cycleMs);
    };

    animationTimer.current = setTimeout(scheduleNext, cycleMs);

    return () => {
      clearTimeout(initTimer);
      if (animationTimer.current) {
        clearTimeout(animationTimer.current);
        animationTimer.current = null;
      }
    };
  }, [selectedPrimary]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="pos-panel p-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          {PRIMARY_CATEGORIES.map((category) => {
            const isActive = selectedPrimary === category.name;
            const IconComponent = ICON_MAP[category.name];
            const animationKey = animationKeys[category.name] ?? 0;

            return (
              <Tooltip key={category.name}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleCategoryClick(category.name)}
                    aria-label={category.name}
                    className={cn(
                      "relative flex h-12 w-12 flex-shrink-0 flex-col items-center justify-center gap-1 rounded-xl text-xl leading-none transition pos-category-pill",
                      isActive
                        ? "pos-btn-tactile-primary"
                        : "pos-btn-tactile text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {IconComponent ? (
                      <IconComponent
                        key={`${category.name}-${animationKey}-${isActive ? "on" : "off"}`}
                        isAnimating={isActive}
                        className="h-8 w-8"
                      />
                    ) : (
                      <span>{category.icon}</span>
                    )}
                    <span className="pos-category-label hidden">{category.name}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>{category.name}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
});
