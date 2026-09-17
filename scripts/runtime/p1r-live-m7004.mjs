// M7-004 live: v2-verified reconnect run on local-real social.
// Join -> lease -> focus lifecycle -> leave -> rejoin (reconnect with a new
// lease), plus owner-scoping negatives. The in-memory SocialService
// retirement stays a named follow-up.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const stamp = Date.now().toString(36);
const device = { deviceType: 'WEB', clientVersion: 'w7004-live-1', deviceName: 'w7004-live-probe' };
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
const idem = (s) => `w7004-live-${stamp}-${++idemN}-${s}`.slice(0, 60);
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
async function learner(tag) {
  const identifier = `w7004-${tag}-${stamp}@local.invalid`;
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
const tokenA = await learner('a');
const tokenB = await learner('b');
record('setup', !!(tokenA && tokenB), 'two learners ready', 'tokens');
let r = await call('GET', '/api/v1/social/rooms', { token: tokenA });
const rooms = data(r).items ?? (Array.isArray(data(r)) ? data(r) : []);
// Prefer a room with free seats: the local-10x fixtures each carry a single
// seat row that earlier runs left OCCUPIED (no local-real sweeper exists).
const roomId = (rooms.find((x) => x.roomId === 'room-local-foundations') ?? rooms[0])?.roomId ?? null;
record('rooms-list', r.status === 200 && !!roomId, `HTTP ${r.status}`, 'rooms visible');
// join -> lease; replay while active.
r = await call('POST', `/api/v1/social/rooms/${roomId}/join`, { token: tokenA, body: {}, idemKey: idem('join') });
const m1 = data(r).member ?? {};
record('room-join', r.status === 200 && m1.state === 'ACTIVE' && !!m1.leaseId, `HTTP ${r.status} lease=${!!m1.leaseId}`, 'ACTIVE + lease');
const lease1 = m1.leaseId ?? null;
r = await call('POST', `/api/v1/social/rooms/${roomId}/join`, { token: tokenA, body: {}, idemKey: idem('join2') });
record('join-replay', r.status === 200 && data(r).replayed === true, `HTTP ${r.status}`, 'replayed while active');
// focus lifecycle on the lease.
r = await call('POST', `/api/v1/social/rooms/${roomId}/focus`, { token: tokenA, body: { durationMinutes: 25, focusTagCode: 'VOCABULARY' }, idemKey: idem('focus') });
const focusId = data(r).session?.focusId ?? null;
record('focus-start', [200, 201].includes(r.status) && data(r).session?.status === 'RUNNING', `HTTP ${r.status}`, 'RUNNING session');
r = await call('PATCH', `/api/v1/social/rooms/${roomId}/focus`, { token: tokenA, body: { focusId, action: 'HEARTBEAT' } });
record('focus-heartbeat', r.status === 200 && data(r).session?.state === 'RUNNING', `HTTP ${r.status}`, 'stays RUNNING');
r = await call('PATCH', `/api/v1/social/rooms/${roomId}/focus`, { token: tokenA, body: { focusId, action: 'FINISH' } });
record('focus-finish', r.status === 200 && data(r).session?.state === 'COMPLETED', `HTTP ${r.status}`, 'COMPLETED');
// B cannot touch A's focus session.
r = await call('PATCH', `/api/v1/social/rooms/${roomId}/focus`, { token: tokenB, body: { focusId, action: 'FINISH' } });
record('focus-scoped', r.status === 404, `HTTP ${r.status}`, 'HTTP 404 other owner');
// leave -> reconnect (rejoin): ACTIVE again with a NEW lease.
r = await call('POST', `/api/v1/social/rooms/${roomId}/leave`, { token: tokenA, body: {} });
record('room-leave', r.status === 200 && data(r).state === 'LEFT', `HTTP ${r.status}`, 'LEFT');
r = await call('POST', `/api/v1/social/rooms/${roomId}/join`, { token: tokenA, body: {}, idemKey: idem('rejoin') });
{
  const m2 = data(r).member ?? {};
  record('reconnect', r.status === 200 && m2.state === 'ACTIVE' && !!m2.leaseId && m2.leaseId !== lease1, `HTTP ${r.status} new lease=${!!m2.leaseId && m2.leaseId !== lease1}`, 'ACTIVE + fresh lease');
}
// ws-ticket + visibility update.
r = await call('POST', '/api/v1/social/ws-ticket', { token: tokenA, body: {} });
record('ws-ticket', r.status === 200 && !!(data(r).ticket ?? data(r).wsTicket), `HTTP ${r.status}`, 'ticket minted');
r = await call('PATCH', '/api/v1/social/me/visibility', { token: tokenA, body: { leaderboardVisibility: 'NICKNAME' } });
record('visibility', [200, 201].includes(r.status), `HTTP ${r.status}`, 'visibility updated');
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'M7004-LIVE-RECONNECT', capturedAt: new Date().toISOString(), gateway: GW, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/m7004-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`M7004 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
