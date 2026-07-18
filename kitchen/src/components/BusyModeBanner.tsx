/**
 * Full-width amber banner shown at the top of the screen during busy mode.
 * Tells staff to stop making decisions and follow the system's priority card.
 */
export function BusyModeBanner() {
  return (
    <div className="flex items-center justify-center gap-3 px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/30">
      <span className="text-amber-400 text-lg">⚡</span>
      <span className="font-bold tracking-widest uppercase text-amber-400 text-sm">
        Busy Mode — Follow the highlighted order
      </span>
      <span className="text-amber-400 text-lg">⚡</span>
    </div>
  );
}
