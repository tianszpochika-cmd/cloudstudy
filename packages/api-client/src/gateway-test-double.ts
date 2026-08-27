import type { ApiClient, ApiClientRequestOptions } from './index'

export interface GatewayTestRequest {
  method: NonNullable<ApiClientRequestOptions['method']>
  path: string
  headers: Record<string, string>
  body: unknown
  requestId: string
  traceId: string
  idempotencyKey?: string
}

export interface GatewayTestResponse<T = unknown> {
  status: number
  headers: Record<string, string>
  body: T
}

export type GatewayTestHandler = (request: GatewayTestRequest) => GatewayTestResponse | Promise<GatewayTestResponse>

const API_V1_PREFIX = '/api/v1/'
const UNTRUSTED_CONTEXT_HEADERS = new Set(['x-role', 'x-roles', 'x-tenant-id', 'x-owner-id', 'x-b5-role'])
let sequence = 0

function createCorrelationId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  return uuid ? `${prefix}_${uuid}` : `${prefix}_gateway_test_${++sequence}`
}

function normalizeHeaders(input: HeadersInit | undefined): Record<string, string> {
  if (!input) return {}
  if (typeof Headers !== 'undefined' && input instanceof Headers) {
    const result: Record<string, string> = {}
    input.forEach((value, key) => { result[key.toLowerCase()] = value })
    return result
  }
  if (Array.isArray(input)) return Object.fromEntries(input.map(([key, value]) => [String(key).toLowerCase(), String(value)]))
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key.toLowerCase(), String(value)]))
}

function response(status: number, body: unknown, requestId: string, traceId: string): GatewayTestResponse {
  return {
    status,
    headers: { 'content-type': 'application/json', 'x-request-id': requestId, 'x-trace-id': traceId },
    body,
  }
}

/**
 * In-process Gateway boundary for contract and browser interaction tests.
 * It intentionally exposes only /api/v1 routes and never calls a domain store.
 */
export class GatewayTestDouble implements ApiClient {
  private readonly routes = new Map<string, GatewayTestHandler>()

  register(method: NonNullable<ApiClientRequestOptions['method']>, path: string, handler: GatewayTestHandler): void {
    if (!path.startsWith(API_V1_PREFIX)) throw new Error('Gateway routes must be versioned under /api/v1')
    this.routes.set(`${method.toUpperCase()} ${path}`, handler)
  }

  async request<TResponse>(path: string, options: ApiClientRequestOptions = {}): Promise<TResponse> {
    const method = (options.method ?? 'GET').toUpperCase() as NonNullable<ApiClientRequestOptions['method']>
    const inputHeaders = normalizeHeaders(options.headers)
    const requestId = inputHeaders['x-request-id'] ?? createCorrelationId('req')
    const traceId = inputHeaders['x-trace-id'] ?? createCorrelationId('trace')

    if (!path.startsWith(API_V1_PREFIX)) {
      return response(404, { requestId, traceId, error: { code: 'DIRECT_SERVICE_ACCESS_DENIED', message: 'Use the Gateway /api/v1 boundary' } }, requestId, traceId) as TResponse
    }
    if ([...UNTRUSTED_CONTEXT_HEADERS].some((header) => inputHeaders[header] !== undefined)) {
      return response(403, { requestId, traceId, error: { code: 'UNTRUSTED_CONTEXT_HEADER', message: 'Role, tenant and owner context must come from verified identity' } }, requestId, traceId) as TResponse
    }

    const handler = this.routes.get(`${method} ${path}`)
    if (!handler) {
      return response(404, { requestId, traceId, error: { code: 'ROUTE_NOT_FOUND', message: 'No Gateway route is registered' } }, requestId, traceId) as TResponse
    }

    const request: GatewayTestRequest = {
      method,
      path,
      headers: inputHeaders,
      body: options.body,
      requestId,
      traceId,
      ...(inputHeaders['idempotency-key'] ? { idempotencyKey: inputHeaders['idempotency-key'] } : {}),
    }
    const result = await handler(request)
    return {
      ...result,
      headers: { ...result.headers, 'x-request-id': requestId, 'x-trace-id': traceId },
    } as TResponse
  }
}
