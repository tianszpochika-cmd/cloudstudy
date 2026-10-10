/** Phase 1 keeps listening, speaking and writing off the main path. */
export const CLOSED_NAV = ['listening', 'speaking', 'writing'] as const

export function closedPracticeCopy(kind: 'listening' | 'speaking' | 'writing'): string {
  if (kind === 'listening') return '听力功能暂未开放，可以先做其他练习'
  if (kind === 'speaking') return '跟读功能暂未开放，可以先做其他练习'
  return '写作功能暂未开放，可以先做其他练习'
}

/** A vocabulary card can play only when the server returned a real audio address. */
export function vocabPlayable(audioUrl: string | null | undefined): boolean {
  return typeof audioUrl === 'string' && audioUrl.trim().length > 0
}
