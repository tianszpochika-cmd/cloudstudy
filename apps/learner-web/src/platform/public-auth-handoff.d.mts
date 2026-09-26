export type PublicAuthHandoffLocale = 'zh-CN' | 'en-US'
export type PublicAuthHandoffTheme = 'system' | 'light' | 'dark' | 'high-contrast'
export interface PublicAuthHandoff {
  readonly uiLocale?: PublicAuthHandoffLocale
  readonly theme?: PublicAuthHandoffTheme
  readonly returnTo?: string
}
export interface PublicAuthHandoffActions {
  readonly setUiLocale?: (locale: PublicAuthHandoffLocale) => unknown
  readonly setTheme?: (theme: PublicAuthHandoffTheme) => unknown
}
export function resolvePublicAuthHandoff(pathname: unknown, query?: string | URLSearchParams | Readonly<Record<string, unknown>> | null): PublicAuthHandoff | null
export function applyPublicAuthHandoff(handoff: PublicAuthHandoff | null | undefined, actions?: PublicAuthHandoffActions): PublicAuthHandoff | null
