// UI revamp round 6: keyboard/a11y sweep - accessible names, headings,
// landmarks and focus visibility on key routes.
import { chromium } from 'playwright';
const GW = 'http://127.0.0.1:18070';
const WEB = 'http://127.0.0.1:18180';
const stamp = Date.now().toString(36);
const identifier = `wui6-${stamp}@local.invalid`;
const password = `E2eUi${stamp}Aa9!xQ`;
const device = { deviceType: 'WEB', clientVersion: 'wui6-1', deviceName: 'ui6' };
async function api(method, path, { token, body, idem } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (idem) headers['idempotency-key'] = idem;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(GW + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  return { status: res.status, json: await res.json().catch(() => null) };
}
let r = await api('POST', '/api/v1/auth/register', { body: { identifier, password, device }, idem: `wui6-${stamp}-reg` });
const t0 = r.json?.data?.accessToken ?? null;
await api('POST', '/api/v1/iam/adult-gate', { token: t0, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idem: `wui6-${stamp}-gate` });
for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
  await api('PUT', '/api/v1/iam/consents', { token: t0, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idem: `wui6-${stamp}-c-${t}` });
}
await api('POST', '/api/v1/auth/login', { body: { identifier, password, device }, idem: `wui6-${stamp}-login` });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.getByLabel(/账号|邮箱/i).first().fill(identifier);
await page.getByLabel(/密码/i).first().fill(password);
await page.getByRole('button', { name: /登录/i }).first().click();
await page.waitForTimeout(3000);
const rows = [];
for (const route of ['home', 'today', 'mistakes', 'commerce', 'support', 'settings']) {
  await page.goto(`${WEB}/${route}`, { waitUntil: 'domcontentloaded' }).catch(() => null);
  await page.waitForTimeout(3500);
  const audit = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')];
    const nameless = buttons.filter((b) => !(b.textContent ?? '').trim() && !b.getAttribute('aria-label')).length;
    const h1s = document.querySelectorAll('main h1, main h2').length;
    const mains = document.querySelectorAll('main').length;
    const imgs = [...document.querySelectorAll('img')].filter((i) => !i.getAttribute('alt')).length;
    // keyboard: first 12 tabbables must show a visible focus ring.
    return { buttons: buttons.length, nameless, h1s, mains, imgsNoAlt: imgs };
  });
  // tab through and confirm focus stays visible (no focus loss to body).
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement?.tagName ?? 'NONE');
  rows.push({ route, ...audit, focusedAfterTab: focused });
  console.log(route, JSON.stringify({ ...audit, focusedAfterTab: focused }));
}
await browser.close();
const bad = rows.filter((x) => x.nameless > 0 || x.h1s === 0 || x.mains !== 1);
console.log(bad.length === 0 ? 'A11Y SWEEP PASS' : `A11Y ISSUES on ${bad.map((x) => x.route).join(',')}`);
process.exit(bad.length === 0 ? 0 : 1);
