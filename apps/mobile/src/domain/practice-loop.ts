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
