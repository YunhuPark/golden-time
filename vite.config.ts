import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@domain': path.resolve(import.meta.dirname, './src/domain'),
      '@data': path.resolve(import.meta.dirname, './src/data'),
      '@presentation': path.resolve(import.meta.dirname, './src/presentation'),
      '@infrastructure': path.resolve(import.meta.dirname, './src/infrastructure'),
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {},
  },
  build: {
    // Do not publish production source maps. Re-enable only with a private
    // source-map upload pipeline that does not deploy map files publicly.
    sourcemap: false,

    // 번들 사이즈 경고 임계값 (KB)
    chunkSizeWarningLimit: 1000,

    // Vite 8 ships an Oxc-based production transform/minify path, so keep the
    // build independent from a separately installed esbuild package.
    minify: 'oxc',
    target: 'es2015',

    rollupOptions: {
      output: {
        // Vite 8/Rolldown expects manualChunks to be a function.
        // Keep the existing vendor split without relying on deprecated object syntax.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react-router/') ||
            id.includes('/react-router-dom/')
          ) {
            return 'vendor-react';
          }
          if (
            id.includes('/dompurify/') ||
            id.includes('/zustand/') ||
            id.includes('/clsx/') ||
            id.includes('/tailwind-merge/')
          ) {
            return 'vendor-utils';
          }
          if (id.includes('/@supabase/')) return 'vendor-supabase';
          if (id.includes('/@sentry/')) return 'vendor-sentry';
          return undefined;
        },

        // 파일명 패턴 설정
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },

    // CSS 코드 스플리팅
    cssCodeSplit: true,
  },
});
