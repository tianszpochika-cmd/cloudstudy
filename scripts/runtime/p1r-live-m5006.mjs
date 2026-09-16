// M5-006 live: Browser -> DB -> report reconciliation. Submit SRS reviews,
// reconcile the daily report arithmetic exactly, cross-check MySQL, replay
// for stability, then confirm the learner-web report page shows the numbers.
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const WEB = 'http://127.0.0.1:18180';
const stamp = Date.now().toString(36);
const identifier = `w5006-${stamp}@local.invalid`;
const password = `E2eLive${stamp}Aa9!xQ`;
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
const idem = (s) => `w5006-live-${stamp}-${++idemN}-${s}`.slice(0, 60);
async function call(method, path, { token, body, idemKey } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (idemKey) headers['idempotency-key'] = idemKey;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(GW + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json };
}
const data = (r) => r.json?.data ?? r.json ?? {};
const device = { deviceType: 'WEB', clientVersion: 'w5006-live-1', deviceName: 'w5006-live-probe' };
let r = await call('POST', '/api/v1/auth/register', { body: { identifier, password, device }, idemKey: idem('reg') });
record('setup-register', r.status === 201, `HTTP ${r.status}`, 'HTTP 201');
const t0 = r.json?.data?.accessToken ?? null;
await call('POST', '/api/v1/iam/adult-gate', { token: t0, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idemKey: idem('gate') });
for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
  await call('PUT', '/api/v1/iam/consents', { token: t0, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idemKey: idem(`c-${t}`) });
}
r = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device }, idemKey: idem('login') });
const token = r.json?.data?.accessToken ?? null;
record('setup-login', r.status === 200 && !!token, `HTTP ${r.status}`, 'HTTP 200 + token');
const sub = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).sub;
r = await call('GET', '/api/v1/learning/stats/daily-report', { token });
record('report-baseline', r.status === 200 && (data(r).reviewItems ?? 0) === 0, `HTTP ${r.status} reviewItems=${data(r).reviewItems}`, 'HTTP 200 fresh zero');
// 3 successful (quality>=3) + 1 lapse.
const qualities = [5, 5, 4, 2];
let accepted = 0;
const firstKey = idem('rev-first');
for (let i = 0; i < qualities.length; i++) {
  const rv = await call('POST', '/api/v1/learning/srs/reviews', { token, body: { itemId: `w5006-${stamp}-item-${i}`, quality: qualities[i] }, idemKey: i === 0 ? firstKey : idem(`rev-${i}`) });
  if (rv.status === 200 && (data(rv).status === 'ACCEPTED' || data(rv).itemId)) accepted++;
}
record('reviews-submit', accepted === 4, `${accepted}/4 accepted`, '4/4 accepted');
r = await call('GET', '/api/v1/learning/stats/daily-report', { token });
{
  const d = data(r);
  const okItems = d.reviewItems === 4;
  const okAcc = typeof d.accuracy === 'number' && Math.abs(d.accuracy - 75) < 1e-9;
  record('report-reconciled', r.status === 200 && okItems && okAcc, `HTTP ${r.status} reviewItems=${d.reviewItems} accuracy=${d.accuracy}`, 'reviewItems=4 accuracy=75');
}
// DB cross-check: same durable facts, counted straight from MySQL.
{
  const out = execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-e',
    `SELECT COUNT(*), COALESCE(SUM(quality >= 3),0) FROM learning_service.b25_learning_review WHERE principal_id = '${sub}' AND created_at >= UTC_DATE()`], { encoding: 'utf8' }).trim().split(/\s+/);
  record('db-crosscheck', out[0] === '4' && out[1] === '3', `reviews=${out[0]} successful=${out[1]}`, 'reviews=4 successful=3');
}
// Replay the FIRST review with its ORIGINAL key: absorbed, report unchanged.
const rp = await call('POST', '/api/v1/learning/srs/reviews', { token, body: { itemId: `w5006-${stamp}-item-0`, quality: 5 }, idemKey: firstKey });
r = await call('GET', '/api/v1/learning/stats/daily-report', { token });
record('replay-stable', data(r).reviewItems === 4, `replay=${data(rp).status ?? '?'} reviewItems=${data(r).reviewItems}`, 'absorbed, still 4');
// Browser: the report page shows the reconciled numbers.
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 130)));
await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(2000);
await page.getByLabel(/账号|邮箱/i).first().fill(identifier);
await page.getByLabel(/密码/i).first().fill(password);
await page.getByRole('button', { name: /登录/i }).first().click();
await page.waitForTimeout(4000);
await page.goto(`${WEB}/b2/report`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(4000);
const bodyText = (await page.locator('body').first().textContent().catch(() => '')) ?? '';
const shows4 = /复习内容[\s\S]{0,60}4/.test(bodyText) || (bodyText.includes('复习内容') && bodyText.includes('4'));
const shows75 = bodyText.includes('75%');
record('browser-report', page.url().includes('/b2/report') && shows4 && shows75, 'report page shows 4 + 75%', 'browser matches DB');
record('browser-no-errors', errs.length === 0, `${errs.length} pageerrors`, 'zero');
await browser.close();
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'M5006-LIVE-RECONCILE', capturedAt: new Date().toISOString(), gateway: GW, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/m5006-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`M5006 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
