// Anonymous admin-content browser boundary in the disposable isolated network.
const fs = require('node:fs');
const { chromium } = require('playwright');
const batch = /^batch\d+$/.test(process.env.UAT_ADMIN_BATCH || '')
  ? process.env.UAT_ADMIN_BATCH : 'batch13';

(async () => {
  const browser = await chromium.launch({ headless: true,
    args: ['--no-sandbox', '--ignore-certificate-errors'] });
  const results = [];
  try {
    for (const width of [1280, 390]) {
      const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 800 },
        ignoreHTTPSErrors: true });
      const page = await context.newPage();
      const pageErrors = [];
      const consoleErrors = [];
      const contentRequests = [];
      page.on('pageerror', (error) => pageErrors.push(String(error.stack || error.message).slice(0, 1000)));
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 300));
      });
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.hostname === 'api.clyunedev.com' && url.pathname.includes('/content-commands')) {
          contentRequests.push({ method: request.method(), pathname: url.pathname });
        }
      });
      const response = await page.goto('https://admin.clyunedev.com/content',
        { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(850);
      const final = new URL(page.url());
      const layout = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        visibleTextLength: (document.body?.innerText || '').trim().length
      }));
      const screenshot = `admin-content-anonymous-${width}-${batch}.png`;
      await page.screenshot({ path: `/out/${screenshot}`, fullPage: true });
      results.push({ width, httpStatus: response?.status() ?? 0,
        finalUrl: page.url(), redirectedToLogin: final.pathname === '/login',
        contentWorkspaceCount: await page.locator('.content-workbench, .admin-content-view').count(),
        submitReviewButtonCount: await page.getByRole('button', { name: '提交双审' }).count(),
        contentRequests, layout, pageErrors, consoleErrors, screenshot });
      await context.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(`/out/admin-content-anonymous-${batch}.json`,
    `${JSON.stringify({ at: new Date().toISOString(),
      mode: 'private HTTPS + containerized Chromium; fresh anonymous contexts',
      results }, null, 2)}\n`);
  console.log(JSON.stringify({ widths: results.length,
    loginRedirects: results.filter((item) => item.redirectedToLogin).length,
    submitReviewButtons: results.reduce((sum, item) => sum + item.submitReviewButtonCount, 0),
    contentApiRequests: results.reduce((sum, item) => sum + item.contentRequests.length, 0),
    pageErrors: results.reduce((sum, item) => sum + item.pageErrors.length, 0),
    consoleErrors: results.reduce((sum, item) => sum + item.consoleErrors.length, 0) }));
})().catch((error) => {
  console.error(`Admin anonymous probe failed: ${String(error.message).slice(0, 220)}`);
  process.exitCode = 1;
});
