import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// Redirect any subdomains back to the main domain to prevent subdomain lock-in
const host = window.location.hostname;
if (host.endsWith('.localhost')) {
  const port = window.location.port ? `:${window.location.port}` : '';
  window.location.href = `${window.location.protocol}//localhost${port}${window.location.pathname}${window.location.search}${window.location.hash}`;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register PWA service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}
