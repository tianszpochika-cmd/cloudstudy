import type { GeneratedApiOperationId, GeneratedApiOperationRegistry } from './generated'

export * from './generated'
export * from './errors'
export * from './gateway-test-double'

export interface ApiClientRequestOptions<TBody = unknown> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: HeadersInit
  body?: TBody
  signal?: AbortSignal
}

export interface ApiClient {
  request<TResponse>(path: string, options?: ApiClientRequestOptions): Promise<TResponse>
}

type GeneratedOperation<TOperation extends GeneratedApiOperationId> = GeneratedApiOperationRegistry[TOperation]

type ResolveOpenApiPath<TPath> = TPath extends string
  ? TPath extends `${infer Prefix}{${string}}${infer Suffix}`
    ? `${Prefix}${string}${ResolveOpenApiPath<Suffix>}`
    : TPath
  : never

/** A concrete client path derived from an OpenAPI route template. */
export type ApiClientOperationPath<TOperation extends GeneratedApiOperationId> =
  ResolveOpenApiPath<GeneratedOperation<TOperation>['path']>

/**
 * Contract-bound options for a generated operation. A route without a request
 * body exposes `body?: never`; a required OpenAPI request body stays required
 * to callers of requestApiOperation.
 */
export type ApiClientOperationRequestOptions<TOperation extends GeneratedApiOperationId> =
  Omit<ApiClientRequestOptions, 'method' | 'body'>
  & { method: GeneratedOperation<TOperation>['method'] }
  & (GeneratedOperation<TOperation>['request'] extends never
    ? { body?: never }
    : GeneratedOperation<TOperation>['requestBodyRequired'] extends true
      ? { body: GeneratedOperation<TOperation>['request'] }
      : { body?: GeneratedOperation<TOperation>['request'] })

/**
 * Call an OpenAPI operation with its generated request and response types.
 * The legacy request method remains intentionally broad for historical routes;
 * new contract-first callers should use this helper.
 */
export function requestApiOperation<TOperation extends GeneratedApiOperationId>(
  client: ApiClient,
  _operationId: TOperation,
  path: ApiClientOperationPath<TOperation>,
  options: ApiClientOperationRequestOptions<TOperation>,
): Promise<GeneratedOperation<TOperation>['response']> {
  return client.request<GeneratedOperation<TOperation>['response']>(path, options)
}

export * from './unavailable'
