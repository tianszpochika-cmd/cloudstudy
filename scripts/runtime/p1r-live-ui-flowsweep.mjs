import { chromium } from 'playwright';
const GW = 'http://127.0.0.1:18070';
const WEB = 'http://127.0.0.1:18180';
const stamp = Date.now().toString(36);
const identifier = `wui4-${stamp}@local.invalid`;
const password = `E2eUi${stamp}Aa9!xQ`;
const device = { deviceType: 'WEB', clientVersion: 'wui4-1', deviceName: 'ui4' };
async function api(method, path, { token, body, idem } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (idem) headers['idempotency-key'] = idem;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(GW + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  return { status: res.status, json: await res.json().catch(() => null) };
}
let r = await api('POST', '/api/v1/auth/register', { body: { identifier, password, device }, idem: `wui4-${stamp}-reg` });
const t0 = r.json?.data?.accessToken ?? null;
await api('POST', '/api/v1/iam/adult-gate', { token: t0, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idem: `wui4-${stamp}-gate` });
for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
  await api('PUT', '/api/v1/iam/consents', { token: t0, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idem: `wui4-${stamp}-c-${t}` });
}
await api('POST', '/api/v1/auth/login', { body: { identifier, password, device }, idem: `wui4-${stamp}-login` });
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
for (const route of ['onboarding', 'learn', 'practice', 'courses', 'world']) {
  await page.goto(`${WEB}/${route}`, { waitUntil: 'domcontentloaded' }).catch(() => null);
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `evidence/live/2026-09-16/ui-light-${route}.png` });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(700);
  await page.screenshot({ path: `evidence/live/2026-09-16/ui-dark-${route}.png` });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  console.log('shot', route);
}
console.log('pageerrors:', errors.length, errors.slice(0, 5));
await browser.close();
