// Protected admin routes in the disposable private HTTPS stack.
const fs = require('node:fs');
const { chromium } = require('playwright');
const batch = /^batch(?:14|15)$/.test(process.env.UAT_ADMIN_BATCH || '')
  ? process.env.UAT_ADMIN_BATCH : 'batch14';

(async () => {
  const browser = await chromium.launch({ headless: true,
    args: ['--no-sandbox', '--ignore-certificate-errors'] });
  const results = [];
  try {
    for (const route of ['/governance', '/permissions']) {
      for (const width of [1280, 390]) {
        const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 800 },
          ignoreHTTPSErrors: true,
        });
        const page = await context.newPage();
        const pageErrors = [];
        const consoleErrors = [];
        const protectedRequests = [];
        page.on('pageerror', (error) => pageErrors.push(String(error.message).slice(0, 250)));
        page.on('console', (message) => {
          if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 250));
        });
        page.on('request', (request) => {
          const url = new URL(request.url());
          if (url.hostname === 'api.clyunedev.com'
            && (url.pathname.includes('/policy-versions') || url.pathname.includes('/moderation'))) {
            protectedRequests.push({ method: request.method(), path: url.pathname });
          }
        });
        const response = await page.goto(`https://admin.clyunedev.com${route}`,
          { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(850);
        const final = new URL(page.url());
        const layout = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        }));
        const screenshot = `admin-${route.slice(1)}-anonymous-${width}-${batch}.png`;
        await page.screenshot({ path: `/out/${screenshot}`, fullPage: true });
        results.push({ route, width, httpStatus: response?.status() ?? 0,
          redirectedToLogin: final.pathname === '/login',
          protectedViewCount: await page.locator('.policy-page, .b12-admin-view').count(),
          protectedRequests, layout, pageErrors, consoleErrors, screenshot });
        await context.close();
      }
    }
  } finally { await browser.close(); }
  fs.writeFileSync(`/out/admin-governance-permissions-anonymous-${batch}.json`,
    `${JSON.stringify({ at: new Date().toISOString(),
      mode: 'private HTTPS + containerized Chromium; fresh anonymous contexts',
      results }, null, 2)}\n`);
  const summary = { checks: results.length,
    loginRedirects: results.filter((item) => item.redirectedToLogin).length,
    protectedViews: results.reduce((sum, item) => sum + item.protectedViewCount, 0),
    protectedApiRequests: results.reduce((sum, item) => sum + item.protectedRequests.length, 0),
    horizontalOverflows: results.filter((item) => item.layout.scrollWidth > item.layout.viewportWidth).length,
    pageErrors: results.reduce((sum, item) => sum + item.pageErrors.length, 0),
    consoleErrors: results.reduce((sum, item) => sum + item.consoleErrors.length, 0) };
  console.log(JSON.stringify(summary));
})().catch((error) => {
  console.error(`Admin protected route probe failed: ${String(error.message).slice(0, 220)}`);
  process.exitCode = 1;
});
