// Anonymous public and management checks inside the private Docker network.
const fs = require('node:fs');
const { chromium } = require('playwright');

const out = '/out';
const batch = /^batch\d+$/.test(process.env.UAT_BATCH || '') ? process.env.UAT_BATCH : 'batch15';
const result = { at: new Date().toISOString(), scope: `${batch} private Docker; anonymous only`,
  projection: [], gateway: [], browser: [] };

async function readJson(response) {
  try { return await response.json(); } catch { return null; }
}

async function inspectProjection(locale) {
  const response = await fetch(`http://official-site:18182/api/public-projection?locale=${locale}`,
    { signal: AbortSignal.timeout(10000) });
  const data = await readJson(response);
  result.projection.push({ locale, status: response.status,
    state: data?.state ?? null, source: data?.source ?? null,
    stale: data?.stale ?? null, errorCode: data?.errorCode ?? null,
    courseCount: Array.isArray(data?.projection?.courses) ? data.projection.courses.length : null,
    headers: {
      source: response.headers.get('x-public-projection-source'),
      commerce: response.headers.get('x-public-projection-commerce'),
      cacheControl: response.headers.get('cache-control')
    } });
}

async function inspectGateway(name, method, route, base = 'http://api-gateway:18070') {
  const response = await fetch(`${base}${route}`,
    { method, signal: AbortSignal.timeout(10000) });
  const data = await readJson(response);
  result.gateway.push({ name, method, route, target: base.includes('social-service')
    ? 'social-owner' : 'api-gateway', status: response.status,
    errorCode: data?.error?.code ?? data?.error?.errorCode ?? data?.code ?? null,
    itemCount: Array.isArray(data?.data?.items) ? data.data.items.length : null });
}

async function inspectPage(browser, name, url, width) {
  const context = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 800 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const protectedRequests = [];
  page.on('pageerror', (error) => pageErrors.push(String(error.stack || error.message).slice(0, 700)));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 250));
  });
  page.on('request', (request) => {
    const requested = new URL(request.url());
    if (requested.hostname === 'api.clyunedev.com'
      && requested.pathname.includes('/moderation/reports')) {
      protectedRequests.push({ method: request.method(), path: requested.pathname });
    }
  });
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1200);
    const location = new URL(page.url());
    const layout = await page.evaluate(() => ({
      title: document.title,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      visibleTextLength: (document.body?.innerText || '').trim().length
    }));
    const screenshot = `${name}-${width}-${batch}.png`;
    await page.screenshot({ path: `${out}/${screenshot}`, fullPage: true });
    result.browser.push({ name, width, initialStatus: response?.status() ?? 0,
      finalPath: location.pathname, finalQueryKeys: [...location.searchParams.keys()],
      loginRedirectTarget: location.searchParams.get('redirect'),
      protectedRequests, layout, pageErrors, consoleErrors, screenshot });
  } catch (error) {
    result.browser.push({ name, width, error: String(error.message).slice(0, 300),
      protectedRequests, pageErrors, consoleErrors });
  } finally { await context.close(); }
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  for (const locale of ['zh-CN', 'en-US']) await inspectProjection(locale);
  await inspectGateway('moderation-list', 'GET',
    '/api/v1/admin/moderation/reports?status=OPEN&pageSize=20');
  await inspectGateway('moderation-command', 'POST',
    '/api/v1/admin/moderation/reports/synthetic-id/commands');
  await inspectGateway('owner-moderation-list', 'GET',
    '/internal/v1/social/admin/moderation/reports?status=OPEN&pageSize=20',
    'http://social-service:18095');
  await inspectGateway('owner-moderation-command', 'POST',
    '/internal/v1/social/admin/moderation/reports/synthetic-id/commands',
    'http://social-service:18095');
  const browser = await chromium.launch({ headless: true,
    args: ['--no-sandbox', '--ignore-certificate-errors'] });
  try {
    for (const width of [1280, 390]) {
      await inspectPage(browser, 'official-courses', 'https://clyunedev.com/courses', width);
      await inspectPage(browser, 'admin-governance-anonymous',
        'https://admin.clyunedev.com/governance', width);
    }
  } finally { await browser.close(); }
  fs.writeFileSync(`${out}/${batch}-public-governance.json`, `${JSON.stringify(result, null, 2)}\n`);
  const summary = { projections: result.projection.length,
    projectionGateway: result.projection.filter((item) => item.status === 200
      && item.source === 'gateway' && item.headers.source === 'gateway').length,
    gateway: result.gateway.map((item) => `${item.name}:${item.status}:${item.errorCode}`),
    browserPages: result.browser.length,
    browserErrors: result.browser.reduce((count, item) =>
      count + item.pageErrors.length + item.consoleErrors.length, 0),
    overflows: result.browser.filter((item) => item.layout
      && item.layout.scrollWidth > item.layout.viewportWidth).length };
  console.log(JSON.stringify(summary));
  if (summary.projectionGateway !== 2 || result.gateway[0].status !== 401
    || result.gateway[1].status !== 404 || result.gateway[2].status !== 401
    || result.gateway[3].status !== 401 || summary.browserErrors > 0
    || summary.overflows > 0 || result.browser.some((item) => item.error)) process.exitCode = 2;
})().catch((error) => {
  console.error(`Batch15 public/governance probe failed: ${String(error.message).slice(0, 180)}`);
  process.exitCode = 1;
});
