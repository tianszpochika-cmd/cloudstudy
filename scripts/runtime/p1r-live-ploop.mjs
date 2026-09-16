// Practice->mistakes->verify->report browser loop (M5-012 live loop run).
import { chromium } from 'playwright';
import fs from 'node:fs';
const GW = 'http://127.0.0.1:18070';
const WEB = 'http://127.0.0.1:18180';
const stamp = Date.now().toString(36);
const identifier = `wpl-${stamp}@local.invalid`;
const password = `E2eWpl${stamp}Aa9!xQ`;
const device = { deviceType: 'WEB', clientVersion: 'wpl-1', deviceName: 'ploop' };
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
async function api(method, path, { token, body, idem } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (idem) headers['idempotency-key'] = idem;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(GW + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  return { status: res.status, json: await res.json().catch(() => null) };
}
let r = await api('POST', '/api/v1/auth/register', { body: { identifier, password, device }, idem: `wpl-live-${stamp}-reg-01` });
let token = r.json?.data?.accessToken ?? null;
await api('POST', '/api/v1/iam/adult-gate', { token, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idem: `wpl-live-${stamp}-gate-01` });
for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
  await api('PUT', '/api/v1/iam/consents', { token, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idem: `wpl-live-${stamp}-c-${t}` });
}
await api('POST', '/api/v1/auth/login', { body: { identifier, password, device }, idem: `wpl-live-${stamp}-login-01` });
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(2000);
await page.getByLabel(/账号|邮箱/i).first().fill(identifier);
await page.getByLabel(/密码/i).first().fill(password);
await page.getByRole('button', { name: /登录/i }).first().click();
await page.waitForTimeout(4000);
record('ploop-login', page.url().includes('/home'), page.url(), 'lands home');
// practice: answer questions until no options remain (max 6 rounds).
await page.goto(`${WEB}/practice`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(4000);
let answered = 0;
for (let q = 0; q < 6; q++) {
  const opts = await page.locator('.question-panel .option').all().catch(() => []);
  if (opts.length === 0) break;
  await opts[0].click();
  await page.waitForTimeout(800);
  const sub = page.getByRole('button', { name: /提交答案/ });
  if ((await sub.count()) > 0 && !(await sub.first().isDisabled())) {
    await sub.first().click();
    await page.waitForTimeout(2500);
    answered++;
  } else break;
}
record('ploop-answered', answered >= 1, `${answered} answers`, '>=1 answered');
let bodyText = (await page.locator('body').first().textContent().catch(() => '')) ?? '';
record('ploop-report', /得分|正确|报告|完成/.test(bodyText), 'report panel', 'report shown');
// mistakes page: entries exist (wrong first-options) or honest empty.
await page.goto(`${WEB}/b2/report`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => null);
await page.waitForTimeout(3000);
bodyText = (await page.locator('body').first().textContent().catch(() => '')) ?? '';
record('ploop-report-page', /报告|得分|正确|暂无/.test(bodyText), 'report page renders', 'report renders');
// today deep-link from loop end.
await page.goto(`${WEB}/today`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => null);
await page.waitForTimeout(3000);
record('ploop-today', page.url().includes('/today'), page.url(), 'today reachable');
// loop pages (decision 1A): mistakes -> mastery -> plan-map close the loop.
for (const [route, marker] of [['/mistakes', '错题'], ['/mastery', '掌握'], ['/plan-map', '计划']]) {
  await page.goto(`${WEB}${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => null);
  await page.waitForTimeout(2500);
  const t = (await page.locator('body').first().textContent().catch(() => '')) ?? '';
  record(`ploop-${route.slice(1)}`, page.url().includes(route) && t.includes(marker), route, 'renders');
}
record('ploop-no-errors', errs.length === 0, `${errs.length} pageerrors`, 'zero');
await browser.close();
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'PLOOP-LIVE', capturedAt: new Date().toISOString(), identifier, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/ploop-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`PLOOP live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
