// Runs only in a disposable Playwright container on the isolated Docker network.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const sites = [
  { name: 'official-site', url: 'https://clyunedev.com/' },
  { name: 'learner-web', url: 'https://learn.clyunedev.com/' },
  { name: 'admin-web', url: 'https://admin.clyunedev.com/' },
  { name: 'mobile-h5', url: 'https://mobile.clyunedev.com/' }
];
const loginRoutes = [
  { name: 'learner-login', url: 'https://learn.clyunedev.com/login', width: 1280 },
  { name: 'admin-login', url: 'https://admin.clyunedev.com/login', width: 1280 },
  { name: 'mobile-login', url: 'https://mobile.clyunedev.com/#/pages/login/login', width: 390 }
];
const output = '/out';
const results = [];

async function inspect(browser, name, url, width) {
  const context = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 800 },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true
  });
  const page = await context.newPage();
  const errors = [];
  const failedRequests = [];
  page.on('pageerror', (error) => errors.push(String(error.stack || error.message).slice(0, 1200)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text().slice(0, 180));
  });
  page.on('requestfailed', (request) => failedRequests.push({
    hostname: new URL(request.url()).hostname,
    pathname: new URL(request.url()).pathname.slice(0, 100),
    failure: String(request.failure()?.errorText || '').slice(0, 120)
  }));
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1300);
    const layout = await page.evaluate(() => ({
      title: document.title,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      visibleTextLength: (document.body?.innerText || '').trim().length
    }));
    let cors;
    try {
      cors = await page.evaluate(async () => {
        const result = await fetch('https://api.clyunedev.com/api/v1/auth/jwks', { signal: AbortSignal.timeout(8000) });
        return { status: result.status, contentType: result.headers.get('content-type') };
      });
    } catch (error) {
      cors = { error: String(error.message).slice(0, 160) };
    }
    await page.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: true });
    results.push({ name, width, url, status: response?.status() || 0, finalUrl: page.url(), layout,
      gatewayCors: cors, pageErrors: errors, failedRequests });
  } catch (error) {
    results.push({ name, width, url, status: 0, error: String(error.message).slice(0, 220),
      pageErrors: errors, failedRequests });
  } finally {
    await context.close();
  }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  // The proxy uses a one-day disposable self-signed cert; real TLS is trusted by the browser.
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--ignore-certificate-errors'] });
  try {
    for (const site of sites) {
      await inspect(browser, site.name, site.url, 1280);
      await inspect(browser, site.name, site.url, 390);
    }
    for (const login of loginRoutes) await inspect(browser, login.name, login.url, login.width);
  } finally {
    await browser.close();
  }
  const evidence = { at: new Date().toISOString(), mode: 'private Docker HTTPS proxy + containerized Chromium', results };
  fs.writeFileSync(path.join(output, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ checks: results.length, http200: results.filter((r) => r.status === 200).length,
    gatewayCors200: results.filter((r) => r.gatewayCors?.status === 200).length,
    pageErrors: results.reduce((total, r) => total + r.pageErrors.length, 0) }));
})().catch((error) => {
  console.error(`Browser probe failed: ${String(error.message).slice(0, 180)}`);
  process.exitCode = 1;
});
