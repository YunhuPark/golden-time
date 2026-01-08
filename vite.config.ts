import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@domain': path.resolve(__dirname, './src/domain'),
      '@data': path.resolve(__dirname, './src/data'),
      '@presentation': path.resolve(__dirname, './src/presentation'),
      '@infrastructure': path.resolve(__dirname, './src/infrastructure'),
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api/egen': {
        target: 'https://apis.data.go.kr/B552657',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/egen/, ''),
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
  build: {
    // 소스맵 생성 (프로덕션 디버깅용)
    sourcemap: true,

    // 번들 사이즈 경고 임계값 (KB)
    chunkSizeWarningLimit: 1000,

    // 최적화 옵션
    minify: 'esbuild',
    target: 'es2015',

    rollupOptions: {
      output: {
        // 코드 스플리팅 전략
        manualChunks: {
          // React 관련
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],

          // 유틸리티 라이브러리
          'vendor-utils': ['dompurify', 'zustand', 'clsx', 'tailwind-merge'],

          // Supabase
          'vendor-supabase': ['@supabase/supabase-js'],

          // Sentry (선택적 로드)
          'vendor-sentry': ['@sentry/react'],
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

  // 프로덕션 최적화
  esbuild: {
    // 프로덕션 빌드에서 console.log 제거
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
});
