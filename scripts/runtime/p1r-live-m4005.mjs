// M4-005 live: fixed-input/output determinism + boundary/confidence fixtures.
// Same answers twice -> identical score/CEFR; all-correct vs all-wrong bound
// the levels; skip fast-tracks; cross-user sessions stay invisible.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const stamp = Date.now().toString(36);
const device = { deviceType: 'WEB', clientVersion: 'w4005-live-1', deviceName: 'w4005-live-probe' };
const CONTENT = 'course-b25-basics';
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
const idem = (s) => `w4005-live-${stamp}-${++idemN}-${s}`.slice(0, 60);
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
  const identifier = `w4005-${tag}-${stamp}@local.invalid`;
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
// Fixture read (documented): rule keys from the owner schema, like prices.
const ruleRows = mysql(`SELECT item_id, answer_rule_json FROM assessment_service.b25_assessment_item_rule WHERE content_code = '${CONTENT}' AND active = TRUE ORDER BY item_id`).split('\n').filter((l) => l.trim()).map((l) => {
  const cut = l.indexOf('\t');
  return [l.slice(0, cut), l.slice(cut + 1).trim()];
});
const items = ruleRows.map(([id, js]) => ({ id, key: JSON.parse(js).acceptedKeys[0] }));
record('fixture-read', items.length >= 2 && items.every((i) => !!i.key), `${items.length} items`, 'rules with keys');
const tokenA = await learner('a');
const tokenB = await learner('b');
record('setup', !!(tokenA && tokenB), 'two learners ready', 'tokens');
async function fullRun(token, tag, answers) {
  let r = await call('POST', '/api/v1/assessment/placement/start', { token, body: { contentCode: CONTENT }, idemKey: idem(`${tag}-start`) });
  const sessionId = data(r).sessionId ?? data(r).session?.sessionId ?? null;
  if (![200, 201].includes(r.status) || !sessionId) return { ok: false, sessionId: null };
  let last = null;
  for (const [qid, key] of answers) {
    last = await call('POST', '/api/v1/assessment/placement/submit-step', { token, body: { sessionId, questionId: qid, selectedKey: key }, idemKey: idem(`${tag}-ans-${qid}-${key}`) });
    if (![200, 201].includes(last.status)) return { ok: false, sessionId };
  }
  const rep = await call('GET', `/api/v1/assessment/placement/report/${sessionId}`, { token });
  const rd = data(rep).report ?? data(rep);
  return { ok: [200, 201].includes(last.status) && [200].includes(rep.status), sessionId, score: rd.score ?? rd.totalScore, level: rd.cefrLevel ?? rd.level };
}
const correct = items.map((i) => [i.id, i.key]);
const run1 = await fullRun(tokenA, 'r1', correct);
record('all-correct', run1.ok && run1.score != null, `score=${run1.score} level=${run1.level}`, 'completed with score');
const run2 = await fullRun(tokenA, 'r2', correct);
record('determinism', run2.ok && run2.score === run1.score && run2.level === run1.level, `score=${run2.score} level=${run2.level}`, 'identical to run1');
const wrong = items.map((i) => [i.id, i.key === 'A' ? 'B' : 'A']);
const run3 = await fullRun(tokenA, 'r3', wrong);
record('all-wrong-boundary', run3.ok && Number(run3.score) < Number(run1.score), `score=${run3.score} level=${run3.level}`, 'strictly below all-correct');
// skip fast-track pins the requested level.
{
  const r = await call('POST', '/api/v1/assessment/placement/skip', { token: tokenA, body: { fastTrackLevel: 'B1' }, idemKey: idem('skip') });
  const rd = data(r).report ?? data(r);
  record('skip-fast-track', [200, 201].includes(r.status) && (rd.cefrLevel ?? rd.level) === 'B1', `HTTP ${r.status} level=${rd.cefrLevel ?? rd.level}`, 'B1 pinned');
}
// cross-user: B sees nothing of A's session.
{
  const r = await call('GET', `/api/v1/assessment/placement/report/${run1.sessionId}`, { token: tokenB });
  record('report-scoped', [401, 403, 404].includes(r.status), `HTTP ${r.status}`, 'denied for other owner');
}
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'M4005-LIVE-DETERMINISM', capturedAt: new Date().toISOString(), gateway: GW, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/m4005-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`M4005 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
