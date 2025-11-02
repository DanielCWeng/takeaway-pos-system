// client/src/hooks/useWebSocket.ts

import { useState, useEffect, useRef } from 'react';

// Define a generic type for the messages we expect
interface WebSocketMessage<T> {
  type: string;
  payload: T;
}

export function useWebSocket<T>(url: string) {
  const [lastMessage, setLastMessage] = useState<WebSocketMessage<T> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Prevent creating a new connection on every render
    if (ws.current) return;

    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      console.log('WebSocket connection established');
      setIsConnected(true);
    };

    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setLastMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.current.onclose = () => {
      console.log('WebSocket connection closed');
      setIsConnected(false);
      ws.current = null; // Clean up the ref
      // Optional: a reconnect mechanism could be added here
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    // Clean up the connection when the component unmounts
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [url]);

  return { lastMessage, isConnected };
}