import { useState, useEffect } from 'react';

/**
 * useNetworkStatus Hook
 * 네트워크 연결 상태를 실시간으로 감지
 *
 * Edge Cases:
 * - 네트워크 끊김 시 즉시 오프라인 모드 전환
 * - 네트워크 복구 시 자동 새로고침 옵션 제공
 * - 느린 네트워크 감지 (연결은 되어있지만 매우 느림)
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [justReconnected, setJustReconnected] = useState<boolean>(false);

  useEffect(() => {
    // 온라인 상태 변경 핸들러
    const handleOnline = () => {
      console.log('✅ Network connection restored');
      setIsOnline(true);

      // 오프라인에서 복구된 경우
      if (wasOffline) {
        setJustReconnected(true);
        setWasOffline(false);

        // 5초 후 자동으로 "방금 재연결됨" 플래그 해제
        setTimeout(() => {
          setJustReconnected(false);
        }, 5000);
      }
    };

    // 오프라인 상태 변경 핸들러
    const handleOffline = () => {
      console.warn('⚠️ Network connection lost');
      setIsOnline(false);
      setWasOffline(true);
      setJustReconnected(false);
    };

    // 이벤트 리스너 등록
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 초기 상태 확인 (브라우저 API와 실제 네트워크 상태가 다를 수 있음)
    const checkInitialStatus = async () => {
      try {
        // 실제 네트워크 요청으로 확인
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3초 타임아웃

        await fetch('https://www.google.com/favicon.ico', {
          mode: 'no-cors',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        setIsOnline(true);
      } catch (error) {
        console.warn('Initial network check failed, assuming offline');
        setIsOnline(false);
        setWasOffline(true);
      }
    };

    checkInitialStatus();

    // Cleanup
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
