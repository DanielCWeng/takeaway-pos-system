// client/src/main.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { CallerIdProvider } from './context/CallerIdContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  // <React.StrictMode> // <-- Comment this line out
    <CallerIdProvider>
      <App />
    </CallerIdProvider>
  // </React.StrictMode> // <-- Comment this line out
);