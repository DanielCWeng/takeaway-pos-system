/**
 * client/src/App.tsx
 */

import { UIProvider } from './context/UIContext';
import { OrderProvider } from './context/OrderContext';
import { ThemeProvider } from './context/ThemeContext';
import { CallerProvider } from './context/CallerContext';
import { PosDashboard } from './components/layout/pos-dashboard';

import { VirtualKeyboard } from './components/ui/virtual-keyboard';

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
      <VirtualKeyboard />
    </ThemeProvider>
  );
}

export default App;
