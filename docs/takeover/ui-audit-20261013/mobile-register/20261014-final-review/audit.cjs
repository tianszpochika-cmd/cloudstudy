// Independent MB-002 final visual review. All APIs are intercepted.
// Never read authentication storage, tokens, cookies, request bodies or headers.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../../../../..');
const EXPECTED = '46171faacf15f103dd3063568cd0f903d10825ca283bd7dc674571c0073d76bd';
const source = 'apps/mobile/src/pages/register/register.vue';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex');
const report = { scope: 'MB002_INDEPENDENT_FINAL_UI_REVIEW', at: new Date().toISOString(), browser: 'Playwright Chromium; Browser plugin/skill unavailable', sourceHashes: {}, matrix: [], states: [], quickInput: [], pageErrors: [], consoleErrors: [], apiRequests: [] };
for (const file of [source, 'packages/i18n/src/mobile-experience.ts', 'apps/mobile/src/theme/v2-tokens.scss', 'apps/mobile/src/theme/v2-icons.ts', 'apps/mobile/src/uni.scss']) report.sourceHashes[file] = hash(file);
assert.equal(report.sourceHashes[source], EXPECTED);
const save = () => fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(report, null, 2));
const labels = {
  'zh-CN': { title: '创建账号', account: '账号', password: '密码', confirm: '确认密码', description: '开始学习前，请先创建语学星账号。', hint: '至少 12 位。' },
  'en-US': { title: 'Create account', account: 'Account', password: 'Password', confirm: 'Confirm password', description: 'Create a 语学星 account to start learning.', hint: 'At least 12 characters.' },
};
let browser;
async function open(width, locale, theme) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
  let count = 0;
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' && url.port === '18183' ? route.continue() : route.abort();
  });
  await context.route('**/api/v1/**', route => {
    const req = route.request(), url = new URL(req.url());
    assert.equal(url.protocol, 'https:');
    report.apiRequests.push({ method: req.method(), path: url.pathname });
    if (req.method() === 'POST' && url.pathname.endsWith('/auth/register')) count++;
    return route.fulfill({ status: req.method() === 'OPTIONS' ? 204 : 503, headers: { 'content-type': 'application/json', 'access-control-allow-origin': 'http://127.0.0.1:18183', 'access-control-allow-credentials': 'true' }, body: req.method() === 'OPTIONS' ? '' : JSON.stringify({ code: 'SERVICE_UNAVAILABLE' }) });
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  await page.goto(`http://127.0.0.1:18183/#/pages/register/register?uiLocale=${locale}&theme=${theme}`);
  await page.getByRole('heading', { name: labels[locale].title, exact: true }).waitFor();
  await page.locator('#mobile-register-confirm').waitFor();
  return { page, context, count: () => count };
}
async function facts(page) {
  return page.evaluate(() => {
    const rect = element => { const r = element.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
    const bg = element => { for (let e = element; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c !== 'transparent' && c !== 'rgba(0, 0, 0, 0)') return c; } return 'rgb(255,255,255)'; };
    const lum = c => c.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => { const v = n / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0);
    const ratio = e => { const a = lum(getComputedStyle(e).color), b = lum(bg(e)); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
    const fields = [...document.querySelectorAll('.register-field')].map(rect), submit = document.querySelector('.register-submit');
    const textSelectors = ['.register-title', '.register-description', '.register-adult-note', '.register-password-hint', '.register-label', '.register-text-button', '.register-submit'];
    return {
      url: location.href, title: document.title, theme: document.documentElement.dataset.theme,
      overflow: document.documentElement.scrollWidth > innerWidth + 1, formWidth: rect(document.querySelector('.register-content')).width,
      titleFont: getComputedStyle(document.querySelector('.register-title')).fontSize,
      inputFonts: [...document.querySelectorAll('.register-input input')].map(e => getComputedStyle(e).fontSize),
      fieldGaps: [fields[1].top - fields[0].bottom, fields[2].top - fields[1].bottom], actionGap: rect(submit).top - fields[2].bottom, submitTop: rect(submit).top,
      contrasts: Object.fromEntries(textSelectors.map(s => [s, ratio(document.querySelector(s))])),
      errorRows: [...document.querySelectorAll('.register-field-error')].map(e => ({ ...rect(e), hidden: e.getAttribute('aria-hidden'), role: e.getAttribute('role'), visibility: getComputedStyle(e).visibility, contrast: ratio(e) })),
      targets: [...document.querySelectorAll('.register-password-toggle,.register-text-button,.register-submit')].map(rect),
      inputs: [...document.querySelectorAll('.register-input input')].map(e => ({ name: e.name, autocomplete: e.autocomplete, label: e.getAttribute('aria-label'), invalid: e.getAttribute('aria-invalid'), description: e.getAttribute('aria-describedby') })),
    };
  });
}
async function screenshot(page, name) { await page.screenshot({ path: path.join(__dirname, name + '.png'), fullPage: true }); }
(async () => {
  browser = await chromium.launch({ headless: true });
  for (const width of [320, 390, 768, 1280]) for (const locale of ['zh-CN', 'en-US']) for (const theme of ['light', 'dark', 'high-contrast', 'system']) {
    const current = await open(width, locale, theme), { page } = current;
    assert.equal(await page.getByRole('heading').count(), 1);
    assert.equal(await page.locator('vite-error-overlay,.yx-card,.mobile-page-header,.register-field-error,.register-server-error').count(), 0);
    assert.equal(await page.locator('.register-description').innerText(), labels[locale].description);
    assert.equal(await page.locator('.register-password-hint').innerText(), labels[locale].hint);
    const actual = await facts(page);
    assert.equal(actual.overflow, false); assert.ok(actual.formWidth <= 420.1);
    assert.equal(actual.titleFont, '28px'); assert.deepEqual(actual.inputFonts, ['16px', '16px', '16px']);
    assert.ok([...actual.fieldGaps, actual.actionGap].every(g => Math.abs(g - 24) < .2));
    assert.ok(Object.values(actual.contrasts).every(r => r >= 4.5));
    assert.ok(actual.targets.every(r => r.width >= 44 && r.height >= 44));
    assert.deepEqual(actual.inputs.map(i => i.name), ['identifier', 'password', 'confirm']);
    assert.deepEqual(actual.inputs.map(i => i.autocomplete), ['username', 'new-password', 'new-password']);
    assert.deepEqual(actual.inputs.map(i => i.label), [labels[locale].account, labels[locale].password, labels[locale].confirm]);
    await screenshot(page, `normal-${width}-${locale}-${theme}`);
    if (theme === 'system') {
      await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
      await page.emulateMedia({ colorScheme: 'light' }); await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    }
    report.matrix.push({ width, locale, requestedTheme: theme, ...actual, status: 'PASS' }); save();
    await current.context.close();
  }
  for (const locale of ['zh-CN', 'en-US']) {
    const current = await open(390, locale, 'light'), { page } = current;
    await page.evaluate(() => { for (const e of document.querySelectorAll('.register-brand,.register-adult-note,.register-title,.register-description,.register-label,.register-input,.register-password-hint,.register-field-error,.register-submit,.register-text-button,.register-signin')) e.style.fontSize = parseFloat(getComputedStyle(e).fontSize) * 2 + 'px'; });
    await page.locator('.register-submit').click();
    await page.waitForFunction(() => document.activeElement.id === 'mobile-register-identifier');
    // Newly-created errors inherit an explicit 200% font, matching the other text.
    await page.locator('.register-field-error').evaluateAll(els => els.forEach(e => e.style.fontSize = '26px'));
    const before = await facts(page);
    assert.equal(before.overflow, false); assert.deepEqual(before.inputFonts, ['32px', '32px', '32px']);
    assert.equal(before.errorRows.length, 3); assert.ok(before.errorRows.every(e => e.contrast >= 4.5));
    await screenshot(page, `text200-${locale}-required`);
    await page.locator('#mobile-register-identifier').fill('ui-review-synthetic');
    await page.locator('#mobile-register-password').fill('ui-review-synthetic-password');
    await page.locator('#mobile-register-confirm').fill('ui-review-synthetic-password');
    await page.locator('#mobile-register-confirm').blur();
    await page.waitForFunction(() => [...document.querySelectorAll('.register-input input')].every(e => !e.hasAttribute('aria-invalid')));
    const after = await facts(page);
    assert.equal(after.overflow, false); assert.equal(after.errorRows.length, 3);
    assert.ok(after.errorRows.every(e => e.hidden === 'true' && e.role === null && e.visibility === 'hidden'));
    assert.deepEqual(after.errorRows.map(e => e.height), before.errorRows.map(e => e.height));
    assert.equal(after.submitTop, before.submitTop);
    assert.ok([...after.fieldGaps, after.actionGap].every(g => Math.abs(g - 24) < .2));
    await screenshot(page, `text200-${locale}-corrected`);
    await page.locator('.register-signin').scrollIntoViewIfNeeded();
    assert.equal(current.count(), 0);
    report.states.push({ locale, textScale: 2, before, after, zeroApiRequests: true, status: 'PASS' }); save();
    await current.context.close();
  }
  for (const activation of ['click', 'Enter']) {
    const current = await open(390, 'zh-CN', 'light'), { page } = current;
    const result = await page.evaluate(activation => {
      let vm = document.querySelector('.v2-register').__vueParentComponent;
      while (vm && !('confirm' in vm.setupState)) vm = vm.parent;
      const state = vm.setupState, expectedAccount = 'ui-review-synthetic', first = 'ui-review-synthetic-first', expectedPassword = first + '-final', calls = [];
      state.session.register = async (identifier, password) => { calls.push({ identifierMatches: identifier === expectedAccount, latestPasswordConsumed: password === expectedPassword }); state.session.lastError = 'UNKNOWN_AUTH_ERROR'; return false; };
      const input = (id, value) => { const e = document.querySelector(id); e.value = value; e.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' })); return e; };
      input('#mobile-register-identifier', expectedAccount);
      input('#mobile-register-password', expectedPassword);
      const field = input('#mobile-register-confirm', first); field.focus();
      const start = performance.now(); input('#mobile-register-confirm', expectedPassword);
      const modelStillOld = state.confirm !== expectedPassword;
      if (activation === 'Enter') field.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      else { field.blur(); document.querySelector('.register-submit').click(); }
      return { activation, elapsedMs: performance.now() - start, modelStillOld, calls };
    }, activation);
    assert.ok(result.elapsedMs < 100 && result.modelStillOld);
    assert.equal(result.calls.length, 1); assert.ok(result.calls.every(c => c.identifierMatches && c.latestPasswordConsumed));
    assert.equal(current.count(), 0); report.quickInput.push({ ...result, status: 'PASS' }); save();
    await current.context.close();
  }
  assert.equal(hash(source), EXPECTED, 'Registration source stayed frozen');
  assert.equal(report.pageErrors.length, 0);
  assert.ok(report.consoleErrors.every(message => /503/.test(message)));
  report.status = 'PASS_INDEPENDENT_UI_SCOPE'; save();
  console.log(JSON.stringify({ status: report.status, matrix: report.matrix.length, enlargedStates: report.states.length, immediateInput: report.quickInput.length, sourceHash: EXPECTED, pageErrors: report.pageErrors.length }, null, 2));
})().catch(error => { report.status = 'FAIL_INDEPENDENT_UI_SCOPE'; report.failure = error.stack; save(); console.error(error.stack); process.exitCode = 1; }).finally(async () => { await browser?.close(); });
