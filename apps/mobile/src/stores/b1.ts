import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getUniRuntime } from '../platform/uni-runtime'
import { createMobileB1State, MOBILE_B1_KEY, type MobileB1State } from '../domain/b1'
export const useB1Store = defineStore('mobile-b1', () => {
  const state = ref<MobileB1State>(createMobileB1State()); const restored = ref(false); const todayProgress = computed(() => state.value.progress)
  function persist(): void { getUniRuntime().setStorageSync(MOBILE_B1_KEY, JSON.stringify(state.value)) }
  function restore(): void { if (restored.value) return; const value = getUniRuntime().getStorageSync(MOBILE_B1_KEY); if (typeof value === 'string') { try { state.value = { ...createMobileB1State(), ...(JSON.parse(value) as Partial<MobileB1State>) } } catch { state.value = createMobileB1State() } } restored.value = true }
  function completeOnboarding(goal: string, quota: number): void { state.value = { ...state.value, onboardingDone: true, goal, quota }; persist() }
  function completeAssessment(): void { state.value = { ...state.value, assessmentDone: true, progress: Math.max(state.value.progress, 25) }; persist() }
  function completeToday(): void { state.value = { ...state.value, progress: 100 }; persist() }
  return { state, restored, todayProgress, restore, persist, completeOnboarding, completeAssessment, completeToday }
})
