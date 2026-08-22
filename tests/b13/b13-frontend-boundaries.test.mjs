import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..', '..')
const absolute = (file) => path.join(root, file)
const read = (file) => fs.readFileSync(absolute(file), 'utf8')
const readJson = (file) => JSON.parse(read(file))

const apps = [
  {
    name: 'learner-web',
    package: 'apps/learner-web/package.json',
    foundation: 'apps/learner-web/src/platform/v2-foundation.ts',
    api: 'apps/learner-web/src/api/b5.ts',
    surface: 'apps/learner-web/src/pages/B5CommercePage.vue',
  },
  {
    name: 'mobile',
    package: 'apps/mobile/package.json',
    foundation: 'apps/mobile/src/platform/v2-foundation.ts',
    api: 'apps/mobile/src/api/b5.ts',
    surface: 'apps/mobile/src/pages/b5-commerce/b5-commerce.vue',
  },
  {
    name: 'admin-web',
    package: 'apps/admin-web/package.json',
    foundation: 'apps/admin-web/src/platform/v2-foundation.ts',
    api: 'apps/admin-web/src/api/b5.ts',
    surface: 'apps/admin-web/src/views/AdminCommerceView.vue',
  },
  {
    name: 'official-site',
    package: 'apps/official-site/package.json',
    foundation: 'apps/official-site/utils/v2-foundation.ts',
    api: 'apps/official-site/server/api/public-projection.get.ts',
    surface: 'apps/official-site/pages/pricing.vue',
  },
]

test('all four frontend projects use the shared i18n/design-token foundations and separate UI/content locale', () => {
  for (const app of apps) {
    const packageJson = readJson(app.package)
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }
    assert.ok(dependencies['@englishflow/i18n'], `${app.name} must depend on shared i18n`)
    assert.ok(dependencies['@englishflow/design-tokens'], `${app.name} must depend on shared design tokens`)

    const foundation = read(app.foundation)
    assert.match(foundation, /@englishflow\/i18n/, `${app.name} must consume shared i18n`)
    assert.match(foundation, /@englishflow\/design-tokens/, `${app.name} must consume shared design tokens`)
    assert.match(foundation, /contentLocale/, `${app.name} must keep contentLocale separate from UI locale`)
    assert.match(foundation, /locale/, `${app.name} must define a UI locale`)
  }
})

for (const app of apps.slice(0, 3)) {
  test(`${app.name} commerce surface uses the B13 Gateway contract, idempotency and server facts`, () => {
    const api = read(app.api)
    const surface = read(app.surface)
    assert.match(api, /\/commerce\/(?:skus|orders|entitlements\/me)/, `${app.name} must use Gateway commerce routes`)
    assert.match(api, /Idempotency-Key/, `${app.name} writes must carry Idempotency-Key`)
    assert.match(api, /payment-intents/, `${app.name} must use B13 payment-intents rather than the legacy payment-attempts route`)
    assert.doesNotMatch(api, /Math\.random/, `${app.name} idempotency keys must not depend on Math.random`)
    assert.doesNotMatch(`${api}\n${surface}`, /tenantId|ownerId|X-Role|X-Tenant|X-Owner|permissions\s*[:=]|roles\s*[:=]/i, `${app.name} must not accept client authority facts`)
    assert.match(surface, /loading|error|empty/i, `${app.name} commerce UI must expose a non-ready state`)
  })
}

test('official site consumes only the public projection and uses controlled, tokenized public UI', () => {
  const projection = read('apps/official-site/utils/public-projection.ts')
  const server = read('apps/official-site/server/api/public-projection.get.ts')
  const pricing = read('apps/official-site/pages/pricing.vue')
  const links = read('apps/official-site/utils/public-links.mjs')
  const designSystem = read('apps/official-site/utils/design-system.ts')

  assert.match(projection, /normalizePublicProjectionResponse|PublicSkuProjection|PublicCampaignProjection/)
  assert.match(server, /publicProjectionPath|gatewayBaseUrl|memory-cache|empty-fallback/)
  assert.match(pricing, /PublicSkuCard|pricingLink|intent: 'review'/)
  assert.doesNotMatch(`${projection}\n${server}\n${pricing}`, /createOrder|createPayment|createEntitlement|orderService|paymentService/i)
  assert.doesNotMatch(`${server}\n${pricing}`, /method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)|paymentCallback|webhook/i)
  assert.match(links, /safePublicReturnTo|safePublicHref|allowedOrigins/)
  assert.match(designSystem, /@englishflow\/design-tokens|var\(--ef-color-action-primary/)
})
