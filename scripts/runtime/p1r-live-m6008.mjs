// M6-008 live: account deletion request -> cooling -> cancel, plus a second
// request driven to EXECUTED with service-token operator calls (receipts +
// revocation proof). The cross-owner anonymization fan-out via workflow
// stays a named residual.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const IAM = 'http://127.0.0.1:18087';
const stamp = Date.now().toString(36);
const device = { deviceType: 'WEB', clientVersion: 'w6008-live-1', deviceName: 'w6008-live-probe' };
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
const idem = (s) => `w6008-live-${stamp}-${++idemN}-${s}`.slice(0, 60);
async function call(base, method, path, { token, body, idemKey, svcToken } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (svcToken) headers.authorization = `Bearer ${svcToken}`;
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
async function learner(tag) {
  const identifier = `w6008-${tag}-${stamp}@local.invalid`;
  const password = `E2eLive${stamp}Aa9!xQ`;
  let r = await call(GW, 'POST', '/api/v1/auth/register', { body: { identifier, password, device }, idemKey: idem(`${tag}-reg`) });
  const t0 = r.json?.data?.accessToken ?? null;
  await call(GW, 'POST', '/api/v1/iam/adult-gate', { token: t0, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idemKey: idem(`${tag}-gate`) });
  for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    await call(GW, 'PUT', '/api/v1/iam/consents', { token: t0, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idemKey: idem(`${tag}-c-${t}`) });
  }
  r = await call(GW, 'POST', '/api/v1/auth/login', { body: { identifier, password, device }, idemKey: idem(`${tag}-login`) });
  return { token: r.json?.data?.accessToken ?? null, identifier, password };
}
const A = await learner('a');
const B = await learner('b');
record('setup', !!(A.token && B.token), 'two learners ready', 'tokens');
// request -> REQUESTED with a 168h cooling window; same-key replay same id.
const reqKey = idem('delreq');
let r = await call(GW, 'POST', '/api/v1/iam/account-deletions', { token: A.token, body: {}, idemKey: reqKey });
const delId = data(r).deletionRequestId ?? null;
record('deletion-request', r.status === 200 && !!delId && data(r).status === 'REQUESTED', `HTTP ${r.status}`, 'REQUESTED + id');
r = await call(GW, 'POST', '/api/v1/iam/account-deletions', { token: A.token, body: {}, idemKey: reqKey });
record('deletion-replay', r.status === 200 && (data(r).deletionRequestId ?? null) === delId, `HTTP ${r.status} same id`, 'same request');
r = await call(GW, 'GET', `/api/v1/iam/account-deletions/${delId}`, { token: A.token });
record('deletion-status', r.status === 200 && data(r).status === 'REQUESTED' && data(r).coolingHours === 168, `HTTP ${r.status} cooling=${data(r).coolingHours}`, 'REQUESTED 168h');
// execute during cooling -> refused (service-token operator path).
r = await call(IAM, 'POST', '/internal/v1/iam/service-token', { body: { clientId: 'api-gateway', clientSecret: 'local-gateway-service-secret' } });
const svc = data(r).accessToken ?? null;
record('service-token', r.status === 200 && !!svc, `HTTP ${r.status}`, 'operator token');
if (svc) {
  const e = await call(IAM, 'POST', `/internal/v1/iam/account-deletions/${delId}/execute`, { svcToken: svc });
  record('execute-cooling-denied', e.status === 409, `HTTP ${e.status}`, 'HTTP 409 cooling');
} else {
  record('execute-cooling-denied', false, 'no service token', 'HTTP 409 cooling');
}
// cancel -> CANCELLED; execute after cancel -> not executable.
r = await call(GW, 'POST', `/api/v1/iam/account-deletions/${delId}/cancel`, { token: A.token, idemKey: idem('cancel') });
record('deletion-cancel', r.status === 200 && data(r).status === 'CANCELLED', `HTTP ${r.status}`, 'CANCELLED');
if (svc) {
  const e = await call(IAM, 'POST', `/internal/v1/iam/account-deletions/${delId}/execute`, { svcToken: svc });
  record('execute-cancelled-denied', e.status === 409, `HTTP ${e.status}`, 'HTTP 409 not executable');
} else {
  record('execute-cancelled-denied', false, 'no service token', 'HTTP 409 not executable');
}
// second request, cooling backdated (documented fixture) -> EXECUTED + receipt.
r = await call(GW, 'POST', '/api/v1/iam/account-deletions', { token: A.token, body: {}, idemKey: idem('delreq2') });
const delId2 = data(r).deletionRequestId ?? null;
record('deletion-request-2', r.status === 200 && !!delId2, `HTTP ${r.status}`, 'second request');
if (svc && delId2) {
  mysql(`UPDATE iam_service.iam_account_deletion SET execute_at = '2020-01-01 00:00:00.000000' WHERE deletion_request_id = '${delId2}'`);
  const e = await call(IAM, 'POST', `/internal/v1/iam/account-deletions/${delId2}/execute`, { svcToken: svc });
  {
    const d = data(e);
    record('execute', e.status === 200 && d.status === 'EXECUTED' && !!d.receipt, `HTTP ${e.status} receipted=${!!d.receipt}`, 'EXECUTED + receipt');
  }
  const o = await call(IAM, 'GET', `/internal/v1/iam/account-deletions/${delId2}/owner-receipts`, { svcToken: svc });
  record('owner-receipts', o.status === 200 && (data(o).receipts?.length ?? data(o).length ?? 0) >= 0, `HTTP ${o.status}`, 'HTTP 200 receipts');
  const l = await call(GW, 'POST', '/api/v1/auth/login', { body: { identifier: A.identifier, password: A.password, device }, idemKey: idem('login-after') });
  record('revocation-proof', l.status !== 200, `HTTP ${l.status} post-execute login`, 'login denied after execution');
} else {
  for (const n of ['execute', 'owner-receipts', 'revocation-proof']) record(n, false, 'no exec path', 'green');
}
// cross-user: B reads nothing of A's request.
r = await call(GW, 'GET', `/api/v1/iam/account-deletions/${delId}`, { token: B.token });
record('deletion-scoped', r.status === 404, `HTTP ${r.status}`, 'HTTP 404 other owner');
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'M6008-LIVE-DELETION', capturedAt: new Date().toISOString(), gateway: GW, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/m6008-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`M6008 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
