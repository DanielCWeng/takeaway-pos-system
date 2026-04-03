/**
 * client/src/context/OrderContext.tsx
 *
 * Provides the single source of truth for the active orders (multiple).
 * This context owns item manipulation, delivery charge calculation,
 * payment details, notes, printing logic, and multiple order state.
 */

/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiClient } from "../api/client";
import { useCaller } from "./CallerContext";
import type {
  FullOrder,
  OrderItem,
  OrderType,
  CustomerInfo,
  PaymentDetails,
  MenuItem,
} from "../types";
import { calculateDeliveryCharge } from "../constants/delivery";

export interface OrderState extends FullOrder {
  id: number;
  clientOrderId: string;
  hasUnreadChanges?: boolean;
  lastActivityTime?: number;
}

interface AddItemOptions {
  mode?: "normal" | "setMeal" | "swap" | "zeroPrice";
  setMealComponents?: OrderItem[];
  replaceIndex?: number;
  quantity?: number;
  parentId?: string;
  isFoc?: boolean;
  isIncluded?: boolean;
}

const generateUniqueId = () => Math.random().toString(36).substring(2, 11);

type AddableItem =
  | OrderItem
  | MenuItem
  | {
      id: string;
      name: string | { en: string; zh?: string };
      price: number;
      uniqueId?: string;
      zhName?: string;
      quantity?: number;
    };

interface OrderContextType {
  orders: OrderState[];
  activeOrderIndex: number;
  order: OrderState; // The currently active order
  subtotal: number;
  deliveryCharge: number;
  total: number;

  isZeroPriceMode: boolean;
  isSwapMode: boolean;
  isIncMode: boolean;
  isShortMode: boolean;
  setIsZeroPriceMode: (value: boolean | ((prev: boolean) => boolean)) => void;
  setIsSwapMode: (value: boolean | ((prev: boolean) => boolean)) => void;
  setIsIncMode: (value: boolean | ((prev: boolean) => boolean)) => void;
  setIsShortMode: (value: boolean | ((prev: boolean) => boolean)) => void;

  setActiveOrderIndex: (index: number) => void;
  createNewOrder: () => void;
  clearOrder: () => void; // Delete current order

  addItem: (item: AddableItem, options?: AddItemOptions) => void;
  removeItem: (index: number) => void;
  updateItem: (index: number, updater: (item: OrderItem) => OrderItem) => void;
  duplicateItem: (index: number) => void;
  setFocItem: (index: number) => void;

  setOrderType: (type: OrderType) => void;
  setCustomerInfo: (info: CustomerInfo | undefined) => void;
  updatePayment: (payment: PaymentDetails) => void;
  setNotes: (notes?: string) => void;
  printOrder: (orderToPrint?: FullOrder) => Promise<PrintResult>;
  pendingPrintJobs: number;
  isFlushingPrintQueue: boolean;
  lastPrintAlert: string | null;
  clearPrintAlert: () => void;
  retryQueuedPrints: () => Promise<void>;
}

type PrintResult =
  | { status: "printed"; orderId: number }
  | { status: "saved_not_printed"; orderId: number }
  | { status: "queued"; queuedAt: number };

type PrintQueueItem = {
  clientOrderId: string;
  order: FullOrder;
  queuedAt: number;
  attempts: number;
  lastAttemptAt?: number;
  lastError?: string;
};

const PRINT_QUEUE_STORAGE_KEY = "pos.print-queue.v1";

function generateClientOrderId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

function loadPrintQueue(): PrintQueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PRINT_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PrintQueueItem => {
      if (!item || typeof item !== "object") return false;
      const maybe = item as Partial<PrintQueueItem>;
      return (
        typeof maybe.clientOrderId === "string" &&
        typeof maybe.queuedAt === "number" &&
        typeof maybe.attempts === "number" &&
        !!maybe.order &&
        typeof maybe.order === "object" &&
        Array.isArray((maybe.order as FullOrder).items)
      );
    });
  } catch (error) {
    console.error("Failed to parse persisted print queue", error);
    return [];
  }
}

function shouldQueuePrintError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const withStatus = error as Error & { status?: number };
  if (typeof withStatus.status === "number") {
    return withStatus.status >= 500 || withStatus.status === 429;
  }
  // No HTTP status usually means network/transport failure.
  return true;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown print error";
}

const generateInitialOrder = (id: number): OrderState => ({
  id,
  clientOrderId: generateClientOrderId(),
  items: [],
  orderType: "collection",
  payment: { method: "cash", amount: 0 },
  total: 0,
  hasUnreadChanges: false,
  lastActivityTime: Date.now(),
});

const OrderContext = createContext<OrderContextType | undefined>(undefined);

function deriveTotals(order: OrderState) {
  const subtotal = order.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const deliveryCharge =
    order.orderType === "delivery"
      ? calculateDeliveryCharge(order.customerInfo?.distance)
      : 0;

  return {
    subtotal,
    deliveryCharge,
    total: subtotal + deliveryCharge,
  };
}

export function OrderProvider({ children }: { children: ReactNode }) {
  const { isConnected } = useCaller();
  const [orders, setOrders] = useState<OrderState[]>([generateInitialOrder(1)]);
  const [activeOrderIndex, setActiveOrderIndexState] = useState(0);

  const [isZeroPriceMode, setIsZeroPriceMode] = useState(false);
  const [isSwapMode, setIsSwapMode] = useState(false);
  const [isIncMode, setIsIncMode] = useState(false);
  const [isShortMode, setIsShortMode] = useState(false);
  const [printQueue, setPrintQueue] = useState<PrintQueueItem[]>(loadPrintQueue);
  const [isFlushingPrintQueue, setIsFlushingPrintQueue] = useState(false);
  const [lastPrintAlert, setLastPrintAlert] = useState<string | null>(null);
  const queueFlushInFlight = useRef(false);

  // Safety mechanism to ensure index is valid
  const safeIndex = Math.min(
    Math.max(0, activeOrderIndex),
    Math.max(0, orders.length - 1),
  );
  const order = orders[safeIndex] || generateInitialOrder(1);

  const setActiveOrderIndex = useCallback((index: number) => {
    setActiveOrderIndexState(index);
    setOrders((prev) => {
      const newOrders = [...prev];
      if (newOrders[index] && newOrders[index].hasUnreadChanges) {
        newOrders[index] = { ...newOrders[index], hasUnreadChanges: false };
      }
      return newOrders;
    });
  }, []);

  const updateOrderState = useCallback(
    (updater: (prev: OrderState) => Partial<OrderState>) => {
      setOrders((prev) => {
        const nextOrders = [...prev];
        const currentOrder = nextOrders[safeIndex];
        if (!currentOrder) return prev;

        const nextOrderState = {
          ...currentOrder,
          ...updater(currentOrder),
          lastActivityTime: Date.now(),
        };
        const totals = deriveTotals(nextOrderState);
        nextOrderState.total = totals.total;

        nextOrders[safeIndex] = nextOrderState;
        return nextOrders;
      });
    },
    [safeIndex],
  );

  const derivedTotals = useMemo(() => deriveTotals(order), [order]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PRINT_QUEUE_STORAGE_KEY, JSON.stringify(printQueue));
  }, [printQueue]);

  const createNewOrder = useCallback(() => {
    setOrders((prev) => {
      const nextId =
        prev.length > 0 ? Math.max(...prev.map((o) => o.id)) + 1 : 1;
      return [...prev, generateInitialOrder(nextId)];
    });
    // Set timeout to allow render cycle to pick up new array length
    setTimeout(() => {
      setActiveOrderIndexState((prev) => prev + 1);
    }, 0);
  }, []);

  const clearOrder = useCallback(() => {
    setOrders((prev) => {
      const nextOrders = prev.filter((_, idx) => idx !== safeIndex);
      if (nextOrders.length === 0) {
        return [generateInitialOrder(1)];
      }
      return nextOrders;
    });
    setActiveOrderIndexState((prev) => Math.max(0, prev - 1));
  }, [safeIndex]);

  const addItem = useCallback(
    (item: AddableItem, options: AddItemOptions = {}) => {
      const quantity =
        options.quantity ??
        ("quantity" in item && typeof item.quantity === "number"
          ? item.quantity
          : 1);
      const isNameObject =
        typeof item.name === "object" &&
        item.name !== null &&
        "en" in item.name;
      const baseName: { en: string; zh?: string } = isNameObject
        ? (item.name as { en: string; zh?: string })
        : { en: String(item.name), zh: undefined };
      const uniqueId =
        "uniqueId" in item && item.uniqueId
          ? item.uniqueId
          : generateUniqueId();
      const zhName = isNameObject
        ? baseName.zh
        : "zhName" in item
          ? item.zhName
          : undefined;
      const price =
        "price" in item && typeof item.price === "number" ? item.price : 0;
      const normalizedItem: OrderItem = {
        uniqueId,
        id: item.id || "CUSTOM",
        name: baseName.en,
        zhName,
        price,
        quantity,
        parentId: options.parentId,
        isFoc: options.isFoc,
        isIncluded: options.isIncluded,
      };

      if (
        options.mode === "zeroPrice" ||
        isZeroPriceMode ||
        normalizedItem.isFoc ||
        normalizedItem.isIncluded
      ) {
        normalizedItem.price = 0;
        normalizedItem.isFoc = true;
      }

      if (options.mode === "swap" && typeof options.replaceIndex === "number") {
        updateOrderState((prev) => {
          if (
            options.replaceIndex === undefined ||
            options.replaceIndex < 0 ||
            options.replaceIndex >= prev.items.length
          ) {
            return { items: [...prev.items, normalizedItem] };
          }

          const nextItems = [...prev.items];
          // Preserve parent/grouping if swapping a child
          const oldItem = nextItems[options.replaceIndex];
          normalizedItem.parentId = options.parentId || oldItem.parentId;

          nextItems[options.replaceIndex] = normalizedItem;
          return { items: nextItems };
        });
        setIsSwapMode(false);
        return;
      }

      updateOrderState((prev) => {
        const nextItems = [...prev.items];

        if (
          options.mode === "setMeal" &&
          Array.isArray(options.setMealComponents) &&
          options.setMealComponents.length > 0
        ) {
          // Special expansion logic for set meals (if handled here)
          nextItems.push(
            normalizedItem,
            ...options.setMealComponents.map((component) => ({
              ...component,
              uniqueId: generateUniqueId(),
              parentId: normalizedItem.uniqueId,
              isIncluded: true,
              price: 0,
            })),
          );
        } else {
          nextItems.push(normalizedItem);
        }

        return { items: nextItems };
      });
    },
    [updateOrderState, isZeroPriceMode],
  );

  const removeItem = useCallback(
    (index: number) => {
      updateOrderState((prev) => {
        if (index < 0 || index >= prev.items.length) {
          return {};
        }

        const itemToRemove = prev.items[index];
        const idToRemove = itemToRemove.uniqueId;

        // Filter out the item itself and all its children
        const nextItems = prev.items.filter((item, idx) => {
          if (idx === index) return false;
          if (item.parentId === idToRemove) return false;
          return true;
        });

        return { items: nextItems };
      });
    },
    [updateOrderState],
  );

  const updateItem = useCallback(
    (index: number, updater: (item: OrderItem) => OrderItem) => {
      updateOrderState((prev) => {
        if (index < 0 || index >= prev.items.length) {
          return {};
        }

        const nextItems = prev.items.map((item, idx) =>
          idx === index ? updater(item) : item,
        );
        return { items: nextItems };
      });
    },
    [updateOrderState],
  );

  const duplicateItem = useCallback(
    (index: number) => {
      updateOrderState((prev) => {
        if (index < 0 || index >= prev.items.length) return {};
        const nextItems = [...prev.items];
        nextItems[index] = {
          ...nextItems[index],
          quantity: nextItems[index].quantity + 1,
        };
        return { items: nextItems };
      });
    },
    [updateOrderState],
  );

  const setFocItem = useCallback(
    (index: number) => {
      updateOrderState((prev) => {
        if (index < 0 || index >= prev.items.length) return {};
        const nextItems = [...prev.items];
        nextItems[index] = {
          ...nextItems[index],
          price: 0,
          name: `${nextItems[index].name} (FOC)`,
        };
        return { items: nextItems };
      });
    },
    [updateOrderState],
  );

  const setOrderType = useCallback(
    (orderType: OrderType) => updateOrderState(() => ({ orderType })),
    [updateOrderState],
  );

  const setCustomerInfo = useCallback(
    (info: CustomerInfo | undefined) =>
      updateOrderState(() => ({ customerInfo: info })),
    [updateOrderState],
  );

  const updatePayment = useCallback(
    (payment: PaymentDetails) => updateOrderState(() => ({ payment })),
    [updateOrderState],
  );

  const setNotes = useCallback(
    (notes?: string) => updateOrderState(() => ({ notes })),
    [updateOrderState],
  );

  const printQueueRef = useRef(printQueue);

  useEffect(() => {
    printQueueRef.current = printQueue;
  }, [printQueue]);

  const flushPrintQueue = useCallback(async () => {
    const queued = printQueueRef.current;
    if (queueFlushInFlight.current || queued.length === 0) return;

    queueFlushInFlight.current = true;
    setIsFlushingPrintQueue(true);

    try {
      for (const job of queued) {
        try {
          const result = await apiClient.submitOrder(job.order);
          setPrintQueue((prev) =>
            prev.filter((entry) => entry.clientOrderId !== job.clientOrderId),
          );
          if (!result.printed) {
            setLastPrintAlert(
              "An order was delivered to the backend queue but printer confirmation failed.",
            );
          }
        } catch (error) {
          const message = getErrorMessage(error);
          setPrintQueue((prev) =>
            prev.map((entry) =>
              entry.clientOrderId === job.clientOrderId
                ? {
                    ...entry,
                    attempts: entry.attempts + 1,
                    lastAttemptAt: Date.now(),
                    lastError: message,
                  }
                : entry,
            ),
          );
          setLastPrintAlert(`Unable to flush queued orders: ${message}`);
          break;
        }
      }
    } finally {
      queueFlushInFlight.current = false;
      setIsFlushingPrintQueue(false);
    }
  }, []);

  useEffect(() => {
    if (printQueue.length === 0) return;

    const retryMs = isConnected ? 5_000 : 15_000;
    if (isConnected) {
      void flushPrintQueue();
    }

    const timer = window.setInterval(() => {
      void flushPrintQueue();
    }, retryMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [flushPrintQueue, isConnected, printQueue.length]);

  const retryQueuedPrints = useCallback(async () => {
    await flushPrintQueue();
  }, [flushPrintQueue]);

  const clearPrintAlert = useCallback(() => {
    setLastPrintAlert(null);
  }, []);

  const printOrder = useCallback(
    async (orderToPrint?: FullOrder): Promise<PrintResult> => {
      const source = orderToPrint ? orderToPrint : order;
      const totals = deriveTotals(source as OrderState);
      const payload: FullOrder = {
        ...source,
        items: source.items.map((item) => ({ ...item })),
        customerInfo: source.customerInfo ? { ...source.customerInfo } : undefined,
        payment: { ...source.payment },
        subtotal: totals.subtotal,
        deliveryCharge: totals.deliveryCharge,
        total: totals.total,
      };
      const clientOrderId = orderToPrint
        ? generateClientOrderId()
        : order.clientOrderId;

      try {
        const result = await apiClient.submitOrder(payload);
        if (!orderToPrint) {
          clearOrder();
        }
        if (!result.printed) {
          setLastPrintAlert(
            `Order #${result.orderId} was saved, but printer confirmation failed.`,
          );
          return { status: "saved_not_printed", orderId: result.orderId };
        }
        return { status: "printed", orderId: result.orderId };
      } catch (error) {
        const message = getErrorMessage(error);
        if (shouldQueuePrintError(error)) {
          const queuedAt = Date.now();
          let inserted = false;
          setPrintQueue((prev) => {
            if (prev.some((entry) => entry.clientOrderId === clientOrderId)) {
              return prev;
            }
            inserted = true;
            return [
              ...prev,
              {
                clientOrderId,
                order: payload,
                queuedAt,
                attempts: 0,
                lastError: message,
              },
            ];
          });
          if (!orderToPrint) {
            clearOrder();
          }
          setLastPrintAlert(
            inserted
              ? `Backend unreachable. Order queued for retry (${printQueueRef.current.length + 1} pending).`
              : "Order already queued for retry. Duplicate queue entry ignored.",
          );
          return { status: "queued", queuedAt };
        }

        setLastPrintAlert(`Print failed and was not queued: ${message}`);
        console.error("Failed to print order", error);
        throw error;
      }
    },
    [order, clearOrder],
  );

  return (
    <OrderContext.Provider
      value={{
        orders,
        activeOrderIndex: safeIndex,
        order,
        subtotal: derivedTotals.subtotal,
        deliveryCharge: derivedTotals.deliveryCharge,
        total: derivedTotals.total,

        isZeroPriceMode,
        isSwapMode,
        isIncMode,
        isShortMode,
        setIsZeroPriceMode,
        setIsSwapMode,
        setIsIncMode,
        setIsShortMode,

        setActiveOrderIndex,
        createNewOrder,
        clearOrder,

        addItem,
        removeItem,
        updateItem,
        duplicateItem,
        setFocItem,

        setOrderType,
        setCustomerInfo,
        updatePayment,
        setNotes,
        printOrder,
        pendingPrintJobs: printQueue.length,
        isFlushingPrintQueue,
        lastPrintAlert,
        clearPrintAlert,
        retryQueuedPrints,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
}

export function useOrder() {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error("useOrder must be used within an OrderProvider");
  }
  return context;
}
