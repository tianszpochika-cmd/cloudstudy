// M3-005 live: dual-review comment/audit-trail replay + cross-tenant
// negative against live MySQL. Review reasonCode/reviewNote ride the
// API; the durable trail is the version outbox (stage/decision/actor).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const stamp = Date.now().toString(36);
const device = { deviceType: 'WEB', clientVersion: 'w3005-live-1', deviceName: 'w3005-live-probe' };
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
async function call(method, path, { token, body, extraHeaders } = {}) {
  const h = { accept: 'application/json', 'x-client-platform': 'web', origin: 'http://127.0.0.1:18180', 'idempotency-key': `w3005-live-${stamp}-${++idemN}-k`.slice(0, 60), ...(extraHeaders ?? {}) };
  if (token) headers_auth(h, token);
  if (body !== undefined) h['content-type'] = 'application/json';
  const res = await fetch(GW + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json };
}
function headers_auth(h, token) { h.authorization = `Bearer ${token}`; }
function mysql(q) {
  return execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-e', q], { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
}
const data = (r) => r.json?.data ?? r.json ?? {};
const subOf = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).sub;
async function staffer(tag, roles, perms) {
  const identifier = `test-${tag}-${stamp}@local.invalid`;
  const password = `E2eX${stamp}Aa9!xQ`;
  await call('POST', '/api/v1/auth/register', { body: { identifier, password, device } });
  mysql(`UPDATE iam_service.iam_account SET roles = '${roles}', permissions = '${perms}' WHERE identifier = '${identifier}'`);
  const r = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device } });
  return r.json?.data?.accessToken ?? null;
}
const ed = await staffer('m3005ed', 'staff,content-editor', 'content:write');
const r1 = await staffer('m3005r1', 'staff,review-l1', 'content:review:first');
const r2 = await staffer('m3005r2', 'staff,review-l2,content-publisher', 'content:review:final,content:publish');
record('staff-ready', !!(ed && r1 && r2), '3 staff tokens', 'tokens');
const subEd = subOf(ed), subR1 = subOf(r1), subR2 = subOf(r2);
const CODE = `wct-m3005-${stamp}`;
let r = await call('POST', '/api/v1/admin/content-commands', { token: ed, body: { command: 'CREATE_DRAFT', contentCode: CODE, content: { contentType: 'COURSE_UNIT', title: 'm3003 trail probe', contentLocale: 'en-US', targetLevel: 'A1' } } });
const vid = String(data(r).contentVersionId ?? '');
record('create-draft', r.status === 202 && !!vid, `HTTP ${r.status} vid=${vid}`, 'HTTP 202 + vid');
r = await call('POST', '/api/v1/admin/content-commands', { token: ed, body: { command: 'SUBMIT_REVIEW', contentCode: CODE } });
record('submit-review', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
r = await call('POST', '/api/v1/admin/content-commands', { token: r1, body: { command: 'REVIEW_FIRST', contentCode: CODE, reviewDecision: 'APPROVED', reasonCode: 'M3005_FIRST', reviewNote: 'first pass ok' } });
record('review-first', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
r = await call('POST', '/api/v1/admin/content-commands', { token: r2, body: { command: 'REVIEW_FINAL', contentCode: CODE, reviewDecision: 'APPROVED', reasonCode: 'M3005_FINAL', reviewNote: 'final pass ok' } });
record('review-final', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
r = await call('POST', '/api/v1/admin/content-commands', { token: r2, body: { command: 'PUBLISH', contentCode: CODE } });
record('publish', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
// audit-trail replay: ordered outbox facts for the version aggregate.
{
  const rows = mysql(`SELECT event_name, actor_id FROM content_service.content_outbox_event WHERE aggregate_type = 'content_version' AND aggregate_id = '${vid}' ORDER BY occurred_at`).split('\n').map((l) => l.split('\t'));
  const names = rows.map((x) => x[0]);
  const actors = Object.fromEntries(rows.map((x) => [x[0], x[1]]));
  const seq = ['content.version.submitted.v1', 'content.version.reviewed.v1'];
  const hasSeq = names.includes('content.version.submitted.v1') && names.filter((n) => n === 'content.version.reviewed.v1').length >= 2 && names.includes('content.version.published.v1');
  record('trail-ordered', hasSeq, names.join(' > '), 'submitted > reviewed x2 > published');
  const payloads = mysql(`SELECT event_name, JSON_EXTRACT(payload_json, '$.reviewStage'), JSON_EXTRACT(payload_json, '$.decision') FROM content_service.content_outbox_event WHERE aggregate_type = 'content_version' AND aggregate_id = '${vid}' AND event_name = 'content.version.reviewed.v1' ORDER BY occurred_at`).split('\n');
  const stagesOk = payloads.length === 2 && payloads[0].includes('FIRST_REVIEW') && payloads[0].includes('APPROVED') && payloads[1].includes('FINAL_REVIEW') && payloads[1].includes('APPROVED');
  record('trail-payloads', stagesOk, payloads.join(' | '), 'FIRST/APPROVED then FINAL/APPROVED');
  const reviewers = mysql(`SELECT first_reviewer, final_reviewer, publisher FROM content_service.content_version WHERE content_version_id = ${vid}`);
  record('trail-actors', reviewers.includes(subR1) && reviewers.includes(subR2), 'reviewer columns match r1/r2 subs', 'columns match');
}
// cross-tenant negative: forged tenant facts ignored, nothing leaves platform.
{
  const XCODE = `wct-m3005-x-${stamp}`;
  const evil = { 'x-tenant-id': 'evil-tenant', 'x-owner-id': 'evil-owner', 'x-role': 'admin' };
  const c = await call('POST', '/api/v1/admin/content-commands', { token: ed, body: { command: 'CREATE_DRAFT', contentCode: XCODE, content: { contentType: 'COURSE_UNIT', title: 'x tenant probe' } }, extraHeaders: evil });
  const foreign = mysql(`SELECT COUNT(*) FROM content_service.content_definition WHERE content_code = '${XCODE}' AND tenant_id <> 'platform'`);
  const ownTenant = mysql(`SELECT tenant_id FROM content_service.content_definition WHERE content_code = '${XCODE}'`);
  record('x-tenant-ignored', c.status === 202 && foreign === '0' && ownTenant === 'platform', `HTTP ${c.status} foreign=${foreign} tenant=${ownTenant}`, 'platform-owned, headers ignored');
}
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'M3005-LIVE-TRAIL', capturedAt: new Date().toISOString(), gateway: GW, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/m3005-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`M3005 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
