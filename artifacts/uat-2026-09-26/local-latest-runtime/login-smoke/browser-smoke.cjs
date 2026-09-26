const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const outDir = path.resolve('artifacts/uat-2026-09-26/local-latest-runtime/login-smoke');
fs.mkdirSync(outDir, { recursive: true });
const pages = [];
const authResponses = [];
const identifier = 'codex-' + crypto.randomBytes(10).toString('hex') + '@local.invalid';
const password = 'Invalid-' + crypto.randomBytes(18).toString('base64url') + '!';

(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe', args: ['--no-sandbox'] });
 try {
  const cases = [
   { name: 'learner-login', url: 'http://127.0.0.1:18180/login', viewport: { width: 1280, height: 900 } },
   { name: 'admin-login', url: 'http://127.0.0.1:18181/login', viewport: { width: 1440, height: 960 } },
   { name: 'official-home', url: 'http://127.0.0.1:18182/', viewport: { width: 1440, height: 960 } },
   { name: 'mobile-login', url: 'http://127.0.0.1:18183/#/pages/login/login', viewport: { width: 390, height: 844 }, mobile: true }
  ];
  for (const item of cases) {
   const context = await browser.newContext({ viewport: item.viewport, deviceScaleFactor: item.mobile ? 2 : 1, isMobile: Boolean(item.mobile), hasTouch: Boolean(item.mobile) });
   const page = await context.newPage();
   const pageErrors = [], consoleErrors = [], failedRequests = [];
   page.on('pageerror', e => pageErrors.push(String(e.message).slice(0, 250)));
   page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 250)); });
   page.on('requestfailed', req => failedRequests.push({ url: req.url().split('?')[0], error: req.failure()?.errorText ?? 'request failed' }));
   if (item.name === 'learner-login') page.on('response', res => {
    if (/\/api\/v1\/auth\/login(?:$|\?)/.test(res.url())) authResponses.push({ status: res.status(), url: res.url().split('?')[0] });
   });
   let navigationStatus = null, navigationError = null, loginAttempt = null;
   try { const response = await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 30000 }); navigationStatus = response?.status() ?? null; await page.waitForTimeout(1800); }
   catch (e) { navigationError = String(e.message).slice(0, 250); }
   const initial = await page.evaluate(() => ({
    title: document.title, url: location.href,
    h1: [...document.querySelectorAll('h1')].map(x => x.innerText.trim()).filter(Boolean),
    buttons: [...document.querySelectorAll('button')].map(x => x.innerText.trim()).filter(Boolean).slice(0, 20),
    bodyText: (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 1200)
   })).catch(e => ({ title: '', url: page.url(), h1: [], buttons: [], bodyText: '', evalError: String(e.message).slice(0, 200) }));
   await page.screenshot({ path: path.join(outDir, item.name + '.png'), fullPage: true }).catch(() => {});
   if (item.name === 'learner-login' && navigationStatus >= 200 && navigationStatus < 400) {
    try {
     await page.locator('input[autocomplete="username"]').fill(identifier, { timeout: 5000 });
     await page.locator('input[autocomplete="current-password"]').fill(password, { timeout: 5000 });
     await page.locator('form button[type="submit"]').click({ timeout: 5000 });
     await page.waitForFunction(() => { const a = document.querySelector('[role="alert"]'); return Boolean(a && a.textContent.trim()); }, null, { timeout: 15000 }).catch(() => {});
     await page.waitForTimeout(700);
     const alertText = (await page.locator('[role="alert"]').allInnerTexts().catch(() => [])).map(s => s.trim()).filter(Boolean).join(' ').slice(0, 500);
     loginAttempt = { submitted: true, response: authResponses.at(-1) ?? null, visibleAlert: alertText, finalUrl: page.url() };
     await page.screenshot({ path: path.join(outDir, 'learner-login-negative-result.png'), fullPage: true }).catch(() => {});
    } catch (e) { loginAttempt = { submitted: false, error: String(e.message).slice(0, 250), response: authResponses.at(-1) ?? null }; }
   }
   pages.push({ name: item.name, requestedUrl: item.url, navigationStatus, navigationError, initial, loginAttempt, pageErrors, consoleErrors, failedRequests });
   await context.close();
  }
  const browserErrors = pages.flatMap(p => [
   ...p.pageErrors.map(message => ({ page: p.name, type: 'pageerror', message })),
   ...p.consoleErrors.map(message => ({ page: p.name, type: 'console', message }))
  ]);
  const report = {
   generatedAt: new Date().toISOString(),
   scope: 'Local browser smoke only. No positive authentication or business-flow acceptance claimed.',
   pages,
   summary: { pageCount: pages.length, navigation2xx: pages.filter(p => p.navigationStatus >= 200 && p.navigationStatus < 300).length, realGatewayLoginResponseCount: authResponses.length, loginResponses: authResponses, browserErrorCount: browserErrors.length },
   browserErrors
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  process.stdout.write(JSON.stringify({
   summary: report.summary,
   pages: pages.map(p => ({ name: p.name, navigationStatus: p.navigationStatus, title: p.initial.title, url: p.initial.url, h1: p.initial.h1, buttons: p.initial.buttons, bodyText: p.initial.bodyText, loginAttempt: p.loginAttempt, pageErrors: p.pageErrors, consoleErrors: p.consoleErrors, failedRequests: p.failedRequests }))
  }, null, 2) + '\n');
 } finally { await browser.close(); }
})().catch(e => { process.stderr.write(String(e.stack || e) + '\n'); process.exitCode = 1; });
