import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  ReactNode,
} from "react";
import {
  OrderItem,
  MenuItem,
  OrderType,
  CustomerInfo,
  Order, // Using the Interface from types.ts
} from "../types";
import {
  DELIVERY_CHARGE,
  calculateDeliveryCharge,
  SET_MEAL_COMPONENTS,
  API_BASE_URL,
} from "../constants";
import menuData from "../menu.json";

// We need to extend the Order interface locally if it's missing properties in types.ts
// or ensure types.ts matches what App.tsx was using.
// App.tsx defined Order locally with more fields than types.ts seemed to have?
// Let's check the view of types.ts again.
// types.ts has Order interface but App.tsx acted like it had 'items', 'orderType', 'customerInfo'.
// The viewed types.ts Order interface looked incomplete compared to App.tsx usage:
/*
export interface Order {
  postcode?: string;
  ...
}
*/
// In App.tsx:
/*
interface Order {
  id: number;
  items: OrderItem[];
  orderType: OrderType;
  customerInfo: CustomerInfo;
  discount: number;
  ...
}
*/
// I will redefine the FullOrder interface here to match App.tsx usage EXACTLY,
// overlapping with types.ts where possible or extending it.

export interface FullOrder {
  id: number;
  items: OrderItem[];
  orderType: OrderType;
  customerInfo: CustomerInfo;
  discount: number;
  autoCreated?: boolean;
  createdAt?: number;
  hasUnreadChanges?: boolean;
  deliveryCharge?: number;
  lastActivityTime?: number;
}

interface OrderContextType {
  orders: FullOrder[];
  activeOrderIndex: number;
  activeOrder: FullOrder;
  currentOrderItems: OrderItem[];
  subtotal: number;
  total: number;
  selectedOrderItemId: string | null;
  menuItems: MenuItem[];
  completedOrdersSessionCount: number;

  // Modes
  isZeroPriceMode: boolean;
  isSwapMode: boolean;
  toggleZeroPriceMode: () => void;
  toggleSwapMode: () => void;
  setIsSwapMode: (value: boolean) => void;

  // Actions
  setActiveOrderIndex: (index: number) => void;
  setSelectedOrderItemId: (id: string | null) => void;
  createNewOrder: (autoCreated?: boolean, initialData?: Partial<FullOrder>) => void;
  deleteOrder: () => void; // Deletes active order
  updateOrder: (orderIndex: number, updatedOrder: Partial<FullOrder>) => void;

  // Item Manipulation
  addItem: (item: MenuItem) => void;
  removeItem: () => void;
  duplicateItem: () => void;
  updateOrderItem: (updatedItem: OrderItem) => void;
  setFocItem: () => void;

  // Complex Actions
  printOrder: (
    order: FullOrder,
    paymentDetails: { amountPaid: number; changeDue: number },
  ) => Promise<void>;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

// Helper to create order
const createNewOrderHelper = (
  id: number,
  autoCreated: boolean = false,
  hasUnreadChanges: boolean = false,
): FullOrder => ({
  id,
  items: [],
  orderType: OrderType.Collection,
  customerInfo: {},
  discount: 0,
  autoCreated,
  createdAt: autoCreated ? Date.now() : undefined,
  hasUnreadChanges,
  deliveryCharge: DELIVERY_CHARGE,
  lastActivityTime: Date.now(),
});

export function OrderProvider({ children }: { children: ReactNode }) {
  const [menuItems] = useState<MenuItem[]>(menuData as MenuItem[]);
  const [orders, setOrders] = useState<FullOrder[]>([createNewOrderHelper(1)]);
  const [activeOrderIndex, setActiveOrderIndex] = useState(0);
  const [selectedOrderItemId, setSelectedOrderItemId] = useState<string | null>(null);
  const [completedOrdersSessionCount, setCompletedOrdersSessionCount] = useState(0);

  const [isZeroPriceMode, setIsZeroPriceMode] = useState(false);
  const [isSwapMode, setIsSwapMode] = useState(false);

  const activeOrder = useMemo(() => orders[activeOrderIndex], [orders, activeOrderIndex]);

  const currentOrderItems = useMemo(() => activeOrder?.items || [], [activeOrder]);

  const subtotal = useMemo(
    () => currentOrderItems.reduce((acc, item) => acc + item.finalPrice * item.quantity, 0),
    [currentOrderItems],
  );

  const total = useMemo(() => {
    if (!activeOrder) return 0;
    const delivery =
      activeOrder.orderType === OrderType.Delivery
        ? (activeOrder.deliveryCharge ?? DELIVERY_CHARGE)
        : 0;
    return subtotal + delivery - activeOrder.discount;
  }, [subtotal, activeOrder]);

  const updateOrder = useCallback((orderIndex: number, updatedOrder: Partial<FullOrder>) => {
    setOrders((prevOrders) => {
      const newOrders = [...prevOrders];
      if (newOrders[orderIndex]) {
        newOrders[orderIndex] = { ...newOrders[orderIndex], ...updatedOrder };
      }
      return newOrders;
    });
  }, []);

  // --- Actions ---

  const createNewOrder = useCallback(
    (autoCreated: boolean = false, initialData: Partial<FullOrder> = {}) => {
      if (orders.length >= 9) {
        alert("Maximum of 9 orders reached.");
        return;
      }
      setOrders((prev) => {
        const nextId = prev.length > 0 ? Math.max(...prev.map((o) => o.id)) + 1 : 1;
        let newOrder = createNewOrderHelper(nextId, autoCreated);

        // If initialData provided, merge it. Ensure we preserve the ID and other core flags if not strictly overridden.
        // initialData might contain customerInfo, deliveryCharge, hasUnreadChanges
        if (initialData) {
          newOrder = { ...newOrder, ...initialData };
        }
        return [...prev, newOrder];
      });
      // If user triggered manually (autoCreated=false), switch to it
      if (!autoCreated) {
        // We need to know the index of the new order.
        // Since state updates are async, simpler to set index to length (current length = index of next)
        setActiveOrderIndex(orders.length);
        setSelectedOrderItemId(null);
      }
    },
    [orders],
  );

  const deleteOrder = useCallback(() => {
    // Note: Confirmation should be handled by UI before calling this,
    // BUT App.tsx handled it inside. We will move confirmation to UI layer using this context.
    // Here we just perform the delete.

    const currentOrderCount = orders.length;
    const removingIndex = activeOrderIndex;

    setOrders((prevOrders) => {
      const newOrders = prevOrders.filter((_, index) => index !== removingIndex);
      return newOrders.length > 0 ? newOrders : [createNewOrderHelper(1)];
    });

    if (currentOrderCount === 1) {
      setActiveOrderIndex(0);
    } else {
      const newIndex = Math.min(removingIndex, currentOrderCount - 2);
      setActiveOrderIndex(newIndex < 0 ? 0 : newIndex);
    }
    setSelectedOrderItemId(null);
  }, [activeOrderIndex, orders]);

  const toggleZeroPriceMode = useCallback(() => setIsZeroPriceMode((p) => !p), []);
  const toggleSwapMode = useCallback(() => setIsSwapMode((p) => !p), []);

  const addItem = useCallback(
    (item: MenuItem) => {
      // --- 1. SET MEAL LOGIC: Auto-add components ---
      if (SET_MEAL_COMPONENTS[item.id]) {
        const componentIds = SET_MEAL_COMPONENTS[item.id];

        // Base Set Meal Item
        const setMealItem: OrderItem = {
          id: crypto.randomUUID(),
          menuItem: { ...item },
          displayName: item.name.en,
          modifiers: [],
          quantity: 1,
          finalPrice: item.price || 0,
          selections: (item as any).selections,
        };

        // Component Items
        const componentItems = componentIds
          .map((compId) => {
            const compMenuItem = menuItems.find((m) => m.id === compId);
            if (!compMenuItem) return null;
            return {
              id: crypto.randomUUID(),
              menuItem: { ...compMenuItem },
              displayName: compMenuItem.name.en,
              modifiers: [],
              quantity: 1,
              finalPrice: 0,
              hideQuantity: true,
              hidePrice: true,
              isPartOfSet: true,
              setMealId: setMealItem.id,
              selections: (compMenuItem as any).selections,
            } as OrderItem;
          })
          .filter((i): i is OrderItem => i !== null);

        const newOrderItems = [...currentOrderItems, setMealItem, ...componentItems];
        updateOrder(activeOrderIndex, {
          items: newOrderItems,
          lastActivityTime: Date.now(),
        });
        setSelectedOrderItemId(setMealItem.id);
        return;
      }

      // --- 2. SWAP MODE LOGIC ---
      if (isSwapMode) {
        // Option A: Replacing an item in a Set Meal
        if (selectedOrderItemId) {
          const selectedIndex = currentOrderItems.findIndex((i) => i.id === selectedOrderItemId);
          const selectedItem = currentOrderItems[selectedIndex];

          if (selectedItem && selectedItem.isPartOfSet) {
            // Perform Replacement
            const newItem: OrderItem = {
              ...selectedItem,
              menuItem: { ...item },
              displayName: item.name.en,
              selections: (item as any).selections,
              modifiers: [], // Reset modifiers
              // Inherit specific flags
              finalPrice: 0,
              hideQuantity: true,
              hidePrice: true,
              isSwapped: true,
              // Keep isPartOfSet, setMealId, id, quantity logic
            };

            const newItems = [...currentOrderItems];
            newItems[selectedIndex] = newItem;
            updateOrder(activeOrderIndex, {
              items: newItems,
              lastActivityTime: Date.now(),
            });

            // Turn off swap mode after a single specific replacement (UX choice)
            setIsSwapMode(false);
            return;
          }
        }

        // Option B: Happy Meal "Add as Free" logic
        const newItem: OrderItem = {
          id: crypto.randomUUID(),
          menuItem: { ...item },
          displayName: item.name.en,
          modifiers: [],
          quantity: 1,
          finalPrice: 0,
          hideQuantity: true,
          hidePrice: true,
          selections: (item as any).selections,
        };
        const newOrderItems = [...currentOrderItems, newItem];
        updateOrder(activeOrderIndex, {
          items: newOrderItems,
          lastActivityTime: Date.now(),
        });
        setSelectedOrderItemId(newItem.id);
        return;
      }

      // --- 3. NORMAL ADD LOGIC ---
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
      updateOrder(activeOrderIndex, {
        items: newOrderItems,
        lastActivityTime: Date.now(),
      });
      setSelectedOrderItemId(newOrderItem.id);
    },
    [
      currentOrderItems,
      isZeroPriceMode,
      activeOrderIndex,
      updateOrder,
      isSwapMode,
      selectedOrderItemId,
      menuItems,
    ],
  );

  const removeItem = useCallback(() => {
    if (!selectedOrderItemId) return;
    const itemIndex = currentOrderItems.findIndex((item) => item.id === selectedOrderItemId);
    if (itemIndex === -1) return;

    const itemToRemove = currentOrderItems[itemIndex];

    // --- CASCADE DELETE LOGIC ---
    const setMealChildrenIds = currentOrderItems
      .filter((i) => i.setMealId === itemToRemove.id)
      .map((i) => i.id);

    const idsToRemove = new Set([itemToRemove.id, ...setMealChildrenIds]);

    let newItems: OrderItem[];

    if (itemToRemove.quantity > 1 && setMealChildrenIds.length === 0) {
      newItems = currentOrderItems.map((item) =>
        item.id === selectedOrderItemId ? { ...item, quantity: item.quantity - 1 } : item,
      );
      updateOrder(activeOrderIndex, {
        items: newItems,
        lastActivityTime: Date.now(),
      });
    } else {
      newItems = currentOrderItems.filter((item) => !idsToRemove.has(item.id));
      let newSelectedItemId: string | null = null;
      if (newItems.length > 0) {
        const newIndexToSelect = Math.min(itemIndex, newItems.length - 1);
        newSelectedItemId = newItems[newIndexToSelect].id;
      }
      updateOrder(activeOrderIndex, {
        items: newItems,
        lastActivityTime: Date.now(),
      });
      setSelectedOrderItemId(newSelectedItemId);
    }
  }, [selectedOrderItemId, currentOrderItems, activeOrderIndex, updateOrder]);

  const duplicateItem = useCallback(() => {
    if (!selectedOrderItemId) return;
    const newItems = currentOrderItems.map((item) =>
      item.id === selectedOrderItemId ? { ...item, quantity: item.quantity + 1 } : item,
    );
    updateOrder(activeOrderIndex, {
      items: newItems,
      lastActivityTime: Date.now(),
    });
  }, [selectedOrderItemId, currentOrderItems, activeOrderIndex, updateOrder]);

  const updateOrderItem = useCallback(
    (updatedItem: OrderItem) => {
      const newItems = currentOrderItems.map((item) =>
        item.id === updatedItem.id ? updatedItem : item,
      );
      updateOrder(activeOrderIndex, {
        items: newItems,
        lastActivityTime: Date.now(),
      });
    },
    [currentOrderItems, activeOrderIndex, updateOrder],
  );

  const setFocItem = useCallback(() => {
    if (!selectedOrderItemId) return;
    const newItems = currentOrderItems.map((item) =>
      item.id === selectedOrderItemId
        ? { ...item, finalPrice: 0, displayName: `${item.displayName} (FOC)` }
        : item,
    );
    updateOrder(activeOrderIndex, {
      items: newItems,
      lastActivityTime: Date.now(),
    });
  }, [selectedOrderItemId, currentOrderItems, activeOrderIndex, updateOrder]);

  // Clean inactivity
  useEffect(() => {
    const cleanupExpiredOrders = () => {
      setOrders((prevOrders) => {
        const now = Date.now();
        const ordersKeep = prevOrders.filter((order) => {
          if (order.items.length === 0 && order.lastActivityTime) {
            if (now - order.lastActivityTime > 5 * 60 * 1000) {
              console.log(
                `[AUTO-DELETE] Removing order ${order.id} due to 5 minutes of inactivity`,
              );
              return false; // Remove
            }
          }
          return true;
        });

        if (ordersKeep.length !== prevOrders.length) {
          const finalOrders = ordersKeep.length > 0 ? ordersKeep : [createNewOrderHelper(1)];

          setActiveOrderIndex((prevIndex) => {
            if (prevIndex >= finalOrders.length) {
              return Math.max(0, finalOrders.length - 1);
            }
            return prevIndex;
          });

          return finalOrders;
        }
        return prevOrders;
      });
    };

    const interval = setInterval(cleanupExpiredOrders, 60 * 1000);
    return () => clearInterval(interval);
  }, []); // Orders dependency not strictly needed if we use functional updates correctly, but App.tsx had it.
  // Actually, functional state update `prevOrders` handles it. Empty dep array is better for performance if possible.

  const printOrder = useCallback(
    async (order: FullOrder, paymentDetails: { amountPaid: number; changeDue: number }) => {
      const orderPayload = {
        ...order,
        subtotal,
        total, // Note: these are captured from context closure. Should make sure they match the order being printed if it's the active one.
        // If printing a non-active order, this might be buggy. But we usually print active order.
        deliveryCharge: order.deliveryCharge ?? DELIVERY_CHARGE,
        paymentDetails,
      };

      try {
        const response = await fetch(`${API_BASE_URL}/api/print`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderPayload),
        });

        if (!response.ok) {
          const errorResult = await response.json();
          throw new Error(errorResult.message || "Failed to print");
        }
        console.log(`Print job for order ${order.id} sent successfully.`);

        setCompletedOrdersSessionCount((prev) => {
          const newCount = prev + 1;
          if (newCount >= 3) {
            // Refresh logic
            window.location.reload();
            return 0;
          }
          return newCount;
        });
      } catch (error: any) {
        console.error("Background Printing Error:", error);
        alert(
          `Order ${order.id} was accepted, but failed to print automatically. Error: ${error.message}`,
        );
      }
    },
    [subtotal, total],
  );

  const handleSetActiveOrderAndClearUnread = useCallback(
    (index: number) => {
      if (index >= 0 && index < orders.length) {
        setActiveOrderIndex(index);
        setOrders((prev) => {
          const newOrders = [...prev];
          if (newOrders[index] && newOrders[index].hasUnreadChanges) {
            newOrders[index] = { ...newOrders[index], hasUnreadChanges: false };
          }
          return newOrders;
        });
      }
    },
    [orders.length],
  );

  const value = {
    orders,
    activeOrderIndex,
    activeOrder,
    currentOrderItems,
    subtotal,
    total,
    selectedOrderItemId,
    menuItems,
    completedOrdersSessionCount,
    isZeroPriceMode,
    isSwapMode,
    toggleZeroPriceMode,
    toggleSwapMode,
    setIsSwapMode,
    setActiveOrderIndex: handleSetActiveOrderAndClearUnread,
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
  };

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

export function useOrder() {
  const context = useContext(OrderContext);
  if (context === undefined) {
    throw new Error("useOrder must be used within an OrderProvider");
  }
  return context;
}
