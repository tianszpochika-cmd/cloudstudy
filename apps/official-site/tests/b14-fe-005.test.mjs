import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..', '..')
const read = (path) => readFile(join(root, path), 'utf8')

async function collect(directory) {
  const entries = await readdir(join(root, directory), { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory() && !['.nuxt', '.output', 'node_modules', 'dist'].includes(entry.name)) files.push(...await collect(path))
    else if (/\.(mjs|ts|vue)$/.test(entry.name)) files.push(path)
  }
  return files
}

test('official site reads a controlled Gateway base URL and restores locale/theme', async () => {
  const gateway = await read('apps/official-site/utils/gateway.ts')
  const links = await read('apps/official-site/composables/useOfficialSiteLinks.ts')
  const foundation = await read('apps/official-site/utils/v2-foundation.ts')
  const app = await read('apps/official-site/app.vue')
  assert.match(gateway, /resolveGatewayBaseUrl/)
  assert.match(links, /resolveGatewayBaseUrl/)
  assert.match(foundation, /localeStorage: browserStorage/)
  assert.match(foundation, /storage: browserStorage/)
  assert.match(app, /officialI18nAdapter\.restore\(\)/)
  assert.match(app, /officialThemeController\.restore\(\)/)
})

test('official site applies explicit URL locale/theme preferences after restore', async () => {
  const app = await read('apps/official-site/app.vue')
  const header = await read('apps/official-site/components/SiteHeader.vue')
  assert.match(app, /route\.query\.locale/)
  assert.match(app, /route\.query\.theme/)
  assert.match(app, /resolvePublicUiLocale/)
  assert.match(app, /resolvePublicThemeMode/)
  assert.match(header, /officialI18nAdapter\.subscribe/)
  assert.match(header, /loginLabel/)
})

test('official site exposes all eight state semantics without color-only status', async () => {
  const state = await read('apps/official-site/utils/public-state.mjs')
  const helper = await read('apps/official-site/utils/ui-state.mjs')
  for (const value of ['loading', 'empty', 'error', 'permission', 'recovery', 'offline', 'success', 'partial']) {
    assert.match(`${state}\n${helper}`, new RegExp(value))
  }
  assert.match(state, /toPublicUiState/)
  assert.match(state, /icon:/)
  assert.match(state, /role:/)
})

test('official site remains public read-only and has no client authority facts', async () => {
  const files = [
    'apps/official-site/app.vue',
    ...(await Promise.all(['pages', 'components', 'composables', 'utils', 'server'].map((directory) => collect(`apps/official-site/${directory}`)))).flat(),
  ]
  const source = (await Promise.all(files.map(read))).join('\n')
  assert.doesNotMatch(source, /Math\.random|X-Role|X-Tenant|X-Owner|tenantId|ownerId/i)
  assert.doesNotMatch(source, /createOrder|createPayment|createEntitlement|paymentCallback|webhook/i)
  assert.doesNotMatch(source, /method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)/i)
})
