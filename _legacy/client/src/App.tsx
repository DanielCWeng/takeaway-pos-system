// Polyfill for crypto.randomUUID if not available
if (!crypto.randomUUID) {
  crypto.randomUUID = function (): `${string}-${string}-${string}-${string}-${string}` {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    }) as `${string}-${string}-${string}-${string}-${string}`;
  };
}

import React, { useCallback } from "react";
import { DELIVERY_CHARGE, calculateDeliveryCharge } from "./constants";
import LeftPanel from "./components/LeftPanel";
import RightPanel from "./components/RightPanel";
import ItemModificationModal from "./components/ItemModificationModal";
import DeliveryAddressModal from "./components/DeliveryAddressModal";
import DeliveryValidationModal from "./components/DeliveryValidationModal";
import MenuRefModal from "./components/MenuRefModal";
import AdminPage from "./components/AdminPage";
import ConfirmationModal from "./components/ConfirmationModal";
import AddressSelectionModal from "./components/AddressSelectionModal";
import { OrderItem, OrderType, CustomerInfo } from "./types";
import { CallerIdProvider } from "./context/CallerIDContext";
import { OrderProvider, useOrder } from "./context/OrderContext";
import { UIProvider, useUI } from "./context/UIContext";
import { useCallHandler } from "./hooks/useCallHandler";

// Toast Notification Component
const CallerIdNotification = ({ show, callerData }: { show: boolean; callerData: any }) => {
  if (!show || !callerData) return null;
  return (
    <div className="fixed top-4 right-4 bg-blue-600 text-white px-6 py-4 rounded-lg shadow-xl z-50 animate-bounce">
      <div className="font-bold text-lg">Incoming Call</div>
      <div className="text-xl">{callerData.phone}</div>
      {callerData.name && <div className="text-sm">{callerData.name}</div>}
    </div>
  );
};

function AppContent() {
  // 1. Consume Contexts
  const {
    orders,
    activeOrderIndex,
    activeOrder,
    currentOrderItems, // Items of active order
    subtotal,
    total,
    selectedOrderItemId,
    menuItems,
    completedOrdersSessionCount,
    isZeroPriceMode,
    isSwapMode,
    toggleZeroPriceMode,
    setIsSwapMode,
    setActiveOrderIndex,
    setSelectedOrderItemId,
    createNewOrder,
    deleteOrder,
    updateOrder,
    addItem,
    removeItem,
    duplicateItem,
    updateOrderItem,
    setFocItem,
    printOrder,
  } = useOrder();

  const {
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
    // openAddressSelectionModal, // Handled by hook
    closeAddressSelectionModal,
    isDeliveryValidationModalOpen,
    setIsDeliveryValidationModalOpen,
    // isDeliveryPriceModalOpen,
    // setIsDeliveryPriceModalOpen,
  } = useUI();

  // 2. Call Handler Hook (Side Effects)
  const { showNotification, currentCaller } = useCallHandler();

  // 3. Adapter Functions (Controller Logic)

  const handleSetActiveOrder = useCallback(
    (index: number) => setActiveOrderIndex(index),
    [setActiveOrderIndex],
  );

  const handleNewOrder = useCallback(() => {
    // Manual creation triggers switching to it (handled by context)
    createNewOrder(false);
  }, [createNewOrder]);

  const handleDeleteOrder = useCallback(() => {
    if (confirm("Are you sure you want to delete this order?")) {
      deleteOrder();
    }
  }, [deleteOrder]);

  const handleSelectOrderType = useCallback(
    (type: OrderType) => {
      // Logic from App.tsx
      if (type === OrderType.Delivery) {
        updateOrder(activeOrderIndex, { orderType: type });
        openCustomerModal("postcode");
      } else {
        updateOrder(activeOrderIndex, { orderType: type });
      }
    },
    [activeOrderIndex, updateOrder, openCustomerModal],
  );

  const handleUpdateDeliveryCharge = useCallback(
    (newCharge: number) => {
      updateOrder(activeOrderIndex, { deliveryCharge: newCharge });
    },
    [activeOrderIndex, updateOrder],
  );

  // Re-implementing logic for specific props
  const handleOpenCustomerModal = useCallback(
    (focus: "postcode" | "name") => openCustomerModal(focus),
    [openCustomerModal],
  );

  // Saving customer info from Modal
  const handleSaveCustomerInfo = useCallback(
    (info: CustomerInfo) => {
      const newDeliveryCharge = calculateDeliveryCharge(info.distance);
      updateOrder(activeOrderIndex, {
        customerInfo: info,
        deliveryCharge: newDeliveryCharge,
        lastActivityTime: Date.now(),
      });
      closeCustomerModal();
    },
    [activeOrderIndex, updateOrder, closeCustomerModal],
  );

  // Address Selection Logic
  const handleSelectAddress = useCallback(
    (selectedAddress: any) => {
      if (!customerForSelection) return;
      // Active order is context.activeOrder
      const currentDistance = activeOrder.customerInfo?.distance;
      const newCustomerInfo = {
        phone: customerForSelection.phone,
        name: customerForSelection.name,
        postcode: selectedAddress.postcode,
        houseNumber: selectedAddress.houseNumber,
        street: selectedAddress.street,
        town: selectedAddress.town,
        address: selectedAddress.fullAddress,
        distance: currentDistance,
      };

      const newDeliveryCharge = calculateDeliveryCharge(currentDistance);
      updateOrder(activeOrderIndex, {
        customerInfo: newCustomerInfo,
        deliveryCharge: newDeliveryCharge,
      });
      closeAddressSelectionModal();
    },
    [activeOrder, activeOrderIndex, customerForSelection, updateOrder, closeAddressSelectionModal],
  );

  // Validating Order before Confirmation
  const handleAcceptOrder = useCallback(async () => {
    if (!activeOrder || activeOrder.items.length === 0) {
      alert("Cannot accept an empty order.");
      return;
    }

    const isDelivery = activeOrder.orderType === OrderType.Delivery;
    const hasName = activeOrder.customerInfo?.name;
    const hasAddress =
      activeOrder.customerInfo?.address && activeOrder.customerInfo.address.trim() !== "";

    if (isDelivery && hasName && !hasAddress) {
      setIsDeliveryValidationModalOpen(true);
      return;
    }

    // Use Context Action
    openConfirmationModal(activeOrder);
  }, [activeOrder, setIsDeliveryValidationModalOpen, openConfirmationModal]);

  // Actual Printing/Confirmation
  const handleConfirmAndPrint = useCallback(
    async (paymentDetails: { amountPaid: number; changeDue: number }) => {
      if (!orderToConfirm) return;

      // We pass the order snapshot from orderToConfirm

      // 1. Close Modal
      closeConfirmationModal();

      // 2. Print (Async) - context handles fetch
      printOrder(orderToConfirm, paymentDetails);

      // 3. Remove from State
      // Typically we remove the logic from internal list.
      // OrderContext.deleteOrder() assumes ACTIVE order.
      // If we are printing active order, this works.
      deleteOrder();
    },
    [orderToConfirm, closeConfirmationModal, printOrder, deleteOrder],
  );

  const handleConfirmDelivery = useCallback(() => {
    setIsDeliveryValidationModalOpen(false);
    // Open the customer modal to enter the address
    handleOpenCustomerModal("postcode");
  }, [handleOpenCustomerModal, setIsDeliveryValidationModalOpen]);

  const handleSwitchToCollection = useCallback(() => {
    setIsDeliveryValidationModalOpen(false);
    // Change order type to Collection
    updateOrder(activeOrderIndex, { orderType: OrderType.Collection });
    // Proceed to confirmation
    openConfirmationModal(activeOrder);
  }, [
    activeOrder,
    activeOrderIndex,
    updateOrder,
    setIsDeliveryValidationModalOpen,
    openConfirmationModal,
  ]);

  // Safety loading
  if (!orders || orders.length === 0) return <div>Initializing...</div>;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 font-sans text-gray-900">
      <CallerIdNotification show={showNotification} callerData={currentCaller} />

      {/* LEFT PANEL: Menu & Categories */}
      <LeftPanel
        menuItems={menuItems}
        onAddItem={addItem}
        activeOrderIndex={activeOrderIndex}
        orders={orders}
        onSetActiveOrder={handleSetActiveOrder}
        onNewOrder={handleNewOrder}
        onDeleteOrder={handleDeleteOrder}
        isZeroPriceMode={isZeroPriceMode}
        isSwapMode={isSwapMode}
        setIsSwapMode={setIsSwapMode}
        completedSessionCount={completedOrdersSessionCount}
      />

      {/* RIGHT PANEL: Order Summary & Controls */}
      <RightPanel
        items={currentOrderItems}
        activeOrder={activeOrder}
        selectedItemId={selectedOrderItemId}
        onSelectItem={setSelectedOrderItemId}
        onRemoveItem={removeItem}
        onDuplicateItem={duplicateItem}
        onUpdateItem={openModificationModal}
        onFocItem={setFocItem}
        subtotal={subtotal}
        total={total}
        onCheckout={handleAcceptOrder}
        onChangeOrderType={handleSelectOrderType}
        onUpdateDeliveryCharge={handleUpdateDeliveryCharge}
        onOpenCustomerModal={handleOpenCustomerModal}
        onAdmin={setIsAdminPageOpen}
        toggleZeroPriceMode={toggleZeroPriceMode}
        isZeroPriceMode={isZeroPriceMode}
        onMenuRef={() => setIsMenuRefModalOpen(true)}
      />

      {/* MODALS */}
      <ItemModificationModal
        isOpen={isModificationModalOpen}
        onClose={closeModificationModal}
        item={itemToModify}
        onUpdateItem={updateOrderItem}
      />

      <DeliveryAddressModal
        isOpen={isCustomerModalOpen}
        onClose={closeCustomerModal}
        onSave={handleSaveCustomerInfo}
        initialPhoneNumber={activeOrder?.customerInfo?.phone || ""}
        initialFocus={initialFocusField}
        currentCustomerInfo={activeOrder?.customerInfo}
      />

      <DeliveryValidationModal
        isOpen={isDeliveryValidationModalOpen}
        onClose={() => setIsDeliveryValidationModalOpen(false)}
        customerName={activeOrder?.customerInfo?.name || "Customer"}
        onConfirmDelivery={handleConfirmDelivery}
        onSwitchToCollection={handleSwitchToCollection}
      />

      <MenuRefModal isOpen={isMenuRefModalOpen} onClose={() => setIsMenuRefModalOpen(false)} />

      <AdminPage isOpen={isAdminPageOpen} onClose={() => setIsAdminPageOpen(false)} />

      <ConfirmationModal
        isOpen={isConfirmationModalOpen}
        onClose={closeConfirmationModal}
        onConfirm={handleConfirmAndPrint}
        order={orderToConfirm} // Pass the snapshot
        total={orderToConfirm ? total : 0} // Approximate total if consistent
      />

      <AddressSelectionModal
        isOpen={isAddressSelectionModalOpen}
        onClose={closeAddressSelectionModal}
        customer={customerForSelection}
        onSelect={handleSelectAddress}
      />
    </div>
  );
}

export default function App() {
  return (
    <CallerIdProvider>
      <OrderProvider>
        <UIProvider>
          <AppContent />
        </UIProvider>
      </OrderProvider>
    </CallerIdProvider>
  );
}
