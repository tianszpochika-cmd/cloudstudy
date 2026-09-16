// W3 live: setup -> gamification(streak/quests/claim+replay) -> games catalog ->
// social(rooms/join/focus/leaderboard/report) -> commerce(skus/order/pay-intent/entitlements/redeem-negative/refund) + readiness.
const GW = 'http://127.0.0.1:18070';
const stamp = Date.now().toString(36);
const identifier = `w3-${stamp}@local.invalid`;
const password = `E2eLive${stamp}Aa9!xQ`;
const device = { deviceType: 'WEB', clientVersion: 'w3-live-1', deviceName: 'w3-live-probe' };
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
const idem = (s) => `w3-live-${stamp}-${++idemN}-${s}`.slice(0, 60);
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
// gamification
r = await call('GET', '/api/v1/gamification/streak', { token });
record('streak-read', r.status === 200, `HTTP ${r.status}`, 'HTTP 200');
r = await call('GET', '/api/v1/gamification/quests', { token });
const quests = data(r).quests ?? data(r).items ?? [];
record('quests-list', r.status === 200 && Array.isArray(quests), `HTTP ${r.status} n=${quests.length}`, 'HTTP 200 + list');
if (quests.length > 0) {
  const qid = quests[0].questId ?? quests[0].id;
  const k1 = idem('claim');
  const c1 = await call('POST', `/api/v1/gamification/quests/${qid}/claim`, { token, body: {}, idemKey: k1 });
  record('quest-claim', c1.status === 200, `HTTP ${c1.status}`, 'HTTP 200');
  const c2 = await call('POST', `/api/v1/gamification/quests/${qid}/claim`, { token, body: {}, idemKey: k1 });
  record('quest-claim-replay', c2.status === 200, `HTTP ${c2.status} (same key)`, 'HTTP 200 absorbed');
} else {
  record('quest-claim', false, 'no quests seeded', 'HTTP 200');
  record('quest-claim-replay', false, 'no quests seeded', 'HTTP 200');
}
r = await call('GET', '/api/v1/games/catalog', { token });
record('games-catalog', r.status === 200, `HTTP ${r.status}`, 'HTTP 200');
// social
r = await call('GET', '/api/v1/social/rooms', { token });
const rooms = data(r).items ?? [];
record('rooms-list', r.status === 200 && Array.isArray(rooms), `HTTP ${r.status} n=${rooms.length}`, 'HTTP 200 + list');
const targetRoom = rooms.find((x) => (x.roomId ?? x.id) === 'room-local-foundations') ?? rooms[0];
if (targetRoom) {
  const roomId = targetRoom.roomId ?? targetRoom.id;
  const j = await call('POST', `/api/v1/social/rooms/${roomId}/join`, { token, body: {}, idemKey: idem('join') });
  record('room-join', j.status === 200, `HTTP ${j.status} room=${roomId}`, 'HTTP 200');
  const f = await call('POST', `/api/v1/social/rooms/${roomId}/focus`, { token, body: { durationMinutes: 25 }, idemKey: idem('focus') });
  record('room-focus', f.status === 200, `HTTP ${f.status}`, 'HTTP 200');
} else {
  record('room-join', false, 'no rooms seeded', 'HTTP 200');
  record('room-focus', false, 'no rooms seeded', 'HTTP 200');
}
r = await call('GET', '/api/v1/social/leaderboards', { token });
record('leaderboards', r.status === 200, `HTTP ${r.status}`, 'HTTP 200');
r = await call('POST', '/api/v1/social/moderation/reports', { token, body: { targetUserId: '00000000-0000-4000-8000-000000000001', reasonCode: 'SPAM', roomId: 'room-local-foundations' }, idemKey: idem('rep') });
record('mod-report', [200, 201].includes(r.status), `HTTP ${r.status}`, 'HTTP 200/201');
// commerce
r = await call('GET', '/api/v1/commerce/skus', { token });
const dd = data(r);
const skus = Array.isArray(dd) ? dd : (dd.skus ?? dd.items ?? []);
record('skus-list', r.status === 200 && Array.isArray(skus), `HTTP ${r.status} n=${skus.length}`, 'HTTP 200 + list');
if (skus.length > 0) {
  const skuId = skus[0].skuId ?? skus[0].id;
  const o = await call('POST', '/api/v1/commerce/orders', { token, body: { skuId }, idemKey: idem('order') });
  const orderId = data(o).orderId ?? data(o).id ?? null;
  record('order-create', o.status === 200 || o.status === 201, `HTTP ${o.status}`, 'HTTP 200/201');
  if (orderId) {
    const p = await call('POST', `/api/v1/commerce/orders/${orderId}/payment-intents`, { token, body: { provider: 'SANDBOX' }, idemKey: idem('pay') });
    record('pay-intent-sandbox', [200, 201, 202].includes(p.status), `HTTP ${p.status} ${JSON.stringify(p.json).slice(0, 120)}`, 'sandbox intent, no real provider');
    const f = await call('POST', `/api/v1/commerce/orders/${orderId}/refunds`, { token, body: { reasonCode: 'E2E_TEST' }, idemKey: idem('refund') });
    // The order is unpaid (no workload provider callback in this env), so the
    // refund guard must refuse with REFUND_ORDER_NOT_REFUNDABLE (P1-LIVE-007).
    const refundBody = JSON.stringify(f.json);
    record('refund-sandbox', f.status === 409 && refundBody.includes('REFUND_ORDER_NOT_REFUNDABLE'), `HTTP ${f.status}`, 'HTTP 409 guard on unpaid order');
  } else {
    record('pay-intent-sandbox', false, 'no order id', 'sandbox intent');
    record('refund-sandbox', false, 'no order id', 'HTTP 200/201');
  }
} else {
  record('order-create', false, 'no skus seeded', 'HTTP 200/201');
  record('pay-intent-sandbox', false, 'no skus seeded', 'sandbox intent');
  record('refund-sandbox', false, 'no skus seeded', 'HTTP 200/201');
}
r = await call('GET', '/api/v1/commerce/entitlements/me', { token });
record('entitlements', r.status === 200, `HTTP ${r.status}`, 'HTTP 200');
r = await call('POST', '/api/v1/commerce/activation-codes/redeem', { token, body: { code: 'E2E-INVALID-CODE-0000' }, idemKey: idem('redeem-neg') });
record('redeem-invalid-negative', [404, 409, 422].includes(r.status), `HTTP ${r.status}`, 'HTTP 404/409/422');
r = await call('GET', '/api/v1/commerce/readiness', { token });
record('readiness-disabled', r.status === 200, `HTTP ${r.status}`, 'HTTP 200 (production off)');
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'W3-LIVE-E2E', capturedAt: new Date().toISOString(), gateway: GW, identifier, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
await (await import('node:fs')).promises.writeFile('evidence/live/2026-09-16/w3-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`W3 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
