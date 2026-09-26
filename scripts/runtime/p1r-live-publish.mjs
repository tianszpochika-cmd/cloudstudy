// W8 live: content publish run (M3-010) -- draft -> dual review -> publish ->
// learner projection -> takedown, plus four-eyes self-review denial.
// Staff: four independent narrow roles (editor / reviewer-1 / reviewer-2 /
// publisher) provisioned via DB grant (documented local fixture); a fifth
// all-powerful staffer proves FOUR_EYES_REQUIRED still denies the same actor.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const stamp = Date.now().toString(36);
const device = { deviceType: 'WEB', clientVersion: 'w8-live-1', deviceName: 'w8-live-probe' };
const checks = [];
const createdIdentifiers = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
async function call(method, path, { token, body } = {}) {
  const h = { accept: 'application/json', 'x-client-platform': 'web', origin: 'http://127.0.0.1:18180', 'idempotency-key': `w8-live-${stamp}-${++idemN}-k`.slice(0, 60) };
  if (token) h.authorization = `Bearer ${token}`;
  if (body !== undefined) h['content-type'] = 'application/json';
  const res = await fetch(GW + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json };
}
function mysql(q) {
  execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-e', q], { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' });
}
const data = (r) => r.json?.data ?? r.json ?? {};
async function staffer(tag, roles, perms) {
  const identifier = `test-${tag}-${stamp}@local.invalid`;
  const password = `E2eX${stamp}Aa9!xQ`;
  createdIdentifiers.push(identifier);
  await call('POST', '/api/v1/auth/register', { body: { identifier, password, device } });
  mysql(`UPDATE iam_service.iam_account SET roles = '${roles}', permissions = '${perms}' WHERE identifier = '${identifier}'`);
  const r = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device } });
  return r.json?.data?.accessToken ?? null;
}
async function learner() {
  const identifier = `w8l-${stamp}@local.invalid`;
  const password = `E2eLive${stamp}Aa9!xQ`;
  createdIdentifiers.push(identifier);
  let r = await call('POST', '/api/v1/auth/register', { body: { identifier, password, device } });
  let token = r.json?.data?.accessToken ?? null;
  await call('POST', '/api/v1/iam/adult-gate', { token, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' } });
  for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    await call('PUT', '/api/v1/iam/consents', { token, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' } });
  }
  r = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device } });
  return r.json?.data?.accessToken ?? null;
}
try {
const ed = await staffer('editor', 'staff,content-editor', 'content:write');
const r1 = await staffer('reviewer1', 'staff,review-l1', 'content:review:first');
const r2 = await staffer('reviewer2', 'staff,review-l2', 'content:review:final');
const pub = await staffer('publisher', 'staff,content-publisher', 'content:publish');
const sup = await staffer('super', 'staff,content-editor,review-l1,review-l2,content-publisher', 'content:write,content:review:first,content:review:final,content:publish');
record('staff-ready', !!(ed && r1 && r2 && pub && sup), '5 staff tokens', 'tokens');
const CODE = `wct-live-${stamp}`;
const SUPER = `wct-super-${stamp}`;
let r = await call('POST', '/api/v1/admin/content-commands', { token: ed, body: { command: 'CREATE_DRAFT', contentCode: CODE, content: { contentType: 'COURSE_UNIT', title: 'live publish probe', contentLocale: 'en-US', targetLevel: 'A1' } } });
record('create-draft', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
r = await call('POST', '/api/v1/admin/content-commands', { token: ed, body: { command: 'SUBMIT_REVIEW', contentCode: CODE } });
record('submit-review', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
r = await call('POST', '/api/v1/admin/content-commands', { token: ed, body: { command: 'REVIEW_FIRST', contentCode: CODE, reviewDecision: 'APPROVED' } });
record('editor-cannot-review', r.status === 403, `HTTP ${r.status}`, 'HTTP 403 (no review perm)');
r = await call('POST', '/api/v1/admin/content-commands', { token: r1, body: { command: 'REVIEW_FIRST', contentCode: CODE, reviewDecision: 'APPROVED' } });
record('review-first', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
r = await call('POST', '/api/v1/admin/content-commands', { token: r2, body: { command: 'REVIEW_FINAL', contentCode: CODE, reviewDecision: 'APPROVED' } });
record('review-final', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
r = await call('POST', '/api/v1/admin/content-commands', { token: pub, body: { command: 'PUBLISH', contentCode: CODE } });
record('publish', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
const ltok = await learner();
r = await call('GET', '/api/v1/content/learner/catalog?contentLocale=en-US', { token: ltok });
record('projection-shows', r.status === 200 && JSON.stringify(r.json).includes(CODE), `HTTP ${r.status}`, 'catalog lists it');
// four-eyes: all-powerful same actor still denied on its own draft.
r = await call('POST', '/api/v1/admin/content-commands', { token: sup, body: { command: 'CREATE_DRAFT', contentCode: SUPER, content: { contentType: 'COURSE_UNIT', title: 'four eyes' } } });
record('super-draft', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
r = await call('POST', '/api/v1/admin/content-commands', { token: sup, body: { command: 'SUBMIT_REVIEW', contentCode: SUPER } });
record('super-submit', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
r = await call('POST', '/api/v1/admin/content-commands', { token: sup, body: { command: 'REVIEW_FIRST', contentCode: SUPER, reviewDecision: 'APPROVED' } });
record('four-eyes', r.status === 409 && JSON.stringify(r.json).includes('FOUR_EYES_REQUIRED'), `HTTP ${r.status}`, 'HTTP 409 FOUR_EYES');
// takedown removes the projection.
r = await call('POST', '/api/v1/admin/content-commands', { token: pub, body: { command: 'UNPUBLISH', contentCode: CODE } });
record('unpublish', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
r = await call('GET', '/api/v1/content/learner/catalog?contentLocale=en-US', { token: ltok });
record('projection-gone', r.status === 200 && !JSON.stringify(r.json).includes(CODE), `HTTP ${r.status}`, 'catalog hides it');
// rollback (ADR-0026 residual): v2 approved+published, then back to v1.
const RB = `wct-rb-${stamp}`;
r = await call('POST', '/api/v1/admin/content-commands', { token: ed, body: { command: 'CREATE_DRAFT', contentCode: RB, content: { contentType: 'COURSE_UNIT', title: 'rollback probe' } } });
record('rb-draft', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
r = await call('POST', '/api/v1/admin/content-commands', { token: ed, body: { command: 'SUBMIT_REVIEW', contentCode: RB } });
record('rb-submit', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
r = await call('POST', '/api/v1/admin/content-commands', { token: r1, body: { command: 'REVIEW_FIRST', contentCode: RB, reviewDecision: 'APPROVED' } });
record('rb-first', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
r = await call('POST', '/api/v1/admin/content-commands', { token: r2, body: { command: 'REVIEW_FINAL', contentCode: RB, reviewDecision: 'APPROVED' } });
record('rb-final', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
r = await call('POST', '/api/v1/admin/content-commands', { token: pub, body: { command: 'PUBLISH', contentCode: RB } });
record('rb-publish-v1', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
r = await call('POST', '/api/v1/admin/content-commands', { token: ed, body: { command: 'SAVE_DRAFT', contentCode: RB, content: { title: 'rollback probe v2' } } });
record('rb-v2', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
r = await call('POST', '/api/v1/admin/content-commands', { token: ed, body: { command: 'SUBMIT_REVIEW', contentCode: RB, targetVersionNumber: 2 } });
record('rb-submit-v2', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
r = await call('POST', '/api/v1/admin/content-commands', { token: r1, body: { command: 'REVIEW_FIRST', contentCode: RB, targetVersionNumber: 2, reviewDecision: 'APPROVED' } });
record('rb-first-v2', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
r = await call('POST', '/api/v1/admin/content-commands', { token: r2, body: { command: 'REVIEW_FINAL', contentCode: RB, targetVersionNumber: 2, reviewDecision: 'APPROVED' } });
record('rb-final-v2', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
r = await call('POST', '/api/v1/admin/content-commands', { token: pub, body: { command: 'PUBLISH', contentCode: RB, targetVersionNumber: 2 } });
record('rb-publish-v2', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
r = await call('POST', '/api/v1/admin/content-commands', { token: pub, body: { command: 'ROLLBACK', contentCode: RB, targetVersionNumber: 1 } });
record('rollback', r.status === 202, `HTTP ${r.status}`, 'HTTP 202 back to v1');
r = await call('GET', `/api/v1/admin/content-commands/${RB}`, { token: pub });
const rbState = JSON.stringify(r.json);
record('rollback-state', r.status === 200 && rbState.includes('PUBLISHED'), `HTTP ${r.status}`, 'content PUBLISHED again');
// dual-writer duel (M3-002): writer B advances, writer A replays stale -> 409.
const DU = `wct-duel-${stamp}`;
r = await call('POST', '/api/v1/admin/content-commands', { token: ed, body: { command: 'CREATE_DRAFT', contentCode: DU, content: { contentType: 'COURSE_UNIT', title: 'duel probe' } } });
record('duel-draft', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
r = await call('POST', '/api/v1/admin/content-commands', { token: ed, body: { command: 'SUBMIT_REVIEW', contentCode: DU } });
record('duel-submit', r.status === 202, `HTTP ${r.status}`, 'HTTP 202 advances');
r = await call('POST', '/api/v1/admin/content-commands', { token: ed, body: { command: 'SUBMIT_REVIEW', contentCode: DU, expectedStateVersion: 1 } });
record('duel-stale-409', r.status === 409 && JSON.stringify(r.json).includes('VERSION_CONFLICT'), `HTTP ${r.status}`, 'HTTP 409 VERSION_CONFLICT');
// batch round-trip via gateway: 2 created + 1 skipped dupe; replay stable.
const batchBody = { items: [
  { contentCode: `${DU}-b1`, content: { contentType: 'COURSE_UNIT', title: 'batch one' } },
  { contentCode: `${DU}-b2`, content: { contentType: 'COURSE_UNIT', title: 'batch two' } },
  { contentCode: DU, content: { contentType: 'COURSE_UNIT', title: 'dupe' } },
] };
r = await call('POST', '/api/v1/admin/content-commands/import/batch', { token: ed, body: batchBody });
const bdata = r.json?.data ?? r.json ?? {};
record('batch-roundtrip', r.status === 202 && bdata.accepted === 2 && bdata.skipped === 1, `HTTP ${r.status} accepted=${bdata.accepted} skipped=${bdata.skipped}`, 'HTTP 202 2+1');
r = await call('POST', '/api/v1/admin/content-commands/import/batch', { token: ed, body: batchBody });
const bdata2 = r.json?.data ?? r.json ?? {};
record('batch-retry-stable', r.status === 202 && bdata2.accepted === 0 && bdata2.skipped === 3, `HTTP ${r.status} accepted=${bdata2.accepted} skipped=${bdata2.skipped}`, 'HTTP 202 0+3 no dupes');
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'W8-LIVE-PUBLISH', capturedAt: new Date().toISOString(), contentCode: CODE, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/w8-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`W8 live: ${passed}/${checks.length} ${evidence.result}`);
process.exitCode = evidence.result === 'PASS' ? 0 : 1;
} finally {
  // Every synthetic identity is retired even when a command or assertion fails.
  // Generated identifiers are validated before interpolation into local SQL.
  const safeIdentifiers = createdIdentifiers.filter((value) => /^(?:test-[a-z0-9]+|w8l)-[a-z0-9]+@local\.invalid$/.test(value));
  if (safeIdentifiers.length !== createdIdentifiers.length) throw new Error('unexpected fixture identifier');
  if (safeIdentifiers.length) {
    const sqlIds = safeIdentifiers.map((value) => `'${value}'`).join(',');
    mysql(`START TRANSACTION;
UPDATE iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id
   SET s.status='REVOKED', s.revoked_at=UTC_TIMESTAMP(6), s.revoke_reason='LOCAL_FIXTURE_CLEANUP'
 WHERE a.identifier IN (${sqlIds}) AND s.status='ACTIVE';
UPDATE iam_service.iam_account SET status='DISABLED', roles='', permissions=''
 WHERE identifier IN (${sqlIds});
COMMIT;`);
  }
}
