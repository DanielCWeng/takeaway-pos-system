// client/src/components/CustomerInfoPanel.tsx (Final Correction)

import React from 'react';
import { OrderType, CustomerInfo } from '../types';

// FunctionButton component remains the same...
const FunctionButton: React.FC<{
  label: string;
  subLabel: string;
  isActive: boolean;
  onClick: () => void;
  className?: string;
}> = ({ label, subLabel, isActive, onClick, className }) => (
  <button
    onClick={onClick}
    className={`w-full h-full text-center p-1 border-2 flex items-center justify-center flex-col
      ${ isActive
        ? 'bg-yellow-400 border-l-gray-600 border-t-gray-600 border-r-white border-b-white'
        : 'bg-gray-300 border-r-gray-500 border-b-gray-500 border-l-gray-100 border-t-gray-100'
      } ${className}`}
  >
    <span className="font-bold">{label}</span>
    <span className="text-xs">{subLabel}</span>
  </button>
);

// InfoRow component remains the same...
const InfoRow: React.FC<{ label: string; value: React.ReactNode; subLabel: string }> = ({label, value, subLabel}) => (
    <div className="flex items-baseline">
        <span className="w-16 text-right pr-2 font-bold">{label}</span>
        <span className="flex-grow font-mono">{value || ''}</span>
        <span className="text-xs w-10">{subLabel}</span>
    </div>
);

const CustomerInfoPanel: React.FC<{
  orderType: OrderType,
  setOrderType: (type: OrderType) => void,
  customerInfo: CustomerInfo,
  setCustomerInfo: (info: CustomerInfo) => void;
  onOpenCustomerModal: (focus: 'postcode' | 'name') => void;
  onNewOrder: () => void;
  onAcceptOrder: () => void;
}> = ({ 
    orderType, 
    setOrderType, 
    customerInfo, 
    onOpenCustomerModal, // <-- THE PROP IS NOW CORRECTLY DESTRUCTURED
    onNewOrder, 
    onAcceptOrder
}) => {

  const handleDeliveryClick = () => {
    setOrderType(OrderType.Delivery);
  }

  const handleCollectionClick = () => {
    setOrderType(OrderType.Collection);
    onOpenCustomerModal('name');
  }

  return (
    <div className="grid grid-cols-3 gap-1">
      <div className="col-span-1 grid grid-cols-2 grid-rows-2 gap-1">
        <FunctionButton label="F2" subLabel="New Order 新单" isActive={false} onClick={onNewOrder} className="bg-blue-400" />
        <FunctionButton label="" subLabel="Accept Order 入单" isActive={false} onClick={onAcceptOrder} className="bg-green-400" />
        <FunctionButton label="F3" subLabel="Delivery 送餐" isActive={orderType === OrderType.Delivery} onClick={handleDeliveryClick} />
        <FunctionButton label="F4" subLabel="Collect 领取" isActive={orderType === OrderType.Collection} onClick={handleCollectionClick} />
      </div>

      <div className="col-span-2 bg-gray-300 border-2 border-t-gray-600 border-l-gray-600 border-b-gray-100 border-r-gray-100 p-2 flex flex-col justify-around text-sm">
        <InfoRow label="Name"    value={customerInfo.name} subLabel="姓名" />
        
        <div 
            onClick={() => onOpenCustomerModal('postcode')} 
            className="cursor-pointer hover:bg-gray-200 rounded"
            title="Click to change address"
        >
            <InfoRow label="Address" value={customerInfo.address} subLabel="地址" />
        </div>

        <InfoRow label="Phone"   value={customerInfo.phone} subLabel="电话" />
        <InfoRow label="Notes"   value={customerInfo.deliveryInstructions} subLabel="指示" />
      </div>

      <div className="col-span-3 grid grid-cols-2 gap-2 mt-1">
        <div className="bg-gray-300 border-2 border-t-gray-600 border-l-gray-600 border-b-gray-100 border-r-gray-100 p-1">
          <InfoRow 
            label="Time" 
            value={customerInfo.deliveryTime || '--:--'} 
            subLabel="时间" 
          />
        </div>
        <div className="bg-gray-300 border-2 border-t-gray-600 border-l-gray-600 border-b-gray-100 border-r-gray-100 p-1">
          <InfoRow 
            label="Dist" 
            value={customerInfo.distance ? `${customerInfo.distance} mi` : ''} 
            subLabel="距离" 
          />
        </div>
      </div>
    </div>
  );
};

export default CustomerInfoPanel;