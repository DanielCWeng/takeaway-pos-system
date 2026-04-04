import { Button } from '../ui/button';

interface OrderControlsProps {
  onDuplicateItem: () => void;
  onDecrementItem: () => void;
  onRemoveItem: () => void;
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
  isShortMode: boolean;
  onToggleShortMode: () => void;
}

export function OrderControls({
  onDuplicateItem,
  onDecrementItem,
  onRemoveItem,
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
  isShortMode,
  onToggleShortMode,
}: OrderControlsProps) {
  return (
    <div className="pos-order-controls grid grid-cols-5 grid-rows-2 auto-rows-[minmax(3.25rem,1fr)] gap-1 p-2 border-b border-border/60">
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
        variant={isShortMode ? "info" : "utility"}
        className="flex h-full flex-col gap-0 leading-none"
        onClick={onToggleShortMode}
      >
        <span className="text-xs">Short</span>
        <span className="text-[10px] opacity-70">短式</span>
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
        variant={isItemSelected ? "destructive-solid" : "destructive"}
        className="flex h-full flex-col gap-0 leading-none"
        onClick={onDeleteOrder}
      >
        <span className="text-xs font-semibold">Delete</span>
        <span className="text-[10px] opacity-80">删除</span>
      </Button>

      <Button
        variant={isSwapMode || isIncMode ? "info" : "utility"}
        className="flex h-full flex-col gap-0 leading-none"
        onClick={onToggleSwapMode}
        disabled={!isSwapMode && !isHappyMealSelected && !isSetMealItemSelected}
      >
        <span className="text-xs">{isHappyMealSelected ? 'Inc' : 'Swap'}</span>
        <span className="text-[10px] opacity-80">{isHappyMealSelected ? '包餐' : '换餐'}</span>
      </Button>
    </div>
  );
}
