export const ZERO_ONLY_COPY = '错题本只保留整次答错的练习。'

export function entersMistakeBook(scoreBucket: string | null | undefined): boolean {
  return (scoreBucket ?? '').toUpperCase() === 'ZERO'
}
