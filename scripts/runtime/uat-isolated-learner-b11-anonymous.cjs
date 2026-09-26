// Anonymous B11 route boundary in the disposable isolated HTTPS browser.
// Fresh contexts contain no account, cookies or client storage state.
const fs = require('node:fs');
const { chromium } = require('playwright');

const routes = ['/listening', '/reading', '/reader', '/speaking', '/clips', '/recording'];
const batch = /^batch\d+$/u.test(process.env.UAT_LEARNER_BATCH || '')
  ? process.env.UAT_LEARNER_BATCH : 'batch12';

(async () => {
  const browser = await chromium.launch({ headless: true,
    args: ['--no-sandbox', '--ignore-certificate-errors'] });
  const results = [];
  try {
    for (const width of [1280, 390]) {
      for (const route of routes) {
        if (width === 390 && !['/listening', '/reading', '/speaking'].includes(route)) continue;
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 800 },
          ignoreHTTPSErrors: true });
        const page = await context.newPage();
        const pageErrors = [];
        const consoleErrors = [];
        const apiRequests = [];
        page.on('pageerror', (error) => pageErrors.push(String(error.stack || error.message).slice(0, 1000)));
        page.on('console', (message) => {
          if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 300));
        });
        page.on('request', (request) => {
          const url = new URL(request.url());
          if (url.hostname === 'api.clyunedev.com') apiRequests.push({
            method: request.method(), pathname: url.pathname.slice(0, 120) });
        });
        const response = await page.goto(`https://learn.clyunedev.com${route}`,
          { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(700);
        const final = new URL(page.url());
        const layout = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
          visibleTextLength: (document.body?.innerText || '').trim().length
        }));
        const item = { route, width, httpStatus: response?.status() ?? 0,
          finalUrl: page.url(), redirectParam: final.searchParams.get('redirect'),
          onLogin: final.pathname === '/login',
          loginFormVisible: await page.locator('.login-form').isVisible(),
          b11PageCount: await page.locator('.b11-page').count(),
          protectedControlsCount: await page.locator('audio, video, textarea, .player-controls, .reading-layout, .speaking-layout').count(),
          layout, apiRequests, pageErrors, consoleErrors };
        if (route === '/listening') {
          const screenshot = `/out/learner-b11-anonymous-${width}-${batch}.png`;
          await page.screenshot({ path: screenshot, fullPage: true });
          item.screenshot = screenshot.split('/').at(-1);
        }
        results.push(item);
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  const evidence = { at: new Date().toISOString(),
    mode: 'private HTTPS + containerized Chromium; fresh anonymous browser contexts',
    results };
  fs.writeFileSync(`/out/learner-b11-anonymous-${batch}.json`, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ routes: results.length,
    http200: results.filter((item) => item.httpStatus === 200).length,
    loginRedirects: results.filter((item) => item.onLogin && item.redirectParam === item.route).length,
    protectedControls: results.reduce((count, item) => count + item.protectedControlsCount, 0),
    b11Pages: results.reduce((count, item) => count + item.b11PageCount, 0),
    pageErrors: results.reduce((count, item) => count + item.pageErrors.length, 0),
    consoleErrors: results.reduce((count, item) => count + item.consoleErrors.length, 0) }));
})().catch((error) => {
  console.error(`Anonymous B11 probe failed: ${String(error.message).slice(0, 220)}`);
  process.exitCode = 1;
});
