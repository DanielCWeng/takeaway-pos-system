import { motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "../ui/button";
import { formatCurrency } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { CustomerInfo, OrderItem, OrderType } from "../../types";

export interface ReceiptPreviewModalProps {
  items: OrderItem[];
  orderType: OrderType;
  customerInfo?: CustomerInfo;
  subtotal: number;
  deliveryFee: number;
  total: number;
  etaMins?: number | null;
  etaRangeLow?: number | null;
  etaRangeHigh?: number | null;
  onClose: () => void;
  embedded?: boolean;
}

function fmtTime(mins: number): string {
  const d = new Date(Date.now() + mins * 60_000);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function ReceiptPreviewModal({
  items,
  orderType,
  customerInfo,
  subtotal,
  deliveryFee,
  total,
  etaMins,
  etaRangeLow,
  etaRangeHigh,
  onClose,
  embedded = false,
}: ReceiptPreviewModalProps) {
  const topLevelItems = items.filter((i) => !i.parentId);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={
        embedded
          ? "contents"
          : "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      }
      onClick={embedded ? undefined : onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 12 }}
        transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
        className="pos-panel w-full max-w-xs overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <span className="font-display text-sm font-bold tracking-tight">Receipt Preview</span>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Receipt body — thermal receipt feel */}
        <div className="max-h-[70vh] overflow-y-auto overscroll-contain p-4 font-mono text-xs">
          {/* Restaurant header */}
          <div className="mb-3 text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-foreground">
              Order Receipt
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
              {orderType === "delivery" ? "Delivery" : "Collection"}
            </p>
          </div>

          <Divider />

          {/* ETA */}
          {etaMins != null ? (
            <>
              <div className="mb-2 text-center">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {orderType === "delivery" ? "Food ready by" : "Ready by"}
                </p>
                <p className="text-base font-bold text-foreground tabular-nums">
                  ~{fmtTime(etaMins)}
                </p>
                {etaRangeLow != null && etaRangeHigh != null && (
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    {fmtTime(etaRangeLow)} – {fmtTime(etaRangeHigh)}
                  </p>
                )}
              </div>
              <Divider />
            </>
          ) : null}

          {/* Customer info (delivery only) */}
          {orderType === "delivery" && customerInfo && (
            <>
              <div className="mb-2 space-y-0.5 text-[10px] text-muted-foreground">
                {customerInfo.deliveryTime && (
                  <p className="mb-1 text-center text-sm font-bold text-foreground">
                    Requested Time: {customerInfo.deliveryTime}
                  </p>
                )}
                {customerInfo.name && <p>{customerInfo.name}</p>}
                {customerInfo.phone && <p>{customerInfo.phone}</p>}
                {(customerInfo.houseNumber || customerInfo.street) && (
                  <p>
                    {[customerInfo.houseNumber, customerInfo.street].filter(Boolean).join(" ")}
                  </p>
                )}
                {customerInfo.town && <p>{customerInfo.town}</p>}
                {customerInfo.postcode && <p>{customerInfo.postcode}</p>}
              </div>
              <Divider />
            </>
          )}

          {/* Items */}
          <div className="mb-2 space-y-1.5">
            {topLevelItems.map((item) => {
              const children = items.filter((i) => i.parentId === item.uniqueId);
              const lineTotal = item.isFoc ? 0 : item.price * item.quantity;

              return (
                <div key={item.uniqueId}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="break-words font-semibold text-foreground">
                        {item.quantity > 1 && (
                          <span className="text-muted-foreground">{item.quantity}x </span>
                        )}
                        {item.name}
                      </span>
                      {item.isFoc && (
                        <span className="ml-1 text-[9px] font-bold uppercase text-green-500">
                          FOC
                        </span>
                      )}
                    </div>
                    <span
                      className={cn(
                        "shrink-0 tabular-nums",
                        item.isFoc ? "text-green-500" : "text-foreground",
                      )}
                    >
                      {item.isFoc ? "FREE" : formatCurrency(lineTotal)}
                    </span>
                  </div>

                  {/* Child items */}
                  {children.length > 0 && (
                    <div className="ml-3 mt-0.5 space-y-0.5">
                      {children.map((child) => (
                        <div
                          key={child.uniqueId}
                          className="flex items-start justify-between gap-2 text-[10px] text-muted-foreground"
                        >
                          <span className="break-words">↳ {child.name}</span>
                          {!child.isIncluded && child.price > 0 && (
                            <span className="shrink-0 tabular-nums">
                              {formatCurrency(child.price * child.quantity)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Divider />

          {/* Totals */}
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            {orderType === "delivery" && (
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery</span>
                <span className="tabular-nums">{formatCurrency(deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-foreground">
              <span>TOTAL</span>
              <span className="tabular-nums">{formatCurrency(total)}</span>
            </div>
          </div>

          <Divider />

          <p className="text-center text-[9px] text-muted-foreground">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Divider() {
  return (
    <div className="my-2 border-t border-dashed border-border/50" />
  );
}
