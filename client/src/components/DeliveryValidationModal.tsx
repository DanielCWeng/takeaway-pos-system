import React from "react";

interface DeliveryValidationModalProps {
  customerName: string;
  onConfirmDelivery: () => void;
  onSwitchToCollection: () => void;
  onClose: () => void;
}

const PosButton = ({
  children,
  className = "",
  ...props
}: {
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}) => (
  <button
    className={`px-2 py-1 bg-gray-300 border-2 border-r-gray-500 border-b-gray-500 border-l-gray-100 border-t-gray-100 active:border-l-gray-500 active:border-t-gray-500 active:border-r-gray-100 active:border-b-gray-100 focus:outline-none disabled:text-gray-500 disabled:opacity-70 ${className}`}
    {...props}
  >
    {children}
  </button>
);

const DeliveryValidationModal: React.FC<DeliveryValidationModalProps> = ({
  customerName,
  onConfirmDelivery,
  onSwitchToCollection,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-200 w-full max-w-lg flex flex-col p-6 gap-6 border-4 border-t-gray-100 border-l-gray-100 border-b-gray-500 border-r-gray-500">
        <div className="bg-yellow-500 text-black p-3 text-center border-4 border-yellow-600">
          <h2 className="text-2xl font-bold">⚠️ Address Missing</h2>
        </div>

        <div className="bg-white border-2 border-gray-400 p-4 space-y-3">
          <p className="text-lg">
            You have set this order as <span className="font-bold">DELIVERY</span> for:
          </p>
          <p className="text-xl font-bold text-center bg-blue-100 border-2 border-blue-400 p-2">
            {customerName || "Customer"}
          </p>
          <p className="text-lg">
            But <span className="font-bold text-red-600">no address</span> has been entered.
          </p>
          <p className="text-base text-center mt-4 font-semibold">
            Did you mean to set this as DELIVERY?
          </p>
        </div>

        <div className="flex gap-4">
          <PosButton
            onClick={onSwitchToCollection}
            className="flex-1 h-16 bg-green-500 text-white text-xl font-bold hover:bg-green-600"
          >
            No, Switch to COLLECTION
            <br />
            <span className="text-sm">改为自取</span>
          </PosButton>
          <PosButton
            onClick={onConfirmDelivery}
            className="flex-1 h-16 bg-blue-500 text-white text-xl font-bold hover:bg-blue-600"
          >
            Yes, Enter Address
            <br />
            <span className="text-sm">输入地址</span>
          </PosButton>
        </div>

        <PosButton
          onClick={onClose}
          className="bg-gray-400 text-black hover:bg-gray-500"
        >
          Cancel 取消
        </PosButton>
      </div>
    </div>
  );
};

export default DeliveryValidationModal;
