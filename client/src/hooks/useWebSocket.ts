// client/src/hooks/useWebSocket.ts

import { useState, useEffect, useRef } from "react";

// Define a generic type for the messages we expect
interface WebSocketMessage<T> {
  type: string;
  payload: T;
}

export function useWebSocket<T>(url: string) {
  const [lastMessage, setLastMessage] = useState<WebSocketMessage<T> | null>(
    null
  );
  const [isConnected, setIsConnected] = useState(false);
  
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const serverTimeout = useRef<NodeJS.Timeout | null>(null);
  const retryCount = useRef(0);
  const shouldReconnect = useRef(true);
  const lastPongTime = useRef<number>(Date.now());

  const clearTimers = () => {
    if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
    if (serverTimeout.current) clearTimeout(serverTimeout.current);
    reconnectTimeout.current = null;
    heartbeatInterval.current = null;
    serverTimeout.current = null;
  };

  const connect = () => {
    // Prevent multiple connections
    if (ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    clearTimers();

    try {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        console.log("WebSocket connection established");
        setIsConnected(true);
        retryCount.current = 0; // Reset retry count on successful connection
        lastPongTime.current = Date.now();

        // Start Heartbeat
        heartbeatInterval.current = setInterval(() => {
          if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: "ping" }));
            
            // Check for liveness
            if (Date.now() - lastPongTime.current > 30000) {
              console.warn("Server unresponsive, closing connection...");
              ws.current.close();
            }
          }
        }, 20000); // Send ping every 20s
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === "pong") {
            lastPongTime.current = Date.now();
            return; // Don't expose pong to consumers
          }

          if (message && message.type && message.payload !== undefined) {
             setLastMessage(message);
          } else {
             console.warn("Received malformed WebSocket message:", message);
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.current.onclose = () => {
        console.log("WebSocket connection closed");
        setIsConnected(false);
        ws.current = null;
        clearTimers();

        if (shouldReconnect.current) {
          const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000);
          console.log(`Reconnecting in ${delay}ms... (Attempt ${retryCount.current + 1})`);
          
          reconnectTimeout.current = setTimeout(() => {
            retryCount.current += 1;
            connect();
          }, delay);
        }
      };

      ws.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        // onclose will handle reconnection
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      if (shouldReconnect.current) {
        const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000);
        reconnectTimeout.current = setTimeout(() => {
           retryCount.current += 1;
           connect();
        }, delay);
      }
    }
  };

  useEffect(() => {
    shouldReconnect.current = true;
    connect();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // If tab wakes up and we are disconnected, reconnect immediately
        if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
          console.log("Tab visible, checking connection...");
          retryCount.current = 0; // Reset retry count for immediate attempt
          connect();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      shouldReconnect.current = false;
      clearTimers();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
    };
  }, [url]);

  return { lastMessage, isConnected };
}
