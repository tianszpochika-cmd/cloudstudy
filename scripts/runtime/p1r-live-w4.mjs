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
// post-refresh reconciliation (M6-003) + per-session revoke (M6-004).
// node fetch has no cookie jar: capture the refresh cookie manually.
async function loginWithCookie(identifier, pwd, tag) {
  const headers = { accept: 'application/json', 'content-type': 'application/json', 'x-client-platform': 'web', origin: 'http://127.0.0.1:18180', 'idempotency-key': idem(`${tag}-login`) };
  const res = await fetch(`${GW}/api/v1/auth/login`, { method: 'POST', headers, body: JSON.stringify({ identifier, password: pwd, device }), redirect: 'manual' });
  const json = await res.json().catch(() => null);
  const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const cookie = (setCookies.find((c) => c.startsWith('yuxuexing_refresh=')) ?? '').split(';', 1)[0] || null;
  return { status: res.status, token: json?.data?.accessToken ?? null, sessionId: json?.data?.sessionId ?? null, cookie };
}
async function refreshWithCookie(cookie, tag) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web', origin: 'http://127.0.0.1:18180', 'idempotency-key': idem(`${tag}-refresh`), cookie };
  const res = await fetch(`${GW}/api/v1/auth/token/refresh`, { method: 'POST', headers, redirect: 'manual' });
  const json = await res.json().catch(() => null);
  const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const newCookie = (setCookies.find((c) => c.startsWith('yuxuexing_refresh=')) ?? '').split(';', 1)[0] || null;
  return { status: res.status, token: json?.data?.accessToken ?? json?.accessToken ?? null, cookie: newCookie };
}
{
  const idA = mkuser('a');
  const pwA = password('a');
  const s1 = await loginWithCookie(idA, pwA, 'a-s1');
  const s2 = await loginWithCookie(idA, pwA, 'a-s2');
  record('revoke-two-sessions', s1.status === 200 && s2.status === 200 && !!s1.sessionId && !!s2.sessionId && s1.sessionId !== s2.sessionId, `HTTP ${s1.status}/${s2.status}`, 'HTTP 200 x2 distinct');
  // sync push on s1, rotate via refresh, push+pull continue on the rotated pair.
  let r1 = await call('POST', '/api/v1/offline/sync/push', { token: s1.token, body: { changes: [{ clientSeq: 90, kind: 'REVIEW', itemId: 'w4-rfr-1', quality: 4 }] }, idemKey: idem('push-pre') });
  const rot = s1.cookie ? await refreshWithCookie(s1.cookie, 'a-rot') : { status: -1, token: null };
  record('sync-refresh-rotation', rot.status === 200 && !!rot.token, `HTTP ${rot.status}`, 'HTTP 200 rotated');
  r1 = await call('POST', '/api/v1/offline/sync/push', { token: rot.token ?? s1.token, body: { changes: [{ clientSeq: 91, kind: 'REVIEW', itemId: 'w4-rfr-2', quality: 5 }] }, idemKey: idem('push-post') });
  const pl = await call('GET', '/api/v1/offline/sync/pull?limit=20', { token: rot.token ?? s1.token });
  record('sync-post-refresh', r1.status === 200 && pl.status === 200, `HTTP ${r1.status}/${pl.status}`, 'HTTP 200/200 continuity');
  // revoke s2 with s1's authority; s2 dies, s1 lives.
  if (s2.sessionId) {
    const rv = await call('POST', `/api/v1/auth/sessions/${s2.sessionId}/revoke`, { token: (rot.token ?? s1.token), idemKey: idem('revoke') });
    record('session-revoke', rv.status === 200, `HTTP ${rv.status}`, 'HTTP 200');
    const dead = await call('GET', '/api/v1/learner/profile', { token: s2.token });
    record('revoked-access-ttl-stale', dead.status === 200, `HTTP ${dead.status} (stateless JWT within TTL, by design)`, 'HTTP 200');
    const deadRefresh = s2.cookie ? await refreshWithCookie(s2.cookie, 'a-deadref') : { status: -1 };
    record('revoked-refresh-invalid', deadRefresh.status === 401 || deadRefresh.status === 404, `HTTP ${deadRefresh.status}`, 'HTTP 401/404');
    const alive = await call('GET', '/api/v1/learner/profile', { token: (rot.token ?? s1.token) });
    record('survivor-alive', alive.status === 200, `HTTP ${alive.status}`, 'HTTP 200');
  } else {
    record('session-revoke', false, 'no session id', 'HTTP 200');
    record('revoked-access-ttl-stale', false, 'no session id', 'HTTP 200');
    record('revoked-refresh-invalid', false, 'no session id', 'HTTP 401/404');
    record('survivor-alive', false, 'no session id', 'HTTP 200');
  }
}
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
