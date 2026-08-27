import { createI18n } from '@englishflow/i18n'
import { createElementPlusI18nAdapter } from '@englishflow/i18n/adapters'
import { createThemeController } from '@englishflow/design-tokens'
import { createElementPlusThemeAdapter } from '@englishflow/design-tokens/adapters'

const browserStorage = typeof localStorage === 'undefined' ? undefined : localStorage
const root = typeof document === 'undefined' ? undefined : document.documentElement

export const adminI18n = createI18n({
  locale: 'zh-CN',
  contentLocale: 'en-US',
  messages: {
    'zh-CN': {
      common: { loading: '加载中', retry: '重试', state: { loading: '正在加载', empty: '暂无可用数据', error: '暂时无法完成', permission: '当前没有访问权限', recovery: '正在恢复安全快照', offline: '当前处于离线状态', success: '已完成', partial: '部分内容可用' } },
      auth: {
        login: { title: '教研与运营中台', description: '管理员登录通过 Gateway 的标准身份入口完成。客户端不选择、不持久化角色。', start: '通过身份服务登录', pending: '真实 IdP 尚未获批，当前仅保留可替换登录 seam。', noSuccess: '未收到有效回调，因此不会伪造管理员会话。' },
        callback: { title: '正在恢复管理员会话', restoring: '正在校验身份回调和服务端权限…', failed: '管理员认证回调未完成。' },
        session: { restored: '服务端会话已恢复', restoring: '正在恢复会话…', permissionSnapshot: '服务端权限 {{count}} 项', expired: '管理员会话已失效，请重新登录。', logout: '退出管理员会话', logoutFailed: '撤销服务暂时不可用，已清除本地会话。' },
        forbidden: { title: '无权访问此后台功能', description: '菜单和页面权限只来自服务端 permissions；客户端不会使用 role、tenant、owner 或伪造请求头越权。', reason: '服务端策略拒绝了当前后台功能，原因：{{reason}}。', requested: '需要的服务端权限：{{permission}}', permissionCount: '当前服务端权限快照包含 {{count}} 项，但未授予本功能。', fallbackReason: '未授予所需权限', login: '返回登录', retry: '重新读取权限' },
        error: { generic: '认证状态暂时无法确定。' },
      },
    },
    'en-US': {
      common: { loading: 'Loading', retry: 'Retry', state: { loading: 'Loading', empty: 'Nothing is available', error: 'Unable to complete right now', permission: 'Access is not allowed', recovery: 'Recovering the safe snapshot', offline: 'You are offline', success: 'Completed', partial: 'Partially available' } },
      auth: {
        login: { title: 'Operations control plane', description: 'Administrator sign-in uses the standard identity entry through Gateway. Roles are not selected or persisted by the client.', start: 'Continue with identity provider', pending: 'The real IdP is not approved; only a replaceable login seam is available.', noSuccess: 'No valid callback was received, so no admin session was fabricated.' },
        callback: { title: 'Restoring administrator session', restoring: 'Validating identity callback and server permissions…', failed: 'The administrator callback did not complete.' },
        session: { restored: 'Server session restored', restoring: 'Restoring session…', permissionSnapshot: '{{count}} server permissions', expired: 'The administrator session expired. Please sign in again.', logout: 'Sign out administrator session', logoutFailed: 'Revocation is unavailable; the local session was cleared.' },
        forbidden: { title: 'This admin feature is not allowed', description: 'Menus and pages use only server-returned permissions; client role, tenant, owner, and forged headers cannot bypass policy.', reason: 'The server policy denied this admin capability. Reason: {{reason}}.', requested: 'Required server permission: {{permission}}', permissionCount: 'The server permission snapshot contains {{count}} entries, but it does not grant this capability.', fallbackReason: 'Required permission was not granted', login: 'Return to sign in', retry: 'Reload permissions' },
        error: { generic: 'Authentication status could not be determined.' },
      },
    },
  },
})
export const adminI18nAdapter = createElementPlusI18nAdapter(adminI18n, { localeStorage: browserStorage })
export const adminThemeController = createThemeController({ storage: browserStorage })
export const adminThemeAdapter = createElementPlusThemeAdapter(adminThemeController, root)
