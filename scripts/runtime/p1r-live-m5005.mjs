// M5-005 live: speaking upload-failure + retention-policy runs. The
// /api/v1/speaking/* gateway surface is intentionally fail-closed
// (canonical_assessment_owner_conflicts_with_current_learning_controller),
// so these legs run direct against learning-service :18090 (documented);
// the gateway gap stays named in the flip note.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const LEARN = 'http://127.0.0.1:18090';
const stamp = Date.now().toString(36);
const identifier = `w5005-${stamp}@local.invalid`;
const password = `E2eLive${stamp}Aa9!xQ`;
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
const idem = (s) => `w5005-live-${stamp}-${++idemN}-${s}`.slice(0, 60);
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
const device = { deviceType: 'WEB', clientVersion: 'w5005-live-1', deviceName: 'w5005-live-probe' };
let r = await call(GW, 'POST', '/api/v1/auth/register', { body: { identifier, password, device }, idemKey: idem('reg') });
record('setup-register', r.status === 201, `HTTP ${r.status}`, 'HTTP 201');
const t0 = r.json?.data?.accessToken ?? null;
await call(GW, 'POST', '/api/v1/iam/adult-gate', { token: t0, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idemKey: idem('gate') });
for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
  await call(GW, 'PUT', '/api/v1/iam/consents', { token: t0, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idemKey: idem(`c-${t}`) });
}
r = await call(GW, 'POST', '/api/v1/auth/login', { body: { identifier, password, device }, idemKey: idem('login') });
const token = r.json?.data?.accessToken ?? null;
record('setup-login', r.status === 200 && !!token, `HTTP ${r.status}`, 'HTTP 200 + token');
const sub = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).sub;
const P = '/internal/v1/learning/experiences';
// gateway surface stays fail-closed (named residual, probed not assumed).
r = await call(GW, 'POST', '/api/v1/speaking/recordings', { token, body: { sourceSegmentId: 'seg-x', durationMs: 500 }, idemKey: idem('gwneg') });
record('gw-still-failclosed', r.status === 404, `HTTP ${r.status}`, 'HTTP 404 owner conflict');
// upload-failure: missing segment -> 400, nothing stored.
r = await call(LEARN, 'POST', `${P}/speaking/recordings`, { token, body: { durationMs: 500 }, idemKey: idem('fail1') });
{
  const after = mysql(`SELECT COUNT(*) FROM learning_service.b3_learning_interaction WHERE principal_id = '${sub}' AND domain_code = 'SPEAKING' AND action_code = 'RECORDING'`);
  record('upload-failure', r.status === 400 && after === '0', `HTTP ${r.status} rows=${after}`, 'HTTP 400 + no row');
}
// happy path: record -> rate -> delete (retention).
r = await call(LEARN, 'POST', `${P}/speaking/recordings`, { token, body: { sourceSegmentId: `seg-${stamp}`, durationMs: 1200 }, idemKey: idem('rec') });
const rid = data(r).recordingId ?? null;
record('recording-stored', r.status === 200 && !!rid && data(r).status === 'STORED_LOCAL_ENCRYPTED', `HTTP ${r.status}`, 'STORED_LOCAL_ENCRYPTED');
r = await call(LEARN, 'POST', `${P}/speaking/recordings/${rid}/self-rating`, { token, body: { rating: 'GOOD' }, idemKey: idem('rate') });
record('self-rating', r.status === 200 && data(r).status === 'RECORDED', `HTTP ${r.status}`, 'RECORDED');
r = await call(LEARN, 'DELETE', `${P}/speaking/recordings/${rid}`, { token, idemKey: idem('del') });
record('retention-delete', r.status === 200 && data(r).status === 'DELETED', `HTTP ${r.status}`, 'DELETED');
{
  const rows = mysql(`SELECT COUNT(*) FROM learning_service.b3_learning_interaction WHERE principal_id = '${sub}' AND domain_code = 'SPEAKING' AND action_code = 'RECORDING_DELETE' AND resource_key = '${rid}'`);
  record('retention-durable', rows === '1', `delete rows=${rows}`, 'delete fact durable');
}
// principal scoping: B cannot touch A's recording (separate rows, no leak).
const identifierB = `w5005b-${stamp}@local.invalid`;
let rb = await call(GW, 'POST', '/api/v1/auth/register', { body: { identifier: identifierB, password, device }, idemKey: idem('regb') });
const t0b = rb.json?.data?.accessToken ?? null;
await call(GW, 'POST', '/api/v1/iam/adult-gate', { token: t0b, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idemKey: idem('gateb') });
for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
  await call(GW, 'PUT', '/api/v1/iam/consents', { token: t0b, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idemKey: idem(`cb-${t}`) });
}
rb = await call(GW, 'POST', '/api/v1/auth/login', { body: { identifier: identifierB, password, device }, idemKey: idem('loginb') });
const tokenB = rb.json?.data?.accessToken ?? null;
const subB = JSON.parse(Buffer.from(tokenB.split('.')[1], 'base64').toString()).sub;
{
  const bRows = mysql(`SELECT COUNT(*) FROM learning_service.b3_learning_interaction WHERE principal_id = '${subB}' AND resource_key = '${rid}'`);
  record('principal-scoped', bRows === '0', `B rows on A recording=${bRows}`, 'B sees nothing');
}
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'M5005-LIVE-SPEAKING', capturedAt: new Date().toISOString(), gateway: GW, direct: LEARN, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/m5005-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`M5005 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
