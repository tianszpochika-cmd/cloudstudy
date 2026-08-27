import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..')
const read = (file) => readFile(join(root, file), 'utf8')

async function exists(file) {
  try {
    await readFile(join(root, file))
    return true
  } catch {
    return false
  }
}

async function collect(directory) {
  const entries = await readdir(join(root, directory), { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const file = join(directory, entry.name)
    if (entry.isDirectory() && !['.nuxt', '.output', 'node_modules', 'dist', 'tests'].includes(entry.name)) files.push(...await collect(file))
    else if (/\.(mjs|ts|vue)$/.test(entry.name)) files.push(file)
  }
  return files
}

const applications = [
  { id: 'learner-web', root: 'apps/learner-web', gateway: 'apps/learner-web/src/platform/gateway.ts', foundation: 'apps/learner-web/src/platform/v2-foundation.ts' },
  { id: 'mobile', root: 'apps/mobile', gateway: 'apps/mobile/src/platform/gateway.ts', foundation: 'apps/mobile/src/platform/v2-foundation.ts' },
  { id: 'admin-web', root: 'apps/admin-web', gateway: 'apps/admin-web/src/platform/gateway.ts', foundation: 'apps/admin-web/src/platform/v2-foundation.ts' },
  { id: 'official-site', root: 'apps/official-site', gateway: 'apps/official-site/utils/gateway.ts', foundation: 'apps/official-site/utils/v2-foundation.ts' },
]

test('B18 keeps the four frontend projects on distinct platform adapters and one Gateway seam', async () => {
  for (const app of applications) {
    assert.equal(await exists(app.gateway), true, `${app.id} gateway seam is missing`)
    assert.equal(await exists(app.foundation), true, `${app.id} shared foundation adapter is missing`)
    const source = `${await read(app.gateway)}\n${await read(app.foundation)}`
    assert.match(source, /Gateway|gateway/i, `${app.id} has no Gateway reference`)
    assert.match(source, /locale|i18n/i, `${app.id} has no locale reference`)
    assert.match(source, /theme|Theme/i, `${app.id} has no theme reference`)
  }
})

test('B18 learner and mobile preserve the Phase 1 first-day learning loop and recovery routes', async () => {
  const learnerRouter = await read('apps/learner-web/src/router/index.ts')
  const learnerApi = await read('apps/learner-web/src/api/learner-content.ts')
  const mobilePages = await read('apps/mobile/src/pages.json')
  const mobileApi = await read('apps/mobile/src/api/learner-content.ts')
  for (const path of ['/login', '/onboarding', '/assessment', '/home', '/today', '/learn', '/practice']) assert.match(learnerRouter, new RegExp(`path: ['"]${path.replace('/', '\\/')}['"]`), `learner route ${path} missing`)
  for (const path of ['pages/login/login', 'pages/onboarding/onboarding', 'pages/assessment/assessment', 'pages/home/home', 'pages/today/today', 'pages/learn/learn', 'pages/practice/practice']) assert.match(mobilePages, new RegExp(`path": "${path.replaceAll('/', '\\/')}"`), `mobile page ${path} missing`)
  for (const source of [learnerApi, mobileApi]) {
    assert.match(source, /learner|content/i)
    assert.match(source, /Idempotency-Key|idempotency/i)
    assert.match(source, /contentLocale/)
    assert.match(source, /error|recovery|unavailable/i)
  }
  assert.match(learnerRouter, /LearningLoopPage/) 
  assert.match(learnerRouter, /CoursesPage/)
})

test('B18 admin exposes permission-scoped operations and recovery surfaces', async () => {
  const router = await read('apps/admin-web/src/router/index.ts')
  const source = (await Promise.all((await collect('apps/admin-web/src')).map(read))).join('\n')
  for (const permission of ['admin.dashboard.read', 'admin.content.read', 'admin.commerce.read', 'admin.audit.read']) assert.match(router, new RegExp(permission.replaceAll('.', '\\.')))
  for (const term of ['permission', 'forbidden', 'approval|approve', 'audit', 'recovery|retry', 'Idempotency-Key|idempotency']) assert.match(source, new RegExp(term, 'i'), `admin missing ${term}`)
  assert.match(router, /admin\.support\.read/)
  assert.match(source, /AdminSupportView|SUPPORT_RESOLVE/)
  assert.doesNotMatch(source, /headers\.set\(['"]X-(?:Role|Tenant|Owner)/i)
})

test('B18 official site is a public projection with controlled deep links and no business writes', async () => {
  const files = await collect('apps/official-site')
  const source = (await Promise.all(files.map(read))).join('\n')
  assert.match(source, /public-projection/i)
  assert.match(source, /PUBLIC_PROJECTION_UNAVAILABLE|empty-fallback|memory-cache/i)
  assert.match(source, /safeOfficialReturnTo|safe.*ReturnTo/i)
  assert.doesNotMatch(source, /Math\.random|X-Role|X-Tenant|X-Owner|tenantId|ownerId/i)
  assert.doesNotMatch(source, /createOrder|createPayment|createEntitlement|paymentCallback|webhook/i)
  assert.doesNotMatch(source, /method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)/i)
  assert.match(source, /announcements/i)
})

test('B18 shared foundation separates UI locale from content locale and exposes all required themes', async () => {
  const i18n = await read('packages/i18n/src/index.ts')
  const adapters = await read('packages/i18n/src/adapters.ts')
  const tokens = await read('packages/design-tokens/src/index.ts')
  const tokenAdapters = await read('packages/design-tokens/src/adapters.ts')
  for (const source of [i18n]) {
    assert.match(source, /contentLocale/)
    assert.match(source, /fallback/i)
    assert.match(source, /pseudo/i)
    assert.match(source, /format(Number|Date|Plural)/)
  }
  assert.match(adapters, /contentLocale/)
  assert.match(adapters, /restore/)
  for (const source of [tokens]) {
    assert.match(source, /light/)
    assert.match(source, /dark/)
    assert.match(source, /system/)
    assert.match(source, /high-contrast/)
    assert.match(source, /focus|contrast/i)
  }
  assert.match(tokenAdapters, /noFlashScript|variables/)
})

test('B18 keeps Phase 2 AI and Phase 3 K12 out of default frontend routes and gates', async () => {
  const files = (await Promise.all(applications.map((app) => collect(app.root)))).flat()
  const source = (await Promise.all(files.map(read))).join('\n')
  assert.doesNotMatch(source, /ai-orchestrator|realtime-voice|guardian-service|institution-service|curriculum-rights-service/i)
})
