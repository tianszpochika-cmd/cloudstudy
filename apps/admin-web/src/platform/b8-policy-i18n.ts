import { ref } from 'vue'
import { adminI18n } from './v2-foundation'

const zh = {
  refresh: '刷新',
  loadMore: '加载更多',
  note: '只读查看 IAM 策略版本。',
  empty: '暂无策略版本。',
  permission: '当前账号没有策略读取权限。',
  error: '策略版本暂不可用，请重试。',
  moreError: '后续版本加载失败，请重试。',
  version: '版本',
  updated: '更新于',
  bindings: '角色绑定',
  rules: '规则',
  review: '双人审批',
  approved: '已满足',
  pending: '待完成',
  details: '查看绑定与规则',
  role: '角色',
  permissions: '权限',
  action: '动作',
  resource: '资源',
  conditions: '条件',
  allow: '允许',
  deny: '拒绝',
  noRules: '无可展示的规则。',
  noBindings: '无可展示的角色绑定。',
  unknownDate: '时间待确认',
  phase: '阶段',
  adult: '成年资格',
  deviceTrust: '设备可信度',
  deviceTrustUnset: '未设置',
  rights: '内容权利',
  ownerMatch: '资源所有者匹配',
  tenantMatch: '租户匹配',
  status: {
    DRAFT: '草稿', SUBMITTED: '待审批', APPROVED: '已审批', ACTIVE: '生效中', REVOKED: '已撤销',
  },
}
const en = {
  refresh: 'Refresh',
  loadMore: 'Load more',
  note: 'Read-only IAM policy versions.',
  empty: 'No policy versions.',
  permission: 'This account cannot read policies.',
  error: 'Policy versions are unavailable. Retry.',
  moreError: 'More versions could not be loaded. Retry.',
  version: 'Version',
  updated: 'Updated',
  bindings: 'Role bindings',
  rules: 'Rules',
  review: 'Independent approval',
  approved: 'Satisfied',
  pending: 'Pending',
  details: 'View bindings and rules',
  role: 'Role',
  permissions: 'Permissions',
  action: 'Actions',
  resource: 'Resources',
  conditions: 'Conditions',
  allow: 'Allow',
  deny: 'Deny',
  noRules: 'No rules to show.',
  noBindings: 'No role bindings to show.',
  unknownDate: 'Time unavailable',
  phase: 'Phase',
  adult: 'Adult eligibility',
  deviceTrust: 'Device trust',
  deviceTrustUnset: 'Unset',
  rights: 'Content rights',
  ownerMatch: 'Resource owner match',
  tenantMatch: 'Tenant match',
  status: {
    DRAFT: 'Draft', SUBMITTED: 'Submitted', APPROVED: 'Approved', ACTIVE: 'Active', REVOKED: 'Revoked',
  },
}

adminI18n.registerMessages('zh-CN', { b8Policy: zh })
adminI18n.registerMessages('en-US', { b8Policy: en })
const locale = ref(adminI18n.locale)
adminI18n.subscribe((state) => { locale.value = state.locale })
export function b8PolicyT(key: string): string {
  locale.value
  return adminI18n.t(`b8Policy.${key}`)
}
