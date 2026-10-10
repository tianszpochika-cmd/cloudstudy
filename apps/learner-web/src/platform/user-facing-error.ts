/** Keep transport and internal error codes out of learner-facing messages. */
export function userFacingError(message: string | null | undefined, fallback: string): string {
  const value = message?.trim()
  if (!value) return fallback
  if (value.includes('UNTRUSTED_REVIEW_EVIDENCE')) return '这个操作现在不能用'
  if (!/[\u3400-\u9fff]/u.test(value)
    || /Failed to fetch|NetworkError|Load failed|HTTP\s*\d{3}|\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/i.test(value)) return fallback
  return value.slice(0, 160)
}
