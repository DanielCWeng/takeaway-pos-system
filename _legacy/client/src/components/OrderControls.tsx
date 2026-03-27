// --- START OF FILE OrderControls.tsx ---

import React from 'react';

// --- MODIFIED: Added new props for FOC and £0 mode ---
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
  onToggleSwapMode: () => void;
  isHappyMealSelected: boolean;
  isSetMealItemSelected: boolean;
}

const ControlButton = ({ children, className = '', ...props }: { children?: React.ReactNode, className?: string, [key: string]: any }) => (
  <button
    className={`h-full bg-gray-300 border-2 border-r-gray-500 border-b-gray-500 border-l-gray-100 border-t-gray-100 active:border-l-gray-500 active:border-t-gray-500 active:border-r-gray-100 active:border-b-gray-100 flex items-center justify-center text-lg font-bold disabled:text-gray-400 disabled:cursor-not-allowed ${className}`}
    {...props}
  >
    {children}
  </button>
);

const TextButton = ({ topText, bottomText, className = '', ...props }: {topText: string, bottomText: string, className?: string, [key: string]: any}) => (
    <button className={`h-full w-full bg-gray-300 border-2 border-r-gray-500 border-b-gray-500 border-l-gray-100 border-t-gray-100 active:border-l-gray-500 active:border-t-gray-500 active:border-r-gray-100 active:border-b-gray-100 flex flex-col items-center justify-center disabled:text-gray-400 disabled:cursor-not-allowed ${className}`} {...props}>
        <span className="text-sm">{topText}</span>
        <span className="text-xs">{bottomText}</span>
    </button>
);

const OrderControls: React.FC<OrderControlsProps> = ({
  onDuplicateItem,
  onRemoveItem,
  onModifyItem,
  onFocItem,
  isItemSelected,
  isZeroPriceMode,
  onToggleZeroPriceMode,
  onDeleteOrder,
  isSwapMode,
  onToggleSwapMode,
  isHappyMealSelected,
  isSetMealItemSelected,
}) => {
  return (
    <div className="grid grid-cols-5 grid-rows-2 gap-1 h-20">
      {/* --- MODIFIED: Connected onClick and disabled state --- */}
      <ControlButton className="row-span-2 text-3xl" onClick={onDuplicateItem} disabled={!isItemSelected}>+</ControlButton>
      <ControlButton className="row-span-2 text-3xl" onClick={onRemoveItem} disabled={!isItemSelected}>-</ControlButton>
      
      <TextButton topText="Short" bottomText="短式" disabled={true} />
      {/* --- MODIFIED: Connected onClick and disabled state --- */}
      <TextButton topText="FOC" bottomText="免费" onClick={onFocItem} disabled={!isItemSelected} />
      
      {/* --- MODIFIED: Replaced '20' div with functional '£0' button --- */}
      <ControlButton
        onClick={onToggleZeroPriceMode}
        className={`text-xl ${isZeroPriceMode ? 'bg-yellow-300' : ''}`}
      >
        £0
      </ControlButton>

      <TextButton topText="Modify" bottomText="修改" onClick={onModifyItem} disabled={!isItemSelected} />
      <TextButton topText="Delete" bottomText="删除" onClick={onDeleteOrder} className="text-red-400 font-semibold" />
      <ControlButton
        onClick={onToggleSwapMode}
        className={`text-xl flex-col ${isSwapMode ? 'bg-yellow-300' : ''}`}
        disabled={!isSwapMode && !isHappyMealSelected && !isSetMealItemSelected}
      >
         <span className="text-sm">Swap</span>
         <span className="text-xs">换餐</span>
      </ControlButton>


    </div>
  );
};

export default OrderControls;
// --- END OF FILE ---