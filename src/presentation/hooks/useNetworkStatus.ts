import { useState, useEffect } from 'react';

/**
 * useNetworkStatus Hook
 * 네트워크 연결 상태를 실시간으로 감지
 *
 * Edge Cases:
 * - 네트워크 끊김 시 즉시 오프라인 모드 전환
 * - 네트워크 복구 시 자동 새로고침 옵션 제공
 * - 브라우저 navigator.onLine 오탐 보정
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [justReconnected, setJustReconnected] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      console.log('✅ Network connection restored');
      setIsOnline(true);

      if (wasOffline) {
        setJustReconnected(true);
        setWasOffline(false);

        setTimeout(() => {
          setJustReconnected(false);
        }, 5000);
      }
    };

    const handleOffline = () => {
      console.warn('⚠️ Network connection lost');
      setIsOnline(false);
      setWasOffline(true);
      setJustReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const checkInitialStatus = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      try {
        // Same-origin request keeps CSP strict and avoids leaking a third-party
        // connectivity probe. `no-store` prevents a cached shell from being
        // mistaken for a live network connection.
        const response = await fetch('/', {
          method: 'HEAD',
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Network health check returned ${response.status}`);
        }

        setIsOnline(true);
      } catch {
        console.warn('Initial network check failed, assuming offline');
        setIsOnline(false);
        setWasOffline(true);
      } finally {
        clearTimeout(timeoutId);
      }
    };

    void checkInitialStatus();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  return {
    isOnline,
    isOffline: !isOnline,
    justReconnected,
  };
}
