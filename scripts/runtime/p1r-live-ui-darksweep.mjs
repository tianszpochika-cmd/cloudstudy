// UI revamp round 2: dark-mode sweep across all learner routes; one screenshot
// per route in dark theme for visual review.
import { chromium } from 'playwright';
import fs from 'node:fs';
const GW = 'http://127.0.0.1:18070';
const WEB = 'http://127.0.0.1:18180';
const stamp = Date.now().toString(36);
const identifier = `wui2-${stamp}@local.invalid`;
const password = `E2eUi${stamp}Aa9!xQ`;
const device = { deviceType: 'WEB', clientVersion: 'wui2-1', deviceName: 'ui2' };
async function api(method, path, { token, body, idem } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (idem) headers['idempotency-key'] = idem;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(GW + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  return { status: res.status, json: await res.json().catch(() => null) };
}
let r = await api('POST', '/api/v1/auth/register', { body: { identifier, password, device }, idem: `wui2-${stamp}-reg` });
const t0 = r.json?.data?.accessToken ?? null;
await api('POST', '/api/v1/iam/adult-gate', { token: t0, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idem: `wui2-${stamp}-gate` });
for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
  await api('PUT', '/api/v1/iam/consents', { token: t0, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idem: `wui2-${stamp}-c-${t}` });
}
await api('POST', '/api/v1/auth/login', { body: { identifier, password, device }, idem: `wui2-${stamp}-login` });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.getByLabel(/账号|邮箱/i).first().fill(identifier);
await page.getByLabel(/密码/i).first().fill(password);
await page.getByRole('button', { name: /登录/i }).first().click();
await page.waitForTimeout(3000);
const routes = ['home', 'today', 'assessment', 'vocabulary', 'practice', 'mistakes', 'mastery', 'plan-map', 'commerce', 'support', 'courses', 'settings', 'world', 'learn'];
fs.mkdirSync('evidence/live/2026-09-16/dark-sweep', { recursive: true });
for (const route of routes) {
  await page.goto(`${WEB}/${route}`, { waitUntil: 'domcontentloaded' }).catch(() => null);
  await page.waitForTimeout(2200);
  // Full navigation resets document state: re-apply dark after each goto.
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(700);
  await page.screenshot({ path: `evidence/live/2026-09-16/dark-sweep/${route}.png` });
  console.log('shot', route);
}
console.log('pageerrors:', errors.length, errors.slice(0, 5));
await browser.close();
