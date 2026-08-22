export type B6PlatformCode = 'WEB' | 'H5' | 'ANDROID' | 'IOS' | 'IPAD' | 'WECHAT_MINI_PROGRAM' | 'WINDOWS_PWA'
export interface B6Target { platformCode: B6PlatformCode; priority: string; implementation: string; buildStatus: string; installability: string }
export interface B6Matrix { matrixVersion: string; targets: B6Target[]; codeLayerStatus: string; realDeviceEvidenceStatus: string }
export interface B6PerformanceProfile { level: string; textureBudgetMb: number; particleBudget: number; enableThreeD: boolean }
export interface B6Budget { levels: B6PerformanceProfile[]; autoDegrade: boolean; autoUpgrade: boolean }
export interface B6Accessibility { checks: Array<{ checkCode: string; title: string; fallbackRule: string }>; releaseBlocking: boolean }

function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null }
function dataOf(value: unknown): Record<string, unknown> { return record(value) && record(value.data) ? value.data : {} }
function text(value: unknown, fallback = ''): string { return typeof value === 'string' ? value : fallback }
function number(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0 }
export function toMatrix(value: unknown): B6Matrix { const data = dataOf(value); return { matrixVersion: text(data.matrixVersion, 'b6-platform-v1'), targets: Array.isArray(data.targets) ? data.targets.filter(record).map((item) => ({ platformCode: text(item.platformCode, 'H5') as B6PlatformCode, priority: text(item.priority), implementation: text(item.implementation), buildStatus: text(item.buildStatus, 'PENDING'), installability: text(item.installability, 'TEST_STAGE_REQUIRED') })) : [], codeLayerStatus: text(data.codeLayerStatus, 'READY_FOR_TEST_STAGE'), realDeviceEvidenceStatus: text(data.realDeviceEvidenceStatus, 'PENDING_TEST_STAGE') } }
export function toBudget(value: unknown): B6Budget { const data = dataOf(value); return { levels: Array.isArray(data.levels) ? data.levels.filter(record).map((item) => ({ level: text(item.level, 'Performance'), textureBudgetMb: number(item.textureBudgetMb), particleBudget: number(item.particleBudget), enableThreeD: item.enableThreeD === true })) : [], autoDegrade: data.autoDegrade !== false, autoUpgrade: data.autoUpgrade === true } }
export function toAccessibility(value: unknown): B6Accessibility { const data = dataOf(value); return { checks: Array.isArray(data.checks) ? data.checks.filter(record).map((item) => ({ checkCode: text(item.checkCode), title: text(item.title), fallbackRule: text(item.fallbackRule) })) : [], releaseBlocking: data.releaseBlocking !== false } }
