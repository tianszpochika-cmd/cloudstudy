// M5-011 live: late-event rebuild + cross-owner reconciliation. A backdated
// review row (which the API path cannot produce — it stamps now) is inserted
// straight into the owner schema (documented fixture); the date-partitioned
// reports must rebuild from durable facts, and the B25/B3 owner paths must
// agree with each other.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const stamp = Date.now().toString(36);
const identifier = `w5011-${stamp}@local.invalid`;
const password = `E2eLive${stamp}Aa9!xQ`;
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
const idem = (s) => `w5011-live-${stamp}-${++idemN}-${s}`.slice(0, 60);
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
const device = { deviceType: 'WEB', clientVersion: 'w5011-live-1', deviceName: 'w5011-live-probe' };
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
// 3 API reviews today: q5, q4, q2 -> reviewItems=3, accuracy=200/3.
for (let i = 0; i < 3; i++) {
  await call('POST', '/api/v1/learning/srs/reviews', { token, body: { itemId: `w5011-${stamp}-item-${i}`, quality: [5, 4, 2][i] }, idemKey: idem(`rev-${i}`) });
}
r = await call('GET', '/api/v1/learning/stats/daily-report', { token });
record('daily-today', r.status === 200 && data(r).reviewItems === 3, `HTTP ${r.status} reviewItems=${data(r).reviewItems}`, 'reviewItems=3');
// late event: backdated row for yesterday UTC.
const now = new Date();
const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 12, 0, 0));
const ymd = y.toISOString().slice(0, 10);
mysql(`INSERT INTO learning_service.b25_learning_review (review_id, principal_id, tenant_id, item_id, quality, idempotency_key, created_at) VALUES (UUID(), '${sub}', 'platform', 'w5011-${stamp}-late', 5, 'w5011-live-${stamp}-late', '${ymd} 12:00:00.000000')`);
mysql(`INSERT INTO learning_service.b25_learning_srs_state (principal_id, item_id, tenant_id, stage, due_at, interval_days, ease_factor, review_count, last_idempotency_key) VALUES ('${sub}', 'w5011-${stamp}-late', 'platform', 'REVIEW', UTC_TIMESTAMP() + INTERVAL 1 DAY, 1, 2.50, 1, 'w5011-live-${stamp}-late')`);
r = await call('GET', `/api/v1/learning/stats/daily-report?date=${ymd}`, { token });
record('late-rebuild', r.status === 200 && data(r).reviewItems === 1 && data(r).accuracy === 100, `HTTP ${r.status} date=${ymd} reviewItems=${data(r).reviewItems} accuracy=${data(r).accuracy}`, 'yesterday rebuilt: 1 @ 100');
r = await call('GET', '/api/v1/learning/stats/daily-report', { token });
record('today-excludes-late', r.status === 200 && data(r).reviewItems === 3, `HTTP ${r.status} reviewItems=${data(r).reviewItems}`, 'today still 3');
r = await call('GET', '/api/v1/learning/stats/weekly-report', { token });
record('weekly-includes-late', r.status === 200 && data(r).reviewItems === 4, `HTTP ${r.status} reviewItems=${data(r).reviewItems}`, 'weekly 3+1=4');
// cross-owner: B3 overview all-time count == sum of daily partitions.
r = await call('GET', '/api/v1/mastery/overview', { token });
{
  const d = data(r);
  record('x-owner-reconcile', r.status === 200 && d.reviewFacts === 4 && d.calculationVersion === 'B3-B25-MASTERY-1', `HTTP ${r.status} reviewFacts=${d.reviewFacts}`, 'reviewFacts=4 versioned');
}
// watermark stability: same subject+type+date -> same deterministic reportId.
{
  const a = await call('GET', '/api/v1/learning/stats/daily-report', { token });
  const b = await call('GET', '/api/v1/learning/stats/daily-report', { token });
  const d = data(a);
  record('watermark-stable', data(a).reportId === data(b).reportId && d.calculationVersion === 'B25-SRS-REPORT-1' && d.source === 'mysql', `stable=${data(a).reportId === data(b).reportId} calc=${d.calculationVersion}`, 'same id + watermark');
}
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'M5011-LIVE-REPORTS', capturedAt: new Date().toISOString(), gateway: GW, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/m5011-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`M5011 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
