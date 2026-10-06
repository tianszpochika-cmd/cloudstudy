/** A withheld operation has no transport call or successful fallback. */
export class UnavailableOperationError extends Error {
  readonly code = 'FEATURE_UNAVAILABLE'
  readonly retryable = false
  constructor(message: string) {
    super(message)
    this.name = 'UnavailableOperationError'
  }
}

export function rejectUnavailableOperation<TResponse = never>(message: string): Promise<TResponse> {
  return Promise.reject(new UnavailableOperationError(message))
}
