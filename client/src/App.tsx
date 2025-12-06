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
import { DELIVERY_CHARGE, API_BASE_URL } from "./constants";
import LeftPanel from "./components/LeftPanel";
import RightPanel from "./components/RightPanel";
import ItemModificationModal from "./components/ItemModificationModal";
import DeliveryAddressModal from "./components/DeliveryAddressModal";
import MenuRefModal from "./components/MenuRefModal";
import AdminPage from "./components/AdminPage";
import ConfirmationModal from "./components/ConfirmationModal";
import AddressSelectionModal from "./components/AddressSelectionModal";
import NumpadInputModal from "./components/NumpadInputModal";
import menuData from "./menu.json";
import { OrderItem, MenuItem, OrderType, CustomerInfo } from "./types";
import { useCallerId } from "./context/CallerIDContext";

interface Order {
  id: number;
  items: OrderItem[];
  orderType: OrderType;
  customerInfo: CustomerInfo;
  discount: number;
  autoCreated?: boolean;
  createdAt?: number;
  hasUnreadChanges?: boolean;
  deliveryCharge?: number;
}

const createNewOrder = (
  id: number,
  autoCreated: boolean = false,
  hasUnreadChanges: boolean = false
): Order => ({
  id,
  items: [],
  orderType: OrderType.Collection,
  customerInfo: {},
  discount: 0,
  autoCreated,
  createdAt: autoCreated ? Date.now() : undefined,
  hasUnreadChanges,
  deliveryCharge: DELIVERY_CHARGE,
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
  const [isDeliveryPriceModalOpen, setIsDeliveryPriceModalOpen] = useState(false);

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
  // Ref to track the last processed call timestamp to prevent duplicate handling
  const lastProcessedCallTime = React.useRef<string | null>(null);
  const lastProcessedCallPhone = React.useRef<string | null>(null);

  // Ref to track if we are currently populating the active order to prevent race conditions
  const isPopulatingActiveOrder = React.useRef(false);

  // [THE CORRECT useEffect - THIS POPULATES THE ORDER]
  React.useEffect(() => {
    const handleIncomingCall = async (callData: any) => {
      // Always show notification for a new call
      setShowNotification(true);
      setCurrentCaller(callData);

      const timer = setTimeout(() => setShowNotification(false), 8000);

      console.log(
        `[CALL START] Processing call from ${callData.phone}. Timestamp: ${callData.timestamp}`
      );
      console.log(`[CALL STATE] Active Order Index: ${activeOrderIndex}`);
      console.log(`[CALL STATE] Active Order ID: ${activeOrder.id}`);
      console.log(
        `[CALL STATE] Active Order Items Count: ${activeOrder.items.length}`
      );
      console.log(
        `[CALL STATE] Active Order Has Phone? ${!!activeOrder.customerInfo
          .phone}`
      );
      console.log(
        `[CALL STATE] Is Populating Lock? ${isPopulatingActiveOrder.current}`
      );

      // Logic to decide if we should auto-populate the order
      // We only auto-populate if the active order is effectively empty AND we aren't already populating it
      const shouldAutoPopulate =
        !isPopulatingActiveOrder.current &&
        activeOrder &&
        activeOrder.items.length === 0 &&
        !activeOrder.customerInfo.phone;

      console.log(
        `[CALL DECISION] Should Auto Populate? ${shouldAutoPopulate}`
      );

      if (shouldAutoPopulate) {
        console.log(
          "[CALL DECISION] Decided to AUTO-POPULATE active order. Acquiring lock."
        );
        isPopulatingActiveOrder.current = true;
      } else {
        console.log("[CALL DECISION] Decided to create BACKGROUND order.");
      }

      if (!shouldAutoPopulate) {
        console.log(
          "[EFFECT] Call received but order is active (or locked). Will create background order after data fetch."
        );
      }

      try {
        console.log(
          `[EFFECT] New call from ${callData.phone}, fetching customer data...`
        );

        const response = await fetch(
          `${API_BASE_URL}/api/customer/${callData.phone}`
        );

        let customerDataToApply: CustomerInfo = {};

        if (response.ok) {
          const customer = await response.json();
          console.log("[EFFECT] Found existing customer:", customer);

          if (customer.addresses && Array.isArray(customer.addresses)) {
            if (customer.addresses.length > 1) {
              const singleAddress = customer.addresses[0];
              customerDataToApply = {
                phone: customer.phone,
                name: customer.name,
                postcode: singleAddress.postcode,
                houseNumber: singleAddress.houseNumber,
                street: singleAddress.street,
                town: singleAddress.town,
                distance: callData.distance,
              };
              // If it's the ACTIVE order, we can show modal.
              if (shouldAutoPopulate) {
                console.log(
                  "[EFFECT] Opening address selection modal for active order."
                );
                setCustomerForSelection(customer);
                setIsAddressSelectionModalOpen(true);
                isPopulatingActiveOrder.current = false;
                return () => clearTimeout(timer);
              }
            } else if (customer.addresses.length === 1) {
              const singleAddress = customer.addresses[0];
              customerDataToApply = {
                phone: customer.phone,
                name: customer.name,
                postcode: singleAddress.postcode,
                houseNumber: singleAddress.houseNumber,
                street: singleAddress.street,
                town: singleAddress.town,
                distance: callData.distance,
              };
            } else {
              customerDataToApply = {
                phone: customer.phone,
                name: customer.name || "",
              };
            }
          } else if (customer.postcode) {
            customerDataToApply = {
              phone: customer.phone,
              name: customer.name || "",
              postcode: customer.postcode,
              houseNumber: customer.houseNumber,
              street: customer.street,
              town: customer.town,
              address: customer.address,
              distance: callData.distance,
            };
          } else {
            customerDataToApply = {
              phone: customer.phone,
              name: customer.name || "",
            };
          }
        } else {
          console.log("[EFFECT] New customer. Using raw call data.");
          customerDataToApply = {
            phone: callData.phone,
            postcode: callData.postcode,
          };
        }

        // NOW apply to state
        setOrders((prevOrders) => {
          const newOrders = [...prevOrders];

          if (shouldAutoPopulate) {
            console.log(
              "[UPDATE STATE] Populating ACTIVE order index:",
              activeOrderIndex
            );
            newOrders[activeOrderIndex] = {
              ...newOrders[activeOrderIndex],
              customerInfo: customerDataToApply,
            };
          } else {
            console.log("[UPDATE STATE] Creating BACKGROUND order.");
            // Create background order
            const nextId =
              newOrders.length > 0
                ? Math.max(...newOrders.map((o) => o.id)) + 1
                : 1;
            const newOrder = createNewOrder(nextId, true, true);
            newOrder.customerInfo = customerDataToApply;
            newOrders.push(newOrder);
          }
          return newOrders;
        });
      } catch (error) {
        console.error("[EFFECT] Error fetching customer data:", error);
      } finally {
        // Always release the lock when done
        if (shouldAutoPopulate) {
          console.log("[LOCK] Releasing populating lock.");
          isPopulatingActiveOrder.current = false;
        }
      }

      return () => clearTimeout(timer);
    };

    // Check if we have a call and if it's a NEW call (different timestamp or phone)
    // We check phone too in case timestamps collide (e.g. rapid calls)
    if (
      lastCall &&
      (lastCall.timestamp !== lastProcessedCallTime.current ||
        lastCall.phone !== lastProcessedCallPhone.current)
    ) {
      console.log("[PROCESSING CALL] New call detected:", lastCall);
      lastProcessedCallTime.current = lastCall.timestamp;
      lastProcessedCallPhone.current = lastCall.phone;
      handleIncomingCall(lastCall);
    }
  }, [lastCall, activeOrderIndex, orders]); // Added orders to ensure activeOrder is fresh in closure

  // 5-minute timeout for auto-created orders
  React.useEffect(() => {
    const hasAutoOrders = orders.some((o) => o.autoCreated);
    if (!hasAutoOrders) return;

    const cleanupExpiredOrders = () => {
      setOrders((prevOrders) => {
        const now = Date.now();
        const ordersKeep = prevOrders.filter((order) => {
          if (order.autoCreated && order.items.length === 0) {
            // Check if 5 minutes passed
            if (order.createdAt && now - order.createdAt > 5 * 60 * 1000) {
              return false; // Remove
            }
          }
          return true;
        });

        if (ordersKeep.length !== prevOrders.length) {
          // If we removed orders, we must ensure activeOrderIndex is still valid
          setActiveOrderIndex((prevIndex) => {
            if (prevIndex >= ordersKeep.length) {
              return Math.max(0, ordersKeep.length - 1);
            }
            return prevIndex;
          });
          return ordersKeep;
        }
        return prevOrders;
      });
    };

    const interval = setInterval(cleanupExpiredOrders, 60 * 1000); // Check every minute

    return () => clearInterval(interval);
  }, [orders]);

  const handleSetActiveOrder = (index: number) => {
    if (index >= 0 && index < orders.length) {
      setActiveOrderIndex(index);
      // Clear unread status
      setOrders((prev) => {
        const newOrders = [...prev];
        if (newOrders[index] && newOrders[index].hasUnreadChanges) {
          newOrders[index] = { ...newOrders[index], hasUnreadChanges: false };
        }
        return newOrders;
      });
    }
  };

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
      activeOrder.orderType === OrderType.Delivery
        ? (activeOrder.deliveryCharge ?? DELIVERY_CHARGE)
        : 0;
    return subtotal + delivery - activeOrder.discount;
  }, [subtotal, activeOrder]);

  const handleUpdateDeliveryCharge = useCallback(
    (newCharge: number) => {
      updateOrder(activeOrderIndex, { deliveryCharge: newCharge });
    },
    [activeOrderIndex, updateOrder]
  );

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
        deliveryCharge: orderToPrint.deliveryCharge ?? DELIVERY_CHARGE,
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

  // Safety check: if activeOrder is undefined (e.g. due to race condition), fallback to loading or reset
  if (!activeOrder && orders.length > 0) {
    // Try to recover by setting index to 0
    if (activeOrderIndex !== 0) setActiveOrderIndex(0);
    return <div>Recovering state...</div>;
  }

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
          deliveryCharge={activeOrder.deliveryCharge ?? DELIVERY_CHARGE}
          onEditDeliveryCharge={() => setIsDeliveryPriceModalOpen(true)}
          onOpenCustomerModal={handleOpenCustomerModal}
          onNewOrder={handleNewOrder}
          onSetActiveOrder={handleSetActiveOrder}
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
      {isDeliveryPriceModalOpen && (
        <NumpadInputModal
          title="Update Delivery Charge"
          initialValue={activeOrder.deliveryCharge ?? DELIVERY_CHARGE}
          onClose={() => setIsDeliveryPriceModalOpen(false)}
          onConfirm={(val) => handleUpdateDeliveryCharge(val)}
        />
      )}
    </div>
  );
}
