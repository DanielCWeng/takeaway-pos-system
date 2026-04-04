import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Button } from "../ui/button";
import { X } from "lucide-react";
import { formatCurrency } from "../../lib/format";
import { cn } from "../../lib/utils";

interface ConfirmationModalProps {
  orderTotal: number;
  errorMessage?: string | null;
  onClose: () => void;
  onConfirm: (paymentDetails: { amountPaid: number; changeDue: number }) => void | Promise<void>;
}

const NUMPAD = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "C", "0", "."];

export function ConfirmationModal({
  orderTotal,
  errorMessage,
  onClose,
  onConfirm,
}: ConfirmationModalProps) {
  const [amountPaidStr, setAmountPaidStr] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amountPaid = useMemo(() => parseFloat(amountPaidStr) || 0, [amountPaidStr]);
  const changeDue = useMemo(() => Math.max(0, amountPaid - orderTotal), [amountPaid, orderTotal]);

  const handleKeyPress = (key: string) => {
    if (key === "C") {
      setAmountPaidStr("");
    } else if (key === "." && amountPaidStr.includes(".")) {
      return;
    } else if (amountPaidStr.length < 8) {
      setAmountPaidStr((prev) => prev + key);
    }
  };

  const handleBackspace = () => {
    setAmountPaidStr((prev) => prev.slice(0, -1));
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    // If no amount entered, assume exact payment
    const finalPaid = amountPaidStr === "" ? orderTotal : amountPaid;
    try {
      await onConfirm({
        amountPaid: finalPaid,
        changeDue: Math.max(0, finalPaid - orderTotal),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="modal-keyboard-aware fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        transition={{ type: "spring", duration: 0.3, bounce: 0.2 }}
        className="pos-panel flex w-full max-w-sm flex-col shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <span className="font-display text-lg font-bold tracking-tight">Checkout</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full"
            disabled={isSubmitting}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-col gap-6 p-6">
          {/* Totals Display */}
          <div className="space-y-3 rounded-xl bg-muted/40 p-4 border border-border/40 shadow-inner">
            <div className="flex justify-between items-center opacity-70">
              <span className="text-xs font-bold uppercase tracking-widest text-foreground">
                Total Due
              </span>
              <span className="font-mono text-lg font-bold text-foreground">
                {formatCurrency(orderTotal)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                Cash Received
              </span>
              <span className="font-mono text-2xl font-black text-primary">
                {formatCurrency(amountPaid)}
              </span>
            </div>
            <div className="h-px bg-border/20 my-1" />
            <div className="flex justify-between items-center text-foreground">
              <span className="text-xs font-bold uppercase tracking-widest">Change Due</span>
              <span className="font-mono text-3xl font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrency(changeDue)}
              </span>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
              {errorMessage}
            </div>
          )}

          {/* Input Area */}
          <div className="flex gap-2">
            <div className="flex-1 rounded-lg border border-border/60 bg-background px-4 py-3 font-mono text-2xl font-bold text-right shadow-sm">
              {amountPaidStr || "0.00"}
            </div>
            <Button variant="secondary" onClick={handleBackspace} className="h-full px-4">
              &larr;
            </Button>
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3">
            {NUMPAD.map((key) => (
              <button
                key={key}
                onClick={() => handleKeyPress(key)}
                disabled={isSubmitting}
                className={cn(
                  "h-14 rounded-xl border text-xl font-bold transition-all",
                  key === "C"
                    ? "border-destructive/20 text-destructive hover:bg-destructive/10"
                    : "pos-btn-tactile hover:bg-muted/50 active:bg-muted",
                )}
              >
                {key}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              variant="outline"
              className="h-14 text-base font-semibold"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Back
            </Button>
            <Button
              className="h-14 text-lg font-bold shadow-lg shadow-primary/20"
              onClick={() => void handleConfirm()}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending..." : "Confirm"}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
