import { useEffect, useState } from "react";

interface Props {
  archivedAt: string;
}

function waitingSeconds(archivedAt: string) {
  return Math.max(0, Math.round((Date.now() - new Date(archivedAt).getTime()) / 1_000));
}

function formatWaiting(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

/**
 * Counts up from the moment an order was placed.
 * Shown on 'new' cards only — tells staff how long an order has been waiting unaccepted.
 *
 * Colour:
 *   < 3 min → zinc (neutral)
 *   3–6 min → amber (hold is getting long)
 *   > 6 min → red   (batch window has likely closed)
 */
export function WaitingTime({ archivedAt }: Props) {
  const [secs, setSecs] = useState(() => waitingSeconds(archivedAt));

  useEffect(() => {
    setSecs(waitingSeconds(archivedAt));
    const id = setInterval(() => setSecs(waitingSeconds(archivedAt)), 1_000);
    return () => clearInterval(id);
  }, [archivedAt]);

  const mins = secs / 60;
  const colourClass =
    mins >= 6 ? "text-red-400" :
    mins >= 3 ? "text-amber-400" :
                "text-zinc-500";

  return (
    <div className={`flex items-center gap-1.5 text-sm font-medium ${colourClass}`}>
      <span>⏳</span>
      <span>Waiting {formatWaiting(secs)}</span>
    </div>
  );
}
