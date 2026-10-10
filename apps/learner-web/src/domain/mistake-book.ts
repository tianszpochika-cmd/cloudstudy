export const ZERO_ONLY_COPY = '错题本只保留整次答错的练习。'

export function entersMistakeBook(scoreBucket: string | null | undefined): boolean {
  return (scoreBucket ?? '').toUpperCase() === 'ZERO'
}

export const PASSED_COPY = '本次补救已通过'
export const NO_VARIANT_COPY = '这次没有可用的变式题，不会用原题冒充。'

export const WEAKNESS_UNKNOWN = 'WEAKNESS_UNKNOWN'
export const WEAKNESS_UNKNOWN_COPY = '尚不能判断'
export const ILLEGAL_STAGE = '这个操作现在不能用'

export function weaknessView(evidenceCount: number): { status: string; copy: string } {
  if (evidenceCount > 0) return { status: 'EVIDENCE', copy: '' }
  return { status: WEAKNESS_UNKNOWN, copy: WEAKNESS_UNKNOWN_COPY }
}

export const PROJECTION_VERSION = 'IT4-MISTAKE-1'
export const NOT_PRACTICED_COPY = '还没有开始练习'
export const ALL_CORRECT_COPY = '这次练习都答对了'
export const READ_FAILED_COPY = '错题本暂时没有读出来'

export function emptyBook(attemptCount: number, mistakeCount: number, readFailed = false): { status: string; copy: string; projectionVersion: string } {
  if (readFailed) return { status: 'READ_FAILED', copy: READ_FAILED_COPY, projectionVersion: PROJECTION_VERSION }
  if (mistakeCount > 0) return { status: 'HAS_ITEMS', copy: '', projectionVersion: PROJECTION_VERSION }
  if (attemptCount <= 0) return { status: 'NOT_PRACTICED', copy: NOT_PRACTICED_COPY, projectionVersion: PROJECTION_VERSION }
  return { status: 'ALL_CORRECT', copy: ALL_CORRECT_COPY, projectionVersion: PROJECTION_VERSION }
}

export function sameRemediation(left: string | number | null | undefined, right: string | number | null | undefined): boolean {
  const first = left == null ? '' : String(left)
  return first !== '' && first === String(right ?? '')
}

export function mergeDelayTargets<T extends { mistakeId?: string | number | null }>(items: T[]): T[] {
  const seen = new Set<string>()
  const merged: T[] = []
  for (const item of items) {
    const key = item.mistakeId == null ? '' : String(item.mistakeId)
    if (!key) {
      merged.push(item)
      continue
    }
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(item)
  }
  return merged
}

export function closureLabel(status: string | null | undefined, closureCopy?: string | null): string {
  const copy = closureCopy?.trim()
  if (copy) return copy
  if ((status ?? '').toUpperCase() === 'MASTERED') return PASSED_COPY
  return status ?? ''
}
