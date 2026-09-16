// M6-007 live: sandbox activation-code issue -> redeem -> entitlement.
// Issue is staff-only direct-to-service (no gateway projection, documented);
// redeem runs over the gateway. Expiry + replay + double-spend covered.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const CM = 'http://127.0.0.1:18096';
const stamp = Date.now().toString(36);
const device = { deviceType: 'WEB', clientVersion: 'w6007-live-1', deviceName: 'w6007-live-probe' };
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
const idem = (s) => `w6007-live-${stamp}-${++idemN}-${s}`.slice(0, 60);
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
  execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-e', q], { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' });
}
async function learner(tag) {
  const identifier = `w6007-${tag}-${stamp}@local.invalid`;
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
// staff issuer (grant BEFORE gate so the post-gate token carries it).
const identifier = `test-m6007-${stamp}@local.invalid`;
const password = `E2eX${stamp}Aa9!xQ`;
let r = await call(GW, 'POST', '/api/v1/auth/register', { body: { identifier, password, device }, idemKey: idem('sreg') });
let stok = r.json?.data?.accessToken ?? null;
mysql(`UPDATE iam_service.iam_account SET roles = 'staff,commerce-ops', permissions = 'commerce:activation:write' WHERE identifier = '${identifier}'`);
await call(GW, 'POST', '/api/v1/iam/adult-gate', { token: stok, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idemKey: idem('sgate') });
for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
  await call(GW, 'PUT', '/api/v1/iam/consents', { token: stok, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idemKey: idem(`sc-${t}`) });
}
r = await call(GW, 'POST', '/api/v1/auth/login', { body: { identifier, password, device }, idemKey: idem('slogin') });
stok = r.json?.data?.accessToken ?? null;
record('staff-ready', !!stok, 'issuer ready', 'token');
r = await call(CM, 'POST', '/internal/v1/commerce/admin/activation-codes', { token: stok, body: { skuId: 'local-10x-sku-01', expiresAt: new Date(Date.now() + 86400000).toISOString() }, idemKey: idem('issue') });
const code = data(r).code ?? null;
record('issue', r.status === 201 && !!code, `HTTP ${r.status}`, 'HTTP 201 + code');
const token = await learner('a');
record('learner-ready', !!token, 'learner ready', 'token');
// sandbox redeem over the gateway.
const redeemKey = idem('redeem');
r = await call(GW, 'POST', '/api/v1/commerce/activation-codes/redeem', { token, body: { code }, idemKey: redeemKey });
{
  const d = data(r);
  record('redeem', [200, 201].includes(r.status) && d.state === 'REDEEMED' && !!d.entitlementId, `HTTP ${r.status} state=${d.state}`, 'REDEEMED + entitlement');
  var entitlementId = d.entitlementId ?? null;
}
r = await call(GW, 'GET', '/api/v1/commerce/entitlements/me', { token });
{
  const items = data(r).items ?? data(r).entitlements ?? (Array.isArray(data(r)) ? data(r) : []);
  record('entitlement-present', r.status === 200 && items.some((e) => (e.entitlementId ?? e.id) === entitlementId), `HTTP ${r.status}`, 'entitlement listed');
}
// same-key replay absorbed.
r = await call(GW, 'POST', '/api/v1/commerce/activation-codes/redeem', { token, body: { code }, idemKey: redeemKey });
record('redeem-replay', [200, 201].includes(r.status), `HTTP ${r.status} replayed=${data(r).replayed}`, 'absorbed');
// double spend with a fresh key -> unavailable.
r = await call(GW, 'POST', '/api/v1/commerce/activation-codes/redeem', { token, body: { code }, idemKey: idem('redeem2') });
record('double-spend-denied', r.status === 409 && JSON.stringify(r.json).includes('ACTIVATION_CODE_UNAVAILABLE'), `HTTP ${r.status}`, 'HTTP 409 used');
// expired code: issue refuses past expiry (400), so expire via DB fixture,
// then redeem must refuse with ACTIVATION_CODE_EXPIRED.
r = await call(CM, 'POST', '/internal/v1/commerce/admin/activation-codes', { token: stok, body: { skuId: 'local-10x-sku-01', expiresAt: new Date(Date.now() + 86400000).toISOString() }, idemKey: idem('issue-exp') });
const expCode = data(r).code ?? null;
if (r.status === 201 && expCode) {
  mysql(`UPDATE commerce_service.commerce_activation_code SET expires_at = '2020-01-01 00:00:00.000000' WHERE tenant_id = 'platform' AND code_hash = SHA2('${expCode}', 256)`);
  const e = await call(GW, 'POST', '/api/v1/commerce/activation-codes/redeem', { token, body: { code: expCode }, idemKey: idem('redeem-exp') });
  record('expired-denied', e.status === 409 && JSON.stringify(e.json).includes('ACTIVATION_CODE_EXPIRED'), `HTTP ${e.status}`, 'HTTP 409 expired');
} else {
  record('expired-denied', false, `issue HTTP ${r.status}`, 'HTTP 409 expired');
}
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'M6007-LIVE-REDEEM', capturedAt: new Date().toISOString(), gateway: GW, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/m6007-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`M6007 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
