import { useState, useEffect, useCallback, lazy, Suspense, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { MenuItem, OrderItem, MenuContent } from "../../types";
import { useOrder } from "../../context/OrderContext";
import { LeftPanel } from "./left-panel";
import { RightPanel } from "./right-panel";
import { PrintQueueBanner } from "./print-queue-banner";
import { LoaderSplash } from "../ui/loader-splash";
import { useCallHandler } from "../../hooks/useCallHandler";
import { useUI } from "../../context/UIContext";
import { apiClient } from "../../api/client";

const ItemOptionsModal = lazy(() =>
  import("../modals/item-options-modal").then((m) => ({
    default: m.ItemOptionsModal,
  })),
);
const ItemModificationModal = lazy(() =>
  import("../modals/item-modification-modal").then((m) => ({
    default: m.ItemModificationModal,
  })),
);
const DeliveryAddressModal = lazy(() =>
  import("../modals/delivery-address-modal").then((m) => ({
    default: m.DeliveryAddressModal,
  })),
);
const ConfirmationModal = lazy(() =>
  import("../modals/confirmation-modal").then((m) => ({
    default: m.ConfirmationModal,
  })),
);
const RefModal = lazy(() => import("../modals/ref-modal").then((m) => ({ default: m.RefModal })));
const SetMealChoiceModal = lazy(() =>
  import("../modals/set-meal-choice-modal").then((m) => ({
    default: m.SetMealChoiceModal,
  })),
);
const AdminPage = lazy(() => import("./admin-page").then((m) => ({ default: m.AdminPage })));
const AddressSelectionModal = lazy(() =>
  import("../modals/address-selection-modal").then((m) => ({
    default: m.AddressSelectionModal,
  })),
);
const ReceiptPreviewModal = lazy(() =>
  import("../modals/receipt-preview-modal").then((m) => ({
    default: m.ReceiptPreviewModal,
  })),
);

const loaderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="100%" height="100%">
    <defs>
        <style>
            .steam-line {
                fill: none;
                stroke-width: 6;
                stroke-linecap: round;
                stroke-dasharray: 40 120;
                animation: dashFlow 2s linear infinite;
            }
            .steam-line.s1 { stroke: #7DD3FC; animation-delay: 0s; }
            .steam-line.s2 { stroke: #38BDF8; animation-delay: 0.6s; }
            .steam-line.s3 { stroke: #0EA5E9; animation-delay: 1.2s; }
            @keyframes dashFlow { 0% { stroke-dashoffset: 40; } 100% { stroke-dashoffset: -120; } }
            .wok-wrapper { transform-origin: 160px 127px; animation: wokBob 2.5s ease-in-out infinite; }
            @keyframes wokBob { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-3px) rotate(1deg); } }
            .flame { animation: flicker 0.5s ease-in-out infinite alternate; }
            .flame.f1 { transform-origin: 160px 178px; animation-delay: 0s; }
            .flame.f2 { transform-origin: 135px 178px; animation-delay: 0.15s; }
            .flame.f3 { transform-origin: 185px 178px; animation-delay: 0.3s; }
            @keyframes flicker { 0% { transform: scaleY(0.9) scaleX(1.05); } 100% { transform: scaleY(1.1) scaleX(0.95); } }
        </style>
    </defs>
    <g id="flames">
        <path class="flame f2" d="M 135,155 C 145,165 145,178 135,178 C 125,178 125,165 135,155 Z" fill="#F43F5E" />
        <path class="flame f3" d="M 185,155 C 195,165 195,178 185,178 C 175,178 175,165 185,155 Z" fill="#F43F5E" />
        <path class="flame f1" d="M 160,145 C 175,160 175,178 160,178 C 145,178 145,160 160,145 Z" fill="#FBBF24" />
    </g>
    <g id="steam">
        <path class="steam-line s1" d="M 120,85 C 90,55 150,35 120,5">
            <animate attributeName="d" values="M 120,85 C 90,55 150,35 120,5; M 120,85 C 150,55 90,35 120,5; M 120,85 C 90,55 150,35 120,5" dur="3s" repeatCount="indefinite" />
        </path>
        <path class="steam-line s2" d="M 160,85 C 195,60 125,30 160,5">
            <animate attributeName="d" values="M 160,85 C 195,60 125,30 160,5; M 160,85 C 125,60 195,30 160,5; M 160,85 C 195,60 125,30 160,5" dur="3.5s" repeatCount="indefinite" />
        </path>
        <path class="steam-line s3" d="M 200,85 C 170,55 230,35 200,5">
            <animate attributeName="d" values="M 200,85 C 170,55 230,35 200,5; M 200,85 C 230,55 170,35 200,5; M 200,85 C 170,55 230,35 200,5" dur="2.5s" repeatCount="indefinite" />
        </path>
    </g>
    <g class="wok-wrapper">
        <path d="M 80,95 A 80 65 0 0 0 240,95" fill="#1E293B" stroke="#E2E8F0" stroke-width="6" stroke-linejoin="round" />
        <ellipse cx="160" cy="95" rx="80" ry="15" fill="#0F172A" stroke="#E2E8F0" stroke-width="6" />
        <line x1="238" y1="95" x2="285" y2="75" stroke="#E2E8F0" stroke-width="8" stroke-linecap="round" />
        <line x1="255" y1="88" x2="285" y2="75" stroke="#FCA5A5" stroke-width="12" stroke-linecap="round" />
        <circle cx="140" cy="125" r="4" fill="#E2E8F0" />
        <circle cx="180" cy="125" r="4" fill="#E2E8F0" />
        <circle cx="125" cy="130" r="5" fill="#F472B6" />
        <circle cx="195" cy="130" r="5" fill="#F472B6" />
        <path d="M 152,135 Q 160,145 168,135" fill="none" stroke="#E2E8F0" stroke-width="4" stroke-linecap="round" />
    </g>
</svg>`;
export function PosDashboard() {
  const {
    orders,
    activeOrderIndex,
    order,
    subtotal,
    deliveryCharge,
    total,
    addItem,
    isIncMode,
    setIsIncMode,
    duplicateItem,
    setFocItem,
    updateItem,
    setCustomerInfo,
    updatePayment,
    printOrder,
    setOrderType,
    clearOrder,
    createNewOrder,
    setActiveOrderIndex,
    isZeroPriceMode,
    isSwapMode,
    setIsZeroPriceMode,
    setIsSwapMode,
    decrementItem,
  } = useOrder();
  const { activeModal, openModal, closeModal } = useUI();
  const {
    pendingCall,
    addressOptions,
    selectAddress,
    startNewCustomerFromPending,
    resolvePendingCall,
    attachPendingCallSelection,
    clearCall,
  } = useCallHandler();

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isMenuLoading, setIsMenuLoading] = useState(true);
  const [selectedOrderIndex, setSelectedOrderIndex] = useState<number | null>(null);
  const selectedItem = selectedOrderIndex !== null ? order.items[selectedOrderIndex] : undefined;
  const prevItemsLengthRef = useRef(order.items.length);

  // Auto-select latest item when added
  useEffect(() => {
    if (order.items.length > prevItemsLengthRef.current) {
      setSelectedOrderIndex(order.items.length - 1);
    }
    prevItemsLengthRef.current = order.items.length;
  }, [order.items.length]);

  // Lazy-load menu data to keep the entry bundle small and show loader long enough to avoid flicker.
  const MIN_LOADER_MS = 1500;

  useEffect(() => {
    let isMounted = true;
    const started = performance.now();
    setIsMenuLoading(true);
    import("../../assets/menu.json")
      .then((module) => {
        if (isMounted) {
          setMenuItems(module.default as MenuItem[]);
        }
      })
      .catch((err) => {
        console.error("Failed to load menu data", err);
      })
      .finally(() => {
        const elapsed = performance.now() - started;
        const remaining = Math.max(0, MIN_LOADER_MS - elapsed);
        const timer = window.setTimeout(() => {
          if (isMounted) setIsMenuLoading(false);
        }, remaining);
        if (!isMounted) window.clearTimeout(timer);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (selectedOrderIndex === null) return;
    const len = order.items.length;
    if (len === 0) {
      setSelectedOrderIndex(null);
    } else if (selectedOrderIndex >= len) {
      setSelectedOrderIndex(len - 1);
    }
  }, [order.items.length, selectedOrderIndex]);

  // Modal States
  const [configuringItem, setConfiguringItem] = useState<MenuItem | null>(null);
  const [modifyingItem, setModifyingItem] = useState<{
    item: OrderItem;
    index: number;
  } | null>(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isRefModalOpen, setIsRefModalOpen] = useState(false);
  const [pendingSetMeal, setPendingSetMeal] = useState<{
    parentUniqueId: string;
    choices: MenuContent[];
    currentChoiceIndex: number;
  } | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const generateId = () => Math.random().toString(36).substring(2, 11);

  const handleAddItem = useCallback(
    (item: MenuItem) => {
      let parentId = isIncMode ? selectedItem?.uniqueId : undefined;

      // Nesting Prevention: Prevent Set Meal in Happy Meal and vice versa
      const isAddingSet = !!item.contents?.length;
      const isAddingHappy = item.id.startsWith("HM");

      if (parentId) {
        const parentItem = order.items.find((i) => i.uniqueId === parentId);
        const isParentSet = parentItem?.id.startsWith("SET");
        const isParentHappy = parentItem?.id.startsWith("HM");

        if ((isAddingSet && isParentHappy) || (isAddingHappy && isParentSet)) {
          parentId = undefined; // Add as top-level instead
        }
      }

      const uniqueId = generateId();

      if (item.options?.length) {
        setConfiguringItem(item);
      } else if (item.contents?.length) {
        // Set Meal Expansion
        addItem(
          {
            id: item.id,
            name: item.name, // pass full {en, zh} object so zhName is preserved
            price: item.price ?? 0,
            uniqueId,
          },
          { parentId },
        );

        // Add fixed items: check for .item property (legacy format)
        item.contents
          .filter((c) => !!c.item)
          .forEach((c) => {
            addItem(
              {
                id: "INC",
                name: c.item!,
                price: 0,
              },
              {
                parentId: uniqueId,
                isIncluded: true,
              },
            );
          });

        // Handle choices
        const choices = item.contents.filter((c) => c.type === "choice");
        if (choices.length > 0) {
          setPendingSetMeal({
            parentUniqueId: uniqueId,
            choices,
            currentChoiceIndex: 0,
          });
        }
      } else {
        addItem(
          {
            id: item.id,
            name: item.name, // pass full {en, zh} object so zhName is preserved
            price: item.price ?? 0,
            uniqueId,
          },
          {
            parentId,
            isFoc: !!parentId,
          },
        );
      }
    },
    [isIncMode, selectedItem, order.items, addItem],
  );

  const handleSetMealChoiceConfirm = (selections: string[]) => {
    if (!pendingSetMeal) return;

    selections.forEach((name) => {
      addItem(
        {
          id: "CHOSEN",
          name,
          price: 0,
        },
        {
          parentId: pendingSetMeal.parentUniqueId,
          isIncluded: true,
        },
      );
    });

    if (pendingSetMeal.currentChoiceIndex < pendingSetMeal.choices.length - 1) {
      setPendingSetMeal({
        ...pendingSetMeal,
        currentChoiceIndex: pendingSetMeal.currentChoiceIndex + 1,
      });
    } else {
      setPendingSetMeal(null);
    }
  };

  const handleFinishConfiguration = useCallback(
    (finalized: { name: string | { en: string; zh: string }; price: number }) => {
      const parentId = isIncMode ? selectedItem?.uniqueId : undefined;
      addItem(
        {
          id: configuringItem?.id || "CUSTOM",
          ...finalized,
        },
        {
          parentId,
          isFoc: !!parentId,
        },
      );
      setConfiguringItem(null);
    },
    [addItem, configuringItem?.id, isIncMode, selectedItem],
  );

  const handleModifyItem = useCallback(() => {
    if (selectedOrderIndex !== null && selectedItem) {
      setModifyingItem({
        item: selectedItem,
        index: selectedOrderIndex,
      });
    }
  }, [selectedOrderIndex, selectedItem]);

  const handleUpdateItem = useCallback(
    (updated: OrderItem) => {
      if (modifyingItem) {
        updateItem(modifyingItem.index, () => updated);
        setModifyingItem(null);
      }
    },
    [modifyingItem, updateItem],
  );

  const handleDecrementSelected = useCallback(() => {
    if (selectedOrderIndex !== null) decrementItem(selectedOrderIndex);
  }, [selectedOrderIndex, decrementItem]);

  const handleDuplicateItem = useCallback(() => {
    if (selectedOrderIndex !== null && selectedItem) duplicateItem(selectedOrderIndex);
  }, [selectedOrderIndex, selectedItem, duplicateItem]);

  const handleFocItem = useCallback(() => {
    if (selectedOrderIndex !== null && selectedItem) setFocItem(selectedOrderIndex);
  }, [selectedOrderIndex, selectedItem, setFocItem]);

  const isHappyMealSelected = selectedItem?.id?.startsWith("HM") ?? false;

  const isSetMealItemSelected = selectedItem?.id?.startsWith("SET") ?? false;

  const handleToggleZeroPriceMode = useCallback(
    () => setIsZeroPriceMode((p) => !p),
    [setIsZeroPriceMode],
  );
  const handleToggleSwapMode = useCallback(() => {
    if (isHappyMealSelected) {
      setIsIncMode((p) => !p);
    } else {
      setIsSwapMode((p) => !p);
    }
  }, [isHappyMealSelected, setIsIncMode, setIsSwapMode]);

  const handleDialCustomerPhone = useCallback(async (phone: string) => {
    try {
      await apiClient.dial(phone);
    } catch (error) {
      console.error("Failed to initiate dial command", error);
    }
  }, []);

  return (
    <div className="h-screen">
      <div className="mx-auto flex h-full max-w-[1600px] flex-col gap-2 px-2 py-2">
        <PrintQueueBanner />
        <div className="grid h-full min-h-0 gap-2 xl:grid-cols-[minmax(320px,0.38fr)_minmax(420px,0.62fr)]">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full min-h-0"
          >
            <LeftPanel
              orders={orders}
              activeOrderIndex={activeOrderIndex}
              onSelectOrder={setActiveOrderIndex}
              onNewOrder={createNewOrder}
              items={order.items}
              selectedIndex={selectedOrderIndex}
              onSelectIndex={setSelectedOrderIndex}
              onDecrementSelected={handleDecrementSelected}
              onClearOrder={clearOrder}
              subtotal={subtotal}
              deliveryFee={deliveryCharge}
              total={total}
              onAccept={() => {
                setCheckoutError(null);
                setIsCheckoutModalOpen(true);
              }}
              orderType={order.orderType}
              onChangeOrderType={setOrderType}
              customerInfo={order.customerInfo}
              onCustomerInfoClick={() => openModal("customer")}
              onDialPhone={handleDialCustomerPhone}
              onDuplicateItem={handleDuplicateItem}
              onModifyItem={handleModifyItem}
              onFocItem={handleFocItem}
              isZeroPriceMode={isZeroPriceMode}
              onToggleZeroPriceMode={handleToggleZeroPriceMode}
              onDeleteOrder={clearOrder}
              isSwapMode={isSwapMode}
              isIncMode={isIncMode}
              isHappyMealSelected={isHappyMealSelected}
              isSetMealItemSelected={isSetMealItemSelected}
              onToggleSwapMode={handleToggleSwapMode}
              onPreview={() => setIsPreviewOpen(true)}
              onOpenAdmin={() => setIsAdminOpen(true)}
            />
          </motion.div>

          <AnimatePresence mode="wait">
            {isMenuLoading ? (
              <motion.div
                key="loader"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex h-full min-h-0 items-center justify-center"
              >
                <LoaderSplash
                  title="Loading menu"
                  subtitle="Fetching categories and prices..."
                  svgMarkup={loaderSvg}
                />
              </motion.div>
            ) : (
              <motion.div
                key="menu"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="h-full min-h-0"
              >
                <RightPanel
                  menuItems={menuItems}
                  onAddItem={handleAddItem}
                  onOpenMenuRef={() => setIsRefModalOpen(true)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        <Suspense fallback={null}>
          {configuringItem && (
            <ItemOptionsModal
              key="options-modal"
              item={configuringItem}
              onConfirm={handleFinishConfiguration}
              onClose={() => setConfiguringItem(null)}
            />
          )}

          {modifyingItem && (
            <ItemModificationModal
              key="modifying-modal"
              item={modifyingItem.item}
              originalName={modifyingItem.item.name}
              onSave={handleUpdateItem}
              onClose={() => setModifyingItem(null)}
            />
          )}

          {(isAddressModalOpen || activeModal === "customer") && (
            <DeliveryAddressModal
              key="address-modal"
              customerInfo={order.customerInfo || {}}
              pendingCall={pendingCall}
              onUsePendingCall={resolvePendingCall}
              onDismissPendingCall={resolvePendingCall}
              onSave={(info) => {
                attachPendingCallSelection(info, info.deliveryInstructions);
                setCustomerInfo(info);
                setIsAddressModalOpen(false);
                closeModal();
                resolvePendingCall();
              }}
              onClose={() => {
                setIsAddressModalOpen(false);
                clearCall();
              }}
            />
          )}

          {activeModal === "address-selection" && (
            <AddressSelectionModal
              key="address-selection-modal"
              addresses={addressOptions}
              onSelect={selectAddress}
              onCreateNew={startNewCustomerFromPending}
              onClose={clearCall}
            />
          )}

          {isCheckoutModalOpen && (
            <ConfirmationModal
              key="checkout-modal"
              orderTotal={total}
              errorMessage={checkoutError}
              onConfirm={async (details) => {
                setCheckoutError(null);
                updatePayment({
                  method: "cash",
                  amount: details.amountPaid,
                });
                try {
                  await printOrder();
                  setCheckoutError(null);
                  setIsCheckoutModalOpen(false);
                } catch (error) {
                  console.error("Checkout failed", error);
                  setCheckoutError(
                    error instanceof Error
                      ? error.message
                      : "Unable to submit order. Please try again.",
                  );
                }
              }}
              onClose={() => {
                setCheckoutError(null);
                setIsCheckoutModalOpen(false);
              }}
            />
          )}

          {isRefModalOpen && (
            <RefModal
              key="ref-modal"
              menuItems={menuItems}
              onSelect={handleAddItem}
              onClose={() => setIsRefModalOpen(false)}
            />
          )}

          {pendingSetMeal && (
            <SetMealChoiceModal
              key={`choice-${pendingSetMeal.currentChoiceIndex}`}
              choice={pendingSetMeal.choices[pendingSetMeal.currentChoiceIndex]}
              onConfirm={handleSetMealChoiceConfirm}
              onClose={() => setPendingSetMeal(null)}
            />
          )}

          {isAdminOpen && <AdminPage onClose={() => setIsAdminOpen(false)} />}

          {isPreviewOpen && (
            <ReceiptPreviewModal
              key="receipt-preview-modal"
              items={order.items}
              orderType={order.orderType}
              customerInfo={order.customerInfo}
              subtotal={subtotal}
              deliveryFee={deliveryCharge}
              total={total}
              onClose={() => setIsPreviewOpen(false)}
            />
          )}
        </Suspense>
      </AnimatePresence>
    </div>
  );
}
