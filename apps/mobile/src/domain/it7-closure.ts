export interface ClosurePrivacy {
  exportState?: string
  allComplete?: boolean
  dataDeleted?: boolean
  audioPolicyApproved?: boolean
  retentionDays?: number | null
  longTermCapture?: boolean
  workerGap?: boolean
  logoutCanRelogin?: boolean
  deletionPromptsRelogin?: boolean
  audioCopy?: string
  deletionCopy?: string
  sessionCopy?: string
}

export interface ClosureBoard {
  ticketCopy?: string
  supportNumber?: string
  auditVisible?: boolean
  auditSharedWithLearner?: boolean
  privacy?: ClosurePrivacy
}

export function ticketNotice(board: ClosureBoard | null): string {
  return board?.ticketCopy || '受控正文尚未批准。这里不能提交一份客服能够理解并闭环处理的工单。只有摘要的记录会标成信息不足。'
}

export function supportNotice(board: ClosureBoard | null): string {
  return board?.supportNumber ? `支持编号 ${board.supportNumber}` : ''
}

export function privacyNotices(board: ClosureBoard | null): string[] {
  const privacy = board?.privacy
  return [
    privacy?.deletionCopy || '删除申请受理后，访问停止和各服务处理完成要分开看。受理不等于数据已经删除。',
    privacy?.audioCopy || '音频保留策略尚未批准，不会采集长期原始录音，也不填写保留天数。',
    privacy?.sessionCopy || '普通退出后可以重新登录。删除申请受理后不会提示登录继续学习。',
    privacy?.workerGap === false ? '' : '跨服务导出和删除还没有全部完成。',
    privacy?.allComplete === true ? '' : '当前没有全部完成的处理结果。',
  ].filter((line) => line.length > 0)
}

export function showsAuditToLearner(board: ClosureBoard | null): boolean {
  return board?.auditVisible === true || board?.auditSharedWithLearner === true
}
