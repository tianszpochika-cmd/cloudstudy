// Recovery console live (M6-009, decision 1A): two-person recovery
// request -> self-approve denied -> approve -> execute + saga sweep,
// plus the admin-web RecoveryPage render. Staff carry admin.recovery.*
// (documented local fixture); DLQ replay stays an operator script.
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const WEB = 'http://127.0.0.1:18181';
const stamp = Date.now().toString(36);
const device = { deviceType: 'WEB', clientVersion: 'wrc-1', deviceName: 'recovery' };
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
async function call(method, path, { token, body } = {}) {
  const h = { accept: 'application/json', 'x-client-platform': 'web', origin: 'http://127.0.0.1:18180', 'idempotency-key': `wrc-live-${stamp}-${++idemN}-k`.slice(0, 60) };
  if (token) h.authorization = `Bearer ${token}`;
  if (body !== undefined) h['content-type'] = 'application/json';
  const res = await fetch(GW + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json };
}
const data = (r) => r.json?.data ?? r.json ?? {};
async function staffer(tag) {
  const identifier = `test-${tag}-${stamp}@local.invalid`;
  const password = `E2eX${stamp}Aa9!xQ`;
  await call('POST', '/api/v1/auth/register', { body: { identifier, password, device } });
  execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-e', `UPDATE iam_service.iam_account SET roles = 'staff', permissions = 'admin.recovery.read,admin.recovery.request,admin.recovery.command' WHERE identifier = '${identifier}'`], { stdio: 'ignore' });
  const r = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device } });
  return { identifier, password, token: r.json?.data?.accessToken ?? null };
}
const a = await staffer('reqa');
const b = await staffer('reqb');
record('staff-ready', !!(a.token && b.token), 'two staff tokens', 'tokens');
let r = await call('POST', '/api/v1/admin/recovery/recoveries', { token: a.token, body: { subjectType: 'TICKET', subjectId: `wrc-${stamp}`, action: 'REOPEN', reason: 'live probe' } });
const rid = data(r).recoveryId ?? null;
record('recovery-request', [200, 201].includes(r.status) && !!rid, `HTTP ${r.status}`, 'HTTP 201 + id');
r = await call('POST', `/api/v1/admin/recovery/recoveries/${rid}/approve`, { token: a.token, body: {} });
record('self-approve-denied', r.status === 403, `HTTP ${r.status}`, 'HTTP 403 two-person');
r = await call('POST', `/api/v1/admin/recovery/recoveries/${rid}/approve`, { token: b.token, body: {} });
record('recovery-approve', r.status === 200 && (data(r).status ?? '') === 'APPROVED', `HTTP ${r.status}`, 'HTTP 200 APPROVED');
r = await call('POST', `/api/v1/admin/recovery/recoveries/${rid}/execute`, { token: b.token, body: {} });
record('recovery-execute', r.status === 200 && (data(r).status ?? '') === 'EXECUTED', `HTTP ${r.status}`, 'HTTP 200 EXECUTED');
r = await call('GET', '/api/v1/admin/recovery/sagas/unfinished', { token: a.token });
record('sagas-unfinished', r.status === 200 && Array.isArray(data(r)), `HTTP ${r.status}`, 'HTTP 200 list');
// browser: recovery page renders + request via UI.
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 130)));
await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(2000);
await page.getByLabel(/管理员账号|邮箱/i).first().fill(a.identifier);
await page.getByLabel(/密码/i).first().fill(a.password);
await page.getByRole('button', { name: /登录后台/ }).first().click();
await page.waitForTimeout(5000);
await page.goto(`${WEB}/recovery`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(4000);
let body = (await page.locator('body').first().textContent().catch(() => '')) ?? '';
record('recovery-renders', page.url().includes('/recovery') && body.includes('人工恢复'), page.url(), 'renders');
await page.getByLabel(/对象标识/).first().fill(`wrc-ui-${stamp}`);
await page.getByLabel(/原因/).first().fill('live ui probe');
await page.getByRole('button', { name: /提交恢复申请/ }).first().click();
await page.waitForTimeout(5000);
body = (await page.locator('body').first().textContent().catch(() => '')) ?? '';
record('recovery-ui-request', /单号|REQUESTED/.test(body), 'request via UI', 'submitted');
record('recovery-no-errors', errs.length === 0, `${errs.length} pageerrors`, 'zero');
await browser.close();
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'RECOVERY-LIVE', capturedAt: new Date().toISOString(), recoveryId: rid, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/recovery-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`RECOVERY live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
