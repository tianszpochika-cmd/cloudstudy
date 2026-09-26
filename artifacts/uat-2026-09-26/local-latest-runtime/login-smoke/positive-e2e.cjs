const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const outDir = path.resolve('artifacts/uat-2026-09-26/local-latest-runtime/login-smoke');
const syntheticIdentifier = 'codex-' + crypto.randomBytes(10).toString('hex') + '@local.invalid';
const syntheticPassword = 'Invalid-' + crypto.randomBytes(18).toString('base64url') + '!';

function observe(page) {
  const responses = [];
  const errors = [];
  page.on('response', response => {
    if (new URL(response.url()).pathname.startsWith('/api/v1/')) {
      responses.push({ path: new URL(response.url()).pathname, status: response.status() });
    }
  });
  page.on('pageerror', error => errors.push(String(error.message).slice(0, 180)));
  page.on('console', message => {
    if (message.type() === 'error') {
      const location = message.location()?.url ?? '';
      errors.push(message.text().slice(0, 140) + (location ? ' [' + new URL(location).pathname + ']' : ''));
    }
  });
  return { responses, errors };
}

async function snapshot(page) {
  return page.evaluate(() => ({
    url: location.pathname + location.search + location.hash,
    title: document.title,
    headings: [...document.querySelectorAll('h1,h2')].map(el => el.innerText.trim()).filter(Boolean).slice(0, 8),
    alert: [...document.querySelectorAll('[role=alert]')].map(el => el.innerText.trim()).filter(Boolean).join(' ').slice(0, 300),
    bodyText: (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 1000)
  }));
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
    args: ['--no-sandbox']
  });
  const result = { generatedAt: new Date().toISOString(), scope: 'Synthetic local account only; credentials omitted. Adult identity and consent were not submitted.', registration: null, webRelogin: null, mobileLogin: null };

  try {
    const firstContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const registerPage = await firstContext.newPage();
    const registerObs = observe(registerPage);
    await registerPage.goto('http://127.0.0.1:18180/register?redirect=%2Fhome', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await registerPage.waitForTimeout(900);
    await registerPage.locator('input[autocomplete="username"]').fill(syntheticIdentifier);
    await registerPage.locator('input[name="password"]').fill(syntheticPassword);
    await registerPage.locator('input[name="confirm"]').fill(syntheticPassword);
    await registerPage.locator('form button[type="submit"]').click();
    await registerPage.waitForFunction(() => location.pathname === '/onboarding' || Boolean(document.querySelector('[role="alert"]')), null, { timeout: 20000 }).catch(() => {});
    await registerPage.waitForTimeout(1200);
    const registerView = await snapshot(registerPage);
    const registered = registerView.url.startsWith('/onboarding');
    result.registration = { succeeded: registered, status: registerObs.responses.find(x => x.path === '/api/v1/auth/register')?.status ?? null, view: registerView, apiResponses: registerObs.responses, browserErrors: registerObs.errors };
    if (registered) await registerPage.screenshot({ path: path.join(outDir, 'learner-register-onboarding.png'), fullPage: true });
    let webLogout = null;
    if (registered) {
      await registerPage.getByRole('button', { name: '退出登录' }).click({ timeout: 5000 });
      await registerPage.waitForFunction(() => location.pathname === '/login', null, { timeout: 12000 }).catch(() => {});
      webLogout = { finalUrl: new URL(registerPage.url()).pathname, status: registerObs.responses.findLast(x => x.path === '/api/v1/auth/logout')?.status ?? null };
    }
    result.registration.logout = webLogout;
    await firstContext.close();

    if (registered) {
      const webContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const webPage = await webContext.newPage();
      const webObs = observe(webPage);
      await webPage.goto('http://127.0.0.1:18180/login?redirect=%2Fhome', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await webPage.locator('input[autocomplete="username"]').fill(syntheticIdentifier);
      await webPage.locator('input[autocomplete="current-password"]').fill(syntheticPassword);
      await webPage.locator('form button[type="submit"]').click();
      await webPage.waitForFunction(() => location.pathname === '/onboarding' || Boolean(document.querySelector('[role="alert"]')), null, { timeout: 20000 }).catch(() => {});
      await webPage.waitForTimeout(1000);
      const landing = await snapshot(webPage);
      let workspaceAttempt = null;
      if (landing.url.startsWith('/onboarding')) {
        await webPage.evaluate(() => { history.pushState({}, '', '/home'); dispatchEvent(new PopStateEvent('popstate')); });
        await webPage.waitForTimeout(700);
        workspaceAttempt = await snapshot(webPage);
        if (workspaceAttempt.url.startsWith('/onboarding')) await webPage.screenshot({ path: path.join(outDir, 'learner-relogin-onboarding.png'), fullPage: true });
        await webPage.getByRole('button', { name: '退出登录' }).click({ timeout: 5000 }).catch(() => {});
        await webPage.waitForFunction(() => location.pathname === '/login', null, { timeout: 12000 }).catch(() => {});
      }
      result.webRelogin = {
        loginStatus: webObs.responses.findLast(x => x.path === '/api/v1/auth/login')?.status ?? null,
        permissionsStatus: webObs.responses.findLast(x => x.path.includes('/permissions'))?.status ?? null,
        landing,
        workspaceAttempt,
        logoutStatus: webObs.responses.findLast(x => x.path === '/api/v1/auth/logout')?.status ?? null,
        browserErrors: webObs.errors,
        finalUrl: new URL(webPage.url()).pathname
      };
      await webContext.close();

      const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const mobilePage = await mobileContext.newPage();
      const mobileObs = observe(mobilePage);
      await mobilePage.goto('http://127.0.0.1:18183/#/pages/login/login?returnTo=%2Fpages%2Fhome%2Fhome', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await mobilePage.locator('input[autocomplete="username"]').fill(syntheticIdentifier);
      await mobilePage.locator('input[autocomplete="current-password"]').fill(syntheticPassword);
      await mobilePage.locator('form button.yx-button').click();
      await mobilePage.waitForFunction(() => location.hash.includes('/pages/onboarding/onboarding') || Boolean(document.querySelector('[role="alert"]')), null, { timeout: 20000 }).catch(() => {});
      await mobilePage.waitForTimeout(1000);
      const mobileLanding = await snapshot(mobilePage);
      const mobileOnboarding = mobileLanding.url.includes('/pages/onboarding/onboarding');
      if (mobileOnboarding) await mobilePage.screenshot({ path: path.join(outDir, 'mobile-relogin-onboarding.png'), fullPage: true });
      let mobileLogoutStatus = null;
      if (mobileOnboarding) {
        await mobilePage.getByRole('button', { name: '退出登录' }).click({ timeout: 5000 }).catch(() => {});
        await mobilePage.waitForTimeout(900);
        mobileLogoutStatus = mobileObs.responses.findLast(x => x.path === '/api/v1/auth/logout')?.status ?? null;
      }
      result.mobileLogin = {
        loginStatus: mobileObs.responses.findLast(x => x.path === '/api/v1/auth/login')?.status ?? null,
        landing: mobileLanding,
        reachedAdultGate: mobileOnboarding,
        logoutStatus: mobileLogoutStatus,
        browserErrors: mobileObs.errors,
        finalUrl: mobilePage.url().split('?')[0]
      };
      await mobileContext.close();
    }

    fs.writeFileSync(path.join(outDir, 'positive-flow.json'), JSON.stringify(result, null, 2), 'utf8');
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } finally {
    await browser.close();
  }
})().catch(error => {
  process.stderr.write(String(error.stack || error).slice(0, 1500) + '\n');
  process.exitCode = 1;
});
