// Independent narrow actual-key review. Every API is intercepted as a rejection.
// Do not read bodies/headers, credentials, cookies, tokens or storage. Only public
// UI semantics, route metadata, booleans, counts and event targets are recorded.
const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../../../../..'), BASE = 'http://127.0.0.1:18183';
const SOURCE = 'apps/mobile/src/pages/login/login.vue', EXPECTED = '1d347967146a38723ab0bf3ae0b1accca3b519ae6515e7c14f12297be1b80e19';
const hash = () => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, SOURCE))).digest('hex');
const report = { at: new Date().toISOString(), scope: 'INDEPENDENT_MB001_1D34_PRIMARY_KEYBOARD_DELTA_H5', sourceHashBefore: hash(), browserAvailability: 'Browser plugin not available; existing Playwright 1.63.0 Chromium', cases: [], requests: [], pageErrors: [], expectedConsoleErrors: 0, unexpectedConsoleErrors: 0 };
const save = () => fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(report, null, 2));
const pending = new Set(); let browser;
async function fresh() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const state = { loginCount: 0, hold: false, release: null, entered: null };
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), u = new URL(request.url()), method = request.method(); report.requests.push({ method, origin: u.origin, path: u.pathname });
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true' };
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers, body: '' });
    if (method === 'POST' && u.pathname === '/api/v1/auth/login') {
      assert.equal(u.protocol, 'https:'); state.loginCount++;
      if (state.hold) await new Promise(resolve => { state.release = resolve; pending.add(resolve); state.entered?.(); });
    }
    return route.fulfill({ status: 401, headers, body: JSON.stringify({ code: 'iam.credentials.invalid', message: 'Synthetic UI rejection' }) });
  });
  const p = await context.newPage(); p.on('pageerror', e => report.pageErrors.push(e.name));
  p.on('console', m => { if (m.type() === 'error') { if (/Failed to load resource.*401/.test(m.text())) report.expectedConsoleErrors++; else report.unexpectedConsoleErrors++; } });
  await p.goto(`${BASE}/#/pages/login/login?theme=light&uiLocale=zh-CN`, { waitUntil: 'networkidle' }); await p.locator('#mobile-login-identifier').waitFor();
  const identity = await p.evaluate(() => ({ route: location.hash.split('?')[0], title: document.title, heading: document.getElementById('mobile-login-title').textContent, inputs: document.querySelectorAll('.login-input input').length, overlay: document.querySelectorAll('vite-error-overlay').length }));
  assert.equal(identity.route, '#/pages/login/login'); assert.equal(identity.heading, '欢迎回来'); assert.equal(identity.inputs, 2); assert.equal(identity.overlay, 0);
  await p.evaluate(() => { window.__keyboardTrace = []; for (const type of ['keydown', 'keyup', 'click', 'focusin']) document.addEventListener(type, e => window.__keyboardTrace.push({ type, key: e.key ?? null, repeat: e.repeat ?? null, targetId: e.target.id ?? null, targetClass: typeof e.target.className === 'string' ? e.target.className : null, trusted: e.isTrusted, focusId: document.activeElement.id }), true); });
  return { context, p, state, identity, release() { if (state.release) { pending.delete(state.release); state.release(); state.release = null; } state.hold = false; } };
}
async function semantics(p, missing = []) {
  const actual = await p.locator('.login-input input').evaluateAll(es => es.map(e => ({ id: e.id, name: e.name, autocomplete: e.autocomplete, type: e.type, labelledBy: e.getAttribute('aria-labelledby'), invalid: e.getAttribute('aria-invalid'), describedBy: e.getAttribute('aria-describedby'), disabled: e.hasAttribute('disabled') })));
  assert.equal(actual.length, 2);
  for (const [index, field] of ['identifier', 'password'].entries()) {
    const e = actual[index]; assert.equal(e.id, `mobile-login-${field}`); assert.equal(e.name, field); assert.equal(e.autocomplete, field === 'identifier' ? 'username' : 'current-password'); assert.equal(e.labelledBy, `mobile-login-${field}-label`); assert.equal(e.invalid, missing.includes(field) ? 'true' : null); assert.equal(e.describedBy, missing.includes(field) ? 'mobile-login-error' : null);
  }
  return actual;
}
async function fill(p) { await p.locator('#mobile-login-identifier').fill('independent-keyboard-synthetic-account'); await p.locator('#mobile-login-password').fill('independent-keyboard-synthetic-password'); await p.locator('#mobile-login-password').blur(); }
async function heldKey(p, key) {
  await p.locator('.login-submit').focus(); await p.keyboard.down(key); await p.waitForTimeout(160); await p.keyboard.down(key);
  return p.evaluate(() => ({ buttonFocused: document.activeElement.classList.contains('login-submit'), errors: document.querySelectorAll('#mobile-login-error').length, busy: document.querySelector('.login-form').getAttribute('aria-busy') }));
}
async function shot(p, name) { await p.screenshot({ path: path.join(__dirname, name), fullPage: true, mask: [p.locator('#mobile-login-password')] }); }
(async () => {
  assert.equal(report.sourceHashBefore, EXPECTED); browser = await chromium.launch();
  for (const key of ['Enter', 'Space']) {
    const c = await fresh(), { p, state } = c; const held = await heldKey(p, key);
    assert.equal(held.buttonFocused, true); assert.equal(held.errors, 0); assert.equal(held.busy, 'false'); assert.equal(state.loginCount, 0);
    await p.keyboard.up(key); await p.waitForFunction(() => document.activeElement.id === 'mobile-login-identifier'); await p.waitForTimeout(50); assert.equal(await p.evaluate(() => document.activeElement.id), 'mobile-login-identifier');
    const actual = await semantics(p, ['identifier', 'password']); assert.equal(await p.locator('#mobile-login-error').getAttribute('role'), 'alert'); assert.equal(state.loginCount, 0);
    report.cases.push({ test: 'empty-primary-held-repeat-keydown-and-keyup-first-error', key, holdMs: 160, held, semantics: actual, afterFocus: 'mobile-login-identifier', loginRequests: state.loginCount, trace: await p.evaluate(() => window.__keyboardTrace), result: 'PASS' });
    await shot(p, `empty-primary-${key}.png`); save(); await c.context.close();
  }
  for (const key of ['Enter', 'Space']) {
    const c = await fresh(), { p, state } = c; await fill(p); state.hold = true; const entered = new Promise(resolve => state.entered = resolve);
    const held = await heldKey(p, key); assert.equal(held.buttonFocused, true); assert.equal(state.loginCount, 0); await p.keyboard.up(key); await entered; await p.locator('.login-form[aria-busy=true]').waitFor();
    const disabled = await p.locator('.login-input input,.login-submit,.login-password-toggle,.login-text-button').evaluateAll(es => es.map(e => e.hasAttribute('disabled'))); assert.ok(disabled.every(Boolean)); const busySemantics = await semantics(p);
    await p.keyboard.press('Enter'); await p.keyboard.press('Space');
    for (const selector of ['.login-submit', '.login-password-toggle', '.login-recovery .login-text-button', '.login-register .login-text-button']) { await p.locator(selector).scrollIntoViewIfNeeded(); const b = await p.locator(selector).boundingBox(); await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2); }
    const guarded = await p.evaluate(async () => {
      let i = document.querySelector('.v2-login').__vueParentComponent; while (i && !('identifier' in i.setupState)) i = i.parent; const s = i.setupState;
      document.querySelectorAll('.login-submit,.login-password-toggle,.login-text-button').forEach(e => e.dispatchEvent(new MouseEvent('click', { bubbles: true })));
      document.getElementById('mobile-login-password').dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true })); await s.submit(); s.togglePassword(); s.navigate('/pages/register/register');
      return { busy: s.submitting, accountPreserved: s.identifier === 'independent-keyboard-synthetic-account', passwordPreserved: s.password === 'independent-keyboard-synthetic-password', passwordHidden: !s.showPassword, route: location.hash.split('?')[0] };
    });
    assert.ok(guarded.busy && guarded.accountPreserved && guarded.passwordPreserved && guarded.passwordHidden); assert.equal(guarded.route, '#/pages/login/login'); assert.equal(state.loginCount, 1); await shot(p, `pending-primary-${key}.png`);
    c.release(); await p.locator('.login-form[aria-busy=false]').waitFor(); await p.locator('#mobile-login-error[role=alert]').waitFor(); await semantics(p); assert.equal(state.loginCount, 1);
    report.cases.push({ test: 'valid-primary-one-request-pending-guards-and-rejection-recovery', key, holdMs: 160, held, disabled, busySemantics, guarded, loginRequests: state.loginCount, afterErrorVisible: true, trace: await p.evaluate(() => window.__keyboardTrace), result: 'PASS' }); save(); await c.context.close();
  }
  for (const key of ['Enter', 'Space']) {
    const c = await fresh(), { p, state } = c; await p.locator('#mobile-login-identifier').fill('independent-password-required-account'); await p.locator('.login-submit').focus(); await p.keyboard.press(key);
    await p.waitForFunction(() => document.activeElement.id === 'mobile-login-password'); await p.waitForTimeout(50); assert.equal(await p.evaluate(() => document.activeElement.id), 'mobile-login-password'); const actual = await semantics(p, ['password']); assert.equal(state.loginCount, 0);
    report.cases.push({ test: 'primary-first-missing-password-remains-first-error-after-keyup', key, afterFocus: 'mobile-login-password', semantics: actual, loginRequests: 0, result: 'PASS' }); save(); await c.context.close();
  }
  const field = await fresh(), p = field.p; await p.locator('#mobile-login-identifier').fill('independent-field-confirm-account'); await p.keyboard.press('Enter'); await p.waitForFunction(() => document.activeElement.id === 'mobile-login-password'); assert.equal(field.state.loginCount, 0);
  await p.keyboard.press('Enter'); await p.locator('#mobile-login-error[role=alert]').waitFor(); await p.waitForFunction(() => document.activeElement.id === 'mobile-login-password'); const missingPassword = await semantics(p, ['password']); assert.equal(field.state.loginCount, 0);
  await p.locator('#mobile-login-password').fill('independent-field-confirm-synthetic-password'); await p.keyboard.press('Enter'); await p.locator('.login-form[aria-busy=false]').waitFor(); await p.locator('#mobile-login-error[role=alert]').waitFor(); await semantics(p); assert.equal(field.state.loginCount, 1);
  report.cases.push({ test: 'input-confirm-account-next-empty-password-error-and-valid-password-submit', accountEnterFocus: 'mobile-login-password', emptyPasswordRequests: 0, missingPasswordSemantics: missingPassword, validPasswordRequests: field.state.loginCount, result: 'PASS' }); save(); await field.context.close();
  const mouse = await fresh(); await fill(mouse.p); await mouse.p.locator('.login-submit').click(); await mouse.p.locator('#mobile-login-error[role=alert]').waitFor(); await mouse.p.locator('.login-form[aria-busy=false]').waitFor(); assert.equal(mouse.state.loginCount, 1);
  report.cases.push({ test: 'mouse-primary-form-submit-preserved', loginRequests: mouse.state.loginCount, result: 'PASS' }); save(); await mouse.context.close();
  report.sourceHashAfter = hash(); assert.equal(report.sourceHashAfter, EXPECTED); assert.deepEqual(report.pageErrors, []); assert.equal(report.unexpectedConsoleErrors, 0); report.result = 'UI_PASS_PRIMARY_KEYBOARD_DELTA_H5'; report.unverified = ['26-case ordinary visual matrix not repeated', 'real IAM login/adult gate/business acceptance', 'native App or mini-program', 'physical keyboard/screen reader', 'credential storage or refresh clearing']; save(); console.log(JSON.stringify({ result: report.result, cases: report.cases.length, sourceHash: report.sourceHashAfter }));
})().catch(e => { report.result = 'FAIL'; report.failure = { name: e.name, message: e.message }; report.sourceHashAfter = hash(); save(); console.error(e.message); process.exitCode = 1; }).finally(async () => { pending.forEach(resolve => resolve()); if (browser) await browser.close(); });
