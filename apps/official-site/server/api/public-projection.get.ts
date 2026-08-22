import { EMPTY_PUBLIC_PROJECTION, normalizePublicProjectionResponse, resolvePublicUiLocale, type PublicProjectionResponse, type PublicUiLocale } from '~/utils/public-projection'

type PublicGatewayResponse = {
  readonly ok: boolean
  readonly status: number
  json(): Promise<unknown>
}
type PublicGatewayRequest = (input: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<PublicGatewayResponse>

const lastGoodProjectionByLocale = new Map<PublicUiLocale, PublicProjectionResponse>()

function joinPath(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export default defineEventHandler(async (event): Promise<PublicProjectionResponse> => {
  const config = useRuntimeConfig(event)
  const query = getQuery(event)
  const locale = resolvePublicUiLocale(query.locale)
  const projectionPath = String(config.public.publicProjectionPath || '/public/site/projection')
  const gatewayUrl = joinPath(String(config.public.gatewayBaseUrl || 'http://127.0.0.1:18070/api/v1'), projectionPath)
  setResponseHeader(event, 'cache-control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=300')
  setResponseHeader(event, 'vary', 'Accept-Language')

  try {
    const request = Reflect.get(globalThis, 'fetch') as PublicGatewayRequest | undefined
    if (typeof request !== 'function') throw new Error('SSR public request unavailable')
    const response = await request(gatewayUrl + `?uiLocale=${encodeURIComponent(locale)}`, { headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`PUBLIC_PROJECTION_HTTP_${response.status}`)
    const result: PublicProjectionResponse = { ...normalizePublicProjectionResponse(await response.json(), locale), source: 'gateway', stale: false, errorCode: null }
    if (result.state === 'ready') lastGoodProjectionByLocale.set(locale, result)
    setResponseHeader(event, 'x-public-projection-source', 'gateway')
    return result
  } catch (error) {
    const lastGoodProjection = lastGoodProjectionByLocale.get(locale)
    if (lastGoodProjection) {
      const stale: PublicProjectionResponse = { ...lastGoodProjection, state: 'recovery', stale: true, source: 'memory-cache', errorCode: 'PUBLIC_PROJECTION_STALE' }
      setResponseHeader(event, 'x-public-projection-source', 'memory-cache')
      return stale
    }
    const fallback: PublicProjectionResponse = { projection: EMPTY_PUBLIC_PROJECTION, state: 'error', stale: false, source: 'empty-fallback', errorCode: 'PUBLIC_PROJECTION_UNAVAILABLE' }
    setResponseHeader(event, 'x-public-projection-source', 'empty-fallback')
    return fallback
  }
})
