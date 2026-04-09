import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary'
import './styles/global.css'

// Prevent Electron default navigation when files are dragged/dropped
// onto areas outside our explicit drop zones.
// dragover must be prevented globally for drop events to fire at all.
// drop: only prevent default if it hasn't been handled by a React handler.
document.addEventListener('dragover', (e) => e.preventDefault())
document.addEventListener('drop', (e) => {
  // If a React handler already called preventDefault (via onDrop), skip.
  // Otherwise block browser from navigating to the dropped file.
  if (!e.defaultPrevented) {
    e.preventDefault()
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
