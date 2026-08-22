export interface B6AdminTarget { platformCode: string; priority: string; implementation: string; buildStatus: string; installability: string; sharedBusinessCode: string }
export interface B6AdminMatrix { matrixVersion: string; targets: B6AdminTarget[]; codeLayerStatus: string; realDeviceEvidenceStatus: string }
export interface B6AdminDashboard { metrics: Record<string, unknown>; alerts: Array<Record<string, unknown>>; correlationFields: string[] }

export function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null }
export function unwrap(value: unknown): Record<string, unknown> { return isRecord(value) && isRecord(value.data) ? value.data : {} }
export function text(value: unknown, fallback = ''): string { return typeof value === 'string' ? value : fallback }
export function list(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [] }
export function toMatrix(value: unknown): B6AdminMatrix { const data = unwrap(value); return { matrixVersion: text(data.matrixVersion, 'b6-platform-v1'), targets: Array.isArray(data.targets) ? data.targets.filter(isRecord).map((item) => ({ platformCode: text(item.platformCode), priority: text(item.priority), implementation: text(item.implementation), buildStatus: text(item.buildStatus, 'PENDING'), installability: text(item.installability), sharedBusinessCode: text(item.sharedBusinessCode) })) : [], codeLayerStatus: text(data.codeLayerStatus, 'READY_FOR_TEST_STAGE'), realDeviceEvidenceStatus: text(data.realDeviceEvidenceStatus, 'PENDING_TEST_STAGE') } }
export function toDashboard(value: unknown): B6AdminDashboard { const data = unwrap(value); return { metrics: isRecord(data.metrics) ? data.metrics : {}, alerts: Array.isArray(data.alerts) ? data.alerts.filter(isRecord) : [], correlationFields: list(data.correlationFields) } }
