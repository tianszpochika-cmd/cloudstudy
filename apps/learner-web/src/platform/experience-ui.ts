import { createAdaptivePerformanceEngine } from '@englishflow/performance'
import { useLearningUi } from './learning-ui'

/** One engine for the workspace. New visuals follow system motion and quality policy. */
export const experiencePerformance = createAdaptivePerformanceEngine({
  storage: typeof localStorage === 'undefined' ? undefined : localStorage,
  storageKey: 'yx.learner.performance',
})
export function useExperienceText() {
  const ui = useLearningUi()
  return (key: string) => ui.t(`experience.${key}`)
}
