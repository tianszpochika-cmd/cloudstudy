import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { mobileLearnerContentApi, mobileLearnerContentError } from '../api/learner-content'
import type { MobileFirstDayModel, MobileGoalOption, MobileHomeModel, MobileOnboardingModel, MobileReadModelStatus } from '../domain/learner-content'
import { getUniRuntime } from '../platform/uni-runtime'
import { createClientId } from '../platform/client-id'

const STORAGE_KEY = 'yx.v2.learner-content.mobile.v1'

const fallbackOnboarding: MobileOnboardingModel = { goal: null, quota: null, uiLocale: 'zh-CN', contentLocale: 'en-US', completed: false, stateVersion: 0 }
const fallbackGoals: MobileGoalOption[] = [
  { value: 'ZERO_BASIS', label: '成人零基础', description: '从发音、核心词和短句开始。' },
  { value: 'CET_4_6', label: '四六级备考', description: '围绕词汇、听力和真题节奏推进。' },
  { value: 'WORKPLACE', label: '工作沟通', description: '优先解决邮件、会议和日常表达。' },
]

interface PersistedState { onboarding?: MobileOnboardingModel; home?: MobileHomeModel | null; firstDay?: MobileFirstDayModel | null }

function eventId(prefix: string): string { return createClientId(prefix) }

export const useLearnerContentStore = defineStore('mobile-learner-content', () => {
  const restored = ref(false)
  const onboarding = ref<MobileOnboardingModel>({ ...fallbackOnboarding })
  const goals = ref<MobileGoalOption[]>([...fallbackGoals])
  const home = ref<MobileHomeModel | null>(null)
  const firstDay = ref<MobileFirstDayModel | null>(null)
  const onboardingStatus = ref<MobileReadModelStatus>('idle')
  const homeStatus = ref<MobileReadModelStatus>('idle')
  const firstDayStatus = ref<MobileReadModelStatus>('idle')
  const lastError = ref<string | null>(null)
  const progress = computed(() => {
    const value = home.value
    return value && value.targetMinutes > 0 ? Math.min(100, Math.round(value.completedMinutes / value.targetMinutes * 100)) : 0
  })

  function persist(): void { getUniRuntime().setStorageSync(STORAGE_KEY, JSON.stringify({ onboarding: onboarding.value, home: home.value, firstDay: firstDay.value } satisfies PersistedState)) }
  function restore(): void {
    if (restored.value) return
    const raw = getUniRuntime().getStorageSync(STORAGE_KEY)
    if (typeof raw === 'string') {
      try { const saved = JSON.parse(raw) as PersistedState; if (saved.onboarding) onboarding.value = { ...fallbackOnboarding, ...saved.onboarding }; if (saved.home) home.value = saved.home; if (saved.firstDay) firstDay.value = saved.firstDay } catch { /* ignore corrupt local cache */ }
    }
    restored.value = true
  }
  async function loadOnboarding(): Promise<void> {
    restore(); onboardingStatus.value = 'loading'; lastError.value = null
    try { onboarding.value = await mobileLearnerContentApi.readOnboarding(onboarding.value.contentLocale); onboardingStatus.value = 'ready'; persist() }
    catch (error) { onboardingStatus.value = 'offline'; lastError.value = mobileLearnerContentError(error).message; persist() }
  }
  async function saveOnboarding(goal: string, quota: number): Promise<void> {
    restore(); onboarding.value = { ...onboarding.value, goal, quota, completed: false }; persist(); onboardingStatus.value = 'loading'; lastError.value = null
    try { onboarding.value = await mobileLearnerContentApi.saveOnboarding({ goal, quota, clientEventId: eventId('mobile-onboarding') }); onboardingStatus.value = 'ready'; persist() }
    catch (error) { onboardingStatus.value = 'offline'; lastError.value = mobileLearnerContentError(error).message; persist() }
  }
  async function loadFirstDay(): Promise<void> {
    restore(); firstDayStatus.value = 'loading'
    try { firstDay.value = await mobileLearnerContentApi.readFirstDay(onboarding.value.contentLocale); firstDayStatus.value = firstDay.value.state === 'DEGRADED' ? 'unavailable' : 'ready'; persist() }
    catch (error) { firstDayStatus.value = 'offline'; lastError.value = mobileLearnerContentError(error).message; persist() }
  }
  async function loadHome(): Promise<void> {
    restore(); homeStatus.value = 'loading'; lastError.value = null
    try { home.value = await mobileLearnerContentApi.readHome(onboarding.value.contentLocale); homeStatus.value = home.value.contentStatus === 'UNAVAILABLE' ? 'unavailable' : home.value.tasks.length || home.value.content.length ? 'ready' : 'empty'; persist() }
    catch (error) { homeStatus.value = 'offline'; lastError.value = mobileLearnerContentError(error).message; persist() }
  }
  async function completeTask(taskId: string): Promise<void> {
    if (home.value) home.value = { ...home.value, tasks: home.value.tasks.map((task) => task.id === taskId ? { ...task, status: 'COMPLETED' } : task), completedMinutes: Math.min(home.value.targetMinutes, home.value.completedMinutes + (home.value.tasks.find((task) => task.id === taskId)?.minutes ?? 0)) }; persist()
    try { const remote = await mobileLearnerContentApi.completeTask(taskId, eventId(`mobile-task-${taskId}`)); if (remote) home.value = remote; homeStatus.value = 'ready'; persist() }
    catch (error) { homeStatus.value = 'offline'; lastError.value = mobileLearnerContentError(error).message; persist() }
  }
  return { onboarding, goals, home, firstDay, onboardingStatus, homeStatus, firstDayStatus, lastError, progress, restore, persist, loadOnboarding, saveOnboarding, loadFirstDay, loadHome, completeTask }
})
