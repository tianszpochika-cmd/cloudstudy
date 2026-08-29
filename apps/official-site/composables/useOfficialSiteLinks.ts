import { appendCampaignParams, buildLearnerLink, buildLearnerLoginLink, preserveCampaignParams, safePublicHref } from '~/utils/public-links.mjs'
import { officialI18nAdapter, officialThemeController } from '~/utils/v2-foundation'

export function useOfficialSiteLinks() {
  const route = useRoute()
  const config = useRuntimeConfig()
  const learnerWebUrl = String(config.public.learnerWebUrl || '/')
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
    // The official site only creates a controlled navigation to the shared
    // learner login page. It never receives, stores, or forwards business tokens.
    return buildLearnerLoginLink(learnerWebUrl, { returnTo, locale: officialI18nAdapter.state.locale, theme: officialThemeController.theme, campaignParams: campaignParams() })
  }

  function publicLink(value: string | null | undefined, fallback: string | null = null) {
    const safe = safePublicHref(value, { siteUrl: String(config.public.siteUrl || '/'), learnerWebUrl, allowedOrigins: configuredOrigins, fallback })
    return appendCampaignParams(safe, route.query)
  }

  return { learnerLink, authLink, publicLink, campaignParams }
}
