import { onMounted, onServerPrefetch, useRequestFetch, useState } from '#imports'
import { EMPTY_PUBLIC_PROJECTION, hasPublicProjectionData, resolvePublicUiLocale, type PublicProjectionResponse, type PublicUiLocale } from '~/utils/public-projection'

export function usePublicProjection(key = 'official-site', requestedLocale?: PublicUiLocale) {
  const route = useRoute()
  const locale = requestedLocale ?? resolvePublicUiLocale(route.query.locale)
  const result = useState<PublicProjectionResponse>(`public-projection:${key}:${locale}`, () => ({ projection: EMPTY_PUBLIC_PROJECTION, state: 'loading', stale: false, source: 'empty-fallback', errorCode: null }))
  let pending: Promise<void> | null = null

  async function load(): Promise<void> {
    if (pending) return pending
    pending = (async () => {
      try {
        const request = useRequestFetch()
        const response = await request<PublicProjectionResponse>('/api/public-projection', { query: { locale } })
        result.value = response
      } catch (error) {
        result.value = { projection: result.value.projection ?? EMPTY_PUBLIC_PROJECTION, state: hasPublicProjectionData(result.value.projection) ? 'recovery' : 'error', stale: hasPublicProjectionData(result.value.projection), source: result.value.source === 'gateway' ? 'memory-cache' : 'empty-fallback', errorCode: error instanceof Error ? error.message : 'PUBLIC_PROJECTION_UNAVAILABLE' }
      } finally {
        pending = null
      }
    })()
    return pending
  }

  onServerPrefetch(load)
  // Prerendered HTML is only a fast first paint. Revalidate once in the
  // browser so price, eligibility, campaign and maintenance projections do
  // not remain frozen at build time.
  onMounted(() => { void load() })

  return { projection: result, loadState: result, locale, load }
}
