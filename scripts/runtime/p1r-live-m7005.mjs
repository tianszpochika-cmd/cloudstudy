// M7-005 live: leaderboard delay-gate query filters + cross-tenant /
// over-privilege negatives. Closes the named known-gap with live evidence.
import { createHash } from 'node:crypto';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const stamp = Date.now().toString(36);
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
const idem = (s) => `w7005-live-${stamp}-${++idemN}-${s}`.slice(0, 60);
async function call(method, path, { token, body, idemKey, extraHeaders } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web', ...(extraHeaders ?? {}) };
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
  const identifier = `w7005-${tag}-${stamp}@local.invalid`;
  const password = `E2eLive${stamp}Aa9!xQ`;
  const device = { deviceType: 'WEB', clientVersion: 'w7005-live-1', deviceName: 'w7005-live-probe' };
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
// --- delay-gate query filters ---
let r = await call('GET', '/api/v1/social/leaderboards', { token: tokenA });
{
  const d = data(r);
  const entries = d.entries ?? [];
  const raw = JSON.stringify(entries);
  const deidentified = entries.every((e) => e.displayMode === 'DEIDENTIFIED')
    && !raw.includes('subject_id') && !raw.includes('subjectId');
  record('lb-default', r.status === 200 && deidentified, `HTTP ${r.status} n=${entries.length} deidentified=${deidentified}`, 'HTTP 200 de-identified');
}
r = await call('GET', '/api/v1/social/leaderboards?kind=FOCUS_MINUTES&period=DAY', { token: tokenA });
{
  const d = data(r);
  record('lb-kind-period', r.status === 200 && d.kind === 'FOCUS_MINUTES' && d.period === 'DAY' && (d.entries ?? []).length > 0,
    `HTTP ${r.status} kind=${d.kind} period=${d.period} n=${(d.entries ?? []).length}`, 'HTTP 200 seeded entries');
}
// room-scoped filter: join then filter by the joined room.
r = await call('GET', '/api/v1/social/rooms', { token: tokenA });
{
  const rooms = data(r).items ?? [];
  const target = rooms.find((x) => (x.roomId ?? x.id) === 'room-local-foundations') ?? rooms[0];
  if (target) {
    const roomId = target.roomId ?? target.id;
    await call('POST', `/api/v1/social/rooms/${roomId}/join`, { token: tokenA, body: {}, idemKey: idem('join') });
    const lr = await call('GET', `/api/v1/social/leaderboards?kind=FOCUS_MINUTES&period=DAY&roomId=${encodeURIComponent(roomId)}`, { token: tokenA });
    record('lb-room-scoped', lr.status === 200, `HTTP ${lr.status} room=${roomId}`, 'HTTP 200 room filter');
  } else {
    record('lb-room-scoped', false, 'no rooms seeded', 'HTTP 200 room filter');
  }
}
r = await call('GET', '/api/v1/social/leaderboards?kind=BOGUS&period=DAY', { token: tokenA });
record('lb-unknown-kind-empty', r.status === 200 && ((data(r).entries ?? []).length === 0), `HTTP ${r.status} n=${(data(r).entries ?? []).length}`, 'HTTP 200 empty (kind passes through, no enum gate)');
// --- cross-tenant negatives ---
r = await call('GET', '/api/v1/social/leaderboards?kind=FOCUS_MINUTES&period=DAY', { token: tokenA, extraHeaders: { 'x-tenant-id': 'evil-tenant', 'x-owner-id': 'evil-owner' } });
record('tenant-spoof-headers', r.status === 200 && !JSON.stringify(r.json).includes('evil'), `HTTP ${r.status}`, 'HTTP 200 headers ignored');
r = await call('GET', '/api/v1/social/leaderboards?kind=FOCUS_MINUTES&period=DAY&tenant_id=evil', { token: tokenA });
record('tenant-spoof-param', r.status === 200 && !JSON.stringify(r.json).includes('evil'), `HTTP ${r.status}`, 'HTTP 200 param ignored');
// ticket cross-user isolation.
const fp = createHash('sha256').update('m7005 isolation probe').digest('hex');
r = await call('POST', '/api/v1/support/tickets', { token: tokenA, body: { categoryCode: 'TECHNICAL', resourceRef: `m7005-${stamp}`, descriptionFingerprint: fp, priority: 'NORMAL', attachments: [] }, idemKey: idem('tick') });
const tid = data(r).ticket?.ticketId ?? null;
record('ticket-create', r.status === 200 && !!tid, `HTTP ${r.status}`, 'HTTP 200 + id');
if (tid) {
  const la = await call('GET', '/api/v1/support/tickets', { token: tokenA });
  const aItems = data(la).items ?? [];
  const lb = await call('GET', '/api/v1/support/tickets', { token: tokenB });
  const bItems = data(lb).items ?? [];
  const g = await call('GET', `/api/v1/support/tickets/${tid}`, { token: tokenB });
  record('ticket-isolation', aItems.some((x) => (x.ticketId ?? x.id) === tid) && !bItems.some((x) => (x.ticketId ?? x.id) === tid) && [401, 403, 404].includes(g.status),
    `A-sees=${aItems.some((x) => (x.ticketId ?? x.id) === tid)} B-sees=${bItems.some((x) => (x.ticketId ?? x.id) === tid)} B-get=${g.status}`, 'A-only + B denied');
} else {
  record('ticket-isolation', false, 'no ticket id', 'A-only + B denied');
}
// --- over-privilege negatives ---
r = await call('POST', '/api/v1/admin/content-commands', { token: tokenA, body: { command: 'CREATE_DRAFT', contentCode: `wct-neg-${stamp}`, content: { contentType: 'COURSE_UNIT', title: 'neg probe' } }, idemKey: idem('neg-cmd') });
record('neg-content-command', r.status === 403 && JSON.stringify(r.json).includes('CONTENT_EDITOR_REQUIRED'), `HTTP ${r.status}`, 'HTTP 403 editor perm required');
r = await call('POST', '/api/v1/admin/recovery/recoveries', { token: tokenA, body: { subjectType: 'TICKET', subjectId: `neg-${stamp}`, action: 'REOPEN', reason: 'neg probe' }, idemKey: idem('neg-rec') });
{
  const rid = data(r).recoveryId ?? null;
  if (r.status === 201 && rid) {
    const s = await call('POST', `/api/v1/admin/recovery/recoveries/${rid}/approve`, { token: tokenA, body: {}, idemKey: idem('neg-self') });
    record('neg-self-approve', s.status === 403, `HTTP ${s.status}`, 'HTTP 403 two-person rule');
  } else {
    record('neg-self-approve', false, `request HTTP ${r.status}`, 'HTTP 403 two-person rule');
  }
}
r = await call('GET', '/api/v1/social/leaderboards', {});
record('neg-no-auth', r.status === 401, `HTTP ${r.status}`, 'HTTP 401');
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'M7005-LIVE-NEGATIVES', capturedAt: new Date().toISOString(), gateway: GW, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
await (await import('node:fs')).promises.writeFile('evidence/live/2026-09-16/m7005-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`M7005 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
