import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
  appendCampaignParams,
  buildLearnerLoginLink,
  buildLearnerLink,
  preserveCampaignParams,
  safePublicHref,
} from '../utils/public-links.mjs'
import { PUBLIC_EXTENDED_STATES, resolvePublicPageState, resolvePublicState } from '../utils/public-state.mjs'

const testDir = dirname(fileURLToPath(import.meta.url))
const siteRoot = join(testDir, '..')

async function collectSourceFiles(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.nuxt' || entry.name === '.output' || entry.name === 'node_modules') continue
    const absolute = join(directory, entry.name)
    if (entry.isDirectory()) await collectSourceFiles(absolute, files)
    else files.push(absolute)
  }
  return files
}

async function source(relativePath) {
  return readFile(join(siteRoot, relativePath), 'utf8')
}

test('B13 公开链接只允许受控 origin，并保留 UTM 而不接受 open redirect', () => {
  assert.equal(safePublicHref('/download', { siteUrl: 'https://www.example.test', learnerWebUrl: 'https://study.example.test' }), '/download')
  assert.equal(safePublicHref('//evil.example', { siteUrl: 'https://www.example.test' }), null)
  assert.equal(safePublicHref('javascript:alert(1)', { siteUrl: 'https://www.example.test' }), null)
  assert.equal(safePublicHref('https://evil.example', { siteUrl: 'https://www.example.test' }), null)
  assert.equal(safePublicHref('https://apps.example.test/download', { allowedOrigins: ['https://apps.example.test'] }), 'https://apps.example.test/download')

  assert.deepEqual(preserveCampaignParams({ utm_source: 'newsletter', utm_campaign: ['b13'], redirect: 'https://evil.example' }), {
    utm_source: 'newsletter',
    utm_campaign: 'b13',
  })
  assert.equal(appendCampaignParams('/pricing?intent=review', { utm_medium: 'email' }), '/pricing?intent=review&utm_medium=email')
  assert.match(buildLearnerLink('https://study.example.test', '/pricing', { skuId: 'sku-pro', utm_source: 'site' }), /skuId=sku-pro/)
  assert.match(buildLearnerLoginLink('https://study.example.test', {
    returnTo: 'https://evil.example/checkout',
    campaignParams: { utm_source: 'official' },
  }), /returnTo=%2Fhome/)
  assert.match(buildLearnerLoginLink('https://study.example.test', {
    returnTo: '/pricing?intent=review',
    campaignParams: { utm_source: 'official' },
  }), /utm_source=official/)
})

test('B13 官网状态覆盖 loading/empty/error/permission/recovery/maintenance', () => {
  for (const state of ['loading', 'empty', 'error', 'permission', 'recovery', 'maintenance']) {
    assert.equal(resolvePublicState(state), state)
  }
  assert.ok(PUBLIC_EXTENDED_STATES.includes('maintenance'))
  assert.equal(resolvePublicPageState('ready', 'maintenance', true), 'maintenance')
  assert.equal(resolvePublicPageState('ready', 'ready', false), 'empty')
  assert.equal(resolvePublicPageState('permission', 'ready', true), 'permission')
})

test('B13 官网代码包含公开 SKU/权益/活动投影，并且 CTA 只生成受控意图跳转', async () => {
  const projection = await source('utils/public-projection.ts')
  const pricing = await source('pages/pricing.vue')
  const sku = await source('components/PublicSkuCard.vue')
  const campaign = await source('components/PublicCampaignCard.vue')
  const download = await source('pages/download.vue')

  for (const token of ['PublicSkuProjection', 'PublicEntitlementProjection', 'PublicCampaignProjection', 'normalizePublicProjectionResponse', 'maintenance', 'eligibility']) {
    assert.match(projection, new RegExp(token))
  }
  assert.match(pricing, /PublicSkuCard/)
  assert.match(pricing, /jsonld-pricing-public-offers/)
  assert.match(pricing, /availability === 'available'/)
  assert.match(pricing, /intent: 'review'/)
  assert.match(sku, /entitlement-list/)
  assert.match(campaign, /safe|publicLink|authLink/)
  assert.match(download, /publicLink\(channel\.href\)/)
  assert.doesNotMatch(pricing, /createOrder|\/orders|payment|entitlement\/write/i)
})

test('B13 官网只读取公开投影，不包含订单/支付/权益写接口或客户端事实写入', async () => {
  const files = await collectSourceFiles(join(siteRoot, 'pages'))
  files.push(...await collectSourceFiles(join(siteRoot, 'composables')))
  files.push(...await collectSourceFiles(join(siteRoot, 'server')))
  const code = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n')

  assert.match(code, /public-projection/)
  assert.doesNotMatch(code, /createOrder|createPayment|createEntitlement|orderService|paymentService/i)
  assert.doesNotMatch(code, /(?:method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)|\$fetch\s*\(|useFetch\s*\()/i)
  assert.doesNotMatch(code, /(?:href|to)=\"[^\"]*\b(?:orders|checkout|payment)\b/i)
})

test('B13 官网保留 SSR/SEO/structured data、移动入口和 token 适配', async () => {
  const config = await source('nuxt.config.ts')
  const seo = await source('utils/seo.ts')
  const app = await source('app.vue')
  const css = await source('assets/css/main.css')
  const designSystem = await source('utils/design-system.ts')
  const header = await source('components/SiteHeader.vue')

  assert.match(config, /ssr: true/)
  assert.match(config, /structured|theme-color|sitemap\.xml/i)
  assert.match(seo, /application\/ld\+json/)
  assert.match(app, /englishflow-official-site-tokens/)
  assert.match(header, /aria-expanded/)
  assert.match(designSystem, /var\(--ef-color-action-primary(?:,|\))/)
  assert.match(designSystem, /var\(--ef-color-status-(?:success|warning|danger|info)(?:,|\))/)
  assert.doesNotMatch(css, /--ef-color-(?:brand-primary|brand-secondary|success|warning|danger|info):\s*#[0-9a-f]/i)
})
