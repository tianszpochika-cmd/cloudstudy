import { designTokens } from '@englishflow/design-tokens'

const officialSiteTokenVariables: Record<string, string> = {
  '--ef-color-brand-primary': `var(--ef-color-action-primary, ${designTokens.semantic.light.color.action.primary})`,
  '--ef-color-brand-secondary': `var(--ef-color-action-secondary, ${designTokens.semantic.light.color.action.secondary})`,
  '--ef-color-surface-page': `var(--ef-color-background-canvas, ${designTokens.semantic.light.color.background.canvas})`,
  '--ef-color-surface-card': `var(--ef-color-background-surface, ${designTokens.semantic.light.color.background.surface})`,
  '--ef-color-text-primary': designTokens.semantic.light.color.text.primary,
  '--ef-color-text-secondary': designTokens.semantic.light.color.text.secondary,
  '--ef-color-line': `var(--ef-color-border-default, ${designTokens.semantic.light.color.border.default})`,
  '--ef-color-focus': `var(--ef-color-border-focus, ${designTokens.semantic.light.color.border.focus})`,
  '--ef-color-success': `var(--ef-color-status-success, ${designTokens.semantic.light.color.status.success})`,
  '--ef-color-warning': `var(--ef-color-status-warning, ${designTokens.semantic.light.color.status.warning})`,
  '--ef-color-danger': `var(--ef-color-status-danger, ${designTokens.semantic.light.color.status.danger})`,
  '--ef-color-info': `var(--ef-color-status-info, ${designTokens.semantic.light.color.status.info})`,
  '--ef-radius-card': designTokens.radius.card,
  '--ef-radius-button': designTokens.radius.button,
  '--ef-touch-target': designTokens.accessibility.minTouchTarget,
  '--ef-shadow-card': `var(--ef-shadow-surface, ${designTokens.semantic.light.shadow.surface})`,
  '--ef-shadow-float': `var(--ef-shadow-surface, ${designTokens.semantic.light.shadow.surface})`,
}

export function renderOfficialSiteTokenStyle(): string {
  return Object.entries(officialSiteTokenVariables)
    .map(([name, value]) => `${name}:${value}`)
    .join(';')
}
