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
        login: { title: '登录后，马上开始学习', description: '使用语学星账号和密码登录。Access Token 只在当前运行时内存中使用，Refresh Token 由安全会话边界保护。', identifier: '账号', identifierPlaceholder: '输入邮箱或账号', password: '密码', passwordPlaceholder: '输入密码', required: '请输入账号和密码。', start: '登录并继续', submitting: '正在验证…', failed: '账号或密码不正确，请重试。', afterLogin: '登录完成后，你只需要确认年龄、同意必要说明并选择学习目标。' },
        session: { restored: '会话已恢复', restoring: '正在恢复会话…', logout: '退出登录', logoutFailed: '撤销服务暂时不可用，已清除本地会话。' },
        forbidden: { title: '暂时没有访问权限', description: '访问权限由服务端策略决定，客户端不会使用角色、租户或 owner 字段绕过限制。', login: '返回登录', empty: '服务端尚未返回权限快照。' },
        adult: { title: '开始前确认一下', description: '语学星 Phase 1 面向 18 岁以上成人与大学生。确认后即可继续设置你的学习计划。', confirm: '确认并继续', rejected: '这次确认没有完成，请检查信息后再试。' },
      },
    },
    'en-US': {
      common: { state: { loading: 'Loading', empty: 'Nothing is available', error: 'Unable to complete right now', permission: 'Access is not allowed', recovery: 'Recovering the safe snapshot', offline: 'You are offline', success: 'Completed', partial: 'Partially available' } },
      auth: {
        login: { title: 'Sign in, then start learning', description: 'Sign in with your EnglishFlow account and password. Access Tokens stay in runtime memory and Refresh Tokens stay behind the secure session boundary.', identifier: 'Account', identifierPlaceholder: 'Email or account', password: 'Password', passwordPlaceholder: 'Enter your password', required: 'Enter your account and password.', start: 'Sign in and continue', submitting: 'Verifying…', failed: 'The account or password is incorrect.', afterLogin: 'After sign-in, you will confirm your age, accept the required notices, and choose a learning goal.' },
        session: { restored: 'Session restored', restoring: 'Restoring session…', logout: 'Sign out', logoutFailed: 'Revocation is unavailable; the local session was cleared.' },
        forbidden: { title: 'Access is not allowed', description: 'Server policy decides access; client role, tenant, and owner fields cannot bypass it.', login: 'Return to sign in', empty: 'The server has not returned a permission snapshot.' },
        adult: { title: 'One quick check before we begin', description: 'Phase 1 is for adults and university students aged 18+. Confirm this once, then set up your learning plan.', confirm: 'Confirm and continue', rejected: 'This confirmation did not complete. Check the information and try again.' },
      },
    },
  },
})
export const mobileI18nAdapter = createUniAppI18nAdapter(mobileI18n, { localeStorage: storage })
export const mobileThemeController = createThemeController({ storage })
export const mobileThemeAdapter = createUniAppThemeAdapter(mobileThemeController)
