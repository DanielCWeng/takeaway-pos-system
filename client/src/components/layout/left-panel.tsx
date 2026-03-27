import React from 'react';
import type { CustomerInfo, OrderItem, OrderType } from '../../types';
import { motion } from 'framer-motion';
import { Button } from '../ui/button';
import { ThemeToggle } from '../ui/theme-toggle';
import { OrderList } from './order-list';
import { OrderSummary } from './order-summary';
import { CustomerCard } from './customer-card';
import { OrderTabs } from './order-tabs';
import { OrderControls } from './order-controls';
import { BackendConnectionIndicator } from './backend-connection-indicator';
import { BackendConnectionBanner } from './backend-connection-banner';

interface LeftPanelProps {
  orders: { id: number; hasUnreadChanges?: boolean }[];
  activeOrderIndex: number;
  onSelectOrder: (index: number) => void;
  onNewOrder: () => void;
  items: OrderItem[];
  selectedIndex: number | null;
  onSelectIndex: (index: number) => void;
  onRemoveSelected: () => void;
  onClearOrder: () => void;
  subtotal: number;
  deliveryFee: number;
  total: number;
  onAccept: () => void;
  orderType: OrderType;
  onChangeOrderType: (type: OrderType) => void;
  customerInfo?: CustomerInfo;
  onCustomerInfoClick: () => void;
  
  onDuplicateItem: () => void;
  onModifyItem: () => void;
  onFocItem: () => void;
  isZeroPriceMode: boolean;
  onToggleZeroPriceMode: () => void;
  onDeleteOrder: () => void;
  isSwapMode: boolean;
  onToggleSwapMode: () => void;
  isIncMode: boolean;
  isHappyMealSelected: boolean;
  isSetMealItemSelected: boolean;
  isShortMode: boolean;
  onToggleShortMode: () => void;
  onOpenAdmin: () => void;
}

export const LeftPanel = React.memo(function LeftPanel({
  orders,
  activeOrderIndex,
  onSelectOrder,
  onNewOrder,
  items,
  selectedIndex,
  onSelectIndex,
  onRemoveSelected,
  subtotal,
  deliveryFee,
  total,
  onAccept,
  orderType,
  onChangeOrderType,
  customerInfo,
  onCustomerInfoClick,
  onDuplicateItem,
  onModifyItem,
  onFocItem,
  isZeroPriceMode,
  onToggleZeroPriceMode,
  onDeleteOrder,
  isSwapMode,
  onToggleSwapMode,
  isIncMode,
  isHappyMealSelected,
  isSetMealItemSelected,
  isShortMode,
  onToggleShortMode,
  onOpenAdmin,
}: LeftPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="pos-panel flex flex-col gap-2 p-2"
      >
        <div className="flex items-center justify-between">
          <OrderTabs 
            orders={orders} 
            activeIndex={activeOrderIndex} 
            onSelectIndex={onSelectOrder} 
          />
            <div className="flex items-center gap-2">
              <BackendConnectionIndicator />
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs border-zinc-700 hover:bg-zinc-800"
                onClick={onOpenAdmin}
              >
                Admin
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={onNewOrder}
              >
                New
              </Button>
              <ThemeToggle />
            </div>
        </div>
        <BackendConnectionBanner />
        
        <OrderControls 
          onDuplicateItem={onDuplicateItem}
          onRemoveItem={onRemoveSelected}
          onModifyItem={onModifyItem}
          onFocItem={onFocItem}
          isItemSelected={selectedIndex !== null}
          isZeroPriceMode={isZeroPriceMode}
          onToggleZeroPriceMode={onToggleZeroPriceMode}
          onDeleteOrder={onDeleteOrder}
          isSwapMode={isSwapMode}
          isIncMode={isIncMode}
          onToggleSwapMode={onToggleSwapMode}
          isHappyMealSelected={isHappyMealSelected}
          isSetMealItemSelected={isSetMealItemSelected}
          isShortMode={isShortMode}
          onToggleShortMode={onToggleShortMode}
        />
      </motion.div>

      <div className="min-h-0 flex-1">
        <OrderList 
          items={items} 
          selectedIndex={selectedIndex} 
          onSelect={onSelectIndex} 
          isShortMode={isShortMode}
        />
      </div>

      <div className="grid gap-2 lg:grid-cols-2 items-stretch">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.08 }}
        >
          <OrderSummary
            subtotal={subtotal}
            deliveryFee={deliveryFee}
            total={total}
            onAccept={onAccept}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.12 }}
          onClick={onCustomerInfoClick}
          className="cursor-pointer"
        >
          <CustomerCard
            orderType={orderType}
            onChangeOrderType={onChangeOrderType}
            customerInfo={customerInfo}
          />
        </motion.div>
      </div>
    </div>
  );
});
