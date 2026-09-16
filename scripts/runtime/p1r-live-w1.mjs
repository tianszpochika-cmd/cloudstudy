// W1 live: setup(W0 condensed) -> targets -> placement full submit -> report -> learning first-day/today -> learner first-day.
const GW = 'http://127.0.0.1:18070';
const stamp = Date.now().toString(36);
const identifier = `w1-${stamp}@local.invalid`;
const password = `E2eLive${stamp}Aa9!xQ`;
const device = { deviceType: 'WEB', clientVersion: 'w1-live-1', deviceName: 'w1-live-probe' };
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
const idem = (s) => `w1-live-${stamp}-${++idemN}-${s}`.slice(0, 60);
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
// --- setup ---
let r = await call('POST', '/api/v1/auth/register', { body: { identifier, password, device }, idemKey: idem('reg') });
record('setup-register', r.status === 201, `HTTP ${r.status}`, 'HTTP 201');
let token = r.json?.data?.accessToken ?? null;
r = await call('POST', '/api/v1/iam/adult-gate', { token, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idemKey: idem('gate') });
record('setup-gate', r.status === 200, `HTTP ${r.status}`, 'HTTP 200');
for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
  await call('PUT', '/api/v1/iam/consents', { token, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idemKey: idem(`c-${t}`) });
}
r = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device }, idemKey: idem('login') });
token = r.json?.data?.accessToken ?? null;
record('setup-login', r.status === 200 && !!token, `HTTP ${r.status}`, 'HTTP 200 + token');
// --- targets (goal 30min) ---
r = await call('PUT', '/api/v1/learner/targets', { token, body: { expectedStateVersion: 0, goalCode: 'CET_4_6', targetLevel: 'A2', dailyQuotaMinutes: 30 }, idemKey: idem('tgt') });
record('targets-put', r.status === 200, `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 160)}`, 'HTTP 200');
// --- placement start ---
r = await call('POST', '/api/v1/assessment/placement/start', { token, body: {}, idemKey: idem('pstart') });
const data0 = r.json?.data ?? r.json ?? {};
const sessionId = data0.sessionId ?? data0.session_id ?? null;
record('placement-start', r.status === 200 && !!sessionId, `HTTP ${r.status} session=${sessionId ? 'present' : 'absent'}`, 'HTTP 200 + session');
// --- submit loop ---
let cur = data0.currentQuestion ?? data0.current_question ?? null;
let rounds = 0, completed = false, lastReport = null;
const data = (x) => x?.data ?? x ?? {};
while (rounds < 15 && !completed) {
  if (!cur) {
    const g = await call('GET', `/api/v1/assessment/placement/start?sessionId=${sessionId}`, { token });
    const gd = data(g.json);
    if (gd.status === 'COMPLETED' || gd.isCompleted) { completed = true; lastReport = gd; break; }
    cur = gd.currentQuestion ?? gd.current_question ?? null;
    if (!cur) { record('placement-loop', false, `no current question after ${rounds} rounds`, 'question or completion'); break; }
  }
  const qid = cur.questionId ?? cur.question_id ?? cur.itemId ?? cur.item_id;
  const opts = cur.options ?? cur.choices ?? [];
  const key = opts.length > 0 ? (opts[0].key ?? opts[0].optionKey ?? opts[0].id ?? opts[0]) : 'A';
  const s = await call('POST', '/api/v1/assessment/placement/submit-step', { token, body: { sessionId, questionId: qid, selectedKey: String(key) }, idemKey: idem(`ans-${rounds}`) });
  const sd = data(s.json);
  rounds += 1;
  if (s.status !== 200) { record('placement-submit', false, `HTTP ${s.status} ${JSON.stringify(s.json).slice(0, 200)}`, 'HTTP 200'); break; }
  if (sd.status === 'COMPLETED' || sd.isCompleted) { completed = true; lastReport = sd; break; }
  cur = sd.currentQuestion ?? sd.current_question ?? null;
}
record('placement-complete', completed, `rounds=${rounds} completed=${completed}`, 'completed within 15 rounds');
if (lastReport) console.log('  report-keys:', Object.keys(lastReport).join(','));
// --- report read ---
if (completed) {
  const rep = await call('GET', `/api/v1/assessment/placement/report/${sessionId}`, { token });
  record('placement-report', rep.status === 200, `HTTP ${rep.status}`, 'HTTP 200');
}
// --- learning first-day + today ---
r = await call('GET', '/api/v1/learning/today', { token });
record('learning-today', r.status === 200, `HTTP ${r.status}`, 'HTTP 200');
r = await call('GET', '/api/v1/learner/first-day', { token });
record('learner-first-day', r.status === 200, `HTTP ${r.status}`, 'HTTP 200');
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'W1-LIVE-E2E', capturedAt: new Date().toISOString(), gateway: GW, identifier, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
await (await import('node:fs')).promises.writeFile('evidence/live/2026-09-16/w1-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`W1 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
