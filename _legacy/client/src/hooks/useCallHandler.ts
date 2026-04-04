import React, { useState, useEffect, useRef } from "react";
import { useCallerId } from "../context/CallerIDContext";
import { useOrder } from "../context/OrderContext";
import { useUI } from "../context/UIContext";
import { API_BASE_URL, calculateDeliveryCharge } from "../constants";
import { CustomerInfo, OrderType } from "../types";

export function useCallHandler() {
  const { lastCall } = useCallerId();
  const { activeOrder, activeOrderIndex, orders, updateOrder, createNewOrder } = useOrder();

  const { openAddressSelectionModal } = useUI();

  const [showNotification, setShowNotification] = useState(false);
  const [currentCaller, setCurrentCaller] = useState<any | null>(null);

  // Ref to track the last processed call timestamp to prevent duplicate handling
  const lastProcessedCallTime = React.useRef<string | null>(null);
  const lastProcessedCallPhone = React.useRef<string | null>(null);

  // Ref to track if we are currently populating the active order to prevent race conditions
  const isPopulatingActiveOrder = React.useRef(false);

  useEffect(() => {
    const handleIncomingCall = async (callData: any) => {
      // Always show notification for a new call
      setShowNotification(true);
      setCurrentCaller(callData);

      const timer = setTimeout(() => setShowNotification(false), 8000);

      console.log(
        `[CALL START] Processing call from ${callData.phone}. Timestamp: ${callData.timestamp}`,
      );

      // Logic to decide if we should auto-populate the order
      const shouldAutoPopulate =
        !isPopulatingActiveOrder.current &&
        activeOrder &&
        activeOrder.items.length === 0 &&
        !activeOrder.customerInfo.phone;

      console.log(`[CALL DECISION] Should Auto Populate? ${shouldAutoPopulate}`);

      if (shouldAutoPopulate) {
        isPopulatingActiveOrder.current = true;
      }

      try {
        console.log(`[EFFECT] New call from ${callData.phone}, fetching customer data...`);

        const response = await fetch(`${API_BASE_URL}/api/customer/${callData.phone}`);

        let customerDataToApply: CustomerInfo = {};

        // Flag to trigger address modal if needed
        let shouldOpenAddressModal = false;
        let customerForModal = null;

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
                shouldOpenAddressModal = true;
                customerForModal = customer;
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

        // Apply to state
        if (shouldAutoPopulate) {
          console.log("[UPDATE STATE] Populating ACTIVE order index:", activeOrderIndex);
          const deliveryCharge = calculateDeliveryCharge(customerDataToApply.distance);

          // Open modal if flag set
          if (shouldOpenAddressModal && customerForModal) {
            console.log("[EFFECT] Opening address selection modal for active order.");
            openAddressSelectionModal(customerForModal);
            isPopulatingActiveOrder.current = false; // Release lock early if modal manages flow?
            // Actually App.tsx released lock here:
            // isPopulatingActiveOrder.current = false;
            // return () => clearTimeout(timer);
          }

          updateOrder(activeOrderIndex, {
            customerInfo: customerDataToApply,
            deliveryCharge: deliveryCharge,
          });
        } else {
          console.log("[UPDATE STATE] Creating BACKGROUND order.");
          const deliveryCharge = calculateDeliveryCharge(customerDataToApply.distance);

          // Create background order with data
          createNewOrder(true, {
            customerInfo: customerDataToApply,
            deliveryCharge: deliveryCharge,
            hasUnreadChanges: true, // Explicitly set unread
          });
        }
      } catch (error) {
        console.error("[EFFECT] Error fetching customer data:", error);
      } finally {
        if (shouldAutoPopulate) {
          isPopulatingActiveOrder.current = false;
        }
      }

      return () => clearTimeout(timer);
    };

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
  }, [
    lastCall,
    activeOrderIndex,
    orders,
    activeOrder,
    updateOrder,
    createNewOrder,
    openAddressSelectionModal,
  ]);

  return {
    showNotification,
    currentCaller,
  };
}
