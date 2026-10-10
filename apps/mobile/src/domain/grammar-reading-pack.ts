export const CLOSED_MISSING = 'CLOSED_MISSING'
export const PACK_CLOSED_COPY = '这组题还没备齐，本次练习已关闭。'

export function packNotice(kind: 'GRAMMAR' | 'READING', itemCount: number, signal?: string | null): string | null {
  if (typeof signal === 'string' && (mentionsClosedMissing(signal) || signal.includes('这组题还没备齐'))) return PACK_CLOSED_COPY
  if (!Number.isInteger(itemCount) || itemCount < 1) return null
  const label = kind === 'GRAMMAR' ? '语法' : '阅读'
  return `本次${label}练习 ${itemCount} 道`
}

export function mentionsClosedMissing(value: unknown): boolean {
  const parts: string[] = []
  const visit = (entry: unknown, depth: number): void => {
    if (depth > 4 || entry == null) return
    if (typeof entry === 'string') {
      parts.push(entry)
      return
    }
    if (typeof entry !== 'object') return
    if (entry instanceof Error) parts.push(entry.message)
    for (const nested of Object.values(entry as Record<string, unknown>)) visit(nested, depth + 1)
  }
  visit(value, 0)
  return parts.join('\n').toUpperCase().includes(CLOSED_MISSING)
}
