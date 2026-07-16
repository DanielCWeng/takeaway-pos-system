/**
 * client/src/App.tsx
 */

import { UIProvider } from "./context/UIContext";
import { OrderProvider } from "./context/OrderContext";
import { CallerProvider } from "./context/CallerContext";
import { PosDashboard } from "./components/layout/pos-dashboard";

import { VirtualKeyboard } from "./components/ui/virtual-keyboard";

function App() {
  return (
    <>
      <CallerProvider>
        <UIProvider>
          <OrderProvider>
            <PosDashboard />
          </OrderProvider>
        </UIProvider>
      </CallerProvider>
      <VirtualKeyboard />
    </>
  );
}

export default App;
