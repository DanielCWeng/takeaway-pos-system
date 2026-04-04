import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Wifi, WifiOff } from "lucide-react";
import { useCaller } from "../../context/CallerContext";
import { cn } from "../../lib/utils";

type StatusTheme = {
  label: string;
  containerClassName: string;
  iconClassName: string;
};

const STATUS_THEME: Record<string, StatusTheme> = {
  connected: {
    label: "Backend Online",
    containerClassName: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    iconClassName: "text-emerald-300",
  },
  connecting: {
    label: "Connecting",
    containerClassName: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    iconClassName: "text-amber-300",
  },
  reconnecting: {
    label: "Reconnecting",
    containerClassName: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    iconClassName: "text-amber-300",
  },
  disconnected: {
    label: "Backend Offline",
    containerClassName: "border-rose-500/30 bg-rose-500/10 text-rose-200",
    iconClassName: "text-rose-300",
  },
};

function formatTime(timestamp: number | null) {
  if (!timestamp) return null;
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

export function BackendConnectionIndicator() {
  const { connection } = useCaller();
  const {
    status,
    retryAttempt,
    nextRetryAt,
    lastRetryFailedAt,
    offlineSince,
    lastConnectedAt,
    lastDisconnectedAt,
  } = connection;
  const [now, setNow] = useState(() => Date.now());

  const offlineSeconds = offlineSince ? Math.max(0, Math.floor((now - offlineSince) / 1000)) : null;
  const isEscalatedOutage =
    status !== "connected" && offlineSeconds !== null && offlineSeconds >= 60;
  const theme =
    (isEscalatedOutage ? STATUS_THEME.disconnected : STATUS_THEME[status]) ??
    STATUS_THEME.disconnected;
  const retryInSeconds = nextRetryAt ? Math.max(0, Math.ceil((nextRetryAt - now) / 1000)) : null;
  const hasFailedRetry = Boolean(lastRetryFailedAt);
  const isAttemptingNow = status === "reconnecting" && retryAttempt > 0 && !nextRetryAt;

  const visibleLabel = (() => {
    if (status !== "reconnecting") return theme.label;
    if (isAttemptingNow) return "Retrying now...";
    if (retryInSeconds === null) return theme.label;
    if (isEscalatedOutage && offlineSeconds !== null) {
      return `Offline ${offlineSeconds}s, retry in ${retryInSeconds}s`;
    }
    if (hasFailedRetry) return `Retry failed, next in ${retryInSeconds}s`;
    return `${theme.label} (${retryInSeconds}s)`;
  })();

  useEffect(() => {
    if (status === "connected") return;

    const syncTimer = window.setTimeout(() => setNow(Date.now()), 0);
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearTimeout(syncTimer);
      window.clearInterval(interval);
    };
  }, [status]);

  const title = useMemo(() => {
    const details: string[] = [theme.label];
    if (isAttemptingNow) {
      details.push("Attempting reconnect now");
    }
    if (status === "reconnecting") {
      details.push(
        `${hasFailedRetry ? "Last retry failed" : "Retrying"} #${retryAttempt}${retryInSeconds !== null ? ` in ${retryInSeconds}s` : ""}`,
      );
    }
    if (offlineSeconds !== null) {
      details.push(`Offline for ${offlineSeconds}s`);
    }
    const lastUp = formatTime(lastConnectedAt);
    if (lastUp) details.push(`Last online: ${lastUp}`);
    const lastDown = formatTime(lastDisconnectedAt);
    if (lastDown && status !== "connected") details.push(`Last offline: ${lastDown}`);
    return details.join(" | ");
  }, [
    lastConnectedAt,
    lastDisconnectedAt,
    offlineSeconds,
    hasFailedRetry,
    isAttemptingNow,
    retryAttempt,
    retryInSeconds,
    status,
    theme.label,
  ]);

  return (
    <div
      role="status"
      aria-live="polite"
      title={title}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-md border px-2 text-xs font-medium",
        theme.containerClassName,
      )}
    >
      {status === "connected" ? (
        <Wifi className={cn("h-3.5 w-3.5", theme.iconClassName)} />
      ) : status === "disconnected" ? (
        <WifiOff className={cn("h-3.5 w-3.5", theme.iconClassName)} />
      ) : (
        <LoaderCircle className={cn("h-3.5 w-3.5 animate-spin", theme.iconClassName)} />
      )}
      <span className="hidden sm:inline">{visibleLabel}</span>
    </div>
  );
}
