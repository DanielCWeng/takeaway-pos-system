/**
 * client/src/hooks/useCallHandler.ts
 *
 * Listens for incoming call events and prepares the UI + order context.
 * The logic mirrors the legacy flow:
 *  - Auto-apply caller details when no active order exists.
 *  - Prompt (via UIContext) if there is a background order in progress.
 *  - Auto-select the single known address or open the address-selection modal when multiple options are provided.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCaller } from "../context/CallerContext";
import { useOrder } from "../context/OrderContext";
import { useUI } from "../context/UIContext";
import type { Address, CallDetectedPayload, WebSocketMessage, CustomerInfo } from "../types";
import { apiClient } from "../api/client";

export function useCallHandler() {
  const { subscribe, isConnected } = useCaller();
  const { order, setCustomerInfo, setOrderType } = useOrder();
  const { openModal, closeModal } = useUI();

  const [lastCall, setLastCall] = useState<CallDetectedPayload | null>(null);
  const [pendingCall, setPendingCall] = useState<CallDetectedPayload | null>(null);
  const [addressOptions, setAddressOptions] = useState<Address[]>([]);

  const hasActiveOrder = useMemo(() => order.items.length > 0, [order.items]);

  const buildCustomerInfo = useCallback((payload: CallDetectedPayload, address?: Address) => {
    const customerHouseNumber = payload.customer?.houseNumber ?? undefined;
    const customerStreet = payload.customer?.street ?? undefined;
    const resolvedStreet = address?.line1 ?? customerStreet;
    const resolvedTown = address?.town ?? payload.customer?.town ?? undefined;
    const fallbackAddress = [customerHouseNumber, resolvedStreet].filter(Boolean).join(" ");
    const resolvedAddress =
      address && address.line1
        ? [customerHouseNumber, address.line1, address.line2, address.town]
            .filter(Boolean)
            .join(", ")
        : fallbackAddress || undefined;

    return {
      phone: payload.phone,
      name: payload.customer?.name ?? undefined,
      address: resolvedAddress,
      houseNumber: customerHouseNumber,
      street: resolvedStreet,
      town: resolvedTown,
      postcode: address?.postcode ?? payload.customer?.postcode ?? undefined,
      distance: payload.distance ?? payload.customer?.distance ?? undefined,
      latitude: address?.latitude ?? payload.customer?.latitude ?? undefined,
      longitude: address?.longitude ?? payload.customer?.longitude ?? undefined,
    } satisfies CustomerInfo;
  }, []);

  const resolveCustomerInfo = useCallback(
    (payload: CallDetectedPayload, address?: Address) => {
      const info = buildCustomerInfo(payload, address);
      if (payload.callId) {
        void apiClient.updateCallSession(payload.callId, {
          selectedCustomerPhone: info.phone,
          selectedCustomerName: info.name,
          selectedAddress: info.address,
        });
      }
      setCustomerInfo(info);
      const wantsDelivery = Boolean(address) || Boolean(info.postcode) || Boolean(info.address);
      setOrderType(wantsDelivery ? "delivery" : "collection");
      closeModal();
      setPendingCall(null);
      setAddressOptions([]);
    },
    [buildCustomerInfo, closeModal, setCustomerInfo, setOrderType],
  );

  const handleIncomingCall = useCallback(
    (payload: CallDetectedPayload) => {
      setLastCall(payload);
      setPendingCall(null);
      setAddressOptions([]);

      const addresses = payload.addresses ?? [];
      const hasMultipleAddresses = addresses.length > 1;

      if (hasActiveOrder) {
        setPendingCall(payload);
        setAddressOptions(addresses);
        openModal("customer");
        return;
      }

      if (hasMultipleAddresses) {
        setPendingCall(payload);
        setAddressOptions(addresses);
        openModal("address-selection");
        return;
      }

      resolveCustomerInfo(payload, addresses[0]);
    },
    [hasActiveOrder, openModal, resolveCustomerInfo],
  );

  useEffect(() => {
    const unsubscribe = subscribe((msg: WebSocketMessage) => {
      if (msg.type === "incoming_call" || msg.type === "incoming_call_multi_address") {
        handleIncomingCall(msg.payload);
      }
    });

    return unsubscribe;
  }, [subscribe, handleIncomingCall]);

  const selectAddress = useCallback(
    (address: Address) => {
      if (!pendingCall) return;
      resolveCustomerInfo(pendingCall, address);
    },
    [pendingCall, resolveCustomerInfo],
  );

  const clearCall = useCallback(() => {
    setLastCall(null);
    setPendingCall(null);
    setAddressOptions([]);
    closeModal();
  }, [closeModal]);

  const startNewCustomerFromPending = useCallback(() => {
    if (!pendingCall) return;
    const singleAddress =
      pendingCall.addresses?.length === 1 ? pendingCall.addresses[0] : undefined;
    const info = buildCustomerInfo(pendingCall, singleAddress);
    setCustomerInfo(info);
    const wantsDelivery = Boolean(singleAddress) || Boolean(info.postcode) || Boolean(info.address);
    setOrderType(wantsDelivery ? "delivery" : "collection");
    setAddressOptions([]);
    openModal("customer");
  }, [buildCustomerInfo, openModal, pendingCall, setCustomerInfo, setOrderType]);

  const resolvePendingCall = useCallback(() => {
    setPendingCall(null);
    setAddressOptions([]);
  }, []);

  const attachPendingCallSelection = useCallback(
    (info: CustomerInfo, notes?: string) => {
      if (!pendingCall?.callId) return;
      void apiClient.updateCallSession(pendingCall.callId, {
        selectedCustomerPhone: info.phone,
        selectedCustomerName: info.name,
        selectedAddress: info.address,
        notes,
      });
    },
    [pendingCall],
  );

  return {
    lastCall,
    pendingCall,
    addressOptions,
    selectAddress,
    startNewCustomerFromPending,
    resolvePendingCall,
    attachPendingCallSelection,
    clearCall,
    isConnected,
  };
}
