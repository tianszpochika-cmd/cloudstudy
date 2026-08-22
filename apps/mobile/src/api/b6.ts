import { mobileApiClient } from './client'

export async function getMobileB6ReleaseMatrix(): Promise<unknown> { return mobileApiClient.request('/platform/release-matrix') }
export async function getMobileB6PerformanceBudget(): Promise<unknown> { return mobileApiClient.request('/platform/performance/budget') }
export async function getMobileB6AccessibilityChecklist(): Promise<unknown> { return mobileApiClient.request('/platform/accessibility/checklist') }
