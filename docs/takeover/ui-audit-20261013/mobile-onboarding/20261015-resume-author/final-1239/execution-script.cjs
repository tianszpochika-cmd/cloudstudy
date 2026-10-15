// Formal H5 onboarding: fully intercepted synthetic server facts only.
// Never inspect auth storage, cookies, tokens, request body/header or credentials.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../../..'), BASE = 'http://127.0.0.1:18183';
const OUT = path.resolve(ROOT, process.env.UI_AUDIT_OUTPUT || '.git/codex-local-backups/onboarding-' + Date.now());
const GROUP = process.env.UI_AUDIT_GROUP || 'all';
fs.mkdirSync(OUT, { recursive: true });
const sources = ['apps/mobile/src/pages/onboarding/onboarding.vue', 'packages/i18n/src/mobile-experience.ts', 'apps/mobile/src/api/learner-content.ts', 'apps/mobile/src/stores/session.ts', 'apps/mobile/src/auth/gateway-auth.ts', 'apps/mobile/src/domain/onboarding-resume.ts', 'apps/mobile/src/stores/learner-content.ts', 'apps/mobile/src/platform/pointer-feedback.ts', 'apps/mobile/tests/ui-onboarding.e2e.cjs'];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex');
const report = { at: new Date().toISOString(), scope: 'MB004_FORMAL_H5_SYNTHETIC_UI_ONLY', group: GROUP, browserPlugin: 'Browser plugin not available; Playwright Chromium', sourceHashes: Object.fromEntries(sources.map(file => [file, hash(file)])), checks: [], matrix: [], pageErrors: [], consoleErrors: [], fixtureRequests: [] };
const save = () => fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(report, null, 2));
let browser;
const releases = new Set();
const titles = { 'zh-CN': { gate: '确认成人身份', consent: '查看同意事项', goal: '选择学习目标', assessment: '设置已完成' }, 'en-US': { gate: 'Confirm adult eligibility', consent: 'Review consent status', goal: 'Choose your learning goal', assessment: 'Your setup is saved' } };
const purposes = ['ACCOUNT_TERMS', 'PRIVACY_NOTICE', 'ADULT_LEARNING_ELIGIBILITY'];
const record = (type, purpose, required = true) => ({ type, purpose, required, document: { version: 'recorded-fixture-v1', digest: 'synthetic-document-digest', publishedAt: '2026-10-01T00:00:00Z' }, state: 'GRANTED', provenance: { authority: 'IAM_SERVER_RECORDED_CONSENT', recordedAt: '2026-10-02T00:00:00Z', documentSource: 'PUBLISHED_DOCUMENT_VERSION_AND_DIGEST', policySource: 'IAM_ACTIVE_POLICY_CONTROL_PLANE' }, policyRef: 'synthetic-policy-reference', policyVersion: 'fixture-policy-v1', decisionRef: 'synthetic-decision-reference' });
async function open(mode = 'gate', width = 390, locale = 'zh-CN', theme = 'light', height = 844) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  const state = { adult: mode === 'gate' ? 'REQUIRED' : 'PASSED', access: mode === 'gate' ? 'RESTRICTED' : 'ELIGIBLE', accepted: ['goal', 'assessment', 'unreadable'].includes(mode), target: mode === 'assessment' ? { goalCode: 'FOUNDATION', dailyQuotaMinutes: 15, targetLevel: 'A1', status: 'ACTIVE', stateVersion: 0 } : null, hold: null, release: null, adultResponse: 'PASSED', adultAccess: 'ELIGIBLE', adultStatus: 200, targetStatus: 200, recordStatus: 200, records: mode === 'consent' ? [record('TERMS', purposes[0]), record('PRIVACY', purposes[1]), record('ADULT_LEARNING', purposes[2]), record('PRODUCT_ANALYTICS', 'PRODUCT_ANALYTICS', false)] : [], unreadable: mode === 'unreadable', expectedTarget: null, counts: { adult: 0, targetPut: 0, consentPut: 0, preferencePatch: 0, recordGet: 0 } };
  function principal() {
    const permissions = state.accepted && state.adult === 'PASSED' && state.access === 'ELIGIBLE' ? ['learning.plan.read', 'learner.target.read', 'learner.profile.read', 'learner.preference.read'] : [];
    return { principal: { subject: 'ui-onboarding-synthetic', permissions, roles: [], adultGate: state.adult }, adultGate: { status: state.adult, learningAccess: state.access }, learningAccess: state.access, permissions, consentState: { accepted: state.accepted, unsatisfiedPurposes: state.accepted ? [] : purposes, requiredPurposes: purposes, version: 'summary-not-a-published-catalog', learningAccess: state.accepted ? 'ELIGIBLE' : 'RESTRICTED' } };
  }
  await context.route('**/*', route => { const url = new URL(route.request().url()); return url.hostname === '127.0.0.1' && url.port === '18183' ? route.continue() : route.abort(); });
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), p = url.pathname, method = request.method();
    report.fixtureRequests.push({ mode, method, origin: url.origin, path: p });
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true' };
    if (method === 'OPTIONS') { await route.fulfill({ status: 204, headers, body: '' }); return; }
    if (p === '/api/v1/iam/adult-gate') state.counts.adult++;
    if (p === '/api/v1/auth/token/refresh') state.counts.refresh = (state.counts.refresh || 0) + 1;
    if (p === '/api/v1/learner/targets' && method === 'GET') state.counts.targetGet = (state.counts.targetGet || 0) + 1;
    if (p === '/api/v1/learner/targets' && method === 'PUT') state.counts.targetPut++;
    if (p === '/api/v1/iam/consents' && method === 'PUT') state.counts.consentPut++;
    if (state.hold === p) await new Promise(resolve => { state.release = resolve; releases.add(resolve); });
    let status = 200, data = {};
    if (p === '/api/v1/auth/token/refresh' && state.refreshFailure) { status = 401; data = { code: 'INVALID_REFRESH_TOKEN' }; }
    else if (p === '/api/v1/auth/login' || p === '/api/v1/auth/token/refresh') data = { accessToken: 'ui-synthetic-not-a-valid-credential', adultGate: { status: state.adult, learningAccess: state.access } };
    else if (p === '/api/v1/iam/permissions' || p === '/api/v1/iam/principal/me') data = principal();
    else if (p === '/api/v1/iam/adult-gate') {
      status = state.adultStatus;
      if (status < 400) { state.adult = state.adultResponse; state.access = state.adultAccess; data = { ...principal(), status: state.adultResponse, learningAccess: state.access }; }
      else data = { code: 'SERVICE_UNAVAILABLE' };
    } else if (p === '/api/v1/iam/consents') {
      if (method === 'PUT') { status = 409; data = { code: 'UNEXPECTED_CONSENT_SIGNING' }; }
      else { state.counts.recordGet++; status = state.recordStatus; data = { items: state.records }; }
    } else if (p === '/api/v1/learner/targets') {
      if (method === 'PUT') { status = state.targetStatus; if (status < 400) state.target = { ...state.expectedTarget, stateVersion: 1 }; }
      else if (state.unreadable) status = 503;
      else if (!state.target) status = 404;
      data = state.target || { code: status === 503 ? 'SERVICE_UNAVAILABLE' : 'NOT_FOUND' };
      if (state.readbackMismatch && method === 'GET' && state.counts.targetPut > 0 && state.target) data = { ...state.target, dailyQuotaMinutes: 15 };
      if (method === 'GET' && state.targetClaimsStale && (!state.counts.refresh || state.targetClaimsStale === 'persistent')) { status = 403; data = { code: 'CONSENT_REQUIRED' }; }
    } else if (p === '/api/v1/learner/preferences') {
      if (method === 'PATCH') state.counts.preferencePatch++;
      data = { uiLocale: locale, contentLocale: 'es-ES', timezone: 'Asia/Shanghai', themeMode: theme === 'dark' ? 'DARK' : 'LIGHT', highContrast: theme === 'high-contrast', motionMode: 'REDUCED', stateVersion: 0 };
    } else if (p === '/api/v1/learner/profile') data = { stateVersion: 0 };
    else if (p === '/api/v1/auth/logout') data = { success: true };
    else if (p.includes('/plan')) data = { items: [], planVersion: 0 };
    await route.fulfill({ status, headers, body: JSON.stringify(data) });
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  await page.goto(`${BASE}/#/pages/login/login?theme=${theme}&uiLocale=${locale}&returnTo=%2Fpages%2Fonboarding%2Fonboarding`, { waitUntil: 'networkidle' });
  await page.locator('#mobile-login-identifier').fill('ui-onboarding-synthetic'); await page.locator('#mobile-login-password').fill('SyntheticOnly123'); await page.locator('.login-submit').click();
  await page.waitForURL(url => url.hash.startsWith('#/pages/onboarding/onboarding'));
  await page.waitForFunction(expected => {
    let component = document.querySelector('.yx-onboarding')?.__vueParentComponent;
    while (component && !('step' in component.setupState)) component = component.parent;
    return component && component.setupState.step === expected && !component.setupState.busy;
  }, mode === 'unreadable' ? 'goal' : mode);
  return { context, page, state, hold: p => { state.hold = p; }, release: () => { state.hold = null; if (state.release) { releases.delete(state.release); state.release(); state.release = null; } } };
}
async function snapshot(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.yx-onboarding'), title = document.getElementById('mobile-onboarding-title');
    const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => { const n = value / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const contrast = node => { const a = luminance(getComputedStyle(node).color), b = luminance(getComputedStyle(root).backgroundColor); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
    const boundaries = [...root.querySelectorAll('.onboarding-input,.onboarding-choice:not(.is-selected),.onboarding-quota:not(.is-selected)')].map(node => { const css = getComputedStyle(node), edge = luminance(css.borderTopColor), fill = luminance(css.backgroundColor), outside = luminance(getComputedStyle(root).backgroundColor); return { border: css.borderTopColor, againstFill: (Math.max(edge, fill) + .05) / (Math.min(edge, fill) + .05), againstPage: (Math.max(edge, outside) + .05) / (Math.min(edge, outside) + .05) }; });
    return { url: location.hash, title: title?.textContent, titleFont: getComputedStyle(title).fontSize, titleWeight: getComputedStyle(title).fontWeight, descriptionFont: getComputedStyle(document.querySelector('.onboarding-description')).fontSize, brandIcon: document.querySelector('.onboarding-brand .app-icon').getBoundingClientRect().width, overflow: document.documentElement.scrollWidth > innerWidth + 1, bodyWidth: document.querySelector('.onboarding-content').getBoundingClientRect().width, inputFont: document.querySelector('#mobile-onboarding-year') ? getComputedStyle(document.querySelector('#mobile-onboarding-year')).fontSize : null, idleErrors: root.querySelectorAll('.onboarding-error').length, overlay: document.querySelectorAll('vite-error-overlay').length, rawKeys: /mobile\.onboarding\.|\{(?:count|max)\}/.test(root.textContent), titleContrast: contrast(title), descriptionContrast: contrast(document.querySelector('.onboarding-description')), boundaries, bodyGap: getComputedStyle(document.querySelector('.onboarding-body')).rowGap, primaryFont: root.querySelector('.onboarding-primary') ? getComputedStyle(root.querySelector('.onboarding-primary')).fontSize : null, targets: [...root.querySelectorAll('uni-button,uni-checkbox,.onboarding-check-row')].map(node => { const r = node.getBoundingClientRect(); return { width: r.width, height: r.height }; }) };
  });
}
async function smoke() {
  for (const mode of ['gate', 'consent', 'goal', 'assessment']) {
    const current = await open(mode), { page } = current;
    const facts = await snapshot(page); assert.equal(facts.title, titles['zh-CN'][mode]); assert.equal(facts.rawKeys, false); assert.equal(facts.overlay, 0); assert.equal(facts.overflow, false);
    await page.screenshot({ path: path.join(OUT, `${mode}-390-smoke.png`), fullPage: true });
    if (mode === 'gate') {
      assert.equal(await page.locator('#mobile-onboarding-year').getAttribute('name'), 'birthYear'); assert.equal(facts.inputFont, '16px');
      await page.locator('.onboarding-check-row').click();
      assert.equal(await page.evaluate(() => { let c = document.querySelector('.yx-onboarding').__vueParentComponent; while (c && !('ageConfirmed' in c.setupState)) c = c.parent; return c.setupState.ageConfirmed; }), true, 'Entire checkbox row changes once');
      assert.equal(await page.getByRole('checkbox').count(), 1, 'True checkbox needs accessible role');
      const checkbox = page.getByRole('checkbox'); await checkbox.click(); assert.equal(await checkbox.getAttribute('aria-checked'), 'false');
      await checkbox.focus(); await page.keyboard.press('Space'); assert.equal(await checkbox.getAttribute('aria-checked'), 'true'); await page.keyboard.press('Enter'); assert.equal(await checkbox.getAttribute('aria-checked'), 'false');
    } else if (mode === 'consent') { assert.equal(await page.locator('.onboarding-primary').count(), 0); assert.equal(await page.locator('.onboarding-record').count(), 4); assert.equal(current.state.counts.consentPut, 0); }
    else if (mode === 'goal') { assert.equal(await page.locator('.onboarding-choice').count(), 4); assert.equal(await page.locator('.onboarding-quota').count(), 4); }
    else { assert.equal(await page.locator('.onboarding-choice').count(), 0); assert.equal(await page.locator('.onboarding-summary').count(), 1); }
    report.checks.push({ name: 'smoke-' + mode, facts, result: 'PASS' }); save(); await current.context.close();
  }
}
async function matrix() {
  for (const mode of process.env.UI_MATRIX_MODES ? process.env.UI_MATRIX_MODES.split(',') : ['gate', 'consent', 'goal', 'assessment']) for (const width of [320, 390, 768, 1280]) for (const locale of ['zh-CN', 'en-US']) for (const theme of ['light', 'dark', 'high-contrast', 'system']) {
    const current = await open(mode, width, locale, theme), { page } = current;
    const facts = await snapshot(page); assert.equal(facts.title, titles[locale][mode]); assert.equal(facts.rawKeys, false); assert.equal(facts.overlay, 0); assert.equal(facts.overflow, false);
    assert.equal(facts.titleFont, '28px'); assert.equal(facts.titleWeight, '650'); assert.equal(facts.descriptionFont, '14px'); assert.equal(facts.brandIcon, 25); assert.ok(facts.targets.every(target => target.width >= 44 && target.height >= 44));
    assert.ok(facts.bodyWidth <= (mode === 'consent' || mode === 'goal' ? 560.1 : 420.1)); assert.ok(facts.titleContrast >= 4.5 && facts.descriptionContrast >= 4.5); assert.equal(facts.bodyGap, '24px'); if (facts.primaryFont) assert.equal(facts.primaryFont, '16px');
    assert.ok(facts.boundaries.every(edge => edge.againstFill >= 3 && edge.againstPage >= 3), 'Unselected control boundaries need 3:1 against fill and page');
    if (mode === 'gate') assert.equal(facts.inputFont, '16px');
    if (theme === 'system') { await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark'); await page.emulateMedia({ colorScheme: 'light' }); await page.waitForFunction(() => document.documentElement.dataset.theme === 'light'); }
    await page.screenshot({ path: path.join(OUT, `${mode}-${width}-${locale}-${theme}.png`), fullPage: true });
    report.matrix.push({ mode, width, locale, theme, ...facts, result: 'PASS' }); save(); await current.context.close();
  }
}
async function controls() {
  const first = await open(), p = first.page, year = p.locator('#mobile-onboarding-year'), primary = p.locator('.onboarding-primary'), checkbox = p.getByRole('checkbox');
  assert.equal(await primary.isDisabled(), true); await year.focus(); await p.keyboard.press('Enter');
  await p.locator('#mobile-onboarding-year-error').waitFor();
  await p.waitForFunction(() => document.activeElement.id === 'mobile-onboarding-year', null, { timeout: 3000 });
  assert.equal(await year.getAttribute('aria-invalid'), 'true'); assert.equal(first.state.counts.adult, 0);
  await year.fill('1990'); await p.keyboard.press('Enter'); await p.locator('#mobile-onboarding-age-error').waitFor();
  await p.waitForFunction(() => document.activeElement.id === 'mobile-onboarding-age', null, { timeout: 3000 });
  assert.equal(await checkbox.getAttribute('aria-invalid'), 'true'); await p.keyboard.press('Space'); assert.equal(await checkbox.getAttribute('aria-checked'), 'true');
  await primary.waitFor({ state: 'visible' }); assert.equal(await primary.isDisabled(), false);
  await p.evaluate(() => {
    let c = document.querySelector('.yx-onboarding').__vueParentComponent; while (c && !('birthYear' in c.setupState)) c = c.parent;
    window.__gateImmediate = []; c.setupState.session.confirmAdultGate = async year => { window.__gateImmediate.push({ matchesLatest: year === 1991 }); return false; };
    const input = document.getElementById('mobile-onboarding-year'); input.focus(); input.value = '1991'; input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  });
  await primary.click(); await p.locator('.onboarding-error[role=alert]').last().waitFor();
  assert.deepEqual(await p.evaluate(() => window.__gateImmediate), [{ matchesLatest: true }]);
  await year.fill(''); await year.blur(); assert.equal(await primary.isDisabled(), true); assert.equal(first.state.counts.adult, 0);
  report.checks.push({ name: 'year-confirm-first-error-and-age-focus-immediate-detail', latestComponentYearMatched: true, clearDisables: true, result: 'PASS' }); save(); await first.context.close();
  const busy = await open(), b = busy.page;
  await b.locator('#mobile-onboarding-year').fill('1990'); await b.locator('.onboarding-check-row').click();
  busy.hold('/api/v1/iam/adult-gate'); await b.locator('.onboarding-primary').click(); await b.locator('.yx-onboarding[aria-busy=true]').waitFor();
  for (const control of await b.locator('.yx-onboarding uni-button,.yx-onboarding uni-checkbox,.yx-onboarding input').all()) assert.equal(await control.isDisabled(), true);
  await b.locator('.onboarding-check-row').click({ force: true }); assert.equal(await b.getByRole('checkbox').getAttribute('aria-checked'), 'true');
  await b.keyboard.press('Enter'); await b.keyboard.press('Space'); assert.equal(busy.state.counts.adult, 1);
  assert.equal(await b.locator('.onboarding-error').count(), 0, 'First valid busy has no idle error space');
  await b.screenshot({ path: path.join(OUT, 'gate-busy.png'), fullPage: true }); busy.release();
  await b.getByRole('heading', { name: titles['zh-CN'].consent }).waitFor(); assert.equal(busy.state.counts.adult, 1); assert.equal(busy.state.counts.consentPut, 0);
  report.checks.push({ name: 'gate-valid-busy-single-locked-to-blocked-consent', requests: 1, result: 'PASS' }); save(); await busy.context.close();
}
async function flow() {
  for (const test of [{ name: '503', status: 503, verdict: 'PASSED', access: 'ELIGIBLE' }, { name: 'restricted', status: 200, verdict: 'PASSED', access: 'RESTRICTED' }, { name: 'missing-access', status: 200, verdict: 'PASSED', access: undefined }, { name: 'not-evaluated', status: 200, verdict: 'NOT_EVALUATED', access: 'RESTRICTED' }, { name: 'unknown', status: 200, verdict: 'UNKNOWN', access: undefined }, { name: 'rejected', status: 200, verdict: 'REJECTED', access: 'RESTRICTED' }]) {
    const next = await open(), p = next.page; next.state.adultStatus = test.status; next.state.adultResponse = test.verdict; next.state.adultAccess = test.access;
    await p.locator('#mobile-onboarding-year').fill('1990'); await p.locator('.onboarding-check-row').click(); await p.locator('.onboarding-primary').click();
    if (test.name === 'rejected') await p.waitForURL(url => url.hash.startsWith('#/pages/forbidden/forbidden'));
    else { await p.locator('.onboarding-error[role=alert]').waitFor(); assert.ok(p.url().includes('/pages/onboarding/onboarding')); assert.equal(await p.getByRole('heading', { name: titles['zh-CN'].gate }).count(), 1); }
    assert.equal(next.state.counts.adult, 1); assert.equal(next.state.counts.consentPut, 0); assert.equal(next.state.counts.targetPut, 0);
    report.checks.push({ name: 'adult-' + test.name, route: new URL(p.url()).hash.split('?')[0], requests: next.state.counts, result: 'PASS' }); save(); await next.context.close();
  }
  for (const scenario of ['empty-records', 'record-outage', 'missing-digest', 'records-withdrawn', 'records-readable']) {
    const next = await open('consent'), p = next.page;
    if (scenario === 'empty-records') next.state.records = [];
    if (scenario === 'record-outage') next.state.recordStatus = 503;
    if (scenario === 'missing-digest') next.state.records[0].document.digest = '';
    if (scenario === 'records-withdrawn') next.state.records[0].state = 'WITHDRAWN';
    await p.getByRole('button', { name: '重新读取', exact: true }).click(); await p.locator('.yx-onboarding[aria-busy=false]').waitFor();
    assert.equal(await p.locator('.onboarding-primary').count(), 0); assert.equal(next.state.counts.consentPut, 0);
    assert.equal(await p.getByRole('checkbox').count(), 0); assert.equal(await p.locator('.onboarding-blocked').count(), 1);
    assert.equal(await p.getByText('summary-not-a-published-catalog', { exact: false }).count(), 0);
    if (scenario === 'records-readable' || scenario === 'records-withdrawn') { await p.getByRole('button', { name: '展开来源记录' }).click(); assert.equal(await p.getByText('synthetic-document-digest', { exact: false }).count(), 4); }
    report.checks.push({ name: 'consent-' + scenario, signingRequests: 0, actualReload: true, result: 'PASS' }); save(); await next.context.close();
  }
  const goal = await open('goal', 390, 'en-US', 'dark'), g = goal.page;
  goal.state.expectedTarget = { goalCode: 'WORKPLACE_DAILY', dailyQuotaMinutes: 30, targetLevel: 'B2', status: 'ACTIVE' };
  await g.locator('[data-goal-code=WORKPLACE_DAILY]').click(); await g.getByRole('button', { name: /^30 minutes/ }).click();
  goal.hold('/api/v1/learner/targets'); await g.locator('.onboarding-primary').click(); await g.locator('.yx-onboarding[aria-busy=true]').waitFor();
  for (const button of await g.locator('.yx-onboarding uni-button').all()) assert.equal(await button.isDisabled(), true);
  await g.locator('.onboarding-primary').click({ force: true }); await g.keyboard.press('Enter'); goal.release();
  await g.waitForURL(url => url.hash.startsWith('#/pages/assessment/assessment'));
  assert.equal(goal.state.counts.targetPut, 1); assert.equal(goal.state.counts.consentPut, 0); assert.equal(goal.state.counts.preferencePatch, 0);
  report.checks.push({ name: 'goal-save-readback-single-without-consent-or-preference-write', requests: goal.state.counts, result: 'PASS' }); save(); await goal.context.close();
  for (const status of [409, 503]) {
    const next = await open('goal'), p = next.page; next.state.targetStatus = status; next.state.expectedTarget = { goalCode: 'ZERO_BASIS', dailyQuotaMinutes: 15, targetLevel: 'A1', status: 'ACTIVE' };
    await p.locator('[data-goal-code=FOUNDATION]').click(); await p.locator('.onboarding-primary').click(); await p.locator('.onboarding-error[role=alert]').waitFor();
    assert.ok(p.url().includes('/pages/onboarding/onboarding')); assert.equal(await p.locator('.onboarding-summary').count(), 0); assert.equal(next.state.counts.targetPut, 1); assert.equal(next.state.counts.consentPut, 0);
    report.checks.push({ name: 'target-save-' + status + '-stays-editing', result: 'PASS' }); save(); await next.context.close();
  }
  const editing = await open('assessment'), e = editing.page;
  assert.equal(await e.locator('.onboarding-choice').count(), 0); await e.getByRole('button', { name: '调整目标' }).click();
  await e.getByRole('heading', { name: titles['zh-CN'].goal }).waitFor(); assert.equal(await e.locator('[data-goal-code=FOUNDATION]').getAttribute('aria-pressed'), 'true');
  editing.state.expectedTarget = { goalCode: 'CET_4_6', dailyQuotaMinutes: 45, targetLevel: 'B1', status: 'ACTIVE' };
  await e.locator('[data-goal-code=COLLEGE_CET]').click(); await e.getByRole('button', { name: /^45 分钟/ }).click(); await e.locator('.onboarding-primary').click();
  await e.waitForURL(url => url.hash.startsWith('#/pages/assessment/assessment')); assert.equal(editing.state.counts.targetPut, 1); assert.equal(editing.state.counts.preferencePatch, 0); assert.equal(editing.state.counts.consentPut, 0);
  report.checks.push({ name: 'saved-summary-readonly-explicit-adjust-save-dirty', result: 'PASS' }); save(); await editing.context.close();
}
async function recovery() {
  for (const stale of ['transient', 'persistent']) {
    const owner = await open('consent'), p = owner.page;
    owner.state.accepted = true; owner.state.targetClaimsStale = stale;
    await p.getByRole('button', { name: '重新读取', exact: true }).click(); await p.locator('.yx-onboarding[aria-busy=false]').waitFor();
    assert.equal(owner.state.counts.refresh, 1); assert.equal(owner.state.counts.consentPut, 0); assert.equal(owner.state.counts.targetPut, 0);
    await p.getByRole('heading', { name: titles['zh-CN'][stale === 'transient' ? 'goal' : 'consent'] }).waitFor();
    if (stale === 'persistent') { await p.getByRole('alert').waitFor(); assert.equal(await p.locator('.onboarding-primary').count(), 0); }
    report.checks.push({ name: `old-jwt-target403-${stale}-one-owner-refresh-zero-signing`, counts: owner.state.counts, result: 'PASS' }); save(); await owner.context.close();
  }
  const expired = await open('consent'), e = expired.page;
  expired.state.accepted = true; expired.state.targetClaimsStale = 'transient'; expired.state.refreshFailure = true;
  await e.getByRole('button', { name: '重新读取', exact: true }).click(); await e.waitForURL(url => url.hash.startsWith('#/pages/login/login'));
  assert.equal(expired.state.counts.refresh, 1); assert.equal(expired.state.counts.targetPut, 0); assert.equal(expired.state.counts.consentPut, 0);
  report.checks.push({ name: 'renewal401-clears-identity-unlocks-public-route', result: 'PASS' }); save(); await expired.context.close();
  const renewed = await open('consent'), r = renewed.page;
  renewed.state.accepted = true;
  await r.getByRole('button', { name: '重新读取', exact: true }).click(); await r.locator('.yx-onboarding[aria-busy=false]').waitFor();
  assert.equal(await r.evaluate(() => { let c = document.querySelector('.yx-onboarding').__vueParentComponent; while(c&&!('session' in c.setupState))c=c.parent; return c.setupState.session.isLearningReady; }), true, 'Existing valid current consent renews stale claims before learner actions');
  assert.equal(renewed.state.counts.consentPut, 0); report.checks.push({ name: 'current-consent-read-recovery-renews-current-claims-no-signing', result: 'PASS' }); save(); await renewed.context.close();
  const staleConsent = await open('goal'), p = staleConsent.page;
  staleConsent.state.accepted = false;
  await p.locator('[data-goal-code=FOUNDATION]').click(); await p.locator('.onboarding-primary').click();
  await p.getByRole('heading', { name: titles['zh-CN'].consent }).waitFor({ timeout: 3000 });
  assert.equal(staleConsent.state.counts.targetPut, 0); assert.equal(staleConsent.state.counts.consentPut, 0);
  report.checks.push({ name: 'current-consent-invalid-moves-to-blocked-review-without-write', result: 'PASS' }); save(); await staleConsent.context.close();
  const mismatch = await open('goal'), m = mismatch.page;
  mismatch.state.expectedTarget = { goalCode: 'WORKPLACE_DAILY', dailyQuotaMinutes: 30, targetLevel: 'B2', status: 'ACTIVE' }; mismatch.state.readbackMismatch = true;
  await m.locator('[data-goal-code=WORKPLACE_DAILY]').click(); await m.getByRole('button', { name: /^30 分钟/ }).click(); await m.locator('.onboarding-primary').click();
  await m.locator('.onboarding-error[role=alert]').waitFor({ timeout: 3000 }); assert.ok(m.url().includes('/pages/onboarding/onboarding'));
  assert.equal(await m.locator('[data-goal-code=WORKPLACE_DAILY]').getAttribute('aria-pressed'), 'true'); assert.equal(await m.getByRole('button', { name: /^30 分钟/ }).getAttribute('aria-pressed'), 'true');
  report.checks.push({ name: 'target-readback-mismatch-preserves-visible-draft-no-placement', result: 'PASS' }); save(); await mismatch.context.close();
  const unreadable = await open('unreadable'), u = unreadable.page;
  await u.locator('[data-goal-code=FOUNDATION]').click(); assert.equal(await u.locator('.onboarding-primary').isDisabled(), true);
  await u.locator('.onboarding-primary').click({ force: true }); assert.equal(unreadable.state.counts.targetPut, 0);
  unreadable.state.unreadable = false; await u.getByRole('button', { name: '重新读取', exact: true }).click(); await u.locator('.yx-onboarding[aria-busy=false]').waitFor();
  assert.equal(await u.getByRole('alert').count(), 0); report.checks.push({ name: 'target-unreadable-blocks-write-real-reload-recovers', result: 'PASS' }); save(); await unreadable.context.close();
}
async function textAndPointer() {
  for (const mode of ['gate', 'consent', 'goal', 'assessment']) for (const locale of ['zh-CN', 'en-US']) {
    const next = await open(mode, 320, locale, 'light', 460), p = next.page;
    await p.evaluate(() => {
      const sizes = [...document.querySelectorAll('.yx-onboarding,.yx-onboarding *')].map(element => [element, parseFloat(getComputedStyle(element).fontSize)]);
      for (const [element, size] of sizes) if (size) element.style.setProperty('font-size', size * 2 + 'px', 'important');
      const style = document.createElement('style'); style.textContent = '.yx-onboarding .onboarding-error{font-size:28px!important}'; document.head.append(style);
    });
    await p.locator('.onboarding-exits').scrollIntoViewIfNeeded(); const facts = await snapshot(p);
    assert.equal(facts.overflow, false); assert.equal(facts.rawKeys, false); assert.ok(facts.targets.every(target => target.width >= 44 && target.height >= 44));
    if (mode === 'gate') assert.equal(facts.inputFont, '32px');
    await p.screenshot({ path: path.join(OUT, `${mode}-320-${locale}-200-short.png`), fullPage: true });
    report.checks.push({ name: `${mode}-${locale}-200-short`, facts, result: 'PASS' }); save(); await next.context.close();
  }
  for (const [ending, heldMs] of [['click', 0], ['click', 160], ['drag', 160], ['cancel', 160], ['clear', 0]]) {
    const next = await open('gate', 390, 'en-US'), p = next.page; next.state.adultStatus = 503;
    const year = p.locator('#mobile-onboarding-year'), button = p.locator('.onboarding-primary');
    await p.locator('.onboarding-check-row').click(); await year.fill('1820'); await p.keyboard.press('Enter'); await p.locator('#mobile-onboarding-year-error').waitFor();
    await button.scrollIntoViewIfNeeded(); await year.focus();
    const point = await button.evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, top: r.top + scrollY }; });
    await p.mouse.move(point.x, point.y);
    await p.evaluate(ending => {
      let c = document.querySelector('.yx-onboarding').__vueParentComponent; while(c&&!('pointerFeedback' in c.setupState))c=c.parent;
      window.__pointer = { clicks: 0, hit: false }; window.__snapshotActive = () => !!c.setupState.pointerFeedback;
      const button = document.querySelector('.onboarding-primary'); button.addEventListener('click', event => { if(event.isTrusted)window.__pointer.clicks++; });
      document.addEventListener('pointerdown', event => { window.__pointer.hit=!!event.target.closest('.onboarding-primary'); }, {once:true,capture:true});
      const input = document.getElementById('mobile-onboarding-year'); input.focus({preventScroll:true}); input.value=ending==='clear'?'':'1990'; input.dispatchEvent(new InputEvent('input',{bubbles:true}));
    }, ending);
    const cdp = ending === 'cancel' ? await next.context.newCDPSession(p) : null;
    if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y,id:1}]}); else if(!heldMs)await p.mouse.click(point.x,point.y); else await p.mouse.down();
    if(heldMs){ await p.waitForTimeout(heldMs); assert.equal(await p.evaluate(()=>window.__snapshotActive()),true); assert.equal(await button.evaluate(node=>node.getBoundingClientRect().top+scrollY),point.top); assert.equal(next.state.counts.adult,0); if(ending==='drag')await p.mouse.move(5,5); if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await cdp.detach();}else await p.mouse.up(); }
    await p.waitForFunction(()=>!window.__snapshotActive()); assert.equal(await p.evaluate(()=>window.__pointer.hit),true);
    if(ending==='click'){await p.locator('.onboarding-error[role=alert]').last().waitFor();assert.equal(next.state.counts.adult,1);}else assert.equal(next.state.counts.adult,0);
    const observed=await p.evaluate(()=>window.__pointer); assert.equal(observed.clicks,ending==='drag'||ending==='cancel'?0:1);
    report.checks.push({name:`old-center-${ending}-${heldMs}`,beforeTop:point.top,heldMs,observed,requests:next.state.counts.adult,result:'PASS'});save();await next.context.close();
  }
}
async function restoring() {
  for (const failed of [false, true]) {
    const owner = await open('consent'), p = owner.page;
    await p.getByRole('button', { name: '账号设置', exact: true }).click(); await p.waitForURL(url => url.hash.startsWith('#/pages/settings/settings'));
    owner.state.accepted = true; owner.state.targetClaimsStale = 'transient'; owner.state.refreshFailure = failed;
    owner.hold('/api/v1/auth/token/refresh');
    await p.evaluate(async () => { const { getUniRuntime } = await import('/src/platform/uni-runtime.ts'); await getUniRuntime().navigateTo({ url: '/pages/onboarding/onboarding' }); });
    await p.waitForFunction(() => { let c = document.querySelector('.yx-onboarding')?.__vueParentComponent; while(c&&!('restoring' in c.setupState))c=c.parent; return c && c.setupState.restoring && c.setupState.reading && c.setupState.busy; });
    assert.equal(owner.state.counts.refresh, 1); owner.release();
    if (failed) {
      await p.waitForURL(url => url.hash.startsWith('#/pages/login/login')); await p.locator('.login-submit[aria-disabled=false]').waitFor();
      assert.equal(await p.locator('#mobile-login-identifier').isDisabled(), false); assert.equal(await p.locator('#mobile-login-password').isDisabled(), false);
    } else {
      await p.getByRole('heading', { name: titles['zh-CN'].goal }).waitFor(); await p.locator('.yx-onboarding[aria-busy=false]').waitFor();
      await p.locator('[data-goal-code=FOUNDATION]').click(); assert.equal(await p.locator('.onboarding-primary').isDisabled(), false);
    }
    assert.equal(owner.state.counts.refresh, 1); assert.equal(owner.state.counts.targetPut, 0); assert.equal(owner.state.counts.consentPut, 0);
    report.checks.push({ name: `actual-onShow-restoring-claims-refresh-${failed ? '401-public-unlocked' : 'success-goal-available'}`, counts: owner.state.counts, result: 'PASS' }); save(); await owner.context.close();
  }
}
async function race() {
  const hidden = await open(), h = hidden.page;
  await h.locator('#mobile-onboarding-year').fill('1990'); await h.locator('.onboarding-check-row').click(); hidden.hold('/api/v1/iam/adult-gate'); await h.locator('.onboarding-primary').click(); await h.locator('.yx-onboarding[aria-busy=true]').waitFor();
  await h.evaluate(async () => { let c = document.querySelector('.yx-onboarding').__vueParentComponent; while(c&&!('birthYear' in c.setupState))c=c.parent; const s=c.setupState; window.__hiddenDraft=()=>s.birthYear===''&&!s.ageConfirmed&&!s.busy; const { getUniRuntime } = await import('/src/platform/uni-runtime.ts'); await getUniRuntime().navigateTo({ url: '/pages/settings/settings' }); });
  await h.waitForURL(url => url.hash.startsWith('#/pages/settings/settings')); hidden.release();
  await h.waitForFunction(() => window.__hiddenDraft()); await h.waitForLoadState('networkidle');
  assert.ok(h.url().includes('/pages/settings/settings')); assert.equal(hidden.state.counts.consentPut, 0); assert.equal(hidden.state.counts.targetPut, 0);
  report.checks.push({ name: 'actual-hide-clears-sensitive-draft-late-adult-does-not-navigate', result: 'PASS' }); save(); await hidden.context.close();
  const identity = await open(), i = identity.page;
  await i.locator('#mobile-onboarding-year').fill('1990'); await i.locator('.onboarding-check-row').click(); identity.hold('/api/v1/iam/adult-gate'); await i.locator('.onboarding-primary').click(); await i.locator('.yx-onboarding[aria-busy=true]').waitFor();
  await i.evaluate(async () => { let c = document.querySelector('.yx-onboarding').__vueParentComponent; while (c && !('session' in c.setupState)) c = c.parent; await c.setupState.session.logout(); });
  await i.waitForURL(url => url.hash.startsWith('#/pages/login/login')); identity.release(); await i.waitForLoadState('networkidle'); assert.equal(identity.state.counts.targetPut, 0); assert.equal(identity.state.counts.consentPut, 0);
  report.checks.push({ name: 'identity-revocation-late-adult-stays-public-no-write', result: 'PASS' }); save(); await identity.context.close();
  const navigation = await open('assessment'), n = navigation.page;
  await n.evaluate(async () => { const { getUniRuntime } = await import('/src/platform/uni-runtime.ts'); const original = getUniRuntime().navigateTo.bind(getUniRuntime()); window.__navigationRejects = 0; globalThis.uni = { ...globalThis.uni, navigateTo: options => { if (options.url.startsWith('/pages/assessment/')) { window.__navigationRejects++; throw new Error('Synthetic navigation failure'); } return original(options); } }; });
  await n.locator('.onboarding-primary').click(); await n.getByText('页面未能打开，请重试。', { exact: true }).waitFor({ timeout: 3000 });
  assert.equal(await n.locator('.yx-onboarding').getAttribute('aria-busy'), 'false'); assert.equal(await n.locator('.onboarding-primary').isDisabled(), false); assert.ok(n.url().includes('/pages/onboarding/onboarding'));
  assert.equal(await n.evaluate(() => window.__navigationRejects), 1);
  report.checks.push({ name: 'placement-navigation-rejection-unlocks-and-reports', result: 'PASS' }); save(); await navigation.context.close();
  const exiting = await open('gate'), x = exiting.page;
  await x.getByRole('button', { name: '退出登录', exact: true }).click(); await x.waitForURL(url => url.hash.startsWith('#/pages/login/login'));
  report.checks.push({ name: 'normal-exit-identity-change-public-route', result: 'PASS' }); save(); await exiting.context.close();
}
(async () => {
  browser = await chromium.launch();
  if (['smoke', 'all'].includes(GROUP)) await smoke();
  if (['matrix', 'all'].includes(GROUP)) await matrix();
  if (['controls', 'all'].includes(GROUP)) await controls();
  if (['flow', 'all'].includes(GROUP)) await flow();
  if (['recovery', 'all'].includes(GROUP)) await recovery();
  if (['race', 'all'].includes(GROUP)) await race();
  if (['restoring', 'all'].includes(GROUP)) await restoring();
  if (['text', 'all'].includes(GROUP)) await textAndPointer();
  assert.equal(report.pageErrors.length, 0); assert.ok(report.consoleErrors.every(message => /Failed to load resource:.*status of (404|409|503|401|403)\b/.test(message)));
  report.status = 'PASS_GROUP_UI_SYNTHETIC_NOT_BUSINESS_ACCEPTANCE'; report.sourceHashesAfter = Object.fromEntries(sources.map(file => [file, hash(file)])); save();
  console.log(JSON.stringify({ status: report.status, group: GROUP, matrix: report.matrix.length, checks: report.checks.length, pageErrors: report.pageErrors.length, output: OUT }));
})().catch(async error => {
  report.status = 'FAIL'; report.failure = error.stack; save();
  const page = browser?.contexts().at(-1)?.pages().at(-1);
  if (page) {
    try { report.failureState = await page.evaluate(() => ({ route: location.hash.split('?')[0], focusId: document.activeElement.id, busy: document.querySelector('.yx-onboarding')?.getAttribute('aria-busy'), errorPresent: document.querySelectorAll('.onboarding-error[role=alert]').length })); await page.screenshot({ path: path.join(OUT, 'failure.png'), fullPage: true }); }
    catch (captureError) { report.captureFailure = captureError.message; }
  }
  save(); console.error(error.stack); process.exitCode = 1;
}).finally(async () => { for (const release of releases) release(); await browser?.close(); });
