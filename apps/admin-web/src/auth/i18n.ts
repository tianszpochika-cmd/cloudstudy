import { ref } from 'vue'
import { adminI18n } from '../platform/v2-foundation'

export const authLocale = ref(adminI18n.locale)
adminI18n.subscribe((state) => { authLocale.value = state.locale })

export function authT(key: string, values?: Record<string, unknown>): string {
  authLocale.value
  return adminI18n.t(`auth.${key}`, values)
}

