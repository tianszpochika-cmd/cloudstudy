import { ref } from 'vue'
import { defineStore } from 'pinia'
import { listMobileB18ReviewQueue, type MobileB18ReviewQueueItem, type MobileReviewHistoryEntry } from '../api/b18-learning'
import { READ_FAILED_COPY } from '../domain/review-history'
import { MobileApiError } from '../api/client'
import { ILLEGAL_REVIEW, reviewFailureCopy, stageAfter } from '../domain/review-stage'

export type MobileB18LearningState = 'idle' | 'loading' | 'empty' | 'ready' | 'partial' | 'permission' | 'recovery' | 'offline' | 'error' | 'success'

function stateFor(error: unknown): MobileB18LearningState {
  if (error instanceof MobileApiError) {
    if (error.status === 401 || error.status === 403) return 'permission'
    if (error.status === 409 || error.status === 412) return 'recovery'
    if (error.status === 0 || error.status >= 500) return 'offline'
  }
  return 'error'
}

const seenCompletionKeys = new Set<string>()

export const useB18LearningStore = defineStore('mobile-b18-learning', () => {
  const state = ref<MobileB18LearningState>('idle')
  const queue = ref<MobileB18ReviewQueueItem[]>([])
  const history = ref<MobileReviewHistoryEntry[]>([])
  const emptyCopy = ref('')
  const emptyStatus = ref('')
  const lastError = ref<string | null>(null)
  const busyItemId = ref<string | null>(null)

  async function load(): Promise<void> {
    state.value = 'loading'; lastError.value = null
    try {
      const remote = await listMobileB18ReviewQueue()
      queue.value = remote.items
      history.value = remote.history
      emptyCopy.value = remote.emptyCopy
      emptyStatus.value = remote.emptyStatus
      state.value = queue.value.length ? 'ready' : 'empty'
    }
    catch (error) { state.value = stateFor(error); emptyStatus.value = 'READ_FAILED'; emptyCopy.value = READ_FAILED_COPY; const raw = error instanceof Error ? error.message : ''; lastError.value = reviewFailureCopy(raw) || raw || '移动复习队列暂时不可用。' }
  }

  async function complete(item: MobileB18ReviewQueueItem): Promise<void> {
    const key = `review-complete:${item.queueItemId}`
    const sameKey = seenCompletionKeys.has(key)
    seenCompletionKeys.add(key)
    item.state = stageAfter(item.state, item.state, sameKey)
    state.value = 'recovery'
    lastError.value = !item.completable || sameKey ? ILLEGAL_REVIEW : '缺少可核验的答题结果，请从练习进入复习。'
  }

  return { state, queue, history, emptyCopy, emptyStatus, lastError, busyItemId, load, complete }
})
