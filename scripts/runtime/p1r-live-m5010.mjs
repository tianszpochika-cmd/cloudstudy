// M5-010 live: mistake-history migration replay + failure-degrade runs.
// Grammar attempts have no gateway route, so the wrong-answer history row
// is seeded straight into the owner schema (documented fixture); the whole
// mistake -> retry -> verification -> submit lifecycle then runs over HTTP,
// with idempotent replay and fail-closed shapes, cross-checked in MySQL.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const stamp = Date.now().toString(36);
const identifier = `w5010-${stamp}@local.invalid`;
const password = `E2eLive${stamp}Aa9!xQ`;
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
const idem = (s) => `w5010-live-${stamp}-${++idemN}-${s}`.slice(0, 60);
async function call(method, path, { token, body, idemKey, noIdem } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (!noIdem && idemKey) headers['idempotency-key'] = idemKey;
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
const device = { deviceType: 'WEB', clientVersion: 'w5010-live-1', deviceName: 'w5010-live-probe' };
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
// history migration: a wrong grammar attempt, as the (unrouted) attempts endpoint would store it.
const resourceKey = `w5010-${stamp}-g1`;
mysql(`INSERT INTO learning_service.b3_learning_interaction (interaction_id, tenant_id, principal_id, domain_code, action_code, resource_key, idempotency_key, payload_json, result_json, status) VALUES (UUID(), 'platform', '${sub}', 'GRAMMAR', 'ATTEMPT', '${resourceKey}', 'w5010-live-${stamp}-hist', '{}', '{"correct": false}', 'ACCEPTED')`);
r = await call('GET', '/api/v1/mastery/mistakes', { token });
{
  const items = data(r).items ?? [];
  const mine = items.find((x) => String(x.itemId ?? '') === resourceKey);
  record('history-replayed', r.status === 200 && !!mine && mine.mistakeStatus === 'OPEN', `HTTP ${r.status} mistake=${mine ? mine.mistakeId : 'none'}`, 'migrated history visible OPEN');
  var mistakeId = mine ? String(mine.mistakeId) : null;
}
let verificationId = null;
if (mistakeId) {
  const rk = idem('retry');
  r = await call('POST', `/api/v1/mastery/mistakes/${mistakeId}/retry`, { token, idemKey: rk });
  verificationId = data(r).verificationId != null ? String(data(r).verificationId) : null;
  record('mistake-retry', r.status === 200 && data(r).stage === 'D0' && data(r).result === 'PENDING', `HTTP ${r.status} verification=${verificationId}`, 'D0 PENDING verification');
  const before = mysql(`SELECT COUNT(*) FROM learning_service.b3_learning_interaction WHERE principal_id = '${sub}' AND domain_code = 'MASTERY' AND action_code = 'MISTAKE_RETRY'`);
  const r2 = await call('POST', `/api/v1/mastery/mistakes/${mistakeId}/retry`, { token, idemKey: rk });
  const after = mysql(`SELECT COUNT(*) FROM learning_service.b3_learning_interaction WHERE principal_id = '${sub}' AND domain_code = 'MASTERY' AND action_code = 'MISTAKE_RETRY'`);
  record('retry-replay-stable', r2.status === 200 && String(data(r2).verificationId) === verificationId && before === after, `same verification=${String(data(r2).verificationId) === verificationId} rows=${before}->${after}`, 'same key, no duplicate');
} else {
  record('mistake-retry', false, 'no mistake', 'D0 PENDING verification');
  record('retry-replay-stable', false, 'no mistake', 'same key, no duplicate');
}
if (verificationId) {
  r = await call('GET', '/api/v1/mastery/verifications', { token });
  const items = data(r).items ?? [];
  record('verifications-list', r.status === 200 && items.some((x) => String(x.verificationId ?? '') === verificationId || String(x.mistakeId ?? '') === mistakeId), `HTTP ${r.status} n=${items.length}`, 'verification listed');
  r = await call('POST', `/api/v1/mastery/verifications/${verificationId}/submit`, { token, body: { mistakeId }, idemKey: idem('submit') });
  record('verification-submit', r.status === 200 && data(r).result === 'PASSED', `HTTP ${r.status} result=${data(r).result}`, 'PASSED');
} else {
  record('verifications-list', false, 'no verification', 'verification listed');
  record('verification-submit', false, 'no verification', 'PASSED');
}
r = await call('GET', '/api/v1/mastery/overview', { token });
record('overview-reconciled', r.status === 200 && (data(r).mistakes ?? 0) >= 1 && data(r).calculationVersion === 'B3-B25-MASTERY-1', `HTTP ${r.status} mistakes=${data(r).mistakes}`, 'mistakes>=1 versioned');
// failure-degrade shapes: unauthenticated + keyless write must fail closed, never 500/leak.
r = await call('GET', '/api/v1/mastery/mistakes', {});
record('degrade-no-auth', r.status === 401, `HTTP ${r.status}`, 'HTTP 401');
r = await call('POST', `/api/v1/mastery/mistakes/${mistakeId ?? '0'}/retry`, { token, noIdem: true });
{
  const raw = JSON.stringify(r.json);
  record('degrade-keyless', r.status !== 500 && !raw.includes('stackTrace') && !raw.includes('at com.englishflow'), `HTTP ${r.status}`, 'fail-closed shape, no leak');
}
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'M5010-LIVE-MASTERY', capturedAt: new Date().toISOString(), gateway: GW, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/m5010-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`M5010 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
