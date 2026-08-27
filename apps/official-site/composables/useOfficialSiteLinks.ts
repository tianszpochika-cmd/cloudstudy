import { appendCampaignParams, buildGatewayAuthLink, buildLearnerLink, preserveCampaignParams, safePublicHref } from '~/utils/public-links.mjs'
import { officialI18nAdapter, officialThemeController } from '~/utils/v2-foundation'
import { resolveGatewayBaseUrl } from '~/utils/gateway'

export function useOfficialSiteLinks() {
  const route = useRoute()
  const config = useRuntimeConfig()
  const learnerWebUrl = String(config.public.learnerWebUrl || '/')
  const gatewayBaseUrl = resolveGatewayBaseUrl(config.public.gatewayBaseUrl)
  const configuredOrigins = Array.isArray(config.public.publicLinkOrigins)
    ? config.public.publicLinkOrigins.map(String)
    : String(config.public.publicLinkOrigins || '').split(',').map((value) => value.trim()).filter(Boolean)

  function campaignParams() {
    return preserveCampaignParams(route.query)
  }

  function learnerLink(path = '/', params: Record<string, string | undefined> = {}) {
    return buildLearnerLink(learnerWebUrl, path, { ...campaignParams(), ...params })
  }

  function authLink(returnTo = '/home') {
    // Keep SSR and the first client render deterministic. The browser's system
    // preference may differ from the server, while the Gateway contract also
    // accepts the unresolved `system` mode and can resolve it at the boundary.
    return buildGatewayAuthLink(gatewayBaseUrl, { returnTo, locale: officialI18nAdapter.state.locale, theme: officialThemeController.theme, redirectUri: buildLearnerLink(learnerWebUrl, '/auth/callback'), campaignParams: campaignParams() })
  }

  function publicLink(value: string | null | undefined, fallback: string | null = null) {
    const safe = safePublicHref(value, { siteUrl: String(config.public.siteUrl || '/'), learnerWebUrl, allowedOrigins: configuredOrigins, fallback })
    return appendCampaignParams(safe, route.query)
  }

  return { learnerLink, authLink, publicLink, campaignParams }
}
