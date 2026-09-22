import { adminI18n } from './v2-foundation'
import { ui } from './experience'
import { batchCZh, batchCEn } from './i18n-batch-c'

/**
 * API / store / auth-layer copy.
 *
 * The shared `@englishflow/i18n/admin-experience` dictionary covers view copy;
 * these namespaces carry the messages that live in the data layer (api clients,
 * stores, gateway auth, the locale switcher). They register under the same
 * `admin.*` namespace, and `registerMessages` merges, so both dictionaries
 * coexist without one overwriting the other.
 */
adminI18n.registerMessages('zh-CN', { admin: batchCZh })
adminI18n.registerMessages('en-US', { admin: batchCEn })

/**
 * Alias of the shared `ui()` helper (both resolve `adminI18n.t('admin.' + key)`).
 * Kept as the single entry point for the data layer so api/store modules do not
 * depend on the view-layer module directly.
 */
export const adminT = ui
