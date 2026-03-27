// --- START OF FILE OrderSummary.tsx (Corrected Styling) ---

import React from 'react';
import { OrderItem, OrderType } from '../types';

interface OrderSummaryProps {
  items: OrderItem[];
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
  onEditItem: (id: string) => void;
  subtotal: number;
  total: number;
  deliveryCharge: number;
  onEditDeliveryCharge: () => void;
  orderType: OrderType;
  discount: number;
}

interface TotalRowProps {
  label: string;
  value: string;
  isBold?: boolean;
  onClick?: () => void;
  className?: string;
}

const TotalRow: React.FC<TotalRowProps> = ({ label, value, isBold = false, onClick, className = "" }) => (
    <div 
      className={`flex justify-between items-center ${isBold ? 'font-bold text-lg' : 'text-sm'} ${className}`}
      onClick={onClick}
    >
        <span>{label}</span>
        <span className="font-mono">{value}</span>
    </div>
);

const OrderSummary: React.FC<OrderSummaryProps> = ({
  items,
  selectedItemId,
  onSelectItem,
  onEditItem,
  subtotal,
  total,
  deliveryCharge,
  onEditDeliveryCharge,
  orderType,
  discount,
}) => {
  return (
    <div className="flex-grow flex flex-col overflow-hidden">
      {/* This is the list of order items */}
      <div className="flex-grow bg-blue-200 border-2 border-t-gray-600 border-l-gray-600 border-b-gray-100 border-r-gray-100 p-1 overflow-y-auto">
        {items.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectItem(item.id)}
              onDoubleClick={() => onEditItem(item.id)}
              className={`flex justify-between items-center p-1 my-0.5 cursor-pointer ${
                selectedItemId === item.id ? 'bg-blue-600 text-white' : 'hover:bg-blue-300'
              }`}
            >
              <div className="flex items-center">
                <span className="font-bold mr-2 w-8 text-right inline-block">
                   {item.hideQuantity ? '' : `${item.quantity}x`}
                </span>
                <span>
                    {item.displayName}
                    {item.isSwapped && <span className="ml-1 text-yellow-300" title="Swapped">🔄</span>}
                </span>
              </div>
              <span className="font-semibold">
                  {item.hidePrice ? '' : `£${item.finalPrice.toFixed(2)}`}
              </span>
            </div>
          ))}
      </div>
      
       {/* --- MODIFIED: This entire container is restyled to match your image --- */}
       <div className="flex-shrink-0 flex flex-col gap-y-1 mt-2 bg-gray-200 p-2 border-2 border-t-gray-400 border-l-gray-400 border-b-white border-r-white">
            <TotalRow label="Subtotal" value={`£${subtotal.toFixed(2)}`} />
            {orderType === OrderType.Delivery && (
               <TotalRow 
                  label="Delivery" 
                  value={`£${deliveryCharge.toFixed(2)}`} 
                  onClick={onEditDeliveryCharge}
                  className="cursor-pointer hover:bg-gray-300 rounded px-1 -mx-1 select-none"
               />
            )}
            {discount > 0 && <TotalRow label="Discount" value={`-£${discount.toFixed(2)}`} />}
            <div className="border-t border-gray-400 my-1"></div>
            <TotalRow label="Total" value={`£${total.toFixed(2)}`} isBold={true} />
       </div>
    </div>
  );
};

export default OrderSummary;

// --- END OF FILE ---