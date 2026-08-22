import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import test from 'node:test'

const require = createRequire(import.meta.url)
const typescript = require('typescript')
const root = resolve(import.meta.dirname, '../..')

const source = await readFile(resolve(root, 'packages/api-client/src/gateway-test-double.ts'), 'utf8')
const transpiled = typescript.transpileModule(source, {
  compilerOptions: {
    target: typescript.ScriptTarget.ES2022,
    module: typescript.ModuleKind.ESNext,
    moduleResolution: typescript.ModuleResolutionKind.Bundler,
    isolatedModules: true,
  },
}).outputText
const { GatewayTestDouble } = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(transpiled)}`)

test('Gateway test double propagates correlation/idempotency and rejects direct or forged context', async () => {
  const gateway = new GatewayTestDouble()
  gateway.register('POST', '/api/v1/platform/health', (request) => ({
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: {
      requestId: request.requestId,
      traceId: request.traceId,
      idempotencyKey: request.idempotencyKey,
    },
  }))

  const response = await gateway.request('/api/v1/platform/health', {
    method: 'POST',
    headers: {
      'X-Request-Id': 'req_b7_client_001',
      'X-Trace-Id': 'trace_b7_client_001',
      'Idempotency-Key': 'idem_b7_client_0001',
    },
  })
  assert.equal(response.status, 200)
  assert.deepEqual(response.body, {
    requestId: 'req_b7_client_001',
    traceId: 'trace_b7_client_001',
    idempotencyKey: 'idem_b7_client_0001',
  })
  assert.equal((await gateway.request('/core-api/v1/users')).status, 404)
  assert.equal((await gateway.request('/api/v1/platform/health', { headers: { 'X-Role': 'admin' } })).status, 403)
})
