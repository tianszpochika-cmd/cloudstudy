import { createI18n } from '@englishflow/i18n'
import { createNuxtI18nAdapter } from '@englishflow/i18n/adapters'
import { createThemeController } from '@englishflow/design-tokens'
import { createNuxtThemeAdapter } from '@englishflow/design-tokens/adapters'

const browserStorage = typeof localStorage === 'undefined' ? undefined : localStorage
const root = typeof document === 'undefined' ? undefined : document.documentElement

export const officialI18n = createI18n({
  locale: 'zh-CN',
  contentLocale: 'en-US',
  messages: {
    'zh-CN': { common: { state: { loading: '正在加载', empty: '暂无公开内容', error: '公开内容暂时不可用', permission: '公开内容暂不可访问', recovery: '正在恢复公开快照', offline: '公开服务暂时离线', success: '公开内容已准备好', partial: '部分公开内容可用' } }, auth: { login: { start: '进入学习', publicOnly: '官网不保存业务会话，只提供受控登录入口。' } } },
    'en-US': { common: { state: { loading: 'Loading', empty: 'No public content is available', error: 'Public content is temporarily unavailable', permission: 'Public content is not accessible', recovery: 'Recovering the public snapshot', offline: 'The public service is offline', success: 'Public content is ready', partial: 'Public content is partially available' } }, auth: { login: { start: 'Enter learning', publicOnly: 'The official site stores no business session; it only provides a controlled login entry.' } } },
  },
})
export const officialI18nAdapter = createNuxtI18nAdapter(officialI18n, { localeStorage: browserStorage })
export const officialThemeController = createThemeController({ initialTheme: 'system', storage: browserStorage })
export const officialThemeAdapter = createNuxtThemeAdapter(officialThemeController, root)
