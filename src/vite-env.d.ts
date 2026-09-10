/// <reference types="vite/client" />

/**
 * Vite Environment Variables Type Definitions
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_EGEN_SERVICE_KEY: string;
  readonly VITE_KAKAO_MAP_APP_KEY: string;
  readonly VITE_SUPABASE_ENABLED: 'true' | 'false';
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_ENCRYPTION_KEY: string;
  readonly VITE_SENTRY_DSN: string;
  readonly VITE_ENV: 'development' | 'production';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
