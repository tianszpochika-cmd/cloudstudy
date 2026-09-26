// Browser journey on the disposable isolated Docker network. No cookies, storage,
// credentials or request bodies are read or written to the evidence file.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { chromium } = require('playwright');

const root = 'https://mobile.clyunedev.com/';
const steps = [];
let action = 'load mobile root';
const pageErrors = [];
const consoleErrors = [];
const authResponses = [];
const failedRequests = [];
const externalRequests = [];
const batch = /^batch\d+$/u.test(process.env.UAT_MOBILE_BATCH || '')
  ? process.env.UAT_MOBILE_BATCH : 'batch11';

function issue(error) {
  return {
    at: new Date().toISOString(), action, name: String(error?.name ?? ''),
    message: String(error?.message ?? '').slice(0, 300),
    stack: String(error?.stack ?? '').slice(0, 1000),
    keys: Object.keys(error ?? {}).map((key) => ({ key, type: typeof error[key] }))
  };
}

async function settle(page, expected) {
  await page.waitForURL((url) => url.hash.includes(expected), { timeout: 8000 });
  await page.waitForTimeout(400);
  return { at: new Date().toISOString(), action, url: page.url(),
    heading: (await page.locator('[role="heading"]').first().textContent())?.trim().slice(0, 100) ?? null };
}

(async () => {
  const browser = await chromium.launch({ headless: true,
    args: ['--no-sandbox', '--ignore-certificate-errors'] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 },
      ignoreHTTPSErrors: true });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__uatIssues = [];
      function capture(kind, reason) {
        const value = reason && typeof reason === 'object' ? reason : {};
        const primitive = (item) =>
          typeof item === 'string' || typeof item === 'number' ? String(item).slice(0, 300) : null;
        window.__uatIssues.push({ at: new Date().toISOString(), kind, url: location.href,
          reasonType: typeof reason, name: primitive(value.name),
          message: primitive(value.message), code: primitive(value.code),
          errMsg: primitive(value.errMsg),
          stack: primitive(value.stack)?.slice(0, 1000) ?? null,
          keys: Object.keys(value).map((key) => ({ key, type: typeof value[key] })) });
      }
      window.addEventListener('unhandledrejection', (event) => capture('unhandledrejection', event.reason));
      window.addEventListener('error', (event) => capture('error', event.error));
    });
    page.on('pageerror', (error) => pageErrors.push({ ...issue(error), url: page.url() }));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push({ at: new Date().toISOString(),
        action, url: page.url(), text: message.text().slice(0, 400) });
    });
    page.on('requestfailed', (request) => {
      const url = new URL(request.url());
      failedRequests.push({ at: new Date().toISOString(), action,
        hostname: url.hostname, pathname: url.pathname.slice(0, 120),
        failure: String(request.failure()?.errorText ?? '').slice(0, 160) });
    });
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.hostname === 'cdn.dcloud.net.cn') externalRequests.push({
        at: new Date().toISOString(), action, hostname: url.hostname,
        pathname: url.pathname.slice(0, 120) });
    });
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (url.hostname === 'api.clyunedev.com' && url.pathname === '/api/v1/auth/login') {
        authResponses.push({ at: new Date().toISOString(), action,
          method: response.request().method(), hostname: url.hostname,
          pathname: url.pathname, status: response.status() });
      }
    });

    const response = await page.goto(root, { waitUntil: 'domcontentloaded', timeout: 30000 });
    action = 'root automatic redirect, no click';
    steps.push({ ...(await settle(page, '/pages/login/login')),
      rootHttpStatus: response?.status() ?? 0 });
    await page.waitForTimeout(1200);
    const rootIssues = await page.evaluate(() => window.__uatIssues);

    action = 'click login to register';
    await page.locator('.mobile-auth-heading .mobile-text-button').click();
    steps.push(await settle(page, '/pages/register/register'));
    action = 'click register back to login';
    await page.locator('.mobile-auth-return').click();
    steps.push(await settle(page, '/pages/login/login'));
    action = 'click login to password reset';
    await page.locator('.mobile-auth-links .mobile-text-button').click();
    steps.push(await settle(page, '/pages/reset-password/reset-password'));
    action = 'click password reset back to login';
    await page.locator('.mobile-auth-return').click();
    steps.push(await settle(page, '/pages/login/login'));

    // This address cannot belong to a real user. Neither address nor password
    // is emitted to stdout, screenshots, or the evidence file.
    const identifier = `uat-${crypto.randomBytes(7).toString('hex')}@example.invalid`;
    const password = crypto.randomBytes(18).toString('base64url');
    action = 'submit nonexistent .invalid account to Gateway';
    await page.locator('.yx-login-card input').nth(0).fill(identifier);
    await page.locator('.yx-login-card input').nth(1).fill(password);
    await page.locator('.yx-login-card .yx-button').click();
    await page.waitForTimeout(1800);
    const errorText = await page.locator('[role="alert"]').allTextContents();
    steps.push({ at: new Date().toISOString(), action, url: page.url(),
      visibleErrors: errorText.map((value) => value.trim().slice(0, 200)),
      submittedToGateway: authResponses.length > 0 });

    const deepLinks = [];
    for (const deepPath of ['/pages/today/today', '/pages/settings/settings', '/pages/devices/devices']) {
      const deepContext = await browser.newContext({ viewport: { width: 390, height: 844 },
        ignoreHTTPSErrors: true });
      const deepPage = await deepContext.newPage();
      action = `load protected ${deepPath} deep link without a session`;
      deepPage.on('pageerror', (error) => pageErrors.push({ ...issue(error), url: deepPage.url() }));
      deepPage.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push({ at: new Date().toISOString(),
          action, url: deepPage.url(), text: message.text().slice(0, 400) });
      });
      deepPage.on('request', (request) => {
        const url = new URL(request.url());
        if (url.hostname === 'cdn.dcloud.net.cn') externalRequests.push({
          at: new Date().toISOString(), action, hostname: url.hostname,
          pathname: url.pathname.slice(0, 120) });
      });
      deepPage.on('requestfailed', (request) => {
        const url = new URL(request.url());
        failedRequests.push({ at: new Date().toISOString(), action,
          hostname: url.hostname, pathname: url.pathname.slice(0, 120),
          failure: String(request.failure()?.errorText ?? '').slice(0, 160) });
      });
      const deepResponse = await deepPage.goto(`${root}#${deepPath}`,
        { waitUntil: 'domcontentloaded', timeout: 30000 });
      try { await deepPage.waitForURL((url) => url.hash.includes('/pages/login/login'), { timeout: 8000 }); }
      catch { /* Keep the actual route in evidence even if the redirect fails. */ }
      await deepPage.waitForTimeout(1200);
      const deepHash = new URL(deepPage.url()).hash;
      const routeQuery = deepHash.includes('?') ? deepHash.slice(deepHash.indexOf('?') + 1) : '';
      const returnToParam = new URLSearchParams(routeQuery).get('returnTo');
      let restoredPath = returnToParam;
      let decodingDepth = 1;
      for (let attempt = 0; attempt < 2 && restoredPath?.startsWith('%'); attempt += 1) {
        try { restoredPath = decodeURIComponent(restoredPath); decodingDepth += 1; }
        catch { break; }
      }
      deepLinks.push({ at: new Date().toISOString(), requestedPath: deepPath,
        httpStatus: deepResponse?.status() ?? 0, finalUrl: deepPage.url(),
        returnToParam, restoredPath, decodingDepth,
        matchesRequestedPath: restoredPath === deepPath });
      await deepContext.close();
    }

    const evidence = { at: new Date().toISOString(),
      mode: 'private HTTPS + containerized Chromium; dummy .invalid login only',
      steps, deepLink: deepLinks[0], deepLinks, rootIssues, pageErrors, consoleErrors,
      authResponses, failedRequests, externalRequests };
    fs.writeFileSync(`/out/mobile-journey-${batch}.json`, `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(JSON.stringify({ steps: steps.length,
      rootIssues: rootIssues.length, pageErrors: pageErrors.length,
      consoleErrors: consoleErrors.length, authResponses, failedRequests,
      externalRequests, deepLinks,
      visibleErrors: steps.at(-1).visibleErrors }));
    await context.close();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`Mobile journey failed at ${action}: ${String(error.message).slice(0, 240)}`);
  process.exitCode = 1;
});
