// client/src/components/LeftPanel.tsx

import React from 'react';
import { Order, OrderItem, OrderType, CustomerInfo } from '../types';
import OrderSummary from './OrderSummary';
import OrderControls from './OrderControls';
import CustomerInfoPanel from './CustomerInfoPanel';

// --- START: MODIFIED PROPS ---
interface LeftPanelProps {
  orders: Order[];
  activeOrder: Order;
  orderItems: OrderItem[];
  selectedOrderItemId: string | null;
  onSelectItem: (id: string) => void;
  onRemoveItem: () => void;
  onDuplicateItem: () => void;
  onModifyItem: (id: string) => void;
  
  // 'setOrderType' is now 'onSelectOrderType' to reflect the new smart logic
  onSelectOrderType: (type: OrderType) => void; 
  
  setCustomerInfo: (info: CustomerInfo) => void;
  subtotal: number;
  total: number;
  deliveryCharge: number;
  onEditDeliveryCharge: () => void;
  onOpenCustomerModal: (focus: 'postcode' | 'name') => void;
  onNewOrder: () => void;
  onSetActiveOrder: (index: number) => void;
  isZeroPriceMode: boolean;
  onToggleZeroPriceMode: () => void;
  onFocItem: () => void;
  onAcceptOrder: () => void;
}
// --- END: MODIFIED PROPS ---


const OrderTab: React.FC<{
  orderId: number;
  isActive: boolean;
  hasUnreadChanges?: boolean;
  onClick: () => void;
}> = ({ orderId, isActive, hasUnreadChanges, onClick }) => (
  <button
    onClick={onClick}
    className={`w-10 h-8 border-2 flex items-center justify-center font-bold text-lg relative
      ${isActive
        ? 'bg-blue-600 text-white border-l-gray-700 border-t-gray-700 border-r-blue-400 border-b-blue-400'
        : 'bg-gray-300 border-r-gray-500 border-b-gray-500 border-l-gray-100 border-t-gray-100'
      }`}
  >
    {orderId}
    {hasUnreadChanges && !isActive && (
      <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center border border-white">
        !
      </span>
    )}
  </button>
);


const LeftPanel: React.FC<LeftPanelProps> = ({
  orders,
  activeOrder,
  orderItems,
  selectedOrderItemId,
  onSelectItem,
  onRemoveItem,
  onDuplicateItem,
  onModifyItem,
  
  // Destructure the new prop name
  onSelectOrderType, 
  
  setCustomerInfo,
  subtotal,
  total,
  deliveryCharge,
  onEditDeliveryCharge,
  onOpenCustomerModal,
  onNewOrder,
  onSetActiveOrder,
  isZeroPriceMode,
  onToggleZeroPriceMode,
  onFocItem,
  onAcceptOrder,
}) => {
  return (
    <div className="w-[38%] bg-gray-300 flex flex-col gap-2">
      <div className="flex-shrink-0 flex gap-1">
        {orders.map((order, index) => (
          <OrderTab
            key={order.id}
            orderId={order.id}
            isActive={activeOrder.id === order.id}
            hasUnreadChanges={order.hasUnreadChanges}
            onClick={() => onSetActiveOrder(index)}
          />
        ))}
      </div>

      <OrderControls
        onRemoveItem={onRemoveItem}
        onDuplicateItem={onDuplicateItem}
        onModifyItem={() => selectedOrderItemId && onModifyItem(selectedOrderItemId)}
        isItemSelected={!!selectedOrderItemId}
        onFocItem={onFocItem}
        isZeroPriceMode={isZeroPriceMode}
        onToggleZeroPriceMode={onToggleZeroPriceMode}
      />

      <OrderSummary
        items={orderItems}
        selectedItemId={selectedOrderItemId}
        onSelectItem={onSelectItem}
        onEditItem={onModifyItem}
        subtotal={subtotal}
        total={total}
        deliveryCharge={deliveryCharge}
        onEditDeliveryCharge={onEditDeliveryCharge}
        orderType={activeOrder.orderType}
        discount={activeOrder.discount}
      />
      
      {/* --- START: PASS THE NEW PROP DOWN --- */}
      <CustomerInfoPanel
        orderType={activeOrder.orderType}
        
        // Pass the new handler down to CustomerInfoPanel
        setOrderType={onSelectOrderType} 
        
        customerInfo={activeOrder.customerInfo}
        setCustomerInfo={setCustomerInfo}
        onOpenCustomerModal={onOpenCustomerModal}
        onNewOrder={onNewOrder}
        onAcceptOrder={onAcceptOrder} 
      />
      {/* --- END: PASS THE NEW PROP DOWN --- */}
    </div>
  );
};

export default LeftPanel;