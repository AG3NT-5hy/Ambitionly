import Constants from 'expo-constants';

let sentry:
  | undefined
  | {
      init: (opts: unknown) => void;
      Native: { captureException: (e: unknown, ctx?: unknown) => void };
    };

async function loadSentry() {
  if (sentry) return sentry;
  try {
    const mod = await import('sentry-expo');
    sentry = mod as any;
    return sentry;
  } catch (error) {
    console.warn('Sentry not available:', error);
    sentry = undefined;
    return undefined;
  }
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
