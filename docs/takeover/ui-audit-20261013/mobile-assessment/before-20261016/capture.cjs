// MB006 BEFORE: real uni-app pages; synthetic transport only. No real cookies,
// storage, request bodies, headers, credentials, servers or application state inspected.
// Browser plugin not available. Existing Playwright fallback; no new dependency.
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ROOT = process.cwd(), OUT = __dirname, BASE = 'http://127.0.0.1:18183';
const PAGE = 'apps/mobile/src/pages/assessment/assessment.vue';
const EXPECTED = '30cfa42c97c3fcd3923ac1309f3786fd2a1cf57c9e0d996bd897073429a86598';
const sources = [PAGE, 'packages/i18n/src/mobile-experience.ts', 'apps/mobile/src/api/learner-content.ts', 'apps/mobile/src/stores/learner-content.ts', 'apps/mobile/src/stores/session.ts', 'apps/mobile/src/auth/navigation.ts'];
const hashes = () => Object.fromEntries(sources.map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex')]));
const report = { at: new Date().toISOString(), scope: 'MB006_BEFORE_REAL_H5_SYNTHETIC_TRANSPORT_ONLY', browser: 'Browser plugin not available; Playwright Chromium 1.63.0 fallback', base: BASE, viewport: { width: 390, height: 844 }, sourceHashesBefore: hashes(), shots: [], requests: [], unexpected: [], pageErrors: [], consoleErrors: [] };
const save = () => fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(report, null, 2));
const frozen = () => { assert.deepEqual(hashes(), report.sourceHashesBefore, 'Source changed during before capture'); assert.equal(hashes()[PAGE], EXPECTED); };
let browser;
async function fresh(locale = 'zh-CN', theme = 'light') {
  frozen();
  const context = await browser.newContext({ viewport: report.viewport, reducedMotion: 'reduce' });
  const state = { sequence: 0, started: false, counts: { login: 0, start: 0, responses: 0, ensure: 0 } };
  const sid = 'asess_ui_before_mb006';
  const principal = () => ({ principal: { subject: 'ui-mb006-synthetic', permissions: ['learning.plan.read', 'learner.target.read', 'learner.profile.read', 'learner.preference.read', 'assessment.placement.read', 'assessment.placement.start', 'assessment.placement.respond'], roles: ['learner'], adultGate: 'PASSED' }, adultGate: { status: 'PASSED', learningAccess: 'ELIGIBLE' }, learningAccess: 'ELIGIBLE', permissions: ['learning.plan.read', 'learner.target.read', 'learner.profile.read', 'learner.preference.read', 'assessment.placement.read', 'assessment.placement.start', 'assessment.placement.respond'], consentState: { accepted: true, unsatisfiedPurposes: [], requiredPurposes: ['ACCOUNT_TERMS', 'PRIVACY_NOTICE', 'ADULT_LEARNING_ELIGIBILITY'], version: 'synthetic-summary-only' } });
  function projection() {
    const n = state.sequence;
    if (n === 10) return { sessionId: sid, status: 'COMPLETED', stateVersion: 10, acceptedSequence: 10, nextSequence: null, manifest: { totalItemCount: 10 }, finalResult: { reportId: 'prpt_ui_before_mb006', sessionId: sid, resultKind: 'ASSESSED', referenceLevel: 'A2', aggregateScore: 70, summary: { fullCount: 7, zeroCount: 3, itemCount: 10 } }, outcome: 'FULL' };
    return { sessionId: sid, status: 'IN_PROGRESS', stateVersion: n, acceptedSequence: n, nextSequence: n + 1, manifest: { totalItemCount: 10 }, currentItem: { itemId: 6100 + n + 1, itemSequence: n + 1, dimension: 'VOCABULARY', stem: n === 0 ? 'Choose the word that completes the sentence: I read a book every evening.' : `Synthetic item ${n + 1}: Choose the phrase that completes the sentence.`, timeLimitSec: 60, options: [{ optionId: 'A', text: 'read a book' }, { optionId: 'B', text: 'reads a book' }, { optionId: 'C', text: 'reading a book' }, { optionId: 'D', text: 'has read a book' }] }, ...(n > 0 ? { outcome: n <= 7 ? 'FULL' : 'ZERO' } : {}) };
  }
  await context.route('**/*', async route => {
    const q = route.request(), u = new URL(q.url()), p = u.pathname, method = q.method();
    if (!p.startsWith('/api/v1/')) return u.origin === BASE ? route.continue() : route.abort();
    report.requests.push({ locale, theme, origin: u.origin, method, path: p });
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true' };
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers, body: '' });
    let status = 200, data;
    if (p === '/api/v1/auth/login' || p === '/api/v1/auth/token/refresh') { if (p.endsWith('/login')) state.counts.login++; data = { accessToken: 'synthetic-invalid-ui-fixture-only', adultGate: { status: 'PASSED', learningAccess: 'ELIGIBLE' } }; }
    else if (p === '/api/v1/iam/principal/me' || p === '/api/v1/iam/permissions') data = principal();
    else if (p === '/api/v1/learner/profile') data = { stateVersion: 0 };
    else if (p === '/api/v1/learner/targets' && method === 'GET') data = { goalCode: 'FOUNDATION', dailyQuotaMinutes: 15, targetLevel: 'A1', status: 'ACTIVE', stateVersion: 0 };
    else if (p === '/api/v1/learner/preferences' && method === 'GET') data = { uiLocale: locale, contentLocale: 'en-US', timezone: 'Asia/Shanghai', themeMode: theme === 'dark' ? 'DARK' : 'LIGHT', highContrast: false, motionMode: 'REDUCED', stateVersion: 0 };
    else if (p === '/api/v1/assessment/placement/sessions' && method === 'POST') { state.counts.start++; if (state.startError) { status = 503; data = { code: 'SERVICE_UNAVAILABLE' }; } else { state.started = true; data = projection(); } }
    else if (p === `/api/v1/assessment/placement/sessions/${sid}` && method === 'GET') data = projection();
    else if (p === `/api/v1/assessment/placement/sessions/${sid}/responses` && method === 'POST') { assert.ok(state.started); state.sequence++; state.counts.responses++; data = projection(); }
    else if (p === '/api/v1/learning/plans:ensure' && method === 'POST') { state.counts.ensure++; data = { planId: 'plan_ui_before_mb006', planVersion: 1, stateVersion: 1 }; }
    else if (p === '/api/v1/learning/today' && method === 'GET') data = { planId: 'plan_ui_before_mb006', planVersion: 1, items: [], itemCount: 0 };
    else { status = 501; data = { code: 'UNEXPECTED_SYNTHETIC_ROUTE' }; report.unexpected.push({ method, path: p }); }
    await route.fulfill({ status, headers, body: JSON.stringify(data) });
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push({ locale, theme, message: error.message }));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push({ locale, theme, message: message.text() }); });
  await page.goto(`${BASE}/#/pages/login/login?theme=${theme}&uiLocale=${locale}&returnTo=%2Fpages%2Fassessment%2Fassessment`, { waitUntil: 'networkidle' });
  await page.locator('#mobile-login-identifier').fill('ui-mb006-synthetic');
  await page.locator('#mobile-login-password').fill('SyntheticOnly123');
  await page.locator('.login-submit').click();
  await page.waitForURL(url => url.hash.startsWith('#/pages/assessment/assessment'));
  await page.locator('.v2-assess-guide').waitFor();
  return { page, context, state };
}
async function shot(page, name, state) {
  frozen(); await page.evaluate(() => scrollTo(0, 0));
  const facts = await page.evaluate(async () => {
    const f = await import('/src/platform/v2-foundation.ts');
    const root = document.querySelector('.v2-assess-body');
    return { route: location.hash.split('?')[0], title: document.title, locale: f.mobileI18n.locale, theme: f.mobileThemeController.resolvedTheme, text: root.innerText, header: document.querySelector('.mobile-page-header')?.innerText, overlay: !!document.querySelector('vite-error-overlay'), overflow: document.documentElement.scrollWidth > innerWidth + 1, options: [...root.querySelectorAll('.option')].map(n => ({ text: n.innerText, selected: n.classList.contains('selected'), ariaPressed: n.getAttribute('aria-pressed'), font: getComputedStyle(n).fontSize, box: (() => { const b=n.getBoundingClientRect(); return { x:b.x,y:b.y,width:b.width,height:b.height }; })() })), controls: [...root.querySelectorAll('[role=button]')].map(n => ({ text: n.innerText, disabled: n.hasAttribute('disabled'), font: getComputedStyle(n).fontSize })), cardBox: (() => { const b=root.firstElementChild.getBoundingClientRect(); return { x:b.x,y:b.y,width:b.width,height:b.height }; })() };
  });
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false });
  report.shots.push({ name, facts, counts: { ...state.counts } }); save();
}
(async () => {
  try {
    frozen(); save(); browser = await chromium.launch();
    const main = await fresh();
    await shot(main.page, '01-guide-zh-light-390', main.state);
    await main.page.locator('.v2-assess-guide .v2-assess-submit').click();
    await main.page.locator('.v2-assess-question').waitFor();
    await main.page.locator('.option').first().click();
    assert.equal(await main.page.locator('.option.selected').count(), 1);
    await shot(main.page, '02-answer-selected-zh-light-390', main.state);
    for (let n = 1; n <= 10; n++) {
      if (n > 1) await main.page.locator('.option').first().click();
      await main.page.locator('.v2-assess-submit').click();
      if (n < 10) await main.page.getByText(`第 ${n + 1} 题，共 10 题`, { exact: true }).waitFor();
      else await main.page.locator('.v2-assess-report').waitFor();
    }
    await shot(main.page, '03-assessed-report-zh-light-390', main.state);
    assert.equal(main.state.counts.start, 1); assert.equal(main.state.counts.responses, 10);
    await main.context.close();
    const dark = await fresh('en-US', 'dark');
    await shot(dark.page, '04-guide-en-dark-390', dark.state); await dark.context.close();
    const failure = await fresh(); failure.state.startError = true;
    await failure.page.locator('.v2-assess-guide .v2-assess-submit').click();
    await failure.page.getByText('测评暂时不可用，请稍后重试。', { exact: true }).waitFor();
    await shot(failure.page, '05-start-error-503-zh-light-390', failure.state); await failure.context.close();
    frozen(); report.sourceHashesAfter = hashes(); report.sourceStable = true;
    report.completed = true; report.notRun = ['SKIPPED: current page has no normal skip write path; reportId must not be invented', 'Real IAM/Gateway/assessment/learning owner or database chain', 'Native App/iPad/physical device', 'Additional error/race/viewport matrix'];
  } catch (error) { report.failure = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally { report.sourceHashesAfter = hashes(); report.sourceStable = JSON.stringify(report.sourceHashesAfter) === JSON.stringify(report.sourceHashesBefore); save(); await browser?.close(); }
})();
