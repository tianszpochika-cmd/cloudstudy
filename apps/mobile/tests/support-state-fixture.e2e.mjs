/** Browser-only support UI fixture: empty, retry and list interactions at phone widths. */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const root = path.resolve(import.meta.dirname, '../../..')
const output = process.env.MOBILE_SUPPORT_STATE_OUTPUT || path.join(root, 'artifacts', 'uat-2026-09-23', 'screenshots', 'mobile', 'support-state-fixture')
const base = 'http://127.0.0.1:18183/#/pages/support/support'
const token = { accessToken: 'support-ui-fixture-only', adultGate: 'PASSED', deviceId: 'support-ui-device', sessionId: 'support-ui-session' }
const browser = await chromium.launch({ headless: true })
const results = []
await fs.mkdir(output, { recursive: true })

try {
  for (const width of [320, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' })
    let supportReads = 0
    let mode = 'empty'
    await context.addInitScript(() => localStorage.setItem('yx.auth.mobile.session-hint', '1'))
    await context.route('**/api/v1/**', async route => {
      const url = new URL(route.request().url())
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:18183', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key' } })
      let status = 200
      let data = {}
      if (url.pathname === '/api/v1/auth/token/refresh') data = token
      else if (url.pathname === '/api/v1/iam/permissions' || url.pathname === '/api/v1/iam/me') data = { adultGate: 'PASSED', subject: 'support-ui', permissions: ['learning.plan.read', 'support.ticket.read'] }
      else if (url.pathname === '/api/v1/support/tickets') {
        supportReads++
        if (mode === 'error') { status = 503; data = { error: { code: 'SUPPORT_FIXTURE_UNAVAILABLE' } } }
        else if (mode === 'list') data = { items: [
          { ticketId: 'fixture-101', categoryCode: 'TECHNICAL', state: 'OPEN', priority: 'NORMAL' },
          { ticketId: 'fixture-102', categoryCode: 'CONTENT_CORRECTION', state: 'IN_PROGRESS', priority: 'NORMAL' },
        ] }
        else data = { items: [] }
      } else { status = 503; data = { error: { code: 'FIXTURE_UNAVAILABLE' } } }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ data }), headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:18183', 'Access-Control-Allow-Credentials': 'true' } })
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.name))
    await page.goto(base)
    await page.getByText('暂无可见工单。', { exact: true }).waitFor({ timeout: 12000 }).catch(async () => {
      await page.screenshot({ path: path.join(output, `diagnostic-${width}.png`), fullPage: true })
      throw new Error(`empty fixture missing: route=${new URL(page.url()).hash}, supportReads=${supportReads}`)
    })
    assert.equal(supportReads, 1)
    await page.screenshot({ path: path.join(output, `empty-${width}.png`), fullPage: true })

    mode = 'error'
    await page.locator('.yx-card').last().locator('.yx-button').click()
    await page.locator('[role="alert"]').filter({ hasText: '工单暂不可用' }).waitFor({ timeout: 10000 })
    assert.equal(supportReads, 2, 'refresh must read support again')
    await page.screenshot({ path: path.join(output, `error-${width}.png`), fullPage: true })

    mode = 'list'
    await page.locator('.yx-card').last().locator('.yx-button').click()
    await page.getByText('工单 fixture-101', { exact: true }).waitFor({ timeout: 10000 })
    assert.equal(supportReads, 3, 'retry must read support again')
    assert.equal(await page.locator('.yx-ticket').count(), 2)
    assert.equal(await page.getByText('设备问题 · 已提交', { exact: true }).count(), 1)
    assert.equal(await page.getByText('内容纠错 · 处理中', { exact: true }).count(), 1)
    assert.equal(await page.getByRole('button', { name: '提交工单' }).count(), 0)
    assert.equal(await page.locator('textarea').count(), 0)
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
    assert.ok(dimensions.scrollWidth <= dimensions.viewport + 1, 'no horizontal overflow')
    assert.deepEqual(errors, [])
    await page.screenshot({ path: path.join(output, `list-${width}.png`), fullPage: true })
    results.push({ width, supportReads, dimensions, pageErrors: errors.length })
    await context.close()
  }
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ source: 'browser-only fixtures, no real support data', results }, null, 2))
  console.log(JSON.stringify({ output, checks: results.length, results }))
} finally {
  await browser.close()
}
