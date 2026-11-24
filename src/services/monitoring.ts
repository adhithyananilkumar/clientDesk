import * as Sentry from '@sentry/react-native';

import { env } from '@/config';

/** Crash and error reporting. Inactive unless EXPO_PUBLIC_SENTRY_DSN is set. */
export function initMonitoring() {
  if (!env.sentryDsn) return;
  Sentry.init({
    dsn: env.sentryDsn,
    tracesSampleRate: 0.2,
    sendDefaultPii: false,
    enabled: !__DEV__,
  });
}

export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (__DEV__) console.warn('[ClientDesk]', error, context ?? '');
  if (env.sentryDsn) Sentry.captureException(error, context ? { extra: context } : undefined);
}

export const wrapRoot = <P extends object>(component: React.ComponentType<P>) =>
  env.sentryDsn ? (Sentry.wrap(component as React.ComponentType<Record<string, unknown>>) as unknown as React.ComponentType<P>) : component;
