// client/src/components/AddressSelectionModal.tsx (The Correct Version)

import React from 'react';

// Define the types to match your customers.json data structure
interface Address {
  fullAddress: string;
  postcode: string;
  houseNumber: string;
  street: string;
  town: string;
}

interface Customer {
  name: string;
  phone: string;
  addresses: Address[];
}

interface Props {
  customer: Customer; // It receives a 'customer' object
  onSelect: (address: Address) => void;
  onClose: () => void;
}

const PosButton = ({ children, className = '', ...props }: React.ComponentProps<'button'>) => (
    <button
      className={`px-4 py-2 bg-gray-300 border-2 border-r-gray-500 border-b-gray-500 border-l-gray-100 border-t-gray-100 active:border-l-gray-500 active:border-t-gray-500 active:border-r-gray-100 active:border-b-gray-100 ${className}`}
      {...props}
    >
      {children}
    </button>
);

// The component now accepts '{ customer, onSelect, onClose }'
export default function AddressSelectionModal({ customer, onSelect, onClose }: Props) {
  
  // ================== THE GUARD CLAUSE FIX ==================
  // This check runs before any of the rendering logic.
  // It ensures that 'customer' and its 'addresses' array both exist before we try to use them.
  if (!customer || !Array.isArray(customer.addresses)) {
    // If the props are not ready, render nothing. This prevents the crash.
    // We can also log an error to see if this ever happens.
    console.error("AddressSelectionModal was rendered with invalid props:", { customer });
    return null; 
  }
  // =========================================================

  console.log('[AddressSelectionModal] PROPS RECEIVED and VALIDATED:', { customer });

  const handleSelectAddress = (address: Address) => {
    onSelect(address);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
      <div className="bg-gray-300 p-1 border-2 border-t-gray-100 border-l-gray-100 border-b-gray-500 border-r-gray-500 w-1/3">
        <div className="bg-blue-800 text-white p-2 flex justify-between items-center">
          <h2 className="text-lg font-bold">Select Address for {customer.name}</h2>
          <button onClick={onClose} className="font-bold text-xl">&times;</button>
        </div>
        <div className="p-4 bg-white border-2 border-gray-500 m-1">
          <p className="mb-4">This customer has multiple saved addresses. Please select one:</p>
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            
            {/* Now, this code will only run if the guard clause above passes */}
            {customer.addresses.map((addr, index) => (
              <button
                key={index}
                onClick={() => handleSelectAddress(addr)}
                className="w-full text-left p-3 bg-gray-100 border border-gray-400 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {addr.fullAddress}
              </button>
            ))}

          </div>
        </div>
        <div className="flex justify-end p-2">
            <PosButton onClick={onClose} className="bg-red-500 text-white">
                Cancel
            </PosButton>
        </div>
      </div>
    </div>
  );
}