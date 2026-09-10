type ErrorContext = {
  area?: 'geolocation' | 'api' | 'auth' | 'cache' | 'ui';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  extra?: Record<string, unknown>;
};

const monitoringEnabled = import.meta.env.DEV || Boolean(import.meta.env.VITE_SENTRY_DSN);

export function logError(error: Error, context?: ErrorContext): void {
  if (!monitoringEnabled) return;
  void import('./sentry').then(({ logError: send }) => send(error, context));
}

export function logEvent(eventName: string, data?: Record<string, unknown>): void {
  if (!monitoringEnabled) return;
  void import('./sentry').then(({ logEvent: send }) => send(eventName, data));
}
