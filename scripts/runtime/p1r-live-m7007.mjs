// M7-007 live: sandbox payment callbacks out-of-order + amount-conflict.
// Signed with the local-only sandbox HMAC secret (documented); provider
// callback surface has no gateway projection by design, so these legs run
// direct against commerce-service :18096.
import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const CM = 'http://127.0.0.1:18096';
const IAM = 'http://127.0.0.1:18087';
const SECRET = 'change-me-in-test-only';
const stamp = Date.now().toString(36);
const device = { deviceType: 'WEB', clientVersion: 'w7007-live-1', deviceName: 'w7007-live-probe' };
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
const idem = (s) => `w7007-live-${stamp}-${++idemN}-${s}`.slice(0, 60);
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
const payPayload = (ev, order, amount, cur, rc) => `${ev}|${order}|${amount}|${cur}|${rc}`;
let r = await call(GW, 'POST', '/api/v1/auth/register', { body: { identifier: `w7007-${stamp}@local.invalid`, password: `E2eLive${stamp}Aa9!xQ`, device }, idemKey: idem('reg') });
record('setup-register', r.status === 201, `HTTP ${r.status}`, 'HTTP 201');
const t0 = r.json?.data?.accessToken ?? null;
await call(GW, 'POST', '/api/v1/iam/adult-gate', { token: t0, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idemKey: idem('gate') });
for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
  await call(GW, 'PUT', '/api/v1/iam/consents', { token: t0, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idemKey: idem(`c-${t}`) });
}
r = await call(GW, 'POST', '/api/v1/auth/login', { body: { identifier: `w7007-${stamp}@local.invalid`, password: `E2eLive${stamp}Aa9!xQ`, device }, idemKey: idem('login') });
const token = r.json?.data?.accessToken ?? null;
record('setup-login', r.status === 200 && !!token, `HTTP ${r.status}`, 'HTTP 200 + token');
// order + sandbox intent.
r = await call(GW, 'POST', '/api/v1/commerce/orders', { token, body: { skuId: 'local-10x-sku-01' }, idemKey: idem('order') });
const orderId = data(r).orderId ?? null;
record('order-create', [200, 201].includes(r.status) && !!orderId, `HTTP ${r.status}`, 'HTTP 200/201 + id');
r = await call(GW, 'POST', `/api/v1/commerce/orders/${orderId}/payment-intents`, { token, body: { provider: 'SANDBOX' }, idemKey: idem('pay') });
record('pay-intent', [200, 201, 202].includes(r.status), `HTTP ${r.status}`, 'sandbox intent');
const snap = mysql(`SELECT amount_minor, currency FROM commerce_service.commerce_order WHERE order_id = '${orderId}'`).split(/\s+/);
const amount = snap[0], currency = snap[1] ?? 'CNY';
record('snapshot-read', !!amount, `amount=${amount} currency=${currency}`, 'price snapshot');
// provider callbacks authenticate as a workload (service token), never as
// the learner: the learner call below must deny first (negative leg).
{
  const ev = `w7007-${stamp}-userneg`;
  const payload = payPayload(ev, orderId, Number(amount), currency, 'SUCCESS');
  const c = await call(CM, 'POST', '/internal/v1/commerce/providers/SANDBOX/callbacks', { token, body: { providerEventId: ev, orderId, amountMinor: Number(amount), currency, payload, signature: sign(payload), resultCode: 'SUCCESS' }, idemKey: idem('cb-userneg') });
  record('learner-callback-denied', c.status === 401, `HTTP ${c.status}`, 'HTTP 401 workload only');
}
r = await call(IAM, 'POST', '/internal/v1/iam/service-token', { body: { clientId: 'api-gateway', clientSecret: 'local-gateway-service-secret' } });
const svc = data(r).accessToken ?? null;
record('service-token', r.status === 200 && !!svc, `HTTP ${r.status}`, 'workload token');
const CB = async (ev, amt, cur, rc, key, sig) => {
  const payload = payPayload(ev, orderId, amt, cur, rc);
  return call(CM, 'POST', '/internal/v1/commerce/providers/SANDBOX/callbacks', { token: svc, body: { providerEventId: ev, orderId, amountMinor: amt, currency: cur, payload, signature: sig ?? sign(payload), resultCode: rc }, idemKey: idem(key) });
};
// amount-conflict: signed but wrong amount.
{
  const c = await CB(`w7007-${stamp}-wrong`, Number(amount) + 1, currency, 'SUCCESS', 'cb-wrong');
  record('amount-conflict', c.status === 409 && JSON.stringify(c.json).includes('PAYMENT_AMOUNT_MISMATCH'), `HTTP ${c.status}`, 'HTTP 409 AMOUNT_MISMATCH');
}
// bad signature.
{
  const ev = `w7007-${stamp}-badsig`;
  const payload = payPayload(ev, orderId, Number(amount), currency, 'SUCCESS');
  const c = await call(CM, 'POST', '/internal/v1/commerce/providers/SANDBOX/callbacks', { token: svc, body: { providerEventId: ev, orderId, amountMinor: Number(amount), currency, payload, signature: 'sha256=deadbeef', resultCode: 'SUCCESS' }, idemKey: idem('cb-badsig') });
  record('bad-signature', c.status === 409 && JSON.stringify(c.json).includes('SIGNATURE_INVALID'), `HTTP ${c.status}`, 'HTTP 409 SIGNATURE_INVALID');
}
// correct callback -> APPLIED, order paid.
const evOk = `w7007-${stamp}-ok`;
{
  const c = await CB(evOk, Number(amount), currency, 'SUCCESS', 'cb-ok');
  record('callback-applied', [200, 201].includes(c.status) && data(c).state === 'APPLIED', `HTTP ${c.status} state=${data(c).state}`, 'APPLIED');
}
// out-of-order: same event rebound to another payload -> replay conflict.
{
  const c = await CB(evOk, Number(amount), currency, 'FAILED', 'cb-rebind');
  record('replay-conflict', c.status === 409 && JSON.stringify(c.json).includes('REPLAY_CONFLICT'), `HTTP ${c.status}`, 'HTTP 409 REPLAY_CONFLICT');
}
// out-of-order: fresh event after paid (no pending attempt).
{
  const c = await CB(`w7007-${stamp}-late`, Number(amount), currency, 'SUCCESS', 'cb-late');
  const body = JSON.stringify(c.json);
  record('late-no-pending', c.status === 409 && (body.includes('ATTEMPT_NOT_PENDING') || body.includes('DUPLICATE')), `HTTP ${c.status}`, 'HTTP 409 no pending attempt');
}
// identical replay -> DUPLICATE absorbed.
{
  const c = await CB(evOk, Number(amount), currency, 'SUCCESS', 'cb-dup');
  record('duplicate-absorbed', [200, 201].includes(c.status) && data(c).state === 'DUPLICATE', `HTTP ${c.status} state=${data(c).state}`, 'DUPLICATE');
}
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'M7007-LIVE-CALLBACKS', capturedAt: new Date().toISOString(), gateway: GW, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/m7007-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`M7007 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
