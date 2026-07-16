import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";

interface OrderControlsProps {
  onDuplicateItem: () => void;
  onDecrementItem: () => void;
  onModifyItem: () => void;
  onFocItem: () => void;
  isItemSelected: boolean;
  isZeroPriceMode: boolean;
  onToggleZeroPriceMode: () => void;
  onDeleteOrder: () => void;
  isSwapMode: boolean;
  isIncMode: boolean;
  onToggleSwapMode: () => void;
  isHappyMealSelected: boolean;
  isSetMealItemSelected: boolean;
  onPreview: () => void;
}

const CLEAR_ARM_MS = 2500;

export function OrderControls({
  onDuplicateItem,
  onDecrementItem,
  onModifyItem,
  onFocItem,
  isItemSelected,
  isZeroPriceMode,
  onToggleZeroPriceMode,
  onDeleteOrder,
  isSwapMode,
  isIncMode,
  onToggleSwapMode,
  isHappyMealSelected,
  isSetMealItemSelected,
  onPreview,
}: OrderControlsProps) {
  const [clearArmed, setClearArmed] = useState(false);
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClearClick = useCallback(() => {
    if (clearArmed) {
      if (armTimerRef.current) clearTimeout(armTimerRef.current);
      setClearArmed(false);
      onDeleteOrder();
    } else {
      setClearArmed(true);
      armTimerRef.current = setTimeout(() => setClearArmed(false), CLEAR_ARM_MS);
    }
  }, [clearArmed, onDeleteOrder]);

  useEffect(() => () => { if (armTimerRef.current) clearTimeout(armTimerRef.current); }, []);

  return (
    <div className="pos-order-controls grid grid-cols-5 grid-rows-2 auto-rows-[2.25rem] gap-1 border-t border-border/60 pt-1">
      <Button
        variant="utility"
        className="row-span-2 h-full text-xl"
        onClick={onDuplicateItem}
        disabled={!isItemSelected}
      >
        +
      </Button>
      <Button
        variant="utility"
        className="row-span-2 h-full text-xl"
        onClick={onDecrementItem}
        disabled={!isItemSelected}
      >
        -
      </Button>
      <Button
        variant="utility"
        className="flex h-full flex-col gap-0 leading-none"
        onClick={onPreview}
      >
        <span className="text-xs">Preview</span>
        <span className="text-[10px] opacity-70">预览</span>
      </Button>

      <Button
        variant="utility"
        className="flex h-full flex-col gap-0 leading-none"
        onClick={onFocItem}
        disabled={!isItemSelected}
      >
        <span className="text-xs">FOC</span>
        <span className="text-[10px] opacity-70">免费</span>
      </Button>

      <Button
        variant={isZeroPriceMode ? "info" : "utility"}
        className="h-full font-bold"
        onClick={onToggleZeroPriceMode}
      >
        £0
      </Button>

      <Button
        variant="utility"
        className="flex h-full flex-col gap-0 leading-none"
        onClick={onModifyItem}
        disabled={!isItemSelected}
      >
        <span className="text-xs">Modify</span>
        <span className="text-[10px] opacity-70">修改</span>
      </Button>

      <Button
        variant={clearArmed ? "destructive-solid" : "destructive"}
        className="flex h-full flex-col gap-0 leading-none"
        onClick={handleClearClick}
      >
        <span className="text-xs font-semibold">{clearArmed ? "Sure?" : "Clear"}</span>
        <span className="text-[10px] opacity-80">{clearArmed ? "确认" : "清空"}</span>
      </Button>

      <Button
        variant={isSwapMode || isIncMode ? "info" : "utility"}
        className="flex h-full flex-col gap-0 leading-none"
        onClick={onToggleSwapMode}
        disabled={!isSwapMode && !isHappyMealSelected && !isSetMealItemSelected}
      >
        <span className="text-xs">{isHappyMealSelected ? "Inc" : "Swap"}</span>
        <span className="text-[10px] opacity-80">{isHappyMealSelected ? "包餐" : "换餐"}</span>
      </Button>
    </div>
  );
}
