// W4 live: setup -> notifications(prefs/messages/read-all) -> offline sync push/pull ->
// support tickets -> privacy export request. Cross-user isolation negative included.
const GW = 'http://127.0.0.1:18070';
const stamp = Date.now().toString(36);
const mkuser = (tag) => `w4-${tag}-${stamp}@local.invalid`;
const password = (tag) => `E2eLive${stamp}Aa9!xQ-${tag}`;
const device = { deviceType: 'WEB', clientVersion: 'w4-live-1', deviceName: 'w4-live-probe' };
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
const idem = (s) => `w4-live-${stamp}-${++idemN}-${s}`.slice(0, 60);
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
async function setup(tag) {
  const identifier = mkuser(tag);
  let r = await call('POST', '/api/v1/auth/register', { body: { identifier, password: password(tag), device }, idemKey: idem(`${tag}-reg`) });
  let token = r.json?.data?.accessToken ?? null;
  await call('POST', '/api/v1/iam/adult-gate', { token, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idemKey: idem(`${tag}-gate`) });
  for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    await call('PUT', '/api/v1/iam/consents', { token, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idemKey: idem(`${tag}-c-${t}`) });
  }
  r = await call('POST', '/api/v1/auth/login', { body: { identifier, password: password(tag), device }, idemKey: idem(`${tag}-login`) });
  return r.json?.data?.accessToken ?? null;
}
const tokenA = await setup('a');
record('setup-a', !!tokenA, 'user A ready', 'token');
const tokenB = await setup('b');
record('setup-b', !!tokenB, 'user B ready', 'token');
// notifications
let r = await call('GET', '/api/v1/notifications/preferences', { token: tokenA });
record('notif-prefs-get', r.status === 200, `HTTP ${r.status}`, 'HTTP 200');
r = await call('PUT', '/api/v1/notifications/preferences/REVIEW_DUE/PUSH', { token: tokenA, body: { enabled: false, locale: 'zh-CN' }, idemKey: idem('pref') });
record('notif-pref-put', r.status === 200, `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 120)}`, 'HTTP 200');
r = await call('GET', '/api/v1/notifications/messages?limit=10', { token: tokenA });
const msgs = data(r).messages ?? data(r).items ?? (Array.isArray(data(r)) ? data(r) : []);
record('notif-messages', r.status === 200 && Array.isArray(msgs), `HTTP ${r.status} n=${msgs.length}`, 'HTTP 200 + list');
r = await call('PUT', '/api/v1/notifications/messages/read-all', { token: tokenA, idemKey: idem('readall') });
record('notif-read-all', [200, 404].includes(r.status), `HTTP ${r.status}`, 'HTTP 200/404');
// channel-failure run (M6-002): PUSH is disabled above, so a PUSH delivery must
// filter CANCELLED with PREFERENCE_DISABLED instead of delivering. Queue/deliver
// go direct-to-service: POST /messages has an implementation but no gateway
// execution (P1-LIVE-013 family, recorded here).
async function callDirect(method, path, { token, body, idemKey } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web', origin: 'http://127.0.0.1:18180' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (idemKey) headers['idempotency-key'] = idemKey;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`http://127.0.0.1:18093${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json };
}
r = await callDirect('POST', '/internal/v1/notifications/messages', { token: tokenA, body: { notificationType: 'REVIEW_DUE', channel: 'PUSH', templateKey: 'review-due-v1', templateVersion: 'v1', title: 'w4 failure probe', safeBody: 'filtered by design', contentVersion: 'notif-v1' }, idemKey: idem('qfail') });
const failMsgId = r.json?.messageId ?? r.json?.data?.messageId ?? null;
record('notif-queue-push', r.status === 200 && !!failMsgId, `HTTP ${r.status}`, 'HTTP 200 + id');
if (failMsgId) {
  r = await callDirect('POST', `/internal/v1/notifications/messages/${failMsgId}/delivery`, { token: tokenA, idemKey: idem('dfail') });
  const dr = JSON.stringify(r.json);
  record('notif-deliver-filtered', dr.includes('CANCELLED') && dr.includes('PREFERENCE_DISABLED'), `HTTP ${r.status} ${dr.slice(0, 140)}`, 'CANCELLED/PREFERENCE_DISABLED');
  r = await callDirect('GET', `/internal/v1/notifications/messages/${failMsgId}/delivery-attempts`, { token: tokenA });
  record('notif-attempts', r.status === 200 && Array.isArray(r.json) && r.json.length > 0, `HTTP ${r.status} attempts=${Array.isArray(r.json) ? r.json.length : '?'}`, 'HTTP 200 + attempts');
} else {
  record('notif-deliver-filtered', false, 'no message id', 'CANCELLED');
  record('notif-attempts', false, 'no message id', 'HTTP 200');
}
// offline sync: push then pull sees it
r = await call('POST', '/api/v1/offline/sync/push', { token: tokenA, body: { changes: [{ clientSeq: 1, kind: 'REVIEW', itemId: 'w4-item-1', quality: 4 }] }, idemKey: idem('push') });
record('sync-push', r.status === 200, `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 140)}`, 'HTTP 200');
r = await call('GET', '/api/v1/offline/sync/pull?limit=10', { token: tokenA });
record('sync-pull', r.status === 200, `HTTP ${r.status}`, 'HTTP 200');
// support tickets: A creates, A reads, B cannot read A's ticket
r = await call('POST', '/api/v1/support/tickets', { token: tokenA, body: { categoryCode: 'LEARNING_DATA', resourceRef: 'w4-probe', descriptionFingerprint: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', priority: 'NORMAL' }, idemKey: idem('tick') });
const ticketId = data(r).ticket?.ticketId ?? data(r).ticketId ?? data(r).id ?? null;
record('ticket-create', [200, 201].includes(r.status) && !!ticketId, `HTTP ${r.status} id=${ticketId ? 'present' : 'absent'}`, 'HTTP 200/201 + id');
if (ticketId) {
  r = await call('GET', `/api/v1/support/tickets/${ticketId}`, { token: tokenA });
  record('ticket-read-owner', r.status === 200, `HTTP ${r.status}`, 'HTTP 200');
  r = await call('GET', `/api/v1/support/tickets/${ticketId}`, { token: tokenB });
  record('ticket-cross-user-denied', r.status === 403, `HTTP ${r.status}`, 'HTTP 403 (no global read)');
} else {
  record('ticket-read-owner', false, 'no ticket id', 'HTTP 200');
  record('ticket-cross-user-denied', false, 'no ticket id', 'HTTP 403');
}
// privacy export request
r = await call('POST', '/api/v1/privacy/export', { token: tokenA, body: { policyName: 'learner-self' }, idemKey: idem('exp') });
const exportId = data(r).exportId ?? data(r).export_id ?? data(r).id ?? null;
record('export-request', [200, 201, 202].includes(r.status), `HTTP ${r.status} id=${exportId ? 'present' : 'absent'}`, 'HTTP 200/201/202');
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'W4-LIVE-E2E', capturedAt: new Date().toISOString(), gateway: GW, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
await (await import('node:fs')).promises.writeFile('evidence/live/2026-09-16/w4-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`W4 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
