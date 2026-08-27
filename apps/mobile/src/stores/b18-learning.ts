import { ref } from 'vue'
import { defineStore } from 'pinia'
import { completeMobileB18Review, listMobileB18ReviewQueue, type MobileB18ReviewQueueItem } from '../api/b18-learning'
import { MobileApiError } from '../api/client'

export type MobileB18LearningState = 'idle' | 'loading' | 'empty' | 'ready' | 'partial' | 'permission' | 'recovery' | 'offline' | 'error' | 'success'

function stateFor(error: unknown): MobileB18LearningState {
  if (error instanceof MobileApiError) {
    if (error.status === 401 || error.status === 403) return 'permission'
    if (error.status === 409 || error.status === 412) return 'recovery'
    if (error.status === 0 || error.status >= 500) return 'offline'
  }
  return 'error'
}

export const useB18LearningStore = defineStore('mobile-b18-learning', () => {
  const state = ref<MobileB18LearningState>('idle')
  const queue = ref<MobileB18ReviewQueueItem[]>([])
  const lastError = ref<string | null>(null)
  const busyItemId = ref<string | null>(null)

  async function load(): Promise<void> {
    state.value = 'loading'; lastError.value = null
    try { queue.value = await listMobileB18ReviewQueue(); state.value = queue.value.length ? 'ready' : 'empty' }
    catch (error) { state.value = stateFor(error); lastError.value = error instanceof Error ? error.message : '移动复习队列暂时不可用。' }
  }

  async function complete(item: MobileB18ReviewQueueItem): Promise<void> {
    if (busyItemId.value) return
    busyItemId.value = item.queueItemId
    try { await completeMobileB18Review(item); queue.value = queue.value.filter((candidate) => candidate.queueItemId !== item.queueItemId); state.value = 'success' }
    catch (error) { state.value = stateFor(error); lastError.value = error instanceof Error ? error.message : '复习状态同步失败。' }
    finally { busyItemId.value = null }
  }

  return { state, queue, lastError, busyItemId, load, complete }
})
