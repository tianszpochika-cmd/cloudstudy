// Independent read-only outage fix review. All APIs are synthetic fixtures;
// no credentials/request bodies/headers/cookies/auth storage are read or logged.
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../../../../..'), OUT = __dirname, BASE = 'http://127.0.0.1:18180';
const sources = ['apps/learner-web/src/pages/PasswordResetPage.vue', 'apps/learner-web/src/auth/auth-failure-copy.ts', 'apps/learner-web/tests/ui-reset.e2e.cjs'];
const hashSources = () => Object.fromEntries(sources.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex')]));
const report = { scope: 'INDEPENDENT_WEB_RESET_OUTAGE_FOLLOWUP_UI_ONLY', at: new Date().toISOString(), sourceHashesBefore: hashSources(), cases: [], pageErrors: [], expectedConsoleErrorCount: 0, unexpectedConsoleErrorCount: 0, requests: [] };
const save = () => fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(report, null, 2));
const copy = { 'zh-CN': { success: '如果该账号可接收重置通知，我们会发送操作说明。', failed: '发送没有完成，请稍后再试。', limited: '操作过于频繁，请稍后再试。' }, 'en-US': { success: 'If this account can receive a reset notice, we will send instructions.', failed: 'The request did not complete. Try again shortly.', limited: 'Too many requests. Try again later.' } };
let browser; const pendingReleases = new Set();
async function facts(page) {
  return page.evaluate(() => { const feedback = document.querySelector('#reset-status'); return { feedback: feedback?.textContent ?? null, role: feedback?.getAttribute('role') ?? null, errorClass: feedback?.classList.contains('reset-feedback--error') ?? false, alertCount: document.querySelectorAll('[role=alert]').length, statusCount: document.querySelectorAll('[role=status]').length, busy: document.querySelector('form').getAttribute('aria-busy'), submitDisabled: document.querySelector('button[type=submit]').disabled, invalidInputs: document.querySelectorAll('input[aria-invalid=true]').length, route: location.pathname }; });
}
(async () => {
  browser = await chromium.launch();
  for (const locale of ['zh-CN', 'en-US']) for (const scenario of ['accepted-202', 'service-503', 'network-abort', 'rate-429']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const state = { mode: scenario, count: 0, hold: false, entered: null, release: null };
    await context.route('**/api/v1/**', async route => {
      const req = route.request(), url = new URL(req.url()), method = req.method(), mode = state.mode;
      report.requests.push({ method, origin: url.origin, path: url.pathname, scenario: mode, locale });
      const headers = { 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'content-type,idempotency-key,authorization', 'access-control-allow-methods': 'POST,OPTIONS', 'content-type': 'application/json' };
      if (method === 'OPTIONS') { await route.fulfill({ status: 204, headers, body: '' }); return; }
      if (method === 'POST' && url.pathname === '/api/v1/auth/password-reset/request') {
        assert.equal(url.protocol, 'https:'); state.count++;
        if (state.hold) { await new Promise(resolve => { state.release = resolve; pendingReleases.add(resolve); state.entered?.(); }); }
        if (mode === 'network-abort') { await route.abort('connectionfailed'); return; }
        const status = mode === 'accepted-202' ? 202 : mode === 'rate-429' ? 429 : 503;
        await route.fulfill({ status, headers, body: JSON.stringify(status === 202 ? { data: { accepted: true } } : { code: status === 429 ? 'RATE_LIMITED' : 'SERVICE_UNAVAILABLE', message: 'Synthetic unavailable fixture' }) }); return;
      }
      await route.fulfill({ status: 401, headers, body: JSON.stringify({ code: 'iam.credentials.invalid' }) });
    });
    const page = await context.newPage(); page.on('pageerror', error => report.pageErrors.push({ name: error.name, message: error.message }));
    page.on('console', message => { if (message.type() === 'error') { if (/Failed to load resource.*(?:401|429|503|ERR_CONNECTION_FAILED)/.test(message.text())) report.expectedConsoleErrorCount++; else report.unexpectedConsoleErrorCount++; } });
    await page.goto(`${BASE}/reset-password?uiLocale=${locale}&theme=light`, { waitUntil: 'networkidle' }); await page.locator('#reset-title').waitFor(); assert.equal(await page.locator('#reset-status').count(), 0);
    await page.locator('#reset-identifier').fill('independent-outage-followup-account'); await page.locator('button[type=submit]').click(); await page.locator('#reset-status').waitFor(); await page.waitForFunction(() => document.querySelector('form').getAttribute('aria-busy') === 'false');
    const observed = await facts(page), expected = copy[locale][scenario === 'accepted-202' ? 'success' : scenario === 'rate-429' ? 'limited' : 'failed'];
    assert.equal(observed.feedback, expected); assert.equal(state.count, 1); assert.equal(observed.invalidInputs, 0); assert.equal(observed.submitDisabled, false); assert.equal(observed.route, '/reset-password');
    if (scenario === 'accepted-202') { assert.equal(observed.role, 'status'); assert.equal(observed.alertCount, 0); assert.equal(observed.errorClass, false); }
    else { assert.equal(observed.role, 'alert'); assert.equal(observed.statusCount, 0); assert.equal(observed.errorClass, true); assert.notEqual(observed.feedback, copy[locale].success); }
    await page.screenshot({ path: path.join(OUT, `reset-${scenario}-${locale}.png`), fullPage: true });
    const entry = { locale, scenario, observed, initialRequests: state.count };
    if (scenario !== 'accepted-202') {
      state.mode = 'accepted-202'; state.hold = true;
      const entered = new Promise(resolve => { state.entered = resolve; });
      await page.locator('button[type=submit]').click(); await page.waitForFunction(() => document.querySelector('form').getAttribute('aria-busy') === 'true'); await entered;
      assert.equal(await page.locator('#reset-status').count(), 0, 'Retry clears old failure before waiting'); assert.equal(await page.getByRole('alert').count(), 0); assert.equal(await page.locator('#reset-step-switch').isDisabled(), true); assert.equal(state.count, 2);
      entry.retryPending = await facts(page); pendingReleases.delete(state.release); state.release();
      await page.getByRole('status').waitFor(); await page.waitForFunction(() => document.querySelector('form').getAttribute('aria-busy') === 'false');
      entry.retryAccepted = await facts(page); assert.equal(entry.retryAccepted.feedback, copy[locale].success); assert.equal(entry.retryAccepted.role, 'status'); assert.equal(entry.retryAccepted.alertCount, 0); assert.equal(entry.retryAccepted.errorClass, false); assert.equal(entry.retryAccepted.invalidInputs, 0); assert.equal(state.count, 2);
      await page.screenshot({ path: path.join(OUT, `reset-${scenario}-retry-accepted-${locale}.png`), fullPage: true });
    }
    report.cases.push(entry); save(); await context.close();
  }
  report.sourceHashesAfter = hashSources(); assert.deepEqual(report.sourceHashesAfter, report.sourceHashesBefore); assert.deepEqual(report.pageErrors, []); assert.equal(report.unexpectedConsoleErrorCount, 0);
  report.result = 'UI_SCOPE_PASS'; report.noRealApiOrAccount = true; report.unverified = ['real IAM/business reset delivery', 'native runtimes', 'mail delivery', 'screen reader']; save(); console.log(JSON.stringify({ result: report.result, cases: report.cases.length, successfulRetries: report.cases.filter(c => c.retryAccepted).length, sourceHashes: report.sourceHashesAfter }));
})().catch(error => { report.result = 'FAIL'; report.failure = { name: error.name, message: error.message }; save(); console.error(error.message); process.exitCode = 1; }).finally(async () => { pendingReleases.forEach(resolve => resolve()); if (browser) await browser.close(); });
