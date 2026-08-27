type B6Evidence = { source: 'code-layer-evidence'; status?: string; [key: string]: unknown }

const matrix = {
  source: 'code-layer-evidence',
  matrixVersion: 'b6-platform-v2',
  codeLayerStatus: 'CODE_READY',
  realDeviceEvidenceStatus: 'PENDING_TEST_STAGE',
  targets: [
    { platformCode: 'WEB', priority: 'P1', implementation: 'Vue 3 + Vite', buildStatus: 'PASS', installability: 'browser', sharedBusinessCode: 'contracts/domain/i18n/tokens' },
    { platformCode: 'H5', priority: 'P1', implementation: 'uni-app H5', buildStatus: 'PASS', installability: 'browser', sharedBusinessCode: 'contracts/domain/i18n/tokens' },
    { platformCode: 'WINDOWS_PWA', priority: 'P2', implementation: 'learner-web PWA boundary', buildStatus: 'CODE_READY', installability: 'test-stage', sharedBusinessCode: 'contracts/domain/i18n/tokens' },
  ],
} satisfies B6Evidence

const performance = { source: 'code-layer-evidence', status: 'TEST_STAGE_REQUIRED', levels: ['Ultra', 'High', 'Medium', 'Performance'], realDeviceBenchmark: 'PENDING_TEST_STAGE' } satisfies B6Evidence
const accessibility = { source: 'code-layer-evidence', status: 'TEST_STAGE_REQUIRED', checks: ['focus-visible', 'non-color-state', 'reduced-motion', 'responsive-overflow'], realDeviceVerification: 'PENDING_TEST_STAGE' } satisfies B6Evidence
const responsive = { source: 'code-layer-evidence', status: 'TEST_STAGE_REQUIRED', checks: ['desktop', 'tablet', 'mobile-h5', 'portrait', 'landscape'], realDeviceVerification: 'PENDING_TEST_STAGE' } satisfies B6Evidence
const observability = { source: 'code-layer-evidence', dashboardVersion: 'b6-observability-v2', metrics: { e2ePassed: 0, e2eFailed: 0, securityNotGreen: 0, releaseGates: 0 }, correlationFields: ['requestId', 'traceId', 'eventName', 'errorCode'], alerts: [], runbookRefs: ['docs/07-operations/b6-validation.md', 'docs/07-operations/observability.md'] } satisfies B6Evidence

export async function getB6ReleaseMatrix(): Promise<unknown> { return matrix }
export async function getB6ObservabilityDashboard(): Promise<unknown> { return observability }
export async function getB6PerformanceBudget(): Promise<unknown> { return performance }
export async function getB6AccessibilityChecklist(): Promise<unknown> { return accessibility }
export async function getB6ResponsiveChecklist(): Promise<unknown> { return responsive }
