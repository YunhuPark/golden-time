import { describe, expect, it } from 'vitest';
import { sanitizeTelemetryRecord } from './sentry';

describe('sanitizeTelemetryRecord', () => {
  it('redacts precise location and contact fields recursively', () => {
    expect(
      sanitizeTelemetryRecord({
        location: { lat: 35.146, lon: 126.923 },
        hospital: {
          address: '광주광역시 테스트로 1',
          phoneNumber: '062-123-4567',
        },
        operation: 'hospital_search',
      })
    ).toEqual({
      location: '[REDACTED]',
      hospital: {
        address: '[REDACTED]',
        phoneNumber: '[REDACTED]',
      },
      operation: 'hospital_search',
    });
  });

  it('preserves non-sensitive operational metadata', () => {
    expect(
      sanitizeTelemetryRecord({ status: 'failed', attempt: 2, cacheHit: false })
    ).toEqual({ status: 'failed', attempt: 2, cacheHit: false });
  });
});
