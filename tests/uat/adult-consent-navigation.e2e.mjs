import test from 'node:test'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const cases = [
  { name: 'learner web', origin: 'http://127.0.0.1:18180', home: '/home', onboarding: '/onboarding', hint: 'yx.auth.session-hint' },
  { name: 'mobile H5', origin: 'http://127.0.0.1:18183', home: '/#/pages/home/home', onboarding: '/#/pages/onboarding/onboarding', hint: 'yx.auth.mobile.session-hint' },
]

for (const surface of cases) {
  for (const consented of [false, true]) {
    test(`${surface.name} ${consented ? 'allows' : 'withholds'} learning navigation after adult Gate`, async () => {
      const browser = await chromium.launch({ headless: true })
      const context = await browser.newContext()
      try {
        await context.addInitScript((hint) => localStorage.setItem(hint, '1'), surface.hint)
        await context.route('**/api/v1/**', async (route) => {
          const request = route.request()
          const suffix = new URL(request.url()).pathname.replace(/^\/api\/v1/, '')
          const headers = {
            'Access-Control-Allow-Origin': surface.origin,
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key, X-Request-Id, Accept-Language, X-Content-Locale',
            'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
          }
          if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
          const permissions = consented ? ['learner.profile.read', 'learning.plan.read'] : ['learner.profile.read']
          let status = 200
          let data
          if (suffix === '/auth/token/refresh') data = { accessToken: 'ui-fixture-only', adultGate: 'PASSED' }
          else if (suffix === '/iam/principal/me' || suffix === '/iam/permissions') data = {
            subject: 'ui-fixture', roles: ['learner'], permissions, adultGate: { status: 'PASSED' },
          }
          else if (suffix === '/onboarding/options') data = { goals: [], dailyQuotaMinutes: [15] }
          else { status = 403; data = { error: { code: 'CONSENT_REQUIRED' } } }
          await route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify({ data }) })
        })
        const page = await context.newPage()
        await page.goto(`${surface.origin}${surface.home}`)
        const expected = consented ? surface.home : surface.onboarding
        await page.waitForURL((url) => url.href.includes(expected), { timeout: 15000 })
        // The onboarding page reads owner facts after navigation. A pre-consent
        // 403 must not send the learner to the generic forbidden page later.
        if (!consented) await page.waitForTimeout(500)
        assert.ok(page.url().includes(expected), page.url())
      } finally {
        await context.close()
        await browser.close()
      }
    })
  }
}
