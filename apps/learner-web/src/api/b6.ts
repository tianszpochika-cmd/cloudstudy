/*
 * B6 is a code-layer release evidence view, not a learner fact endpoint. The
 * old client called the retired core-api `/platform/*` paths and converted a
 * missing platform owner into a misleading offline page. Keep this view
 * deterministic and honest until the dedicated platform service is enabled:
 * code-layer evidence is available, real-device evidence remains pending.
 */
const targets = [
  ['WEB', 'P0', 'apps/learner-web', 'CODE_READY'],
  ['H5', 'P0', 'apps/mobile (uni-app)', 'CODE_READY'],
  ['ANDROID', 'P1', 'apps/mobile (uni-app)', 'CODE_READY'],
  ['IOS', 'P1', 'apps/mobile (uni-app)', 'CODE_READY'],
  ['IPAD', 'P1', 'apps/mobile (uni-app)', 'CODE_READY'],
  ['WECHAT_MINI_PROGRAM', 'P2', 'apps/mobile (uni-app conditional build)', 'CODE_READY'],
  ['WINDOWS_PWA', 'P1', 'apps/learner-web', 'CODE_READY'],
] as const

function envelope(data: unknown): unknown { return { requestId: 'local-b6-code-evidence', data } }

export async function getB6ReleaseMatrix(): Promise<unknown> {
  return envelope({
    matrixVersion: 'b6-platform-v1',
    targets: targets.map(([platformCode, priority, sharedBusinessCode, buildStatus]) => ({ platformCode, priority, implementation: sharedBusinessCode, buildStatus, installability: 'TEST_STAGE_REQUIRED', sharedBusinessCode })),
    releasePriority: targets.map(([platformCode]) => platformCode),
    codeLayerStatus: 'READY_FOR_TEST_STAGE',
    realDeviceEvidenceStatus: 'PENDING_TEST_STAGE',
  })
}

export async function getB6PerformanceBudget(): Promise<unknown> {
  return envelope({
    ruleVersion: 'b6-performance-v1', autoDegrade: true, autoUpgrade: false,
    fallbackOrder: ['Three.js', '2.5D', 'SVG', '静态切片'],
    levels: [
      { level: 'Ultra', motionScale: 1, particleBudget: 100, textureBudgetMb: 512, enableThreeD: true, enableWaveform: true, enableRive: true },
      { level: 'High', motionScale: 0.85, particleBudget: 64, textureBudgetMb: 256, enableThreeD: true, enableWaveform: true, enableRive: true },
      { level: 'Medium', motionScale: 0.55, particleBudget: 24, textureBudgetMb: 128, enableThreeD: true, enableWaveform: false, enableRive: true },
      { level: 'Performance', motionScale: 0, particleBudget: 0, textureBudgetMb: 64, enableThreeD: false, enableWaveform: false, enableRive: false },
    ],
  })
}

export async function getB6AccessibilityChecklist(): Promise<unknown> {
  return envelope({ ruleVersion: 'b6-a11y-v1', releaseBlocking: true, checks: [
    { checkCode: 'TEXT_SCALE', title: '文字缩放至 200% 不裁切', fallbackRule: '允许内容纵向增长，禁止固定高度裁切', requiredForRelease: true },
    { checkCode: 'KEYBOARD_FLOW', title: '键盘可完成关键流程', fallbackRule: '所有主 CTA、表单和弹层拥有可见焦点', requiredForRelease: true },
    { checkCode: 'SCREEN_READER', title: '读屏可理解状态', fallbackRule: '图标提供 aria-label，状态不只依赖颜色', requiredForRelease: true },
    { checkCode: 'REDUCED_MOTION', title: '动效可关闭', fallbackRule: 'prefers-reduced-motion 或 Performance 档关闭复杂动效', requiredForRelease: true },
    { checkCode: 'PERMISSION_FALLBACK', title: '权限拒绝仍可继续', fallbackRule: '录音、通知、媒体权限拒绝时提供替代路径', requiredForRelease: true },
  ] })
}

export async function getB6ResponsiveChecklist(): Promise<unknown> {
  return envelope({ ruleVersion: 'b6-responsive-v1', evidenceStatus: 'PENDING_TEST_STAGE', breakpoints: [
    { code: 'MOBILE', minWidth: 320, maxWidth: 639, orientation: 'BOTH' },
    { code: 'TABLET', minWidth: 640, maxWidth: 1023, orientation: 'BOTH' },
    { code: 'PAD', minWidth: 1024, maxWidth: 1279, orientation: 'BOTH' },
    { code: 'DESKTOP', minWidth: 1280, maxWidth: 9999, orientation: 'LANDSCAPE' },
  ], checks: ['NO_HORIZONTAL_OVERFLOW', 'SAFE_AREA', 'KEYBOARD_AND_TOUCH', 'IPAD_RAIL_SWITCH', 'SINGLE_SCROLL_CONTAINER'] })
}

export async function getB6ObservabilityDashboard(): Promise<unknown> {
  return envelope({ dashboardVersion: 'b6-observability-v1', source: 'code-layer-evidence', metrics: { e2ePassed: 0, e2eFailed: 0, securityNotGreen: 0, releaseGates: 0 }, correlationFields: ['requestId', 'traceId', 'service', 'environment', 'eventName', 'errorCode'], alerts: [], runbookRefs: ['docs/07-operations/b6-validation.md', 'docs/07-operations/observability.md'] })
}
