// MB005 isolated read-only UI preaudit. Every API is intercepted, including
// ephemeral synthetic login/logout. Never read cookies, storage or request data.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const ROOT = path.resolve(__dirname, '../../../../..');
const { chromium } = createRequire(path.join(ROOT, 'apps/mobile/package.json'))('playwright');
const BASE = 'http://127.0.0.1:18183';
const report = { scope: 'MB005_BEFORE_SYNTHETIC_UI_ONLY_NOT_BUSINESS_ACCEPTANCE', at: new Date().toISOString(), browser: 'Browser plugin not available; existing Playwright Chromium', cases: [], apiRequests: [], pageErrors: [], consoleErrors: [] };
const save = () => fs.writeFileSync(path.join(__dirname, 'before-fixtures.json'), JSON.stringify(report, null, 2));
const principal = (reason) => ({
  principalId: '00000000-0000-4000-8000-000000000005', tenantId: 'fixture-platform',
  sessionId: '00000000-0000-4000-8000-000000000015', deviceId: '00000000-0000-4000-8000-000000000025',
  roles: ['learner'], permissions: [], authMode: 'self-owned-jwt', status: 'RESTRICTED',
  adultGate: { status: reason === 'adult-rejected' ? 'REJECTED' : 'PASSED', learningAccess: reason === 'adult-rejected' ? 'RESTRICTED' : 'ELIGIBLE', effectiveAt: '2026-10-15T00:00:00Z', policyVersion: 'b30-adult-v1', minimumAge: 18, evidenceStatus: reason === 'adult-rejected' ? 'REJECTED' : 'SERVER_VERIFIED', retryAllowed: false },
  consentState: { accepted: reason !== 'withdrawn', unsatisfiedPurposes: reason === 'withdrawn' ? ['ADULT_LEARNING_ELIGIBILITY'] : [], version: 'fixture-consent-v1' },
  policyVersion: 'fixture-policy-v1',
});
const cases = [
  ['adult-rejected', 'zh-CN', 'light'], ['withdrawn', 'zh-CN', 'light'], ['permission', 'zh-CN', 'light'],
  ['adult-rejected', 'en-US', 'light'], ['withdrawn', 'en-US', 'dark'],
];
let browser;
(async () => {
  browser = await chromium.launch();
  for (const [reason, locale, theme] of cases) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    let logoutRelease, logoutEntered;
    const entered = new Promise(resolve => { logoutEntered = resolve; });
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (!url.pathname.startsWith('/api/v1/')) {
        if (url.origin === BASE) await route.continue(); else await route.abort();
        return;
      }
      const method = req.method();
      report.apiRequests.push({ reason, locale, theme, method, origin: url.origin, path: url.pathname });
      const headers = { 'content-type': 'application/json', 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true' };
      if (method === 'OPTIONS') { await route.fulfill({ status: 204, headers, body: '' }); return; }
      if (url.pathname === '/api/v1/auth/login') {
        await route.fulfill({ status: 200, headers, body: JSON.stringify({ data: { accessToken: 'synthetic-ui-fixture-only', sessionId: 'fixture-session' } }) }); return;
      }
      if (url.pathname === '/api/v1/iam/principal/me') {
        await route.fulfill({ status: 200, headers, body: JSON.stringify({ data: principal(reason) }) }); return;
      }
      if (url.pathname === '/api/v1/auth/logout') {
        logoutEntered(); await new Promise(resolve => { logoutRelease = resolve; });
        await route.fulfill({ status: 204, headers, body: '' }); return;
      }
      await route.fulfill({ status: 403, headers, body: JSON.stringify({ code: 'FIXTURE_PERMISSION_DENIED' }) });
    });
    const page = await context.newPage();
    page.on('pageerror', error => report.pageErrors.push({ reason, locale, theme, message: error.message }));
    page.on('console', msg => { if (msg.type() === 'error') report.consoleErrors.push({ reason, locale, theme, message: msg.text().slice(0, 400) }); });
    await page.goto(`${BASE}/#/pages/forbidden/forbidden?uiLocale=${locale}&theme=${theme}`, { waitUntil: 'networkidle' });
    await page.locator('.v2-forbid-page').waitFor();
    assert.equal(await page.locator('vite-error-overlay').count(), 0);
    const actor = await page.evaluate(async ({ reason, locale, theme }) => {
      const [{ useSessionStore }, { pinia }, foundation] = await Promise.all([import('/src/stores/session.ts'), import('/src/stores/pinia.ts'), import('/src/platform/v2-foundation.ts')]);
      foundation.mobileI18nAdapter.setLocale(locale);
      foundation.mobileThemeController.setTheme(theme);
      const session = useSessionStore(pinia);
      if (!await session.login('mb005-synthetic-fixture-only', 'synthetic-not-a-real-secret')) throw new Error('Synthetic fixture session was not established');
      if (reason === 'withdrawn') session.learningConsentWithdrawn = true;
      return { authenticated: session.isAuthenticated, adultGate: session.adultGate, withdrawn: session.learningConsentWithdrawn, actualLocale: foundation.mobileI18n.locale, actualTheme: foundation.mobileThemeController.resolvedTheme };
    }, { reason, locale, theme });
    assert.equal(actor.actualLocale, locale); assert.equal(actor.actualTheme, theme);
    const state = await page.evaluate(() => {
      const root = document.querySelector('.v2-forbid-page');
      return { title: document.title, mainHeading: document.querySelector('[role=heading][aria-level="1"]')?.textContent, intro: document.querySelector('.mobile-intro')?.textContent, repeatedTitle: document.querySelector('.v2-forbid-title')?.textContent, explanation: document.querySelector('.v2-forbid-d')?.textContent, buttons: [...root.querySelectorAll('[role=button]')].map(el => ({ text: el.textContent.trim(), disabled: el.hasAttribute('disabled'), ariaDisabled: el.getAttribute('aria-disabled') })), horizontalOverflow: document.documentElement.scrollWidth > innerWidth, background: getComputedStyle(root).backgroundColor };
    });
    assert.ok(state.mainHeading && state.explanation);
    const filename = `${reason}-${locale}-${theme}.png`;
    await page.screenshot({ path: path.join(__dirname, filename), fullPage: true });
    await page.locator('.v2-forbid-submit').focus();
    const keyboardFocus = await page.locator('.v2-forbid-submit').evaluate(el => el === document.activeElement);
    const row = { reason, locale, theme, actor, state, keyboardFocus, screenshot: filename, overlay: false };
    if (reason === 'adult-rejected' && locale === 'zh-CN') {
      await page.locator('.v2-forbid-submit').click(); await entered;
      row.pendingLogout = await page.locator('.v2-forbid-page').evaluate(root => ({ busy: root.getAttribute('aria-busy'), buttons: [...root.querySelectorAll('[role=button]')].map(el => ({ text: el.textContent.trim(), disabled: el.hasAttribute('disabled'), ariaDisabled: el.getAttribute('aria-disabled') })) }));
      await page.screenshot({ path: path.join(__dirname, 'adult-rejected-zh-CN-light-logout-pending.png'), fullPage: true });
      logoutRelease(); await page.waitForURL(url => url.hash.startsWith('#/pages/login/login'));
      row.logoutRoute = '#/pages/login/login';
    }
    report.cases.push(row); save(); await context.close();
  }
  report.result = 'BEFORE_UI_CAPTURED_WITH_FINDINGS'; save();
  console.log(JSON.stringify({ result: report.result, fixtures: report.cases.length, pageErrors: report.pageErrors.length, consoleErrors: report.consoleErrors.length }));
})().catch(error => { report.result = 'CAPTURE_FAILED'; report.failure = error.stack; save(); console.error(error.stack); process.exitCode = 1; }).finally(async () => { await browser?.close(); });
