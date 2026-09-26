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
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api/v1/')) responses.push({ path: url.pathname, status: response.status() });
  });
  page.on('pageerror', error => errors.push(String(error.message).slice(0, 180)));
  page.on('console', message => {
    if (message.type() === 'error') {
      const url = message.location()?.url ?? '';
      errors.push(message.text().slice(0, 140) + (url ? ' [' + new URL(url).pathname + ']' : ''));
    }
  });
  return { responses, errors };
}

async function snapshot(page) {
  return page.evaluate(() => ({
    url: location.pathname + location.search + location.hash,
    title: document.title,
    headings: [...document.querySelectorAll('h1,h2')].map(el => el.innerText.trim()).filter(Boolean).slice(0, 10),
    alert: [...document.querySelectorAll('[role=alert]')].map(el => el.innerText.trim()).filter(Boolean).join(' ').slice(0, 300),
    bodyText: (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 1000)
  }));
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe', args: ['--no-sandbox'] });
  const result = { generatedAt: new Date().toISOString(), scope: 'Single random local synthetic account. Credentials omitted from all artifacts. Synthetic adult gate used year 1990 and local UI acknowledgements only; no formal legal acceptance is claimed.', registration: null, webAdultGate: null, webRelogin: null, mobileLogin: null };
  const checkpoint = () => fs.writeFileSync(path.join(outDir, 'positive-flow.json'), JSON.stringify(result, null, 2), 'utf8');
  let firstContext = null, webContext = null, mobileContext = null;
  try {
    firstContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const registerPage = await firstContext.newPage();
    const registerObs = observe(registerPage);
    await registerPage.goto('http://127.0.0.1:18180/register?redirect=%2Fhome', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await registerPage.locator('input[autocomplete="username"]').fill(syntheticIdentifier, { timeout: 10000 });
    await registerPage.locator('input[name="password"]').fill(syntheticPassword, { timeout: 10000 });
    await registerPage.locator('input[name="confirm"]').fill(syntheticPassword, { timeout: 10000 });
    await registerPage.locator('form button[type="submit"]').click();
    await registerPage.waitForFunction(() => location.pathname === '/onboarding' || Boolean(document.querySelector('[role="alert"]')), null, { timeout: 18000 }).catch(() => {});
    await registerPage.waitForTimeout(700);
    let view = await snapshot(registerPage);
    const registered = view.url.startsWith('/onboarding');
    result.registration = { succeeded: registered, status: registerObs.responses.find(x => x.path === '/api/v1/auth/register')?.status ?? null, view, apiResponses: registerObs.responses, browserErrors: registerObs.errors };
    checkpoint();
    if (!registered) throw new Error('Synthetic registration did not reach onboarding; safe stop.');

    // Explicit test-only synthetic adult and policy acknowledgements; no real user data.
    await registerPage.locator('#adult-birth-year').fill('1990', { timeout: 7000 });
    const checks = registerPage.locator('.consent-list input[type="checkbox"]');
    const checkCount = await checks.count();
    for (let i = 0; i < checkCount; i++) await checks.nth(i).check();
    await registerPage.locator('form.setup-card button[type="submit"]').click();
    await registerPage.waitForFunction(() => document.body.innerText.includes('你想先解决什么？') || Boolean(document.querySelector('[role="alert"]')), null, { timeout: 15000 }).catch(() => {});
    await registerPage.waitForTimeout(500);
    view = await snapshot(registerPage);
    const adultPassed = view.bodyText.includes('你想先解决什么？');
    result.webAdultGate = { reachedGoalStep: adultPassed, consentChoicesPresented: checkCount, view, apiResponses: registerObs.responses.slice(-12), browserErrors: registerObs.errors };
    checkpoint();
    if (!adultPassed) throw new Error('Synthetic adult gate did not progress to goal selection; stop without bypassing.');

    // Complete minimal first-run goal to test the intended workspace transition.
    await registerPage.locator('.choice').first().click({ timeout: 7000 });
    await registerPage.getByRole('button', { name: '保存并开始测评' }).click({ timeout: 7000 });
    await registerPage.waitForFunction(() => location.pathname === '/assessment' || Boolean(document.querySelector('[role="alert"]')), null, { timeout: 15000 }).catch(() => {});
    await registerPage.waitForTimeout(700);
    const setupResult = await snapshot(registerPage);
    await registerPage.evaluate(() => { history.pushState({}, '', '/home'); dispatchEvent(new PopStateEvent('popstate')); });
    await registerPage.waitForTimeout(1000);
    const workspace = await snapshot(registerPage);
    const homeReached = workspace.url.startsWith('/home');
    if (homeReached) await registerPage.screenshot({ path: path.join(outDir, 'learner-home-synthetic.png'), fullPage: true });
    result.webAdultGate.goalSetupView = setupResult;
    result.webAdultGate.workspaceAttempt = { reachedHome: homeReached, view: workspace };
    result.webAdultGate.apiResponses = registerObs.responses.slice(-18);
    checkpoint();

    // Log out using the account settings UI, then use a clean context for sign-in.
    await registerPage.evaluate(() => { history.pushState({}, '', '/settings/profile'); dispatchEvent(new PopStateEvent('popstate')); });
    await registerPage.waitForTimeout(800);
    const signoutButton = registerPage.getByRole('button', { name: /退出登录|登出/ }).last();
    const signoutAvailable = await signoutButton.count().then(n => n > 0).catch(() => false);
    let signoutStatus = null;
    if (signoutAvailable) {
      await signoutButton.click({ timeout: 5000 }).catch(() => {});
      await registerPage.waitForFunction(() => location.pathname === '/login', null, { timeout: 10000 }).catch(() => {});
      signoutStatus = registerObs.responses.findLast(x => x.path === '/api/v1/auth/logout')?.status ?? null;
    }
    result.webAdultGate.logout = { available: signoutAvailable, status: signoutStatus, finalPath: new URL(registerPage.url()).pathname };
    checkpoint();
    await firstContext.close(); firstContext = null;

    webContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const webPage = await webContext.newPage();
    const webObs = observe(webPage);
    await webPage.goto('http://127.0.0.1:18180/login?redirect=%2Fhome', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await webPage.locator('input[autocomplete="username"]').fill(syntheticIdentifier, { timeout: 10000 });
    await webPage.locator('input[autocomplete="current-password"]').fill(syntheticPassword, { timeout: 10000 });
    await webPage.locator('form button[type="submit"]').click();
    await webPage.waitForFunction(() => location.pathname !== '/login' || Boolean(document.querySelector('[role="alert"]')), null, { timeout: 18000 }).catch(() => {});
    await webPage.waitForTimeout(800);
    const webLanding = await snapshot(webPage);
    result.webRelogin = { loginStatus: webObs.responses.findLast(x => x.path === '/api/v1/auth/login')?.status ?? null, permissionsStatus: webObs.responses.findLast(x => x.path.includes('/permissions'))?.status ?? null, landing: webLanding, browserErrors: webObs.errors };
    checkpoint();
    await webContext.close(); webContext = null;

    // Mobile uni-app custom controls are not native autocomplete/button elements in rendered H5;
    // use their actual DOM order and visible action, while keeping credentials only in memory.
    mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const mobilePage = await mobileContext.newPage();
    const mobileObs = observe(mobilePage);
    await mobilePage.goto('http://127.0.0.1:18183/#/pages/login/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await mobilePage.waitForSelector('input', { timeout: 12000 });
    await mobilePage.waitForTimeout(500);
    const inputCount = await mobilePage.locator('input').count();
    if (inputCount < 2) throw new Error('Mobile H5 login did not render two input controls.');
    await mobilePage.locator('input').nth(0).fill(syntheticIdentifier, { timeout: 7000 });
    await mobilePage.locator('input').nth(1).fill(syntheticPassword, { timeout: 7000 });
    await mobilePage.locator('.yx-button').filter({ hasText: '登录并继续' }).click({ timeout: 7000 });
    await mobilePage.waitForFunction(() => location.hash.includes('/pages/home/home') || location.hash.includes('/pages/onboarding/onboarding') || Boolean(document.querySelector('[role="alert"]')), null, { timeout: 18000 }).catch(() => {});
    await mobilePage.waitForTimeout(800);
    const mobileLanding = await snapshot(mobilePage);
    result.mobileLogin = { inputCount, loginStatus: mobileObs.responses.findLast(x => x.path === '/api/v1/auth/login')?.status ?? null, landing: mobileLanding, browserErrors: mobileObs.errors };
    checkpoint();

    // Verify the mobile account panel exposes the server-confirmed adult status when available.
    if (mobileLanding.url.includes('/pages/home/home')) {
      await mobilePage.evaluate(() => { location.hash = '#/pages/profile/profile'; });
      await mobilePage.waitForFunction(() => location.hash.includes('/pages/profile/profile'), null, { timeout: 10000 }).catch(() => {});
      await mobilePage.waitForTimeout(1200);
      result.mobileLogin.profileView = await snapshot(mobilePage);
      const mobileLogout = mobilePage.getByText('退出登录', { exact: true }).last();
      if (await mobileLogout.count().catch(() => 0)) {
        await mobileLogout.click({ timeout: 5000 }).catch(() => {});
        await mobilePage.waitForTimeout(900);
      }
      result.mobileLogin.logoutStatus = mobileObs.responses.findLast(x => x.path === '/api/v1/auth/logout')?.status ?? null;
      result.mobileLogin.finalUrl = mobilePage.url().split('?')[0];
      checkpoint();
    }
  } catch (error) {
    result.testError = String(error.message || error).slice(0, 220);
    checkpoint();
  } finally {
    if (firstContext) await firstContext.close().catch(() => {});
    if (webContext) await webContext.close().catch(() => {});
    if (mobileContext) await mobileContext.close().catch(() => {});
    await browser.close();
  }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
})().catch(error => {
  process.stderr.write(String(error.message || error).slice(0, 500) + '\n');
  process.exitCode = 1;
});
