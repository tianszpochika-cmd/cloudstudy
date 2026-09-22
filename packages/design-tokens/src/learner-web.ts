import { officialSitePalette as palette } from './official-site'
import type { ResolvedTheme } from './index'

/** Learner workspace uses the approved official-site palette, with semantic roles. */
export function learnerExperienceVariables(theme: ResolvedTheme): Record<string, string> {
  const dark = theme !== 'light'
  const high = theme === 'high-contrast'
  const p = (key: keyof typeof palette) => palette[key]
  const tokens: Record<string, string> = {
    ...palette,
    '--yx-color-brand-primary': p(dark ? '--yx-palette-025' : '--yx-palette-006'),
    '--yx-color-brand-primary-hover': p(dark ? '--yx-palette-033' : '--yx-palette-041'),
    '--yx-color-brand-primary-soft': p(dark ? '--yx-palette-026' : '--yx-palette-007'),
    '--yx-color-brand-secondary': p('--yx-palette-017'),
    '--yx-color-action': p('--yx-palette-006'),
    '--yx-color-on-brand': p('--yx-palette-150'),
    '--yx-color-text-primary': p(high ? '--yx-palette-150' : dark ? '--yx-palette-022' : '--yx-palette-003'),
    '--yx-color-text-secondary': p(high ? '--yx-palette-151' : dark ? '--yx-palette-023' : '--yx-palette-004'),
    '--yx-color-text-tertiary': p(dark ? '--yx-palette-023' : '--yx-palette-004'),
    '--yx-color-surface-page': p(high ? '--yx-palette-148' : dark ? '--yx-palette-020' : '--yx-palette-001'),
    '--yx-color-surface-card': p(high ? '--yx-palette-149' : dark ? '--yx-palette-021' : '--yx-palette-002'),
    '--yx-color-surface-muted': p(dark ? '--yx-palette-027' : '--yx-palette-008'),
    '--yx-color-border': p(high ? '--yx-palette-151' : dark ? '--yx-palette-024' : '--yx-palette-005'),
    '--yx-color-focus': p(dark ? '--yx-palette-025' : '--yx-palette-006'),
    '--yx-color-success': p(dark ? '--yx-palette-029' : '--yx-palette-010'),
    '--yx-color-success-soft': p(dark ? '--yx-palette-028' : '--yx-palette-009'),
    '--yx-color-warning': p(dark ? '--yx-palette-031' : '--yx-palette-012'),
    '--yx-color-warning-soft': p(dark ? '--yx-palette-030' : '--yx-palette-011'),
    '--yx-color-danger': dark ? '#ffb3be' : '#a52b46',
    '--yx-color-danger-soft': dark ? '#432632' : '#fbeef1',
    '--yx-hero-gradient': high ? p('--yx-palette-149') : `linear-gradient(120deg, ${p(dark ? '--yx-palette-034' : '--yx-palette-015')}, ${p('--yx-palette-016')} 70%, ${p('--yx-palette-017')})`,
    '--yx-header-background': p(dark ? '--yx-palette-038' : '--yx-palette-019'),
    '--yx-radius-card': '22px', '--yx-radius-button': '12px',
    '--yx-shadow-card': high ? 'none' : `0 10px 36px -24px ${p(dark ? '--yx-palette-037' : '--yx-palette-018')}`,
    '--yx-font-serif': 'Georgia, "Times New Roman", serif',
    '--yx-motion-fast': '160ms', '--yx-motion-enter': '380ms',
  }
  const aliases: Record<string, string> = {
    '--yx-text-primary': '--yx-color-text-primary', '--yx-text-secondary': '--yx-color-text-secondary',
    '--yx-text-muted': '--yx-color-text-tertiary', '--yx-surface-card': '--yx-color-surface-card',
    '--yx-surface-page': '--yx-color-surface-page', '--yx-surface-muted': '--yx-color-surface-muted',
    '--yx-border': '--yx-color-border', '--yx-brand-primary': '--yx-color-brand-primary',
    '--yx-brand-secondary': '--yx-color-brand-secondary', '--yx-on-brand': '--yx-color-on-brand',
    '--yx-shadow-sm': '--yx-shadow-card', '--yx-success': '--yx-color-success', '--yx-danger': '--yx-color-danger',
    '--ef-color-text-primary': '--yx-color-text-primary', '--ef-color-text-secondary': '--yx-color-text-secondary',
    '--ef-color-background-surface': '--yx-color-surface-card', '--ef-color-border-default': '--yx-color-border',
  }
  for (const [key, target] of Object.entries(aliases)) tokens[key] = `var(${target})`
  return tokens
}
