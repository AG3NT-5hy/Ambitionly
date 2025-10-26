import { AppError, NetworkError, TimeoutError, ValidationError, isRetryableStatus } from '../lib/errors'

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  retry?: {
    retries: number;
    factor?: number;
    minTimeoutMs?: number;
    maxTimeoutMs?: number;
  };
  parseJson?: boolean;
}

export interface HttpResponse<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: AppError;
}

const DEFAULT_TIMEOUT = 15000;
const circuit: Record<string, { failures: number; openedAt?: number }> = {};
const FAILURE_THRESHOLD = 5;
const OPEN_MS = 20000;

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function hostFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.host;
  } catch {
    return 'unknown';
  }
}

export async function httpRequest<T = unknown>(url: string, options: RequestOptions = {}): Promise<HttpResponse<T>> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  const retryCfg = options.retry ?? { retries: 0, factor: 2, minTimeoutMs: 300, maxTimeoutMs: 5000 };
  const parseJson = options.parseJson ?? true;
  const host = hostFromUrl(url);

  const state = (circuit[host] ??= { failures: 0 });
  if (state.openedAt && Date.now() - state.openedAt < OPEN_MS) {
    return { ok: false, status: 0, error: new AppError('Circuit open', { code: 'CIRCUIT_OPEN', retryable: true }) };
  }

  let attempt = 0;
  let lastError: AppError | undefined;

  while (attempt <= (retryCfg.retries ?? 0)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) {
        const status = res.status;
        let bodyText = '';
        try {
          bodyText = await res.text();
        } catch {}

        if (status === 400) {
          return { ok: false, status, error: new ValidationError('Bad Request', { status, cause: bodyText }) };
        }
        if (status === 401) {
          return { ok: false, status, error: new AppError('Unauthorized', { status, code: 'UNAUTHORIZED' }) };
        }

        if (isRetryableStatus(status) && attempt < (retryCfg.retries ?? 0)) {
          const backoff = Math.min((retryCfg.minTimeoutMs ?? 300) * Math.pow(retryCfg.factor ?? 2, attempt), retryCfg.maxTimeoutMs ?? 5000);
          await delay(backoff);
          attempt++;
          continue;
        }

        return { ok: false, status, error: new AppError(`HTTP ${status}`, { status, cause: bodyText, retryable: isRetryableStatus(status) }) };
      }

      let data: T | undefined = undefined;
      if (parseJson) {
        try {
          data = (await res.json()) as T;
        } catch {
          // Non-JSON body
        }
      }

      state.failures = 0;
      state.openedAt = undefined;
      return { ok: true, status: res.status, data };
    } catch (e: unknown) {
      clearTimeout(timer);
      // Check for abort error in a React Native compatible way
      const isAbort = (e as any)?.name === 'AbortError' || 
                     (e as any)?.message?.includes('aborted') ||
                     (e as any)?.message?.includes('cancelled');
      const err = isAbort ? new TimeoutError('Request timed out', { cause: e }) : new NetworkError('Network request failed', { cause: e });
      lastError = err;

      state.failures += 1;
      if (state.failures >= FAILURE_THRESHOLD) {
        state.openedAt = Date.now();
      }

      if (attempt < (retryCfg.retries ?? 0)) {
        const backoff = Math.min((retryCfg.minTimeoutMs ?? 300) * Math.pow(retryCfg.factor ?? 2, attempt), retryCfg.maxTimeoutMs ?? 5000);
        await delay(backoff);
        attempt++;
        continue;
      }

      return { ok: false, status: 0, error: err };
    }
  }

  return { ok: false, status: 0, error: lastError ?? new AppError('Unknown error') };
}
