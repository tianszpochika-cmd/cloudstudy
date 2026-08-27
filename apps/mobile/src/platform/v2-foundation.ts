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
        login: { title: '登录后，马上开始学习', description: '登录一次，我们会把你带回刚才的位置；首次进入只需完成一个简短设置。', start: '登录并继续', retry: '重新准备登录', preparing: '正在准备登录…', ready: '准备好了', readyDescription: '点击下方按钮完成登录，回来后会继续为你设置学习空间。', preparingDescription: '马上就好，正在连接登录服务。', retryHint: '登录入口暂时没有响应，请稍后再试。', afterLogin: '登录完成后，你只需要确认年龄、同意必要说明并选择学习目标。', cancelled: '你取消了登录，可以随时再试。', unavailable: '登录暂时不可用', pending: '正在准备登录入口…', noSuccess: '无需选择登录方式，点击下方按钮即可继续。' },
        callback: { title: '正在进入学习空间', restoring: '正在安全地恢复你的学习空间…', failed: '登录没有完成，请回到登录页再试一次。' },
        session: { restored: '会话已恢复', restoring: '正在恢复会话…', logout: '退出登录', logoutFailed: '撤销服务暂时不可用，已清除本地会话。' },
        forbidden: { title: '暂时没有访问权限', description: '访问权限由服务端策略决定，客户端不会使用角色、租户或 owner 字段绕过限制。', login: '返回登录', empty: '服务端尚未返回权限快照。' },
        adult: { title: '开始前确认一下', description: '语学星 Phase 1 面向 18 岁以上成人与大学生。确认后即可继续设置你的学习计划。', confirm: '确认并继续', rejected: '这次确认没有完成，请检查信息后再试。' },
      },
    },
    'en-US': {
      common: { state: { loading: 'Loading', empty: 'Nothing is available', error: 'Unable to complete right now', permission: 'Access is not allowed', recovery: 'Recovering the safe snapshot', offline: 'You are offline', success: 'Completed', partial: 'Partially available' } },
      auth: {
        login: { title: 'Sign in, then start learning', description: 'Sign in once and we will bring you back to where you were. First-time learners only need a short setup.', start: 'Sign in and continue', retry: 'Prepare sign-in again', preparing: 'Preparing sign-in…', ready: 'You are ready to continue', readyDescription: 'Use the button below to sign in. We will finish setting up your learning space when you return.', preparingDescription: 'Almost there. Connecting to sign-in.', retryHint: 'The sign-in entry did not respond. Please try again shortly.', afterLogin: 'After sign-in, you will confirm your age, accept the required notices, and choose a learning goal.', cancelled: 'Sign-in was cancelled. You can try again whenever you are ready.', unavailable: 'Sign-in is temporarily unavailable', pending: 'Preparing sign-in…', noSuccess: 'There is no account choice to make here. Use the button below to continue.' },
        callback: { title: 'Entering your learning space', restoring: 'Restoring your learning space securely…', failed: 'Sign-in did not complete. Return to sign-in and try again.' },
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
