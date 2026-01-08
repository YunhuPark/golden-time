import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import './presentation/styles/global.css';
import { initializeSentry } from './infrastructure/monitoring/sentry';

/**
 * Clear old localStorage data that might have serialized Hospital objects
 * This ensures fresh start after theme system implementation
 */
const STORAGE_VERSION = '2.0';
const VERSION_KEY = 'golden-time-version';

if (localStorage.getItem(VERSION_KEY) !== STORAGE_VERSION) {
  console.log('🔄 Clearing old storage data...');
  const themeMode = localStorage.getItem('golden-time-storage')
    ? JSON.parse(localStorage.getItem('golden-time-storage')!).state?.themeMode
    : null;

  localStorage.clear();

  // Restore only theme preference
  if (themeMode) {
    localStorage.setItem('golden-time-storage', JSON.stringify({
      state: { themeMode },
      version: 0
    }));
  }

  localStorage.setItem(VERSION_KEY, STORAGE_VERSION);
  console.log('✅ Storage cleaned and updated');
}

/**
 * Initialize Sentry Error Monitoring
 */
initializeSentry();

/**
 * Application Entry Point
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
