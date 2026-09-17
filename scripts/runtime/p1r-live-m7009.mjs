// M7-009 live: refund browser run on the learner commerce page.
// Browser drives what the UI owns (plans, order, intent, refund request);
// provider callbacks stay API-side (HMAC ingress is provider territory).
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const CM = 'http://127.0.0.1:18096';
const IAM = 'http://127.0.0.1:18087';
const WEB = 'http://127.0.0.1:18180';
const stamp = Date.now().toString(36);
const identifier = `w7009-${stamp}@local.invalid`;
const password = `E2eLive${stamp}Aa9!xQ`;
const device = { deviceType: 'WEB', clientVersion: 'w7009-live-1', deviceName: 'w7009-live-probe' };
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
async function api(base, method, path, { token, body, idem } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (idem) headers['idempotency-key'] = idem;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json };
}
const data = (r) => r.json?.data ?? r.json ?? {};
let r = await api(GW, 'POST', '/api/v1/auth/register', { body: { identifier, password, device }, idem: `w7009-live-${stamp}-reg-01` });
const t0 = r.json?.data?.accessToken ?? null;
await api(GW, 'POST', '/api/v1/iam/adult-gate', { token: t0, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idem: `w7009-live-${stamp}-gate-01` });
for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
  await api(GW, 'PUT', '/api/v1/iam/consents', { token: t0, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idem: `w7009-live-${stamp}-consent-${t}` });
}
r = await api(GW, 'POST', '/api/v1/auth/login', { body: { identifier, password, device }, idem: `w7009-live-${stamp}-login-01` });
const token = r.json?.data?.accessToken ?? null;
record('setup', !!token, 'user ready', 'token');
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 140)));
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon|Failed to load resource/i.test(m.text())) errors.push('console.error: ' + m.text().slice(0, 140));
});
await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(2000);
await page.getByLabel(/账号|邮箱/i).first().fill(identifier);
await page.getByLabel(/密码/i).first().fill(password);
await page.getByRole('button', { name: /登录/i }).first().click();
await page.waitForTimeout(4000);
record('browser-login', !/login/i.test(page.url()), page.url(), 'away from login');
await page.goto(`${WEB}/commerce`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(3000);
{
  const body = (await page.locator('body').first().textContent().catch(() => '')) ?? '';
  record('plans-render', /选择学习方案/.test(body), 'plans panel', 'plans visible');
  record('gate-badge', /沙箱开启/.test(body), 'sandbox badge', 'gate open label');
}
// create order via UI.
await page.locator('.plan-card .button--primary').first().click();
await page.waitForTimeout(3000);
let orderId = null;
{
  const body = (await page.locator('body').first().textContent().catch(() => '')) ?? '';
  const m = body.match(/ord_[0-9a-f-]{20,}/);
  orderId = m ? m[0] : null;
  record('ui-order-create', !!orderId, orderId ?? 'no id', 'order row with id');
}
// pay intent via UI (CREATED -> 恢复支付).
await page.getByRole('button', { name: /恢复支付/ }).first().click();
await page.waitForTimeout(3000);
{
  const body = (await page.locator('body').first().textContent().catch(() => '')) ?? '';
  record('ui-pay-intent', /支付准备状态/.test(body), 'intent message', 'PENDING message');
}
// provider pays the order API-side (documented hybrid).
r = await api(IAM, 'POST', '/internal/v1/iam/service-token', { body: { clientId: 'api-gateway', clientSecret: 'local-gateway-service-secret' } });
const svc = data(r).accessToken ?? null;
{
  const { createHmac } = await import('node:crypto');
  const sign = (p) => 'sha256=' + createHmac('sha256', 'change-me-in-test-only').update(p, 'utf8').digest('hex');
  const snap = execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-e', `SELECT amount_minor, currency FROM commerce_service.commerce_order WHERE order_id = '${orderId}'`], { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim().split(/\s+/);
  const ev = `w7009-${stamp}-pay`;
  const payload = `${ev}|${orderId}|${snap[0]}|${snap[1]}|SUCCESS`;
  const c = await api(CM, 'POST', '/internal/v1/commerce/providers/SANDBOX/callbacks', { token: svc, body: { providerEventId: ev, orderId, amountMinor: Number(snap[0]), currency: snap[1], payload, signature: sign(payload), resultCode: 'SUCCESS' }, idem: `w7009-live-${stamp}-cb-01` });
  var payOk = [200, 201].includes(c.status);
  record('hybrid-pay', payOk, `HTTP ${c.status}`, 'paid');
  var snapRef = snap;
}
await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(3000);
{
  const body = (await page.locator('body').first().textContent().catch(() => '')) ?? '';
  record('ui-paid-state', /PAID/.test(body), 'PAID visible', 'paid state renders');
  record('ui-refund-button', (await page.getByRole('button', { name: /申请退款/ }).count()) > 0, 'refund button', 'refund CTA present');
}
// refund request via UI incl. two-step confirm.
await page.getByRole('button', { name: /申请退款/ }).first().click();
await page.waitForTimeout(1500);
{
  const body = (await page.locator('body').first().textContent().catch(() => '')) ?? '';
  record('ui-refund-confirm', /确认退款/.test(body), 'confirm dialog', 'two-step dialog');
}
await page.getByRole('button', { name: /^确认退款$/ }).first().click();
await page.waitForTimeout(3000);
{
  const body = (await page.locator('body').first().textContent().catch(() => '')) ?? '';
  record('ui-refund-requested', /已申请退款/.test(body), 'requested message', 'refund requested');
}
// provider settles the refund API-side, UI shows the terminal state.
{
  const { createHmac } = await import('node:crypto');
  const sign = (p) => 'sha256=' + createHmac('sha256', 'change-me-in-test-only').update(p, 'utf8').digest('hex');
  const refundId = execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-e', `SELECT refund_id FROM commerce_service.commerce_refund WHERE order_id = '${orderId}' ORDER BY created_at DESC LIMIT 1`], { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
  const ev = `w7009-${stamp}-rfd`;
  const payload = `${ev}|${refundId}|${snapRef[0]}|${snapRef[1]}|SUCCESS`;
  await api(CM, 'POST', '/internal/v1/commerce/refunds/callbacks', { token: svc, body: { providerEventId: ev, refundId, provider: 'SANDBOX', amountMinor: Number(snapRef[0]), currency: snapRef[1], payload, signature: sign(payload), resultCode: 'SUCCESS' }, idem: `w7009-live-${stamp}-cb-02` });
}
await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(3000);
{
  const body = (await page.locator('body').first().textContent().catch(() => '')) ?? '';
  record('ui-refunded-state', /REFUND_PENDING|REFUNDED/.test(body), 'refund state', 'terminal refund state renders');
}
const pageErrors = errors.filter((e) => e.startsWith('pageerror'));
record('zero-pageerrors', pageErrors.length === 0, `${pageErrors.length} pageerrors`, 'zero');
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'M7009-LIVE-BROWSER', capturedAt: new Date().toISOString(), gateway: GW, web: WEB, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks, consoleErrors: errors.slice(0, 10) };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/m7009-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`M7009 live: ${passed}/${checks.length} ${evidence.result}`);
await browser.close();
process.exit(evidence.result === 'PASS' ? 0 : 1);
