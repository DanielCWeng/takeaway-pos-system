/* eslint-disable react-refresh/only-export-components */
/**
 * client/src/context/CallerContext.tsx
 *
 * Provides a shared WebSocket connection for caller events so multiple consumers
 * don't spawn their own socket.
 */

import { createContext, useContext, type ReactNode } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import type { WebSocketMessage } from "../types";

type CallerContextValue = ReturnType<typeof useWebSocket> & {
  subscribe: (callback: (msg: WebSocketMessage) => void) => () => void;
};

type CallerProviderProps = {
  children: ReactNode;
  socketFactory?: (url: string) => WebSocket;
};

const CallerContext = createContext<CallerContextValue | undefined>(undefined);

export function CallerProvider({ children, socketFactory }: CallerProviderProps) {
  const ws = useWebSocket({ createSocket: socketFactory });

  return <CallerContext.Provider value={ws}>{children}</CallerContext.Provider>;
}

export function useCaller() {
  const context = useContext(CallerContext);
  if (!context) {
    throw new Error("useCaller must be used within CallerProvider");
  }
  return context;
}
