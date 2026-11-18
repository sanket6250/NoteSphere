import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { OverlayProvider } from './OverlaySystem';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <OverlayProvider>
      <App />
    </OverlayProvider>
  </React.StrictMode>,
);
