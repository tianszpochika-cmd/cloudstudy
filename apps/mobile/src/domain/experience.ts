import type { PerformanceLevel } from '@englishflow/performance'
import type { MobileMotionMode } from './learner-content'

export function resolveMobileMotion(
  mode: MobileMotionMode,
  performance: { level: PerformanceLevel; motionDisabled: boolean; reducedMotion: boolean },
): 'on' | 'reduced' | 'off' {
  if (mode === 'OFF' || performance.motionDisabled || performance.reducedMotion || performance.level === 'Performance') return 'off'
  return mode === 'REDUCED' ? 'reduced' : 'on'
}
