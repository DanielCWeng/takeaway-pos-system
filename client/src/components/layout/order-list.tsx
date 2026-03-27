import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { OrderItem } from '../../types';
import { formatCurrency } from '../../lib/format';
import { cn } from '../../lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';

interface OrderListProps {
  items: OrderItem[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  isShortMode?: boolean;
}

export const OrderList = React.memo(function OrderList({ items, selectedIndex, onSelect, isShortMode }: OrderListProps) {


  return (
    <div className="pos-panel flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="pos-kicker">Items</span>
          <span className="font-display text-sm font-semibold tracking-tight text-foreground">
            Current Order
          </span>
        </div>
        <Badge variant="accent" className="font-mono text-[11px]">
          {items.length}
        </Badge>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <motion.div
          layout
          className="flex flex-col gap-1.5 p-2"
        >
          <AnimatePresence initial={false} mode="popLayout">
            {items.map((item, index) => {
              const isSelected = selectedIndex === index;
              const isChild = !!item.parentId;
              const isVisible = !isShortMode || !isChild;

              if (!isVisible) return null;

              return (
                <motion.div
                  layout
                  key={item.uniqueId || `${item.name}-${index}`}
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 6 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ 
                    duration: 0.2, 
                    ease: "circOut"
                  }}
                  className="overflow-hidden"
                >
                  <motion.button
                    onClick={() => onSelect(index)}
                    className={cn(
                      'group relative flex w-full items-center justify-between rounded-lg border px-2 py-2 text-left text-xs transition-all duration-200 pos-order-row',
                      isSelected
                        ? 'border-primary/50 bg-primary/20 text-foreground font-semibold shadow-[0_0_15px_0_hsl(var(--primary)/0.15)] ring-1 ring-primary/30'
                        : 'border-white/5 bg-white/5 text-foreground hover:bg-white/10 hover:border-white/10 hover:shadow-sm',
                      isChild && 'ml-4 w-[calc(100%-1rem)] border-dashed border-white/10 bg-white/[0.02]'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute left-0 top-1.5 h-[calc(100%-0.75rem)] w-[3px] rounded-full opacity-0 transition-opacity',
                        isSelected ? 'bg-accent opacity-100' : 'bg-primary group-hover:opacity-40',
                        isChild && 'left-[-4px] w-[2px] h-[calc(100%+8px)] top-[-4px] rounded-none opacity-20 bg-white/40' // Connector for children
                      )}
                    />
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs font-semibold">{item.name}</p>
                        {item.isFoc && !item.isIncluded && (
                          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 px-1 py-0 h-3 text-[8px] uppercase font-bold">FOC</Badge>
                        )}
                        {item.isIncluded && (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 px-1 py-0 h-3 text-[8px] uppercase font-bold">Inc</Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Qty <span className="pos-value font-mono">{item.quantity}</span>
                      </p>
                    </div>
                    <div className="pos-value flex flex-col items-end whitespace-nowrap font-mono text-xs font-semibold">
                      <span className={cn(item.price === 0 && "text-green-500/80")}>
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  </motion.button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </ScrollArea>
    </div>
  );
});
