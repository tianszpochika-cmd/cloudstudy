import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ApiError } from '../api/client'
import { listB18ReviewQueue, type B18ReviewQueueItem, type ReviewHistoryEntry } from '../api/b18-learning'
import { READ_FAILED_COPY } from '../domain/review-history'
import { getLearningReport } from '../api/b10'
import type { B10Report } from '../domain/b10'
import { ILLEGAL_REVIEW, reviewFailureCopy, stageAfter } from '../domain/review-stage'

export type B18LearningState = 'idle' | 'loading' | 'empty' | 'ready' | 'partial' | 'permission' | 'recovery' | 'offline' | 'error' | 'success'

function stateFor(error: unknown): B18LearningState {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) return 'permission'
    if (error.status === 409 || error.status === 412) return 'recovery'
    if (error.status === 0 || error.status >= 500) return 'offline'
  }
  return error instanceof TypeError ? 'offline' : 'error'
}

const seenCompletionKeys = new Set<string>()

function messageFor(error: unknown): string {
  const raw = error instanceof Error ? error.message : ''
  const illegal = reviewFailureCopy(raw)
  if (illegal) return illegal
  if (error instanceof ApiError && error.status === 403) return '当前会话没有访问复习队列的权限。'
  if (error instanceof ApiError && error.status === 409) return '复习状态发生变化，请刷新后恢复。'
  if (stateFor(error) === 'offline') return '复习服务暂时不可用，已保留当前页面。'
  return error instanceof Error && error.message ? error.message : '复习数据暂时无法读取。'
}

export const useB18LearningStore = defineStore('b18-learning', () => {
  const state = ref<B18LearningState>('idle')
  const queue = ref<B18ReviewQueueItem[]>([])
  const history = ref<ReviewHistoryEntry[]>([])
  const emptyCopy = ref('')
  const emptyStatus = ref('')
  const report = ref<B10Report | null>(null)
  const lastError = ref<string | null>(null)
  const busyItemId = ref<string | null>(null)
  const hasReview = computed(() => queue.value.length > 0)

  async function load(): Promise<void> {
    state.value = 'loading'
    lastError.value = null
    const [queueResult, reportResult] = await Promise.allSettled([listB18ReviewQueue(), getLearningReport('DAILY')])
    if (queueResult.status === 'fulfilled') {
      queue.value = queueResult.value.items
      history.value = queueResult.value.history
      emptyCopy.value = queueResult.value.emptyCopy
      emptyStatus.value = queueResult.value.emptyStatus
    } else {
      emptyStatus.value = 'READ_FAILED'
      emptyCopy.value = READ_FAILED_COPY
    }
    if (reportResult.status === 'fulfilled') report.value = reportResult.value
    const failures = [queueResult, reportResult].filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    if (!failures.length) state.value = queue.value.length || report.value ? 'ready' : 'empty'
    else if (queueResult.status === 'fulfilled' || reportResult.status === 'fulfilled') { state.value = 'partial'; lastError.value = messageFor(failures[0].reason) }
    else { state.value = stateFor(failures[0].reason); lastError.value = messageFor(failures[0].reason) }
  }

  async function complete(item: B18ReviewQueueItem): Promise<void> {
    const key = `review-complete:${item.queueItemId}`
    const sameKey = seenCompletionKeys.has(key)
    seenCompletionKeys.add(key)
    item.state = stageAfter(item.state, item.state, sameKey)
    if (!item.completable || sameKey) {
      state.value = 'recovery'
      lastError.value = ILLEGAL_REVIEW
      return
    }
    state.value = 'recovery'
    lastError.value = '缺少可核验的答题结果，请从练习进入复习。'
  }

  return { state, queue, history, emptyCopy, emptyStatus, report, lastError, busyItemId, hasReview, load, complete }
})
