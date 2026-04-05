import { useEffect, useState } from "react";
import type { OrderStatus } from "../types/kitchen";
import { formatCountdown, secondsUntil, timerColour } from "../hooks/useCookTimer";

interface Props {
  /** ISO deadline string — what the timer counts down to */
  deadline: string;
  status: OrderStatus;
}

const colourClass = {
  green: "text-green-400",
  amber: "text-amber-400",
  red:   "text-red-500",
} as const;

/**
 * Live countdown to the order's customer deadline.
 * Updates every second. Turns amber at 5 min, red + pulses at 2 min / overdue.
 */
export function CountdownTimer({ deadline, status }: Props) {
  const [secs, setSecs] = useState(() => secondsUntil(deadline));

  useEffect(() => {
    setSecs(secondsUntil(deadline));
    const id = setInterval(() => setSecs(secondsUntil(deadline)), 1_000);
    return () => clearInterval(id);
  }, [deadline]);

  if (status === "ready" || status === "complete") {
    return <span className="text-zinc-500 font-mono font-bold text-lg">READY</span>;
  }

  const colour = timerColour(secs);
  const isUrgent = colour === "red";

  return (
    <span
      className={[
        "font-mono font-bold text-xl tabular-nums leading-none",
        colourClass[colour],
        isUrgent ? "animate-pulse-red" : "",
      ].join(" ")}
    >
      {formatCountdown(secs)}
    </span>
  );
}
