// Formal Mobile H5 registration UI. Every API request is intercepted.
// No real accounts; never inspect auth storage, cookies, bodies or headers.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../../../../..');
const BASE = 'http://127.0.0.1:18183';
const OUT=__dirname;
const report = { scope: 'INDEPENDENT_MB002_9258_RISK_REVIEW_H5', at: new Date().toISOString(), browserPlugin: 'unavailable; Playwright Chromium', matrix: [], checks: [], pageErrors: [], consoleErrors: [], fixtureRequests: [] };
const sources = ['apps/mobile/src/pages/register/register.vue', 'apps/mobile/src/theme/v2-tokens.scss', 'apps/mobile/src/theme/v2-icons.ts', 'apps/mobile/src/uni.scss', 'apps/mobile/src/platform/v2-foundation.ts', 'apps/mobile/src/platform/pointer-feedback.ts', 'packages/i18n/src/mobile-experience.ts', 'apps/mobile/src/auth/gateway-auth.ts', 'apps/mobile/src/auth/auth-failure-copy.ts', 'apps/mobile/src/stores/session.ts', 'apps/mobile/tests/ui-register.e2e.cjs'];
report.sourceHashes = Object.fromEntries(sources.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex')]));
const save = () => fs.writeFileSync(path.join(OUT, 'pointer-results.json'), JSON.stringify(report, null, 2));
const labels = {
  'zh-CN': { account: '账号', password: '密码', confirm: '确认密码', title: '创建账号', submit: '创建账号', signin: '登录', show: '显示密码', hide: '隐藏密码', showConfirm: '显示确认密码', hideConfirm: '隐藏确认密码' },
  'en-US': { account: 'Account', password: 'Password', confirm: 'Confirm password', title: 'Create account', submit: 'Create account', signin: 'Sign in', show: 'Show password', hide: 'Hide password', showConfirm: 'Show confirmation password', hideConfirm: 'Hide confirmation password' },
};
let browser;
const pending = new Set();
const expectedHashes={'apps/mobile/src/pages/register/register.vue':'9258cb03e36c97d53d2e88521ba29f95aaf81de794657c8c72689fa50bd66baf','packages/i18n/src/mobile-experience.ts':'eef37b1f82b915a0dc73e7f3351061d183912126801169dd083905a8060afd87','apps/mobile/src/platform/pointer-feedback.ts':'6464f4c1712b5a0f2fd4ab01d451d5bb6ffaa13bde486826a424511059ef6425','apps/mobile/tests/ui-register.e2e.cjs':'d1aa2c15ebe845b98f88809350202561c07fe393ad63779cbfa498a5154b0a65'}; function frozen(){for(const[f,h]of Object.entries(expectedHashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,f))).digest('hex'),h,'Frozen source hash '+f)}; frozen();
async function newPage(width = 390, theme = 'light', locale = 'zh-CN', height = 844, scenario = 'conflict', returnQuery = '') {
  frozen(); const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  let held = false, release, count = 0;
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url());
    report.fixtureRequests.push({ method: request.method(), origin: url.origin, path: url.pathname });
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true' };
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers, body: '' }); return; }
    if (request.method() === 'POST' && url.pathname === '/api/v1/auth/register') {
      assert.equal(url.protocol, 'https:', 'Password request stays on IAM TLS');
      count++;
      if (held) await new Promise(resolve => { release = resolve; pending.add(resolve); });
      if (scenario === 'adult-required') {
        // Invalid dummy credential is only accepted by intercepted UI fixtures.
        // No response body, auth header or token is logged or persisted by this test.
        await route.fulfill({ status: 200, headers, body: JSON.stringify({ accessToken: 'ui-synthetic-not-a-valid-credential', adultGate: 'REQUIRED' }) });
        return;
      }
      const failure = scenario === 'rate-limit' ? { status: 429, code: 'RATE_LIMITED' } : scenario === 'unavailable' ? { status: 503, code: 'SERVICE_UNAVAILABLE' } : { status: 409, code: 'iam.account.already_exists' };
      await route.fulfill({ status: failure.status, headers, body: JSON.stringify({ code: failure.code, message: 'Synthetic registration failure' }) });
      return;
    }
    if (scenario === 'adult-required' && url.pathname === '/api/v1/iam/permissions') {
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ principal: { subject: 'ui-registration-synthetic', roles: [], permissions: [], adultGate: 'REQUIRED' }, adultGate: 'REQUIRED', permissions: [] }) });
      return;
    }
    await route.fulfill({ status: 401, headers, body: JSON.stringify({ code: 'iam.credentials.invalid', message: 'Synthetic rejection' }) });
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  await page.goto(`${BASE}/#/pages/register/register?theme=${theme}&uiLocale=${locale}${returnQuery}`, { waitUntil: 'networkidle' });
  await page.locator('#mobile-register-title').waitFor();
  await page.getByRole('textbox', { name: labels[locale].account, exact: true }).waitFor();
  return { context, page, hold: () => { held = true; }, release: () => { if (release) { pending.delete(release); release(); } }, count: () => count };
}
async function facts(page) {
  return page.evaluate(() => {
    const background = element => {
      for (let current = element; current; current = current.parentElement) {
        const value = getComputedStyle(current).backgroundColor;
        if (value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') return value;
      }
      return 'rgb(255, 255, 255)';
    };
    const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => { const n = value / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
    const contrast = element => { const a = luminance(getComputedStyle(element).color), b = luminance(background(element)); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
    const title = document.querySelector('.register-title'), submit = document.querySelector('.register-submit');
    const fields = [...document.querySelector('.register-fields').children].filter(element => element.classList.contains('register-field')).map(element => element.getBoundingClientRect());
    return {
      url: location.href, title: document.title, theme: document.documentElement.dataset.theme,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      contentWidth: document.querySelector('.register-content').getBoundingClientRect().width,
      titleFont: getComputedStyle(title).fontSize, titleFontFamily: getComputedStyle(title).fontFamily,
      descriptionFont: getComputedStyle(document.querySelector('.register-description')).fontSize,
      titleContrast: contrast(title), descriptionContrast: contrast(document.querySelector('.register-description')), hintContrast: contrast(document.querySelector('.register-password-hint')),
      submitFont: getComputedStyle(submit).fontSize, submitContrast: contrast(submit), submitTop: submit.getBoundingClientRect().top,
      inputFonts: [...document.querySelectorAll('.register-input input')].map(element => getComputedStyle(element).fontSize),
      fieldGaps: [fields[1].top - fields[0].bottom, fields[2].top - fields[1].bottom], actionGap: submit.getBoundingClientRect().top - fields[2].bottom,
      targets: [...document.querySelectorAll('.register-password-toggle,.register-text-button,.register-submit')].map(element => { const r = element.getBoundingClientRect(); return { label: element.getAttribute('aria-label') || element.textContent.trim(), width: r.width, height: r.height }; }),
    };
  });
}
async function nativeSemantics(page, locale = 'zh-CN', invalid = []) {
  const names = ['identifier', 'password', 'confirm'];
  for (const [index, kind] of names.entries()) {
    const input = page.locator(`#mobile-register-${kind}`);
    assert.equal(await input.getAttribute('name'), kind);
    assert.equal(await input.getAttribute('maxlength'), '-1', 'Preserve the full entry for explicit contract validation');
    assert.equal(await input.getAttribute('minlength'), kind === 'identifier' ? '3' : kind === 'password' ? '12' : null);
    assert.equal(await input.getAttribute('autocomplete'), index ? 'new-password' : 'username');
    assert.equal(await input.getAttribute('aria-labelledby'), `mobile-register-${kind}-label`);
    assert.equal(await input.getAttribute('aria-label'), labels[locale][index ? kind : 'account']);
    assert.equal(await input.getAttribute('aria-invalid'), invalid.includes(kind) ? 'true' : null);
    const description = [kind === 'password' ? 'mobile-register-password-hint' : null, invalid.includes(kind) ? `mobile-register-${kind}-error` : null].filter(Boolean).join(' ') || null;
    assert.equal(await input.getAttribute('aria-describedby'), description);
  }
}
async function fillValid(page) {
  await page.locator('#mobile-register-identifier').fill('ui-register-synthetic');
  await page.locator('#mobile-register-password').fill('SyntheticOnly123');
  await page.locator('#mobile-register-confirm').fill('SyntheticOnly123');
}
(async()=>{browser=await chromium.launch();
  report.pointer = [];
  for (const [ending, heldMs] of [['click', 0], ['click', 160], ['drag-away', 160], ['cancel', 160]]) {
    const next = await newPage(), target = next.page;
    await fillValid(target); await target.locator('#mobile-register-confirm').blur(); await target.locator('.register-submit').click();
    await target.locator('.register-server-error').waitFor(); await target.locator('.register-submit').scrollIntoViewIfNeeded();
    assert.equal(await target.locator('#mobile-register-identifier-error').count(), 0);
    const point = await target.locator('.register-submit').evaluate(node => {
      const r = node.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, top: r.top + scrollY };
    });
    await target.mouse.move(point.x, point.y);
    await target.evaluate(() => {
      let component = document.querySelector('.v2-register').__vueParentComponent;
      while (component && !('pointerFeedback' in component.setupState)) component = component.parent;
      const state = component.setupState, input = document.getElementById('mobile-register-identifier');
      window.__pointerSnapshot = () => !!state.pointerFeedback;
      window.__registerPointer = { clicks: 0, pressedAction: false, staleAtPointer: null, elapsedMs: null };
      document.querySelector('.register-submit').addEventListener('click', event => { if (event.isTrusted) window.__registerPointer.clicks++; });
      let started;
      document.addEventListener('pointerdown', event => {
        window.__registerPointer.pressedAction = !!event.target.closest('.register-submit');
        window.__registerPointer.staleAtPointer = state.identifier.length !== 129;
        window.__registerPointer.elapsedMs = performance.now() - started;
      }, { once: true, capture: true });
      input.focus({ preventScroll: true });
      input.value = 'ui-register-synthetic'; input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      started = performance.now(); input.value = 'x'.repeat(129); input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    });
    const cdp = ending === 'cancel' ? await next.context.newCDPSession(target) : null;
    if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y, id: 1 }] });
    else if (!heldMs) await target.mouse.click(point.x, point.y);
    else await target.mouse.down();
    let heldTop = point.top;
    if (heldMs) {
      await target.waitForTimeout(heldMs); // Deliberate gesture longer than uni's throttle, never an application workaround.
      assert.equal(await target.evaluate(() => window.__pointerSnapshot()), true);
      heldTop = await target.locator('.register-submit').evaluate(node => node.getBoundingClientRect().top + scrollY);
      assert.equal(heldTop, point.top, 'First new error cannot move the pressed action');
      assert.equal(await target.locator('#mobile-register-identifier-error').count(), 0);
      assert.equal(next.count(), 1, 'A pointerdown never submits');
      if (ending === 'drag-away') await target.mouse.move(5, 5);
      if (cdp) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await cdp.detach(); }
      else await target.mouse.up();
    }
    await target.waitForFunction(() => !window.__pointerSnapshot());
    const probe = await target.evaluate(() => window.__registerPointer);
    assert.equal(probe.pressedAction, true, 'Real pointerdown must hit the old action center');
    if (ending === 'click') assert.equal(probe.staleAtPointer, true, 'Exercise the actual stale-model window');
    assert.equal(probe.clicks, ending === 'click' ? 1 : 0); assert.equal(next.count(), 1);
    if (ending === 'cancel') await target.locator('#mobile-register-identifier').blur();
    await target.locator('#mobile-register-identifier-error').waitFor(); await nativeSemantics(target, 'zh-CN', ['identifier']);
    if (ending === 'click') assert.equal(await target.evaluate(() => document.activeElement.id), 'mobile-register-identifier');
    report.pointer.push({ ending, heldMs, beforeTop: point.top, heldTop, ...probe, snapshotReleased: true, requests: next.count() });
    await target.screenshot({ path: path.join(OUT, `register-pointer-${ending}-${heldMs}.png`), fullPage: true }); save(); await next.context.close();
  }
  report.reportedErrorPointer = [];
  for (const settleMs of [0,160]) for (const spec of [
    { kind: 'short-to-empty', field: 'password', initial: 'short', replacement: '', invalid: ['password', 'confirm'], message: 'Enter your password.' },
    { kind: 'empty-to-short', field: 'password', initial: '', replacement: 'short', invalid: ['password', 'confirm'], message: 'Use at least 12 characters.' },
    { kind: 'short-to-valid', field: 'password', initial: 'short', replacement: 'SyntheticOnly123', invalid: [], message: null },
    { kind: 'length-to-empty', field: 'identifier', initial: 'a'.repeat(129), replacement: '', invalid: ['identifier'], message: 'Enter your account.' },
    { kind: 'empty-to-length', field: 'identifier', initial: '', replacement: 'a'.repeat(129), invalid: ['identifier'], message: 'Use an account with 3 to 128 characters.' },
    { kind: 'length-to-valid', field: 'identifier', initial: 'a'.repeat(129), replacement: 'ui-contract-valid', invalid: [], message: null },
  ]) {
    const { kind, field, initial, replacement, invalid, message } = spec;
    const next = await newPage(390, 'light', 'en-US'), target = next.page;
    await fillValid(target);
    await target.evaluate(() => {
      const sizes = [...document.querySelectorAll('.v2-register,.v2-register *')].map(element => [element, parseFloat(getComputedStyle(element).fontSize)]);
      for (const [element, size] of sizes) if (size) element.style.setProperty('font-size', size * 2 + 'px', 'important');
      const style = document.createElement('style'); style.textContent = '.v2-register .register-field-error,.v2-register .register-server-error{font-size:28px!important}'; document.head.append(style);
    });
    await target.locator(`#mobile-register-${field}`).fill(initial);
    await target.locator(`#mobile-register-${field}`).blur(); await target.locator('.register-submit').click();
    await target.locator(`#mobile-register-${field}-error`).waitFor(); await target.locator('.register-submit').scrollIntoViewIfNeeded();
    await target.locator(`#mobile-register-${field}`).focus();
    const before = await target.locator('.register-submit').evaluate((node, field) => {
      const r = node.getBoundingClientRect(), error = document.getElementById(`mobile-register-${field}-error`);
      window.__reportedProbe = { clicks: 0, pressedAction: false };
      node.addEventListener('click', event => { if (event.isTrusted) window.__reportedProbe.clicks++; });
      document.addEventListener('pointerdown', event => { window.__reportedProbe.pressedAction = !!event.target.closest('.register-submit'); }, { once: true, capture: true });
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, top: r.top + scrollY, errorText: error.textContent, errorHeight: error.getBoundingClientRect().height };
    }, field);
    await target.mouse.move(before.x, before.y);
    await target.evaluate(({ field, replacement }) => {
      const input = document.getElementById(`mobile-register-${field}`);
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      input.value = replacement;
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }, { field, replacement });
    await target.waitForTimeout(settleMs); // Explicit0/160ms replay.
    const settled = await target.locator('.register-submit').evaluate((node, field) => {
      const error = document.getElementById(`mobile-register-${field}-error`);
      return { top: node.getBoundingClientRect().top + scrollY, errorText: error.textContent, errorHeight: error.getBoundingClientRect().height, hidden: error.getAttribute('aria-hidden') };
    }, field);
    assert.equal(settled.top, before.top); assert.equal(settled.errorText, before.errorText); assert.equal(settled.errorHeight, before.errorHeight);
    if(settleMs)assert.equal(settled.hidden, invalid.length ? 'false' : 'true');
    await target.mouse.down(); await target.waitForTimeout(160);
    assert.equal(await target.locator('.register-submit').evaluate(node => node.getBoundingClientRect().top + scrollY), before.top);
    await target.mouse.up(); assert.equal(await target.evaluate(() => window.__reportedProbe.pressedAction && window.__reportedProbe.clicks === 1), true);
    if (!invalid.length) { await target.locator('.register-server-error').waitFor(); assert.equal(next.count(), 1); await nativeSemantics(target, 'en-US'); }
    else {
      assert.equal(next.count(), 0); assert.equal(await target.evaluate(() => document.activeElement.id), `mobile-register-${field}`);
      await nativeSemantics(target, 'en-US', invalid);
      assert.equal(await target.locator(`#mobile-register-${field}-error`).innerText(), message);
    }
    report.reportedErrorPointer.push({ kind, field, textScale: 2, settleMs, holdMs: 160, before, settled, trustedClicks: 1, requests: next.count() });
    await target.screenshot({ path: path.join(OUT, `register-reported-error-${kind}-delay${settleMs}-en200.png`), fullPage: true }); save(); await next.context.close();
  }
 frozen(); assert.equal(report.pageErrors.length,0);assert.ok(report.consoleErrors.every(m=>/401|409|429|503/.test(m)));report.sourceHashesAfter=Object.fromEntries(sources.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,f))).digest('hex')]));report.status='UI_PASS_SCOPED_NOT_BUSINESS';save();console.log(JSON.stringify({status:report.status,contractBoundaries:report.contractBoundaries?.length,pointer:report.pointer?.length,reportedErrorPointer:report.reportedErrorPointer?.length,checks:report.checks.length}));
})().catch(e=>{report.status='FAIL';report.failure={name:e.name,message:e.message};save();console.error(e.message);process.exitCode=1}).finally(async()=>{pending.forEach(r=>r());await browser?.close()});