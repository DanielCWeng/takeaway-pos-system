import React from 'react';
import { MenuItem, ItemOption } from '../types';
import { IconX } from './Icons';

interface ItemOptionsModalProps {
  item: MenuItem;
  onSelect: (option: ItemOption) => void;
  onClose: () => void;
}

const PosButton = ({ children, className = '', ...props }: {children?: React.ReactNode, className?: string, [key: string]: any}) => (
  <button
    className={`px-4 py-3 text-lg bg-gray-300 border-2 border-r-gray-500 border-b-gray-500 border-l-gray-100 border-t-gray-100 active:border-l-gray-500 active:border-t-gray-500 active:border-r-gray-100 active:border-b-gray-100 focus:outline-none ${className}`}
    {...props}
  >
    {children}
  </button>
);

const ItemOptionsModal: React.FC<ItemOptionsModalProps> = ({ item, onSelect, onClose }) => {
  if (!item.options) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-300 w-full max-w-md flex flex-col p-4 gap-4 border-4 border-t-gray-100 border-l-gray-100 border-b-gray-500 border-r-gray-500">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Select Option for {item.name.en}</h2>
          <button onClick={onClose} className="text-black hover:text-red-500">
            <IconX className="w-8 h-8" />
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
            {item.options.map(option => (
                <PosButton key={option.name} onClick={() => onSelect(option)} className="h-24 flex flex-col">
                    <span>{option.name}</span>
                    <span className="font-bold text-xl">£{option.price.toFixed(2)}</span>
                </PosButton>
            ))}
        </div>
      </div>
    </div>
  );
};

export default ItemOptionsModal;