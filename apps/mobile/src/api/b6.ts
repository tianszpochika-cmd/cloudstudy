type B6Evidence = { source: 'code-layer-evidence'; status: string; items: string[] }

const releaseMatrix: B6Evidence = {
  source: 'code-layer-evidence',
  status: 'CODE_READY',
  items: ['Java 25 / Spring Boot 4.1 runtime manifest', 'Vue 3 + uni-app mobile target', 'Phase 1 feature gate active'],
}

const performanceBudget: B6Evidence = {
  source: 'code-layer-evidence',
  status: 'TEST_STAGE_REQUIRED',
  items: ['Ultra / High / Medium / Performance adaptive levels', 'Reduced-motion and low-power fallback', 'Real device benchmark remains a test-stage item'],
}

const accessibilityChecklist: B6Evidence = {
  source: 'code-layer-evidence',
  status: 'TEST_STAGE_REQUIRED',
  items: ['Keyboard/focus semantics covered by shared UI rules', 'Color is not the only state signal', 'Screen-reader and device verification remain test-stage items'],
}

export async function getMobileB6ReleaseMatrix(): Promise<unknown> { return releaseMatrix }
export async function getMobileB6PerformanceBudget(): Promise<unknown> { return performanceBudget }
export async function getMobileB6AccessibilityChecklist(): Promise<unknown> { return accessibilityChecklist }
