export const UNTRUSTED_REVIEW = 'UNTRUSTED_REVIEW_EVIDENCE'
export const ILLEGAL_REVIEW = '这个操作现在不能用'

export function reviewFailureCopy(message: string | null | undefined): string {
  const value = message ?? ''
  if (value.includes(UNTRUSTED_REVIEW) || value === ILLEGAL_REVIEW) return ILLEGAL_REVIEW
  return ''
}

export function stageAfter(currentStage: string, requestedStage: string, sameCompletionKey: boolean): string {
  if (sameCompletionKey || !requestedStage) return currentStage
  return requestedStage
}
