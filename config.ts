const env: Record<string, string | undefined> =
  typeof process !== 'undefined' && process?.env ? process.env : {};

const ensureString = (value?: string | null) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const port = ensureString(env.PORT) ?? '3000';

const rawApiUrl =
  ensureString(env.API_URL) ??
  ensureString(env.NEXT_PUBLIC_API_URL) ??
  ensureString(env.EXPO_PUBLIC_API_URL) ??
  ensureString(env.EXPO_PUBLIC_RORK_API_BASE_URL);

const sanitizedBase = (rawApiUrl ?? `http://localhost:${port}`).replace(/\/+$/, '');

export const config = {
  API_URL: sanitizedBase,
} as const;

export const API_URL = config.API_URL;

export default config;
const env = (typeof process !== 'undefined' && process?.env) ? process.env : ({} as Record<string, string | undefined>);

const ensureString = (value?: string | null) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const port = ensureString(env.PORT) ?? '3000';

const rawApiUrl =
  ensureString(env.API_URL) ??
  ensureString(env.NEXT_PUBLIC_API_URL) ??
  ensureString(env.EXPO_PUBLIC_API_URL) ??
  ensureString(env.EXPO_PUBLIC_RORK_API_BASE_URL);

const sanitizedBase = (rawApiUrl ?? `http://localhost:${port}`).replace(/\/+$/, '');

export const config = {
  API_URL: sanitizedBase,
} as const;

export const API_URL = config.API_URL;

export default config;

