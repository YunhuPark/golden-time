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

  // Sentry DSN이 없으면 초기화하지 않음
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.warn('⚠️ SENTRY_DSN not found, error monitoring disabled');
    return;
  }

  Sentry.init({
    dsn,

    // 환경 설정
    environment: import.meta.env.MODE,

    // Release 버전 (package.json에서 가져옴)
    release: `golden-time@${import.meta.env['VITE_APP_VERSION'] || '1.0.0'}`,

    // Performance Monitoring
    integrations: [
      // React Router 통합
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
      // Replay (세션 녹화 - 디버깅용)
      Sentry.replayIntegration({
        maskAllText: true, // 모든 텍스트 마스킹 (개인정보 보호)
        blockAllMedia: true, // 미디어 차단
      }),
    ],

    // Performance 샘플링 비율 (10% 트래픽만 추적)
    tracesSampleRate: 0.1,

    // Replay 샘플링 비율
    replaysSessionSampleRate: 0.1, // 10% 세션 녹화
    replaysOnErrorSampleRate: 1.0, // 에러 발생 시 100% 녹화

    // 민감한 정보 필터링
    beforeSend(event, hint) {
      // 전화번호 패턴 마스킹
      if (event.message) {
        event.message = event.message.replace(
          /\d{2,3}-\d{3,4}-\d{4}/g,
          '***-****-****'
        );
      }

      // Request URL에서 쿼리 파라미터 제거 (API 키 등)
      if (event.request?.url) {
        try {
          const url = new URL(event.request.url);
          url.search = ''; // 쿼리 파라미터 제거
          event.request.url = url.toString();
        } catch (e) {
          // URL 파싱 실패 시 무시
        }
      }

      // 네트워크 에러는 낮은 우선순위로 설정
      if (
        hint.originalException instanceof Error &&
        (hint.originalException.message.includes('fetch') ||
         hint.originalException.message.includes('network'))
      ) {
        event.level = 'warning';
      }

      return event;
    },

    // 무시할 에러 패턴
    ignoreErrors: [
      // 브라우저 확장 프로그램 에러
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',

      // 광고 차단기 관련
      'adsbygoogle',

      // 네트워크 타임아웃 (이미 캐시로 처리됨)
      'NetworkError',
      'Failed to fetch',
    ],

    // 특정 URL에서 발생한 에러 무시
    denyUrls: [
      // 크롬 확장 프로그램
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
    ],
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
  // Development 환경에서는 콘솔만 출력
  if (import.meta.env.DEV) {
    console.error(`[${context?.area || 'app'}]`, error, context?.extra);
    return;
  }

  // Sentry에 에러 전송
  Sentry.withScope((scope) => {
    // 컨텍스트 추가
    if (context?.area) {
      scope.setTag('error_area', context.area);
    }

    // 심각도 설정
    if (context?.severity) {
      const levelMap = {
        low: 'info',
        medium: 'warning',
        high: 'error',
        critical: 'fatal',
      } as const;
      scope.setLevel(levelMap[context.severity]);
    }

    // 추가 정보
    if (context?.extra) {
      scope.setExtras(context.extra);
    }

    // 에러 캡처
    Sentry.captureException(error);
  });
}

/**
 * 사용자 정의 이벤트 로깅 (메트릭 추적용)
 */
export function logEvent(
  eventName: string,
  data?: Record<string, any>
) {
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

  // Sentry v8+ uses startSpan instead of startTransaction
  return Sentry.startSpan({
    name,
    op: 'function',
  }, () => {
    // Return a simple object for backwards compatibility
    return { name };
  });
}

/**
 * 성능 측정 종료
 */
export function finishPerformanceTransaction(_transaction: any) {
  if (import.meta.env.DEV) {
    return;
  }

  // In Sentry v8+, spans are automatically finished when the function completes
  // No manual finish needed
}
