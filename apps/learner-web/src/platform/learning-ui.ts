import { computed, onBeforeUnmount, ref } from 'vue'
import type { InterpolationValues } from '@englishflow/i18n'
import type { ThemeMode } from '@englishflow/design-tokens'
import { learnerI18n, learnerI18nAdapter, learnerThemeController } from './v2-foundation'

export function useLearningUi() {
  const i18nState = ref(learnerI18n.state)
  const themeState = ref(learnerThemeController.state)
  const stopI18n = learnerI18n.subscribe((state) => { i18nState.value = state })
  const stopTheme = learnerThemeController.subscribe((state) => { themeState.value = state })

  onBeforeUnmount(() => {
    stopI18n()
    stopTheme()
  })

  return {
    locale: computed(() => i18nState.value.locale),
    contentLocale: computed(() => i18nState.value.contentLocale),
    theme: computed(() => themeState.value.theme),
    themeVariables: computed(() => themeState.value.variables),
    t(key: string, values?: InterpolationValues): string {
      i18nState.value
      return learnerI18n.t(key, values)
    },
    setLocale(locale: string): void { learnerI18nAdapter.setLocale(locale) },
    setContentLocale(locale: string): void { learnerI18nAdapter.setContentLocale(locale) },
    setTheme(theme: ThemeMode): void { learnerThemeController.setTheme(theme) },
  }
}
