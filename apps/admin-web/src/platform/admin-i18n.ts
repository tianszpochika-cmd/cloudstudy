import { ref } from 'vue'
import { adminI18n } from './v2-foundation'
import { batchCZh, batchCEn } from './i18n-batch-c'

// Batch C namespaces register centrally: every consumer imports adminT from this
// module, so registration always precedes first use. (Batches A/B self-register
// on view import; registerMessages merges, so both patterns coexist safely.)
adminI18n.registerMessages('zh-CN', { admin: batchCZh })
adminI18n.registerMessages('en-US', { admin: batchCEn })

export const adminLocale = ref(adminI18n.locale)
adminI18n.subscribe((state) => { adminLocale.value = state.locale })

/** Translate an `admin.*` key; tracks the UI locale so views re-render on switch. */
export function adminT(key: string, values?: Record<string, unknown>): string {
  adminLocale.value
  return adminI18n.t(`admin.${key}`, values)
}
