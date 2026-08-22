import { ref } from 'vue'
import { mobileI18n } from '../platform/v2-foundation'

export const authLocale = ref(mobileI18n.locale)
mobileI18n.subscribe((state) => { authLocale.value = state.locale })
export function authT(key: string, values?: Record<string, unknown>): string { authLocale.value; return mobileI18n.t(`auth.${key}`, values) }

