// W2 live: setup -> targets -> srs reviews -> review-queue complete -> mistakes -> mastery -> reports.
const GW = 'http://127.0.0.1:18070';
const stamp = Date.now().toString(36);
const identifier = `w2-${stamp}@local.invalid`;
const password = `E2eLive${stamp}Aa9!xQ`;
const device = { deviceType: 'WEB', clientVersion: 'w2-live-1', deviceName: 'w2-live-probe' };
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
const idem = (s) => `w2-live-${stamp}-${++idemN}-${s}`.slice(0, 60);
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
r = await call('PUT', '/api/v1/learner/targets', { token, body: { expectedStateVersion: 0, goalCode: 'CET_4_6', targetLevel: 'A2', dailyQuotaMinutes: 30 }, idemKey: idem('tgt') });
record('targets-put', r.status === 200, `HTTP ${r.status}`, 'HTTP 200');
// srs review submit (quality 4 then quality 1)
const revKey1 = idem('rev1');
r = await call('POST', '/api/v1/learning/srs/reviews', { token, body: { itemId: 'w2-item-1', quality: 4 }, idemKey: revKey1 });
record('srs-review-4', r.status === 200, `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 120)}`, 'HTTP 200');
r = await call('POST', '/api/v1/learning/srs/reviews', { token, body: { itemId: 'w2-item-2', quality: 1 }, idemKey: idem('rev2') });
record('srs-review-1', r.status === 200, `HTTP ${r.status}`, 'HTTP 200');
// true idempotent replay: SAME key + SAME body must not create a duplicate review
r = await call('POST', '/api/v1/learning/srs/reviews', { token, body: { itemId: 'w2-item-1', quality: 4 }, idemKey: revKey1 });
record('srs-review-replay-200', r.status === 200, `HTTP ${r.status} (replay absorbed)`, 'HTTP 200');
// srs states persist both reviews (queue is correctly empty: nothing due yet)
r = await call('GET', '/api/v1/learning/srs/states?limit=20', { token });
const states = r.json?.data?.items ?? r.json?.items ?? [];
const seen = new Set(states.map((s) => s.itemId ?? s.item_id));
const counts = Object.fromEntries(states.map((s) => [s.itemId ?? s.item_id, s.reviewCount ?? s.review_count]));
record('srs-states-persist', r.status === 200 && seen.has('w2-item-1') && seen.has('w2-item-2') && (counts['w2-item-1'] ?? 0) === 1 && (counts['w2-item-2'] ?? 0) === 1, `HTTP ${r.status} counts=${JSON.stringify(counts)}`, 'both items exactly once (replay absorbed)');
// review queue: 200 + array; empty is correct SRS behavior immediately after review
r = await call('GET', '/api/v1/learning/review-queue?limit=20', { token });
const items = r.json?.items ?? r.json?.data?.items ?? [];
record('review-queue', r.status === 200 && Array.isArray(items), `HTTP ${r.status} items=${items.length} (empty expected: nothing due)`, 'HTTP 200 + array');
// mistakes + srs states/overview + mastery + reports
r = await call('GET', '/api/v1/learning/mistakes/queue', { token });
record('mistakes-queue', r.status === 200, `HTTP ${r.status}`, 'HTTP 200');
r = await call('GET', '/api/v1/learning/srs/overview', { token });
record('srs-overview', r.status === 200, `HTTP ${r.status}`, 'HTTP 200');
r = await call('GET', '/api/v1/mastery/overview', { token });
record('mastery-overview', r.status === 200, `HTTP ${r.status}`, 'HTTP 200');
r = await call('GET', '/api/v1/learning/stats/daily-report', { token });
record('daily-report', r.status === 200, `HTTP ${r.status}`, 'HTTP 200');
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'W2-LIVE-E2E', capturedAt: new Date().toISOString(), gateway: GW, identifier, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
await (await import('node:fs')).promises.writeFile('evidence/live/2026-09-16/w2-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`W2 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
