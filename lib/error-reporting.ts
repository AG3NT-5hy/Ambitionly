import Constants from 'expo-constants';

// Try to import sentry-expo statically to avoid Metro path resolution issues
let sentry: any = undefined;
try {
  sentry = require('sentry-expo');
} catch (error) {
  console.warn('Sentry not available:', error);
  sentry = undefined;
}

async function loadSentry() {
  return sentry;
}

export async function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
  if (!dsn) return;
  const sdk = await loadSentry();
  if (!sdk) return;
  const release = `${Constants.expoConfig?.name ?? 'app'}@${Constants.expoConfig?.version ?? '0.0.0'}`;
  sdk.init({ dsn, enableInExpoDevelopment: true, debug: __DEV__, release });
}

export async function reportError(error: unknown, context?: Record<string, unknown>) {
  try {
    const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
    if (!dsn) {
      console.error('[ErrorReporting]', error, context);
      return;
    }
    const sdk = await loadSentry();
    if (!sdk) {
      console.error('[ErrorReporting]', error, context);
      return;
    }
    sdk.Native.captureException(error, { extra: context });
  } catch (e) {
    console.warn('Failed to report error', e);
  }
}
