import React, { useState, useEffect } from "react";

const PosButton = ({ children, className = "", ...props }: { children?: React.ReactNode; className?: string; [key: string]: any }) => (
  <button
    className={`flex items-center justify-center font-bold text-xl bg-gray-200 border-2 border-r-gray-500 border-b-gray-500 border-l-white border-t-white active:border-l-gray-500 active:border-t-gray-500 active:border-r-white active:border-b-white active:bg-gray-300 focus:outline-none ${className}`}
    {...props}
  >
    {children}
  </button>
);

interface NumpadInputModalProps {
  title: string;
  initialValue?: string | number;
  onClose: () => void;
  onConfirm: (value: number) => void;
}

const NumpadInputModal: React.FC<NumpadInputModalProps> = ({ title, initialValue = "", onClose, onConfirm }) => {
  const [value, setValue] = useState(initialValue.toString());

  useEffect(() => {
    setValue(initialValue.toString());
  }, [initialValue]);

  const handlePress = (key: string) => {
    if (key === "Clear") {
      setValue("");
    } else if (key === "Back") {
      setValue((prev) => prev.slice(0, -1));
    } else if (key === ".") {
      if (!value.includes(".")) {
        setValue((prev) => prev + ".");
      }
    } else {
      // Append number
      // Prevent multiple leading zeros unless followed by decimal
      if (value === "0" && key !== ".") {
        setValue(key);
      } else {
        setValue((prev) => prev + key);
      }
    }
  };

  const handleConfirm = () => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      onConfirm(num);
      onClose();
    } else if (value === "") {
        onConfirm(0); // Treat empty as 0
        onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100]" onClick={onClose}>
      <div className="bg-gray-200 p-4 border-4 border-t-white border-l-white border-b-gray-600 border-r-gray-600 shadow-xl flex flex-col gap-4 w-80" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-center text-gray-800">{title}</h2>
        
        {/* Display Screen */}
        <div className="bg-black border-4 border-t-gray-600 border-l-gray-600 border-b-white border-r-white h-16 flex items-center justify-end px-4">
          <span className="text-3xl font-mono text-green-400 truncate">{value}</span>
        </div>

        {/* Numpad Grid */}
        <div className="grid grid-cols-3 gap-2">
          {["7", "8", "9"].map((key) => (
            <PosButton key={key} onClick={() => handlePress(key)} className="h-14">{key}</PosButton>
          ))}
          {["4", "5", "6"].map((key) => (
            <PosButton key={key} onClick={() => handlePress(key)} className="h-14">{key}</PosButton>
          ))}
          {["1", "2", "3"].map((key) => (
            <PosButton key={key} onClick={() => handlePress(key)} className="h-14">{key}</PosButton>
          ))}
          <PosButton onClick={() => handlePress("0")} className="h-14">0</PosButton>
          <PosButton onClick={() => handlePress(".")} className="h-14">.</PosButton>
          <PosButton onClick={() => handlePress("Back")} className="h-14">⌫</PosButton>
        </div>

        {/* Action Buttons */}
        <PosButton onClick={handleConfirm} className="h-14 mt-2 bg-green-600 text-white border-l-green-400 border-t-green-400 border-r-green-800 border-b-green-800 active:bg-green-700">
            ENTER
        </PosButton>
      </div>
    </div>
  );
};

export default NumpadInputModal;
