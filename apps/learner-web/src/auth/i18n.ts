import { ref } from 'vue'
import { learnerI18n } from '../platform/v2-foundation'

export const authLocale = ref(learnerI18n.locale)
learnerI18n.subscribe((state) => { authLocale.value = state.locale })

export function authT(key: string, values?: Record<string, unknown>): string {
  authLocale.value
  return learnerI18n.t(`auth.${key}`, values)
}

