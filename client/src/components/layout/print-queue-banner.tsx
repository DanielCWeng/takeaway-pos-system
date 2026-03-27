import { motion } from "framer-motion";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useOrder } from "../../context/OrderContext";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

export function PrintQueueBanner() {
  const {
    pendingPrintJobs,
    isFlushingPrintQueue,
    lastPrintAlert,
    clearPrintAlert,
    retryQueuedPrints,
  } = useOrder();

  if (pendingPrintJobs === 0 && !lastPrintAlert) {
    return null;
  }

  const hasQueue = pendingPrintJobs > 0;
  const message = hasQueue
    ? `${pendingPrintJobs} order${pendingPrintJobs === 1 ? "" : "s"} queued for print retry.`
    : lastPrintAlert;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      role="alert"
      className={cn(
        "mb-2 flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm",
        hasQueue
          ? "border-amber-500/40 bg-amber-500/15 text-amber-100"
          : "border-rose-500/40 bg-rose-500/15 text-rose-100",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span className="truncate">{message}</span>
      </div>
      <div className="flex items-center gap-2">
        {hasQueue && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-white/20 px-2 text-[11px]"
            onClick={() => void retryQueuedPrints()}
            disabled={isFlushingPrintQueue}
          >
            <RefreshCw className={cn("mr-1 h-3 w-3", isFlushingPrintQueue && "animate-spin")} />
            Retry
          </Button>
        )}
        {lastPrintAlert && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px]"
            onClick={clearPrintAlert}
          >
            Dismiss
          </Button>
        )}
      </div>
    </motion.div>
  );
}
