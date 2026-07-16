import React from "react";
import type { CustomerInfo, OrderItem, OrderType } from "../../types";
import { motion } from "framer-motion";
import { Button } from "../ui/button";
import { OrderList } from "./order-list";
import { OrderSummary } from "./order-summary";
import { CustomerCard } from "./customer-card";
import { OrderTabs } from "./order-tabs";
import { OrderControls } from "./order-controls";
import { BackendConnectionIndicator } from "./backend-connection-indicator";
import { BackendConnectionBanner } from "./backend-connection-banner";

interface LeftPanelProps {
  orders: { id: number; hasUnreadChanges?: boolean }[];
  activeOrderIndex: number;
  onSelectOrder: (index: number) => void;
  items: OrderItem[];
  selectedIndex: number | null;
  onSelectIndex: (index: number) => void;
  onDecrementSelected: () => void;
  onClearOrder: () => void;
  subtotal: number;
  deliveryFee: number;
  total: number;
  onAccept: () => void;
  orderType: OrderType;
  onChangeOrderType: (type: OrderType) => void;
  customerInfo?: CustomerInfo;
  onDialPhone: (phone: string) => void;
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
  onPreview: () => void;
  onOpenAdmin: () => void;
}

export const LeftPanel = React.memo(function LeftPanel({
  orders,
  activeOrderIndex,
  onSelectOrder,
  items,
  selectedIndex,
  onSelectIndex,
  onDecrementSelected,
  subtotal,
  deliveryFee,
  total,
  onAccept,
  orderType,
  onChangeOrderType,
  customerInfo,
  onDialPhone,
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
  onPreview,
  onOpenAdmin,
}: LeftPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="pos-panel pos-left-command-box flex flex-col gap-1 p-1"
      >
        <div className="flex items-center justify-between">
          <OrderTabs orders={orders} activeIndex={activeOrderIndex} onSelectIndex={onSelectOrder} />
          <div className="flex items-center gap-1">
            <BackendConnectionIndicator />
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={onOpenAdmin}
            >
              Admin
            </Button>
          </div>
        </div>
        <BackendConnectionBanner />

        <OrderControls
          onDuplicateItem={onDuplicateItem}
          onDecrementItem={onDecrementSelected}
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
          onPreview={onPreview}
        />
      </motion.div>

      <div className="min-h-0 flex-1">
        <OrderList items={items} selectedIndex={selectedIndex} onSelect={onSelectIndex} />
      </div>

      <div className="grid gap-2 lg:grid-cols-2 items-stretch">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut", delay: 0.08 }}
          onClick={onCustomerInfoClick}
          className="cursor-pointer"
        >
          <CustomerCard
            orderType={orderType}
            onChangeOrderType={onChangeOrderType}
            customerInfo={customerInfo}
            onDialPhone={onDialPhone}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut", delay: 0.12 }}
        >
          <OrderSummary
            subtotal={subtotal}
            deliveryFee={deliveryFee}
            total={total}
            onAccept={onAccept}
          />
        </motion.div>
      </div>
    </div>
  );
});
