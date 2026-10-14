// Independent final H5 review. Isolated synthetic fixtures only; no credential,
// request body/header, cookie or authentication-storage reads or logs.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../../../../..');
const OUT = __dirname;
const BASE = 'http://127.0.0.1:18183';
const SOURCE = 'apps/mobile/src/pages/login/login.vue';
const EXPECTED = 'da5ad20851a4158ea0e23918adb27f1bcc7047ae67778add321aa8d397bb58be';
const digest = () => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, SOURCE))).digest('hex');
const report = { at: new Date().toISOString(), scope: 'INDEPENDENT_MOBILE_LOGIN_H5_UI_ONLY', source: SOURCE, expectedSourceHash: EXPECTED, sourceHashBefore: digest(), checks: [], cases: [], pageErrors: [], expectedHttpErrorCount: 0, unexpectedConsoleErrorCount: 0, requests: [] };
const save = () => fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(report, null, 2));
let browser;
const releases = new Set();
const names = { 'zh-CN': { account: '账号', password: '密码', show: '显示密码', hide: '隐藏密码' }, 'en-US': { account: 'Account', password: 'Password', show: 'Show password', hide: 'Hide password' } };
async function fresh({ width = 390, height = 844, locale = 'zh-CN', theme = 'light', scenario = 'reject' } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  let count = 0, held = false, release, loginAt = 0, permissionsAt = 0;
  await context.route('**/api/v1/**', async route => {
    const req = route.request(), url = new URL(req.url()), method = req.method();
    report.requests.push({ method, origin: url.origin, path: url.pathname, scenario });
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true' };
    if (method === 'OPTIONS') { await route.fulfill({ status: 204, headers, body: '' }); return; }
    if (method === 'POST' && url.pathname === '/api/v1/auth/login') {
      assert.equal(url.protocol, 'https:');
      count++; loginAt = Date.now();
      if (held) await new Promise(resolve => { release = resolve; releases.add(resolve); });
      if (scenario === 'two-stage') {
        await new Promise(resolve => setTimeout(resolve, 5100));
        await route.fulfill({ status: 200, headers, body: JSON.stringify({ accessToken: 'independent-ui-synthetic-invalid-credential', adultGate: 'REQUIRED' }) });
        return;
      }
    }
    if (method === 'GET' && url.pathname === '/api/v1/iam/permissions' && scenario === 'two-stage') {
      permissionsAt = Date.now();
      await new Promise(resolve => setTimeout(resolve, 5900));
      await route.fulfill({ status: 503, headers, body: JSON.stringify({ code: 'SERVICE_UNAVAILABLE', message: 'Synthetic permission outage' }) }); return;
    }
    await route.fulfill({ status: 401, headers, body: JSON.stringify({ code: 'iam.credentials.invalid', message: 'Synthetic rejection' }) });
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push({ name: error.name, message: error.message }));
  page.on('console', message => { if (message.type() === 'error') { if (/Failed to load resource.*(?:401|503)/.test(message.text())) report.expectedHttpErrorCount++; else report.unexpectedConsoleErrorCount++; } });
  await page.goto(`${BASE}/#/pages/login/login?uiLocale=${locale}&theme=${theme}`, { waitUntil: 'networkidle' });
  await page.getByLabel(names[locale].account, { exact: true }).waitFor();
  return { context, page, locale, count: () => count, hold: () => { held = true; }, release: () => { if (release) { releases.delete(release); release(); } }, times: () => ({ loginAt, permissionsAt }) };
}
async function geometry(page) {
  return page.evaluate(() => {
    const rect = selector => document.querySelector(selector).getBoundingClientRect();
    const a = rect('.login-fields > .login-field:first-child'), b = rect('.login-fields > .login-field:nth-child(2)'), button = rect('.login-submit');
    return { width: innerWidth, contentWidth: rect('.login-content').width, overflow: document.documentElement.scrollWidth > innerWidth + 1, titleFont: getComputedStyle(document.querySelector('.login-title')).fontSize, inputFonts: [...document.querySelectorAll('.login-input input')].map(e => getComputedStyle(e).fontSize), fieldGap: b.top - a.bottom, submitDocumentTop: button.top + scrollY, initialActionGap: button.top - b.bottom, errorRows: document.querySelectorAll('.login-error').length };
  });
}
async function nativeFacts(page) {
  return page.evaluate(() => ['identifier', 'password'].map(kind => {
    const e = document.getElementById(`mobile-login-${kind}`);
    return { kind, tag: e.tagName, id: e.id, name: e.name, type: e.type, autocomplete: e.autocomplete, required: e.required, label: e.getAttribute('aria-label'), labelledby: e.getAttribute('aria-labelledby'), invalid: e.getAttribute('aria-invalid'), describedby: e.getAttribute('aria-describedby') };
  }));
}
async function timing(kind, activation) {
  const current = await fresh(), { page } = current;
  const observed = await page.evaluate(({ kind, activation }) => {
    let instance = document.querySelector('.v2-login').__vueParentComponent;
    while (instance && !('password' in instance.setupState)) instance = instance.parent;
    if (!instance) throw new Error('Login setup state missing');
    const state = instance.setupState, account = document.querySelector('#mobile-login-identifier'), password = document.querySelector('#mobile-login-password');
    const syntheticAccount = 'independent-synthetic-identifier', initial = 'independent-synthetic-first', expected = kind === 'clear' ? '' : kind === 'last-character' ? initial + '-x' : 'independent-synthetic-replacement';
    const calls = [];
    state.session.login = async (identifier, secret) => { calls.push({ identifierMatches: identifier === syntheticAccount, passwordMatchesLatest: secret === expected }); state.session.lastError = 'iam.credentials.invalid'; return false; };
    account.value = syntheticAccount; account.dispatchEvent(new InputEvent('input', { bubbles: true })); password.focus();
    const started = performance.now();
    password.value = initial; password.dispatchEvent(new InputEvent('input', { bubbles: true }));
    password.value = expected; password.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: kind === 'clear' ? 'deleteContentBackward' : 'insertText' }));
    const modelAlreadyCurrent = state.password === expected;
    if (activation === 'Enter') password.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    else { password.blur(); document.querySelector('.login-submit').click(); }
    return { kind, activation, elapsedMs: performance.now() - started, modelAlreadyCurrent, calls };
  }, { kind, activation });
  assert.ok(observed.elapsedMs < 100); assert.equal(observed.modelAlreadyCurrent, false, 'Must exercise real stale uni-model window');
  await page.getByRole('alert').waitFor();
  if (kind === 'clear') {
    assert.equal(observed.calls.length, 0); await page.waitForFunction(() => document.activeElement.id === 'mobile-login-password');
    assert.equal(await page.locator('#mobile-login-password').getAttribute('aria-invalid'), 'true');
    assert.equal(await page.locator('#mobile-login-password').getAttribute('aria-describedby'), 'mobile-login-error');
  } else { assert.equal(observed.calls.length, 1); assert.ok(observed.calls[0].identifierMatches && observed.calls[0].passwordMatchesLatest); }
  assert.equal(current.count(), 0); report.cases.push(observed); save(); await current.context.close();
}
async function noDetailSubmit() {
  const current = await fresh(), { page } = current;
  const observed = await page.evaluate(async () => {
    let instance = document.querySelector('.v2-login').__vueParentComponent;
    while (instance && !('password' in instance.setupState)) instance = instance.parent;
    const state = instance.setupState, syntheticAccount = 'independent-no-detail-identifier', syntheticPassword = 'independent-no-detail-password';
    state.identifier = syntheticAccount; state.password = syntheticPassword; let calls = 0, matches = false;
    state.session.login = async (identifier, secret) => { calls++; matches = identifier === syntheticAccount && secret === syntheticPassword; state.session.lastError = 'iam.credentials.invalid'; return false; };
    await state.submit();
    return { kind: 'absent-submit-detail', calls, matches, valuesPreserved: state.identifier === syntheticAccount && state.password === syntheticPassword };
  });
  assert.equal(observed.calls, 1); assert.equal(observed.matches, true); assert.equal(observed.valuesPreserved, true); assert.equal(current.count(), 0);
  report.cases.push(observed); save(); await current.context.close();
}
(async () => {
  assert.equal(report.sourceHashBefore, EXPECTED); browser = await chromium.launch();
  for (const kind of ['clear', 'last-character', 'replacement']) for (const activation of ['click', 'Enter']) await timing(kind, activation);
  await noDetailSubmit();
  report.checks.push('Six native rapid input cases prove stale-model-window click/Enter consumes current values; empty password causes zero action/API calls and correct native focus/errors; no-detail submit preserves fields.');
  for (const width of [390, 1280]) {
    const current = await fresh({ width }), { page } = current, facts = await geometry(page);
    assert.equal(facts.errorRows, 0); assert.equal(facts.overflow, false); assert.equal(facts.titleFont, '28px'); assert.deepEqual(facts.inputFonts, ['16px', '16px']); assert.ok(facts.fieldGap >= 23.9 && facts.fieldGap <= 24.1); assert.ok(facts.initialActionGap >= 23.9 && facts.initialActionGap <= 24.1);
    const native = await nativeFacts(page); assert.deepEqual(native.map(e => e.name), ['identifier', 'password']); assert.deepEqual(native.map(e => e.autocomplete), ['username', 'current-password']); assert.ok(native.every(e => e.tag === 'INPUT' && e.required && e.labelledby));
    await page.screenshot({ path: path.join(OUT, `login-default-${width}.png`), fullPage: true }); report.cases.push({ kind: 'default-geometry', ...facts, native }); await current.context.close(); save();
  }
  const current = await fresh(), { page } = current, account = page.getByLabel('账号', { exact: true }), password = page.getByLabel('密码', { exact: true });
  await page.locator('.login-submit').click(); await page.getByRole('alert').waitFor(); await page.waitForFunction(() => document.activeElement.id === 'mobile-login-identifier');
  const invalid = await nativeFacts(page); assert.ok(invalid.every(e => e.invalid === 'true' && e.describedby === 'mobile-login-error')); assert.equal(current.count(), 0);
  await account.fill('independent-bridge-identifier'); await password.fill('independent-bridge-password'); await password.blur();
  await page.waitForFunction(() => document.querySelectorAll('[aria-invalid=true]').length === 0 && document.querySelectorAll('.login-error[aria-hidden=true]').length === 1);
  assert.equal(await page.getByRole('alert').count(), 0); assert.ok((await nativeFacts(page)).every(e => e.invalid === null && e.describedby === null));
  await account.focus(); await page.keyboard.press('Enter'); await page.waitForFunction(() => document.activeElement.id === 'mobile-login-password'); assert.equal(current.count(), 0);
  const eye = page.getByRole('button', { name: '显示密码', exact: true });
  const eyeSize = await eye.boundingBox(); assert.ok(eyeSize.width >= 44 && eyeSize.height >= 44); assert.equal(await eye.getAttribute('aria-controls'), 'mobile-login-password');
  await eye.focus(); await page.keyboard.press('Enter'); assert.equal(await password.getAttribute('type'), 'text'); assert.equal(await page.getByRole('button', { name: '隐藏密码', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Space'); assert.equal(await password.getAttribute('type'), 'password'); assert.equal(await password.getAttribute('autocomplete'), 'current-password');
  current.hold(); await password.focus(); await page.keyboard.press('Enter'); await page.waitForFunction(() => document.querySelector('.login-form').getAttribute('aria-busy') === 'true');
  assert.equal(await password.isDisabled(), true); assert.equal(await account.isDisabled(), true); assert.equal(await eye.isDisabled(), true);
  assert.ok((await page.locator('.login-text-button').evaluateAll(elements => elements.map(e => e.hasAttribute('disabled')))).every(Boolean));
  await page.evaluate(() => { document.querySelector('.login-submit').click(); document.querySelector('#mobile-login-password').dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true })); document.querySelectorAll('.login-text-button').forEach(e => e.click()); document.querySelector('.login-password-toggle').click(); });
  assert.equal(current.count(), 1); assert.ok(page.url().includes('/pages/login/login')); assert.equal(await password.getAttribute('type'), 'password');
  current.release(); await page.getByRole('alert').waitFor(); await page.waitForFunction(() => document.querySelector('.login-form').getAttribute('aria-busy') === 'false');
  assert.equal(await password.isEnabled(), true); assert.equal(await password.getAttribute('aria-invalid'), null); await account.fill('independent-edited-identifier'); assert.equal(await page.getByRole('alert').count(), 1);
  await page.evaluate(async () => { const { mobileI18nAdapter } = await import('/src/platform/v2-foundation.ts'); mobileI18nAdapter.setLocale('en-US'); });
  await page.getByLabel('Account', { exact: true }).waitFor(); assert.equal(await page.locator('#mobile-login-password').getAttribute('aria-label'), 'Password'); assert.equal(await page.locator('#mobile-login-password').getAttribute('name'), 'password');
  report.cases.push({ kind: 'native-bridge-keyboard-busy', requiredNative: invalid, eyeTarget: { width: eyeSize.width, height: eyeSize.height }, loginRequests: current.count(), localeChangedNative: await nativeFacts(page) });
  report.checks.push('Live required-state bridge, first-error focus, error clearing, account/password Enter, eye Enter/Space, 44px eye, live language labels and all busy exits verified; server rejection remains neutral to field syntax.');
  await current.context.close(); save();
  const cleanBusy = await fresh(), cleanPage = cleanBusy.page;
  await cleanPage.getByLabel('账号', { exact: true }).fill('independent-first-busy-identifier'); await cleanPage.getByLabel('密码', { exact: true }).fill('independent-first-busy-password');
  cleanBusy.hold(); const cleanBefore = await geometry(cleanPage); await cleanPage.locator('.login-submit').click(); await cleanPage.waitForFunction(() => document.querySelector('.login-form').getAttribute('aria-busy') === 'true');
  const cleanAfter = await geometry(cleanPage); assert.equal(cleanAfter.errorRows, 0); assert.equal(cleanBefore.submitDocumentTop, cleanAfter.submitDocumentTop); assert.equal(cleanBusy.count(), 1);
  await cleanPage.screenshot({ path: path.join(OUT, 'login-first-valid-busy-390.png'), fullPage: true }); cleanBusy.release(); await cleanPage.getByRole('alert').waitFor(); await cleanBusy.context.close();
  report.cases.push({ kind: 'first-valid-busy-no-placeholder', before: cleanBefore, busy: cleanAfter }); save();
  const enlarged = await fresh({ locale: 'en-US' }), zoom = enlarged.page;
  await zoom.evaluate(() => {
    // Snapshot before mutation so inherited fonts are doubled exactly once.
    const sizes = [...document.querySelectorAll('.v2-login,.v2-login *')].map(e => [e, parseFloat(getComputedStyle(e).fontSize)]);
    sizes.forEach(([e, size]) => { if (size > 0) e.style.setProperty('font-size', `${size * 2}px`, 'important'); });
    // This row is created only after a real error, after the snapshot above.
    const style = document.createElement('style'); style.textContent = '.v2-login .login-error{font-size:28px!important}'; document.head.append(style);
  });
  const zoomFacts = await geometry(zoom); assert.equal(zoomFacts.titleFont, '56px'); assert.deepEqual(zoomFacts.inputFonts, ['32px', '32px']);
  assert.equal((await geometry(zoom)).errorRows, 0); await zoom.locator('.login-submit').click(); await zoom.getByRole('alert').waitFor();
  const errorBefore = await zoom.evaluate(() => { const e = document.querySelector('.login-error'), b = document.querySelector('.login-submit'); return { errorHeight: e.getBoundingClientRect().height, buttonTop: b.getBoundingClientRect().top + scrollY, font: getComputedStyle(e).fontSize, visibility: getComputedStyle(e).visibility }; });
  await zoom.screenshot({ path: path.join(OUT, 'login-english-200-required.png'), fullPage: true });
  await zoom.getByLabel('Account', { exact: true }).fill('independent-zoom-identifier'); await zoom.getByLabel('Password', { exact: true }).fill('independent-zoom-password'); await zoom.getByLabel('Password', { exact: true }).blur();
  await zoom.waitForFunction(() => document.querySelector('.login-error').getAttribute('aria-hidden') === 'true');
  const errorAfter = await zoom.evaluate(() => { const e = document.querySelector('.login-error'), b = document.querySelector('.login-submit'); return { errorHeight: e.getBoundingClientRect().height, buttonTop: b.getBoundingClientRect().top + scrollY, visibility: getComputedStyle(e).visibility, ariaHidden: e.getAttribute('aria-hidden'), id: e.id, role: e.getAttribute('role'), inputErrorsAbsent: [...document.querySelectorAll('.login-input input')].every(i => !i.hasAttribute('aria-invalid') && !i.hasAttribute('aria-describedby')), overflow: document.documentElement.scrollWidth > innerWidth + 1 }; });
  assert.equal(errorBefore.font, '28px'); assert.ok(errorBefore.errorHeight > 44.8, 'English required error must exercise natural multiline height at exact 200%');
  assert.equal(errorAfter.errorHeight, errorBefore.errorHeight); assert.equal(errorAfter.buttonTop, errorBefore.buttonTop); assert.equal(errorAfter.visibility, 'hidden'); assert.equal(errorAfter.id, ''); assert.equal(errorAfter.role, null); assert.equal(errorAfter.inputErrorsAbsent, true); assert.equal(errorAfter.overflow, false);
  enlarged.hold(); await zoom.locator('.login-submit').click(); await zoom.waitForFunction(() => document.querySelector('.login-form').getAttribute('aria-busy') === 'true');
  const busyTop = (await geometry(zoom)).submitDocumentTop; assert.equal(busyTop, errorBefore.buttonTop); await zoom.screenshot({ path: path.join(OUT, 'login-english-200-cleared-busy.png'), fullPage: true });
  enlarged.release(); await zoom.getByRole('alert').waitFor(); await enlarged.context.close(); report.cases.push({ kind: 'english-200-natural-error-height', methodology: 'Snapshot computed font sizes then double once; dynamically created error font 14px -> 28px', zoomFacts, before: errorBefore, cleared: errorAfter, busyTop });
  report.checks.push('No feedback row initially or first legal busy; only a true error creates retained natural height. At English 200%, clearing hides alert/ARIA references while button document top and error height stay identical through busy.'); save();
  const sequential = await fresh({ scenario: 'two-stage' }), slow = sequential.page;
  await slow.getByLabel('账号', { exact: true }).fill('independent-slow-identifier'); await slow.getByLabel('密码', { exact: true }).fill('independent-slow-password'); await slow.locator('.login-submit').click(); await slow.waitForFunction(() => document.querySelector('.login-form').getAttribute('aria-busy') === 'true');
  assert.ok(sequential.times().loginAt > 0); await slow.waitForTimeout(Math.max(0, 10200 - (Date.now() - sequential.times().loginAt)));
  const observedAtMs = Date.now() - sequential.times().loginAt; assert.ok(observedAtMs > 10000); assert.ok(sequential.times().permissionsAt > sequential.times().loginAt); assert.equal(await slow.locator('.login-form').getAttribute('aria-busy'), 'true'); assert.equal(await slow.getByRole('alert').count(), 0); assert.equal(sequential.count(), 1);
  await slow.screenshot({ path: path.join(OUT, 'login-two-stage-still-busy.png'), fullPage: true }); await slow.getByRole('alert').waitFor(); await slow.waitForFunction(() => document.querySelector('.login-form').getAttribute('aria-busy') === 'false');
  const finalMessage = await slow.getByRole('alert').innerText(); assert.ok(finalMessage.length && !/(账号或密码不正确|账号不存在|未注册)/.test(finalMessage)); assert.ok(slow.url().includes('/pages/login/login')); assert.equal(await slow.getByLabel('密码', { exact: true }).getAttribute('aria-invalid'), null);
  report.cases.push({ kind: 'two-stage-no-early-race', fixture: '5100ms synthetic-invalid login response + 5900ms permissions 503', observedAtMs, elapsedMs: Date.now() - sequential.times().loginAt, finalMessage, loginRequests: sequential.count() }); await slow.screenshot({ path: path.join(OUT, 'login-two-stage-neutral-error.png'), fullPage: true }); await sequential.context.close();
  report.checks.push('At >10 seconds the two individually bounded intercepted stages remain busy without alert/duplicate submission; permissions 503 finally produces neutral failure and retains login route, without real authentication.');
  report.sourceHashAfter = digest(); assert.equal(report.sourceHashAfter, EXPECTED); assert.deepEqual(report.pageErrors, []); assert.equal(report.unexpectedConsoleErrorCount, 0);
  report.result = 'UI_SCOPE_PASS'; report.unverified = ['real IAM/business acceptance', 'native iOS/Android/iPad builds and input behavior', 'WeChat mini-program', 'physical keyboard/screen reader']; save();
  console.log(JSON.stringify({ result: report.result, sourceHash: report.sourceHashAfter, cases: report.cases.length, interceptedRequests: report.requests.length }));
})().catch(error => { report.result = 'FAIL'; report.failure = { name: error.name, message: error.message, stack: error.stack }; save(); console.error(error.message); process.exitCode = 1; }).finally(async () => { releases.forEach(resolve => resolve()); if (browser) await browser.close(); });
