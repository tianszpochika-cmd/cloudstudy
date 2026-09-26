import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { getUniRuntime } from '../platform/uni-runtime'
import { createMobileB1State, MOBILE_B1_KEY, type MobileB1State } from '../domain/b1'
import { useSessionStore } from './session'
import { removeLearningCache } from './learning-cache'
export const useB1Store = defineStore('mobile-b1', () => {
  const session = useSessionStore()
  const state = ref<MobileB1State>(createMobileB1State()); const restored = ref(false); const todayProgress = computed(() => state.value.progress)
  function subject(): string | null { return session.isAuthenticated ? session.verifiedSubject : null }
  watch(() => session.identityRevision, () => { state.value = createMobileB1State(); restored.value = false }, { flush: 'sync' })
  function persist(): void { const owner = subject(); if (!owner) return; getUniRuntime().setStorageSync(MOBILE_B1_KEY, JSON.stringify({ subject: owner, state: state.value })) }
  function restore(): void {
    const owner = subject()
    if (!owner || restored.value) return
    const value = getUniRuntime().getStorageSync(MOBILE_B1_KEY)
    if (typeof value === 'string') {
      try {
        const saved = JSON.parse(value) as { subject?: string; state?: Partial<MobileB1State> }
        if (saved.subject === owner && saved.state && typeof saved.state === 'object') state.value = { ...createMobileB1State(), ...saved.state }
        else removeLearningCache(MOBILE_B1_KEY)
      } catch { removeLearningCache(MOBILE_B1_KEY) }
    }
    restored.value = true
  }
  function completeOnboarding(goal: string, quota: number): void { if (!subject()) return; restore(); state.value = { ...state.value, onboardingDone: true, goal, quota }; persist() }
  function completeAssessment(): void { if (!subject()) return; restore(); state.value = { ...state.value, assessmentDone: true, progress: Math.max(state.value.progress, 25) }; persist() }
  function completeToday(): void { if (!subject()) return; restore(); state.value = { ...state.value, progress: 100 }; persist() }
  return { state, restored, todayProgress, restore, persist, completeOnboarding, completeAssessment, completeToday }
})
