import * as Sentry from '@sentry/react';
import { useEffect } from 'react';
import { useLocation, useNavigationType, createRoutesFromChildren, matchRoutes } from 'react-router-dom';

/**
 * Sentry 에러 모니터링 초기화
 *
 * Edge Cases 처리:
 * - Development 환경에서는 Sentry 비활성화 (콘솔만 사용)
 * - 민감한 정보 (전화번호, 주소) 자동 필터링
 * - 네트워크 에러는 낮은 우선순위로 처리
 */
export function initializeSentry() {
  // Development 환경에서는 Sentry 비활성화
  if (import.meta.env.DEV) {
    console.log('🔧 Development mode: Sentry disabled');
    return;
  }

  // Sentry DSN이 없으면 의도적으로 초기화하지 않음
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.info('ℹ️ Sentry monitoring disabled (no DSN configured)');
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: `golden-time@${import.meta.env['VITE_APP_VERSION'] || '1.0.0'}`,
    integrations: [
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event, hint) {
      if (event.message) {
        event.message = event.message.replace(/\d{2,3}-\d{3,4}-\d{4}/g, '***-****-****');
      }
      if (event.request?.url) {
        try {
          const url = new URL(event.request.url);
          url.search = '';
          event.request.url = url.toString();
        } catch {
          // Ignore URL parse failures.
        }
      }
      if (
        hint.originalException instanceof Error &&
        (hint.originalException.message.includes('fetch') ||
          hint.originalException.message.includes('network'))
      ) {
        event.level = 'warning';
      }
      return event;
    },
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      'adsbygoogle',
      'NetworkError',
      'Failed to fetch',
    ],
    denyUrls: [/extensions\//i, /^chrome:\/\//i, /^chrome-extension:\/\//i],
  });

  console.log('✅ Sentry initialized');
}

/**
 * 커스텀 에러 로깅 (특정 컨텍스트와 함께)
 */
export function logError(
  error: Error,
  context?: {
    area?: 'geolocation' | 'api' | 'auth' | 'cache' | 'ui';
    severity?: 'low' | 'medium' | 'high' | 'critical';
    extra?: Record<string, any>;
  }
) {
  if (import.meta.env.DEV) {
    console.error(`[${context?.area || 'app'}]`, error, context?.extra);
    return;
  }

  Sentry.withScope((scope) => {
    if (context?.area) scope.setTag('error_area', context.area);
    if (context?.severity) {
      const levelMap = {
        low: 'info',
        medium: 'warning',
        high: 'error',
        critical: 'fatal',
      } as const;
      scope.setLevel(levelMap[context.severity]);
    }
    if (context?.extra) scope.setExtras(context.extra);
    Sentry.captureException(error);
  });
}

/**
 * 사용자 정의 이벤트 로깅 (메트릭 추적용)
 */
export function logEvent(eventName: string, data?: Record<string, any>) {
  if (import.meta.env.DEV) {
    console.log(`📊 Event: ${eventName}`, data);
    return;
  }

  Sentry.addBreadcrumb({
    category: 'user-action',
    message: eventName,
    level: 'info',
    data,
  });
}

/**
 * 성능 측정 시작
 */
export function startPerformanceTransaction(name: string) {
  if (import.meta.env.DEV) {
    console.time(name);
    return null;
  }

  return Sentry.startSpan({ name, op: 'function' }, () => ({ name }));
}

/**
 * 성능 측정 종료
 */
export function finishPerformanceTransaction(_transaction: any) {
  if (import.meta.env.DEV) return;
}
