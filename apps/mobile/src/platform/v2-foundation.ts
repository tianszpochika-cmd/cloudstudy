import { createI18n } from '@englishflow/i18n'
import { createUniAppI18nAdapter, type LocaleStorage } from '@englishflow/i18n/adapters'
import { createThemeController } from '@englishflow/design-tokens'
import { createUniAppThemeAdapter } from '@englishflow/design-tokens/adapters'

type UniStorageRuntime = { getStorageSync?(key: string): unknown; setStorageSync?(key: string, value: string): void }
const uniRuntime = (globalThis as typeof globalThis & { uni?: UniStorageRuntime }).uni
const storage: LocaleStorage | undefined = uniRuntime
  ? {
      getItem: (key) => {
        const value = uniRuntime.getStorageSync?.(key)
        return value === undefined || value === null ? null : String(value)
      },
      setItem: (key, value) => uniRuntime.setStorageSync?.(key, value),
    }
  : undefined

export const mobileI18n = createI18n({
  locale: 'zh-CN',
  contentLocale: 'en-US',
  messages: {
    'zh-CN': {
      common: { state: { loading: '正在加载', empty: '暂无可用数据', error: '暂时无法完成', permission: '当前没有访问权限', recovery: '正在恢复安全快照', offline: '当前处于离线状态', success: '已完成', partial: '部分内容可用' } },
      auth: {
        login: { title: '登录学习空间', description: '登录通过 Gateway 的受控身份深链完成，不在普通存储中保存 refresh token。', start: '打开身份服务', pending: '真实 IdP 尚未获批，当前只提供可替换登录入口。', noSuccess: '没有收到有效回调，因此不会伪造登录成功。' },
        callback: { title: '正在恢复移动会话', restoring: '正在校验深链回调并恢复安全会话…', failed: '移动认证回调未完成。' },
        session: { restored: '会话已恢复', restoring: '正在恢复会话…', logout: '退出登录', logoutFailed: '撤销服务暂时不可用，已清除本地会话。' },
        forbidden: { title: '暂时没有访问权限', description: '访问权限由服务端策略决定，客户端不会使用角色、租户或 owner 字段绕过限制。', login: '返回登录', empty: '服务端尚未返回权限快照。' },
        adult: { title: '成人用户 Gate', description: 'Phase 1 仅面向成年用户与大学生；同意事实由服务端记录。', confirm: '确认并继续', rejected: '服务端没有接受成人 Gate。' },
      },
    },
    'en-US': {
      common: { state: { loading: 'Loading', empty: 'Nothing is available', error: 'Unable to complete right now', permission: 'Access is not allowed', recovery: 'Recovering the safe snapshot', offline: 'You are offline', success: 'Completed', partial: 'Partially available' } },
      auth: {
        login: { title: 'Sign in to learning space', description: 'Sign-in uses a controlled Gateway deep link; refresh tokens are never stored in ordinary storage.', start: 'Open identity service', pending: 'The real IdP is not approved; this is a replaceable login seam.', noSuccess: 'No valid callback was received, so no login success was fabricated.' },
        callback: { title: 'Restoring mobile session', restoring: 'Validating deep-link callback and restoring a secure session…', failed: 'The mobile callback did not complete.' },
        session: { restored: 'Session restored', restoring: 'Restoring session…', logout: 'Sign out', logoutFailed: 'Revocation is unavailable; the local session was cleared.' },
        forbidden: { title: 'Access is not allowed', description: 'Server policy decides access; client role, tenant, and owner fields cannot bypass it.', login: 'Return to sign in', empty: 'The server has not returned a permission snapshot.' },
        adult: { title: 'Adult-user gate', description: 'Phase 1 is for adults and university students; the server records consent.', confirm: 'Confirm and continue', rejected: 'The server did not accept the adult-user gate.' },
      },
    },
  },
})
export const mobileI18nAdapter = createUniAppI18nAdapter(mobileI18n, { localeStorage: storage })
export const mobileThemeController = createThemeController({ storage })
export const mobileThemeAdapter = createUniAppThemeAdapter(mobileThemeController)
