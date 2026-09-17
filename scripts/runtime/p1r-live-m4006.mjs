// M4-006 live: A1-C2 boundary sweep. Skip fast-track pins every level and
// partial-answer runs land strictly between the all-wrong/all-correct poles.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const stamp = Date.now().toString(36);
const device = { deviceType: 'WEB', clientVersion: 'w4006-live-1', deviceName: 'w4006-live-probe' };
const CONTENT = 'course-b25-basics';
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
const idem = (s) => `w4006-live-${stamp}-${++idemN}-${s}`.slice(0, 60);
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
  const identifier = `w4006-${tag}-${stamp}@local.invalid`;
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
const token = await learner('a');
record('setup', !!token, 'learner ready', 'token');
// every fast-track level pins exactly.
for (const level of LEVELS) {
  const r = await call('POST', '/api/v1/assessment/placement/skip', { token, body: { fastTrackLevel: level }, idemKey: idem(`skip-${level}`) });
  const rd = data(r).report ?? data(r);
  record(`skip-${level}`, [200, 201].includes(r.status) && (rd.cefrLevel ?? rd.level) === level, `HTTP ${r.status}`, `${level} pinned`);
}
// unsupported level refused, not defaulted.
{
  const r = await call('POST', '/api/v1/assessment/placement/skip', { token, body: { fastTrackLevel: 'D1' }, idemKey: idem('skip-bad') });
  record('skip-rejects-unknown', r.status === 400, `HTTP ${r.status}`, 'HTTP 400 unsupported');
}
// partial-answer boundary: exactly one of two correct lands strictly inside.
const ruleRows = mysql(`SELECT item_id, answer_rule_json FROM assessment_service.b25_assessment_item_rule WHERE content_code = '${CONTENT}' AND active = TRUE ORDER BY item_id`).split('\n').filter((l) => l.trim()).map((l) => {
  const cut = l.indexOf('\t');
  return [l.slice(0, cut), JSON.parse(l.slice(cut + 1).trim()).acceptedKeys[0]];
});
async function fullRun(tag, answers) {
  let r = await call('POST', '/api/v1/assessment/placement/start', { token, body: { contentCode: CONTENT }, idemKey: idem(`${tag}-start`) });
  const sessionId = data(r).sessionId ?? data(r).session?.sessionId ?? null;
  if (!sessionId) return { ok: false };
  for (const [qid, key] of answers) {
    r = await call('POST', '/api/v1/assessment/placement/submit-step', { token, body: { sessionId, questionId: qid, selectedKey: key }, idemKey: idem(`${tag}-ans-${qid}-${key}`) });
    if (![200, 201].includes(r.status)) return { ok: false };
  }
  const rep = await call('GET', `/api/v1/assessment/placement/report/${sessionId}`, { token });
  const rd = data(rep).report ?? data(rep);
  return { ok: true, score: Number(rd.score ?? rd.totalScore), level: rd.cefrLevel ?? rd.level };
}
const half = [[ruleRows[0][0], ruleRows[0][1]], [ruleRows[1][0], ruleRows[1][1] === 'A' ? 'B' : 'A']];
const mid = await fullRun('half', half);
record('partial-boundary', mid.ok && mid.score === 0.5, `score=${mid.score} level=${mid.level}`, 'strictly inside (0,1)');
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'M4006-LIVE-BOUNDARIES', capturedAt: new Date().toISOString(), gateway: GW, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/m4006-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`M4006 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
