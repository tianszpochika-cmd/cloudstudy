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
const save = () => fs.writeFileSync(path.join(OUT, 'contract-results.json'), JSON.stringify(report, null, 2));
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
(async()=>{browser=await chromium.launch();report.contractBoundaries=[];
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
 frozen(); assert.equal(report.pageErrors.length,0);assert.ok(report.consoleErrors.every(m=>/401|409|429|503/.test(m)));report.sourceHashesAfter=Object.fromEntries(sources.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,f))).digest('hex')]));report.status='UI_PASS_SCOPED_NOT_BUSINESS';save();console.log(JSON.stringify({status:report.status,contractBoundaries:report.contractBoundaries?.length,pointer:report.pointer?.length,reportedErrorPointer:report.reportedErrorPointer?.length,checks:report.checks.length}));
})().catch(e=>{report.status='FAIL';report.failure={name:e.name,message:e.message};save();console.error(e.message);process.exitCode=1}).finally(async()=>{pending.forEach(r=>r());await browser?.close()});