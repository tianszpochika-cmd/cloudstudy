export const V2_UI_STATES = Object.freeze(['loading', 'empty', 'error', 'permission', 'recovery', 'offline', 'success', 'partial'] as const)
export type V2UiState = (typeof V2_UI_STATES)[number]

export interface V2UiStateMeta {
  readonly role: 'status' | 'alert'
  readonly icon: string
  readonly messageKey: `common.state.${V2UiState}`
  readonly actionKey: 'retry' | 'login' | 'restore' | 'none'
}

const STATE_META: Readonly<Record<V2UiState, V2UiStateMeta>> = Object.freeze({
  loading: { role: 'status', icon: '…', messageKey: 'common.state.loading', actionKey: 'none' },
  empty: { role: 'status', icon: '○', messageKey: 'common.state.empty', actionKey: 'none' },
  error: { role: 'alert', icon: '!', messageKey: 'common.state.error', actionKey: 'retry' },
  permission: { role: 'alert', icon: '⌁', messageKey: 'common.state.permission', actionKey: 'login' },
  recovery: { role: 'status', icon: '↻', messageKey: 'common.state.recovery', actionKey: 'restore' },
  offline: { role: 'status', icon: '⌁', messageKey: 'common.state.offline', actionKey: 'retry' },
  success: { role: 'status', icon: '✓', messageKey: 'common.state.success', actionKey: 'none' },
  partial: { role: 'status', icon: '◐', messageKey: 'common.state.partial', actionKey: 'restore' },
})

const ALIASES: Readonly<Record<string, V2UiState>> = Object.freeze({ ready: 'success', forbidden: 'permission', recovering: 'recovery', stale: 'recovery', degraded: 'partial', limited: 'partial' })

export function normalizeV2UiState(value: unknown, fallback: V2UiState = 'error'): V2UiState {
  if (typeof value !== 'string') return fallback
  return (V2_UI_STATES as readonly string[]).includes(value) ? value as V2UiState : ALIASES[value] ?? fallback
}

export function getV2UiStateMeta(value: unknown): V2UiStateMeta {
  return STATE_META[normalizeV2UiState(value)]
}
