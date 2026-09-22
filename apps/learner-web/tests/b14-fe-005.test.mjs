import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..', '..')
const read = (path) => readFile(join(root, path), 'utf8')

test('learner-web uses one Gateway base URL seam and no insecure random fallback', async () => {
  const gateway = await read('apps/learner-web/src/platform/gateway.ts')
  const client = await read('apps/learner-web/src/api/client.ts')
  const session = await read('apps/learner-web/src/stores/session.ts')
  assert.match(gateway, /VITE_GATEWAY_BASE_URL/)
  assert.match(gateway, /normalizeGatewayBaseUrl/)
  assert.match(client, /getGatewayBaseUrl\(\)/)
  assert.match(session, /getGatewayBaseUrl\(\)/)
  assert.doesNotMatch(`${gateway}\n${client}\n${session}`, /Math\.random/)
})

test('learner-web validates and recovers internal returnTo before login navigation', async () => {
  const gateway = await read('apps/learner-web/src/platform/gateway.ts')
  const auth = await read('apps/learner-web/src/auth/gateway-auth.ts')
  const login = await read('apps/learner-web/src/pages/LoginPage.vue')
  assert.match(gateway, /safeInternalReturnTo/)
  assert.match(gateway, /%\(\?:2f\|5c\)/)
  assert.match(auth, /safeInternalReturnTo/)
  assert.match(login, /identifier|password/)
  assert.doesNotMatch(`${auth}\n${login}`, /auth\/callback|authorizationCode|codeVerifier|codeChallenge|nonce/i)
})

test('learner-web exposes canonical eight states, closed gates, and preference restore', async () => {
  const state = await read('apps/learner-web/src/platform/ui-state.ts')
  const gate = await read('apps/learner-web/src/platform/feature-gates.ts')
  const foundation = await read('apps/learner-web/src/platform/v2-foundation.ts')
  const main = await read('apps/learner-web/src/main.ts')
  const router = await read('apps/learner-web/src/router/index.ts')
  for (const value of ['loading', 'empty', 'error', 'permission', 'recovery', 'offline', 'success', 'partial']) assert.match(state, new RegExp(value))
  assert.match(gate, /=== true/)
  assert.match(foundation, /messages: learnerBaseMessages/)
  assert.match(await read('packages/i18n/src/learner-base.ts'), /common: .*state:/s)
  assert.match(main, /learnerI18nAdapter\.restore\(\)/)
  assert.match(main, /learnerThemeController\.restore\(\)/)
  assert.match(router, /isFeatureEnabled\('learner\.preview'\)/)
})

test('learner-web does not send client authority facts', async () => {
  const source = await Promise.all([
    'apps/learner-web/src/api/client.ts',
    'apps/learner-web/src/api/b13.ts',
    'apps/learner-web/src/auth/gateway-auth.ts',
  ].map(read)).then((parts) => parts.join('\n'))
  assert.doesNotMatch(source, /Math\.random|X-Role|X-Tenant|X-Owner|tenantId|ownerId/i)
})

test('learner-web protects the settings root before redirecting to the profile section', async () => {
  const router = await read('apps/learner-web/src/router/index.ts')
  assert.match(router, /path: '\/settings',[\s\S]*?name: 'settings-root',[\s\S]*?requiresAuth: true/)
  assert.match(router, /redirect: \{ name: 'settings', params: \{ section: 'profile' \} \}/)
})

test('learner-web schedules a login redirect after a successful logout', async () => {
  const auth = await read('apps/learner-web/src/auth/gateway-auth.ts')
  const settings = await read('apps/learner-web/src/pages/SettingsPage.vue')
  const session = await read('apps/learner-web/src/stores/session.ts')
  assert.match(auth, /client\.post\('\/auth\/logout'/)
  assert.match(session, /await adapter\(\)\.logout\(\{ allDevices \}\)[\s\S]*?clear\(\)/)
  assert.match(settings, /await session\.logout\(\); await router\.replace\(\{ name: 'login' \}\)/)
})
