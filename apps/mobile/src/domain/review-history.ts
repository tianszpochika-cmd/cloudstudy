export const NO_DUE_COPY = '暂无到期复习'
export const NO_RECORD_COPY = '还没有复习记录'
export const READ_FAILED_COPY = '复习列表暂时没有读出来'

export function reviewEmpty(readFailed: boolean, queueEmpty: boolean, hasRecord: boolean): { status: string; copy: string } {
  if (readFailed) return { status: 'READ_FAILED', copy: READ_FAILED_COPY }
  if (!queueEmpty) return { status: 'READY', copy: '' }
  if (!hasRecord) return { status: 'NO_RECORD', copy: NO_RECORD_COPY }
  return { status: 'NO_DUE', copy: NO_DUE_COPY }
}

export function visibleHistory<T extends { disposition?: string | null }>(rows: T[]): T[] {
  return rows.filter((row) => row.disposition === 'COMPLETED' || row.disposition === 'DEFERRED')
}
