/**
 * infrastructure/logger.js
 *
 * Lightweight structured logger that writes newline-delimited JSON to stdout.
 * No external logging library — just structured console output.
 *
 * Log levels (ordered by severity, lowest first):
 *   debug < info < warn < error
 *
 * Lines are only emitted when their level is >= the configured LOG_LEVEL.
 * Hardware events (tagged { hardware: true }) are always emitted at info
 * regardless of the log level setting, per the architecture plan.
 */

// ---------------------------------------------------------------------------
// Level ordering
// ---------------------------------------------------------------------------

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

// ---------------------------------------------------------------------------
// Resolve the active log level
// We import config lazily via a getter to avoid circular init issues
// (config imports dotenv; logger is imported before config in some test paths).
// ---------------------------------------------------------------------------

let _resolvedLevel = null;

function getActiveLevel() {
  if (_resolvedLevel !== null) return _resolvedLevel;
  try {
    // Dynamic import would be async — use synchronous re-read from process.env
    // Config has already validated LOG_LEVEL by the time the server boots.
    const raw = process.env.LOG_LEVEL ?? "info";
    _resolvedLevel = LEVELS[raw] ?? LEVELS.info;
  } catch {
    _resolvedLevel = LEVELS.info;
  }
  return _resolvedLevel;
}

// ---------------------------------------------------------------------------
// Core emit function
// ---------------------------------------------------------------------------

function emit(level, message, context = {}) {
  const levelValue = LEVELS[level];
  const { hardware = false, ...rest } = context;

  // Hardware events always emit at info+; everything else respects log level
  const threshold = hardware ? Math.min(LEVELS.info, getActiveLevel()) : getActiveLevel();
  if (levelValue < threshold) return;

  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    message,
    ...(hardware ? { hardware: true } : {}),
    ...rest,
  });

  // Always write to stdout — callers can pipe/redirect as needed
  // eslint-disable-next-line no-console
  process.stdout.write(line + "\n");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const logger = {
  /** Debug-level — developer diagnostic information */
  debug: (message, context) => emit("debug", message, context),

  /** Info-level — normal operational events */
  info: (message, context) => emit("info", message, context),

  /** Warn-level — degraded state, recoverable */
  warn: (message, context) => emit("warn", message, context),

  /** Error-level — unexpected failures */
  error: (message, context) => emit("error", message, context),
};
