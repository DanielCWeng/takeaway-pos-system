import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppErrorBoundary } from './components/system/app-error-boundary.tsx'
import { initRuntimeMonitor } from './lib/runtime-monitor'

// Detect coarse (touch) pointers and toggle a CSS hook for larger hit targets.
const pointerQuery = window.matchMedia('(pointer: coarse)')
const applyTouchUiFlag = () => {
  const isTouch = pointerQuery.matches || navigator.maxTouchPoints > 0
  document.documentElement.classList.toggle('touch-ui', isTouch)
}

applyTouchUiFlag()
pointerQuery.addEventListener('change', applyTouchUiFlag)
initRuntimeMonitor()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
