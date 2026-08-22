import { ref } from 'vue'
import { adminI18n } from './v2-foundation'

const zh = {
  title: '社群治理与恢复',
  description: '只展示服务端脱敏投影；命令由当前管理员权限决定，actor、tenant 与 role 不从页面输入。',
  moderation: '举报审核', recovery: '恢复任务', refresh: '刷新', loading: '正在读取服务端投影…', emptyReports: '暂无待处理举报投影。', emptyRecovery: '暂无待处理恢复任务。', permission: '当前会话没有访问这项治理能力的权限。', error: '服务端投影暂时不可用。', retry: '重试', success: '命令已由服务端确认。', recoveryState: '服务端要求先恢复或人工处理，客户端不自行改写事实。', target: '脱敏对象引用', room: '房间引用', reason: '原因枚举', mode: '审核模式', created: '创建时间', domain: '领域', updated: '更新时间', retryable: '可重试', command: '服务端命令', startReview: '开始审核', resolve: '解决', dismiss: '驳回', escalate: '升级人工处理', cancel: '取消任务', retryCommand: '请求重试', requeue: '重新入队', markResolved: '标记已解决', noCommandPermission: '当前会话没有命令权限', auditNotice: '所有命令都带幂等键；结果只在服务端返回后显示。', contractSeam: 'B12 admin API seam：通过 Gateway 接入服务端治理/恢复契约。', requestId: '关联号',
}
const en = {
  title: 'Community governance & recovery',
  description: 'Only server-side redacted projections are shown. Commands use current administrator permissions; actor, tenant, and role are never entered here.',
  moderation: 'Moderation reports', recovery: 'Recovery tasks', refresh: 'Refresh', loading: 'Loading server projections…', emptyReports: 'No open moderation projections.', emptyRecovery: 'No pending recovery tasks.', permission: 'This session cannot access this governance capability.', error: 'The server projection is temporarily unavailable.', retry: 'Retry', success: 'The command was confirmed by the server.', recoveryState: 'The server requires recovery or human handling; the client does not rewrite facts.', target: 'Redacted target reference', room: 'Room reference', reason: 'Reason code', mode: 'Review mode', created: 'Created', domain: 'Domain', updated: 'Updated', retryable: 'Retryable', command: 'Server command', startReview: 'Start review', resolve: 'Resolve', dismiss: 'Dismiss', escalate: 'Escalate', cancel: 'Cancel task', retryCommand: 'Request retry', requeue: 'Requeue', markResolved: 'Mark resolved', noCommandPermission: 'This session has no command permission', auditNotice: 'Every command carries an idempotency key; results appear only after server confirmation.', contractSeam: 'B12 admin API seam: routed through the server governance and recovery contract.', requestId: 'Correlation ID',
}

adminI18n.registerMessages('zh-CN', { b12: zh })
adminI18n.registerMessages('en-US', { b12: en })
export const b12UiLocale = ref(adminI18n.locale)
adminI18n.subscribe((state) => { b12UiLocale.value = state.locale })
export function b12T(key: string, values?: Record<string, unknown>): string { b12UiLocale.value; return adminI18n.t(`b12.${key}`, values) }
