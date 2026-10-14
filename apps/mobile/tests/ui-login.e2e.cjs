// Scoped H5 login UI regression. Every API is intercepted: rejection fixtures,
// plus an in-memory dummy first response followed by a permission-service outage.
// Never inspect authentication storage, cookies, token values or request bodies.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../../..');
const BASE = 'http://127.0.0.1:18183';
const PAGE_PATH = '/pages/login/login';
const OUT = path.resolve(ROOT, process.env.UI_AUDIT_OUTPUT || '.git/codex-local-backups/mobile-login-' + Date.now());
const report = { scope: 'MOBILE_LOGIN_H5_UI_ONLY_SYNTHETIC_AUTH_FAILURES', at: new Date().toISOString(), browserPlugin: 'unavailable; Playwright Chromium', matrix: [], checks: [], pageErrors: [], consoleErrors: [], fixtureRequests: [] };
fs.mkdirSync(OUT, { recursive: true });
const sources = ['apps/mobile/src/pages/login/login.vue', 'apps/mobile/src/theme/v2-tokens.scss', 'apps/mobile/src/theme/v2-icons.ts', 'apps/mobile/src/uni.scss', 'apps/mobile/src/platform/v2-foundation.ts', 'packages/i18n/src/mobile-experience.ts', 'apps/mobile/tests/ui-login.e2e.cjs'];
report.sourceHashes = Object.fromEntries(sources.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex')]));
const save = () => fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(report, null, 2));
let browser;
const pending = new Set();
const labels = {
  'zh-CN': { account: '账号', password: '密码', title: '欢迎回来', submit: '登录', show: '显示密码', hide: '隐藏密码' },
  'en-US': { account: 'Account', password: 'Password', title: 'Welcome back', submit: 'Sign in', show: 'Show password', hide: 'Hide password' },
};
async function newPage(width = 390, theme = 'light', locale = 'zh-CN', height = 844, scenario = 'rejection') {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  let hold = false, loginCount = 0, release, loginStarted = 0, permissionStarted = 0;
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url());
    report.fixtureRequests.push({ method: request.method(), origin: url.origin, path: url.pathname });
    if (request.method() === 'POST' && url.pathname === '/api/v1/auth/login') {
      assert.equal(url.protocol, 'https:', 'Password request must remain on IAM TLS');
      loginCount++;
      loginStarted = Date.now();
      if (hold) await new Promise(resolve => { release = resolve; pending.add(resolve); });
    }
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true' };
    if (scenario === 'two-stage-unavailable' && request.method() === 'POST' && url.pathname === '/api/v1/auth/login') {
      await new Promise(resolve => setTimeout(resolve, 5100));
      // Not a valid credential: accepted only by this fully intercepted UI
      // fixture. Permission lookup fails and the store never authenticates.
      // Do not persist/log the response body or authorization headers.
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ accessToken: 'ui-synthetic-not-a-valid-credential', adultGate: 'REQUIRED' }) });
      return;
    }
    if (scenario === 'two-stage-unavailable' && request.method() === 'GET' && url.pathname === '/api/v1/iam/permissions') {
      permissionStarted = Date.now();
      await new Promise(resolve => setTimeout(resolve, 5900));
      await route.fulfill({ status: 503, headers, body: JSON.stringify({ code: 'SERVICE_UNAVAILABLE', message: 'Synthetic permission outage' }) });
      return;
    }
    await route.fulfill({
      status: request.method() === 'OPTIONS' ? 204 : 401,
      headers,
      body: request.method() === 'OPTIONS' ? '' : JSON.stringify({ code: 'iam.credentials.invalid', message: 'Synthetic rejection' }),
    });
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  await page.goto(`${BASE}/#${PAGE_PATH}?theme=${theme}&uiLocale=${locale}`, { waitUntil: 'networkidle' });
  await page.locator('#mobile-login-title').waitFor();
  await page.getByRole('textbox', { name: labels[locale].account, exact: true }).waitFor();
  return { context, page, hold: () => { hold = true; }, release: () => { if (release) { pending.delete(release); release(); } }, count: () => loginCount, latency: () => ({ loginStarted, permissionStarted }) };
}
async function facts(page) {
  return page.evaluate(() => {
    const bg = element => {
      for (let current = element; current; current = current.parentElement) {
        const color = getComputedStyle(current).backgroundColor;
        if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color;
      }
      return 'rgb(255, 255, 255)';
    };
    const rgb = color => color.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = color => rgb(color).map(value => { const v = value / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
    const contrast = element => {
      const a = luminance(getComputedStyle(element).color), b = luminance(bg(element));
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    };
    const dimensions = element => { const r = element.getBoundingClientRect(); return { width: r.width, height: r.height }; };
    const root = document.querySelector('.v2-login'), title = document.querySelector('.login-title'), submit = document.querySelector('.login-submit');
    const fields = [...document.querySelector('.login-fields').children].filter(element => element.classList.contains('login-field'));
    const fieldRects = fields.map(element => element.getBoundingClientRect());
    return {
      url: location.href, title: document.title, theme: document.documentElement.dataset.theme,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      contentWidth: document.querySelector('.login-content').getBoundingClientRect().width,
      background: getComputedStyle(root).backgroundColor,
      titleFont: getComputedStyle(title).fontSize, titleFontFamily: getComputedStyle(title).fontFamily,
      titleContrast: contrast(title), descriptionContrast: contrast(document.querySelector('.login-description')),
      submitFont: getComputedStyle(submit).fontSize, submitContrast: contrast(submit),
      inputFonts: [...document.querySelectorAll('.login-input input')].map(element => getComputedStyle(element).fontSize),
      fieldGap: fieldRects[1].top - fieldRects[0].bottom,
      actionGap: submit.getBoundingClientRect().top - fieldRects[1].bottom,
      targets: [...document.querySelectorAll('.login-password-toggle,.login-text-button,.login-submit')].map(element => ({ label: element.getAttribute('aria-label') || element.textContent.trim(), ...dimensions(element) })),
    };
  });
}
async function immediateInputCase(kind, activation) {
  const current = await newPage(), { page } = current;
  const observed = await page.evaluate(({ kind, activation }) => {
    let instance = document.querySelector('.v2-login').__vueParentComponent;
    while (instance && !('password' in instance.setupState)) instance = instance.parent;
    if (!instance) throw new Error('Login page state not found');
    const state = instance.setupState;
    const account = document.querySelector('#mobile-login-identifier');
    const password = document.querySelector('#mobile-login-password');
    const expectedAccount = 'ui-input-synthetic-account';
    const first = 'ui-input-synthetic-first';
    const expectedPassword = kind === 'clear' ? '' : kind === 'last-character' ? first + '-final' : 'ui-input-synthetic-replacement';
    const calls = [];
    // Replace only this isolated page's action before transport. No request body,
    // credential storage, token or authenticated session is inspected or created.
    state.session.login = async (identifier, value) => {
      calls.push({ identifierMatches: identifier === expectedAccount, passwordMatchesLatest: value === expectedPassword });
      state.session.lastError = 'iam.credentials.invalid';
      return false;
    };
    account.value = expectedAccount;
    account.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    password.focus();
    const started = performance.now();
    password.value = first;
    password.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    password.value = expectedPassword;
    password.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: kind === 'clear' ? 'deleteContentBackward' : 'insertText' }));
    const modelAlreadyCurrent = state.password === expectedPassword;
    if (activation === 'Enter') password.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    else {
      password.blur();
      document.querySelector('.login-submit').click();
    }
    return { kind, activation, elapsedMs: performance.now() - started, modelAlreadyCurrent, calls };
  }, { kind, activation });
  assert.ok(observed.elapsedMs < 100, 'Exercise submission before uni model throttle can expire');
  assert.equal(observed.modelAlreadyCurrent, false, 'The reproduction must enter the stale model window');
  if (kind === 'clear') {
    assert.equal(observed.calls.length, 0, 'Cleared password must not reach login');
    await page.getByRole('alert').waitFor();
    await page.waitForFunction(() => document.activeElement.id === 'mobile-login-password');
    assert.equal(await page.getByLabel('密码', { exact: true }).getAttribute('aria-invalid'), 'true');
    await page.screenshot({ path: path.join(OUT, 'login-immediate-clear-required.png'), fullPage: true });
  } else {
    assert.equal(observed.calls.length, 1);
    assert.ok(observed.calls.every(call => call.identifierMatches && call.passwordMatchesLatest), 'Login consumes the current event value');
    await page.getByRole('alert').waitFor();
  }
  assert.equal(current.count(), 0, 'Pure action stub must not reach IAM');
  (report.inputTiming ||= []).push(observed);
  save();
  await current.context.close();
}
(async () => {
  browser = await chromium.launch();
  for (const kind of ['clear', 'last-character', 'replacement']) {
    for (const activation of ['click', 'Enter']) await immediateInputCase(kind, activation);
  }
  report.checks.push('Six sub-100ms native input cases: clearing blocks login and focuses password; final character/replacement with click or Enter consumes the current event value; boolean-only isolated action stubs make zero IAM requests');
  for (const width of [320, 390, 768]) {
    for (const locale of ['zh-CN', 'en-US']) {
      for (const theme of ['light', 'dark', 'high-contrast', 'system']) {
        const current = await newPage(width, theme, locale), { page } = current;
        assert.equal(await page.getByRole('heading', { name: labels[locale].title, exact: true }).count(), 1);
        assert.equal(await page.getByRole('heading').count(), 1, 'Only one main heading');
        assert.equal(await page.locator('.yx-card,.v2-login-brand,.mobile-page-header,.login-error').count(), 0, 'No decorative card, duplicate headline or idle status');
        const actual = await facts(page);
        assert.equal(actual.overflow, false, `${width}/${theme}/${locale}: overflow`);
        assert.ok(actual.contentWidth <= 420.1);
        assert.equal(actual.titleFont, '28px');
        assert.equal(actual.submitFont, '16px');
        assert.deepEqual(actual.inputFonts, ['16px', '16px']);
        assert.ok(actual.fieldGap >= 23.9 && actual.actionGap >= 23.9, 'Explicit form-row container preserves 24px field/action gaps');
        assert.ok(!/Georgia|Times New Roman/.test(actual.titleFontFamily));
        assert.ok(actual.targets.every(target => target.width >= 44 && target.height >= 44));
        assert.ok(actual.titleContrast >= 4.5 && actual.descriptionContrast >= 4.5 && actual.submitContrast >= 4.5, 'Readable text in every theme');
        assert.equal(await page.locator('#mobile-login-identifier').getAttribute('autocomplete'), 'username');
        assert.equal(await page.locator('#mobile-login-password').getAttribute('autocomplete'), 'current-password');
        assert.equal(await page.getByLabel(labels[locale].password, { exact: true }).count(), 1);
        assert.equal(await page.locator('.login-form').getAttribute('aria-busy'), 'false');
        if (theme === 'system') {
          await page.emulateMedia({ colorScheme: 'dark' });
          await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
          await page.emulateMedia({ colorScheme: 'light' });
          await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
        }
        if ((locale === 'zh-CN' && theme !== 'system') || (width === 390 && locale === 'en-US' && theme === 'light')) {
          await page.screenshot({ path: path.join(OUT, `login-${width}-${locale}-${theme}.png`), fullPage: true });
        }
        report.matrix.push({ width, locale, requestedTheme: theme, ...actual, status: 'PASS' });
        save();
        await current.context.close();
      }
    }
  }
  report.checks.push('24 isolated viewport/locale/theme combinations; system preference responds live; true inputs labelled and autocomplete intact');
  const current = await newPage(), { page } = current;
  const account = page.getByRole('textbox', { name: '账号', exact: true });
  const password = page.getByLabel('密码', { exact: true });
  const submit = page.getByRole('button', { name: '登录', exact: true });
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-login-identifier');
  const focus = await account.evaluate(element => { const wrapper = element.closest('uni-input'); return { outline: getComputedStyle(wrapper).outlineStyle, width: getComputedStyle(wrapper).outlineWidth }; });
  assert.equal(focus.outline, 'solid');
  assert.ok(parseFloat(focus.width) >= 2);
  report.checks.push('Native input node receives visible focus; form fields/actions retain measured 24px gaps');
  await page.screenshot({ path: path.join(OUT, 'login-keyboard-focus.png'), fullPage: true });
  await submit.click();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-login-identifier');
  assert.equal(await account.getAttribute('aria-invalid'), 'true');
  assert.equal(await password.getAttribute('aria-invalid'), 'true');
  assert.equal(await account.getAttribute('aria-describedby'), 'mobile-login-error');
  assert.equal(current.count(), 0);
  await page.screenshot({ path: path.join(OUT, 'login-required-error.png'), fullPage: true });
  await account.fill('ui-login-synthetic');
  await password.focus();
  await page.waitForFunction(() => !document.querySelector('#mobile-login-identifier').hasAttribute('aria-invalid'));
  assert.equal(await password.getAttribute('aria-invalid'), 'true');
  assert.equal(await password.getAttribute('aria-describedby'), 'mobile-login-error');
  await submit.click();
  assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-login-password');
  assert.equal(await account.getAttribute('aria-invalid'), null);
  await password.fill('SyntheticOnly123');
  await page.waitForFunction(() => !document.querySelector('#mobile-login-error'));
  assert.equal(await password.getAttribute('aria-invalid'), null);
  assert.equal(await password.getAttribute('aria-describedby'), null);
  const passwordControls = await page.locator('.login-password-toggle').getAttribute('aria-controls');
  assert.equal(passwordControls, 'mobile-login-password');
  assert.equal(await page.locator('#' + passwordControls).count(), 1);
  // UI-locale adapter fixture: no auth/session state or storage is inspected.
  await page.evaluate(async () => {
    const { mobileI18nAdapter } = await import('/src/platform/v2-foundation.ts');
    mobileI18nAdapter.setLocale('en-US');
  });
  await page.getByRole('textbox', { name: 'Account', exact: true }).waitFor();
  assert.equal(await page.getByLabel('Password', { exact: true }).getAttribute('autocomplete'), 'current-password');
  assert.equal(await page.locator('#mobile-login-password').getAttribute('aria-label'), 'Password');
  await page.evaluate(async () => {
    const { mobileI18nAdapter } = await import('/src/platform/v2-foundation.ts');
    mobileI18nAdapter.setLocale('zh-CN');
  });
  await account.waitFor();
  assert.equal(await password.getAttribute('autocomplete'), 'current-password');
  await account.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement.id === 'mobile-login-password');
  assert.equal(current.count(), 0, 'Account confirm moves to password without submitting');
  const show = page.getByRole('button', { name: '显示密码', exact: true });
  await show.focus();
  await page.keyboard.press('Enter');
  assert.equal(await password.getAttribute('type'), 'text');
  assert.equal(await password.getAttribute('aria-label'), '密码');
  assert.equal(await password.getAttribute('autocomplete'), 'current-password');
  assert.equal(await page.getByRole('button', { name: '隐藏密码', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Space');
  assert.equal(await password.getAttribute('type'), 'password');
  current.hold();
  await password.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.login-form').getAttribute('aria-busy') === 'true');
  assert.equal(await password.isDisabled(), true);
  assert.equal(await account.isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: '显示密码', exact: true }).isDisabled(), true);
  for (const button of await page.locator('.login-text-button').all()) assert.equal(await button.isDisabled(), true);
  await page.locator('.login-submit').click({ force: true });
  await page.waitForTimeout(100);
  assert.equal(current.count(), 1);
  await page.screenshot({ path: path.join(OUT, 'login-busy.png'), fullPage: true });
  current.release();
  await page.locator('.login-form[aria-busy=false]').waitFor();
  await page.getByRole('alert').waitFor();
  assert.ok((await page.getByRole('alert').innerText()).includes('账号或密码'));
  assert.equal(await password.isEnabled(), true);
  assert.equal(await password.getAttribute('aria-invalid'), null, 'Server rejection must not pretend a field syntax error');
  await account.fill('ui-login-synthetic-edited');
  assert.equal(await page.getByRole('alert').count(), 1, 'Editing does not hide an unhandled server rejection');
  await password.fill('');
  await page.screenshot({ path: path.join(OUT, 'login-server-rejection.png'), fullPage: true });
  report.checks.push('Visible Tab focus; empty submit associates errors and focuses first missing input; account Enter goes to password');
  report.checks.push('Eye Enter/Space toggle preserves labels; password Enter submits; busy disables controls and prevents duplicate IAM request; rejection allows retry');
  report.checks.push('Typing/blur clear only resolved required errors; live locale-adapter change updates true input labels; eye controls point at the actual input');
  await current.context.close();
  const delayed = await newPage();
  await delayed.page.getByRole('textbox', { name: '账号', exact: true }).fill('ui-login-slow-synthetic');
  await delayed.page.getByLabel('密码', { exact: true }).fill('SyntheticOnly123');
  delayed.hold();
  const firstValidSubmitTop = (await delayed.page.getByRole('button', { name: '登录', exact: true }).boundingBox()).y;
  await delayed.page.getByRole('button', { name: '登录', exact: true }).click();
  await delayed.page.waitForFunction(() => document.querySelector('.login-form').getAttribute('aria-busy') === 'true');
  const firstValidBusyTop = (await delayed.page.locator('.login-submit').boundingBox()).y;
  assert.equal(firstValidBusyTop, firstValidSubmitTop, 'First valid submission adds no hidden feedback row or button movement');
  report.firstValidBusyGeometry = { beforeTop: firstValidSubmitTop, busyTop: firstValidBusyTop };
  await delayed.page.waitForTimeout(6000);
  assert.equal(await delayed.page.locator('.login-form').getAttribute('aria-busy'), 'true');
  assert.equal(await delayed.page.getByRole('alert').count(), 0);
  assert.equal(delayed.count(), 1);
  await delayed.page.screenshot({ path: path.join(OUT, 'login-delayed-busy.png'), fullPage: true });
  delayed.release();
  await delayed.page.getByRole('alert').waitFor();
  assert.equal(await delayed.page.locator('.login-form').getAttribute('aria-busy'), 'false');
  assert.equal(await delayed.page.getByLabel('密码', { exact: true }).getAttribute('autocomplete'), 'current-password');
  report.checks.push('Synthetic IAM rejection held for six seconds keeps busy truthful, sends one request and restores native input semantics after rejection');
  await delayed.context.close();
  const sequential = await newPage(390, 'light', 'zh-CN', 844, 'two-stage-unavailable');
  await sequential.page.getByRole('textbox', { name: '账号', exact: true }).fill('ui-login-two-stage-synthetic');
  await sequential.page.getByLabel('密码', { exact: true }).fill('SyntheticOnly123');
  await sequential.page.getByRole('button', { name: '登录', exact: true }).click();
  await sequential.page.waitForFunction(() => document.querySelector('.login-form').getAttribute('aria-busy') === 'true');
  assert.ok(sequential.latency().loginStarted > 0);
  await sequential.page.waitForTimeout(Math.max(0, 10050 - (Date.now() - sequential.latency().loginStarted)));
  assert.ok(sequential.latency().permissionStarted > sequential.latency().loginStarted);
  const observedAtMs = Date.now() - sequential.latency().loginStarted;
  assert.equal(await sequential.page.locator('.login-form').getAttribute('aria-busy'), 'true', 'Two individually bounded requests may remain pending beyond the old page deadline');
  assert.equal(await sequential.page.getByRole('alert').count(), 0, 'No premature ten-second failure');
  await sequential.page.getByRole('alert').waitFor();
  assert.equal(await sequential.page.locator('.login-form').getAttribute('aria-busy'), 'false');
  const finalMessage = await sequential.page.getByRole('alert').innerText();
  assert.ok(finalMessage.length > 0 && !/(账号或密码不正确|账号不存在|未注册)/.test(finalMessage), 'Permission outage keeps a neutral error');
  assert.equal(sequential.count(), 1);
  assert.equal(new URL(sequential.page.url()).hash.split('?')[0], '#/pages/login/login');
  report.twoStageDelay = { fixture: '5100ms login response then 5900ms permission 503; no real credential or authenticated session', observedAtMs, elapsedMs: Date.now() - sequential.latency().loginStarted, finalMessage };
  await sequential.page.screenshot({ path: path.join(OUT, 'login-two-stage-neutral-error.png'), fullPage: true });
  report.checks.push('Two-stage synthetic 5.1s + 5.9s permission outage remains busy beyond ten seconds then shows neutral failure; no early page race');
  await sequential.context.close();
  for (const locale of ['zh-CN', 'en-US']) {
    const enlarged = await newPage(390, 'light', locale);
    await enlarged.page.evaluate(() => {
      for (const element of document.querySelectorAll('.login-brand,.login-adult-note,.login-title,.login-description,.login-label,.login-input,.login-submit,.login-text-button,.login-register')) {
        element.style.fontSize = (parseFloat(getComputedStyle(element).fontSize) * 2) + 'px';
      }
    });
    const actual = await facts(enlarged.page);
    assert.equal(actual.overflow, false, '200% text stays within viewport');
    assert.deepEqual(actual.inputFonts, ['32px', '32px']);
    assert.ok(actual.targets.every(target => target.height >= 44));
    await enlarged.page.screenshot({ path: path.join(OUT, `login-390-${locale}-text-200.png`), fullPage: true });
    report.matrix.push({ width: 390, locale, requestedTheme: 'light', textScale: 2, ...actual, status: 'PASS' });
    await enlarged.context.close();
  }
  const short = await newPage(320, 'light', 'en-US', 460);
  await short.page.locator('.login-register').scrollIntoViewIfNeeded();
  assert.equal(await short.page.locator('.login-register').isVisible(), true);
  assert.equal((await facts(short.page)).overflow, false);
  await short.page.screenshot({ path: path.join(OUT, 'login-320-english-short-viewport.png'), fullPage: true });
  await short.context.close();
  report.checks.push('Chinese/English 200% text and short viewport scroll checks; no physical OS soft-keyboard claim');
  assert.equal(report.pageErrors.length, 0);
  assert.ok(report.consoleErrors.every(message => message.includes('401') || message.includes('503')), 'Only expected fixture rejections/outages may be console errors');
  report.status = 'PASS_UI_SCOPED_NOT_BUSINESS_ACCEPTANCE';
  save();
  console.log(JSON.stringify({ status: report.status, matrix: report.matrix.length, checks: report.checks, pageErrors: report.pageErrors.length, consoleErrors: report.consoleErrors, output: OUT }, null, 2));
})().catch(error => {
  report.status = 'FAIL'; report.failure = error.stack; save(); console.error(error.stack); process.exitCode = 1;
}).finally(async () => {
  for (const resolve of pending) resolve();
  await browser?.close();
});
