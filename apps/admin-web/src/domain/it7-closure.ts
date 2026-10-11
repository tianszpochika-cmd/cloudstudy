export interface ClosureBoard {
  lockCopy?: string
  writeSwitch?: string
  dispositionOpen?: boolean
  casesState?: string
  independentRiskRoute?: boolean
  riskRedirect?: string
  dispositionButtons?: boolean
  reportsReadOnly?: boolean
  auditVisible?: boolean
  auditSharedWithLearner?: boolean
  exportAllowed?: boolean
  supportNumber?: string
  observation?: { productionReady?: boolean; anySchemaRollback?: boolean; secretsLogged?: boolean }
}

export function governanceNotice(board: ClosureBoard | null): string {
  if (board?.casesState === 'FORBIDDEN') return '没有查看治理区的权限。'
  if (board?.casesState === 'NO_CASES') return '治理区还没有案件。空列表不是拒绝访问。'
  if (board?.casesState === 'HAS_CASES') return '这里显示的是有来源的档案。处置写链没有打开。'
  return board?.lockCopy || '写入开关未开启。可以查看锁定理由、影响和恢复条件，这次不会锁定账号或内容。'
}

export function legacyDispositionRefusal(board: ClosureBoard | null): string {
  if (board?.dispositionOpen === true) return ''
  return '处置写链没有打开。旧的风险处置写入口已关闭，和收口区一致。'
}

export function routeNotice(board: ClosureBoard | null): string {
  if (board?.independentRiskRoute === false) return '没有独立的风险页。/risk 会回到治理页，权限检查仍然有效。'
  return '没有独立的风险页。/risk 会回到治理页，权限检查仍然有效。'
}

export function auditNotice(board: ClosureBoard | null): string {
  const ready = board?.observation?.productionReady === true ? '已可生产发布' : '没有发布证据，不能标成已可生产发布。'
  const rollback = board?.observation?.anySchemaRollback === true ? '任意库变更可回滚' : '不能承诺任意数据库变更都可以直接回滚。'
  const share = board?.auditSharedWithLearner === true ? '会分享给学习端' : '内部审计不提供给学习端。'
  const exportCopy = board?.exportAllowed === true ? '当前身份可以发起内部导出检查。' : '导出需要单独的内部权限。'
  return [ready, rollback, share, exportCopy].join('')
}
