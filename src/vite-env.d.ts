/// <reference types="vite/client" />

/**
 * Vite Environment Variables Type Definitions
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_EGEN_SERVICE_KEY: string;
  readonly VITE_KAKAO_MAP_APP_KEY: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_ENCRYPTION_KEY: string;
  readonly VITE_SENTRY_DSN: string;
  readonly VITE_ENV: 'development' | 'production';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Kakao Maps SDK Type Definitions
 * - SDK는 global window 객체에 로드됨
 * - 런타임에 동적으로 로드되므로 any 타입 사용
 */
declare global {
  interface Window {
    kakao: any;
    kakaoSDKReady?: Promise<boolean>;
  }
}
