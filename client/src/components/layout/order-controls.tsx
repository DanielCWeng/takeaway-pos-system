import { cn } from '../../lib/utils';
import { Button } from '../ui/button';

interface OrderControlsProps {
  onDuplicateItem: () => void;
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
        variant="secondary"
        className="row-span-2 h-full text-xl"
        onClick={onDuplicateItem}
        disabled={!isItemSelected}
      >
        +
      </Button>
      <Button
        variant="secondary"
        className="row-span-2 h-full text-xl"
        onClick={onRemoveItem}
        disabled={!isItemSelected}
      >
        -
      </Button>

      <Button
        variant={isShortMode ? "default" : "secondary"}
        className={cn(
          "flex h-full flex-col gap-0 leading-none",
          isShortMode && "bg-yellow-500 hover:bg-yellow-600 text-black"
        )}
        onClick={onToggleShortMode}
      >
        <span className="text-xs">Short</span>
        <span className="text-[10px] text-muted-foreground">短式</span>
      </Button>

      <Button
        variant="secondary"
        className="flex h-full flex-col gap-0 leading-none"
        onClick={onFocItem}
        disabled={!isItemSelected}
      >
        <span className="text-xs">FOC</span>
        <span className="text-[10px] text-muted-foreground">免费</span>
      </Button>

      <Button
        variant={isZeroPriceMode ? "default" : "secondary"}
        className={cn("h-full font-bold", isZeroPriceMode && "bg-yellow-500 hover:bg-yellow-600 text-black")}
        onClick={onToggleZeroPriceMode}
      >
        £0
      </Button>

      <Button
        variant="secondary"
        className="flex h-full flex-col gap-0 leading-none"
        onClick={onModifyItem}
        disabled={!isItemSelected}
      >
        <span className="text-xs">Modify</span>
        <span className="text-[10px] text-muted-foreground">修改</span>
      </Button>

      <Button
        variant="destructive"
        className="flex h-full flex-col gap-0 bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-400 leading-none"
        onClick={onDeleteOrder}
      >
        <span className="text-xs font-semibold">Delete</span>
        <span className="text-[10px] opacity-80">删除</span>
      </Button>

      <Button
        variant={isSwapMode || isIncMode ? "default" : "secondary"}
        className={cn(
          "flex h-full flex-col gap-0 leading-none",
          (isSwapMode || isIncMode) && "bg-yellow-500 hover:bg-yellow-600 text-black"
        )}
        onClick={onToggleSwapMode}
        disabled={!isSwapMode && !isHappyMealSelected && !isSetMealItemSelected}
      >
        <span className="text-xs">{isHappyMealSelected ? 'Inc' : 'Swap'}</span>
        <span className="text-[10px] opacity-80">{isHappyMealSelected ? '包餐' : '换餐'}</span>
      </Button>
    </div>
  );
}
