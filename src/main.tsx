import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { PizzaProvider } from './context/PizzaContext';
import { hideBootLoader, waitForCriticalAssets } from './services/boot';
import { captureInstallPrompt } from './services/install';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find root element');
}

captureInstallPrompt();

// Render only once the first screen can appear complete, so slow connections see the
// loader instead of a half-drawn app with fallback fonts and missing images.
waitForCriticalAssets().then(() => {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <PizzaProvider>
        <App />
      </PizzaProvider>
    </React.StrictMode>
  );
  requestAnimationFrame(() => requestAnimationFrame(hideBootLoader));
});
