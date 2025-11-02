// client/src/context/CallerIdContext.tsx

import React, { createContext, useContext, ReactNode } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { CustomerInfo } from '../types'; // Assuming CustomerInfo is in your types file

// Define the shape of the incoming call data payload
interface IncomingCallPayload extends CustomerInfo {
    timestamp: string;
    availableAddresses: any[] | null;
    callCount: number;
    status: 'COMPLETE' | 'NEEDS_ADDRESS';
}

// Define the shape of the context value
interface CallerIdContextType {
  lastCall: IncomingCallPayload | null;
  isConnected: boolean;
}

// Create the context with a default value
const CallerIdContext = createContext<CallerIdContextType | undefined>(undefined);

// Create the Provider component
export function CallerIdProvider({ children }: { children: ReactNode }) {
  const { lastMessage, isConnected } = useWebSocket<IncomingCallPayload>('ws://localhost:4000');

  // We only care about messages of type 'incoming_call'
  const lastCall = lastMessage?.type === 'incoming_call' ? lastMessage.payload : null;
  
  const value = { lastCall, isConnected };

  return (
    <CallerIdContext.Provider value={value}>
      {children}
    </CallerIdContext.Provider>
  );
}

// Create a custom hook to easily consume the context
export function useCallerId() {
  const context = useContext(CallerIdContext);
  if (context === undefined) {
    throw new Error('useCallerId must be used within a CallerIdProvider');
  }
  return context;
}