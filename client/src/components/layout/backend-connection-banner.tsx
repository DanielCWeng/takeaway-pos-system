import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useCaller } from "../../context/CallerContext";
import { cn } from "../../lib/utils";

export function BackendConnectionBanner() {
  const { connection } = useCaller();
  const { status, retryAttempt, nextRetryAt, offlineSince } = connection;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status === "connected") return;
    const syncTimer = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(syncTimer);
      window.clearInterval(timer);
    };
  }, [status]);

  const retryInSeconds =
    nextRetryAt !== null ? Math.max(0, Math.ceil((nextRetryAt - now) / 1000)) : null;
  const offlineSeconds =
    offlineSince !== null ? Math.max(0, Math.floor((now - offlineSince) / 1000)) : 0;
  const critical = offlineSeconds >= 60 || status === "disconnected";

  const message = useMemo(() => {
    if (status === "connecting") {
      return "Connecting to backend...";
    }
    if (status === "disconnected") {
      return "Backend disconnected. Automatic retry is paused.";
    }
    if (retryInSeconds !== null) {
      return `Backend unreachable. Retry #${retryAttempt} in ${retryInSeconds}s.`;
    }
    return "Backend unreachable. Retrying now.";
  }, [retryAttempt, retryInSeconds, status]);

  if (status === "connected") {
    return null;
  }

  return (
    <div
      role="alert"
      className={cn(
        "mt-2 flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold",
        critical
          ? "border-rose-500/40 bg-rose-500/15 text-rose-100"
          : "border-amber-500/35 bg-amber-500/10 text-amber-100",
      )}
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
