import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ApiError } from '../api/client'
import { completeB18Review, listB18ReviewQueue, type B18ReviewQueueItem } from '../api/b18-learning'
import { getLearningReport } from '../api/b10'
import type { B10Report } from '../domain/b10'

export type B18LearningState = 'idle' | 'loading' | 'empty' | 'ready' | 'partial' | 'permission' | 'recovery' | 'offline' | 'error' | 'success'

function stateFor(error: unknown): B18LearningState {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) return 'permission'
    if (error.status === 409 || error.status === 412) return 'recovery'
    if (error.status === 0 || error.status >= 500) return 'offline'
  }
  return error instanceof TypeError ? 'offline' : 'error'
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError && error.status === 403) return '当前会话没有访问复习队列的权限。'
  if (error instanceof ApiError && error.status === 409) return '复习状态发生变化，请刷新后恢复。'
  if (stateFor(error) === 'offline') return '复习服务暂时不可用，已保留当前页面。'
  return error instanceof Error && error.message ? error.message : '复习数据暂时无法读取。'
}

export const useB18LearningStore = defineStore('b18-learning', () => {
  const state = ref<B18LearningState>('idle')
  const queue = ref<B18ReviewQueueItem[]>([])
  const report = ref<B10Report | null>(null)
  const lastError = ref<string | null>(null)
  const busyItemId = ref<string | null>(null)
  const hasReview = computed(() => queue.value.length > 0)

  async function load(): Promise<void> {
    state.value = 'loading'
    lastError.value = null
    const [queueResult, reportResult] = await Promise.allSettled([listB18ReviewQueue(), getLearningReport('DAILY')])
    if (queueResult.status === 'fulfilled') queue.value = queueResult.value
    if (reportResult.status === 'fulfilled') report.value = reportResult.value
    const failures = [queueResult, reportResult].filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    if (!failures.length) state.value = queue.value.length || report.value ? 'ready' : 'empty'
    else if (queueResult.status === 'fulfilled' || reportResult.status === 'fulfilled') { state.value = 'partial'; lastError.value = messageFor(failures[0].reason) }
    else { state.value = stateFor(failures[0].reason); lastError.value = messageFor(failures[0].reason) }
  }

  async function complete(item: B18ReviewQueueItem): Promise<void> {
    if (busyItemId.value) return
    busyItemId.value = item.queueItemId
    lastError.value = null
    try {
      await completeB18Review(item)
      queue.value = queue.value.filter((candidate) => candidate.queueItemId !== item.queueItemId)
      state.value = 'success'
    } catch (error) {
      state.value = stateFor(error)
      lastError.value = messageFor(error)
    } finally { busyItemId.value = null }
  }

  return { state, queue, report, lastError, busyItemId, hasReview, load, complete }
})
