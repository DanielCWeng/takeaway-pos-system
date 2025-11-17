// Polyfill for crypto.randomUUID if not available
if (!crypto.randomUUID) {
  crypto.randomUUID =
    function (): `${string}-${string}-${string}-${string}-${string}` {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        function (c) {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        }
      ) as `${string}-${string}-${string}-${string}-${string}`;
    };
}

import React, { useState, useCallback, useMemo, ComponentProps } from "react";
import { DELIVERY_CHARGE } from "./constants";
import LeftPanel from "./components/LeftPanel";
import RightPanel from "./components/RightPanel";
import ItemModificationModal from "./components/ItemModificationModal";
import DeliveryAddressModal from "./components/DeliveryAddressModal";
import MenuRefModal from "./components/MenuRefModal";
import AdminPage from "./components/AdminPage";
import ConfirmationModal from "./components/ConfirmationModal";
import AddressSelectionModal from "./components/AddressSelectionModal";
import menuData from "./menu.json";
import { OrderItem, MenuItem, OrderType, CustomerInfo } from "./types";
import { useCallerId } from "./context/CallerIDContext";

const API_BASE_URL = "http://192.168.1.154:4000";

interface Order {
  id: number;
  items: OrderItem[];
  orderType: OrderType;
  customerInfo: CustomerInfo;
  discount: number;
}

const createNewOrder = (id: number): Order => ({
  id,
  items: [],
  orderType: OrderType.Collection,
  customerInfo: {},
  discount: 0,
});

type PosButtonProps = ComponentProps<"button">;

const PosButton = ({ children, className = "", ...props }: PosButtonProps) => (
  <button
    className={`px-2 py-1 bg-gray-300 border-2 border-r-gray-500 border-b-gray-500 border-l-gray-100 border-t-gray-100 active:border-l-gray-500 active:border-t-gray-500 active:border-r-gray-100 active:border-b-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${className}`}
    {...props}
  >
    {children}
  </button>
);

export default function App() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>(
    menuData as MenuItem[]
  );

  const [orders, setOrders] = useState<Order[]>([createNewOrder(1)]);
  const [activeOrderIndex, setActiveOrderIndex] = useState(0);
  const [selectedOrderItemId, setSelectedOrderItemId] = useState<string | null>(
    null
  );

  const [isZeroPriceMode, setIsZeroPriceMode] = useState(false);

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [initialFocusField, setInitialFocusField] = useState<
    "postcode" | "name"
  >("postcode");
  const [isModificationModalOpen, setIsModificationModalOpen] = useState(false);
  const [itemToModify, setItemToModify] = useState<OrderItem | null>(null);
  const [isMenuRefModalOpen, setIsMenuRefModalOpen] = useState(false);
  const [isAdminPageOpen, setIsAdminPageOpen] = useState(false);
  const [orderToConfirm, setOrderToConfirm] = useState<Order | null>(null);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [isAddressSelectionModalOpen, setIsAddressSelectionModalOpen] =
    useState(false);
  const [customerForSelection, setCustomerForSelection] = useState<any | null>(
    null
  );

  const activeOrder = useMemo(
    () => orders[activeOrderIndex],
    [orders, activeOrderIndex]
  );
  const currentOrderItems = useMemo(
    () => activeOrder?.items || [],
    [activeOrder]
  );

  const { lastCall, isConnected } = useCallerId();
  const [showNotification, setShowNotification] = useState(false);
  const [currentCaller, setCurrentCaller] = useState<any | null>(null);

  const updateOrder = useCallback(
    (orderIndex: number, updatedOrder: Partial<Order>) => {
      setOrders((prevOrders) => {
        const newOrders = [...prevOrders];
        newOrders[orderIndex] = { ...newOrders[orderIndex], ...updatedOrder };
        return newOrders;
      });
    },
    []
  );

  React.useEffect(() => {
    let notificationTimer: NodeJS.Timeout;

    const handleIncomingCall = async (callData: any) => {
      setShowNotification(true);
      setCurrentCaller(callData);

      if (notificationTimer) {
        clearTimeout(notificationTimer);
      }
      notificationTimer = setTimeout(() => setShowNotification(false), 8000);

      try {
        console.log(
          `[EFFECT] New call from ${callData.phone}, fetching customer data...`
        );

        const response = await fetch(
          `${API_BASE_URL}/api/customer/${callData.phone}`
        );

        if (response.ok) {
          const customer = await response.json();
          console.log("[EFFECT] Found existing customer:", customer);

          if (customer.addresses && Array.isArray(customer.addresses)) {
            if (customer.addresses.length > 1) {
              setCustomerForSelection(customer);
              setIsAddressSelectionModalOpen(true);
            } else if (customer.addresses.length === 1) {
              const singleAddress = customer.addresses[0];
              const newCustomerInfo = {
                phone: customer.phone,
                name: customer.name,
                postcode: singleAddress.postcode,
                houseNumber: singleAddress.houseNumber,
                street: singleAddress.street,
                town: singleAddress.town,
                distance: callData.distance,
              };
              updateOrder(activeOrderIndex, { customerInfo: newCustomerInfo });
            } else {
              const newCustomerInfo = {
                phone: customer.phone,
                name: customer.name || "",
              };
              updateOrder(activeOrderIndex, { customerInfo: newCustomerInfo });
            }
          } else if (customer.postcode) {
            const newCustomerInfo = {
              phone: customer.phone,
              name: customer.name || "",
              postcode: customer.postcode,
              houseNumber: customer.houseNumber,
              street: customer.street,
              town: customer.town,
              address: customer.address,
              distance: callData.distance,
            };
            updateOrder(activeOrderIndex, { customerInfo: newCustomerInfo });
          } else {
            const newCustomerInfo = {
              phone: customer.phone,
              name: customer.name || "",
            };
            updateOrder(activeOrderIndex, { customerInfo: newCustomerInfo });
          }
        } else {
          console.log(
            "[EFFECT] New customer. Populating order from call data."
          );
          const newCustomerInfo = {
            phone: callData.phone,
            postcode: callData.postcode,
          };
          updateOrder(activeOrderIndex, { customerInfo: newCustomerInfo });
        }
      } catch (error) {
        console.error("[EFFECT] Error processing incoming call:", error);
      }
    };

    if (lastCall && activeOrder) {
      const isOrderEmpty =
        activeOrder.items.length === 0 && !activeOrder.customerInfo.phone;
      if (isOrderEmpty) {
        console.log(
          "[EFFECT] Conditions met. Handling incoming call for empty order."
        );
        handleIncomingCall(lastCall);
      } else {
        console.log("[EFFECT] Call ignored: active order is not empty.");
      }
    }

    return () => {
      clearTimeout(notificationTimer);
    };
  }, [lastCall, activeOrder, activeOrderIndex, updateOrder]);

  const handleSelectAddress = (selectedAddress: any) => {
    if (!customerForSelection) return;
    const newCustomerInfo = {
      phone: customerForSelection.phone,
      name: customerForSelection.name,
      postcode: selectedAddress.postcode,
      houseNumber: selectedAddress.houseNumber,
      street: selectedAddress.street,
      town: selectedAddress.town,
      address: selectedAddress.fullAddress,
    };
    updateOrder(activeOrderIndex, { customerInfo: newCustomerInfo });
    setIsAddressSelectionModalOpen(false);
    setCustomerForSelection(null);
  };

  const subtotal = useMemo(
    () =>
      currentOrderItems.reduce(
        (acc, item) => acc + item.finalPrice * item.quantity,
        0
      ),
    [currentOrderItems]
  );

  const total = useMemo(() => {
    if (!activeOrder) return 0;
    const delivery =
      activeOrder.orderType === OrderType.Delivery ? DELIVERY_CHARGE : 0;
    return subtotal + delivery - activeOrder.discount;
  }, [subtotal, activeOrder]);

  const handleOpenCustomerModal = useCallback((focus: "postcode" | "name") => {
    setInitialFocusField(focus);
    setIsCustomerModalOpen(true);
  }, []);

  const handleSelectOrderType = useCallback(
    (type: OrderType) => {
      if (type === OrderType.Delivery) {
        updateOrder(activeOrderIndex, { orderType: type });
        handleOpenCustomerModal("postcode");
      } else {
        updateOrder(activeOrderIndex, { orderType: type });
      }
    },
    [activeOrderIndex, updateOrder, handleOpenCustomerModal]
  );

  const handleAddItem = useCallback(
    (item: MenuItem) => {
      const newOrderItem: OrderItem = {
        id: crypto.randomUUID(),
        menuItem: { ...item },
        displayName: item.name.en,
        modifiers: [],
        quantity: 1,
        finalPrice: isZeroPriceMode ? 0 : item.price || 0,
        selections: (item as any).selections,
      };

      if (isZeroPriceMode) {
        newOrderItem.displayName += " (£0)";
        newOrderItem.finalPrice = 0;
      }

      const newOrderItems = [...currentOrderItems, newOrderItem];
      updateOrder(activeOrderIndex, { items: newOrderItems });
      setSelectedOrderItemId(newOrderItem.id);
    },
    [currentOrderItems, isZeroPriceMode, activeOrderIndex, updateOrder]
  );

  const handleRemoveItem = useCallback(() => {
    if (!selectedOrderItemId) return;
    const itemIndex = currentOrderItems.findIndex(
      (item) => item.id === selectedOrderItemId
    );
    if (itemIndex === -1) return;

    const itemToRemove = currentOrderItems[itemIndex];
    let newItems: OrderItem[];

    if (itemToRemove.quantity > 1) {
      newItems = currentOrderItems.map((item) =>
        item.id === selectedOrderItemId
          ? { ...item, quantity: item.quantity - 1 }
          : item
      );
      updateOrder(activeOrderIndex, { items: newItems });
    } else {
      newItems = currentOrderItems.filter(
        (item) => item.id !== selectedOrderItemId
      );
      let newSelectedItemId: string | null = null;
      if (newItems.length > 0) {
        const newIndexToSelect = Math.min(itemIndex, newItems.length - 1);
        newSelectedItemId = newItems[newIndexToSelect].id;
      }
      updateOrder(activeOrderIndex, { items: newItems });
      setSelectedOrderItemId(newSelectedItemId);
    }
  }, [selectedOrderItemId, currentOrderItems, activeOrderIndex, updateOrder]);

  const handleDuplicateItem = useCallback(() => {
    if (!selectedOrderItemId) return;
    const newItems = currentOrderItems.map((item) =>
      item.id === selectedOrderItemId
        ? { ...item, quantity: item.quantity + 1 }
        : item
    );
    updateOrder(activeOrderIndex, { items: newItems });
  }, [selectedOrderItemId, currentOrderItems, activeOrderIndex, updateOrder]);

  const handleOpenModificationModal = useCallback(
    (itemId: string) => {
      const item = currentOrderItems.find((i) => i.id === itemId);
      if (item) {
        setItemToModify(item);
        setIsModificationModalOpen(true);
      }
    },
    [currentOrderItems]
  );

  const handleUpdateOrderItem = useCallback(
    (updatedItem: OrderItem) => {
      const newItems = currentOrderItems.map((item) =>
        item.id === updatedItem.id ? updatedItem : item
      );
      updateOrder(activeOrderIndex, { items: newItems });
      setIsModificationModalOpen(false);
      setItemToModify(null);
    },
    [currentOrderItems, activeOrderIndex, updateOrder]
  );

  const handleSaveCustomerInfo = useCallback(
    (info: CustomerInfo) => {
      updateOrder(activeOrderIndex, { customerInfo: info });
      setIsCustomerModalOpen(false);
    },
    [activeOrderIndex, updateOrder]
  );

  const handleAddItemById = useCallback(
    (itemId: string) => {
      const itemToAdd = menuItems.find((item) => item.id === itemId);
      if (itemToAdd) handleAddItem(itemToAdd);
      else alert(`Item with ID "${itemId}" not found.`);
    },
    [menuItems, handleAddItem]
  );

  const handleFocItem = useCallback(() => {
    if (!selectedOrderItemId) return;
    const newItems = currentOrderItems.map((item) =>
      item.id === selectedOrderItemId
        ? { ...item, finalPrice: 0, displayName: `${item.displayName} (FOC)` }
        : item
    );
    updateOrder(activeOrderIndex, { items: newItems });
  }, [selectedOrderItemId, currentOrderItems, activeOrderIndex, updateOrder]);

  const handleNewOrder = useCallback(() => {
    if (orders.length >= 9) {
      alert("Maximum of 9 orders reached.");
      return;
    }
    const nextId =
      orders.length > 0 ? Math.max(...orders.map((o) => o.id)) + 1 : 1;
    const newOrder = createNewOrder(nextId);
    setOrders((prev) => [...prev, newOrder]);
    setActiveOrderIndex(orders.length);
    setSelectedOrderItemId(null);
  }, [orders]);

  const handleAcceptOrder = useCallback(async () => {
    if (!activeOrder || activeOrder.items.length === 0) {
      alert("Cannot accept an empty order.");
      return;
    }
    setOrderToConfirm(activeOrder);
    setIsConfirmationModalOpen(true);
  }, [activeOrder]);

  const handleConfirmAndPrint = useCallback(
    async (paymentDetails: { amountPaid: number; changeDue: number }) => {
      if (!orderToConfirm) return;
      const orderToPrint = { ...orderToConfirm };
      const finalSubtotal = subtotal;
      const finalTotal = total;
      const currentOrderCount = orders.length;
      const removingIndex = orders.findIndex((o) => o.id === orderToConfirm.id);
      setIsConfirmationModalOpen(false);
      setOrderToConfirm(null);
      setOrders((prevOrders) => {
        const newOrders = prevOrders.filter((o) => o.id !== orderToPrint.id);
        return newOrders.length > 0 ? newOrders : [createNewOrder(1)];
      });
      if (currentOrderCount === 1) {
        setActiveOrderIndex(0);
      } else {
        const newIndex = Math.min(removingIndex, currentOrderCount - 2);
        setActiveOrderIndex(newIndex < 0 ? 0 : newIndex);
      }
      const orderPayload = {
        ...orderToPrint,
        subtotal: finalSubtotal,
        total: finalTotal,
        deliveryCharge: DELIVERY_CHARGE,
        paymentDetails,
      };
      fetch(`${API_BASE_URL}/api/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      })
        .then(async (response) => {
          if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.message || "Failed to print");
          }
          console.log(
            `Print job for order ${orderToPrint.id} sent successfully.`
          );
        })
        .catch((error) => {
          console.error("Background Printing Error:", error);
          alert(
            `Order ${orderToPrint.id} was accepted, but failed to print automatically. Error: ${error.message}`
          );
        });
    },
    [orderToConfirm, orders, subtotal, total]
  );

  if (!activeOrder) return <div>Loading...</div>;

  return (
    <div className="relative h-screen w-screen bg-gray-300 flex flex-col font-sans text-sm p-2 gap-4">
      {showNotification && lastCall && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-96 bg-blue-600 text-white p-4 rounded-lg shadow-2xl z-50 border-4 border-white">
          <h3 className="text-xl font-bold text-center">Incoming Call!</h3>
          <div className="mt-2 text-base">
            <p>
              <span className="font-semibold">Phone:</span> {lastCall.phone}
            </p>
            <p>
              <span className="font-semibold">Status:</span> {lastCall.status}
            </p>
            <p>
              <span className="font-semibold">Call Count:</span>{" "}
              {lastCall.callCount}
            </p>
          </div>
          <button
            onClick={() => setShowNotification(false)}
            className="absolute top-1 right-1 text-white hover:text-blue-200"
          >
            &#x2715;
          </button>
        </div>
      )}
      <div className="flex-shrink-0 flex items-center bg-gray-300">
        <div className="bg-gray-500 text-white font-bold p-1">PARTNER</div>
        <div className="flex-grow flex ml-4">
          <PosButton className="bg-blue-600 text-white border-blue-700">
            F5 - Menu 菜单挑选
          </PosButton>
          <PosButton onClick={() => handleOpenCustomerModal("postcode")}>
            F6 - Find Address 地址搜寻
          </PosButton>
        </div>
        <div className="flex items-center gap-2 mr-4">
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
            }`}
          ></div>
          <span className="text-xs font-semibold">
            {isConnected ? "CONNECTED" : "DISCONNECTED"}
          </span>
        </div>
        <PosButton
          onClick={() => setIsAdminPageOpen(true)}
          className="bg-purple-600 text-white border-purple-700"
        >
          Admin
        </PosButton>
      </div>
      <div className="flex-grow flex gap-4 overflow-hidden">
        <LeftPanel
          key={activeOrder.id}
          orders={orders}
          activeOrder={activeOrder}
          orderItems={currentOrderItems}
          selectedOrderItemId={selectedOrderItemId}
          onSelectItem={setSelectedOrderItemId}
          onRemoveItem={handleRemoveItem}
          onDuplicateItem={handleDuplicateItem}
          onModifyItem={handleOpenModificationModal}
          onSelectOrderType={handleSelectOrderType}
          setCustomerInfo={(info) =>
            updateOrder(activeOrderIndex, { customerInfo: info })
          }
          subtotal={subtotal}
          total={total}
          deliveryCharge={DELIVERY_CHARGE}
          onOpenCustomerModal={handleOpenCustomerModal}
          onNewOrder={handleNewOrder}
          onSetActiveOrder={setActiveOrderIndex}
          isZeroPriceMode={isZeroPriceMode}
          onToggleZeroPriceMode={() => setIsZeroPriceMode((prev) => !prev)}
          onFocItem={handleFocItem}
          onAcceptOrder={handleAcceptOrder}
        />
        <RightPanel
          menuItems={menuItems}
          onAddItem={handleAddItem}
          onOpenMenuRef={() => setIsMenuRefModalOpen(true)}
        />
      </div>
      {isModificationModalOpen && itemToModify && (
        <ItemModificationModal
          item={itemToModify}
          onClose={() => setIsModificationModalOpen(false)}
          onSave={handleUpdateOrderItem}
        />
      )}
      {isCustomerModalOpen && (
        <DeliveryAddressModal
          customerInfo={activeOrder.customerInfo}
          onClose={() => setIsCustomerModalOpen(false)}
          onSave={handleSaveCustomerInfo}
          initialFocusField={initialFocusField}
        />
      )}
      {isMenuRefModalOpen && (
        <MenuRefModal
          onClose={() => setIsMenuRefModalOpen(false)}
          onEnter={handleAddItemById}
        />
      )}
      {isAdminPageOpen && (
        <AdminPage onClose={() => setIsAdminPageOpen(false)} />
      )}
      {isConfirmationModalOpen && orderToConfirm && (
        <ConfirmationModal
          orderTotal={total}
          onClose={() => {
            setIsConfirmationModalOpen(false);
            setOrderToConfirm(null);
          }}
          onConfirm={handleConfirmAndPrint}
        />
      )}
      {isAddressSelectionModalOpen && customerForSelection && (
        <AddressSelectionModal
          customer={customerForSelection}
          onClose={() => setIsAddressSelectionModalOpen(false)}
          onSelect={handleSelectAddress}
        />
      )}
    </div>
  );
}
