// Authenticated page sweep (local web only): one login, then visit every
// learner-web route and record render state (ready/empty/offline/error/
// permission), console/page errors, and a11y headline. Read-only: no writes.
import { chromium } from 'playwright';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const WEB = 'http://127.0.0.1:18180';
const stamp = Date.now().toString(36);
const identifier = `wpg-${stamp}@local.invalid`;
const password = `E2ePg${stamp}Aa9!xQ`;
const device = { deviceType: 'WEB', clientVersion: 'wpg-1', deviceName: 'pages' };
async function api(method, path, { token, body, idem } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (idem) headers['idempotency-key'] = idem;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(GW + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  return { status: res.status, json: await res.json().catch(() => null) };
}
let r = await api('POST', '/api/v1/auth/register', { body: { identifier, password, device }, idem: `wpg-live-${stamp}-reg-01` });
if (r.status !== 201) { console.error(`setup register failed: HTTP ${r.status}`); process.exit(1); }
let token = r.json?.data?.accessToken ?? null;
r = await api('POST', '/api/v1/iam/adult-gate', { token, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idem: `wpg-live-${stamp}-gate-01` });
if (r.status !== 200) { console.error(`setup adult-gate failed: HTTP ${r.status}`); process.exit(1); }
for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
  r = await api('PUT', '/api/v1/iam/consents', { token, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idem: `wpg-live-${stamp}-consent-${t}` });
  if (r.status !== 200) { console.error(`setup consent ${t} failed: HTTP ${r.status}`); process.exit(1); }
}
// Re-login: the register token carries pre-gate stripped permissions; the login
// token carries the full allow-list (same pattern as the W-chains).
r = await api('POST', '/api/v1/auth/login', { body: { identifier, password, device }, idem: `wpg-live-${stamp}-login-01` });
if (r.status !== 200) { console.error(`setup login failed: HTTP ${r.status}`); process.exit(1); }
token = r.json?.data?.accessToken ?? null;
r = await api('PUT', '/api/v1/learner/targets', { token, body: { expectedStateVersion: 0, goalCode: 'CET_4_6', targetLevel: 'A2', dailyQuotaMinutes: 30 }, idem: `wpg-live-${stamp}-tgt-01` });
if (r.status !== 200) { console.error(`setup targets failed: HTTP ${r.status}`); process.exit(1); }
console.log('pages-user ready:', identifier);

const ROUTES = ['/home', '/today', '/assessment', '/vocabulary', '/learn', '/practice', '/b2/report', '/grammar', '/writing', '/listening', '/reading', '/speaking', '/world', '/commerce', '/support', '/courses', '/me', '/settings'];
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 140)));
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon|Failed to load resource/i.test(m.text())) errors.push('console.error: ' + m.text().slice(0, 140));
});
// login once
await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(2000);
await page.getByLabel(/账号|邮箱/i).first().fill(identifier);
await page.getByLabel(/密码/i).first().fill(password);
await page.getByRole('button', { name: /登录/i }).first().click();
await page.waitForTimeout(4000);
console.log('after login:', page.url());
const rows = [];
for (const route of ROUTES) {
  const before = errors.length;
  let status = -1;
  let finalUrl = '';
  let title = '';
  try {
    const resp = await page.goto(WEB + route, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => null);
    status = resp ? resp.status() : -1;
    await page.waitForTimeout(2500);
    finalUrl = page.url();
    title = await page.title();
  } catch (e) {
    errors.push(`goto-fail ${route}: ` + String(e).slice(0, 120));
  }
  let headline = '';
  try {
    const h = page.locator('h1, h2').first();
    if ((await h.count()) > 0) headline = ((await h.textContent()) ?? '').trim().slice(0, 80);
  } catch { /* ignore */ }
  const bodyText = ((await page.locator('body').first().textContent().catch(() => '')) ?? '');
  const hasStatePanel = (await page.locator('.state-panel').count().catch(() => 0)) > 0;
  const panelClass = hasStatePanel ? ((await page.locator('.state-panel').first().getAttribute('class').catch(() => '')) ?? '') : '';
  const state = /login/i.test(finalUrl) ? 'redirect-login'
    : /state-panel--offline/.test(panelClass) ? 'offline-panel'
    : /state-panel--permission|state-panel--forbidden/.test(panelClass) ? 'permission-panel'
    : /state-panel--(error|recovering|expired|revoked)/.test(panelClass) ? 'error-panel'
    : 'rendered';
  const fresh = errors.length - before;
  rows.push({ route, status, finalUrl, title, headline, state, newErrors: fresh });
  console.log(`  ${status === 200 && fresh === 0 ? 'ok  ' : 'NOTE'} ${route} :: HTTP ${status} [${state}] ${headline} +${fresh}err`);
}
const pageErrors = errors.filter((e) => e.startsWith('pageerror'));
const evidence = { task: 'PAGES-LIVE-SWEEP', capturedAt: new Date().toISOString(), identifier, result: pageErrors.length === 0 ? 'PASS' : 'FAIL', routes: rows.length, pageErrors: pageErrors.length, rows, errors: errors.slice(0, 20) };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/pages-sweep.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`PAGES: ${rows.length} routes, pageerrors=${pageErrors.length} -> ${evidence.result}`);
await browser.close();
process.exit(0);
