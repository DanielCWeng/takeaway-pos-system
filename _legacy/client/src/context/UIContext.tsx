import React, { createContext, useContext, useState, ReactNode } from "react";
import { OrderItem, CustomerInfo } from "../types";
import { FullOrder } from "./OrderContext";

interface UIContextType {
  // Customer Modal
  isCustomerModalOpen: boolean;
  initialFocusField: "postcode" | "name";
  openCustomerModal: (focus?: "postcode" | "name") => void;
  closeCustomerModal: () => void;

  // Modification Modal
  isModificationModalOpen: boolean;
  itemToModify: OrderItem | null;
  openModificationModal: (item: OrderItem) => void;
  closeModificationModal: () => void;

  // Menu Ref Modal
  isMenuRefModalOpen: boolean;
  setIsMenuRefModalOpen: (isOpen: boolean) => void;

  // Admin Page
  isAdminPageOpen: boolean;
  setIsAdminPageOpen: (isOpen: boolean) => void;

  // Confirmation Modal
  isConfirmationModalOpen: boolean;
  orderToConfirm: FullOrder | null;
  openConfirmationModal: (order: FullOrder) => void;
  closeConfirmationModal: () => void;

  // Address Selection Modal
  isAddressSelectionModalOpen: boolean;
  customerForSelection: any | null; // using 'any' as in original App.tsx or derived type
  openAddressSelectionModal: (customerData: any) => void;
  closeAddressSelectionModal: () => void;

  // Delivery Validation Modal
  isDeliveryValidationModalOpen: boolean;
  setIsDeliveryValidationModalOpen: (isOpen: boolean) => void;

  // Delivery Price Modal (referenced in App.tsx state but not heavily used? Including it)
  isDeliveryPriceModalOpen: boolean;
  setIsDeliveryPriceModalOpen: (isOpen: boolean) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [initialFocusField, setInitialFocusField] = useState<"postcode" | "name">("postcode");

  const [isModificationModalOpen, setIsModificationModalOpen] = useState(false);
  const [itemToModify, setItemToModify] = useState<OrderItem | null>(null);

  const [isMenuRefModalOpen, setIsMenuRefModalOpen] = useState(false);
  const [isAdminPageOpen, setIsAdminPageOpen] = useState(false);

  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [orderToConfirm, setOrderToConfirm] = useState<FullOrder | null>(null);

  const [isAddressSelectionModalOpen, setIsAddressSelectionModalOpen] = useState(false);
  const [customerForSelection, setCustomerForSelection] = useState<any | null>(null);

  const [isDeliveryValidationModalOpen, setIsDeliveryValidationModalOpen] = useState(false);
  const [isDeliveryPriceModalOpen, setIsDeliveryPriceModalOpen] = useState(false);

  // Actions
  const openCustomerModal = (focus: "postcode" | "name" = "postcode") => {
    setInitialFocusField(focus);
    setIsCustomerModalOpen(true);
  };
  const closeCustomerModal = () => setIsCustomerModalOpen(false);

  const openModificationModal = (item: OrderItem) => {
    setItemToModify(item);
    setIsModificationModalOpen(true);
  };
  const closeModificationModal = () => {
    setIsModificationModalOpen(false);
    setItemToModify(null);
  };

  const openConfirmationModal = (order: FullOrder) => {
    setOrderToConfirm(order);
    setIsConfirmationModalOpen(true);
  };
  const closeConfirmationModal = () => {
    setIsConfirmationModalOpen(false);
    setOrderToConfirm(null);
  };

  const openAddressSelectionModal = (customerData: any) => {
    setCustomerForSelection(customerData);
    setIsAddressSelectionModalOpen(true);
  };
  const closeAddressSelectionModal = () => {
    setIsAddressSelectionModalOpen(false);
    setCustomerForSelection(null);
  };

  const value = {
    isCustomerModalOpen,
    initialFocusField,
    openCustomerModal,
    closeCustomerModal,
    isModificationModalOpen,
    itemToModify,
    openModificationModal,
    closeModificationModal,
    isMenuRefModalOpen,
    setIsMenuRefModalOpen,
    isAdminPageOpen,
    setIsAdminPageOpen,
    isConfirmationModalOpen,
    orderToConfirm,
    openConfirmationModal,
    closeConfirmationModal,
    isAddressSelectionModalOpen,
    customerForSelection,
    openAddressSelectionModal,
    closeAddressSelectionModal,
    isDeliveryValidationModalOpen,
    setIsDeliveryValidationModalOpen,
    isDeliveryPriceModalOpen,
    setIsDeliveryPriceModalOpen,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error("useUI must be used within a UIProvider");
  }
  return context;
}
