import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CustomerInfo, Address, CallDetectedPayload } from "../../types";
import { Button } from "../ui/button";
import {
  X,
  Search,
  Phone,
  MapPin,
  Clock,
  MessageSquare,
  Save,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Input } from "../ui/input";
import { apiClient } from "../../api/client";
import { AddressSelectionModal } from "./address-selection-modal";
import { KeyboardPanel } from "../ui/virtual-keyboard";

interface DeliveryAddressModalProps {
  customerInfo: CustomerInfo;
  pendingCall?: CallDetectedPayload | null;
  onUsePendingCall?: () => void;
  onDismissPendingCall?: () => void;
  onClose: () => void;
  onSave: (info: CustomerInfo) => void;
}

function adjustTime(
  current: string | undefined,
  part: "hour" | "minute",
  direction: "up" | "down",
): string {
  const now = new Date();
  let h = current ? parseInt(current.split(":")[0], 10) : now.getHours();
  let m = current ? parseInt(current.split(":")[1], 10) : now.getMinutes();

  if (part === "hour") {
    h = direction === "up" ? (h + 1) % 24 : (h - 1 + 24) % 24;
  } else if (direction === "up") {
    // First press: round up to nearest 5; already on a multiple: add 5
    const next = m % 5 !== 0 ? Math.ceil(m / 5) * 5 : m + 5;
    if (next >= 60) {
      m = next - 60;
      h = (h + 1) % 24;
    } else {
      m = next;
    }
  } else {
    // First press: round down to nearest 5; already on a multiple: subtract 5
    const next = m % 5 !== 0 ? Math.floor(m / 5) * 5 : m - 5;
    if (next < 0) {
      m = 60 + next;
      h = (h - 1 + 24) % 24;
    } else {
      m = next;
    }
  }

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const POSTCODE_PREFIX = "NG9 ";

const inputCls =
  "h-10 text-sm font-semibold bg-background/50 border-border/60 focus:border-primary/50";

function buildPendingCallPrefill(pendingCall: CallDetectedPayload): Partial<CustomerInfo> {
  const singleAddress = pendingCall.addresses?.length === 1 ? pendingCall.addresses[0] : undefined;
  const houseNumber = pendingCall.customer?.houseNumber ?? "";
  const street = singleAddress?.line1 ?? pendingCall.customer?.street ?? "";
  const town = singleAddress?.town ?? pendingCall.customer?.town ?? "";
  const postcode = singleAddress?.postcode ?? pendingCall.customer?.postcode ?? "";

  return {
    phone: pendingCall.phone,
    name: pendingCall.customer?.name ?? "",
    houseNumber,
    street,
    town,
    postcode,
    latitude: singleAddress?.latitude ?? pendingCall.customer?.latitude ?? null,
    longitude: singleAddress?.longitude ?? pendingCall.customer?.longitude ?? null,
    distance: pendingCall.distance ?? pendingCall.customer?.distance ?? null,
  };
}

export function DeliveryAddressModal({
  customerInfo,
  pendingCall,
  onUsePendingCall,
  onDismissPendingCall,
  onClose,
  onSave,
}: DeliveryAddressModalProps) {
  const [formData, setFormData] = useState<CustomerInfo>({
    name: "",
    phone: "",
    postcode: "",
    houseNumber: "",
    street: "",
    town: "",
    deliveryInstructions: "",
    distance: null,
    latitude: null,
    longitude: null,
    ...customerInfo,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Address[]>([]);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const postcodeRef = useRef<HTMLInputElement>(null);
  const houseNumberRef = useRef<HTMLInputElement>(null);

  // Auto-focus postcode on open; pre-fill prefix if blank
  useEffect(() => {
    const isBlank = !customerInfo.postcode;
    if (isBlank) setFormData((p) => ({ ...p, postcode: POSTCODE_PREFIX }));
    setTimeout(() => {
      postcodeRef.current?.focus();
      // Place cursor at end
      const len = postcodeRef.current?.value.length ?? 0;
      postcodeRef.current?.setSelectionRange(len, len);
    }, 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, ...customerInfo }));
  }, [customerInfo]);

  useEffect(() => {
    if (!pendingCall) return;
    const hasExistingCustomerData =
      Boolean(customerInfo.phone) ||
      Boolean(customerInfo.name) ||
      Boolean(customerInfo.street) ||
      Boolean(customerInfo.postcode);
    if (hasExistingCustomerData) return;

    setFormData((prev) => ({
      ...prev,
      ...buildPendingCallPrefill(pendingCall),
    }));
    onUsePendingCall?.();
  }, [
    customerInfo.name,
    customerInfo.phone,
    customerInfo.postcode,
    customerInfo.street,
    onUsePendingCall,
    pendingCall,
  ]);

  const handlePostcodeLookup = async () => {
    if (!formData.postcode) return;
    setIsLoading(true);
    try {
      const { addresses } = await apiClient.lookupPostcode(formData.postcode);
      if (addresses.length === 1) {
        const addr = addresses[0];
        setFormData((prev) => ({
          ...prev,
          street: addr.line1,
          town: addr.town || "",
          postcode: addr.postcode,
          latitude: addr.latitude,
          longitude: addr.longitude,
        }));
        setTimeout(() => {
          houseNumberRef.current?.focus();
        }, 80);
      } else if (addresses.length > 1) {
        setSearchResults(addresses);
        setShowAddressPicker(true);
      } else {
        alert("Postcode not found");
      }
    } catch (err) {
      console.error("Postcode lookup failed", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneLookup = async () => {
    if (!formData.phone) return;
    setIsLoading(true);
    try {
      const { customer } = await apiClient.fetchCustomer(formData.phone);
      if (customer) {
        setFormData((prev) => ({
          ...prev,
          name: customer.name || "",
          phone: customer.phone,
          postcode: customer.postcode || "",
          houseNumber: customer.houseNumber || "",
          street: customer.street || "",
          town: customer.town || "",
          distance: customer.distance ?? null,
          latitude: customer.latitude ?? null,
          longitude: customer.longitude ?? null,
        }));
        setTimeout(() => {
          postcodeRef.current?.focus();
        }, 80);
      }
    } catch (err) {
      console.log("Customer not found", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddressSelect = (addr: Address) => {
    setFormData((prev) => ({
      ...prev,
      street: addr.line1,
      town: addr.town || "",
      postcode: addr.postcode,
      latitude: addr.latitude,
      longitude: addr.longitude,
    }));
    setShowAddressPicker(false);
    setTimeout(() => {
      houseNumberRef.current?.focus();
    }, 80);
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const addressData: Partial<Address> = {
        line1: formData.street,
        town: formData.town,
        postcode: formData.postcode,
        latitude:
          formData.latitude !== undefined && formData.latitude !== null
            ? Number(formData.latitude)
            : undefined,
        longitude:
          formData.longitude !== undefined && formData.longitude !== null
            ? Number(formData.longitude)
            : undefined,
      };
      const { customer } = await apiClient.verifyAddress(formData.phone || "0000", addressData);
      onSave({
        ...formData,
        phone: customer.phone,
        distance: customer.distance ?? formData.distance ?? null,
        latitude: customer.latitude ?? formData.latitude ?? null,
        longitude: customer.longitude ?? formData.longitude ?? null,
        address:
          `${formData.houseNumber || ""} ${formData.street || ""}, ${formData.town || ""}, ${formData.postcode || ""}`
            .trim()
            .replace(/^, /, ""),
      });
    } catch (err) {
      const withStatus = err as Error & { status?: number };
      if (withStatus?.status && withStatus.status !== 404)
        console.error("Verify address failed", err);
      onSave(formData);
    } finally {
      setIsLoading(false);
    }
  };

  const nudgeTime = (part: "hour" | "minute", direction: "up" | "down") => {
    setFormData((prev) => ({
      ...prev,
      deliveryTime: adjustTime(prev.deliveryTime, part, direction),
    }));
  };

  // Action strip content — driven by which field is active
  const actionStrip = (() => {
    if (focusedField === "phone")
      return (
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            handlePhoneLookup();
          }}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-primary/10 border border-primary/30 py-3 text-sm font-bold text-primary active:bg-primary/20 transition-colors"
        >
          <Search className="h-4 w-4" /> Search Customer
        </button>
      );
    if (focusedField === "postcode")
      return (
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            handlePostcodeLookup();
          }}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground active:brightness-90 transition-all shadow-md shadow-primary/20"
        >
          <Search className="h-4 w-4" /> Look Up Postcode
        </button>
      );
    if (focusedField === "houseNumber")
      return (
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-accent py-3 text-sm font-bold text-accent-foreground active:brightness-90 transition-all shadow-md shadow-accent/20"
        >
          <Save className="h-4 w-4" /> Save & Start Order
        </button>
      );
    return (
      <p className="text-center text-[11px] text-muted-foreground uppercase tracking-widest font-semibold py-1">
        Tap a field above to type
      </p>
    );
  })();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 bg-muted/20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-1.5 rounded-lg border border-primary/20">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="pos-kicker text-primary">Delivery Details</span>
            <span className="font-display text-base font-black tracking-tight uppercase">
              Customer Information
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {formData.distance ? (
            <span className="font-mono text-sm font-bold text-accent">
              {formData.distance.toFixed(2)} mi
            </span>
          ) : null}
          <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {pendingCall && (
        <div className="border-b border-border/60 bg-primary/5 px-4 py-2">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-primary">
              Incoming call detected: {pendingCall.phone}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3"
                onClick={onDismissPendingCall}
              >
                Keep Current
              </Button>
              <Button
                size="sm"
                className="h-8 px-3"
                onClick={() => {
                  setFormData((prev) => ({ ...prev, ...buildPendingCallPrefill(pendingCall) }));
                  onUsePendingCall?.();
                }}
              >
                Use Caller Details
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 max-w-4xl mx-auto">
          {/* Phone */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
              <Phone className="h-3 w-3" /> Phone
            </label>
            <div className="flex gap-2">
              <Input
                ref={undefined}
                data-inline-keyboard="true"
                value={formData.phone?.startsWith("UNKNOWN-") ? "" : formData.phone}
                onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handlePhoneLookup()}
                onFocus={() => setFocusedField("phone")}
                onBlur={() => setFocusedField(null)}
                placeholder="07..."
                className={`${inputCls} flex-1 font-mono`}
              />
              <Button
                variant="secondary"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={handlePhoneLookup}
                disabled={isLoading}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Customer Name
            </label>
            <Input
              data-inline-keyboard="true"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              onFocus={() => setFocusedField("name")}
              onBlur={() => setFocusedField(null)}
              placeholder="John Doe"
              className={inputCls}
            />
          </div>

          {/* Postcode */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> Postcode
            </label>
            <div className="flex gap-2">
              <Input
                ref={postcodeRef}
                data-inline-keyboard="true"
                value={formData.postcode}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, postcode: e.target.value.toUpperCase() }))
                }
                onKeyDown={(e) => e.key === "Enter" && handlePostcodeLookup()}
                onFocus={() => setFocusedField("postcode")}
                onBlur={() => setFocusedField(null)}
                placeholder="NG9 1AA"
                className={`${inputCls} flex-1 font-mono uppercase`}
              />
              <Button
                variant="default"
                size="icon"
                className="h-10 w-10 shrink-0 shadow-md shadow-primary/20"
                onClick={handlePostcodeLookup}
                disabled={isLoading}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Town */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Town / City
            </label>
            <Input
              data-inline-keyboard="true"
              value={formData.town}
              onChange={(e) => setFormData((p) => ({ ...p, town: e.target.value }))}
              onFocus={() => setFocusedField("town")}
              onBlur={() => setFocusedField(null)}
              className={inputCls}
            />
          </div>

          {/* House Number — full width */}
          <div className="col-span-2 space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              House Number / Name
            </label>
            <Input
              ref={houseNumberRef}
              data-inline-keyboard="true"
              value={formData.houseNumber}
              onChange={(e) => setFormData((p) => ({ ...p, houseNumber: e.target.value }))}
              onFocus={() => setFocusedField("houseNumber")}
              onBlur={() => setFocusedField(null)}
              placeholder="e.g. 42 or The Old Mill"
              className={`${inputCls} w-full`}
            />
          </div>

          {/* Street — full width */}
          <div className="col-span-2 space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Street Name
            </label>
            <Input
              data-inline-keyboard="true"
              value={formData.street}
              onChange={(e) => setFormData((p) => ({ ...p, street: e.target.value }))}
              onFocus={() => setFocusedField("street")}
              onBlur={() => setFocusedField(null)}
              className={`${inputCls} w-full`}
            />
          </div>

          {/* ETA picker */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> Requested Time
            </label>
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-2">
              {/* Hour */}
              <div className="flex flex-col items-center gap-1 flex-1">
                <button
                  onClick={() => nudgeTime("hour", "up")}
                  className="w-full flex justify-center rounded-lg py-1.5 hover:bg-muted active:bg-border transition-colors"
                >
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                </button>
                <span className="font-mono text-2xl font-black text-foreground tabular-nums">
                  {formData.deliveryTime ? formData.deliveryTime.split(":")[0] : "--"}
                </span>
                <button
                  onClick={() => nudgeTime("hour", "down")}
                  className="w-full flex justify-center rounded-lg py-1.5 hover:bg-muted active:bg-border transition-colors"
                >
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              <span className="font-mono text-2xl font-black text-muted-foreground mb-0.5">:</span>

              {/* Minute */}
              <div className="flex flex-col items-center gap-1 flex-1">
                <button
                  onClick={() => nudgeTime("minute", "up")}
                  className="w-full flex justify-center rounded-lg py-1.5 hover:bg-muted active:bg-border transition-colors"
                >
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                </button>
                <span className="font-mono text-2xl font-black text-foreground tabular-nums">
                  {formData.deliveryTime ? formData.deliveryTime.split(":")[1] : "--"}
                </span>
                <button
                  onClick={() => nudgeTime("minute", "down")}
                  className="w-full flex justify-center rounded-lg py-1.5 hover:bg-muted active:bg-border transition-colors"
                >
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3" /> Instructions
            </label>
            <textarea
              data-inline-keyboard="true"
              value={formData.deliveryInstructions}
              onChange={(e) => setFormData((p) => ({ ...p, deliveryInstructions: e.target.value }))}
              onFocus={() => setFocusedField("instructions")}
              onBlur={() => setFocusedField(null)}
              placeholder="e.g. Leave at front door"
              className="w-full h-20 rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none resize-none"
            />
          </div>
        </div>
      </div>

      {/* Action strip — contextual lookup + Save/Cancel, all near the keyboard */}
      <div className="shrink-0 border-t border-border/40 bg-muted/20 px-4 py-2">
        <div className="mx-auto max-w-4xl flex items-center gap-2">
          <div className="flex-1">{actionStrip}</div>
          <Button
            variant="outline"
            className="h-11 px-5 font-semibold shrink-0"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            className="h-11 px-6 font-black shadow-lg shadow-primary/20 gap-2 shrink-0"
            onClick={handleSave}
            disabled={isLoading}
          >
            <Save className="h-4 w-4" />
            {isLoading ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Always-on keyboard */}
      <div className="shrink-0 border-t border-border/60 bg-background/95">
        <div className="mx-auto max-w-4xl">
          <KeyboardPanel compact />
        </div>
      </div>

      <AnimatePresence>
        {showAddressPicker && (
          <AddressSelectionModal
            key="address-picker"
            addresses={searchResults}
            onSelect={handleAddressSelect}
            onCreateNew={() => setShowAddressPicker(false)}
            onClose={() => setShowAddressPicker(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
