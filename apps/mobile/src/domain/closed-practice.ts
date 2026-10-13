/** Phase 1 keeps listening, speaking and writing off the main path. */
export const CLOSED_NAV = ['listening', 'speaking', 'writing'] as const

export function closedPracticeCopy(kind: 'listening' | 'speaking' | 'writing'): string {
  if (kind === 'listening') return '听力练习即将开放：音频素材尚未上传到媒体库，播放地址无法签发；素材上线后即可在这里播放并听写'
  if (kind === 'speaking') return '跟读练习即将开放：跟读需要录音上传和发音评分服务，目前尚未接入，无法给出真实评分'
  return '写作练习即将开放：作文批改服务尚未接入，现在提交只能得到占位分数，不能作为真实反馈'
}

/** A vocabulary card can play only when the server returned a real audio address. */
export function vocabPlayable(audioUrl: string | null | undefined): boolean {
  return typeof audioUrl === 'string' && audioUrl.trim().length > 0
}
