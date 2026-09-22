import { officialSitePalette as palette } from './official-site'
import type { ResolvedTheme } from './index'

/** Mobile semantic roles share the approved official-site palette. */
export function mobileExperienceVariables(theme: ResolvedTheme): Record<string, string> {
  const dark = theme !== 'light'
  const high = theme === 'high-contrast'
  const p = (light: keyof typeof palette, night: keyof typeof palette = light) => palette[dark ? night : light]
  return {
    '--yx-brand': p('--yx-palette-006', '--yx-palette-025'),
    '--yx-brand-strong': p('--yx-palette-041', '--yx-palette-033'),
    '--yx-brand-soft': p('--yx-palette-007', '--yx-palette-026'),
    '--yx-action': palette['--yx-palette-006'], '--yx-on-brand': palette['--yx-palette-150'],
    '--yx-text-primary': high ? palette['--yx-palette-150'] : p('--yx-palette-003', '--yx-palette-022'),
    '--yx-text-secondary': high ? palette['--yx-palette-151'] : p('--yx-palette-004', '--yx-palette-023'),
    '--yx-text-tertiary': p('--yx-palette-004', '--yx-palette-023'),
    '--yx-surface-page': high ? palette['--yx-palette-148'] : p('--yx-palette-001', '--yx-palette-020'),
    '--yx-surface-card': high ? palette['--yx-palette-149'] : p('--yx-palette-002', '--yx-palette-021'),
    '--yx-surface-soft': p('--yx-palette-008', '--yx-palette-027'),
    '--yx-border': high ? palette['--yx-palette-151'] : p('--yx-palette-005', '--yx-palette-024'),
    '--yx-border-subtle': p('--yx-palette-005', '--yx-palette-024'),
    '--yx-focus': p('--yx-palette-006', '--yx-palette-025'),
    '--yx-success': p('--yx-palette-010', '--yx-palette-029'),
    '--yx-success-strong': p('--yx-palette-010', '--yx-palette-029'),
    '--yx-success-soft': p('--yx-palette-009', '--yx-palette-028'),
    '--yx-success-border': p('--yx-palette-075', '--yx-palette-029'),
    '--yx-warning': p('--yx-palette-012', '--yx-palette-031'),
    '--yx-warning-strong': p('--yx-palette-012', '--yx-palette-031'),
    '--yx-warning-soft': p('--yx-palette-011', '--yx-palette-030'),
    '--yx-danger': dark ? '#ffb3be' : '#a52b46',
    '--yx-danger-soft': dark ? '#432632' : '#fbeef1',
    '--yx-hero': high ? palette['--yx-palette-149'] : `linear-gradient(125deg, ${palette['--yx-palette-015']}, ${palette['--yx-palette-016']} 65%, ${palette['--yx-palette-017']})`,
    '--yx-hero-ink': palette['--yx-palette-150'], '--yx-hero-muted': palette['--yx-palette-060'],
    '--yx-art-paper': palette['--yx-palette-058'], '--yx-art-line': palette['--yx-palette-066'],
    '--yx-shadow': high ? 'none' : `0 12px 36px -28px ${p('--yx-palette-018', '--yx-palette-037')}`,
    '--yx-radius-card': '24px', '--yx-radius-button': '14px',
    '--yx-font-serif': 'Georgia, "Times New Roman", serif',
    '--yx-motion-fast': '180ms', '--yx-motion-enter': '420ms',
  }
}
