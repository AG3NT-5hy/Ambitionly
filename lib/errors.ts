export type ErrorSeverity = 'info' | 'warn' | 'error' | 'critical';

export interface BaseErrorOptions {
  code?: string;
  cause?: unknown;
  status?: number;
  retryable?: boolean;
  severity?: ErrorSeverity;
}

export class AppError extends Error {
  code: string;
  cause?: unknown;
  status?: number;
  retryable: boolean;
  severity: ErrorSeverity;

  constructor(message: string, options: BaseErrorOptions = {}) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = new.target.name;
    this.code = options.code ?? 'APP_ERROR';
    this.cause = options.cause;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.severity = options.severity ?? 'error';
  }
}

export class NetworkError extends AppError {
  constructor(message = 'Network error', options: BaseErrorOptions = {}) {
    super(message, { code: options.code ?? 'NETWORK_ERROR', retryable: true, severity: 'warn', ...options });
  }
}

export class TimeoutError extends AppError {
  constructor(message = 'Request timed out', options: BaseErrorOptions = {}) {
    super(message, { code: options.code ?? 'TIMEOUT', retryable: true, severity: 'warn', ...options });
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authentication required', options: BaseErrorOptions = {}) {
    super(message, { code: options.code ?? 'AUTH_ERROR', status: 401, retryable: false, severity: 'error', ...options });
  }
}

export class PurchaseError extends AppError {
  constructor(message = 'Purchase failed', options: BaseErrorOptions = {}) {
    super(message, { code: options.code ?? 'PURCHASE_ERROR', retryable: false, severity: 'error', ...options });
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', options: BaseErrorOptions = {}) {
    super(message, { code: options.code ?? 'VALIDATION_ERROR', retryable: false, severity: 'info', ...options });
  }
}

export function isRetryableStatus(status: number | undefined): boolean {
  if (!status) return false;
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}
