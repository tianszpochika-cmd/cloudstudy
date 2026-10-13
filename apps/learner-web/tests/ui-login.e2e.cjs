// UI-only checks against the fixed local frontend. IAM returns synthetic rejection;
// no real account, session storage, token inspection, or backend writes are used.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../../..');
const BASE = 'http://127.0.0.1:18180';
const OUT = path.resolve(ROOT, process.env.UI_AUDIT_OUTPUT || '.git/codex-local-backups/login-ui-' + Date.now());
const report = { scope: 'LOGIN_UI_ONLY_SYNTHETIC_IAM_REJECTION', at: new Date().toISOString(), matrix: [], checks: [], pageErrors: [], consoleErrors: [] };
fs.mkdirSync(OUT, { recursive: true });
const sources = ['apps/learner-web/src/pages/LoginPage.vue', 'apps/learner-web/src/layouts/AuthLayout.vue', 'apps/learner-web/src/theme/v2-tokens.scss', 'packages/i18n/src/learner-base.ts', 'packages/i18n/src/learner-experience.ts'];
report.sourceHashes = Object.fromEntries(sources.map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex')]));
let browser;
(async () => {
  browser = await chromium.launch();
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('pageerror', e => report.pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
  let loginRequests = 0, pendingResponse;
  await context.route('**/api/v1/auth/**', async route => {
    if (new URL(route.request().url()).pathname.endsWith('/login')) {
      loginRequests++;
      await new Promise(resolve => { pendingResponse = resolve; });
    }
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 'iam.credentials.invalid', message: 'Synthetic rejection' }) });
  });
  for (const width of [320, 390, 768, 900, 1280, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    for (const theme of ['light', 'dark', 'high-contrast', 'system']) {
      await page.goto(`${BASE}/login?theme=${theme}`);
      await page.locator('#login-title').waitFor();
      assert.equal(new URL(page.url()).pathname, '/login');
      assert.ok((await page.title()).includes('语学星'));
      assert.equal(await page.locator('h1').count(), 1);
      const facts = await page.evaluate(() => {
        const brand = document.querySelector('.auth-topline .brand');
        const r = brand.getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > innerWidth + 1, brandHeight: r.height, whiteSpace: getComputedStyle(brand).whiteSpace, theme: document.documentElement.dataset.theme, card: getComputedStyle(document.querySelector('.auth-content')).backgroundColor };
      });
      assert.equal(facts.overflow, false, `${width}/${theme}: horizontal overflow`);
      assert.equal(facts.whiteSpace, 'nowrap');
      assert.equal(facts.card, 'rgba(0, 0, 0, 0)', 'Auth form must use an open layout without an outer card');
      const targets = await page.locator('.auth-topline .brand,.auth-links a,.login-register a,.password-field button').evaluateAll(es => es.map(e => ({ name: e.textContent || e.getAttribute('aria-label'), h: e.getBoundingClientRect().height })));
      assert.ok(targets.every(e => e.h >= 44));
      report.matrix.push({ width, requestedTheme: theme, ...facts, targets, status: 'PASS' });
      if ((width === 390 && theme !== 'system') || (width === 1280 && theme === 'light')) {
        await page.screenshot({ path: path.join(OUT, `login-${width}-${theme}.png`), fullPage: true });
      }
    }
  }
  await page.goto(`${BASE}/login?theme=system`);
  await page.locator('#login-title').waitFor();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  report.checks.push('System theme responds to live dark/light preference changes');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/login?theme=light&redirect=%2Ftoday`);
  assert.equal(await page.locator('.login-status').count(), 0, 'No idle status box');
  assert.equal(await page.locator('.auth-art').count(), 0, 'No decorative artwork column');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  assert.equal(await page.locator('[name=identifier]').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.locator('[name=password]').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.evaluate(() => document.activeElement.name), 'identifier');
  assert.equal(await page.locator('[name=identifier]').getAttribute('aria-describedby'), 'login-status');
  assert.ok((await page.getByRole('alert').innerText()).includes('请输入账号和密码'));
  assert.equal(loginRequests, 0);
  report.checks.push('Empty submit identifies both fields, focuses account, announces error, sends no request');
  await page.getByRole('textbox', { name: '账号', exact: true }).fill('ui-audit-synthetic');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  assert.equal(await page.locator('[name=identifier]').getAttribute('aria-invalid'), null);
  assert.equal(await page.evaluate(() => document.activeElement.name), 'password');
  await page.getByLabel('密码', { exact: true }).fill('SyntheticOnly123');
  assert.equal(await page.getByRole('alert').count(), 0);
  await page.getByRole('button', { name: '显示密码', exact: true }).click();
  assert.equal(await page.locator('[name=password]').getAttribute('type'), 'text');
  assert.equal(await page.getByRole('button', { name: '隐藏密码', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('[name=password]').getAttribute('type'), 'password');
  report.checks.push('Password remains correctly labelled; keyboard toggle works without submitting');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('form').getAttribute('aria-busy') === 'true');
  assert.equal(await page.locator('[name=identifier]').isDisabled(), true);
  assert.equal(await page.locator('[name=password]').isDisabled(), true);
  assert.equal(await page.locator('.password-field button').isDisabled(), true);
  assert.equal(await page.locator('button[type=submit]').isDisabled(), true);
  await page.locator('form').evaluate(form => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  await page.waitForTimeout(100);
  assert.equal(loginRequests, 1);
  pendingResponse();
  await page.locator('form[aria-busy=false]').waitFor();
  assert.ok((await page.getByRole('alert').innerText()).includes('账号或密码'));
  assert.equal(await page.locator('[name=password]').getAttribute('aria-invalid'), null);
  assert.equal(await page.locator('[name=password]').isEnabled(), true);
  await page.locator('[name=identifier]').fill('ui-audit-synthetic-edited');
  assert.equal(await page.getByRole('alert').count(), 1, 'Editing must not clear a server rejection');
  await page.locator('[name=password]').fill('');
  await page.screenshot({ path: path.join(OUT, 'login-server-rejection.png'), fullPage: true });
  report.checks.push('Pending blocks duplicate submission and toggles; rejection is visible and allows retry');
  await page.getByRole('link', { name: '创建账号', exact: true }).click();
  await page.locator('#register-title').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('redirect'), '/today');
  await page.goto(`${BASE}/login?redirect=%2Ftoday`);
  await page.getByRole('link', { name: '忘记密码', exact: true }).click();
  await page.locator('#reset-title').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('redirect'), '/today');
  report.checks.push('Register/reset exits preserve return route; shared layout renders both pages');
  await page.goto(`${BASE}/login?theme=light`);
  await page.locator('#login-title').waitFor();
  await page.locator('body *').evaluateAll(es => { const sizes = es.map(e => parseFloat(getComputedStyle(e).fontSize)); es.forEach((e, i) => { e.style.fontSize = `${sizes[i] * 2}px`; }); });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  await page.locator('button[type=submit]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, 'login-390-text-200.png'), fullPage: true });
  report.checks.push('Simulated 200% text enlargement at 390: no horizontal overflow and submit scrolls into view (not native browser zoom)');
  assert.deepEqual(report.pageErrors, []);
  report.expectedConsoleErrors = report.consoleErrors.filter(e => /401 \(Unauthorized\)/.test(e));
  assert.deepEqual(report.consoleErrors.filter(e => !/401 \(Unauthorized\)/.test(e)), []);
  report.status = 'PASS';
})().catch(e => { report.status = 'FAIL'; report.failure = e.stack; process.exitCode = 1; }).finally(async () => {
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, combinations: report.matrix.length, checks: report.checks, failure: report.failure, out: OUT }));
  await browser?.close();
});
