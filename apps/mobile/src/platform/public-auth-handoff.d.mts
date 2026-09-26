export type MobilePublicAuthHandoffLocale = 'zh-CN' | 'en-US'
export type MobilePublicAuthHandoffTheme = 'system' | 'light' | 'dark' | 'high-contrast'
export interface MobilePublicAuthHandoff {
  readonly uiLocale?: MobilePublicAuthHandoffLocale
  readonly theme?: MobilePublicAuthHandoffTheme
  readonly returnTo?: string
}
export interface MobilePublicAuthHandoffActions {
  readonly setUiLocale?: (locale: MobilePublicAuthHandoffLocale) => unknown
  readonly setTheme?: (theme: MobilePublicAuthHandoffTheme) => unknown
}
export function mobilePublicAuthQuery(options?: { launchQuery?: Readonly<Record<string, unknown>> | URLSearchParams | string; search?: string; hash?: string }): URLSearchParams
export function resolveMobilePublicAuthHandoff(pathname: unknown, query?: string | URLSearchParams | null): MobilePublicAuthHandoff | null
export function applyMobilePublicAuthHandoff(handoff: MobilePublicAuthHandoff | null | undefined, actions?: MobilePublicAuthHandoffActions): MobilePublicAuthHandoff | null
