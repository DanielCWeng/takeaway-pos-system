import React, { useState } from 'react';

const PosButton = ({ children, className = '', ...props }: {children?: React.ReactNode, className?: string, [key: string]: any}) => (
  <button
    className={`px-4 py-3 text-lg bg-gray-300 border-2 border-r-gray-500 border-b-gray-500 border-l-gray-100 border-t-gray-100 active:border-l-gray-500 active:border-t-gray-500 active:border-r-gray-100 active:border-b-gray-100 focus:outline-none ${className}`}
    {...props}
  >
    {children}
  </button>
);

interface MenuRefModalProps {
    onClose: () => void;
    onEnter: (id: string) => void;
}

// --- MODIFIED: Full alphanumeric keyboard layout ---
const keyboardLayout = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '<-'],
    ['Clear', 'Space']
];

const MenuRefModal: React.FC<MenuRefModalProps> = ({ onClose, onEnter }) => {
    const [inputValue, setInputValue] = useState('');

    const handleKeyPress = (key: string) => {
        if (key === 'Clear') {
            setInputValue('');
        } else if (key === '<-') {
            setInputValue(val => val.slice(0, -1));
        } else if (key === 'Space') {
            setInputValue(val => val + ' ');
        } else {
            setInputValue(val => val + key);
        }
    };

    const handleEnter = () => {
        if (inputValue) {
            onEnter(inputValue);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
            <div className="bg-gray-300 p-4 border-4 border-t-gray-100 border-l-gray-100 border-b-gray-500 border-r-gray-500 flex flex-col gap-4">
                <h2 className="text-xl font-bold text-center">Enter Menu Reference</h2>
                <div className="bg-white text-right text-3xl font-mono p-2 border-2 border-t-gray-500 border-l-gray-500">
                    {inputValue || ' '}
                </div>
                {/* --- MODIFIED: Rendering logic updated to support full keyboard layout --- */}
                <div className="flex flex-col gap-2">
                    {keyboardLayout.map((row, rowIndex) => (
                        <div key={rowIndex} className="flex justify-center gap-2">
                            {row.map(key => {
                                const isWideKey = key === 'Clear' || key === 'Space';
                                return (
                                    <PosButton 
                                        key={key} 
                                        onClick={() => handleKeyPress(key)} 
                                        className={`h-12 text-lg ${isWideKey ? 'flex-grow' : 'w-12'}`}
                                    >
                                        {key}
                                    </PosButton>
                                );
                            })}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <PosButton onClick={onClose} className="bg-red-400">Cancel</PosButton>
                    <PosButton onClick={handleEnter} className="bg-green-400">Enter</PosButton>
                </div>
            </div>
        </div>
    );
};

export default MenuRefModal;