// M6-007 live: privacy export request -> status -> download descriptor ->
// expiry, with idempotent replay and principal scoping. The cross-owner
// worker fan-out via workflow stays a named residual; these legs prove the
// durable job lifecycle the worker will consume.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const stamp = Date.now().toString(36);
const device = { deviceType: 'WEB', clientVersion: 'w6007-live-1', deviceName: 'w6007-live-probe' };
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
const idem = (s) => `w6007-live-${stamp}-${++idemN}-${s}`.slice(0, 60);
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
function mysql(q) {
  return execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-e', q], { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
}
async function learner(tag) {
  const identifier = `w6007-${tag}-${stamp}@local.invalid`;
  const password = `E2eLive${stamp}Aa9!xQ`;
  let r = await call('POST', '/api/v1/auth/register', { body: { identifier, password, device }, idemKey: idem(`${tag}-reg`) });
  const t0 = r.json?.data?.accessToken ?? null;
  await call('POST', '/api/v1/iam/adult-gate', { token: t0, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idemKey: idem(`${tag}-gate`) });
  for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    await call('PUT', '/api/v1/iam/consents', { token: t0, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idemKey: idem(`${tag}-c-${t}`) });
  }
  r = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device }, idemKey: idem(`${tag}-login`) });
  return r.json?.data?.accessToken ?? null;
}
const tokenA = await learner('a');
const tokenB = await learner('b');
record('setup', !!(tokenA && tokenB), 'two learners ready', 'tokens');
const subA = JSON.parse(Buffer.from(tokenA.split('.')[1], 'base64').toString()).sub;
// request -> QUEUED, same-key replay returns the same job.
const exKey = idem('export');
let r = await call('POST', '/api/v1/privacy/export', { token: tokenA, body: {}, idemKey: exKey });
const eid = data(r).exportId ?? null;
record('export-request', r.status === 200 && !!eid && data(r).status === 'QUEUED', `HTTP ${r.status}`, 'QUEUED + id');
r = await call('POST', '/api/v1/privacy/export', { token: tokenA, body: {}, idemKey: exKey });
record('export-replay', r.status === 200 && (data(r).exportId ?? null) === eid, `HTTP ${r.status} same id`, 'same job');
// status while queued; download refused while not READY.
r = await call('GET', `/api/v1/privacy/export/${eid}`, { token: tokenA });
record('export-status-queued', r.status === 200 && data(r).status === 'QUEUED', `HTTP ${r.status} status=${data(r).status}`, 'QUEUED');
r = await call('GET', `/api/v1/privacy/export/${eid}/download`, { token: tokenA });
record('download-refused-queued', r.status === 409, `HTTP ${r.status}`, 'HTTP 409 not downloadable');
// worker simulation (documented fixture): mark READY, then descriptor + receipt.
mysql(`UPDATE learner_service.b25_learner_privacy_export SET export_status = 'READY' WHERE export_id = '${eid}'`);
r = await call('GET', `/api/v1/privacy/export/${eid}`, { token: tokenA });
record('export-status-ready', r.status === 200 && data(r).status === 'READY', `HTTP ${r.status}`, 'READY');
r = await call('GET', `/api/v1/privacy/export/${eid}/download`, { token: tokenA });
{
  const d = data(r);
  record('download-descriptor', r.status === 200 && d.status === 'READY' && (d.receipt?.exportId ?? null) === eid && d.redactionPolicy === 'learner-self', `HTTP ${r.status} receipted=${(d.receipt?.exportId ?? null) === eid}`, 'descriptor + receipt');
  const dl = mysql(`SELECT downloaded_at FROM learner_service.b25_learner_privacy_export WHERE export_id = '${eid}'`);
  record('download-stamped', dl !== 'NULL' && dl !== '', 'downloaded_at stamped', 'stamped once');
}
// expiry: backdate the window -> EXPIRED, download refused, row retained.
mysql(`UPDATE learner_service.b25_learner_privacy_export SET expires_at = '2020-01-01 00:00:00.000000' WHERE export_id = '${eid}'`);
r = await call('GET', `/api/v1/privacy/export/${eid}`, { token: tokenA });
record('export-expired', r.status === 200 && data(r).status === 'EXPIRED', `HTTP ${r.status} status=${data(r).status}`, 'EXPIRED');
r = await call('GET', `/api/v1/privacy/export/${eid}/download`, { token: tokenA });
{
  const stillThere = mysql(`SELECT COUNT(*) FROM learner_service.b25_learner_privacy_export WHERE export_id = '${eid}'`);
  record('expired-no-download', r.status === 409 && stillThere === '1', `HTTP ${r.status} row retained=${stillThere === '1'}`, 'HTTP 409 + audit row kept');
}
// principal scoping: B sees nothing of A's export.
r = await call('GET', `/api/v1/privacy/export/${eid}`, { token: tokenB });
record('export-scoped', r.status === 404, `HTTP ${r.status}`, 'HTTP 404 other owner');
r = await call('GET', `/api/v1/privacy/export/${eid}/download`, { token: tokenB });
record('download-scoped', r.status === 404, `HTTP ${r.status}`, 'HTTP 404 other owner');
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'M6007-LIVE-EXPORT', capturedAt: new Date().toISOString(), gateway: GW, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/m6007x-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`M6007x live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
