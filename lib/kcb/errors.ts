export class KcbError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: unknown

  constructor(message: string, code: string, status = 400, details?: unknown) {
    super(message)
    this.name = 'KcbError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export class KcbConfigError extends KcbError {
  constructor(message: string) {
    super(message, 'KCB_CONFIG', 500)
    this.name = 'KcbConfigError'
  }
}

export class KcbAuthError extends KcbError {
  constructor(message: string, details?: unknown) {
    super(message, 'KCB_AUTH', 401, details)
    this.name = 'KcbAuthError'
  }
}

export class KcbValidationError extends KcbError {
  constructor(message: string, details?: unknown) {
    super(message, 'KCB_VALIDATION', 400, details)
    this.name = 'KcbValidationError'
  }
}

export class KcbApiError extends KcbError {
  constructor(message: string, status = 502, details?: unknown) {
    super(message, 'KCB_API', status, details)
    this.name = 'KcbApiError'
  }
}

export function toPublicError(err: unknown): { error: string; code: string; status: number } {
  if (err instanceof KcbError) {
    return { error: err.message, code: err.code, status: err.status }
  }
  return { error: 'Unexpected payment error', code: 'INTERNAL', status: 500 }
}
