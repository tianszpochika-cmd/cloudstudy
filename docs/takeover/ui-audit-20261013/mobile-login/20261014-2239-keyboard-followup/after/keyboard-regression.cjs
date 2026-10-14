// Narrow real-key H5 regression. All APIs are intercepted rejection fixtures.
// Never inspect storage, cookies, credentials, request bodies or headers.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../../../../../..');
const BASE = 'http://127.0.0.1:18183';
const source = path.join(ROOT, 'apps/mobile/src/pages/login/login.vue');
const hash = () => crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
const report = { at: new Date().toISOString(), scope: 'MB001_PRIMARY_KEYBOARD_H5_ONLY_SYNTHETIC_FIXTURES', browserPlugin: 'Browser plugin not available; Playwright Chromium', sourceHashBefore: hash(), cases: [], pageErrors: [], consoleErrors: [], fixtureRequests: [] };
const pending = new Set();
let browser;
const save = () => fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(report, null, 2));
async function newPage() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  let loginCount = 0, hold = false, release;
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url());
    report.fixtureRequests.push({ method: request.method(), origin: url.origin, path: url.pathname });
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true' };
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers, body: '' }); return; }
    if (request.method() === 'POST' && url.pathname === '/api/v1/auth/login') {
      assert.equal(url.protocol, 'https:', 'Keep password submission on IAM TLS'); loginCount++;
      if (hold) await new Promise(resolve => { release = resolve; pending.add(resolve); });
    }
    await route.fulfill({ status: 401, headers, body: JSON.stringify({ code: 'iam.credentials.invalid', message: 'Synthetic rejection' }) });
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  await page.goto(`${BASE}/#/pages/login/login?uiLocale=zh-CN&theme=light`, { waitUntil: 'networkidle' });
  await page.locator('#mobile-login-identifier').waitFor();
  assert.equal(await page.locator('#mobile-login-title').innerText(), '欢迎回来');
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
  await page.evaluate(() => {
    window.__keyboardTrace = [];
    for (const type of ['keydown', 'keyup', 'focusin', 'click']) document.addEventListener(type, event => {
      window.__keyboardTrace.push({ type, key: event.key || null, targetId: event.target.id || '', targetClass: String(event.target.className || ''), trusted: event.isTrusted });
    }, true);
  });
  return { context, page, count: () => loginCount, hold: () => { hold = true; }, release: () => { if (release) { pending.delete(release); release(); } } };
}
async function semantics(page, invalid) {
  for (const kind of ['identifier', 'password']) {
    const input = page.locator(`#mobile-login-${kind}`);
    assert.equal(await input.getAttribute('name'), kind);
    assert.equal(await input.getAttribute('autocomplete'), kind === 'identifier' ? 'username' : 'current-password');
    assert.equal(await input.getAttribute('aria-invalid'), invalid ? 'true' : null);
    assert.equal(await input.getAttribute('aria-describedby'), invalid ? 'mobile-login-error' : null);
  }
}
(async () => {
  browser = await chromium.launch();
  for (const key of ['Enter', 'Space']) {
    const next = await newPage(), page = next.page;
    await page.locator('.login-submit').focus(); await page.keyboard.down(key);
    assert.equal(await page.locator('#mobile-login-error').count(), 0); assert.equal(next.count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement.className), 'login-submit');
    await page.keyboard.up(key); await page.waitForFunction(() => document.activeElement.id === 'mobile-login-identifier');
    await semantics(page, true); assert.equal(next.count(), 0);
    assert.equal(await page.locator('#mobile-login-error').getAttribute('role'), 'alert');
    report.cases.push({ name: 'empty-primary', key, noSubmitOnKeydown: true, focusAfterKeyup: 'mobile-login-identifier', firstErrorAria: true, requests: next.count(), trace: await page.evaluate(() => window.__keyboardTrace), result: 'PASS' });
    await page.screenshot({ path: path.join(__dirname, `login-empty-${key.toLowerCase()}.png`), fullPage: true }); save(); await next.context.close();
  }
  for (const key of ['Enter', 'Space']) {
    const next = await newPage(), page = next.page;
    await page.locator('#mobile-login-identifier').fill('ui-keyboard-synthetic-account');
    await page.locator('#mobile-login-password').fill('SyntheticOnly123'); await page.locator('#mobile-login-password').blur();
    next.hold(); await page.locator('.login-submit').focus(); await page.keyboard.down(key);
    assert.equal(next.count(), 0); await page.keyboard.up(key);
    await page.locator('.login-form[aria-busy=true]').waitFor(); await page.waitForFunction(() => document.querySelector('.login-submit').getAttribute('disabled') !== null);
    for (const control of await page.locator('.login-input input,.login-password-toggle,.login-text-button,.login-submit').all()) assert.equal(await control.isDisabled(), true);
    await page.keyboard.press('Enter'); await page.keyboard.press('Space');
    assert.equal(next.count(), 1); await semantics(page, false);
    await page.screenshot({ path: path.join(__dirname, `login-pending-${key.toLowerCase()}.png`), fullPage: true });
    next.release(); await page.locator('.login-form[aria-busy=false]').waitFor(); await page.locator('#mobile-login-error').waitFor();
    assert.equal(next.count(), 1); assert.ok(page.url().includes('#/pages/login/login'));
    report.cases.push({ name: 'valid-primary-pending-rejection', key, noSubmitOnKeydown: true, requests: next.count(), pendingLocked: true, pendingDuplicatePrevented: true, recoveredAfterFixture: true, trace: await page.evaluate(() => window.__keyboardTrace), result: 'PASS' });
    save(); await next.context.close();
  }
  const next = await newPage(), page = next.page;
  await page.locator('#mobile-login-identifier').fill('ui-keyboard-field-confirm'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement.id === 'mobile-login-password'); assert.equal(next.count(), 0);
  await page.keyboard.press('Enter'); await page.waitForFunction(() => document.activeElement.id === 'mobile-login-password');
  assert.equal(next.count(), 0); assert.equal(await page.locator('#mobile-login-password').getAttribute('aria-invalid'), 'true');
  await page.locator('#mobile-login-password').fill('SyntheticOnly123'); await page.keyboard.press('Enter');
  await page.locator('#mobile-login-error').waitFor(); await page.locator('.login-form[aria-busy=false]').waitFor();
  assert.equal(next.count(), 1); await semantics(page, false);
  report.cases.push({ name: 'field-confirm-next-required-and-valid-submit', accountEnterFocus: 'mobile-login-password', emptyPasswordRequests: 0, validPasswordRequests: next.count(), result: 'PASS' });
  await next.context.close();
  assert.equal(report.pageErrors.length, 0); assert.ok(report.consoleErrors.every(message => /401/.test(message)));
  report.sourceHashAfter = hash(); assert.equal(report.sourceHashAfter, report.sourceHashBefore);
  report.result = 'PASS_PRIMARY_KEYBOARD_UI_SCOPE_NOT_BUSINESS_ACCEPTANCE'; save(); console.log(JSON.stringify({ result: report.result, cases: report.cases.length, pageErrors: report.pageErrors.length, sourceHash: report.sourceHashAfter }));
})().catch(error => { report.result = 'FAIL'; report.failure = error.stack; report.sourceHashAfter = hash(); save(); console.error(error.stack); process.exitCode = 1; }).finally(async () => { for (const release of pending) release(); await browser?.close(); });
