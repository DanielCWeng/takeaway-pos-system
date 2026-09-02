/**
 * client/src/hooks/useCallHandler.ts
 *
 * Listens for incoming call events and prepares the UI + order context.
 * Saved addresses are always presented for explicit operator selection.
 * Calls without history open editable customer/address entry.
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

  const formatAddress = useCallback(
    (address?: Partial<Address> | CustomerInfo) =>
      [address?.line1, address?.line2, address?.town, address?.postcode].filter(Boolean).join(", "),
    [],
  );

  const buildCustomerInfo = useCallback((payload: CallDetectedPayload, address?: Address) => {
    return {
      phone: payload.phone,
      name: payload.customer?.name ?? undefined,
      line1: address?.line1,
      line2: address?.line2,
      town: address?.town,
      postcode: address?.postcode,
      distance: address?.distance ?? undefined,
      latitude: address?.latitude ?? undefined,
      longitude: address?.longitude ?? undefined,
    } satisfies CustomerInfo;
  }, []);

  const resolveCustomerInfo = useCallback(
    (payload: CallDetectedPayload, address?: Address) => {
      const info = buildCustomerInfo(payload, address);
      if (payload.callId) {
        void apiClient.updateCallSession(payload.callId, {
          selectedCustomerPhone: info.phone,
          selectedCustomerName: info.name,
          selectedAddress: formatAddress(info),
        });
      }
      setCustomerInfo(info);
      const wantsDelivery = Boolean(address);
      setOrderType(wantsDelivery ? "delivery" : "collection");
      closeModal();
      setPendingCall(null);
      setAddressOptions([]);
    },
    [buildCustomerInfo, closeModal, formatAddress, setCustomerInfo, setOrderType],
  );

  const handleIncomingCall = useCallback(
    (payload: CallDetectedPayload) => {
      setLastCall(payload);
      setPendingCall(null);
      setAddressOptions([]);

      const addresses = payload.addresses ?? [];
      if (hasActiveOrder) {
        setPendingCall(payload);
        setAddressOptions(addresses);
        openModal("customer");
        return;
      }

      if (addresses.length > 0) {
        setPendingCall(payload);
        setAddressOptions(addresses);
        openModal("address-selection");
        return;
      }

      setPendingCall(payload);
      openModal("customer");
    },
    [hasActiveOrder, openModal],
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
    const info = buildCustomerInfo(pendingCall);
    setCustomerInfo(info);
    setOrderType("delivery");
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
        selectedAddress: formatAddress(info),
        notes,
      });
    },
    [formatAddress, pendingCall],
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
