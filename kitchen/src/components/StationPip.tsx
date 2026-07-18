import type { StationLoad, StationType } from "../types/kitchen";
import { STATION_LABELS } from "../types/kitchen";

interface Props {
  station: StationType;
  load: StationLoad | undefined;
}

/**
 * Single station capacity indicator.
 *
 * States:
 *   idle      (0 / capacity)           → zinc, dim
 *   active    (> 0, < capacity)        → green
 *   full      (= capacity, no queue)   → amber
 *   backlog   (= capacity + queued)    → red
 */
export function StationPip({ station, load }: Props) {
  const { used = 0, capacity = 1, queued = 0 } = load ?? {};

  const state =
    used === 0    ? "idle" :
    queued > 0    ? "backlog" :
    used >= capacity ? "full" :
                    "active";

  const colours = {
    idle:    { dot: "bg-zinc-700",   text: "text-zinc-600",  ring: "" },
    active:  { dot: "bg-green-500",  text: "text-green-400", ring: "shadow-[0_0_8px_1px_rgba(34,197,94,0.4)]" },
    full:    { dot: "bg-amber-500",  text: "text-amber-400", ring: "shadow-[0_0_8px_1px_rgba(245,158,11,0.4)]" },
    backlog: { dot: "bg-red-500",    text: "text-red-400",   ring: "shadow-[0_0_8px_1px_rgba(239,68,68,0.5)]" },
  } as const;

  const c = colours[state];

  // Build slot indicators (filled dots)
  const dots = Array.from({ length: capacity }, (_, i) => i < used);

  return (
    <div className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#1a1a1a] min-w-[72px]">
      {/* Label */}
      <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-600 whitespace-nowrap">
        {STATION_LABELS[station]}
      </span>

      {/* Slot dots */}
      <div className="flex items-center gap-1">
        {dots.map((filled, i) => (
          <span
            key={i}
            className={[
              "w-2.5 h-2.5 rounded-full transition-all duration-300",
              filled ? `${c.dot} ${c.ring}` : "bg-zinc-800",
            ].join(" ")}
          />
        ))}
      </div>

      {/* Count label */}
      <span className={`text-xs font-bold tabular-nums leading-none ${c.text}`}>
        {used}/{capacity}
        {queued > 0 && <span className="text-red-400 ml-1">+{queued}</span>}
      </span>
    </div>
  );
}
