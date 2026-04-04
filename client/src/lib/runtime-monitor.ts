import { config } from "../config";

type ClientErrorPayload = {
  type: string;
  message: string;
  source?: string;
  stack?: string;
  route?: string;
};

const CLIENT_ERROR_ENDPOINT = `${config.apiUrl}/telemetry/client-error`;
const CHUNK_RELOAD_KEY = "pos.chunk-reload-attempted.v1";

let initialized = false;

function clamp(value: string | undefined, max: number) {
  if (!value) return undefined;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function toErrorMessage(value: unknown) {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isChunkLoadFailure(message: string, source?: string) {
  const text = `${message} ${source ?? ""}`.toLowerCase();
  return (
    text.includes("dynamically imported module") ||
    text.includes("failed to fetch dynamically imported module") ||
    text.includes("importing a module script failed") ||
    text.includes("chunkloaderror") ||
    text.includes("mime type")
  );
}

function reportClientError(payload: ClientErrorPayload) {
  const sameOrigin = (() => {
    try {
      return (
        new URL(CLIENT_ERROR_ENDPOINT, window.location.origin).origin === window.location.origin
      );
    } catch {
      return false;
    }
  })();

  const body = JSON.stringify({
    type: clamp(payload.type, 64),
    message: clamp(payload.message, 1500),
    source: clamp(payload.source, 1200),
    stack: clamp(payload.stack, 5000),
    route: clamp(payload.route ?? window.location.pathname, 400),
    userAgent: clamp(navigator.userAgent, 600),
    time: new Date().toISOString(),
  });

  try {
    if (sameOrigin && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(CLIENT_ERROR_ENDPOINT, blob);
      return;
    }
  } catch {
    // fallback to fetch
  }

  void fetch(CLIENT_ERROR_ENDPOINT, {
    method: "POST",
    mode: "cors",
    credentials: "omit",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // ignore telemetry failures
  });
}

function attemptSingleChunkRecovery() {
  if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1") return;
  sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  window.location.reload();
}

function handleGlobalError(event: ErrorEvent | Event) {
  const isErrorEvent = event instanceof ErrorEvent;
  const message = isErrorEvent ? event.message : "Resource load error";
  const source = isErrorEvent ? event.filename : (event.target as HTMLScriptElement | null)?.src;
  const stack = isErrorEvent && event.error instanceof Error ? event.error.stack : undefined;

  reportClientError({ type: "window.error", message, source, stack });

  if (isChunkLoadFailure(message, source)) {
    attemptSingleChunkRecovery();
  }
}

function handleUnhandledRejection(event: PromiseRejectionEvent) {
  const message = toErrorMessage(event.reason);
  const stack = event.reason instanceof Error ? event.reason.stack : undefined;

  reportClientError({
    type: "window.unhandledrejection",
    message,
    stack,
  });

  if (isChunkLoadFailure(message)) {
    attemptSingleChunkRecovery();
  }
}

export function initRuntimeMonitor() {
  if (initialized) return;
  initialized = true;

  // If app booted successfully after a retry, clear the retry marker.
  sessionStorage.removeItem(CHUNK_RELOAD_KEY);

  window.addEventListener("error", handleGlobalError, true);
  window.addEventListener("unhandledrejection", handleUnhandledRejection);
}

export function reportRenderError(error: Error, info?: string) {
  reportClientError({
    type: "react.error-boundary",
    message: error.message,
    stack: `${error.stack ?? ""}${info ? `\n${info}` : ""}`.trim(),
  });
}
