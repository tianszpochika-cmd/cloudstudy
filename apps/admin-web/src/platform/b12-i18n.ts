import { ref } from 'vue'
import { adminI18n } from './v2-foundation'

const zh = {
  recovery: '恢复台',
  refresh: '刷新',
  loadMore: '加载更多',
  retryMore: '重试加载',
  moreError: '后续举报未加载，当前列表不完整。',
  emptyReports: '暂无待处理举报。',
  permission: '无权查看举报记录。',
  error: '举报记录暂不可用，请重试。',
  reportId: '举报编号',
  status: '处理状态',
  target: '脱敏对象',
  room: '脱敏房间',
  reason: '举报原因',
  mode: '审核方式',
  created: '提交时间',
  statusReceived: '待受理',
  statusTriaged: '审核中',
  statusActioned: '已采取措施',
  statusRejected: '未采纳',
  statusAppealed: '申诉中',
  statusClosed: '已结案',
  statusSubmitted: '已提交',
  statusInReview: '审核中',
  statusResolved: '已解决',
  statusDismissed: '未采纳',
  statusOpen: '待处理',
  statusReviewing: '审核中',
  statusUnknown: '状态待确认',
  reasonSpam: '垃圾内容',
  reasonHarassment: '骚扰',
  reasonSensitiveContent: '不当内容',
  reasonImpersonation: '冒充他人',
  reasonOther: '其他',
  reasonInappropriateBehavior: '不当行为',
  reasonSafety: '安全问题',
  reasonPresetAbuse: '互动滥用',
  reasonUnsafeBehavior: '危险行为',
  reasonUnknown: '原因待确认',
  modeManual: '人工审核',
  modeUnknown: '方式待确认',
}
const en = {
  recovery: 'Recovery workspace',
  refresh: 'Refresh',
  loadMore: 'Load more',
  retryMore: 'Retry loading',
  moreError: 'More reports could not be loaded. This list is incomplete.',
  emptyReports: 'No open reports.',
  permission: 'You cannot view moderation reports.',
  error: 'Reports are unavailable. Please retry.',
  reportId: 'Report ID',
  status: 'Status',
  target: 'Redacted target',
  room: 'Redacted room',
  reason: 'Report reason',
  mode: 'Review type',
  created: 'Submitted',
  statusReceived: 'Awaiting review',
  statusTriaged: 'In review',
  statusActioned: 'Action taken',
  statusRejected: 'Not upheld',
  statusAppealed: 'Under appeal',
  statusClosed: 'Closed',
  statusSubmitted: 'Submitted',
  statusInReview: 'In review',
  statusResolved: 'Resolved',
  statusDismissed: 'Not upheld',
  statusOpen: 'Open',
  statusReviewing: 'In review',
  statusUnknown: 'Status unconfirmed',
  reasonSpam: 'Spam',
  reasonHarassment: 'Harassment',
  reasonSensitiveContent: 'Inappropriate content',
  reasonImpersonation: 'Impersonation',
  reasonOther: 'Other',
  reasonInappropriateBehavior: 'Inappropriate behavior',
  reasonSafety: 'Safety concern',
  reasonPresetAbuse: 'Interaction misuse',
  reasonUnsafeBehavior: 'Unsafe behavior',
  reasonUnknown: 'Reason unconfirmed',
  modeManual: 'Human review',
  modeUnknown: 'Review type unconfirmed',
}

const statusKeys: Readonly<Record<string, string>> = {
  RECEIVED: 'statusReceived', TRIAGED: 'statusTriaged', ACTIONED: 'statusActioned',
  REJECTED: 'statusRejected', APPEALED: 'statusAppealed', CLOSED: 'statusClosed',
  SUBMITTED: 'statusSubmitted', IN_REVIEW: 'statusInReview', RESOLVED: 'statusResolved',
  DISMISSED: 'statusDismissed', OPEN: 'statusOpen', REVIEWING: 'statusReviewing',
}
const reasonKeys: Readonly<Record<string, string>> = {
  SPAM: 'reasonSpam', HARASSMENT: 'reasonHarassment',
  SENSITIVE_CONTENT: 'reasonSensitiveContent', IMPERSONATION: 'reasonImpersonation',
  OTHER: 'reasonOther', INAPPROPRIATE_BEHAVIOR: 'reasonInappropriateBehavior',
  SAFETY: 'reasonSafety', PRESET_ABUSE: 'reasonPresetAbuse',
  UNSAFE_BEHAVIOR: 'reasonUnsafeBehavior',
}
const modeKeys: Readonly<Record<string, string>> = { MANUAL: 'modeManual' }

function labelFor(value: unknown, keys: Readonly<Record<string, string>>, fallback: string): string {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return b12T(Object.hasOwn(keys, code) ? keys[code] : fallback)
}

adminI18n.registerMessages('zh-CN', { b12: zh })
adminI18n.registerMessages('en-US', { b12: en })
export const b12UiLocale = ref(adminI18n.locale)
adminI18n.subscribe((state) => { b12UiLocale.value = state.locale })
export function b12T(key: string, values?: Record<string, unknown>): string { b12UiLocale.value; return adminI18n.t(`b12.${key}`, values) }
export function b12StatusLabel(value: unknown): string { return labelFor(value, statusKeys, 'statusUnknown') }
export function b12ReasonLabel(value: unknown): string { return labelFor(value, reasonKeys, 'reasonUnknown') }
export function b12ModeLabel(value: unknown): string { return labelFor(value, modeKeys, 'modeUnknown') }
