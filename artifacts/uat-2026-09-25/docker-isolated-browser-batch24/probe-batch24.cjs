const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const output = '/out';
const base = {
  official: 'https://clyunedev.com',
  learner: 'https://learn.clyunedev.com',
  admin: 'https://admin.clyunedev.com',
  mobile: 'https://mobile.clyunedev.com',
};
const pages = [
  ['official-home', `${base.official}/`, 1280],
  ['official-home', `${base.official}/`, 390],
  ['official-start', `${base.official}/start`, 1280],
  ['official-start', `${base.official}/start`, 390],
  ['official-courses', `${base.official}/courses`, 1280],
  ['official-courses', `${base.official}/courses`, 390],
  ['official-help', `${base.official}/help`, 390],
  ['official-status', `${base.official}/status`, 390],
  ['learner-login', `${base.learner}/login`, 1280],
  ['learner-login', `${base.learner}/login`, 390],
  ['learner-register-en-dark', `${base.learner}/register?uiLocale=en-US&theme=dark`, 1280],
  ['learner-register-en-dark', `${base.learner}/register?uiLocale=en-US&theme=dark`, 390],
  ['learner-reset-en-dark', `${base.learner}/reset-password?uiLocale=en-US&theme=dark`, 1280],
  ['admin-login', `${base.admin}/login`, 1280],
  ['admin-login', `${base.admin}/login`, 390],
  ['mobile-login', `${base.mobile}/#/pages/login/login`, 390],
  ['mobile-register-en-dark', `${base.mobile}/#/pages/register/register?uiLocale=en-US&theme=dark`, 390],
  ['mobile-reset-en-dark', `${base.mobile}/#/pages/reset-password/reset-password?uiLocale=en-US&theme=dark`, 390],
];
const results = [];

function observe(page) {
  const pageErrors = [];
  const failedRequests = [];
  page.on('pageerror', error => pageErrors.push(String(error.message).slice(0, 300)));
  page.on('requestfailed', request => {
    const url = new URL(request.url());
    failedRequests.push({ host: url.hostname, path: url.pathname.slice(0, 100),
      failure: String(request.failure()?.errorText || '').slice(0, 100) });
  });
  return { pageErrors, failedRequests };
}

async function layout(page) {
  await page.evaluate(() => { for (const image of document.images) image.loading = 'eager'; });
  await page.waitForTimeout(250);
  return page.evaluate(() => ({
    title: document.title,
    lang: document.documentElement.lang,
    theme: document.documentElement.dataset.theme || '',
    viewportWidth: innerWidth,
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0),
    horizontalOverflow: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0) > innerWidth + 1,
    brokenImages: [...document.images].filter(image => image.complete && image.naturalWidth === 0).length,
    visibleTextLength: (document.body?.innerText || '').trim().length,
  }));
}

async function gatewayCors(page) {
  try {
    return await page.evaluate(async () => {
      const response = await fetch('https://api.clyunedev.com/api/v1/auth/jwks', {
        signal: AbortSignal.timeout(8000),
      });
      return { status: response.status, allowOrigin: response.headers.get('access-control-allow-origin') };
    });
  } catch (error) { return { error: String(error.message).slice(0, 120) }; }
}

async function newPage(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 800 },
    deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  return { context, page: await context.newPage() };
}

async function inspect(browser, name, url, width) {
  const { context, page } = await newPage(browser, width);
  const events = observe(page);
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(650);
    const metrics = await layout(page);
    const content = await page.locator('body').innerText();
    const result = { name, width, url, finalUrl: page.url(), status: response?.status() || 0,
      layout: metrics, brandVisible: /语学星/.test(content),
      gatewayCors: await gatewayCors(page),
      accountUnavailableVisible: name.startsWith('official-') ? /学习账号.{0,8}(暂不可用|暂未开放)/.test(content) : null,
      heroExampleMarker: name === 'official-home' ? await page.locator('.hero-plan').innerText().then(text => /界面示意/.test(text)) : null,
      directOfficialAuthLinks: name.startsWith('official-') ? await page.locator('a[href*="learn.clyunedev.com/login"], a[href*="mobile.clyunedev.com/#/pages/login/login"], a[href*="learn.clyunedev.com/register"], a[href*="mobile.clyunedev.com/#/pages/register/register"]').count() : null,
      ...events };
    await page.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: true });
    results.push(result);
  } catch (error) {
    results.push({ name, width, url, status: 0, error: String(error.message).slice(0, 250), ...events });
  } finally { await context.close(); }
}

async function officialJourney(browser, width) {
  const { context, page } = await newPage(browser, width);
  const events = observe(page);
  const name = `official-start-to-example-${width}`;
  try {
    await page.goto(`${base.official}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (width === 390) {
      await page.locator('button.menu-toggle').click();
      const menu = page.locator('.mobile-nav-bottom');
      await menu.waitFor({ state: 'visible' });
      if (await menu.locator('a[href*="login"], a[href*="register"]').count()) throw new Error('mobile menu still advertises unavailable auth');
      await page.keyboard.press('Escape');
    }
    await page.locator('[data-primary]').click();
    await page.waitForURL('**/start', { timeout: 12000 });
    const statusText = await page.locator('body').innerText();
    const sampleLink = page.locator('[data-sample-entry]');
    const sampleHref = await sampleLink.getAttribute('href');
    await sampleLink.click();
    await page.waitForURL('**/#practice-example', { timeout: 12000 });
    const result = { name, width, status: 200, finalUrl: page.url(),
      statusCopyVisible: /学习账号.{0,8}(暂不可用|暂未开放)/.test(statusText),
      sampleHref, reachedPublicExample: page.url().endsWith('/#practice-example'),
      layout: await layout(page), ...events };
    await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
    results.push(result);
  } catch (error) {
    results.push({ name, width, status: 0, error: String(error.message).slice(0, 250), ...events });
  } finally { await context.close(); }
}

async function simulatedAuthUnavailable(browser, kind, action) {
  const mobile = kind === 'mobile';
  const width = mobile ? 390 : 1280;
  const site = mobile ? base.mobile : base.learner;
  const route = mobile ? `/#/pages/${action}/${action}` : `/${action}`;
  const name = `${kind}-${action}-unavailable-copy`;
  const { context, page } = await newPage(browser, width);
  const events = observe(page);
  let intercepted = 0;
  try {
    await page.route(url => url.hostname === 'api.clyunedev.com' && url.pathname === `/api/v1/auth/${action}`, async route => {
      const request = route.request();
      const origin = request.headers().origin || site;
      const headers = { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': request.headers()['access-control-request-headers'] || 'content-type,idempotency-key',
        'content-type': 'application/json' };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers, body: '' });
      intercepted += 1;
      return route.fulfill({ status: 503, headers, body: JSON.stringify({ error: {
        code: 'iam.consent.version_unavailable', message: 'iam.consent.version_unavailable',
      } }) });
    });
    await page.goto(`${site}${route}${mobile ? '?uiLocale=en-US&theme=dark' : '?uiLocale=en-US&theme=dark'}`,
      { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(750);
    const account = 'uat-unavailable@example.invalid';
    if (mobile) {
      // uni-app H5 places autocomplete/placeholder on its wrapper and renders plain nested inputs.
      await page.locator('input').nth(0).fill(account);
      await page.locator('input').nth(1).fill('NeverSubmit123!');
      if (action === 'register') await page.locator('input').nth(2).fill('NeverSubmit123!');
    } else {
      await page.locator('input[autocomplete="username"]').fill(account);
      await page.locator('input[autocomplete="current-password"], input[autocomplete="new-password"]').first().fill('NeverSubmit123!');
      if (action === 'register') await page.locator('input[autocomplete="new-password"]').last().fill('NeverSubmit123!');
    }
    await page.getByRole('button', { name: action === 'register' ? 'Create account and continue' : 'Sign in and continue' }).click();
    await page.getByRole('alert').waitFor({ state: 'visible', timeout: 12000 });
    const rendered = await page.getByRole('alert').innerText();
    const expected = action === 'register' ? 'Registration is not available yet.' : 'Account access is temporarily unavailable.';
    const result = { name, width, status: 200, intercepted,
      conciseKnownFailure: intercepted === 1 && rendered.includes(expected)
        && !rendered.includes('iam.consent') && !rendered.includes('HTTP 503'),
      alertText: rendered.slice(0, 240), layout: await layout(page), ...events };
    await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
    results.push(result);
  } catch (error) {
    results.push({ name, width, status: 0, intercepted, error: String(error.message).slice(0, 250), ...events });
  } finally { await context.close(); }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--ignore-certificate-errors'] });
  try {
    for (const [name, url, width] of pages) await inspect(browser, name, url, width);
    for (const width of [1280, 390]) await officialJourney(browser, width);
    for (const kind of ['learner', 'mobile']) for (const action of ['login', 'register']) {
      await simulatedAuthUnavailable(browser, kind, action);
    }
  } finally { await browser.close(); }
  const summary = {
    checks: results.length,
    http200: results.filter(result => result.status === 200).length,
    jwksCors200: results.filter(result => result.gatewayCors?.status === 200).length,
    pageErrors: results.reduce((n, result) => n + (result.pageErrors?.length || 0), 0),
    failedRequests: results.reduce((n, result) => n + (result.failedRequests?.length || 0), 0),
    overflow: results.filter(result => result.layout?.horizontalOverflow).length,
    brokenImages: results.reduce((n, result) => n + (result.layout?.brokenImages || 0), 0),
    officialUnavailableCopy: results.filter(result => result.accountUnavailableVisible === true).length,
    officialDirectAuthLinks: results.reduce((n, result) => n + (result.directOfficialAuthLinks || 0), 0),
    officialHeroExampleMarkers: results.filter(result => result.heroExampleMarker === true).length,
    officialJourneyPassed: results.filter(result => result.reachedPublicExample && result.statusCopyVisible).length,
    simulatedAuthCopyPassed: results.filter(result => result.conciseKnownFailure === true).length,
    simulatedAuthCopyChecks: 4,
  };
  fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify({ batch: 24, mode: 'private HTTPS, browser UI, synthetic auth failures intercepted before network', results }, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary));
  if (summary.checks !== pages.length + 6 || summary.http200 !== summary.checks || summary.jwksCors200 !== pages.length || summary.pageErrors || summary.failedRequests
    || summary.overflow || summary.brokenImages || summary.officialDirectAuthLinks || summary.officialHeroExampleMarkers !== 2
    || summary.officialJourneyPassed !== 2 || summary.simulatedAuthCopyPassed !== 4) process.exitCode = 1;
})().catch(error => { console.error(String(error.message).slice(0, 220)); process.exitCode = 1; });
