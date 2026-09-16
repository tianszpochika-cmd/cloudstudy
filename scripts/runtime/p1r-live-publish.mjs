// W8 live: content publish run (M3-010) -- draft -> dual review -> publish ->
// learner projection -> takedown, plus four-eyes self-review denial.
// Staff: three narrow roles (editor / reviewer-1 / reviewer-2+publisher)
// provisioned via DB grant (documented local fixture); a fourth all-powerful
// staffer proves FOUR_EYES_REQUIRED still denies the same actor.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const stamp = Date.now().toString(36);
const device = { deviceType: 'WEB', clientVersion: 'w8-live-1', deviceName: 'w8-live-probe' };
const checks = [];
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
  await call('POST', '/api/v1/auth/register', { body: { identifier, password, device } });
  mysql(`UPDATE iam_service.iam_account SET roles = '${roles}', permissions = '${perms}' WHERE identifier = '${identifier}'`);
  const r = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device } });
  return r.json?.data?.accessToken ?? null;
}
async function learner() {
  const identifier = `w8l-${stamp}@local.invalid`;
  const password = `E2eLive${stamp}Aa9!xQ`;
  let r = await call('POST', '/api/v1/auth/register', { body: { identifier, password, device } });
  let token = r.json?.data?.accessToken ?? null;
  await call('POST', '/api/v1/iam/adult-gate', { token, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' } });
  for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    await call('PUT', '/api/v1/iam/consents', { token, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' } });
  }
  r = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device } });
  return r.json?.data?.accessToken ?? null;
}
const ed = await staffer('editor', 'staff,content-editor', 'content:write');
const r1 = await staffer('reviewer1', 'staff,review-l1', 'content:review:first');
const r2 = await staffer('reviewer2', 'staff,review-l2,content-publisher', 'content:review:final,content:publish');
const sup = await staffer('super', 'staff,content-editor,review-l1,review-l2,content-publisher', 'content:write,content:review:first,content:review:final,content:publish');
record('staff-ready', !!(ed && r1 && r2 && sup), '4 staff tokens', 'tokens');
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
r = await call('POST', '/api/v1/admin/content-commands', { token: r2, body: { command: 'PUBLISH', contentCode: CODE } });
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
r = await call('POST', '/api/v1/admin/content-commands', { token: r2, body: { command: 'UNPUBLISH', contentCode: CODE } });
record('unpublish', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
r = await call('GET', '/api/v1/content/learner/catalog?contentLocale=en-US', { token: ltok });
record('projection-gone', r.status === 200 && !JSON.stringify(r.json).includes(CODE), `HTTP ${r.status}`, 'catalog hides it');
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'W8-LIVE-PUBLISH', capturedAt: new Date().toISOString(), contentCode: CODE, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/w8-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`W8 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
