const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const output = '/out';
const sites = [
  { name: 'official-site', url: 'https://clyunedev.com/' },
  { name: 'learner-web', url: 'https://learn.clyunedev.com/' },
  { name: 'admin-web', url: 'https://admin.clyunedev.com/' },
  { name: 'mobile-h5', url: 'https://mobile.clyunedev.com/' },
];
const loginRoutes = [
  { name: 'learner-login', url: 'https://learn.clyunedev.com/login', width: 1280 },
  { name: 'admin-login', url: 'https://admin.clyunedev.com/login', width: 1280 },
  { name: 'mobile-login', url: 'https://mobile.clyunedev.com/#/pages/login/login', width: 390 },
];
const officialHandoffs = [
  { name: 'official-login-handoff-desktop', width: 1280, expectedHost: 'learn.clyunedev.com', expectedPath: '/login' },
  { name: 'official-login-handoff-mobile', width: 390, expectedHost: 'mobile.clyunedev.com', expectedPath: '/pages/login/login' },
];
const deepLinks = [
  {
    name: 'learner-notification-settings-return-to',
    url: 'https://learn.clyunedev.com/settings/notifications?tab=in-app#preferences',
    width: 390,
    expected: '/settings/notifications?tab=in-app#preferences',
    storageKey: 'yx.auth.return-to',
  },
  {
    name: 'admin-permissions-return-to',
    url: 'https://admin.clyunedev.com/permissions?scope=roles',
    width: 1280,
    expected: '/permissions?scope=roles',
    storageKey: 'englishflow.admin.return-to',
  },
  {
    name: 'mobile-b12-social-protected-return-to',
    url: 'https://mobile.clyunedev.com/#/pages/b4-social/b4-social',
    width: 390,
    expected: '/pages/b4-social/b4-social',
    mobile: true,
  },
];
const preferenceHandoffs = [
  { name: 'official-web-register-en-dark', width: 1280, kind: 'register', host: 'learn.clyunedev.com', route: '/register', returnTo: '/home' },
  { name: 'official-web-login-en-dark', width: 1280, kind: 'login', host: 'learn.clyunedev.com', route: '/login', returnTo: '/home' },
  { name: 'official-mobile-register-en-dark', width: 390, kind: 'register', host: 'mobile.clyunedev.com', route: '/pages/register/register', returnTo: '/pages/home/home' },
  { name: 'official-mobile-login-en-dark', width: 390, kind: 'login', host: 'mobile.clyunedev.com', route: '/pages/login/login', returnTo: '/pages/home/home' },
];
const directPreferences = [
  { name: 'web-explicit-preference-over-saved', url: 'https://learn.clyunedev.com/login?uiLocale=en-US&theme=dark&returnTo=%2Fhome', valid: true },
  { name: 'mobile-explicit-preference-over-saved', url: 'https://mobile.clyunedev.com/#/pages/login/login?uiLocale=en-US&theme=dark&returnTo=%2Fpages%2Fhome%2Fhome', valid: true },
  { name: 'web-invalid-preference-fallback', url: 'https://learn.clyunedev.com/login?uiLocale=fr-FR&theme=sepia&returnTo=https%3A%2F%2Fevil.example%2F', valid: false },
  { name: 'mobile-invalid-preference-fallback', url: 'https://mobile.clyunedev.com/#/pages/login/login?uiLocale=fr-FR&theme=sepia&returnTo=https%3A%2F%2Fevil.example%2F', valid: false },
];
const resetFlows = [
  { name: 'web-reset-local-validation-en', url: 'https://learn.clyunedev.com/login?uiLocale=en-US&theme=dark', width: 1280,
    resetRoute: '/reset-password' },
  { name: 'mobile-reset-local-validation-en', url: 'https://mobile.clyunedev.com/#/pages/login/login?uiLocale=en-US&theme=dark', width: 390,
    resetRoute: '/pages/reset-password/reset-password' },
];
const results = [];

function observe(page) {
  const pageErrors = [];
  const failedRequests = [];
  page.on('pageerror', (error) => pageErrors.push(String(error.stack || error.message).slice(0, 1200)));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text().slice(0, 240));
  });
  page.on('requestfailed', (request) => {
    const url = new URL(request.url());
    failedRequests.push({
      hostname: url.hostname,
      pathname: url.pathname.slice(0, 120),
      failure: String(request.failure()?.errorText || '').slice(0, 140),
    });
  });
  return { pageErrors, failedRequests };
}

async function settleImages(page) {
  await page.evaluate(() => {
    for (const image of document.images) image.loading = 'eager';
  });
  await page.waitForTimeout(300);
}

async function captureLayout(page) {
  return page.evaluate(() => {
    const images = [...document.images];
    const viewportWidth = window.innerWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    const bodyScrollWidth = document.body?.scrollWidth || 0;
    return {
      title: document.title,
      scrollWidth,
      viewportWidth,
      bodyScrollWidth,
      horizontalOverflow: Math.max(scrollWidth, bodyScrollWidth) > viewportWidth + 1,
      visibleTextLength: (document.body?.innerText || '').trim().length,
      h1Count: document.querySelectorAll('h1').length,
      imageCount: images.length,
      brokenImages: images.filter((image) => image.complete && image.naturalWidth === 0).length,
    };
  });
}

async function checkGatewayCors(page) {
  try {
    return await page.evaluate(async () => {
      const response = await fetch('https://api.clyunedev.com/api/v1/auth/jwks', {
        signal: AbortSignal.timeout(8000),
      });
      return {
        status: response.status,
        contentType: response.headers.get('content-type'),
        allowOrigin: response.headers.get('access-control-allow-origin'),
      };
    });
  } catch (error) {
    return { error: String(error.message).slice(0, 180) };
  }
}

function mobileHashReturnTo(urlValue) {
  const hash = new URL(urlValue).hash.replace(/^#/, '');
  const separator = hash.indexOf('?');
  const route = separator < 0 ? hash : hash.slice(0, separator);
  const params = new URLSearchParams(separator < 0 ? '' : hash.slice(separator + 1));
  const encoded = params.get('returnTo');
  let restored = encoded;
  let decodingDepth = 0;
  for (let attempt = 0; attempt < 2 && restored?.startsWith('%'); attempt += 1) {
    try { restored = decodeURIComponent(restored); decodingDepth += 1; }
    catch { break; }
  }
  return { route, encoded, restored, decodingDepth };
}

async function waitForMobileReturnTo(page, expected) {
  await page.waitForFunction((target) => {
    const hash = window.location.hash.replace(/^#/, '');
    const separator = hash.indexOf('?');
    const route = separator < 0 ? hash : hash.slice(0, separator);
    const params = new URLSearchParams(separator < 0 ? '' : hash.slice(separator + 1));
    let returnTo = params.get('returnTo');
    for (let attempt = 0; attempt < 2 && returnTo?.startsWith('%'); attempt += 1) {
      try { returnTo = decodeURIComponent(returnTo); } catch { break; }
    }
    return route === '/pages/login/login' && returnTo === target;
  }, expected, { timeout: 15000 });
}

async function inspect(browser, name, url, width, options = {}) {
  const context = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 800 },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const { pageErrors, failedRequests } = observe(page);
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (options.mobileReturnTo) await waitForMobileReturnTo(page, options.expectedReturnTo);
    else if (options.expectedReturnTo) {
      await page.waitForFunction(({ expected, storageKey }) => {
        const current = new URL(window.location.href);
        return current.pathname === '/login'
          && current.searchParams.get('redirect') === expected
          && window.sessionStorage.getItem(storageKey) === expected;
      }, { expected: options.expectedReturnTo, storageKey: options.storageKey }, { timeout: 15000 });
    }
    await page.waitForTimeout(900);
    await settleImages(page);
    const layout = await captureLayout(page);
    const gatewayCors = await checkGatewayCors(page);
    const result = {
      name,
      width,
      url,
      status: response?.status() || 0,
      finalUrl: page.url(),
      layout,
      gatewayCors,
      pageErrors,
      failedRequests,
    };
    if (options.mobileReturnTo) {
      const route = mobileHashReturnTo(page.url());
      result.returnTo = { ...route, stored: await page.evaluate((key) => {
        try { return window.localStorage.getItem(key); } catch { return null; }
      }, 'yx.auth.mobile.return-to') };
      result.returnToPreserved = route.route === '/pages/login/login'
        && route.restored === options.expectedReturnTo;
    } else if (options.expectedReturnTo) {
      result.returnTo = await page.evaluate(({ storageKey }) => ({
        loginPath: new URL(window.location.href).pathname,
        query: new URL(window.location.href).searchParams.get('redirect'),
        stored: window.sessionStorage.getItem(storageKey),
      }), { storageKey: options.storageKey });
      result.returnToPreserved = result.returnTo.loginPath === '/login'
        && result.returnTo.query === options.expectedReturnTo
        && result.returnTo.stored === options.expectedReturnTo;
    }
    await page.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: true });
    results.push(result);
  } catch (error) {
    results.push({
      name,
      width,
      url,
      status: 0,
      error: String(error.message).slice(0, 280),
      pageErrors,
      failedRequests,
    });
  } finally {
    await context.close();
  }
}

async function inspectOfficialLoginHandoff(browser, handoff) {
  const context = await browser.newContext({
    viewport: { width: handoff.width, height: handoff.width === 390 ? 844 : 800 },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const { pageErrors, failedRequests } = observe(page);
  const url = 'https://clyunedev.com/';
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    let loginLink = page.locator('a.login-link');
    if (handoff.width <= 520 || !await loginLink.isVisible()) {
      await page.locator('button.menu-toggle').click();
      loginLink = page.locator('a.menu-login');
      await loginLink.waitFor({ state: 'visible', timeout: 5000 });
    }
    const href = await loginLink.getAttribute('href');
    if (!href) throw new Error('Official login link has no destination');
    const target = new URL(href, page.url());
    const response = await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
      loginLink.click(),
    ]).then(([navigation]) => navigation);
    await page.waitForTimeout(900);
    await settleImages(page);
    const layout = await captureLayout(page);
    const gatewayCors = await checkGatewayCors(page);
    const finalUrl = new URL(page.url());
    let loginPath = finalUrl.pathname;
    if (finalUrl.hostname === 'mobile.clyunedev.com') loginPath = mobileHashReturnTo(page.url()).route;
    const result = {
      name: handoff.name,
      width: handoff.width,
      url,
      sourceHref: href,
      targetUrl: page.url(),
      targetHost: target.hostname,
      finalHost: finalUrl.hostname,
      loginPath,
      status: response?.status() || 0,
      officialHandoffPreserved: target.hostname === handoff.expectedHost
        && finalUrl.hostname === handoff.expectedHost
        && loginPath === handoff.expectedPath,
      layout,
      gatewayCors,
      pageErrors,
      failedRequests,
    };
    await page.screenshot({ path: path.join(output, `${handoff.name}-${handoff.width}.png`), fullPage: true });
    results.push(result);
  } catch (error) {
    results.push({
      name: handoff.name,
      width: handoff.width,
      url,
      status: 0,
      error: String(error.message).slice(0, 280),
      pageErrors,
      failedRequests,
    });
  } finally {
    await context.close();
  }
}

function authDestination(url) {
  const parsed = new URL(url);
  if (parsed.hostname === 'mobile.clyunedev.com') {
    const hash = parsed.hash.replace(/^#/, '');
    const question = hash.indexOf('?');
    return { host: parsed.hostname, route: question < 0 ? hash : hash.slice(0, question),
      params: new URLSearchParams(question < 0 ? '' : hash.slice(question + 1)) };
  }
  return { host: parsed.hostname, route: parsed.pathname, params: parsed.searchParams };
}

async function inspectPreferenceHandoff(browser, handoff) {
  const context = await browser.newContext({ viewport: { width: handoff.width, height: handoff.width === 390 ? 844 : 800 },
    deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const { pageErrors, failedRequests } = observe(page);
  const sourceUrl = 'https://clyunedev.com/start?locale=en-US&theme=dark';
  try {
    await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const source = await page.evaluate(() => ({ lang: document.documentElement.lang,
      theme: document.documentElement.dataset.theme }));
    const link = handoff.kind === 'register' ? page.locator('[data-learning-entry]') : page.locator('.text-login a');
    await link.waitFor({ state: 'visible', timeout: 8000 });
    const href = await link.getAttribute('href');
    if (!href) throw new Error('official learning entry has no href');
    const navigation = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await link.click();
    const response = await navigation;
    await page.waitForTimeout(900);
    await settleImages(page);
    const destination = authDestination(page.url());
    const rendered = await page.evaluate(() => ({ lang: document.documentElement.lang,
      theme: document.documentElement.dataset.theme, text: document.body?.innerText || '',
      storedReturnTo: location.hostname === 'mobile.clyunedev.com'
        ? localStorage.getItem('yx.auth.mobile.return-to') : sessionStorage.getItem('yx.auth.return-to') }));
    const layout = await captureLayout(page);
    const gatewayCors = await checkGatewayCors(page);
    const englishForm = /\bAccount\b/u.test(rendered.text) && /\bPassword\b/u.test(rendered.text);
    const preferenceHandoffPassed = source.lang === 'en-US' && source.theme === 'dark'
      && destination.host === handoff.host && destination.route === handoff.route
      && destination.params.get('uiLocale') === 'en-US' && destination.params.get('theme') === 'dark'
      && destination.params.get('returnTo') === handoff.returnTo
      && rendered.lang === 'en-US' && rendered.theme === 'dark'
      && rendered.storedReturnTo === handoff.returnTo && englishForm;
    let registerLocalValidationPassed = null;
    let registerValidationText = null;
    if (handoff.kind === 'register') {
      await page.getByRole('button', { name: 'Create account and continue' }).click();
      registerValidationText = await page.getByRole('alert').innerText();
      registerLocalValidationPassed = registerValidationText.includes('Enter your account and password')
        && !registerValidationText.includes('temporarily unavailable');
    }
    results.push({ name: handoff.name, width: handoff.width, url: sourceUrl, source, sourceHref: href,
      finalUrl: page.url(), status: response?.status() || 0, preferenceHandoffPassed, englishForm,
      registerLocalValidationPassed, registerValidationText,
      rendered: { lang: rendered.lang, theme: rendered.theme, storedReturnTo: rendered.storedReturnTo },
      layout, gatewayCors, pageErrors, failedRequests });
    await page.screenshot({ path: path.join(output, `${handoff.name}-${handoff.width}.png`), fullPage: true });
  } catch (error) {
    results.push({ name: handoff.name, width: handoff.width, url: sourceUrl, status: 0,
      error: String(error.message).slice(0, 280), pageErrors, failedRequests });
  } finally { await context.close(); }
}

async function inspectDirectPreference(browser, sample) {
  const width = sample.url.includes('mobile.clyunedev.com') ? 390 : 1280;
  const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 800 },
    deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  if (sample.valid) await context.addInitScript(() => {
    localStorage.setItem('ef.ui-locale', 'zh-CN');
    localStorage.setItem('ef.theme', 'light');
  });
  const page = await context.newPage();
  const { pageErrors, failedRequests } = observe(page);
  try {
    const response = await page.goto(sample.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(900);
    await settleImages(page);
    const rendered = await page.evaluate(() => ({ lang: document.documentElement.lang,
      theme: document.documentElement.dataset.theme, text: document.body?.innerText || '',
      storedReturnTo: location.hostname === 'mobile.clyunedev.com'
        ? localStorage.getItem('yx.auth.mobile.return-to') : sessionStorage.getItem('yx.auth.return-to') }));
    const directPreferencePassed = sample.valid
      ? rendered.lang === 'en-US' && rendered.theme === 'dark'
        && /\bAccount\b/u.test(rendered.text) && /\bPassword\b/u.test(rendered.text)
      : rendered.lang === 'zh-CN' && rendered.theme !== 'sepia'
        && !String(rendered.storedReturnTo || '').includes('evil.example');
    const layout = await captureLayout(page);
    const gatewayCors = await checkGatewayCors(page);
    results.push({ name: sample.name, width, url: sample.url, finalUrl: page.url(),
      status: response?.status() || 0, directPreferencePassed,
      rendered: { lang: rendered.lang, theme: rendered.theme, storedReturnTo: rendered.storedReturnTo },
      layout, gatewayCors, pageErrors, failedRequests });
    await page.screenshot({ path: path.join(output, `${sample.name}-${width}.png`), fullPage: true });
  } catch (error) {
    results.push({ name: sample.name, width, url: sample.url, status: 0,
      error: String(error.message).slice(0, 280), pageErrors, failedRequests });
  } finally { await context.close(); }
}

async function inspectResetFlow(browser, sample) {
  const context = await browser.newContext({ viewport: { width: sample.width, height: sample.width === 390 ? 844 : 800 },
    deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const { pageErrors, failedRequests } = observe(page);
  try {
    const response = await page.goto(sample.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(900);
    if (sample.width === 390) await page.getByRole('button', { name: /Forgot password/i }).click();
    else await page.locator('a[href*="reset-password"]').click();
    await page.waitForFunction((route) => {
      const hash = location.hash.replace(/^#/, '').split('?', 1)[0];
      return location.pathname === route || hash === route;
    }, sample.resetRoute, { timeout: 15000 });
    await settleImages(page);
    const layout = await captureLayout(page);
    const gatewayCors = await checkGatewayCors(page);
    const renderedLang = await page.evaluate(() => document.documentElement.lang);
    await page.screenshot({ path: path.join(output, `${sample.name}-${sample.width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Send reset instructions' }).click();
    const requestError = await page.getByRole('alert').innerText();
    await page.getByRole('button', { name: 'I have the reset code' }).click();
    await page.getByRole('button', { name: 'Reset password' }).click();
    const confirmError = await page.getByRole('alert').innerText();
    const resetLocalValidationPassed = renderedLang === 'en-US'
      && requestError.includes('Enter your account')
      && confirmError.includes('Enter your account')
      && confirmError.includes('reset code')
      && confirmError.includes('new password');
    results.push({ name: sample.name, width: sample.width, url: sample.url, finalUrl: page.url(),
      status: response?.status() || 0, renderedLang, resetLocalValidationPassed,
      requestError, confirmError, layout, gatewayCors, pageErrors, failedRequests });
  } catch (error) {
    results.push({ name: sample.name, width: sample.width, url: sample.url, status: 0,
      error: String(error.message).slice(0, 280), pageErrors, failedRequests });
  } finally { await context.close(); }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--ignore-certificate-errors'] });
  try {
    for (const site of sites) {
      await inspect(browser, site.name, site.url, 1280);
      await inspect(browser, site.name, site.url, 390);
    }
    for (const login of loginRoutes) await inspect(browser, login.name, login.url, login.width);
    for (const handoff of officialHandoffs) await inspectOfficialLoginHandoff(browser, handoff);
    for (const deepLink of deepLinks) {
      await inspect(browser, deepLink.name, deepLink.url, deepLink.width, {
        expectedReturnTo: deepLink.expected,
        mobileReturnTo: deepLink.mobile,
        storageKey: deepLink.storageKey,
      });
    }
    for (const handoff of preferenceHandoffs) await inspectPreferenceHandoff(browser, handoff);
    for (const sample of directPreferences) await inspectDirectPreference(browser, sample);
    for (const sample of resetFlows) await inspectResetFlow(browser, sample);
  } finally {
    await browser.close();
  }
  const evidence = {
    at: new Date().toISOString(),
    mode: 'private Docker HTTPS proxy + containerized Chromium; anonymous only; read-only routes',
    batch: 23,
    results,
  };
  fs.writeFileSync(path.join(output, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  const summary = {
    checks: results.length,
    pageSamples: results.length - deepLinks.length,
    anonymousReturnToChecks: deepLinks.length,
    officialLoginHandoffsPassed: results.filter((result) => result.officialHandoffPreserved === true).length,
    officialLoginHandoffChecks: officialHandoffs.length,
    http200: results.filter((result) => result.status === 200).length,
    jwksCors200: results.filter((result) => result.gatewayCors?.status === 200).length,
    pageErrors: results.reduce((total, result) => total + (result.pageErrors?.length || 0), 0),
    failedRequests: results.reduce((total, result) => total + (result.failedRequests?.length || 0), 0),
    horizontalOverflow: results.filter((result) => result.layout?.horizontalOverflow === true).length,
    brokenImages: results.reduce((total, result) => total + (result.layout?.brokenImages || 0), 0),
    returnToChecksPassed: results.filter((result) => result.returnToPreserved === true).length,
    returnToChecks: deepLinks.length,
    mobileB12ProtectedChecks: results.filter((result) => result.name === 'mobile-b12-social-protected-return-to').length,
    preferenceHandoffPassed: results.filter((result) => result.preferenceHandoffPassed === true).length,
    preferenceHandoffChecks: preferenceHandoffs.length,
    registerLocalValidationPassed: results.filter((result) => result.registerLocalValidationPassed === true).length,
    registerLocalValidationChecks: preferenceHandoffs.filter((handoff) => handoff.kind === 'register').length,
    directPreferencePassed: results.filter((result) => result.directPreferencePassed === true).length,
    directPreferenceChecks: directPreferences.length,
    resetLocalValidationPassed: results.filter((result) => result.resetLocalValidationPassed === true).length,
    resetLocalValidationChecks: resetFlows.length,
  };
  fs.writeFileSync(path.join(output, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary));
})().catch((error) => {
  console.error(`Browser probe failed: ${String(error.message).slice(0, 220)}`);
  process.exitCode = 1;
});
