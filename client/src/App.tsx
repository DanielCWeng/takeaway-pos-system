/**
 * client/src/App.tsx
 */

import { UIProvider } from './context/UIContext';
import { OrderProvider } from './context/OrderContext';
import { ThemeProvider } from './context/ThemeContext';
import { CallerProvider } from './context/CallerContext';
import { PosDashboard } from './components/layout/pos-dashboard';

function App() {
  return (
    <ThemeProvider>
      <CallerProvider>
        <UIProvider>
          <OrderProvider>
            <PosDashboard />
          </OrderProvider>
        </UIProvider>
      </CallerProvider>
    </ThemeProvider>
  );
}

export default App;
