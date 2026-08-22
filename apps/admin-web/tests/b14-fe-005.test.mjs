import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..', '..')
const read = (path) => readFile(join(root, path), 'utf8')

test('admin-web uses one Gateway base URL seam and strips client authority headers', async () => {
  const gateway = await read('apps/admin-web/src/platform/gateway.ts')
  const client = await read('apps/admin-web/src/api/client.ts')
  const store = await read('apps/admin-web/src/stores/admin.ts')
  assert.match(gateway, /VITE_GATEWAY_BASE_URL/)
  assert.match(client, /getGatewayBaseUrl\(\)/)
  assert.match(store, /getGatewayBaseUrl\(\)/)
  assert.match(client, /forbiddenHeaderNames/)
  assert.doesNotMatch(`${gateway}\n${client}\n${store}`, /Math\.random/)
})

test('admin-web validates and recovers safe deep-link returnTo', async () => {
  const gateway = await read('apps/admin-web/src/platform/gateway.ts')
  const auth = await read('apps/admin-web/src/auth/gateway-auth.ts')
  const callback = await read('apps/admin-web/src/views/AdminAuthCallbackView.vue')
  assert.match(gateway, /safeInternalReturnTo/)
  assert.match(gateway, /%\(\?:2f\|5c\)/)
  assert.match(auth, /safeInternalReturnTo/)
  assert.match(callback, /returnTo:/)
})

test('admin-web exposes canonical eight states, closed gates, and preference restore', async () => {
  const state = await read('apps/admin-web/src/platform/ui-state.ts')
  const gate = await read('apps/admin-web/src/platform/feature-gates.ts')
  const foundation = await read('apps/admin-web/src/platform/v2-foundation.ts')
  const main = await read('apps/admin-web/src/main.ts')
  for (const value of ['loading', 'empty', 'error', 'permission', 'recovery', 'offline', 'success', 'partial']) assert.match(state, new RegExp(value))
  assert.match(gate, /=== true/)
  assert.match(foundation, /common: .*state:/s)
  assert.match(main, /adminI18nAdapter\.restore\(\)/)
  assert.match(main, /adminThemeController\.restore\(\)/)
})

test('admin-web never trusts role or tenant input from the client', async () => {
  const client = await read('apps/admin-web/src/api/client.ts')
  const source = await Promise.all([
    'apps/admin-web/src/api/b13.ts',
    'apps/admin-web/src/auth/gateway-auth.ts',
  ].map(read)).then((parts) => parts.join('\n'))
  assert.match(client, /forbiddenHeaderNames/)
  assert.doesNotMatch(source, /Math\.random|tenantId|ownerId|headers\.set\(['"]X-(?:Role|Tenant|Owner)/i)
})
