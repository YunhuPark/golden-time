/**
 * Base Application Error
 * 모든 커스텀 에러의 기본 클래스
 */
export abstract class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  abstract toJSON(): Record<string, unknown>;
}

/**
 * Network Error
 * API 호출 실패, 네트워크 연결 오류 등
 */
export class NetworkError extends AppError {
  constructor(
    message: string,
    public readonly originalError?: Error,
    statusCode?: number
  ) {
    super(message, 'NETWORK_ERROR', statusCode);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      originalError: this.originalError?.message,
    };
  }
}

/**
 * Validation Error
 * 입력값 검증 실패
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message, 'VALIDATION_ERROR', 400);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      field: this.field,
    };
  }
}

/**
 * Data Not Found Error
 * 요청한 데이터가 존재하지 않음
 */
export class DataNotFoundError extends AppError {
  constructor(message: string) {
    super(message, 'DATA_NOT_FOUND', 404);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
    };
  }
}

/**
 * Rate Limit Error
 * API 호출 제한 초과
 */
export class RateLimitError extends AppError {
  constructor(
    message: string,
    public readonly retryAfter?: number
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      retryAfter: this.retryAfter,
    };
  }
}

/**
 * Service Unavailable Error
 * 외부 서비스(API) 다운타임
 */
export class ServiceUnavailableError extends AppError {
  constructor(
    message: string,
    public readonly serviceName: string
  ) {
    super(message, 'SERVICE_UNAVAILABLE', 503);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      serviceName: this.serviceName,
    };
  }
}
