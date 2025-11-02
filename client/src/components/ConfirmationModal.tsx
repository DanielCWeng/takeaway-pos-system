// --- START OF FILE src/components/ConfirmationModal.tsx ---

import React, { useState, useMemo } from 'react';

const NumpadButton: React.FC<React.ComponentProps<'button'>> = (props) => (
  <button
    className="h-16 w-16 text-2xl bg-gray-300 border-2 border-r-gray-500 border-b-gray-500 border-l-gray-100 border-t-gray-100 active:border-l-gray-500 active:border-t-gray-500 active:border-r-gray-100 active:border-b-gray-100 focus:outline-none"
    {...props}
  />
);

interface ConfirmationModalProps {
  orderTotal: number;
  onClose: () => void;
  onConfirm: (paymentDetails: { amountPaid: number; changeDue: number }) => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ orderTotal, onClose, onConfirm }) => {
  const [amountPaidStr, setAmountPaidStr] = useState('');

  const amountPaid = useMemo(() => parseFloat(amountPaidStr) || 0, [amountPaidStr]);
  const changeDue = useMemo(() => amountPaid - orderTotal, [amountPaid, orderTotal]);

  const handleKeyPress = (key: string) => {
    if (key === '<-') {
      setAmountPaidStr(val => val.slice(0, -1));
    } else if (key === 'C') {
      setAmountPaidStr('');
    } else if (key === '.' && amountPaidStr.includes('.')) {
      return; // Prevent multiple decimals
    } else {
      setAmountPaidStr(val => val + key);
    }
  };

  // --- MODIFIED: The handler now sends default values if no cash is entered ---
  const handleConfirmClick = () => {
    // If user did not enter an amount, or entered less than the total,
    // we assume it's a card/exact payment and send the total.
    if (amountPaid < orderTotal) {
      onConfirm({ amountPaid: orderTotal, changeDue: 0 });
    } else {
      // If they did enter a valid cash amount, use that for change calculation.
      onConfirm({ amountPaid, changeDue });
    }
  };

  const numpadLayout = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['C', '0', '.'],
  ];

  // --- REMOVED: isConfirmDisabled is no longer needed ---

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-200 p-4 border-4 border-t-gray-100 border-l-gray-100 border-b-gray-500 border-r-gray-500 flex flex-col gap-4 w-[400px]">
        <h2 className="text-2xl font-bold text-center">Confirm Order</h2>
        
        <div className="bg-gray-800 text-white font-mono p-4 rounded-md text-right flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-lg">Total Due:</span>
            <span className="text-2xl font-bold">£{orderTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-lg">Cash Received:</span>
            <span className="text-2xl font-bold text-yellow-400">£{amountPaid.toFixed(2)}</span>
          </div>
          <hr className="border-gray-600"/>
          <div className="flex justify-between items-center">
            <span className="text-lg">Change Due:</span>
            <span className="text-3xl font-bold text-green-400">£{changeDue > 0 ? changeDue.toFixed(2) : '0.00'}</span>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 bg-white text-right text-3xl font-mono p-2 border-2 border-t-gray-500 border-l-gray-500 min-h-[56px]">
            {amountPaidStr || ' '}
          </div>
          <NumpadButton onClick={() => handleKeyPress('<-')}>&lt;-</NumpadButton>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {numpadLayout.flat().map(key => (
            <NumpadButton key={key} onClick={() => handleKeyPress(key)}>{key}</NumpadButton>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2">
          <button onClick={onClose} className="p-4 bg-red-500 text-white text-xl font-bold rounded-md">
            Cancel
          </button>
          {/* --- MODIFIED: The 'disabled' attribute has been removed --- */}
          <button 
            onClick={handleConfirmClick}
            className="p-4 bg-green-500 text-white text-xl font-bold rounded-md"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;