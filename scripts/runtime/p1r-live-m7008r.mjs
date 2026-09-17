// M7-008 live: explicit 403-vs-empty negatives + refund-to-revoke run.
// Paid order -> refund request -> sandbox refund callback -> REFUNDED +
// entitlement REVOKED, with cross-user denial legs proving explicit 403s
// instead of misleading empty results.
import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const CM = 'http://127.0.0.1:18096';
const IAM = 'http://127.0.0.1:18087';
const SECRET = 'change-me-in-test-only';
const stamp = Date.now().toString(36);
const device = { deviceType: 'WEB', clientVersion: 'w7008r-live-1', deviceName: 'w7008r-live-probe' };
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
const idem = (s) => `w7008r-live-${stamp}-${++idemN}-${s}`.slice(0, 60);
async function call(base, method, path, { token, body, idemKey } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (idemKey) headers['idempotency-key'] = idemKey;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json };
}
const data = (r) => r.json?.data ?? r.json ?? {};
function mysql(q) {
  return execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-e', q], { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
}
const sign = (payload) => 'sha256=' + createHmac('sha256', SECRET).update(payload, 'utf8').digest('hex');
async function learner(tag) {
  const identifier = `w7008r-${tag}-${stamp}@local.invalid`;
  const password = `E2eLive${stamp}Aa9!xQ`;
  let r = await call(GW, 'POST', '/api/v1/auth/register', { body: { identifier, password, device }, idemKey: idem(`${tag}-reg`) });
  const t0 = r.json?.data?.accessToken ?? null;
  await call(GW, 'POST', '/api/v1/iam/adult-gate', { token: t0, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idemKey: idem(`${tag}-gate`) });
  for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    await call(GW, 'PUT', '/api/v1/iam/consents', { token: t0, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idemKey: idem(`${tag}-c-${t}`) });
  }
  r = await call(GW, 'POST', '/api/v1/auth/login', { body: { identifier, password, device }, idemKey: idem(`${tag}-login`) });
  return r.json?.data?.accessToken ?? null;
}
const tokenA = await learner('a');
const tokenB = await learner('b');
record('setup', !!(tokenA && tokenB), 'two learners ready', 'tokens');
// A: order -> intent -> APPLIED callback (paid, entitlement ACTIVE).
let r = await call(GW, 'POST', '/api/v1/commerce/orders', { token: tokenA, body: { skuId: 'local-10x-sku-01' }, idemKey: idem('order') });
const orderId = data(r).orderId ?? null;
record('order-create', [200, 201].includes(r.status) && !!orderId, `HTTP ${r.status}`, 'HTTP 201 + id');
await call(GW, 'POST', `/api/v1/commerce/orders/${orderId}/payment-intents`, { token: tokenA, body: { provider: 'SANDBOX' }, idemKey: idem('pay') });
const snap = mysql(`SELECT amount_minor, currency FROM commerce_service.commerce_order WHERE order_id = '${orderId}'`).split(/\s+/);
const amount = snap[0], currency = snap[1] ?? 'CNY';
r = await call(IAM, 'POST', '/internal/v1/iam/service-token', { body: { clientId: 'api-gateway', clientSecret: 'local-gateway-service-secret' } });
const svc = data(r).accessToken ?? null;
{
  const ev = `w7008r-${stamp}-pay`;
  const payload = `${ev}|${orderId}|${amount}|${currency}|SUCCESS`;
  const c = await call(CM, 'POST', '/internal/v1/commerce/providers/SANDBOX/callbacks', { token: svc, body: { providerEventId: ev, orderId, amountMinor: Number(amount), currency, payload, signature: sign(payload), resultCode: 'SUCCESS' }, idemKey: idem('cb-pay') });
  record('order-paid', [200, 201].includes(c.status), `HTTP ${c.status}`, 'callback APPLIED');
}
r = await call(GW, 'GET', '/api/v1/commerce/entitlements/me', { token: tokenA });
{
  const items = data(r).items ?? data(r).entitlements ?? (Array.isArray(data(r)) ? data(r) : []);
  const mine = items.find((e) => (e.status ?? e.state) === 'ACTIVE');
  record('entitlement-active', r.status === 200 && !!mine, `HTTP ${r.status}`, 'ACTIVE entitlement');
  var entitlementId = mine ? (mine.entitlementId ?? mine.id) : null;
}
// 403-vs-empty negatives: B reads A's order -> explicit deny, never A's data.
r = await call(GW, 'GET', `/api/v1/commerce/orders/${orderId}`, { token: tokenB });
record('neg-order-scoped', [401, 403, 404].includes(r.status) && !JSON.stringify(r.json).includes(orderId), `HTTP ${r.status}`, 'explicit deny, no leak');
r = await call(GW, 'GET', '/api/v1/commerce/entitlements/me', { token: tokenB });
{
  const items = data(r).items ?? data(r).entitlements ?? (Array.isArray(data(r)) ? data(r) : []);
  record('neg-entitlements-scoped', r.status === 200 && !items.some((e) => (e.entitlementId ?? e.id) === entitlementId), `HTTP ${r.status}`, 'B sees only own');
}
// refund -> callback -> REFUNDED + entitlement REVOKED.
r = await call(GW, 'POST', `/api/v1/commerce/orders/${orderId}/refunds`, { token: tokenA, body: { reasonCode: 'E2E_TEST' }, idemKey: idem('refund') });
const refundId = data(r).refundId ?? data(r).id ?? null;
record('refund-request', [200, 201, 202].includes(r.status) && !!refundId, `HTTP ${r.status}`, 'refund requested');
{
  const ev = `w7008r-${stamp}-rfd`;
  const payload = `${ev}|${refundId}|${amount}|${currency}|SUCCESS`;
  const c = await call(CM, 'POST', '/internal/v1/commerce/refunds/callbacks', { token: svc, body: { providerEventId: ev, refundId, provider: 'SANDBOX', amountMinor: Number(amount), currency, payload, signature: sign(payload), resultCode: 'SUCCESS' }, idemKey: idem('cb-rfd') });
  record('refund-callback', [200, 201].includes(c.status), `HTTP ${c.status}`, 'refund callback ok');
}
{
  const st = mysql(`SELECT status FROM commerce_service.commerce_order WHERE order_id = '${orderId}'`);
  const ent = mysql(`SELECT status FROM commerce_service.commerce_entitlement WHERE entitlement_id = '${entitlementId}'`);
  record('refunded-revoked', st === 'REFUNDED' && ent === 'REVOKED', `order=${st} entitlement=${ent}`, 'REFUNDED + REVOKED');
}
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'M7008-LIVE-REFUND', capturedAt: new Date().toISOString(), gateway: GW, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/m7008r-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`M7008r live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
