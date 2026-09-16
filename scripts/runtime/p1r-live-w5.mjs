// W5 live: games P0 play-through + B10 practice session/attempt + vocab library +
// media asset read + avatar profile. Fresh user with full setup each run.
const GW = 'http://127.0.0.1:18070';
const stamp = Date.now().toString(36);
const identifier = `w5-${stamp}@local.invalid`;
const password = `E2eLive${stamp}Aa9!xQ`;
const device = { deviceType: 'WEB', clientVersion: 'w5-live-1', deviceName: 'w5-live-probe' };
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
const idem = (s) => `w5-live-${stamp}-${++idemN}-${s}`.slice(0, 60);
async function call(method, path, { token, body, idemKey } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web', origin: 'http://127.0.0.1:18180' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (idemKey) headers['idempotency-key'] = idemKey;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(GW + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json };
}
const data = (r) => r.json?.data ?? r.json ?? {};
let r = await call('POST', '/api/v1/auth/register', { body: { identifier, password, device }, idemKey: idem('reg') });
record('setup-register', r.status === 201, `HTTP ${r.status}`, 'HTTP 201');
let token = r.json?.data?.accessToken ?? null;
await call('POST', '/api/v1/iam/adult-gate', { token, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idemKey: idem('gate') });
for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
  await call('PUT', '/api/v1/iam/consents', { token, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idemKey: idem(`c-${t}`) });
}
r = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device }, idemKey: idem('login') });
token = r.json?.data?.accessToken ?? null;
record('setup-login', r.status === 200 && !!token, `HTTP ${r.status}`, 'HTTP 200 + token');
// games: catalog -> create SENTENCE_TRAIN -> event -> pause -> resume -> finish
r = await call('GET', '/api/v1/games/catalog', { token });
record('games-catalog', r.status === 200, `HTTP ${r.status}`, 'HTTP 200');
r = await call('POST', '/api/v1/games/sessions', { token, body: { gameCode: 'SENTENCE_TRAIN' }, idemKey: idem('gstart') });
const sessionId = data(r).sessionId ?? data(r).id ?? null;
record('game-start', [200, 201].includes(r.status) && !!sessionId, `HTTP ${r.status}`, 'HTTP 200/201 + session');
if (sessionId) {
  r = await call('POST', `/api/v1/games/sessions/${sessionId}/events`, { token, body: { eventType: 'ROUND_COMPLETED', score: 10 }, idemKey: idem('gevt') });
  record('game-event', [200, 201].includes(r.status), `HTTP ${r.status}`, 'HTTP 200/201');
  r = await call('POST', `/api/v1/games/sessions/${sessionId}/pause`, { token, idemKey: idem('gpause') });
  record('game-pause', r.status === 200, `HTTP ${r.status}`, 'HTTP 200');
  r = await call('POST', `/api/v1/games/sessions/${sessionId}/resume`, { token, idemKey: idem('gresume') });
  record('game-resume', r.status === 200, `HTTP ${r.status}`, 'HTTP 200');
  r = await call('POST', `/api/v1/games/sessions/${sessionId}/finish`, { token, idemKey: idem('gfinish') });
  record('game-finish', r.status === 200, `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 140)}`, 'HTTP 200');
} else {
  for (const n of ['game-event', 'game-pause', 'game-resume', 'game-finish']) record(n, false, 'no session', 'HTTP 200');
}
// B10 practice session + attempt
r = await call('POST', '/api/v1/assessment/sessions', { token, body: { mode: 'PRACTICE' }, idemKey: idem('bsess') });
const bsess = data(r).sessionId ?? data(r).id ?? null;
const bitems = data(r).items ?? [];
record('b10-session', [200, 201].includes(r.status) && !!bsess, `HTTP ${r.status} items=${bitems.length} sess=${bsess} keys=${Object.keys(data(r)).join(',')}`, 'HTTP 200/201 + session');
if (bsess && bitems.length > 0) {
  console.log('  session-items:', JSON.stringify(bitems).slice(0, 600));
  const subs = bitems.slice(0, 2).map((it) => {
    const opts = it.options ?? [];
    const key = opts.length > 0 ? (opts[0].optionId ?? opts[0].key ?? 'a') : 'a';
    // itemId as STRING: FNV-64 ids exceed the JS safe-integer range; the server
    // parses exact digit strings (positiveLong) and also accepts itemCode.
    return { itemId: String(it.itemId ?? it.id), itemCode: it.itemCode, response: String(key) };
  });
  const battKey = idem('batt');
  r = await call('POST', `/api/v1/assessment/sessions/${bsess}/attempts`, { token, body: { submissionId: `w5-${stamp}-s1`, items: subs }, idemKey: battKey });
  record('b10-attempt', [200, 201].includes(r.status), `HTTP ${r.status} body=${JSON.stringify(r.json).slice(0, 300)} sessKeys=${Object.keys(data(r)).join(',')}`, 'HTTP 200/201 graded');
  const attemptId = data(r).attemptId ?? null;
  const attemptBody = { submissionId: `w5-${stamp}-s1`, items: subs };
  // repeat: same idempotency key must replay the same attempt, not duplicate.
  const rp = await call('POST', `/api/v1/assessment/sessions/${bsess}/attempts`, { token, body: attemptBody, idemKey: battKey });
  record('b10-attempt-replay', [200, 201].includes(rp.status) && (data(rp).attemptId ?? null) === attemptId, `HTTP ${rp.status} same=${(data(rp).attemptId ?? null) === attemptId}`, 'HTTP 200 same attempt');
  // duplicate submissionId, new key, same answers -> same attempt.
  const dp = await call('POST', `/api/v1/assessment/sessions/${bsess}/attempts`, { token, body: attemptBody, idemKey: idem('batt-dup') });
  record('b10-duplicate-same', [200, 201].includes(dp.status) && (data(dp).attemptId ?? null) === attemptId, `HTTP ${dp.status} same=${(data(dp).attemptId ?? null) === attemptId}`, 'HTTP 200 same attempt');
  // duplicate submissionId, different answers -> 409.
  const flipped = subs.map((s) => ({ ...s, response: s.response === 'a' ? 'b' : 'a' }));
  const cf = await call('POST', `/api/v1/assessment/sessions/${bsess}/attempts`, { token, body: { submissionId: `w5-${stamp}-s1`, items: flipped }, idemKey: idem('batt-conflict') });
  record('b10-duplicate-conflict', cf.status === 409, `HTTP ${cf.status}`, 'HTTP 409 reused submission');
  // checkpoints v1 -> v2 -> v1: last-write-wins, final cursor is v1's.
  if (attemptId) {
    const ck = async (v, cursor, tag) => call('PUT', `/api/v1/assessment/sessions/${bsess}/attempts/${attemptId}/checkpoint`, { token, body: { checkpointVersion: v, itemCursor: cursor, checkpointDigest: `w5digest-${v}-${cursor}`, completedItemIds: [] }, idemKey: idem(tag) });
    await ck(1, 0, 'ck1');
    await ck(2, 1, 'ck2');
    const c3 = await ck(1, 0, 'ck3');
    record('b10-checkpoint-order', c3.status === 200 && (data(c3).itemCursor ?? data(c3).checkpoint?.itemCursor) === 0, `HTTP ${c3.status}`, 'HTTP 200 LWW cursor=0');
  } else {
    record('b10-checkpoint-order', false, 'no attempt id', 'HTTP 200');
  }
  // report read.
  const reportId = data(r).reportId ?? null;
  if (reportId) {
    const rep = await call('GET', `/api/v1/assessment/reports/${reportId}`, { token });
    record('b10-report', rep.status === 200, `HTTP ${rep.status}`, 'HTTP 200');
  } else {
    record('b10-report', false, 'no report id', 'HTTP 200');
  }
} else {
  record('b10-attempt', false, `session=${!!bsess} items=${bitems.length}`, 'HTTP 200/201 graded');
}
// vocab library + expressions
r = await call('GET', '/api/v1/vocab/library', { token });
record('vocab-library', r.status === 200, `HTTP ${r.status}`, 'HTTP 200');
r = await call('POST', '/api/v1/vocab/library/entries', { token, body: { itemType: 'VOCAB', itemId: 'w5-word-1', sourceType: 'MANUAL' }, idemKey: idem('ventry') });
record('vocab-entry', [200, 201].includes(r.status), `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 140)}`, 'HTTP 200/201');
// media asset read (seed has 11 assets; take first from a list? no list route: try known seed id)
r = await call('GET', '/api/v1/media/assets/seed-audio-01', { token });
record('media-asset', [200, 404].includes(r.status), `HTTP ${r.status}`, 'HTTP 200/404 recorded');
// avatar profile
r = await call('GET', '/api/v1/avatar/profile', { token });
record('avatar-profile', r.status === 200, `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 140)}`, 'HTTP 200');
// session-pin duel (P1R decision 7B): bad pin without substitutable rules
// keeps 410; with fixture-cloned rules under the resolved substitute the
// session is created SUBSTITUTED and grades on the fulfillment.
{
  const { execFileSync } = await import('node:child_process');
  // Pristine start: drop prior runs' cloned fixture rows so the 410 leg is
  // deterministic; the positive leg re-clones below.
  execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-e',
    `DELETE FROM assessment_service.b25_assessment_item_rule WHERE item_id LIKE '%:pin'`], { stdio: 'ignore' });
}
r = await call('POST', '/api/v1/assessment/sessions', { token, body: { mode: 'PRACTICE', contentVersionId: 99999 }, idemKey: idem('pin-bad') });
record('pin-unavailable-410', r.status === 410, `HTTP ${r.status}`, 'HTTP 410 no rules');
r = await call('GET', '/api/v1/content/learner/substitute?code=course-b25-basics', { token });
const sub = r.json?.data?.substitute ?? r.json?.substitute ?? null;
const subCode = sub?.contentCode ?? null;
const subVersion = sub?.contentVersionId ?? null;
record('pin-substitute', r.status === 200 && !!subCode && !!subVersion, `HTTP ${r.status} sub=${subCode}@${subVersion}`, 'HTTP 200 resolution');
if (subCode && subVersion) {
  const { execFileSync: exec2 } = await import('node:child_process');
  // Test fixture (documented): clone the 2 seed rules under the resolved
  // substitute coordinates so the pin path has something to grade.
  exec2('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-e',
    `INSERT IGNORE INTO assessment_service.b25_assessment_item_rule (item_id, content_code, content_version_id, prompt, options_json, dimension, difficulty, answer_rule_json, active) SELECT CONCAT(item_id, ':pin'), '${subCode}', ${subVersion}, prompt, options_json, dimension, difficulty, answer_rule_json, TRUE FROM assessment_service.b25_assessment_item_rule WHERE content_code = 'course-b25-basics' AND content_version_id = 25001 AND active = TRUE`], { stdio: 'ignore' });
  r = await call('POST', '/api/v1/assessment/sessions', { token, body: { mode: 'PRACTICE', contentVersionId: 99999 }, idemKey: idem('pin-sub') });
  const psess = r.json?.data?.sessionId ?? r.json?.sessionId ?? r.json?.data?.id ?? null;
  const pin = r.json?.data?.pin ?? r.json?.pin ?? {};
  record('pin-substituted', [200, 201].includes(r.status) && pin.pinStatus === 'SUBSTITUTED' && Number(pin.alternativeContentVersionId) === Number(subVersion), `HTTP ${r.status} pin=${pin.pinStatus} alt=${pin.alternativeContentVersionId}`, 'HTTP 200 SUBSTITUTED');
  if (psess) {
    const pitems = r.json?.data?.items ?? r.json?.items ?? [];
    const subs = pitems.slice(0, 2).map((it) => {
      const opts = it.options ?? [];
      const key = opts.length > 0 ? (opts[0].optionId ?? opts[0].key ?? 'a') : 'a';
      return { itemId: String(it.itemId ?? it.id), itemCode: it.itemCode, response: String(key) };
    });
    const pa = await call('POST', `/api/v1/assessment/sessions/${psess}/attempts`, { token, body: { submissionId: `w5-${stamp}-pin1`, items: subs }, idemKey: idem('pin-att') });
    record('pin-graded', [200, 201].includes(pa.status), `HTTP ${pa.status}`, 'HTTP 200 graded on fulfillment');
  } else {
    record('pin-graded', false, 'no substituted session', 'HTTP 200 graded');
  }
} else {
  record('pin-substituted', false, 'no resolution', 'HTTP 200 SUBSTITUTED');
  record('pin-graded', false, 'no resolution', 'HTTP 200 graded');
}
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'W5-LIVE-E2E', capturedAt: new Date().toISOString(), gateway: GW, identifier, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
await (await import('node:fs')).promises.writeFile('evidence/live/2026-09-16/w5-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`W5 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
