const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const outDir = path.resolve('artifacts/uat-2026-09-26/local-latest-runtime/reading-diagnosis');
const syntheticIdentifier = 'codex-' + crypto.randomBytes(10).toString('hex') + '@local.invalid';
const syntheticPassword = 'Invalid-' + crypto.randomBytes(18).toString('base64url') + '!';
let phase = 'registration';

function clean(value) {
  if (value === undefined || value === null) return null;
  return String(value).slice(0, 500)
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[redacted-email]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted-token]')
    .replace(/Bearer\s+\S+/ig, 'Bearer [redacted]')
    .replace(/(password|token|cookie)\s*[:=]\s*[^,\s;]+/ig, '$1=[redacted]');
}
function apiPath(url) {
  let pathname = new URL(url).pathname;
  pathname = pathname.replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/ig, '/[id]')
                     .replace(/\/\d{3,}(?=\/|$)/g, '/[id]');
  return pathname;
}
function errorFields(body) {
  if (!body || typeof body !== 'object') return {};
  const nested = body.error && typeof body.error === 'object' ? body.error : {};
  const details = body.details && typeof body.details === 'object' ? body.details : {};
  const code = body.code ?? body.errorCode ?? nested.code ?? nested.errorCode ?? null;
  const message = body.message ?? body.errorDescription ?? nested.message ?? nested.errorDescription ?? null;
  const requestId = body.requestId ?? body.request_id ?? nested.requestId ?? null;
  const traceId = body.traceId ?? body.trace_id ?? nested.traceId ?? null;
  return {
    ...(code != null ? { code: clean(code) } : {}),
    ...(message != null ? { message: clean(message) } : {}),
    ...(requestId != null ? { requestId: clean(requestId) } : {}),
    ...(traceId != null ? { traceId: clean(traceId) } : {}),
    ...(Object.keys(details).length ? { detailsPresent: true } : {}),
  };
}
function observe(page) {
  const requests = [];
  const byRequest = new WeakMap();
  const browserErrors = [];
  page.on('request', req => {
    const url = new URL(req.url());
    if (!url.pathname.startsWith('/api/v1/')) return;
    const entry = { phase, method: req.method(), path: apiPath(req.url()), status: null };
    requests.push(entry);
    byRequest.set(req, entry);
  });
  page.on('response', async response => {
    const entry = byRequest.get(response.request());
    if (!entry) return;
    entry.status = response.status();
    const headers = response.headers();
    if (headers['x-request-id']) entry.requestId = clean(headers['x-request-id']);
    if (headers['x-trace-id']) entry.traceId = clean(headers['x-trace-id']);
    if (response.status() >= 400) {
      try { Object.assign(entry, errorFields(await response.json())); } catch {}
    }
  });
  page.on('requestfailed', request => {
    const entry = byRequest.get(request);
    if (entry) entry.failure = clean(request.failure()?.errorText ?? 'request failed');
  });
  page.on('pageerror', error => browserErrors.push(clean(error.message)));
  return { requests, browserErrors };
}
async function snapshot(page) {
  return page.evaluate(() => ({
    url: location.pathname + location.search + location.hash,
    title: document.title,
    headings: [...document.querySelectorAll('h1,h2,h3')].map(el => el.innerText.trim()).filter(Boolean).slice(0, 12),
    alerts: [...document.querySelectorAll('[role=alert],[role=status]')].map(el => el.innerText.trim()).filter(Boolean).slice(0, 8),
    visibleText: (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 1600)
  }));
}
async function waitForView(page, predicate, timeout = 15000) {
  await page.waitForFunction(predicate, null, { timeout }).catch(() => {});
  await page.waitForTimeout(700);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
    args: ['--no-sandbox']
  });
  const result = {
    generatedAt: new Date().toISOString(),
    scope: 'Local learner-web only. One random @local.invalid account was generated and kept in process memory; its identifier and password are not written. Adult-gate and consent choices were synthetic UI actions only, not real identity or legal consent.',
    browser: 'Playwright Chromium, headless, 1280x900',
    syntheticAccountsCreatedThisRun: 1,
    priorAttemptAccounts: 2,
    priorAttemptEvidence: ['attempt-01-navigation-collapse.json', 'attempt-02-reading-browser.json'],
    stages: {},
    reading: {},
    grammarSample: {},
    logout: { attempted: false },
  };
  let context = null;
  let page = null;
  try {
    context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    page = await context.newPage();
    const obs = observe(page);
    const view = async () => {
      const value = await snapshot(page);
      value.visibleText = clean(value.visibleText);
      value.alerts = value.alerts.map(clean);
      return value;
    };

    await page.goto('http://127.0.0.1:18180/register?redirect=%2Fhome', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('input[autocomplete="username"]').fill(syntheticIdentifier, { timeout: 10000 });
    await page.locator('input[name="password"]').fill(syntheticPassword, { timeout: 10000 });
    await page.locator('input[name="confirm"]').fill(syntheticPassword, { timeout: 10000 });
    await page.locator('form button[type="submit"]').click();
    await waitForView(page, () => location.pathname === '/onboarding' || Boolean(document.querySelector('[role="alert"]')), 18000);
    result.stages.registration = {
      succeeded: new URL(page.url()).pathname === '/onboarding',
      view: await view(),
      requests: obs.requests.filter(x => x.phase === 'registration')
    };
    if (!result.stages.registration.succeeded) throw new Error('Registration did not reach onboarding; safe stop.');

    phase = 'adult-gate';
    await page.locator('#adult-birth-year').fill('1990', { timeout: 7000 });
    const checks = page.locator('.consent-list input[type="checkbox"]');
    const checkCount = await checks.count();
    for (let i = 0; i < checkCount; i++) await checks.nth(i).check();
    await page.locator('form.setup-card button[type="submit"]').click();
    await waitForView(page, () => document.body.innerText.includes('你想先解决什么？') || Boolean(document.querySelector('[role="alert"]')), 15000);
    result.stages.adultGate = {
      reachedGoalSelection: (await page.locator('body').innerText()).includes('你想先解决什么？'),
      syntheticChoices: { birthYearEntered: true, visibleCheckboxesChecked: checkCount },
      view: await view(),
      requests: obs.requests.filter(x => x.phase === 'adult-gate')
    };
    if (!result.stages.adultGate.reachedGoalSelection) throw new Error('Adult-gate UI did not progress; safe stop.');

    phase = 'goal-setup';
    await page.locator('.choice').first().click({ timeout: 7000 });
    await page.getByRole('button', { name: '保存并开始测评' }).click({ timeout: 7000 });
    await waitForView(page, () => location.pathname === '/assessment' || Boolean(document.querySelector('[role="alert"]')), 18000);
    result.stages.goalSetup = {
      reachedAssessment: new URL(page.url()).pathname === '/assessment',
      view: await view(),
      requests: obs.requests.filter(x => x.phase === 'goal-setup')
    };
    if (!result.stages.goalSetup.reachedAssessment) throw new Error('Goal setup did not open the normal assessment route; safe stop.');

    phase = 'reading';
    await page.goto('http://127.0.0.1:18180/reading', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForView(page, () => location.pathname === '/reading', 15000);
    await page.waitForTimeout(2200);
    result.reading = {
      openedThroughSidebar: new URL(page.url()).pathname === '/reading',
      view: await view(),
      requests: obs.requests.filter(x => x.phase === 'reading'),
      browserErrors: obs.browserErrors
    };

    phase = 'reading-retry';
    const retry = page.getByRole('button', { name: /重新读取|重试|再试/ }).first();
    if (await retry.count().catch(() => 0)) {
      result.reading.retryButtonVisible = true;
      await retry.click({ timeout: 5000 });
      await page.waitForTimeout(2200);
      result.reading.retryView = await view();
      result.reading.retryRequests = obs.requests.filter(x => x.phase === 'reading-retry');
    } else {
      result.reading.retryButtonVisible = false;
    }

    phase = 'grammar-sample';
    const grammarLink = page.locator('aside nav a').filter({ hasText: '语法与句子' }).first();
    if (await grammarLink.count().catch(() => 0)) {
      await grammarLink.click({ timeout: 7000 });
      await waitForView(page, () => location.pathname === '/grammar', 12000);
      await page.waitForTimeout(1500);
      result.grammarSample = {
        openedThroughSidebar: new URL(page.url()).pathname === '/grammar',
        view: await view(),
        requests: obs.requests.filter(x => x.phase === 'grammar-sample'),
      };
    } else {
      result.grammarSample = { skipped: 'Grammar sidebar entry was not rendered.' };
    }

    phase = 'logout';
    result.logout.attempted = true;
    const settingsLink = page.locator('aside .sidebar-footer a').last();
    if (await settingsLink.count().catch(() => 0)) {
      await settingsLink.click({ timeout: 7000 });
      await waitForView(page, () => location.pathname === '/settings/profile', 10000);
    }
    const signout = page.locator('.account-signout button').last();
    result.logout.buttonAvailable = await signout.count().then(n => n > 0).catch(() => false);
    if (result.logout.buttonAvailable) {
      await signout.click({ timeout: 6000 }).catch(() => {});
      await waitForView(page, () => location.pathname === '/login', 10000);
    }
    result.logout.finalPath = new URL(page.url()).pathname;
    result.logout.requests = obs.requests.filter(x => x.phase === 'logout');
  } catch (error) {
    result.testError = clean(error.message || error);
  } finally {
    if (page && !result.logout.buttonAvailable) {
      result.logout.fallbackContextClose = 'No normal UI logout button was available; context closure will clear browser-held session state.';
    }
    if (context) await context.close().catch(() => {});
    await browser.close();
  }

  const outFile = path.join(outDir, 'reading-diagnosis.json');
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2), 'utf8');
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
})().catch(error => {
  process.stderr.write(clean(error.message || error) + '\n');
  process.exitCode = 1;
});


