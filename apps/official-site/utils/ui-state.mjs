export const OFFICIAL_UI_STATES = Object.freeze(['loading', 'empty', 'error', 'permission', 'recovery', 'offline', 'success', 'partial'])

const ALIASES = Object.freeze({ ready: 'success', forbidden: 'permission', recovering: 'recovery', stale: 'recovery', degraded: 'partial', limited: 'partial' })

const STATE_META = Object.freeze({
  loading: { role: 'status', icon: '…', messageKey: 'common.state.loading', actionKey: 'none' },
  empty: { role: 'status', icon: '○', messageKey: 'common.state.empty', actionKey: 'none' },
  error: { role: 'alert', icon: '!', messageKey: 'common.state.error', actionKey: 'retry' },
  permission: { role: 'alert', icon: '⌁', messageKey: 'common.state.permission', actionKey: 'login' },
  recovery: { role: 'status', icon: '↻', messageKey: 'common.state.recovery', actionKey: 'restore' },
  offline: { role: 'status', icon: '⌁', messageKey: 'common.state.offline', actionKey: 'retry' },
  success: { role: 'status', icon: '✓', messageKey: 'common.state.success', actionKey: 'none' },
  partial: { role: 'status', icon: '◐', messageKey: 'common.state.partial', actionKey: 'restore' },
})

export function normalizeOfficialUiState(value, fallback = 'error') {
  if (typeof value !== 'string') return fallback
  return OFFICIAL_UI_STATES.includes(value) ? value : ALIASES[value] || fallback
}

export function getOfficialUiStateMeta(value) {
  return STATE_META[normalizeOfficialUiState(value)]
}
