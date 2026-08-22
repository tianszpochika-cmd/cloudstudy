import { apiClient } from './client'

export async function getB6ReleaseMatrix(): Promise<unknown> { return apiClient.get('/platform/release-matrix') }
export async function getB6PerformanceBudget(): Promise<unknown> { return apiClient.get('/platform/performance/budget') }
export async function getB6AccessibilityChecklist(): Promise<unknown> { return apiClient.get('/platform/accessibility/checklist') }
export async function getB6ResponsiveChecklist(): Promise<unknown> { return apiClient.get('/platform/responsive/checklist') }
export async function getB6ObservabilityDashboard(): Promise<unknown> { return apiClient.get('/observability/dashboard') }
