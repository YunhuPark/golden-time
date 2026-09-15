import axios from 'axios';

// 타임아웃 상수 (단위: ms)
export const TIMEOUTS = {
  EGEN: 15000,
  OPENAI: 15000,
  NAVER: 10000,
  SUPABASE: 10000,
};

export interface RetryOptions {
  maxRetries?: number; // 총 시도 횟수 (기본 3, 즉 최초 1회 + 재시도 2회)
  baseDelay?: number;
  sleepFn?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 에러가 재시도 가능한지 판별합니다.
 */
function isRetryableError(error: any): boolean {
  // fetch failed 또는 네트워크 오류
  if (error instanceof TypeError && error.message.includes('fetch failed')) {
    return true;
  }
  
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      // 응답이 없으면 네트워크/타임아웃 에러
      return true;
    }
    const status = error.response.status;
    if (status === 408 || status === 429 || (status >= 500 && status <= 504)) {
      return true;
    }
    // 400, 401, 403, 404 등은 재시도 금지
    return false;
  }

  // Supabase 오류 (네트워크 문제나 5xx)
  if (error && error.code) {
    const code = error.code;
    if (code.startsWith('5') || (error.status && error.status >= 500)) {
      return true;
    }
  }

  return false;
}

/**
 * 주어진 함수를 최대 횟수만큼 재시도합니다.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxRetries ?? 3;
  const baseDelay = options.baseDelay ?? 1000;
  const sleep = options.sleepFn ?? defaultSleep;

  let attempt = 1;

  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      if (attempt >= maxAttempts || !isRetryableError(error)) {
        throw error;
      }

      let delay = baseDelay * Math.pow(2, attempt - 1); // 지수 백오프
      delay = delay + Math.random() * delay * 0.2; // Jitter (0 ~ 20% 변동)

      // Axios Retry-After 헤더 우선 처리
      if (axios.isAxiosError(error) && error.response?.headers?.['retry-after']) {
        const retryAfterStr = error.response.headers['retry-after'];
        const retryAfterVal = parseInt(retryAfterStr, 10);
        if (!isNaN(retryAfterVal)) {
          const retryAfterMs = retryAfterVal * 1000;
          delay = Math.min(retryAfterMs, 10000); // 최대 10초로 제한
        }
      }

      console.warn(`⚠️ [Retry ${attempt}/${maxAttempts}] 일시적 오류 발생. ${Math.round(delay)}ms 후 재시도합니다. (Error: ${error.message || error})`);
      
      await sleep(delay);
      attempt++;
    }
  }
}
