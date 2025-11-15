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
  const shouldReconnect = useRef(true);

  const connect = () => {
    // Clear any pending reconnection attempts
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }

    // Don't create a new connection if one already exists
    if (ws.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        console.log("WebSocket connection established");
        setIsConnected(true);
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setLastMessage(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.current.onclose = () => {
        console.log("WebSocket connection closed");
        setIsConnected(false);
        ws.current = null;

        // Auto-reconnect after 3 seconds if we should reconnect
        if (shouldReconnect.current) {
          console.log("Reconnecting in 3 seconds...");
          reconnectTimeout.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

      ws.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        // The onclose handler will trigger reconnection
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      // Try reconnecting after an error
      if (shouldReconnect.current) {
        reconnectTimeout.current = setTimeout(() => {
          connect();
        }, 3000);
      }
    }
  };

  useEffect(() => {
    // Start the connection
    shouldReconnect.current = true;
    connect();

    // Clean up when component unmounts
    return () => {
      shouldReconnect.current = false;
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
    };
  }, [url]);

  return { lastMessage, isConnected };
}
