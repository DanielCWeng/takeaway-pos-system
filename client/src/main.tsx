import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Detect coarse (touch) pointers and toggle a CSS hook for larger hit targets.
const pointerQuery = window.matchMedia('(pointer: coarse)')
const applyTouchUiFlag = () => {
  const isTouch = pointerQuery.matches || navigator.maxTouchPoints > 0
  document.documentElement.classList.toggle('touch-ui', isTouch)
}

applyTouchUiFlag()
pointerQuery.addEventListener('change', applyTouchUiFlag)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
