import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './presentation/styles/global.css';
import { initializeSentry } from './infrastructure/monitoring/sentry';

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
 * Clear old localStorage data that might have serialized Hospital objects
 * This ensures fresh start after theme system implementation
 */
const STORAGE_VERSION = '2.1';
const VERSION_KEY = 'golden-time-version';

if (localStorage.getItem(VERSION_KEY) !== STORAGE_VERSION) {
  console.log('🔄 Clearing old storage data...');
  
  // 강제로 다크모드로 초기화 (시연 영상을 위해 라이트모드 캐시 완전 무효화)
  localStorage.clear();

  localStorage.setItem('golden-time-storage', JSON.stringify({
    state: { themeMode: 'dark' },
    version: 0
  }));

  localStorage.setItem(VERSION_KEY, STORAGE_VERSION);
  console.log('✅ Storage cleaned and updated to Dark Mode default');
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
