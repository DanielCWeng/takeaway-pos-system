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
  // Ref to track the last processed call timestamp to prevent duplicate handling
  const lastProcessedCallTime = React.useRef<string | null>(null);
  const lastProcessedCallPhone = React.useRef<string | null>(null);

  // [THE CORRECT useEffect - THIS POPULATES THE ORDER]
  React.useEffect(() => {
    const handleIncomingCall = async (callData: any) => {
      // Always show notification for a new call
      setShowNotification(true);
      setCurrentCaller(callData);

      const timer = setTimeout(() => setShowNotification(false), 8000);

      // Logic to decide if we should auto-populate the order
      // We only auto-populate if the active order is effectively empty
      const shouldAutoPopulate =
        activeOrder &&
        activeOrder.items.length === 0 &&
        !activeOrder.customerInfo.phone;

      let targetOrderIndex = activeOrderIndex;
      let isNewOrder = false;

      if (!shouldAutoPopulate) {
        console.log(
          "[EFFECT] Call received but order is active. Will create background order after data fetch."
        );
      }

      try {
        console.log(
          `[EFFECT] New call from ${callData.phone}, fetching customer data...`
        );

        const response = await fetch(
          `${API_BASE_URL}/api/customer/${callData.phone}`
        );

        // Helper to update the target order (either active or newly created)
        const updateTargetOrder = (info: Partial<Order>) => {
          setOrders((prevOrders) => {
            // If it was a new order, we need to find it again because state might have updated
            // But since we are inside the effect, we rely on functional update
            // However, 'targetOrderIndex' calculated above is valid for the *next* render, 
            // but inside this async function, we need to be careful.
            // Actually, simpler: just append/update based on index if we know it.
            
            // If we created a new order, it's at the end. 
            // BUT, React state updates are batched/async. 
            // The 'setOrders' above might not have applied yet when we run this.
            // So we should probably do the fetch FIRST, then decide whether to create new or update existing.
            return prevOrders; 
          });
        };
        
        // RE-FACTORING to avoid state race conditions:
        // 1. Fetch data first.
        // 2. Then determine if we need a new order or update existing.
        
        let customerDataToApply: CustomerInfo = {};

        if (response.ok) {
          const customer = await response.json();
          console.log("[EFFECT] Found existing customer:", customer);

          if (customer.addresses && Array.isArray(customer.addresses)) {
            if (customer.addresses.length > 1) {
               // ... (complex address selection logic - might need to skip for background orders or pick default)
               // For background orders, we probably can't show the modal immediately if user is working.
               // Let's just pick the first one for now or leave it blank?
               // Requirement: "put the phone number into a new order"
               // If we need selection, maybe just set phone/name and let user pick address later?
               // Let's pick first address for now to be helpful.
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
                  setCustomerForSelection(customer);
                  setIsAddressSelectionModalOpen(true);
                  return () => clearTimeout(timer); // Stop here, let modal handle it
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
          customerDataToApply = {
            phone: callData.phone,
            postcode: callData.postcode,
          };
        }

        // NOW apply to state
        setOrders((prevOrders) => {
           const newOrders = [...prevOrders];
           // Re-evaluate shouldAutoPopulate inside the setter to be safe with latest state
           const currentActive = newOrders[activeOrderIndex];
           const actuallyShouldAutoPopulate = currentActive && currentActive.items.length === 0 && !currentActive.customerInfo.phone;

           if (actuallyShouldAutoPopulate) {
              newOrders[activeOrderIndex] = {
                 ...newOrders[activeOrderIndex],
                 customerInfo: customerDataToApply
              };
           } else {
              // Create background order
              const nextId = newOrders.length > 0 ? Math.max(...newOrders.map((o) => o.id)) + 1 : 1;
              const newOrder = createNewOrder(nextId, true, true);
              newOrder.customerInfo = customerDataToApply;
              newOrders.push(newOrder);
           }
           return newOrders;
        });

      } catch (error) {
        console.error("[EFFECT] Error fetching customer data:", error);
      }

      return () => clearTimeout(timer);
    };

    // Check if we have a call and if it's a NEW call (different timestamp or phone)
    // We check phone too in case timestamps collide (e.g. rapid calls)
    if (lastCall && (lastCall.timestamp !== lastProcessedCallTime.current || lastCall.phone !== lastProcessedCallPhone.current)) {
      console.log("[PROCESSING CALL] New call detected:", lastCall);
      lastProcessedCallTime.current = lastCall.timestamp;
      lastProcessedCallPhone.current = lastCall.phone;
      handleIncomingCall(lastCall);
    }
  }, [lastCall, activeOrderIndex, orders]); // Added orders to ensure activeOrder is fresh in closure

  // 5-minute timeout for auto-created orders
  React.useEffect(() => {
    const interval = setInterval(() => {
      setOrders((prevOrders) => {
        const now = Date.now();
        const ordersKeep = prevOrders.filter((order) => {
          if (order.autoCreated && order.items.length === 0) {
             // Check if 5 minutes passed
             if (order.createdAt && (now - order.createdAt > 5 * 60 * 1000)) {
                return false; // Remove
             }
          }
          return true;
        });
        
        if (ordersKeep.length !== prevOrders.length) {
           return ordersKeep;
        }
        return prevOrders;
      });
    }, 60 * 1000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const handleSetActiveOrder = (index: number) => {
    setActiveOrderIndex(index);
    // Clear unread status
    setOrders(prev => {
       const newOrders = [...prev];
       if (newOrders[index].hasUnreadChanges) {
          newOrders[index] = { ...newOrders[index], hasUnreadChanges: false };
       }
       return newOrders;
    });
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
    </div>
  );
}
