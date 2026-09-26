import { getUniRuntime } from '../platform/uni-runtime'

export const B10_LEARNING_STORAGE_KEY = 'yx.b10.mobile.learning.v1'
export const LEARNER_CONTENT_STORAGE_KEY = 'yx.v2.learner-content.mobile.v1'
export const B1_STORAGE_KEY = 'yx.b1.mobile.v1'
export const B11_LEARNING_STORAGE_KEY = 'yx.b11.mobile.learning.v1'
export const B11_OFFLINE_STORAGE_KEY = 'yx.b11.mobile.offline.v1'
export const B3_WRITING_DRAFT_STORAGE_KEY = 'yx.b10.mobile.writing.draft.v1'
export const B3_READING_STORAGE_KEY = 'yx.b10.mobile.reading.v1'
export const B3_GRAMMAR_DRAFT_STORAGE_KEY = 'yx.b10.mobile.grammar-draft.v1'
export const B4_OFFLINE_STORAGE_KEY = 'yx.b4.mobile.sync.v1'

export function removeLearningCache(key: string): void {
  try { getUniRuntime().removeStorageSync(key) } catch { /* runtime may not be mounted yet */ }
  try {
    if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem(key)
  } catch { /* storage may be unavailable */ }
}

export function removeAllLearningCaches(): void {
  removeLearningCache(B10_LEARNING_STORAGE_KEY)
  removeLearningCache(LEARNER_CONTENT_STORAGE_KEY)
  removeLearningCache(B1_STORAGE_KEY)
  removeLearningCache(B11_LEARNING_STORAGE_KEY)
  removeLearningCache(B11_OFFLINE_STORAGE_KEY)
  removeLearningCache(B3_WRITING_DRAFT_STORAGE_KEY)
  removeLearningCache(B3_READING_STORAGE_KEY)
  removeLearningCache(B3_GRAMMAR_DRAFT_STORAGE_KEY)
  removeLearningCache(B4_OFFLINE_STORAGE_KEY)
}
