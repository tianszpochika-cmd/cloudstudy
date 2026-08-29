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
  assert.match(gateway, /safeInternalReturnTo/)
  assert.match(gateway, /%\(\?:2f\|5c\)/)
  assert.match(auth, /safeInternalReturnTo/)
  assert.match(`${login}\n${auth}`, /returnTo/)
  assert.doesNotMatch(`${login}\n${auth}`, /auth\/callback|authorizationCode|codeVerifier|codeChallenge|nonce/i)
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

test('mobile deep-link pages use the shared auth gate before reading protected data', async () => {
  const pages = await Promise.all([
    'apps/mobile/src/pages/practice/practice.vue',
    'apps/mobile/src/pages/b2-vocabulary/b2-vocabulary.vue',
    'apps/mobile/src/pages/profile/profile.vue',
    'apps/mobile/src/pages/b6-platform/b6-platform.vue',
    'apps/mobile/src/pages/settings/settings.vue',
    'apps/mobile/src/pages/today/today.vue',
  ].map(read)).then((parts) => parts.join('\n'))
  assert.equal((pages.match(/ensureMobilePageAccess\('/g) ?? []).length, 6)
})

test('mobile logout clears the session and returns to the login page', async () => {
  const auth = await read('apps/mobile/src/auth/gateway-auth.ts')
    const session = await read('apps/mobile/src/stores/session.ts')
    assert.match(auth, /\/auth\/logout/)
    assert.match(session, /clear\(\)/)
    assert.match(session, /pages\/login\/login/)
})
