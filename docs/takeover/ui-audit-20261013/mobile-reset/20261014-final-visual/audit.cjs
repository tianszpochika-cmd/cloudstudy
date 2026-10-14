// Independent MB003 visual review of formal H5 pages. All APIs intercepted.
// Never save reset code/password values, token-bearing URLs, auth storage or headers/bodies.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../../../../..'), BASE = 'http://127.0.0.1:18183';
const SOURCE = 'apps/mobile/src/pages/reset-password/reset-password.vue';
const EXPECTED = 'b3eebb09cf8e2194ed9355f5dce863786789ca870b25d47203022815bef7c361';
const hash = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex');
const report = { scope: 'MB003_INDEPENDENT_FINAL_VISUAL_REVIEW', at: new Date().toISOString(), browser: 'Playwright Chromium; Browser plugin/skill unavailable', sourceHashes: {}, matrix: [], enlargedStates: [], shortViewport: [], pageErrors: [], consoleErrors: [], apiRequestCount: 0 };
for (const file of [SOURCE, 'packages/i18n/src/mobile-experience.ts', 'apps/mobile/src/theme/v2-tokens.scss', 'apps/mobile/src/theme/v2-icons.ts', 'apps/mobile/src/uni.scss']) report.sourceHashes[file] = hash(file);
assert.equal(report.sourceHashes[SOURCE], EXPECTED);
const save = () => fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(report, null, 2));
const copy = {
  'zh-CN': { request: '找回密码', confirm: '设置新密码', account: '账号', token: '重置口令', newPassword: '新密码', requestHint: '输入账号，获取重置指引。', confirmHint: '使用邮件中的口令设置新密码。', hint: '至少 12 位。' },
  'en-US': { request: 'Reset password', confirm: 'Set a new password', account: 'Account', token: 'Reset code', newPassword: 'New password', requestHint: 'Enter your account to get reset instructions.', confirmHint: 'Use the code from your email to set a new password.', hint: 'At least 12 characters.' },
};
let browser;
async function open(width, locale, theme, step, height = 844) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  await context.route('**/*', route => { const u = new URL(route.request().url()); return u.hostname === '127.0.0.1' && u.port === '18183' ? route.continue() : route.abort(); });
  await context.route('**/api/v1/**', route => { report.apiRequestCount++; return route.fulfill({ status: 503, headers: { 'content-type': 'application/json', 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true' }, body: JSON.stringify({ code: 'SERVICE_UNAVAILABLE' }) }); });
  const page = await context.newPage();
  page.on('pageerror', e => report.pageErrors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') report.consoleErrors.push(msg.text()); });
  // No reset credential is placed in the URL; confirm is reached by its real UI control.
  await page.goto(BASE + '/#/pages/reset-password/reset-password?uiLocale=' + locale + '&theme=' + theme);
  await page.locator('#mobile-reset-identifier').waitFor();
  if (step === 'confirm') await page.locator('.reset-step-button').click();
  await page.getByRole('heading', { name: copy[locale][step], exact: true }).waitFor();
  return { context, page };
}
async function facts(page) {
  return page.evaluate(() => {
    const rect = e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
    const bg = e => { for (let n = e; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (c !== 'transparent' && c !== 'rgba(0, 0, 0, 0)') return c; } return 'rgb(255,255,255)'; };
    const lum = c => c.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => { const v = n / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((a,v,i) => a + v * [.2126,.7152,.0722][i], 0);
    const ratio = e => { const a = lum(getComputedStyle(e).color), b = lum(bg(e)); return (Math.max(a,b) + .05)/(Math.min(a,b) + .05); };
    const fields = [...document.querySelectorAll('.reset-field')].map(rect), submit = document.querySelector('.reset-submit');
    const selectors = ['.reset-title','.reset-description','.reset-adult-note','.reset-label','.reset-submit','.reset-step-button','.reset-login-button'];
    if (document.querySelector('.reset-password-hint')) selectors.push('.reset-password-hint');
    return { route: location.hash.split('?')[0], title: document.title, theme: document.documentElement.dataset.theme,
      overflow: document.documentElement.scrollWidth > innerWidth + 1, contentWidth: rect(document.querySelector('.reset-content')).width,
      titleFont: getComputedStyle(document.querySelector('.reset-title')).fontSize, descriptionFont: getComputedStyle(document.querySelector('.reset-description')).fontSize,
      labelFonts: [...document.querySelectorAll('.reset-label')].map(e => getComputedStyle(e).fontSize), hintFont: document.querySelector('.reset-password-hint') ? getComputedStyle(document.querySelector('.reset-password-hint')).fontSize : null,
      inputFonts: [...document.querySelectorAll('.reset-input input')].map(e => getComputedStyle(e).fontSize), submitFont: getComputedStyle(submit).fontSize,
      fieldGaps: fields.slice(1).map((r,i) => r.top - fields[i].bottom), actionGap: rect(submit).top - fields.at(-1).bottom, submitTop: rect(submit).top,
      contrast: Object.fromEntries(selectors.map(s => [s, ratio(document.querySelector(s))])),
      targets: [...document.querySelectorAll('.reset-password-toggle,.reset-text-button,.reset-submit')].map(rect),
      errors: [...document.querySelectorAll('.reset-field-error')].map(e => ({ height: rect(e).height, hidden: e.getAttribute('aria-hidden'), role: e.getAttribute('role'), visibility: getComputedStyle(e).visibility, contrast: ratio(e) })),
      inputs: [...document.querySelectorAll('.reset-input input')].map(e => ({ name: e.name, label: e.getAttribute('aria-label'), autocomplete: e.autocomplete, invalid: e.getAttribute('aria-invalid'), description: e.getAttribute('aria-describedby') })),
    };
  });
}
async function screenshot(page, name) {
  await page.screenshot({ path: path.join(__dirname, name + '.png'), fullPage: true, mask: [page.locator('#mobile-reset-token'), page.locator('#mobile-reset-newPassword')] });
}
(async () => {
  browser = await chromium.launch({ headless: true });
  for (const width of [320,390,768,1280]) for (const locale of ['zh-CN','en-US']) for (const theme of ['light','dark','high-contrast','system']) for (const step of ['request','confirm']) {
    const current = await open(width, locale, theme, step), { page } = current;
    assert.equal(await page.getByRole('heading').count(), 1);
    assert.equal(await page.locator('vite-error-overlay,.yx-card,.mobile-page-header,.reset-field-error,.reset-server-error,.reset-success,.reset-receipt').count(), 0);
    assert.equal(await page.locator('.reset-description').innerText(), copy[locale][step + 'Hint']);
    if (step === 'confirm') assert.equal(await page.locator('.reset-password-hint').innerText(), copy[locale].hint);
    const actual = await facts(page);
    assert.equal(actual.overflow, false); assert.ok(actual.contentWidth <= 420.1);
    assert.equal(actual.titleFont, '28px'); assert.equal(actual.descriptionFont, '14px'); assert.equal(actual.submitFont, '16px');
    assert.ok(actual.labelFonts.every(v => v === '14px')); if (step === 'confirm') assert.equal(actual.hintFont, '13px');
    assert.deepEqual(actual.inputFonts, step === 'request' ? ['16px'] : ['16px','16px','16px']);
    assert.ok([...actual.fieldGaps,actual.actionGap].every(g => Math.abs(g - 24) < .2));
    assert.ok(actual.targets.every(t => t.width >= 44 && t.height >= 44));
    assert.ok(Object.values(actual.contrast).every(r => r >= 4.5));
    assert.deepEqual(actual.inputs.map(i => i.name), step === 'request' ? ['identifier'] : ['identifier','token','newPassword']);
    assert.deepEqual(actual.inputs.map(i => i.autocomplete), step === 'request' ? ['username'] : ['username','one-time-code','new-password']);
    assert.deepEqual(actual.inputs.map(i => i.label), step === 'request' ? [copy[locale].account] : [copy[locale].account,copy[locale].token,copy[locale].newPassword]);
    // Empty normal-state fields contain no credential; do not mask their placeholders.
    await page.screenshot({ path: path.join(__dirname, `${step}-${width}-${locale}-${theme}.png`), fullPage: true });
    if (theme === 'system') {
      await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
      await page.emulateMedia({ colorScheme: 'light' }); await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    }
    report.matrix.push({ width,locale,requestedTheme:theme,step,...actual,status:'PASS' }); save(); await current.context.close();
  }
  for (const width of [320,390]) for (const step of ['request','confirm']) {
    const current = await open(width, 'en-US', 'light', step), { page } = current;
    await page.evaluate(() => { for (const e of document.querySelectorAll('.reset-brand,.reset-adult-note,.reset-title,.reset-description,.reset-label,.reset-input,.reset-password-hint,.reset-submit,.reset-text-button,.reset-exit')) e.style.fontSize = parseFloat(getComputedStyle(e).fontSize)*2 + 'px'; });
    await page.locator('.reset-submit').click();
    await page.waitForFunction(() => document.activeElement.id === 'mobile-reset-identifier');
    await page.locator('.reset-field-error').evaluateAll(es => es.forEach(e => e.style.fontSize = '28px'));
    const before = await facts(page);
    assert.equal(before.overflow, false); assert.ok(before.inputFonts.every(v => v === '32px'));
    assert.ok(before.errors.every(e => e.contrast >= 4.5));
    await screenshot(page, `text200-${step}-${width}-en-US-required`);
    await page.locator('#mobile-reset-identifier').fill('ui-visual-synthetic');
    if (step === 'confirm') {
      await page.locator('#mobile-reset-token').fill('u'.repeat(32));
      await page.locator('#mobile-reset-newPassword').fill('s'.repeat(16));
      await page.locator('#mobile-reset-newPassword').blur();
    } else await page.locator('#mobile-reset-identifier').blur();
    await page.waitForFunction(() => [...document.querySelectorAll('.reset-input input')].every(e => !e.hasAttribute('aria-invalid')));
    const after = await facts(page);
    assert.equal(after.overflow, false); assert.deepEqual(after.errors.map(e => e.height), before.errors.map(e => e.height));
    assert.ok(after.errors.every(e => e.hidden === 'true' && e.role === null && e.visibility === 'hidden'));
    assert.equal(after.submitTop, before.submitTop);
    assert.ok([...after.fieldGaps,after.actionGap].every(g => Math.abs(g - 24) < .2));
    await screenshot(page, `text200-${step}-${width}-en-US-corrected`);
    await page.locator('.reset-login-button').scrollIntoViewIfNeeded();
    report.enlargedStates.push({ width,locale:'en-US',step,textScale:2,before,after,status:'PASS' }); save(); await current.context.close();
  }
  for (const step of ['request','confirm']) {
    const current = await open(320, 'en-US', 'light', step, 460), { page } = current;
    await page.locator('.reset-login-button').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('.reset-login-button').isVisible(), true);
    const actual = await facts(page); assert.equal(actual.overflow, false);
    await screenshot(page, `short-${step}-320-en-US`);
    report.shortViewport.push({ width:320,height:460,step,...actual,status:'PASS' }); save(); await current.context.close();
  }
  assert.equal(hash(SOURCE), EXPECTED, 'Source stayed frozen');
  assert.equal(report.apiRequestCount, 0); assert.equal(report.pageErrors.length, 0); assert.equal(report.consoleErrors.length, 0);
  report.status='PASS_INDEPENDENT_VISUAL_SCOPE'; save();
  console.log(JSON.stringify({ status:report.status,matrix:report.matrix.length,enlarged:report.enlargedStates.length,short:report.shortViewport.length,apiRequests:report.apiRequestCount,pageErrors:report.pageErrors.length,sourceHash:EXPECTED },null,2));
})().catch(e=>{report.status='FAIL_INDEPENDENT_VISUAL_SCOPE';report.failure=e.stack;save();console.error(e.stack);process.exitCode=1;}).finally(async()=>{await browser?.close();});
