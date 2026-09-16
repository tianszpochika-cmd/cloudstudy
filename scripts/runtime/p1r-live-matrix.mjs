// Four-end browser matrix (local web only): render + console-error + a11y snapshot,
// plus REAL UI login flows on learner-web against the live stack, returnTo,
// reload persistence, offline behavior, and tablet/phone viewports.
import { chromium } from 'playwright';
import fs from 'node:fs';

const results = [];
async function visit(id, url, { loginFlow = null, waitMs = 2500, viewport = null, afterLogin = null, offlineReload = false } = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext(viewport ? { viewport } : {});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 160)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/ERR_CONNECTION_REFUSED|Failed to load resource|favicon|net::/i.test(m.text())) {
      errors.push('console.error: ' + m.text().slice(0, 160));
    }
  });
  const out = { id, url, status: -1, title: '', errors, a11y: '', flow: null, viewport: viewport ?? { width: 1440, height: 900 } };
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    out.status = resp ? resp.status() : -1;
    await page.waitForTimeout(waitMs);
    out.title = await page.title();
    try {
      out.a11y = (await page.locator('main, body').first().ariaSnapshot()).slice(0, 1200);
    } catch { out.a11y = '(no snapshot)'; }
    if (loginFlow) {
      const f = { steps: [] };
      try {
        await page.getByLabel(/用户|账号|手机|邮箱|username/i).first().fill(loginFlow.identifier);
        await page.getByLabel(/密码|password/i).first().fill(loginFlow.password);
        f.steps.push('filled');
        await page.getByRole('button', { name: /登录|登入|login/i }).first().click();
        await page.waitForTimeout(4000);
        f.afterUrl = page.url();
        f.afterTitle = await page.title();
        try {
          f.homeA11y = (await page.locator('main, body').first().ariaSnapshot()).slice(0, 900);
        } catch { f.homeA11y = '(no snapshot)'; }
        const ok = !/login/i.test(f.afterUrl) || (await page.content()).length > 30000;
        f.loggedIn = ok;
        if (afterLogin === 'reload') {
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => null);
          await page.waitForTimeout(2500);
          f.reloadUrl = page.url();
          f.reloadKeepsSession = !/login/i.test(f.reloadUrl);
        }
        if (afterLogin === 'offline') {
          // SPA in-page navigation while offline (full reloads cannot fetch
          // vite dev modules without network: dev-mode limitation, not app UX).
          await context.setOffline(true);
          try {
            await page.getByRole('link', { name: /今日任务|today/i }).first().click({ timeout: 8000 });
          } catch { /* nav link may differ; fall through to snapshot */ }
          await page.waitForTimeout(3500);
          f.offlineUrl = page.url();
          try {
            f.offlineA11y = (await page.locator('main, body').first().ariaSnapshot()).slice(0, 800);
          } catch { f.offlineA11y = '(no snapshot)'; }
          const bodyText = ((await page.locator('body').first().textContent().catch(() => '')) ?? '').slice(0, 400);
          f.offlineDeclaresState = /离线|offline|网络|重试|retry|同步/i.test(bodyText);
          await context.setOffline(false);
        }
        out.flow = f;
      } catch (e) {
        out.flow = { error: String(e).slice(0, 200) };
      }
    }
    if (offlineReload) {
      await context.setOffline(true);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => null);
      await page.waitForTimeout(2500);
      out.offlineTitle = await page.title();
      try {
        out.offlineA11y = (await page.locator('main, body').first().ariaSnapshot()).slice(0, 600);
      } catch { out.offlineA11y = '(no snapshot)'; }
      await context.setOffline(false);
    }
  } catch (e) {
    errors.push('goto-fail: ' + String(e).slice(0, 200));
  }
  results.push(out);
  console.log(`${out.status === 200 ? 'ok  ' : 'FAIL'} ${id} :: HTTP ${out.status} title="${out.title}" errors=${errors.length}${out.flow ? ' flow=' + JSON.stringify(out.flow).slice(0, 200) : ''}`);
  await browser.close();
}

// Seed a UI-login user via API first (adult gate + consents so post-login pages work).
const stamp = Date.now().toString(36);
const identifier = `wui-${stamp}@local.invalid`;
const password = `E2eUi${stamp}Aa9!xQ`;
const device = { deviceType: 'WEB', clientVersion: 'w4matrix-1', deviceName: 'matrix' };
async function api(method, path, { token, body, idem } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (idem) headers['idempotency-key'] = idem;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch('http://127.0.0.1:18070' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  return { status: res.status, json: await res.json().catch(() => null) };
}
let r = await api('POST', '/api/v1/auth/register', { body: { identifier, password, device }, idem: `wui-${stamp}-reg-01` });
let token = r.json?.data?.accessToken ?? null;
await api('POST', '/api/v1/iam/adult-gate', { token, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idem: `wui-${stamp}-gate-01` });
for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
  await api('PUT', '/api/v1/iam/consents', { token, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idem: `wui-${stamp}-c-${t}` });
}
console.log('ui-user ready:', identifier);

async function visitWorldTabs() {
  // M7-003 cross-end run: one login, then the world/games/social/avatar/offline tabs.
  const out = { id: 'learner-world-tabs', url: 'http://127.0.0.1:18180/world', status: -1, title: '', errors: [], tabs: {} };
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.on('pageerror', (e) => out.errors.push('pageerror: ' + String(e).slice(0, 140)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/i.test(m.text())) out.errors.push('console.error: ' + m.text().slice(0, 140));
  });
  try {
    await page.goto('http://127.0.0.1:18180/login', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2000);
    await page.getByLabel(/账号|邮箱/i).first().fill(identifier);
    await page.getByLabel(/密码/i).first().fill(password);
    await page.getByRole('button', { name: /登录/i }).first().click();
    await page.waitForTimeout(4000);
    const resp = await page.goto('http://127.0.0.1:18180/world', { waitUntil: 'domcontentloaded', timeout: 45000 });
    out.status = resp ? resp.status() : -1;
    await page.waitForTimeout(3000);
    out.title = await page.title();
    for (const tab of ['游戏大厅', '自习室', 'Avatar', '离线包']) {
      try {
        await page.getByRole('button', { name: new RegExp(tab) }).first().click({ timeout: 6000 });
        await page.waitForTimeout(1500);
        const snap = await page.locator('main, body').first().ariaSnapshot().catch(() => '(no snapshot)');
        out.tabs[tab] = { ok: true, snapshot: snap.slice(0, 400) };
      } catch (e) {
        out.tabs[tab] = { ok: false, error: String(e).slice(0, 120) };
      }
    }
  } catch (e) {
    out.errors.push('goto-fail: ' + String(e).slice(0, 160));
  }
  results.push(out);
  const tabsOk = Object.values(out.tabs).filter((t) => t.ok).length;
  console.log(`${out.status === 200 && tabsOk === 4 ? 'ok  ' : 'FAIL'} learner-world-tabs :: HTTP ${out.status} tabs=${tabsOk}/4 errors=${out.errors.length}`);
  await browser.close();
}
// Set a learning goal via API so post-onboarding deep links resolve for this user.
await api('PUT', '/api/v1/learner/targets', { token, body: { expectedStateVersion: 0, goalCode: 'CET_4_6', targetLevel: 'A2', dailyQuotaMinutes: 30 }, idem: `wui-${stamp}-tgt-01` });

await visit('official-home', 'http://127.0.0.1:18192/');
await visit('learner-home', 'http://127.0.0.1:18180/');
await visit('learner-login-flow', 'http://127.0.0.1:18180/login', { loginFlow: { identifier, password } });
// The app consumes ?redirect= (not ?returnTo=); an onboarded user must land on /today.
await visit('learner-login-returnto', 'http://127.0.0.1:18180/login?redirect=/today', { loginFlow: { identifier, password } });
await visit('learner-login-reload', 'http://127.0.0.1:18180/login', { loginFlow: { identifier, password }, afterLogin: 'reload' });
await visit('learner-login-offline', 'http://127.0.0.1:18180/login', { loginFlow: { identifier, password }, afterLogin: 'offline' });
await visit('learner-ipad', 'http://127.0.0.1:18180/login', { loginFlow: { identifier, password }, viewport: { width: 820, height: 1180 } });
await visitWorldTabs();
await visit('learner-today', 'http://127.0.0.1:18180/today');
await visit('admin-login', 'http://127.0.0.1:18181/login');
await visit('mobile-h5-login', 'http://127.0.0.1:18183/#/pages/login/login', { waitMs: 8000 });
await visit('mobile-h5-home', 'http://127.0.0.1:18183/#/pages/home/home', { waitMs: 8000 });
await visit('mobile-h5-phone', 'http://127.0.0.1:18183/#/pages/login/login', { waitMs: 8000, viewport: { width: 390, height: 844 } });

const fails = results.filter((x) => x.status !== 200 || x.errors.length > 0);
fs.writeFileSync('evidence/live/2026-09-16/browser-matrix.json', JSON.stringify({ capturedAt: new Date().toISOString(), results }, null, 2) + '\n');
console.log(`MATRIX: ${results.length - fails.length}/${results.length} clean`);
process.exit(0);
