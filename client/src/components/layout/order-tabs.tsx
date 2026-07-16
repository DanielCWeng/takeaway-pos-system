import { cn } from "../../lib/utils";

interface OrderTabsProps {
  orders: { id: number; hasUnreadChanges?: boolean }[];
  activeIndex: number;
  onSelectIndex: (index: number) => void;
}

export function OrderTabs({ orders, activeIndex, onSelectIndex }: OrderTabsProps) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
      {orders.map((order, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={order.id}
            onClick={() => onSelectIndex(index)}
            className={cn(
              "relative flex h-10 w-12 flex-shrink-0 items-center justify-center rounded-md border font-display text-sm font-semibold transition pos-order-tab",
              isActive
                ? "border-primary bg-primary text-primary-foreground shadow-[0_0_10px_hsl(var(--primary)/0.2)]"
                : "border-border bg-muted text-muted-foreground hover:bg-card hover:text-foreground",
            )}
          >
            {order.id}
            {order.hasUnreadChanges && !isActive && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground ring-2 ring-background">
                !
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
