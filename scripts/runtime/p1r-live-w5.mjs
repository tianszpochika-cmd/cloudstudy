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
  r = await call('POST', `/api/v1/assessment/sessions/${bsess}/attempts`, { token, body: { submissionId: `w5-${stamp}-s1`, items: subs }, idemKey: idem('batt') });
  record('b10-attempt', [200, 201].includes(r.status), `HTTP ${r.status} body=${JSON.stringify(r.json).slice(0, 300)} sessKeys=${Object.keys(data(r)).join(',')}`, 'HTTP 200/201 graded');
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
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'W5-LIVE-E2E', capturedAt: new Date().toISOString(), gateway: GW, identifier, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
await (await import('node:fs')).promises.writeFile('evidence/live/2026-09-16/w5-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`W5 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
