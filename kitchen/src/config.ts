export const API_URL = import.meta.env.VITE_API_URL ?? "";
// Empty string → uses Vite proxy (same origin), which forwards to localhost:4000.
// Set VITE_API_URL in .env if deploying kitchen screen separately.

export const WS_URL = (() => {
  const override = import.meta.env.VITE_WS_URL as string | undefined;
  if (override) return override;
  // Derive from current page origin — /ws is proxied by Vite to localhost:4000
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
})();
