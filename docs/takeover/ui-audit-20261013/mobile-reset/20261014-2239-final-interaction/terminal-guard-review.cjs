// Synthetic H5 UI guard checks. API requests are intercepted without reading
// body/header/token/cookie/storage. Evidence contains metadata and booleans only.
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../../../../..'), BASE = 'http://127.0.0.1:18183';
const expected = { 'apps/mobile/src/pages/reset-password/reset-password.vue': 'e00853df5fb3dfdc0d79a824f2f751035a8c3319697910d92115334dbb42031b', 'apps/mobile/src/platform/pointer-feedback.ts': '6464f4c1712b5a0f2fd4ab01d451d5bb6ffaa13bde486826a424511059ef6425' };
const hashes = () => Object.fromEntries(Object.keys(expected).map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex')]));
const report = { at: new Date().toISOString(), scope: 'INDEPENDENT_MB003_REQUEST_BUSY_AND_SUCCESS_TERMINAL_H5', sourceHashesBefore: hashes(), cases: [], requests: [], pageErrors: [], expectedConsoleErrors: 0, unexpectedConsoleErrors: 0 };
const save = () => fs.writeFileSync(path.join(__dirname, 'terminal-guard-results.json'), JSON.stringify(report, null, 2));
let browser, release;
(async () => {
  assert.deepEqual(report.sourceHashesBefore, expected); browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const state = { request: 0, confirm: 0 }; let enteredResolve; const entered = new Promise(resolve => enteredResolve = resolve);
  await context.route('**/api/v1/**', async route => {
    const req = route.request(), u = new URL(req.url()), method = req.method(); report.requests.push({ method, origin: u.origin, path: u.pathname });
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true' };
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers, body: '' });
    if (method === 'POST' && u.pathname.endsWith('/password-reset/request')) { assert.equal(u.protocol, 'https:'); state.request++; await new Promise(resolve => { release = resolve; enteredResolve(); }); return route.fulfill({ status: 503, headers, body: JSON.stringify({ code: 'SERVICE_UNAVAILABLE' }) }); }
    if (method === 'POST' && u.pathname.endsWith('/password-reset/confirm')) { assert.equal(u.protocol, 'https:'); state.confirm++; return route.fulfill({ status: 204, headers, body: '' }); }
    return route.fulfill({ status: 401, headers, body: JSON.stringify({ code: 'UNSPECIFIED_FAILURE' }) });
  });
  const p = await context.newPage(); p.on('pageerror', e => report.pageErrors.push(e.name)); p.on('console', m => { if (m.type() === 'error') { if (/Failed to load resource.*(?:401|503)/.test(m.text())) report.expectedConsoleErrors++; else report.unexpectedConsoleErrors++; } });
  await p.goto(`${BASE}/#/pages/reset-password/reset-password?theme=light&uiLocale=zh-CN`, { waitUntil: 'networkidle' }); await p.locator('#mobile-reset-identifier').waitFor();
  await p.locator('#mobile-reset-identifier').fill('independent-request-busy-account'); await p.locator('.reset-submit').click(); await entered; await p.locator('.reset-form[aria-busy=true]').waitFor();
  const nativeDisabled = await p.locator('.reset-input input,.reset-submit,.reset-text-button').evaluateAll(es => es.map(e => ({ disabled: e.hasAttribute('disabled'), ariaDisabled: e.getAttribute('aria-disabled') })));
  assert.ok(nativeDisabled.every(e => e.disabled));
  for (const selector of ['.reset-submit', '.reset-step-button', '.reset-login-button']) { const box = await p.locator(selector).boundingBox(); await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); }
  await p.keyboard.press('Enter');
  const pendingGuard = await p.evaluate(async () => {
    let i = document.querySelector('.v2-reset').__vueParentComponent; while (i && !('token' in i.setupState)) i = i.parent; const s = i.setupState;
    document.querySelectorAll('.reset-submit,.reset-step-button,.reset-login-button').forEach(e => e.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    document.querySelector('#mobile-reset-identifier').dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true })); await s.submit(); await s.switchStep(); s.returnLogin();
    return { requestStep: s.step === 'request', submitting: s.submitting, accountRetained: s.identifier === 'independent-request-busy-account', codeEmpty: s.token === '', passwordEmpty: s.newPassword === '', route: location.hash.split('?')[0] };
  });
  assert.ok(pendingGuard.requestStep && pendingGuard.submitting && pendingGuard.accountRetained && pendingGuard.codeEmpty && pendingGuard.passwordEmpty); assert.equal(pendingGuard.route, '#/pages/reset-password/reset-password'); assert.equal(state.request, 1); assert.equal(state.confirm, 0);
  report.cases.push({ test: 'request-pending-real-and-programmatic-controls-guarded', nativeDisabled, pendingGuard, requests: { ...state } }); save();
  await p.screenshot({ path: path.join(__dirname, 'request-pending-guarded.png'), fullPage: true }); release(); release = null; await p.locator('.reset-server-error').waitFor(); assert.equal(await p.locator('.reset-server-error').innerText(), '发送没有完成，请稍后再试。');
  await p.locator('.reset-step-button').click(); await p.locator('#mobile-reset-token').waitFor(); await p.locator('#mobile-reset-token').fill('independent-terminal-fixture-'.padEnd(32, 'x')); await p.locator('#mobile-reset-newPassword').fill('independent-terminal-synthetic-password');
  await p.locator('.reset-submit').click(); await p.locator('.reset-success').waitFor();
  const terminal = await p.evaluate(async () => {
    let i = document.querySelector('.v2-reset').__vueParentComponent; while (i && !('token' in i.setupState)) i = i.parent; const s = i.setupState;
    const before = { completed: s.resetCompleted, accountCleared: s.identifier === '', codeCleared: s.token === '', passwordCleared: s.newPassword === '', showCleared: !s.showPassword, forms: document.querySelectorAll('.reset-form,input,.reset-step-button,.reset-password-toggle').length };
    await s.submit(); await s.switchStep(); await s.submit();
    return { before, after: { completed: s.resetCompleted, accountCleared: s.identifier === '', codeCleared: s.token === '', passwordCleared: s.newPassword === '', showCleared: !s.showPassword, forms: document.querySelectorAll('.reset-form,input,.reset-step-button,.reset-password-toggle').length, successVisible: !!document.querySelector('.reset-success[role=status]') } };
  });
  for (const s of [terminal.before, terminal.after]) { assert.ok(s.completed && s.accountCleared && s.codeCleared && s.passwordCleared && s.showCleared); assert.equal(s.forms, 0); }
  assert.equal(terminal.after.successVisible, true); assert.equal(state.request, 1); assert.equal(state.confirm, 1); report.cases.push({ test: 'synthetic-success-is-terminal-after-repeat-submit-or-switch', terminal, requests: { ...state } }); save();
  await p.locator('.reset-login-button').click(); await p.waitForURL(url => url.hash.startsWith('#/pages/login/login')); report.returnRoute = '#/pages/login/login';
  report.sourceHashesAfter = hashes(); assert.deepEqual(report.sourceHashesAfter, expected); assert.deepEqual(report.pageErrors, []); assert.equal(report.unexpectedConsoleErrors, 0); report.result = 'TERMINAL_GUARD_SCOPE_PASS'; save(); console.log(JSON.stringify({ result: report.result, cases: report.cases.length })); await context.close();
})().catch(e => { report.result = 'FAIL'; report.failure = { name: e.name, message: e.message }; save(); console.error(e.message); process.exitCode = 1; }).finally(async () => { release?.(); if (browser) await browser.close(); });
