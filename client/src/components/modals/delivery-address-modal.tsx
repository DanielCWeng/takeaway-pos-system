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
import { isValidUkPostcode, normalisePostcode } from "../../lib/postcode";
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
  return {
    phone: pendingCall.phone,
    name: pendingCall.customer?.name ?? "",
  };
}

function getCurrentUkTime(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
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
    line1: "",
    line2: "",
    town: "",
    deliveryInstructions: "",
    distance: null,
    latitude: null,
    longitude: null,
    ...customerInfo,
    deliveryTime: customerInfo.deliveryTime || getCurrentUkTime(),
  });

  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Address[]>([]);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [addressPickerSource, setAddressPickerSource] = useState<"provider" | "history" | null>(
    null,
  );
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);

  const postcodeRef = useRef<HTMLInputElement>(null);
  const line1Ref = useRef<HTMLInputElement>(null);
  const postcodeLookupGeneration = useRef(0);
  const phoneLookupGeneration = useRef(0);

  const clearAddress = (previous: CustomerInfo, postcode = POSTCODE_PREFIX): CustomerInfo => ({
    ...previous,
    postcode,
    line1: "",
    line2: "",
    town: "",
    latitude: null,
    longitude: null,
    distance: null,
  });

  const closeAddressPicker = () => {
    setShowAddressPicker(false);
    setSearchResults([]);
    setAddressPickerSource(null);
  };

  const enterAddressManually = () => {
    postcodeLookupGeneration.current += 1;
    setIsLoading(false);
    setFormData((previous) =>
      clearAddress(
        previous,
        addressPickerSource === "provider"
          ? normalisePostcode(previous.postcode || "")
          : POSTCODE_PREFIX,
      ),
    );
    setLookupMessage(null);
    closeAddressPicker();
    setTimeout(() => postcodeRef.current?.focus(), 80);
  };

  const updateManualAddressField = (
    field: "postcode" | "line1" | "line2" | "town",
    value: string,
  ) => {
    postcodeLookupGeneration.current += 1;
    setIsLoading(false);
    setFormData((previous) => ({
      ...previous,
      [field]: value,
      latitude: null,
      longitude: null,
      distance: null,
    }));
    setLookupMessage(null);
  };

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
      Boolean(customerInfo.line1) ||
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
    customerInfo.line1,
    onUsePendingCall,
    pendingCall,
  ]);

  const handlePostcodeLookup = async () => {
    if (!formData.postcode) return;
    const lookupGeneration = ++postcodeLookupGeneration.current;
    const requestedPostcode = formData.postcode;
    setLookupMessage(null);
    setIsLoading(true);
    try {
      const { addresses } = await apiClient.lookupPostcode(requestedPostcode);
      if (lookupGeneration !== postcodeLookupGeneration.current) return;
      if (addresses.length === 1) {
        const addr = addresses[0];
        setFormData((prev) => ({
          ...prev,
          line1: addr.line1,
          line2: addr.line2 || "",
          town: addr.town || "",
          postcode: addr.postcode,
          latitude: addr.latitude,
          longitude: addr.longitude,
          distance: addr.distance ?? null,
        }));
        setTimeout(() => {
          line1Ref.current?.focus();
        }, 80);
      } else if (addresses.length > 1) {
        setSearchResults(addresses);
        setAddressPickerSource("provider");
        setShowAddressPicker(true);
      } else {
        setLookupMessage("Postcode not found. Enter the address manually.");
      }
    } catch (err) {
      if (lookupGeneration !== postcodeLookupGeneration.current) return;
      console.error("Postcode lookup failed", err);
      const error = err as Error & { status?: number; code?: string };
      setFormData((prev) => ({
        ...prev,
        latitude: null,
        longitude: null,
        distance: null,
      }));
      setLookupMessage(
        error.status === 400
          ? "Enter a valid UK postcode."
          : error.status === 404
            ? "Postcode not found. Enter the address manually."
            : "Address lookup is unavailable. Enter the address manually.",
      );
    } finally {
      if (lookupGeneration === postcodeLookupGeneration.current) setIsLoading(false);
    }
  };

  const handlePhoneLookup = async () => {
    if (!formData.phone) return;
    const lookupGeneration = ++phoneLookupGeneration.current;
    const requestedPhone = formData.phone;
    postcodeLookupGeneration.current += 1;
    closeAddressPicker();
    setLookupMessage(null);
    setFormData((previous) => clearAddress(previous));
    setIsLoading(true);
    try {
      const { customer, addresses } = await apiClient.fetchCustomer(requestedPhone);
      if (lookupGeneration !== phoneLookupGeneration.current) return;
      if (customer) {
        setFormData((prev) => ({
          ...prev,
          name: customer.name || "",
          phone: customer.phone,
        }));
        if (addresses.length > 0) {
          setSearchResults(addresses);
          setAddressPickerSource("history");
          setShowAddressPicker(true);
        } else {
          setLookupMessage("No saved address. Enter one manually or look up a postcode.");
          setTimeout(() => postcodeRef.current?.focus(), 80);
        }
      }
    } catch (err) {
      if (lookupGeneration !== phoneLookupGeneration.current) return;
      console.log("Customer not found", err);
    } finally {
      if (lookupGeneration === phoneLookupGeneration.current) setIsLoading(false);
    }
  };

  const handleAddressSelect = (addr: Address) => {
    setFormData((prev) => ({
      ...prev,
      line1: addr.line1,
      line2: addr.line2 || "",
      town: addr.town || "",
      postcode: addr.postcode,
      latitude: addr.latitude,
      longitude: addr.longitude,
      distance: addr.distance ?? null,
    }));
    closeAddressPicker();
    setTimeout(() => {
      line1Ref.current?.focus();
    }, 80);
  };

  const handleSave = () => {
    const postcode = normalisePostcode(formData.postcode || "");
    if (!isValidUkPostcode(postcode)) {
      setLookupMessage("Enter a valid UK postcode before saving.");
      postcodeRef.current?.focus();
      return;
    }
    if (!formData.line1?.trim()) {
      setLookupMessage("Enter the first line of the delivery address before saving.");
      line1Ref.current?.focus();
      return;
    }
    onSave({ ...formData, postcode, line1: formData.line1.trim(), line2: formData.line2?.trim() });
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
    if (focusedField === "line1")
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
      className="fixed inset-0 z-50 flex justify-center bg-black/20"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isLoading) onClose();
      }}
    >
      <div className="flex h-full w-full max-w-6xl flex-col bg-background shadow-2xl">
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
                    phoneLookupGeneration.current += 1;
                    postcodeLookupGeneration.current += 1;
                    setIsLoading(false);
                    closeAddressPicker();
                    setLookupMessage(null);
                    setFormData((previous) => ({
                      ...clearAddress(previous),
                      ...buildPendingCallPrefill(pendingCall),
                    }));
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
                  onChange={(e) => {
                    const phone = e.target.value;
                    phoneLookupGeneration.current += 1;
                    postcodeLookupGeneration.current += 1;
                    setIsLoading(false);
                    closeAddressPicker();
                    setLookupMessage(null);
                    setFormData((previous) =>
                      previous.phone === phone
                        ? previous
                        : { ...clearAddress(previous), phone, name: "" },
                    );
                  }}
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
                    updateManualAddressField("postcode", e.target.value.toUpperCase())
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
              {lookupMessage && (
                <p role="status" className="mt-1 text-xs font-semibold text-amber-700">
                  {lookupMessage}
                </p>
              )}
            </div>

            {/* Town */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Town / City
              </label>
              <Input
                data-inline-keyboard="true"
                value={formData.town}
                onChange={(e) => updateManualAddressField("town", e.target.value)}
                onFocus={() => setFocusedField("town")}
                onBlur={() => setFocusedField(null)}
                className={inputCls}
              />
            </div>

            {/* Address line 1 — full width */}
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Address Line 1
              </label>
              <Input
                ref={line1Ref}
                data-inline-keyboard="true"
                value={formData.line1}
                onChange={(e) => updateManualAddressField("line1", e.target.value)}
                onFocus={() => setFocusedField("line1")}
                onBlur={() => setFocusedField(null)}
                placeholder="e.g. 42 Copeland Avenue"
                className={`${inputCls} w-full`}
              />
            </div>

            {/* Address line 2 — full width */}
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Address Line 2 (Optional)
              </label>
              <Input
                data-inline-keyboard="true"
                value={formData.line2}
                onChange={(e) => updateManualAddressField("line2", e.target.value)}
                onFocus={() => setFocusedField("line2")}
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

                <span className="font-mono text-2xl font-black text-muted-foreground mb-0.5">
                  :
                </span>

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
                onChange={(e) =>
                  setFormData((p) => ({ ...p, deliveryInstructions: e.target.value }))
                }
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
            <KeyboardPanel compact onEnter={handleSave} />
          </div>
        </div>

        <AnimatePresence>
          {showAddressPicker && (
            <AddressSelectionModal
              key="address-picker"
              addresses={searchResults}
              onSelect={handleAddressSelect}
              onCreateNew={enterAddressManually}
              onClose={closeAddressPicker}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
