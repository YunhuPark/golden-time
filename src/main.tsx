import React from 'react';
import ReactDOM from 'react-dom/client';
import './bootstrap/storageMigration';
import App from './App';
import './presentation/styles/global.css';

/**
 * Load Kakao Maps SDK dynamically with API key from environment
 */
function loadKakaoMapsSDK(): Promise<boolean> {
  return new Promise((resolve) => {
    const kakaoAppKey = import.meta.env.VITE_KAKAO_MAP_APP_KEY;

    if (!kakaoAppKey) {
      console.error('❌ VITE_KAKAO_MAP_APP_KEY is not defined');
      resolve(false);
      return;
    }

    console.log('⏳ Loading Kakao Maps SDK...');

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoAppKey}&libraries=services&autoload=false`;

    script.onload = () => {
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(() => {
          console.log('✅ Kakao Maps SDK loaded successfully');
          console.log('   - window.kakao.maps.services exists:', !!window.kakao.maps.services);
          resolve(true);
        });
      } else {
        console.error('❌ Kakao SDK loaded but kakao.maps is not available');
        resolve(false);
      }
    };

    script.onerror = () => {
      console.error('❌ Failed to load Kakao Maps SDK script');
      resolve(false);
    };

    document.head.appendChild(script);
  });
}

// Create global promise for Kakao SDK ready state
window.kakaoSDKReady = loadKakaoMapsSDK();

/**
 * Load optional monitoring only when configured.
 */
if (import.meta.env.VITE_SENTRY_DSN) {
  void import('./infrastructure/monitoring/sentry').then(({ initializeSentry }) => initializeSentry());
} else {
  console.info('ℹ️ Sentry monitoring disabled (no DSN configured)');
}

/**
 * Application Entry Point
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
