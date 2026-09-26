import { createI18n } from '@englishflow/i18n'
import { createUniAppI18nAdapter, type LocaleStorage } from '@englishflow/i18n/adapters'
import { createThemeController } from '@englishflow/design-tokens'
import { createUniAppThemeAdapter } from '@englishflow/design-tokens/adapters'
import { getUniRuntime } from './uni-runtime'

const storage: LocaleStorage = {
  getItem: (key) => {
    try {
      const value = getUniRuntime().getStorageSync(key)
      return value === undefined || value === null || value === '' ? null : String(value)
    } catch { return null }
  },
  setItem: (key, value) => {
    try { getUniRuntime().setStorageSync(key, value) } catch { /* UI preference remains in memory. */ }
  },
}

export const mobileI18n = createI18n({
  locale: 'zh-CN',
  contentLocale: 'en-US',
  messages: {
    'zh-CN': {
      common: { state: { loading: '正在加载', empty: '暂无可用数据', error: '暂时无法完成', permission: '当前没有访问权限', recovery: '正在恢复安全快照', offline: '当前处于离线状态', success: '已完成', partial: '部分内容可用' } },
      auth: {
        login: { title: '登录后，马上开始学习', description: '使用语学星账号和密码登录。', identifier: '账号', identifierPlaceholder: '输入邮箱或账号', password: '密码', passwordPlaceholder: '输入密码', required: '请输入账号和密码。', start: '登录并继续', submitting: '正在验证…', failed: '账号或密码不正确，请重试。', afterLogin: '登录后完成年龄确认、必要同意和学习目标设置。' },
        session: { restored: '会话已恢复', restoring: '正在恢复会话…', logout: '退出登录', logoutFailed: '撤销服务暂时不可用，已清除本地会话。' },
        forbidden: { title: '暂时没有访问权限', description: '请检查账号权限，或返回登录重试。', login: '返回登录', empty: '暂时无法读取权限，请稍后重试。' },
        adult: { title: '开始前确认一下', description: '语学星当前仅面向 18 岁以上用户。', confirm: '确认并继续', rejected: '这次确认没有完成，请检查信息后再试。' },
      },
    },
    'en-US': {
      common: { state: { loading: 'Loading', empty: 'Nothing is available', error: 'Unable to complete right now', permission: 'Access is not allowed', recovery: 'Recovering the safe snapshot', offline: 'You are offline', success: 'Completed', partial: 'Partially available' } },
      auth: {
        login: { title: 'Sign in, then start learning', description: 'Sign in with your account and password.', identifier: 'Account', identifierPlaceholder: 'Email or account', password: 'Password', passwordPlaceholder: 'Enter your password', required: 'Enter your account and password.', start: 'Sign in and continue', submitting: 'Verifying…', failed: 'The account or password is incorrect.', afterLogin: 'Next, confirm your age, accept the required notices, and choose a goal.' },
        session: { restored: 'Session restored', restoring: 'Restoring session…', logout: 'Sign out', logoutFailed: 'Revocation is unavailable; the local session was cleared.' },
        forbidden: { title: 'Access is not allowed', description: 'Check your account access or sign in again.', login: 'Return to sign in', empty: 'Access details are unavailable. Try again shortly.' },
        adult: { title: 'One quick check before we begin', description: '语学星 is currently for people aged 18 and over.', confirm: 'Confirm and continue', rejected: 'This confirmation did not complete. Check the information and try again.' },
      },
    },
  },
})
export const mobileI18nAdapter = createUniAppI18nAdapter(mobileI18n, { localeStorage: storage })
export const mobileThemeController = createThemeController({ storage })
export const mobileThemeAdapter = createUniAppThemeAdapter(mobileThemeController)
