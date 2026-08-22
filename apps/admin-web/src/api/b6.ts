import { adminClient } from './client'

export async function getB6ReleaseMatrix(): Promise<unknown> { return adminClient.request('/platform/release-matrix') }
export async function getB6ObservabilityDashboard(): Promise<unknown> { return adminClient.request('/observability/dashboard') }
export async function getB6PerformanceBudget(): Promise<unknown> { return adminClient.request('/platform/performance/budget') }
export async function getB6AccessibilityChecklist(): Promise<unknown> { return adminClient.request('/platform/accessibility/checklist') }
export async function getB6ResponsiveChecklist(): Promise<unknown> { return adminClient.request('/platform/responsive/checklist') }
