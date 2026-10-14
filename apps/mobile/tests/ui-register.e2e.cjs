// Formal Mobile H5 registration UI. Every API request is intercepted.
// No real accounts; never inspect auth storage, cookies, bodies or headers.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../../..');
const BASE = 'http://127.0.0.1:18183';
const OUT = path.resolve(ROOT, process.env.UI_AUDIT_OUTPUT || '.git/codex-local-backups/mobile-register-' + Date.now());
fs.mkdirSync(OUT, { recursive: true });
const report = { scope: 'MOBILE_REGISTER_H5_UI_ONLY_SYNTHETIC_FIXTURES', at: new Date().toISOString(), browserPlugin: 'unavailable; Playwright Chromium', matrix: [], checks: [], pageErrors: [], consoleErrors: [], fixtureRequests: [] };
const sources = ['apps/mobile/src/pages/register/register.vue', 'apps/mobile/src/theme/v2-tokens.scss', 'apps/mobile/src/theme/v2-icons.ts', 'apps/mobile/src/uni.scss', 'apps/mobile/src/platform/v2-foundation.ts', 'apps/mobile/src/platform/pointer-feedback.ts', 'packages/i18n/src/mobile-experience.ts', 'apps/mobile/src/auth/gateway-auth.ts', 'apps/mobile/src/auth/auth-failure-copy.ts', 'apps/mobile/src/stores/session.ts', 'apps/mobile/tests/ui-register.e2e.cjs'];
report.sourceHashes = Object.fromEntries(sources.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex')]));
const save = () => fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(report, null, 2));
const labels = {
  'zh-CN': { account: '账号', password: '密码', confirm: '确认密码', title: '创建账号', submit: '创建账号', signin: '登录', show: '显示密码', hide: '隐藏密码', showConfirm: '显示确认密码', hideConfirm: '隐藏确认密码' },
  'en-US': { account: 'Account', password: 'Password', confirm: 'Confirm password', title: 'Create account', submit: 'Create account', signin: 'Sign in', show: 'Show password', hide: 'Hide password', showConfirm: 'Show confirmation password', hideConfirm: 'Hide confirmation password' },
};
let browser;
const pending = new Set();
async function newPage(width = 390, theme = 'light', locale = 'zh-CN', height = 844, scenario = 'conflict', returnQuery = '') {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
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
(async () => {
  browser = await chromium.launch();
  for (const width of [320, 390, 768, 1280]) for (const locale of ['zh-CN', 'en-US']) for (const theme of ['light', 'dark', 'high-contrast', 'system']) {
    const current = await newPage(width, theme, locale), { page } = current;
    assert.equal(await page.getByRole('heading', { name: labels[locale].title, exact: true }).count(), 1);
    assert.equal(await page.getByRole('heading').count(), 1);
    assert.equal(await page.locator('.yx-card,.mobile-page-header,.v2-register-brand,.register-field-error,.register-server-error,[role=status],vite-error-overlay').count(), 0, 'No decorative card, duplicated hero, idle error/status or framework overlay');
    const actual = await facts(page);
    assert.equal(actual.overflow, false, `${width}/${locale}/${theme}`);
    assert.ok(actual.contentWidth <= 420.1);
    assert.equal(actual.titleFont, '28px'); assert.equal(actual.descriptionFont, '14px'); assert.equal(actual.submitFont, '16px');
    assert.deepEqual(actual.inputFonts, ['16px', '16px', '16px']);
    assert.ok(actual.fieldGaps.every(gap => Math.abs(gap - 24) < .2) && Math.abs(actual.actionGap - 24) < .2);
    assert.ok(actual.targets.every(target => target.width >= 44 && target.height >= 44));
    assert.ok([actual.titleContrast, actual.descriptionContrast, actual.hintContrast, actual.submitContrast].every(value => value >= 4.5));
    assert.ok(!/Georgia|Times New Roman/.test(actual.titleFontFamily));
    await nativeSemantics(page, locale);
    assert.equal(await page.locator('.register-form').getAttribute('aria-busy'), 'false');
    if (theme === 'system') {
      await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
      await page.emulateMedia({ colorScheme: 'light' }); await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    }
    if ((locale === 'zh-CN' && theme !== 'system') || (width === 390 && locale === 'en-US' && theme === 'light')) await page.screenshot({ path: path.join(OUT, `register-${width}-${locale}-${theme}.png`), fullPage: true });
    report.matrix.push({ width, locale, requestedTheme: theme, ...actual, status: 'PASS' }); save(); await current.context.close();
  }
  report.checks.push('32 isolated width/locale/theme combinations; live system preference, readable typography and measured 24px field/action gaps');
  const current = await newPage(), { page } = current;
  const account = page.locator('#mobile-register-identifier'), password = page.locator('#mobile-register-password'), confirm = page.locator('#mobile-register-confirm'), submit = page.locator('.register-submit');
  await page.locator('body').click({ position: { x: 5, y: 5 } }); await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-register-identifier');
  assert.equal(await account.evaluate(element => getComputedStyle(element.closest('uni-input')).outlineStyle), 'solid');
  await page.screenshot({ path: path.join(OUT, 'register-keyboard-focus.png'), fullPage: true });
  await submit.click(); await page.locator('#mobile-register-identifier-error').waitFor();
  assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-register-identifier');
  await nativeSemantics(page, 'zh-CN', ['identifier', 'password', 'confirm']); assert.equal(current.count(), 0);
  assert.equal(await page.locator('#mobile-register-confirm-error').innerText(), '请再输入一次密码。');
  await page.screenshot({ path: path.join(OUT, 'register-required.png'), fullPage: true });
  await account.fill('ui-register-synthetic'); await password.fill('short'); await submit.click();
  await page.locator('#mobile-register-password-error').waitFor(); assert.equal(await password.getAttribute('aria-invalid'), 'true');
  assert.equal(await page.locator('#mobile-register-password-error').innerText(), '密码至少 12 位。');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-register-password');
  await password.fill('SyntheticOnly123'); await submit.click();
  assert.equal(await page.locator('#mobile-register-confirm-error').innerText(), '请再输入一次密码。');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-register-confirm');
  await confirm.fill('DifferentOnly123'); await submit.click();
  assert.equal(await page.locator('#mobile-register-confirm-error').innerText(), '两次输入的密码不一致。');
  await nativeSemantics(page, 'zh-CN', ['confirm']); await page.screenshot({ path: path.join(OUT, 'register-mismatch.png'), fullPage: true });
  await confirm.fill('SyntheticOnly123'); await account.focus(); await account.blur();
  await nativeSemantics(page); assert.equal(await page.getByRole('alert').count(), 0);
  await password.fill(''); await submit.click();
  assert.equal(current.count(), 0, 'Rapidly clearing a previously valid password must never send its stale model value');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-register-password');
  await nativeSemantics(page, 'zh-CN', ['password', 'confirm']);
  await password.fill('SyntheticOnly123'); await confirm.fill(''); await submit.click();
  assert.equal(current.count(), 0, 'Rapidly clearing confirmation prevents registration');
  assert.equal(await page.locator('#mobile-register-confirm-error').innerText(), '请再输入一次密码。');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-register-confirm');
  await confirm.fill('SyntheticOnly123'); await confirm.blur(); await nativeSemantics(page);
  await page.evaluate(async () => { const { mobileI18nAdapter } = await import('/src/platform/v2-foundation.ts'); mobileI18nAdapter.setLocale('en-US'); });
  await page.getByRole('heading', { name: 'Create account', exact: true }).waitFor(); await nativeSemantics(page, 'en-US');
  await page.evaluate(async () => { const { mobileI18nAdapter } = await import('/src/platform/v2-foundation.ts'); mobileI18nAdapter.setLocale('zh-CN'); });
  await page.getByRole('heading', { name: '创建账号', exact: true }).waitFor(); await nativeSemantics(page);
  await page.locator('#mobile-register-password-label').click(); assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-register-password');
  await account.focus(); await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-register-password');
  await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-register-confirm'); assert.equal(current.count(), 0);
  for (const [kind, show, hide] of [['password', '显示密码', '隐藏密码'], ['confirm', '显示确认密码', '隐藏确认密码']]) {
    const toggle = page.getByRole('button', { name: show, exact: true }), input = page.locator(`#mobile-register-${kind}`);
    assert.equal(await toggle.getAttribute('aria-controls'), `mobile-register-${kind}`);
    await toggle.focus(); await page.keyboard.press('Enter'); assert.equal(await input.getAttribute('type'), 'text');
    assert.equal(await page.getByRole('button', { name: hide, exact: true }).getAttribute('aria-pressed'), 'true');
    await nativeSemantics(page);
    await page.keyboard.press('Space'); assert.equal(await input.getAttribute('type'), 'password'); await nativeSemantics(page);
  }
  current.hold(); await confirm.focus(); await page.keyboard.press('Enter');
  await page.locator('.register-form[aria-busy=true]').waitFor();
  for (const control of await page.locator('.register-input input,.register-password-toggle,.register-text-button,.register-submit').all()) assert.equal(await control.isDisabled(), true);
  await page.locator('#mobile-register-password-label').click(); assert.equal(await page.locator('.register-input.is-focused').count(), 0, 'Busy label click cannot fake focus');
  await submit.click({ force: true }); await page.waitForTimeout(100); assert.equal(current.count(), 1);
  await page.screenshot({ path: path.join(OUT, 'register-busy.png'), fullPage: true }); current.release();
  await page.locator('.register-server-error').waitFor(); await page.locator('.register-form[aria-busy=false]').waitFor();
  assert.equal(await page.locator('.register-server-error').innerText(), '注册没有完成。请尝试登录或找回密码。');
  await nativeSemantics(page); await account.fill('ui-register-synthetic-edited'); assert.equal(await page.locator('.register-server-error').count(), 1);
  await page.screenshot({ path: path.join(OUT, 'register-conflict-neutral.png'), fullPage: true });
  await submit.click(); await page.locator('.register-server-error').waitFor(); assert.equal(current.count(), 2, 'Failure can be retried'); await nativeSemantics(page);
  await current.context.close(); report.checks.push('Per-field required/length/mismatch, correction, first-error focus, live locale semantics, labels, Tab/Enter/Space and both password visibility controls');
  report.checks.push('Immediate short-to-valid correction and valid-to-empty password/confirmation submission use current component values, not throttled old models');
  report.checks.push('Busy locks every input/button/exit, duplicate submit prevented; neutral conflict survives edit and permits retry');
  for (const [scenario, text] of [['rate-limit', '操作过于频繁，请稍后再试。'], ['unavailable', '注册没有完成，请稍后再试。']]) {
    const next = await newPage(390, 'light', 'zh-CN', 844, scenario); await fillValid(next.page); await next.page.locator('.register-submit').click();
    await next.page.locator('.register-server-error').waitFor(); assert.equal(await next.page.locator('.register-server-error').innerText(), text);
    assert.equal(next.count(), 1); await nativeSemantics(next.page); await next.context.close();
  }
  for (const locale of ['zh-CN', 'en-US']) {
    const next = await newPage(390, 'light', locale);
    await next.page.evaluate(() => { for (const element of document.querySelectorAll('.register-brand,.register-adult-note,.register-title,.register-description,.register-label,.register-input,.register-password-hint,.register-submit,.register-text-button,.register-signin')) element.style.fontSize = parseFloat(getComputedStyle(element).fontSize) * 2 + 'px'; });
    const actual = await facts(next.page); assert.equal(actual.overflow, false); assert.deepEqual(actual.inputFonts, ['32px', '32px', '32px']); assert.ok(actual.targets.every(target => target.width >= 44 && target.height >= 44));
    await next.page.locator('.register-signin').scrollIntoViewIfNeeded(); await next.page.screenshot({ path: path.join(OUT, `register-390-${locale}-text-200.png`), fullPage: true });
    report.matrix.push({ width: 390, locale, requestedTheme: 'light', textScale: 2, ...actual, status: 'PASS' }); await next.context.close();
  }
  const short = await newPage(320, 'light', 'en-US', 460); await short.page.locator('.register-signin').scrollIntoViewIfNeeded(); assert.equal((await facts(short.page)).overflow, false); await short.page.screenshot({ path: path.join(OUT, 'register-320-short-viewport.png'), fullPage: true }); await short.context.close();
  const deep = '/pages/b3-reading/b3-reading?practiceId=ui-synthetic';
  for (const value of [encodeURIComponent(deep), encodeURIComponent(encodeURIComponent(deep)), encodeURIComponent('https://external.invalid/path')]) {
    const next = await newPage(390, 'light', 'zh-CN', 844, 'conflict', `&returnTo=${value}`);
    await next.page.locator('.register-text-button').click(); await next.page.waitForURL(url => url.hash.startsWith('#/pages/login/login'));
    const result = new URLSearchParams(next.page.url().split('?').slice(1).join('?')).get('returnTo');
    // uni H5 may serialize the query a second time; decode at most two levels.
    let decoded = result; for (let i = 0; i < 2 && decoded?.startsWith('%'); i++) decoded = decodeURIComponent(decoded);
    assert.equal(decoded, value.includes('external.invalid') ? '/pages/home/home' : deep); await next.context.close();
  }
  report.checks.push('Registration login exit preserves singly/doubly encoded safe deep link; external URL falls back to home');
  const adult = await newPage(390, 'light', 'zh-CN', 844, 'adult-required', `&returnTo=${encodeURIComponent(deep)}`); await fillValid(adult.page); await adult.page.locator('.register-submit').click();
  await adult.page.waitForURL(url => url.hash.startsWith('#/pages/onboarding/onboarding')); assert.equal(adult.count(), 1); await adult.page.screenshot({ path: path.join(OUT, 'register-synthetic-adult-gate-route.png'), fullPage: true }); await adult.context.close();
  report.checks.push('Synthetic registration with REQUIRED adult gate routes to existing onboarding rather than a learning page; UI fixture only');
  report.checks.push('Rate-limit/unavailable neutral feedback, Chinese/English 200% text and short viewport scroll; no physical keyboard or real IAM claim');
  report.contractBoundaries = [];
  const boundaryCases = [
    ...[0, 2, 3, 128, 129, 141].map(length => ({ field: 'identifier', name: `identifier-${length}`, value: 'a'.repeat(length) })),
    ...[2, 3, 128, 129].map(length => ({ field: 'identifier', name: `identifier-trim-${length}`, value: ' ' + 'a'.repeat(length) + ' ' })),
    ...[0, 11, 12, 128, 129, 141].map(length => ({ field: 'password', name: `password-${length}`, value: 'p'.repeat(length) })),
    { field: 'password', name: 'password-raw-padded-12', value: ' ' + 'p'.repeat(10) + ' ' },
  ];
  for (const boundary of boundaryCases) {
    const next = await newPage(), target = next.page;
    const accountValue = boundary.field === 'identifier' ? boundary.value : 'ui-contract-synthetic';
    const passwordValue = boundary.field === 'password' ? boundary.value : 'SyntheticOnly123';
    await target.locator('#mobile-register-identifier').fill(accountValue);
    await target.locator('#mobile-register-password').fill(passwordValue);
    await target.locator('#mobile-register-confirm').fill(passwordValue); await target.locator('#mobile-register-confirm').blur();
    const lengths = await target.evaluate(() => {
      let component = document.querySelector('.v2-register').__vueParentComponent;
      while (component && !('identifier' in component.setupState)) component = component.parent;
      const state = component.setupState;
      return { identifierRaw: state.identifier.length, identifierTrimmed: state.identifier.trim().length, password: state.password.length, confirm: state.confirm.length };
    });
    assert.equal(lengths.identifierRaw, accountValue.length); assert.equal(lengths.identifierTrimmed, accountValue.trim().length);
    assert.equal(lengths.password, passwordValue.length); assert.equal(lengths.confirm, passwordValue.length);
    const length = boundary.field === 'identifier' ? accountValue.trim().length : passwordValue.length;
    const valid = boundary.field === 'identifier' ? length >= 3 && length <= 128 : length >= 12 && length <= 128;
    await target.locator('.register-submit').click();
    if (valid) {
      await target.locator('.register-server-error').waitFor(); assert.equal(next.count(), 1); await nativeSemantics(target);
    } else {
      const expected = boundary.field === 'identifier' ? !length ? '请输入账号。' : '账号长度需为 3 至 128 位。' : !length ? '请输入密码。' : length < 12 ? '密码至少 12 位。' : '密码最多 128 位。';
      await target.locator(`#mobile-register-${boundary.field}-error`).waitFor();
      assert.equal(await target.locator(`#mobile-register-${boundary.field}-error`).innerText(), expected);
      assert.equal(await target.evaluate(() => document.activeElement.id), `mobile-register-${boundary.field}`);
      const invalid = [boundary.field]; if (boundary.field === 'password' && !length) invalid.push('confirm');
      await nativeSemantics(target, 'zh-CN', invalid); assert.equal(next.count(), 0);
    }
    report.contractBoundaries.push({ name: boundary.name, field: boundary.field, lengths, valid, requests: next.count(), result: 'PASS' });
    if (length === 141) await target.screenshot({ path: path.join(OUT, `register-contract-${boundary.field}-141.png`), fullPage: true });
    save(); await next.context.close();
  }
  report.checks.push('Identifier trim3..128 and password raw12..128 boundary gates; maxlength=-1 on all fields retains141-character entries with zero invalid requests, including untrimmed12-character padded password');
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
        window.__registerPointer.staleAtPointer = state.identifier !== '';
        window.__registerPointer.elapsedMs = performance.now() - started;
      }, { once: true, capture: true });
      input.focus({ preventScroll: true });
      input.value = 'ui-register-synthetic'; input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      started = performance.now(); input.value = ''; input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
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
  for (const spec of [
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
    await target.waitForTimeout(160); // Assert stability after the model settles, before pointerdown.
    const settled = await target.locator('.register-submit').evaluate((node, field) => {
      const error = document.getElementById(`mobile-register-${field}-error`);
      return { top: node.getBoundingClientRect().top + scrollY, errorText: error.textContent, errorHeight: error.getBoundingClientRect().height, hidden: error.getAttribute('aria-hidden') };
    }, field);
    assert.equal(settled.top, before.top); assert.equal(settled.errorText, before.errorText); assert.equal(settled.errorHeight, before.errorHeight);
    assert.equal(settled.hidden, invalid.length ? 'false' : 'true');
    await target.mouse.down(); await target.waitForTimeout(160);
    assert.equal(await target.locator('.register-submit').evaluate(node => node.getBoundingClientRect().top + scrollY), before.top);
    await target.mouse.up(); assert.equal(await target.evaluate(() => window.__reportedProbe.pressedAction && window.__reportedProbe.clicks === 1), true);
    if (!invalid.length) { await target.locator('.register-server-error').waitFor(); assert.equal(next.count(), 1); await nativeSemantics(target, 'en-US'); }
    else {
      assert.equal(next.count(), 0); assert.equal(await target.evaluate(() => document.activeElement.id), `mobile-register-${field}`);
      await nativeSemantics(target, 'en-US', invalid);
      assert.equal(await target.locator(`#mobile-register-${field}-error`).innerText(), message);
    }
    report.reportedErrorPointer.push({ kind, field, textScale: 2, settleMs: 160, holdMs: 160, before, settled, trustedClicks: 1, requests: next.count() });
    await target.screenshot({ path: path.join(OUT, `register-reported-error-${kind}-en200.png`), fullPage: true }); save(); await next.context.close();
  }
  for (const key of ['Enter', 'Space']) {
    const next = await newPage(); await next.page.locator('.register-submit').focus(); await next.page.keyboard.press(key);
    await next.page.locator('#mobile-register-identifier-error').waitFor();
    assert.equal(await next.page.evaluate(() => document.activeElement.id), 'mobile-register-identifier');
    await nativeSemantics(next.page, 'zh-CN', ['identifier', 'password', 'confirm']); assert.equal(next.count(), 0); await next.context.close();
  }
  report.checks.push('True old-center rapid click and 160ms gesture after 409 defer first new error; drag-away/native touchCancel release without submit; Enter/Space report first-error ARIA immediately');
  report.checks.push('390px English200 reported password short/empty/valid and account length/empty/valid changes retain natural error text/height after160ms before down and during160ms hold; dependent confirmation feedback stays stable');
  assert.equal(report.pageErrors.length, 0); assert.ok(report.consoleErrors.every(message => /401|409|429|503/.test(message)), 'Only intercepted API status errors allowed');
  report.status = 'PASS_UI_SCOPED_NOT_BUSINESS_ACCEPTANCE'; save(); console.log(JSON.stringify({ status: report.status, matrix: report.matrix.length, checks: report.checks, pageErrors: report.pageErrors.length, consoleErrors: report.consoleErrors.length, output: OUT }, null, 2));
})().catch(error => { report.status = 'FAIL'; report.failure = error.stack; save(); console.error(error.stack); process.exitCode = 1; }).finally(async () => { for (const resolve of pending) resolve(); await browser?.close(); });
