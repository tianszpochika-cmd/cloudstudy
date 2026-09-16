// W7 live: staff ticket lifecycle (M6-005 parity + M7 transitions).
// Staff provisioning: register via API, then DB-grant narrow admin perms
// (support.ticket.read/manage). Local-test fixture practice, documented:
// no staff seed exists and the JWT role/perm mechanism is the designed path.
// Learner creates -> staff lists (same schema) -> START -> RESOLVE with
// confirmation challenge -> learner sees RESOLVED.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const AV = 'http://127.0.0.1:18097';
const stamp = Date.now().toString(36);
const device = { deviceType: 'WEB', clientVersion: 'w7-live-1', deviceName: 'w7-live-probe' };
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
const idem = (s) => `w7-live-${stamp}-${++idemN}-${s}`.slice(0, 60);
async function call(base, method, path, { token, body, rawBody, headers = {} } = {}) {
  const h = { accept: 'application/json', 'x-client-platform': 'web', origin: 'http://127.0.0.1:18180', ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  if (body !== undefined || rawBody !== undefined) h['content-type'] = 'application/json';
  const idemKey = idem(`k${++idemN}`);
  h['idempotency-key'] = idemKey;
  const res = await fetch(base + path, { method, headers: h, body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)), redirect: 'manual' });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json };
}
function mysql(q) {
  return execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-e', q], { encoding: 'utf8', shell: false }).trim();
}
const data = (r) => r.json?.data ?? r.json ?? {};
async function setup(identifier, password) {
  let r = await call(GW, 'POST', '/api/v1/auth/register', { body: { identifier, password, device } });
  let token = r.json?.data?.accessToken ?? null;
  await call(GW, 'POST', '/api/v1/iam/adult-gate', { token, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' } });
  for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    await call(GW, 'PUT', '/api/v1/iam/consents', { token, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' } });
  }
  r = await call(GW, 'POST', '/api/v1/auth/login', { body: { identifier, password, device } });
  return r.json?.data?.accessToken ?? null;
}
const ltok = await setup(`w7l-${stamp}@local.invalid`, `E2eLive${stamp}Aa9!xQ`);
record('setup-learner', !!ltok, 'learner ready', 'token');
let r = await call(GW, 'POST', '/api/v1/support/tickets', { token: ltok, body: { categoryCode: 'TECHNICAL', resourceRef: 'w7-probe', descriptionFingerprint: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', priority: 'NORMAL' } });
const ticketId = data(r).ticket?.ticketId ?? null;
record('ticket-create', [200, 201].includes(r.status) && !!ticketId, `HTTP ${r.status}`, 'HTTP 200/201 + id');
// staff provisioning (documented local fixture).
const sid = `test-staff-${stamp}@local.invalid`;
const spw = `E2eStaff${stamp}Aa9!xQ`;
await setup(sid, spw);
mysql(`UPDATE iam_service.iam_account SET roles = 'staff', permissions = 'support.ticket.read,support.ticket.manage' WHERE identifier = '${sid}'`);
r = await call(GW, 'POST', '/api/v1/auth/login', { body: { identifier: sid, password: spw, device } });
const stok = r.json?.data?.accessToken ?? null;
record('staff-provisioned', r.status === 200 && !!stok, `HTTP ${r.status}`, 'HTTP 200 + token');
// admin list sees it; compare schema keys with learner view.
r = await call(GW, 'GET', '/api/v1/admin/ops/tickets?includeAll=true', { token: stok });
const items = data(r).items ?? [];
const adminView = items.find((t) => (t.ticketId ?? t.id) === ticketId) ?? null;
record('admin-list', r.status === 200 && !!adminView, `HTTP ${r.status} n=${items.length}`, 'HTTP 200 sees ticket');
const lr = await call(GW, 'GET', `/api/v1/support/tickets/${ticketId}`, { token: ltok });
const learnerKeys = Object.keys(data(lr).ticket ?? data(lr) ?? {}).sort().join(',');
const adminKeys = adminView ? Object.keys(adminView).sort().join(',') : '';
record('same-schema', !!adminView && learnerKeys === adminKeys, `learner=[${learnerKeys}] admin=[${adminKeys}]`, 'identical keys');
// START needs no confirmation.
r = await call(AV, 'POST', `/internal/v1/admin-ops/support/tickets/${ticketId}/transitions`, { token: stok, rawBody: '"START"' });
record('transition-start', r.status === 200 && (data(r).ticket?.state ?? data(r).state) === 'IN_PROGRESS', `HTTP ${r.status}`, 'HTTP 200 IN_PROGRESS');
// RESOLVE needs prepare challenge + confirmation token.
r = await call(AV, 'POST', `/internal/v1/admin-ops/support/tickets/${ticketId}/transitions/prepare`, { token: stok, rawBody: '"RESOLVE"' });
const challenge = data(r).token ?? null;
record('prepare-resolve', r.status === 200 && !!challenge, `HTTP ${r.status}`, 'HTTP 200 + challenge');
r = await call(AV, 'POST', `/internal/v1/admin-ops/support/tickets/${ticketId}/transitions`, { token: stok, rawBody: '"RESOLVE"', headers: challenge ? { 'X-Confirmation-Token': challenge } : {} });
record('transition-resolve', r.status === 200 && (data(r).ticket?.state ?? data(r).state) === 'RESOLVED', `HTTP ${r.status}`, 'HTTP 200 RESOLVED');
r = await call(GW, 'GET', `/api/v1/support/tickets/${ticketId}`, { token: ltok });
record('learner-sees-resolved', r.status === 200 && (data(r).ticket?.state ?? data(r).state) === 'RESOLVED', `HTTP ${r.status}`, 'HTTP 200 RESOLVED');
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'W7-LIVE-STAFF', capturedAt: new Date().toISOString(), ticketId, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/w7-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`W7 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
