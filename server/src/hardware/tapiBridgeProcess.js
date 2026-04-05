/**
 * hardware/tapiBridgeProcess.js
 *
 * Manages the TapiBridge.exe child process lifecycle.
 *
 * Spawns the C# bridge as a subprocess so the Node.js server is the only
 * thing operators need to start. If the bridge crashes it is restarted
 * automatically with exponential backoff (same pattern as callerIdDevice.js).
 *
 * The exe path is resolved in this order:
 *  1. TAPI_BRIDGE_EXE_PATH env var (absolute or relative to server root)
 *  2. Default: <repo root>/tapi-bridge/bin/Release/net8.0-windows/TapiBridge.exe
 *
 * If the exe doesn't exist (i.e. the project hasn't been built yet) the module
 * logs a warning and does nothing — tapiDevice.js will keep retrying the WS
 * connection independently, so things will work once the exe is built.
 */

import { spawn } from "child_process";
import { existsSync } from "fs";
import { join, dirname, isAbsolute } from "path";
import { fileURLToPath } from "url";
import { config } from "../config/index.js";
import { logger } from "../infrastructure/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// <repo>/server/src/hardware  →  3 levels up = <repo>
const REPO_ROOT = join(__dirname, "..", "..", "..");

const DEFAULT_EXE_PATH = join(
  REPO_ROOT,
  "tapi-bridge",
  "bin",
  "Release",
  "net8.0-windows",
  "TapiBridge.exe",
);

const INITIAL_RESTART_DELAY_MS = 3_000;
const MAX_RESTART_DELAY_MS     = 60_000;

/** @type {import('child_process').ChildProcess | null} */
let child = null;

/** @type {ReturnType<typeof setTimeout> | null} */
let restartTimer = null;

let restartAttempt = 0;
let stopped = true;

function resolveExePath() {
  const override = config.tapi.bridgeExePath?.trim();
  if (override) {
    return isAbsolute(override) ? override : join(REPO_ROOT, override);
  }
  return DEFAULT_EXE_PATH;
}

function clearRestartTimer() {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
}

function scheduleRestart(reason) {
  if (stopped || restartTimer) return;

  const delay = Math.min(
    INITIAL_RESTART_DELAY_MS * Math.pow(2, restartAttempt),
    MAX_RESTART_DELAY_MS,
  );

  logger.warn("TapiBridge process will restart", {
    hardware: true,
    reason,
    delayMs: delay,
    attempt: restartAttempt + 1,
  });

  restartAttempt++;
  restartTimer = setTimeout(() => {
    restartTimer = null;
    spawnBridge();
  }, delay);
}

function spawnBridge() {
  if (stopped) return;

  const exePath = resolveExePath();

  if (!existsSync(exePath)) {
    logger.warn("TapiBridge.exe not found — skipping auto-launch (build tapi-bridge first)", {
      hardware: true,
      exePath,
    });
    // Retry later; the operator may be mid-install
    scheduleRestart("exe_not_found");
    return;
  }

  logger.info("Launching TapiBridge.exe", { hardware: true, exePath, port: config.tapi.bridgePort });

  child = spawn(exePath, ["--port", String(config.tapi.bridgePort)], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  child.stdout?.on("data", (data) => {
    // Bridge already formats its own log lines — forward them as-is
    const lines = data.toString().split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      logger.info(`[TapiBridge] ${line}`, { hardware: true });
    }
  });

  child.stderr?.on("data", (data) => {
    const lines = data.toString().split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      logger.error(`[TapiBridge] ${line}`, { hardware: true });
    }
  });

  child.once("spawn", () => {
    restartAttempt = 0;
    logger.info("TapiBridge.exe spawned", { hardware: true, pid: child?.pid });
  });

  child.once("error", (err) => {
    logger.error("TapiBridge.exe process error", {
      hardware: true,
      error: err?.message ?? String(err),
    });
    child = null;
    scheduleRestart("process_error");
  });

  child.once("exit", (code, signal) => {
    child = null;
    if (stopped) return;

    logger.warn("TapiBridge.exe exited unexpectedly", {
      hardware: true,
      code,
      signal,
    });
    scheduleRestart("process_exit");
  });
}

/**
 * Start the TapiBridge.exe subprocess.
 * No-op if TAPI is disabled (bridgePort === 0).
 */
export function startBridge() {
  if (config.tapi.bridgePort === 0) return;
  if (!stopped) throw new Error("startBridge() called while already running");

  stopped = false;
  restartAttempt = 0;
  spawnBridge();
}

/**
 * Kill the TapiBridge.exe subprocess and stop any pending restarts.
 */
export function stopBridge() {
  stopped = true;
  clearRestartTimer();

  if (child) {
    try {
      child.kill();
    } catch {
      // ignore
    }
    child = null;
  }

  logger.info("TapiBridge.exe process stopped", { hardware: true });
}
