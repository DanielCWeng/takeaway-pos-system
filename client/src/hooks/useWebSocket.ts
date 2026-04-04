/**
 * client/src/hooks/useWebSocket.ts
 *
 * Manages the connection to the backend WebSocket server.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { config } from "../config";
import type { WebSocketMessage } from "../types";

type UseWebSocketOptions = {
  createSocket?: (url: string) => WebSocket;
  autoConnect?: boolean;
  reconnectJitterRatio?: number;
};

const DEFAULT_CREATE_SOCKET = (url: string) => new WebSocket(url);

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30_000;

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    createSocket = DEFAULT_CREATE_SOCKET,
    autoConnect = true,
    reconnectJitterRatio = 0.2,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>(
    autoConnect ? "connecting" : "disconnected",
  );
  const [retryAttemptState, setRetryAttemptState] = useState(0);
  const [nextRetryAt, setNextRetryAt] = useState<number | null>(null);
  const [lastRetryFailedAt, setLastRetryFailedAt] = useState<number | null>(null);
  const [offlineSince, setOfflineSince] = useState<number | null>(null);
  const [lastConnectedAt, setLastConnectedAt] = useState<number | null>(null);
  const [lastDisconnectedAt, setLastDisconnectedAt] = useState<number | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const socketFactoryRef = useRef(createSocket);
  const listeners = useRef<Set<(msg: WebSocketMessage) => void>>(new Set());
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnect = useRef(autoConnect);
  const mounted = useRef(true);
  // Track retry attempts to compute exponential backoff delays
  const retryAttempt = useRef(0);

  const setStateIfMounted = useCallback((update: () => void) => {
    if (!mounted.current) return;
    update();
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(
    (retry: () => void) => {
      if (!shouldReconnect.current) {
        setStateIfMounted(() => {
          setStatus("disconnected");
          setNextRetryAt(null);
        });
        return;
      }

      clearReconnectTimer();

      const attempt = retryAttempt.current;
      const delay = Math.min(BASE_RECONNECT_DELAY_MS * 2 ** attempt, MAX_RECONNECT_DELAY_MS);
      const jitterWindow = delay * Math.max(0, reconnectJitterRatio);
      const jitterOffset = jitterWindow ? Math.random() * (jitterWindow * 2) - jitterWindow : 0;
      const finalDelay = Math.max(250, Math.round(delay + jitterOffset));
      retryAttempt.current = attempt + 1;
      const retryAt = Date.now() + finalDelay;

      setStateIfMounted(() => {
        setStatus("reconnecting");
        setRetryAttemptState(retryAttempt.current);
        setNextRetryAt(retryAt);
      });

      reconnectTimer.current = setTimeout(() => {
        reconnectTimer.current = null;
        retry();
      }, finalDelay);
    },
    [clearReconnectTimer, reconnectJitterRatio, setStateIfMounted],
  );

  // Keep the latest socket factory without retriggering effect/connect loops.
  useEffect(() => {
    socketFactoryRef.current = createSocket;
  }, [createSocket]);

  const connect = useCallback(
    function connect() {
      if (
        ws.current?.readyState === WebSocket.OPEN ||
        ws.current?.readyState === WebSocket.CONNECTING
      )
        return;

      clearReconnectTimer();

      setStateIfMounted(() => {
        setStatus(retryAttempt.current > 0 ? "reconnecting" : "connecting");
        setNextRetryAt(null);
      });

      let socket: WebSocket;
      try {
        socket = socketFactoryRef.current(config.wsUrl);
        ws.current = socket;
      } catch (err) {
        console.error("Failed to create WS socket", err);
        ws.current = null;
        setStateIfMounted(() => {
          setIsConnected(false);
          if (retryAttempt.current > 0) {
            setLastRetryFailedAt(Date.now());
          }
        });
        scheduleReconnect(connect);
        return;
      }

      socket.onopen = () => {
        if (ws.current !== socket) return;
        console.log("WS Connected");
        setStateIfMounted(() => {
          setIsConnected(true);
          setStatus("connected");
          setLastConnectedAt(Date.now());
          setLastRetryFailedAt(null);
          setOfflineSince(null);
          setRetryAttemptState(0);
          setNextRetryAt(null);
        });
        retryAttempt.current = 0;
        clearReconnectTimer();
      };

      socket.onclose = () => {
        if (ws.current !== socket) return;
        console.log("WS Disconnected");
        ws.current = null;
        setStateIfMounted(() => {
          setIsConnected(false);
          setOfflineSince((prev) => prev ?? Date.now());
          setLastDisconnectedAt(Date.now());
          if (retryAttempt.current > 0) {
            setLastRetryFailedAt(Date.now());
          }
        });
        // Exponential backoff: 1s, 2s, 4s ... capped at 30s.
        scheduleReconnect(connect);
      };

      socket.onerror = (event) => {
        if (ws.current !== socket) return;
        console.error("WS error", event);
      };

      socket.onmessage = (event) => {
        if (ws.current !== socket) return;
        try {
          const data = JSON.parse(event.data) as WebSocketMessage;
          if (data && typeof data.type === "string") {
            listeners.current.forEach((callback) => callback(data));
          }
        } catch (err) {
          console.error("Failed to parse WS message", err);
        }
      };
    },
    [clearReconnectTimer, scheduleReconnect, setStateIfMounted],
  );

  useEffect(() => {
    mounted.current = true;
    shouldReconnect.current = autoConnect;
    if (autoConnect) {
      connect();
    }
    return () => {
      mounted.current = false;
      shouldReconnect.current = false;
      clearReconnectTimer();
      retryAttempt.current = 0;
      ws.current?.close();
      ws.current = null;
    };
  }, [autoConnect, clearReconnectTimer, connect]);

  const subscribe = useCallback((callback: (msg: WebSocketMessage) => void) => {
    listeners.current.add(callback);
    return () => {
      listeners.current.delete(callback);
    };
  }, []);

  return {
    isConnected,
    status,
    connection: {
      status,
      retryAttempt: retryAttemptState,
      nextRetryAt,
      lastRetryFailedAt,
      offlineSince,
      lastConnectedAt,
      lastDisconnectedAt,
    },
    subscribe,
  };
}
