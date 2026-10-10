export const ZERO_ONLY_COPY = '错题本只保留整次答错的练习。'

export function entersMistakeBook(scoreBucket: string | null | undefined): boolean {
  return (scoreBucket ?? '').toUpperCase() === 'ZERO'
}

export const PASSED_COPY = '本次补救已通过'
export const NO_VARIANT_COPY = '这次没有可用的变式题，不会用原题冒充。'

export function closureLabel(status: string | null | undefined, closureCopy?: string | null): string {
  const copy = closureCopy?.trim()
  if (copy) return copy
  if ((status ?? '').toUpperCase() === 'MASTERED') return PASSED_COPY
  return status ?? ''
}
