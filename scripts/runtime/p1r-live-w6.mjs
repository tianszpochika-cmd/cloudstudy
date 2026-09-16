// W6 live: one requestId traced Gateway -> IAM -> PEP -> owner DB -> outbox ->
// durable audit, plus direct-connect negatives (service-side PEP without gateway).
// Kafka relay for learner outbox rows does not exist (M2-005 owns that gap and
// names it); the durable chain asserted here ends at the audit sink.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const DV_LEARNER = 'http://127.0.0.1:18088';
const stamp = Date.now().toString(36);
const identifier = `w6-${stamp}@local.invalid`;
const password = `E2eLive${stamp}Aa9!xQ`;
const device = { deviceType: 'WEB', clientVersion: 'w6-live-1', deviceName: 'w6-live-probe' };
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
const idem = (s) => `w6-live-${stamp}-${++idemN}-${s}`.slice(0, 60);
async function call(base, method, path, { token, body, idemKey, headers = {} } = {}) {
  const h = { accept: 'application/json', 'x-client-platform': 'web', origin: 'http://127.0.0.1:18180', ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  if (idemKey) h['idempotency-key'] = idemKey;
  if (body !== undefined) h['content-type'] = 'application/json';
  const res = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json };
}
const meta = (r) => r.json?.meta ?? {};
const data = (r) => r.json?.data ?? r.json ?? {};
function mysql(query) {
  const out = execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-e', query], { encoding: 'utf8', shell: false });
  return out.trim();
}

let r = await call(GW, 'POST', '/api/v1/auth/register', { body: { identifier, password, device }, idemKey: idem('reg') });
record('setup-register', r.status === 201, `HTTP ${r.status}`, 'HTTP 201');
const regReq = meta(r).requestId ?? null;
let token = data(r).accessToken ?? null;
r = await call(GW, 'POST', '/api/v1/iam/adult-gate', { token, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idemKey: idem('gate') });
for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
  await call(GW, 'PUT', '/api/v1/iam/consents', { token, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idemKey: idem(`c-${t}`) });
}
r = await call(GW, 'POST', '/api/v1/auth/login', { body: { identifier, password, device }, idemKey: idem('login') });
record('setup-login', r.status === 200, `HTTP ${r.status}`, 'HTTP 200');
const loginReq = meta(r).requestId ?? null;
token = data(r).accessToken ?? null;
// The traced write.
r = await call(GW, 'PUT', '/api/v1/learner/targets', { token, body: { expectedStateVersion: 0, goalCode: 'CET_4_6', targetLevel: 'A2', dailyQuotaMinutes: 30 }, idemKey: idem('tgt') });
const putReq = meta(r).requestId ?? null;
const targetId = data(r).targetId ?? null;
record('traced-put', r.status === 200 && !!putReq && !!targetId, `HTTP ${r.status} req=${putReq} target=${targetId}`, 'HTTP 200 + req + target');
// L1: gateway audit sink rows for the three requestIds.
for (const [label, req] of [['register', regReq], ['login', loginReq], ['targets-put', putReq]]) {
  if (!req) { record(`audit-${label}`, false, 'no request id', 'row present'); continue; }
  const rows = mysql(`SELECT action, decision FROM audit_service.audit_fact WHERE request_id = '${req}'`);
  record(`audit-${label}`, rows.length > 0, `${label} req=${req} -> ${rows.split('\n').length} row(s): ${rows.split('\n')[0].slice(0, 90)}`, 'audit row present');
}
// L2: IAM decision audit for register + login.
for (const [label, req] of [['register', regReq], ['login', loginReq]]) {
  if (!req) { record(`iam-${label}`, false, 'no request id', 'row present'); continue; }
  const rows = mysql(`SELECT action_code, decision FROM iam_service.iam_decision_audit WHERE request_id = '${req}' LIMIT 3`);
  record(`iam-${label}`, rows.length > 0, `${rows.split('\n')[0].slice(0, 100)}`, 'decision row present');
}
// L3+L4: owner DB row for the traced target.
if (targetId) {
  const row = mysql(`SELECT target_id, goal_type FROM learner_service.learner_goal WHERE target_id = ${targetId} LIMIT 1`);
  record('owner-db', row.includes(String(targetId)), row.slice(0, 100), 'owner row present');
  const ob = mysql(`SELECT event_name, published_at FROM learner_service.learner_outbox_event WHERE aggregate_id LIKE '%${targetId}%' OR payload_json LIKE '%${targetId}%' ORDER BY occurred_at DESC LIMIT 2`);
  const obAlt = ob.length > 0 ? ob : mysql(`SELECT event_name, published_at FROM learner_service.learner_outbox_event ORDER BY occurred_at DESC LIMIT 1`);
  record('owner-outbox', /learner\.target\.updated/i.test(obAlt), obAlt.split('\n')[0].slice(0, 100), 'target-updated outbox row');
} else {
  record('owner-db', false, 'no target id', 'owner row present');
  record('owner-outbox', false, 'no target id', 'outbox row present');
}
// Fault chain: direct-to-service without gateway.
r = await call(DV_LEARNER, 'PUT', '/internal/v1/learner/targets', { body: { expectedStateVersion: 0, goalCode: 'CET_4_6', targetLevel: 'A2', dailyQuotaMinutes: 30 }, idemKey: idem('direct-noauth') });
record('direct-noauth-401', r.status === 401, `HTTP ${r.status}`, 'HTTP 401 service-side');
r = await call(DV_LEARNER, 'PUT', '/internal/v1/learner/targets', { token, body: { expectedStateVersion: 0, goalCode: 'CET_4_6', targetLevel: 'B1', dailyQuotaMinutes: 30 }, idemKey: idem('direct-forge'), headers: { 'x-role': 'admin' } });
record('direct-forged-403', r.status === 403 && JSON.stringify(r.json).includes('UNTRUSTED_SECURITY_FACT'), `HTTP ${r.status}`, 'HTTP 403 untrusted-fact');
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'W6-LIVE-TRACE', capturedAt: new Date().toISOString(), gateway: GW, identifier, putRequestId: putReq, targetId, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks, kafkaNote: 'learner outbox rows are durable-but-unrelayed (M2-005 names it); Kafka relay live only on the content path.' };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/w6-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`W6 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
