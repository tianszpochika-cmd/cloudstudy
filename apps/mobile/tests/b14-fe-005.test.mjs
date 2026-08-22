import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..', '..')
const read = (path) => readFile(join(root, path), 'utf8')

test('mobile uses one Gateway base URL seam and no insecure random fallback', async () => {
  const gateway = await read('apps/mobile/src/platform/gateway.ts')
  const client = await read('apps/mobile/src/api/client.ts')
  const auth = await read('apps/mobile/src/auth/gateway-auth.ts')
  assert.match(gateway, /VITE_GATEWAY_BASE_URL/)
  assert.match(client, /getGatewayBaseUrl\(\)/)
  assert.match(auth, /getGatewayBaseUrl\(\)/)
  assert.doesNotMatch(`${gateway}\n${client}\n${auth}`, /Math\.random/)
})

test('mobile validates and recovers safe deep-link returnTo', async () => {
  const gateway = await read('apps/mobile/src/platform/gateway.ts')
  const auth = await read('apps/mobile/src/auth/gateway-auth.ts')
  const login = await read('apps/mobile/src/pages/login/login.vue')
  const callback = await read('apps/mobile/src/pages/auth-callback/auth-callback.vue')
  assert.match(gateway, /safeInternalReturnTo/)
  assert.match(gateway, /%\(\?:2f\|5c\)/)
  assert.match(auth, /safeInternalReturnTo/)
  assert.match(`${login}\n${callback}`, /returnTo/)
})

test('mobile exposes canonical eight states, closed gates, and preference restore', async () => {
  const state = await read('apps/mobile/src/platform/ui-state.ts')
  const gate = await read('apps/mobile/src/platform/feature-gates.ts')
  const foundation = await read('apps/mobile/src/platform/v2-foundation.ts')
  const main = await read('apps/mobile/src/main.ts')
  for (const value of ['loading', 'empty', 'error', 'permission', 'recovery', 'offline', 'success', 'partial']) assert.match(state, new RegExp(value))
  assert.match(gate, /=== true/)
  assert.match(foundation, /common: .*state:/s)
  assert.match(main, /mobileI18nAdapter\.restore\(\)/)
  assert.match(main, /mobileThemeController\.restore\(\)/)
})

test('mobile does not send client authority facts or use Math.random', async () => {
  const source = await Promise.all([
    'apps/mobile/src/api/client.ts',
    'apps/mobile/src/api/b13.ts',
    'apps/mobile/src/auth/gateway-auth.ts',
  ].map(read)).then((parts) => parts.join('\n'))
  assert.doesNotMatch(source, /Math\.random|X-Role|X-Tenant|X-Owner|tenantId|ownerId/i)
})
