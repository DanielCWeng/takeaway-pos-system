import type { StationLoadMap } from "../types/kitchen";
import { TRACKED_STATIONS } from "../types/kitchen";
import { StationPip } from "./StationPip";

interface Props {
  load: StationLoadMap;
}

/**
 * Horizontal strip showing live capacity for all tracked kitchen stations.
 * Boiler is shown as a static always-on indicator (not per-order tracked).
 * Sauce station is excluded (never a bottleneck).
 */
export function StationLoadPanel({ load }: Props) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-[#0a0a0a] border-b border-[#181818] overflow-x-auto">
      <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-700 shrink-0 mr-1">
        Stations
      </span>

      {TRACKED_STATIONS.map((station) => (
        <StationPip key={station} station={station} load={load[station]} />
      ))}

      {/* Boiler — always on, static indicator */}
      <div className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#1a1a1a] min-w-[72px]">
        <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-600">BOILER</span>
        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_6px_1px_rgba(59,130,246,0.5)]" />
        <span className="text-xs font-bold text-blue-400">ON</span>
      </div>
    </div>
  );
}
