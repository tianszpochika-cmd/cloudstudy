// Formal Mobile H5 reset UI. All IAM/Gateway API requests are intercepted.
// Never read authentication storage, cookies, token values, request body/header.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../../..'), BASE = 'http://127.0.0.1:18183';
const OUT = path.resolve(ROOT, process.env.UI_AUDIT_OUTPUT || '.git/codex-local-backups/mobile-reset-' + Date.now());
fs.mkdirSync(OUT, { recursive: true });
const report = { scope: 'MOBILE_RESET_H5_UI_ONLY_SYNTHETIC_FIXTURES', at: new Date().toISOString(), browserPlugin: 'unavailable; Playwright Chromium', matrix: [], checks: [], pageErrors: [], consoleErrors: [], fixtureRequests: [] };
const sources = ['apps/mobile/src/pages/reset-password/reset-password.vue', 'apps/mobile/src/theme/v2-tokens.scss', 'apps/mobile/src/theme/v2-icons.ts', 'apps/mobile/src/uni.scss', 'apps/mobile/src/platform/v2-foundation.ts', 'apps/mobile/src/platform/pointer-feedback.ts', 'packages/i18n/src/mobile-experience.ts', 'apps/mobile/src/auth/gateway-auth.ts', 'apps/mobile/src/auth/auth-failure-copy.ts', 'apps/mobile/src/stores/session.ts', 'apps/mobile/tests/ui-reset.e2e.cjs'];
report.sourceHashes = Object.fromEntries(sources.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex')]));
const save = () => fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(report, null, 2));
const labels = {
  'zh-CN': { request: '找回密码', confirm: '设置新密码', account: '账号', token: '重置口令', password: '新密码', send: '发送重置指引', reset: '设置新密码', switch: '我已收到口令', back: '重新申请指引', login: '返回登录', show: '显示新密码', hide: '隐藏新密码' },
  'en-US': { request: 'Reset password', confirm: 'Set a new password', account: 'Account', token: 'Reset code', password: 'New password', send: 'Send reset instructions', reset: 'Set new password', switch: 'I have the reset code', back: 'Request new instructions', login: 'Return to sign in', show: 'Show new password', hide: 'Hide new password' },
};
let browser;
const pending = new Set();
const syntheticCode = () => 'ui-fixture-'.padEnd(32, 'x');
async function newPage(width = 390, theme = 'light', locale = 'zh-CN', step = 'request', height = 844, query = '') {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  let scenario = 'unavailable', hold = false, release, counts = { request: 0, confirm: 0 };
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url());
    report.fixtureRequests.push({ method: request.method(), origin: url.origin, path: url.pathname });
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true' };
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers, body: '' }); return; }
    if (request.method() === 'POST' && /\/auth\/password-reset\/(request|confirm)$/.test(url.pathname)) {
      assert.equal(url.protocol, 'https:', 'Password/reset code request stays on IAM TLS');
      const kind = url.pathname.endsWith('/request') ? 'request' : 'confirm'; counts[kind]++;
      if (hold) await new Promise(resolve => { release = resolve; pending.add(resolve); });
      const fixture = scenario === 'accepted' ? { status: 202, code: 'ACCEPTED' } : scenario === 'success' ? { status: 204, code: '' } : scenario === 'rate-limit' ? { status: 429, code: 'RATE_LIMITED' } : scenario === 'invalid' ? { status: 401, code: 'iam.password_reset.invalid' } : scenario === 'unknown401' ? { status: 401, code: 'UNKNOWN_AUTH_ERROR' } : { status: 503, code: 'SERVICE_UNAVAILABLE' };
      await route.fulfill({ status: fixture.status, headers, body: fixture.status === 204 ? '' : JSON.stringify(fixture.status === 202 ? { accepted: true } : { code: fixture.code, message: 'Synthetic reset response' }) }); return;
    }
    await route.fulfill({ status: 401, headers, body: JSON.stringify({ code: 'UNKNOWN_AUTH_ERROR' }) });
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  await page.goto(`${BASE}/#/pages/reset-password/reset-password?theme=${theme}&uiLocale=${locale}${query}`, { waitUntil: 'networkidle' });
  await page.locator('#mobile-reset-title').waitFor(); await page.getByRole('textbox', { name: labels[locale].account, exact: true }).waitFor();
  if (step === 'confirm' && !query.includes('&token=')) { await page.locator('.reset-step-button').click(); await page.getByRole('heading', { name: labels[locale].confirm, exact: true }).waitFor(); }
  return { context, page, scenario: value => { scenario = value; }, hold: () => { hold = true; }, release: () => { hold = false; if (release) { pending.delete(release); release(); } }, counts: () => ({ ...counts }) };
}
async function facts(page) {
  return page.evaluate(() => {
    const background = element => { for (let node = element; node; node = node.parentElement) { const color = getComputedStyle(node).backgroundColor; if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color; } return 'rgb(255, 255, 255)'; };
    const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => { const value = n / 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
    const contrast = element => { const a = luminance(getComputedStyle(element).color), b = luminance(background(element)); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
    const title = document.querySelector('.reset-title'), submit = document.querySelector('.reset-submit');
    const fields = [...document.querySelector('.reset-fields').children].filter(node => node.classList.contains('reset-field')).map(node => node.getBoundingClientRect());
    const prefs = new URLSearchParams(location.hash.split('?')[1]);
    return { route: location.hash.split('?')[0], uiLocale: prefs.get('uiLocale'), title: document.title, theme: document.documentElement.dataset.theme,
      overflow: document.documentElement.scrollWidth > innerWidth + 1, contentWidth: document.querySelector('.reset-content').getBoundingClientRect().width,
      titleFont: getComputedStyle(title).fontSize, descriptionFont: getComputedStyle(document.querySelector('.reset-description')).fontSize, titleFontFamily: getComputedStyle(title).fontFamily,
      titleContrast: contrast(title), descriptionContrast: contrast(document.querySelector('.reset-description')), submitContrast: contrast(submit), submitFont: getComputedStyle(submit).fontSize, submitBottom: submit.getBoundingClientRect().bottom,
      inputFonts: [...document.querySelectorAll('.reset-input input')].map(node => getComputedStyle(node).fontSize), fieldGaps: fields.slice(1).map((r, i) => r.top - fields[i].bottom), actionGap: submit.getBoundingClientRect().top - fields.at(-1).bottom,
      targets: [...document.querySelectorAll('.reset-password-toggle,.reset-text-button,.reset-submit')].map(node => { const r = node.getBoundingClientRect(); return { label: node.getAttribute('aria-label') || node.textContent.trim(), width: r.width, height: r.height }; }) };
  });
}
async function semantics(page, step = 'request', locale = 'zh-CN', invalid = []) {
  for (const kind of step === 'request' ? ['identifier'] : ['identifier', 'token', 'newPassword']) {
    const input = page.locator(`#mobile-reset-${kind}`);
    assert.equal(await input.getAttribute('name'), kind); assert.equal(await input.getAttribute('autocomplete'), kind === 'identifier' ? 'username' : kind === 'token' ? 'one-time-code' : 'new-password');
    assert.equal(await input.getAttribute('aria-label'), labels[locale][kind === 'identifier' ? 'account' : kind === 'newPassword' ? 'password' : 'token']);
    assert.equal(await input.getAttribute('aria-labelledby'), `mobile-reset-${kind}-label`); assert.equal(await input.getAttribute('aria-invalid'), invalid.includes(kind) ? 'true' : null);
    assert.equal(await input.getAttribute('aria-describedby'), [kind === 'newPassword' ? 'mobile-reset-password-hint' : null, invalid.includes(kind) ? `mobile-reset-${kind}-error` : null].filter(Boolean).join(' ') || null);
  }
}
async function fillConfirm(page) {
  await page.locator('#mobile-reset-identifier').fill('ui-reset-synthetic'); await page.locator('#mobile-reset-token').fill(syntheticCode()); await page.locator('#mobile-reset-newPassword').fill('SyntheticOnly123');
}
(async () => {
  browser = await chromium.launch();
  for (const width of [320, 390, 768, 1280]) for (const locale of ['zh-CN', 'en-US']) for (const theme of ['light', 'dark', 'high-contrast', 'system']) for (const step of ['request', 'confirm']) {
    const current = await newPage(width, theme, locale, step), { page } = current;
    assert.equal(await page.getByRole('heading', { name: labels[locale][step], exact: true }).count(), 1); assert.equal(await page.getByRole('heading').count(), 1);
    assert.equal(await page.locator('.yx-card,.mobile-page-header,.v2-reset-brand,.reset-field-error,.reset-server-error,[role=status],vite-error-overlay').count(), 0);
    const actual = await facts(page); assert.equal(actual.overflow, false); assert.ok(actual.contentWidth <= 420.1); assert.equal(actual.titleFont, '28px'); assert.equal(actual.descriptionFont, '14px'); assert.equal(actual.submitFont, '16px'); assert.deepEqual(actual.inputFonts, step === 'request' ? ['16px'] : ['16px', '16px', '16px']);
    assert.ok(actual.fieldGaps.every(gap => Math.abs(gap - 24) < .2) && Math.abs(actual.actionGap - 24) < .2); assert.ok(actual.targets.every(target => target.width >= 44 && target.height >= 44)); assert.ok([actual.titleContrast, actual.descriptionContrast, actual.submitContrast].every(value => value >= 4.5)); assert.ok(!/Georgia|Times New Roman/.test(actual.titleFontFamily));
    await semantics(page, step, locale); assert.equal(await page.locator('.reset-form').getAttribute('aria-busy'), 'false');
    if (theme === 'system') { await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark'); await page.emulateMedia({ colorScheme: 'light' }); await page.waitForFunction(() => document.documentElement.dataset.theme === 'light'); }
    if ((locale === 'zh-CN' && theme !== 'system') || (width === 390 && locale === 'en-US' && theme === 'light')) await page.screenshot({ path: path.join(OUT, `reset-${step}-${width}-${locale}-${theme}.png`), fullPage: true });
    report.matrix.push({ width, locale, requestedTheme: theme, step, ...actual, status: 'PASS' }); save(); await current.context.close();
  }
  report.checks.push('64 isolated two-step width/locale/theme combinations; actual 16px inputs, 24px gaps, 44px targets, contrast and live system preference');
  const request = await newPage(), { page } = request;
  const account = page.locator('#mobile-reset-identifier'), submit = page.locator('.reset-submit');
  await page.locator('body').click({ position: { x: 5, y: 5 } }); await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-reset-identifier');
  assert.equal(await account.evaluate(node => getComputedStyle(node.closest('uni-input')).outlineStyle), 'solid'); await submit.click(); await page.locator('#mobile-reset-identifier-error').waitFor(); await semantics(page, 'request', 'zh-CN', ['identifier']); assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-reset-identifier'); assert.equal(request.counts().request, 0);
  await page.screenshot({ path: path.join(OUT, 'reset-request-required.png'), fullPage: true });
  await account.fill('ui-reset-synthetic'); await account.fill(''); await submit.click(); assert.equal(request.counts().request, 0);
  await account.fill('ui-reset-synthetic'); request.scenario('accepted'); request.hold(); await account.focus(); await page.keyboard.press('Enter'); await page.locator('.reset-form[aria-busy=true]').waitFor();
  for (const control of await page.locator('.reset-input input,.reset-submit,.reset-text-button').all()) assert.equal(await control.isDisabled(), true);
  await page.locator('.reset-step-button').evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))); await page.locator('.reset-login-button').evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))); await submit.click({ force: true });
  assert.equal(await page.getByRole('heading', { name: '找回密码', exact: true }).count(), 1); assert.ok(page.url().includes('/pages/reset-password/reset-password')); assert.equal(request.counts().request, 1);
  await page.screenshot({ path: path.join(OUT, 'reset-request-busy.png'), fullPage: true }); request.release(); await page.locator('.reset-receipt').waitFor();
  assert.ok((await page.locator('.reset-receipt').innerText()).includes('若收到')); await semantics(page); await page.screenshot({ path: path.join(OUT, 'reset-request-accepted.png'), fullPage: true });
  await account.fill('ui-reset-other-synthetic'); await account.blur(); assert.equal(await page.getByRole('status').count(), 0); assert.equal(await page.locator('.reset-receipt').isVisible(), false);
  for (const [scenario, expected] of [['rate-limit', '操作过于频繁，请稍后再试。'], ['unavailable', '发送没有完成，请稍后再试。']]) { request.scenario(scenario); await submit.click(); await page.locator('.reset-server-error').waitFor(); assert.equal(await page.locator('.reset-server-error').innerText(), expected); assert.equal(await page.locator('.reset-receipt').count(), 0); }
  await page.locator('.reset-step-button').click(); await page.getByRole('heading', { name: '设置新密码', exact: true }).waitFor(); assert.equal(await page.getByRole('alert').count(), 0); await semantics(page, 'confirm'); assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-reset-token');
  await page.locator('.reset-step-button').click(); await page.getByRole('heading', { name: '找回密码', exact: true }).waitFor(); assert.equal(await account.inputValue(), 'ui-reset-other-synthetic'); await semantics(page); await request.context.close();
  report.checks.push('Request blank/rapid clear/Enter, busy direct-dispatch guards, single request, 202 conditional receipt, edited-account receipt cleanup and 429/503 truthful failures');
  const confirmation = await newPage(390, 'light', 'zh-CN', 'confirm'), p = confirmation.page;
  const code = p.locator('#mobile-reset-token'), password = p.locator('#mobile-reset-newPassword'), action = p.locator('.reset-submit');
  await action.click(); await semantics(p, 'confirm', 'zh-CN', ['identifier', 'token', 'newPassword']); assert.equal(await p.evaluate(() => document.activeElement.id), 'mobile-reset-identifier');
  await p.screenshot({ path: path.join(OUT, 'reset-confirm-required.png'), fullPage: true });
  await p.locator('#mobile-reset-identifier').fill('ui-reset-synthetic'); await code.fill(syntheticCode()); await password.fill('short'); await action.click(); assert.equal(await p.locator('#mobile-reset-newPassword-error').innerText(), '新密码至少 12 位。'); assert.equal(confirmation.counts().confirm, 0);
  await password.fill('SyntheticOnly123'); confirmation.scenario('invalid'); await action.click(); await p.locator('.reset-server-error').waitFor(); assert.equal(await p.locator('.reset-server-error').innerText(), '重置口令无效或已过期，请重新申请。'); assert.equal(confirmation.counts().confirm, 1); await semantics(p, 'confirm');
  await password.fill(''); await action.click(); assert.equal(confirmation.counts().confirm, 1); assert.equal(await p.evaluate(() => document.activeElement.id), 'mobile-reset-newPassword'); await semantics(p, 'confirm', 'zh-CN', ['newPassword']);
  await password.fill('SyntheticOnly123'); await code.fill(''); await action.click(); assert.equal(confirmation.counts().confirm, 1); assert.equal(await p.evaluate(() => document.activeElement.id), 'mobile-reset-token'); await semantics(p, 'confirm', 'zh-CN', ['token']);
  const longCode = 'x'.repeat(512); await code.fill(longCode); await code.blur(); assert.equal(await code.evaluate((node, expected) => node.value === expected, longCode), true); report.longCode = { characters: 512, preserved: true, default140Truncation: false }; // Store only length/boolean, never the code.
  await password.fill('x'.repeat(129)); await action.click(); assert.equal(confirmation.counts().confirm, 1); assert.equal(await password.evaluate(node => node.value.length), 129); assert.ok((await p.locator('#mobile-reset-newPassword-error').innerText()).includes('128'));
  await password.fill('SyntheticOnly123'); await code.fill('x'.repeat(513)); await action.click(); assert.equal(confirmation.counts().confirm, 1); assert.ok((await p.locator('#mobile-reset-token-error').innerText()).includes('512'));
  await code.fill(syntheticCode()); await p.locator('#mobile-reset-identifier').fill('ab'); await action.click(); assert.equal(confirmation.counts().confirm, 1); assert.ok((await p.locator('#mobile-reset-identifier-error').innerText()).includes('128'));
  await p.locator('#mobile-reset-identifier').fill('ui-reset-synthetic'); await p.locator('#mobile-reset-identifier').blur(); await semantics(p, 'confirm');
  await p.evaluate(async () => { const { mobileI18nAdapter } = await import('/src/platform/v2-foundation.ts'); mobileI18nAdapter.setLocale('en-US'); }); await p.getByRole('heading', { name: 'Set a new password', exact: true }).waitFor(); await semantics(p, 'confirm', 'en-US');
  await p.evaluate(async () => { const { mobileI18nAdapter } = await import('/src/platform/v2-foundation.ts'); mobileI18nAdapter.setLocale('zh-CN'); }); await p.getByRole('heading', { name: '设置新密码', exact: true }).waitFor(); await semantics(p, 'confirm');
  await p.locator('#mobile-reset-identifier').focus(); await p.keyboard.press('Enter'); assert.equal(await p.evaluate(() => document.activeElement.id), 'mobile-reset-token'); await p.keyboard.press('Enter'); assert.equal(await p.evaluate(() => document.activeElement.id), 'mobile-reset-newPassword');
  await p.getByRole('button', { name: '显示新密码', exact: true }).focus(); await p.keyboard.press('Enter'); assert.equal(await password.getAttribute('type'), 'text'); assert.equal(await password.inputValue(), 'SyntheticOnly123'); await semantics(p, 'confirm'); await p.keyboard.press('Space'); assert.equal(await password.getAttribute('type'), 'password');
  confirmation.scenario('unknown401'); confirmation.hold(); await password.focus(); await p.keyboard.press('Enter'); await p.locator('.reset-form[aria-busy=true]').waitFor();
  for (const control of await p.locator('.reset-input input,.reset-submit,.reset-text-button,.reset-password-toggle').all()) assert.equal(await control.isDisabled(), true);
  await p.locator('.reset-step-button').evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))); await p.locator('.reset-login-button').evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))); await action.click({ force: true }); assert.equal(confirmation.counts().confirm, 2); assert.equal(await p.getByRole('heading', { name: '设置新密码', exact: true }).count(), 1);
  confirmation.release(); await p.locator('.reset-server-error').waitFor(); assert.equal(await p.locator('.reset-server-error').innerText(), '重置没有完成，请稍后再试。'); await semantics(p, 'confirm');
  await password.fill('SyntheticOnly124'); await password.blur(); assert.equal(await p.locator('.reset-server-error').count(), 1); await p.locator('.reset-step-button').click(); await p.getByRole('heading', { name: '找回密码', exact: true }).waitFor(); assert.equal(await p.getByRole('alert').count(), 0); await p.locator('.reset-step-button').click(); await p.getByRole('heading', { name: '设置新密码', exact: true }).waitFor(); assert.equal(await code.inputValue(), ''); assert.equal(await password.inputValue(), ''); assert.equal(await password.getAttribute('type'), 'password'); await semantics(p, 'confirm');
  await fillConfirm(p); confirmation.scenario('success'); await action.click(); await p.locator('.reset-success').waitFor(); assert.equal(await p.locator('.reset-form,input,.reset-password-toggle,.reset-step-button').count(), 0); assert.equal(confirmation.counts().confirm, 3); assert.ok((await p.locator('.reset-success').innerText()).includes('请返回登录')); await p.screenshot({ path: path.join(OUT, 'reset-synthetic-completed.png'), fullPage: true }); await confirmation.context.close();
  report.checks.push('Confirm required/short/maximum contract bounds and immediate corrections/clears, true 512-character code preservation, keyboard flow and eye semantics');
  report.checks.push('Allowlisted invalid-code 401 differs from unknown401; pending direct clicks cannot switch/leave/duplicate; back clears code/password/show/errors; synthetic204 completes and removes inputs');
  for (const step of ['request', 'confirm']) for (const locale of ['zh-CN', 'en-US']) {
    const next = await newPage(390, 'light', locale, step); await next.page.evaluate(() => { for (const node of document.querySelectorAll('.reset-brand,.reset-adult-note,.reset-title,.reset-description,.reset-label,.reset-input,.reset-password-hint,.reset-submit,.reset-text-button,.reset-exit')) node.style.fontSize = parseFloat(getComputedStyle(node).fontSize) * 2 + 'px'; });
    const actual = await facts(next.page); assert.equal(actual.overflow, false); assert.deepEqual(actual.inputFonts, step === 'request' ? ['32px'] : ['32px', '32px', '32px']); await next.page.locator('.reset-exit').scrollIntoViewIfNeeded(); await next.page.screenshot({ path: path.join(OUT, `reset-${step}-390-${locale}-text-200.png`), fullPage: true }); report.matrix.push({ width: 390, locale, requestedTheme: 'light', step, textScale: 2, ...actual, status: 'PASS' }); await next.context.close();
  }
  const short = await newPage(320, 'light', 'en-US', 'confirm', 460); await short.page.locator('.reset-exit').scrollIntoViewIfNeeded(); assert.equal((await facts(short.page)).overflow, false); await short.page.screenshot({ path: path.join(OUT, 'reset-confirm-320-short-viewport.png'), fullPage: true }); await short.context.close();
  const deep = '/pages/b3-reading/b3-reading?practiceId=ui-synthetic';
  for (const value of [encodeURIComponent(deep), encodeURIComponent(encodeURIComponent(deep)), encodeURIComponent('https://external.invalid/path')]) {
    const next = await newPage(390, 'light', 'zh-CN', 'confirm', 844, `&token=${encodeURIComponent(syntheticCode())}&returnTo=${value}`); assert.equal(await next.page.locator('#mobile-reset-token').evaluate(node => node.value.length === 32), true); await next.page.locator('.reset-login-button').click(); await next.page.waitForURL(url => url.hash.startsWith('#/pages/login/login'));
    let decoded = new URLSearchParams(next.page.url().split('?').slice(1).join('?')).get('returnTo'); for (let i = 0; i < 2 && decoded?.startsWith('%'); i++) decoded = decodeURIComponent(decoded); assert.equal(decoded, value.includes('external.invalid') ? '/pages/home/home' : deep); await next.context.close();
  }
  report.checks.push('Two-step Chinese/English 200% text and short screen scrolling, reset-code deep link, safe single/double encoded return and external fallback; no raw reset code in result URLs');
  report.pointer = [];
  for (const ending of ['click', 'drag-away', 'cancel']) {
    const next = await newPage(390, 'light', 'zh-CN', 'confirm'), target = next.page;
    await target.locator('#mobile-reset-identifier').fill('ui-reset-pointer'); await target.locator('#mobile-reset-identifier').blur(); await target.locator('.reset-submit').click();
    await target.locator('#mobile-reset-token').fill(syntheticCode()); await target.locator('#mobile-reset-newPassword').fill('SyntheticOnly123'); await target.locator('#mobile-reset-newPassword').blur(); await target.locator('.reset-submit').scrollIntoViewIfNeeded();
    const point = await target.locator('.reset-submit').evaluate(node => { const r=node.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2,top:r.top+scrollY}; });
    // Place the pointer before creating the rapid model window, not after it.
    await target.mouse.move(point.x, point.y);
    await target.evaluate(() => {
      let component=document.querySelector('.v2-reset').__vueParentComponent; while(component&&!('pointerFeedback'in component.setupState))component=component.parent;
      const state=component.setupState,input=document.getElementById('mobile-reset-identifier'),button=document.querySelector('.reset-submit');
      window.__pointerSnapshot=()=>!!state.pointerFeedback;
      window.__resetPointer={clicks:0,pressedAction:false};
      button.addEventListener('click',e=>{if(e.isTrusted)window.__resetPointer.clicks++;});
      document.addEventListener('pointerdown',e=>{window.__resetPointer.pressedAction=!!e.target.closest('.reset-submit');},true);
      input.focus({preventScroll:true}); input.value='ui-reset-pointer'; input.dispatchEvent(new InputEvent('input',{bubbles:true})); input.value='x'.repeat(129); input.dispatchEvent(new InputEvent('input',{bubbles:true}));
    });
    const cdp = ending === 'cancel' ? await next.context.newCDPSession(target) : null;
    if (cdp) await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y,id:1}]}); else await target.mouse.down();
    await target.waitForTimeout(160); // Intentional long gesture past uni's model throttle, never an application workaround.
    assert.equal(await target.evaluate(()=>window.__resetPointer.pressedAction),true,'Actual press must hit the original action');
    assert.equal(await target.evaluate(()=>window.__pointerSnapshot()),true);
    const heldTop=await target.locator('.reset-submit').evaluate(node=>node.getBoundingClientRect().top+scrollY);
    assert.equal(heldTop,point.top,'First new error stays out of the action geometry until gesture completes');
    assert.equal(next.counts().confirm,0); assert.equal(await target.locator('#mobile-reset-identifier-error').count(),0);
    if (ending==='drag-away') await target.mouse.move(5,5);
    if (cdp) { await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]}); await cdp.detach(); } else await target.mouse.up();
    await target.waitForFunction(()=>!window.__pointerSnapshot());
    assert.equal(await target.evaluate(()=>window.__resetPointer.clicks),ending==='click'?1:0); assert.equal(next.counts().confirm,0);
    if (ending==='click') assert.equal(await target.evaluate(()=>document.activeElement.id),'mobile-reset-identifier');
    if (ending==='cancel') await target.locator('#mobile-reset-identifier').blur(); // Normal blur without a click reports the deferred first error.
    await target.locator('#mobile-reset-identifier-error').waitFor(); await semantics(target,'confirm','zh-CN',['identifier']);
    report.pointer.push({ending,actualPressOnAction:true,heldMs:160,beforeTop:point.top,heldTop,trustedClicks:await target.evaluate(()=>window.__resetPointer.clicks),snapshotReleased:true,requests:next.counts().confirm});
    await next.context.close();
  }
  const keyboard = await newPage(390,'light','zh-CN','confirm'), k=keyboard.page;
  await k.locator('#mobile-reset-newPassword').fill('SyntheticOnly123'); await k.locator('#mobile-reset-newPassword').blur(); await k.locator('.reset-submit').click();
  await k.locator('#mobile-reset-identifier').fill('ui-reset-keyboard'); await k.locator('#mobile-reset-token').fill(syntheticCode()); await k.locator('#mobile-reset-token').blur();
  await k.locator('#mobile-reset-newPassword').fill('x'.repeat(129)); await k.keyboard.press('Enter');
  await k.locator('#mobile-reset-newPassword-error').waitFor(); assert.equal(await k.evaluate(()=>document.activeElement.id),'mobile-reset-newPassword'); assert.equal(keyboard.counts().confirm,0); await semantics(k,'confirm','zh-CN',['newPassword']);
  await keyboard.context.close();
  report.checks.push('True old-center 160ms press hits action with first new error deferred; click reports/focuses it, drag-away and native touchCancel release without submit; ordinary blur and direct password Enter still report errors');
  report.reportedErrorPointer=[];
  for(const kind of ['long-to-empty','empty-to-long','empty-to-valid']){
    const next=await newPage(390,'light','en-US','confirm'),t=next.page; await fillConfirm(t);
    await t.evaluate(()=>{const sizes=[...document.querySelectorAll('.v2-reset,.v2-reset *')].map(e=>[e,parseFloat(getComputedStyle(e).fontSize)]);for(const [e,n]of sizes)if(n)e.style.setProperty('font-size',n*2+'px','important');const style=document.createElement('style');style.textContent='.v2-reset .reset-field-error,.v2-reset .reset-server-error{font-size:28px!important}';document.head.append(style);});
    await t.locator('#mobile-reset-identifier').fill(kind==='long-to-empty'?'x'.repeat(129):''); await t.locator('#mobile-reset-identifier').blur(); await t.locator('.reset-submit').click(); await t.locator('#mobile-reset-identifier-error').waitFor(); await t.locator('.reset-submit').scrollIntoViewIfNeeded(); await t.locator('#mobile-reset-identifier').focus();
    const point=await t.locator('.reset-submit').evaluate(e=>{const r=e.getBoundingClientRect();window.__reportedProbe={clicks:0,hit:false};e.addEventListener('click',x=>{if(x.isTrusted)window.__reportedProbe.clicks++;});document.addEventListener('pointerdown',x=>{window.__reportedProbe.hit=!!x.target.closest('.reset-submit');},{once:true,capture:true});return{x:r.x+r.width/2,y:r.y+r.height/2,top:r.top+scrollY};}); await t.mouse.move(point.x,point.y);
    await t.evaluate(kind=>{const e=document.getElementById('mobile-reset-identifier');e.dispatchEvent(new InputEvent('input',{bubbles:true}));e.value=kind==='long-to-empty'?'':kind==='empty-to-long'?'x'.repeat(129):'ui-reset-valid';e.dispatchEvent(new InputEvent('input',{bubbles:true}));},kind); await t.waitForTimeout(160);
    const settledTop=await t.locator('.reset-submit').evaluate(e=>e.getBoundingClientRect().top+scrollY); assert.equal(settledTop,point.top,'Reported error text/space stays stable before pointerdown after the model settles'); await t.mouse.down(); await t.waitForTimeout(160); assert.equal(await t.evaluate(()=>window.__reportedProbe.hit),true); assert.equal(await t.locator('.reset-submit').evaluate(e=>e.getBoundingClientRect().top+scrollY),point.top); await t.mouse.up();
    assert.equal(await t.evaluate(()=>window.__reportedProbe.clicks),1); if(kind==='empty-to-valid'){await t.locator('.reset-server-error').waitFor();assert.equal(next.counts().confirm,1);}else{assert.equal(next.counts().confirm,0);assert.equal(await t.evaluate(()=>document.activeElement.id),'mobile-reset-identifier');await semantics(t,'confirm','en-US',['identifier']);}
    report.reportedErrorPointer.push({kind,textScale:2,settleMs:160,holdMs:160,beforeTop:point.top,settledTop,trustedClicks:1,requests:next.counts().confirm}); await next.context.close();
  }
  const receipt=await newPage(),rpage=receipt.page; receipt.scenario('accepted'); await rpage.locator('#mobile-reset-identifier').fill('ui-receipt-alpha'); await rpage.locator('#mobile-reset-identifier').blur(); await rpage.locator('.reset-submit').click(); await rpage.getByRole('status').waitFor(); await rpage.locator('#mobile-reset-identifier').focus();
  const rp=await rpage.locator('.reset-submit').evaluate(e=>{const r=e.getBoundingClientRect();window.__receiptPress={clicks:0,hit:false};e.addEventListener('click',x=>{if(x.isTrusted)window.__receiptPress.clicks++;});document.addEventListener('pointerdown',x=>{window.__receiptPress.hit=!!x.target.closest('.reset-submit');},{once:true,capture:true});return{x:r.x+r.width/2,y:r.y+r.height/2,top:r.top+scrollY};}); await rpage.mouse.move(rp.x,rp.y);
  await rpage.evaluate(()=>{const e=document.getElementById('mobile-reset-identifier');e.dispatchEvent(new InputEvent('input',{bubbles:true}));e.value='ui-receipt-beta';e.dispatchEvent(new InputEvent('input',{bubbles:true}));}); await rpage.waitForTimeout(160); assert.equal(await rpage.getByRole('status').count(),0); assert.equal(await rpage.locator('.reset-receipt').isVisible(),false); assert.equal(await rpage.locator('.reset-submit').evaluate(e=>e.getBoundingClientRect().top+scrollY),rp.top); await rpage.mouse.down(); await rpage.waitForTimeout(160); await rpage.mouse.up(); await rpage.getByRole('status').waitFor(); assert.equal(receipt.counts().request,2); assert.equal(await rpage.getByRole('heading',{name:'找回密码',exact:true}).count(),1); assert.equal(await rpage.evaluate(()=>window.__receiptPress.hit&&window.__receiptPress.clicks===1),true); report.receiptPointer={settleMs:160,holdMs:160,beforeTop:rp.top,oldReceiptHidden:true,trustedClicks:1,requests:2,remainedOnRequest:true}; await receipt.context.close();
  report.checks.push('English200 existing error long/short/valid changes preserve geometry after160ms before actual down and during160ms hold; edited accepted receipt hides truthfully while preserving natural space, and old center sends another request rather than switching step');
  assert.equal(report.pageErrors.length, 0); assert.ok(report.consoleErrors.every(message => /401|429|503/.test(message))); report.status = 'PASS_UI_SCOPED_NOT_BUSINESS_ACCEPTANCE'; save(); console.log(JSON.stringify({ status: report.status, matrix: report.matrix.length, checks: report.checks, pageErrors: report.pageErrors.length, consoleErrors: report.consoleErrors.length, output: OUT }, null, 2));
})().catch(error => { report.status = 'FAIL'; report.failure = error.stack; save(); fs.copyFileSync(path.join(OUT, 'results.json'), path.join(OUT, `results-failed-${Date.now()}.json`)); console.error(error.stack); process.exitCode = 1; }).finally(async () => { for (const resolve of pending) resolve(); await browser?.close(); });
