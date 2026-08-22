export type PhaseCode = 'P1' | 'P2' | 'P3'

export interface ServerGateSnapshot {
  readonly phaseGates?: Readonly<Record<string, boolean>>
  readonly featureFlags?: Readonly<Record<string, boolean>>
}

function snapshot(value: unknown): ServerGateSnapshot {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as ServerGateSnapshot : {}
}

/** The public site never opens a product gate from query parameters or local storage. */
export function isPhaseGateEnabled(phase: PhaseCode, value: unknown = undefined): boolean {
  return snapshot(value).phaseGates?.[phase] === true
}

export function isFeatureEnabled(feature: string, value: unknown = undefined): boolean {
  return Boolean(feature.trim()) && snapshot(value).featureFlags?.[feature] === true
}
