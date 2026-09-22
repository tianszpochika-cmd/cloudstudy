import { learnerBaseMessages } from '@englishflow/i18n/learner-base'
import { createI18n } from '@englishflow/i18n'
import { createVueWebI18nAdapter } from '@englishflow/i18n/adapters'
import { createThemeController } from '@englishflow/design-tokens'
import { createVueWebThemeAdapter } from '@englishflow/design-tokens/adapters'
import { learnerExperienceVariables } from '@englishflow/design-tokens/learner-web'
import { learnerExperienceMessages } from '@englishflow/i18n/learner-experience'

const browserStorage = typeof localStorage === 'undefined' ? undefined : localStorage
const root = typeof document === 'undefined' ? undefined : document.documentElement

export const learnerI18n = createI18n({
  locale: 'zh-CN',
  contentLocale: 'en-US',
  messages: learnerBaseMessages,
})
export const learnerI18nAdapter = createVueWebI18nAdapter(learnerI18n, { localeStorage: browserStorage })
export const learnerThemeController = createThemeController({ storage: browserStorage })
export const learnerThemeAdapter = createVueWebThemeAdapter(learnerThemeController, root)
for (const locale of ['zh-CN', 'en-US'] as const) learnerI18n.registerMessages(locale, learnerExperienceMessages[locale])
function applyExperienceTheme() {
  if (!root) return
  for (const [name, value] of Object.entries(learnerExperienceVariables(learnerThemeController.resolvedTheme))) root.style.setProperty(name, value)
}
learnerThemeController.subscribe(applyExperienceTheme)
applyExperienceTheme()
