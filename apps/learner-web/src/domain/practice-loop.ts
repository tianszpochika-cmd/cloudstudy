/** Saved confirmation is shown before the words and the next question. */
export interface PracticeFeedbackView {
  savedReceipt: string
  feedbackText: string
  nextQuestion: string
}

export function practiceFeedback(input: {
  scoreBucket?: string | null
  correct?: boolean | null
  savedReceipt?: string | null
  feedbackText?: string | null
  nextQuestion?: string | null
  received?: number | null
  total?: number | null
} | null | undefined): PracticeFeedbackView | null {
  if (!input) return null
  const bucket = (input.scoreBucket ?? '').toUpperCase()
  const correct = input.correct === true || bucket === 'FULL'
  const known = input.correct != null || bucket === 'FULL' || bucket === 'ZERO' || bucket === 'PARTIAL'
    || Boolean(input.feedbackText) || Boolean(input.savedReceipt)
  if (!known) return null
  const total = typeof input.total === 'number' && input.total > 0 ? input.total : 1
  const received = typeof input.received === 'number' ? Math.max(0, Math.min(input.received, total)) : total
  return {
    savedReceipt: input.savedReceipt?.trim() || '已保存',
    feedbackText: input.feedbackText?.trim() || (correct ? '正确' : '需要再练'),
    nextQuestion: input.nextQuestion?.trim() || (received >= total ? '本次练习已完成' : `下一题：第 ${received + 1} 题`),
  }
}

export const OFFLINE_EXIT = '内容已下线，已停止加载。可以回到可用学习。'

export interface ResumeView {
  index: number
  copy: string
  stopped: boolean
}

/** Stay on the last question the server has accepted. Offline content does not load. */
export function resumeView(input: {
  received?: number | null
  resumeIndex?: number | null
  resumeCopy?: string | null
  contentOffline?: boolean | null
  exitCopy?: string | null
} | null | undefined): ResumeView {
  if (input?.contentOffline) {
    return { index: 0, copy: input.exitCopy?.trim() || OFFLINE_EXIT, stopped: true }
  }
  const index = input?.resumeIndex && input.resumeIndex > 0
    ? input.resumeIndex
    : Math.max(1, input?.received ?? 0)
  return { index, copy: input?.resumeCopy?.trim() || `上次学到第 ${index} 题，继续`, stopped: false }
}

export const ILLEGAL_ACTION = '这个操作现在不能用'

/** The rule version is the one stored when the session opened. */
export function pinnedRuleVersion(contentCode: string, contentVersionId: number): string {
  const code = contentCode.trim() || 'content'
  return `${code}:v${Math.max(0, contentVersionId)}`
}

/** A second click while the first submit is still running does not start another one. */
export function acceptSubmission(inFlight: boolean): boolean {
  return !inFlight
}
