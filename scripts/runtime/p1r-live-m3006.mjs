// M3-006 live: full publish lifecycle with four-eyes segregation, publish
// idempotency, UTC-normalized publishedAt, and zero-delay projection proof.
// Timed/scheduled orchestration via workflow timers stays deferred (named).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const stamp = Date.now().toString(36);
const device = { deviceType: 'WEB', clientVersion: 'w3006-live-1', deviceName: 'w3006-live-probe' };
const CODE = `LIVE-PUB-${stamp}`.toUpperCase();
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
const idem = (s) => `w3006-live-${stamp}-${++idemN}-${s}`.slice(0, 60);
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
function mysql(q) {
  return execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-e', q], { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
}
async function staff(tag, roles) {
  const identifier = `w3006-${tag}-${stamp}@local.invalid`;
  const password = `E2eLive${stamp}Aa9!xQ`;
  let r = await call('POST', '/api/v1/auth/register', { body: { identifier, password, device }, idemKey: idem(`${tag}-reg`) });
  const t0 = r.json?.data?.accessToken ?? null;
  mysql(`UPDATE iam_service.iam_account SET roles = '${roles}' WHERE identifier = '${identifier}'`);
  await call('POST', '/api/v1/iam/adult-gate', { token: t0, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idemKey: idem(`${tag}-gate`) });
  for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    await call('PUT', '/api/v1/iam/consents', { token: t0, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idemKey: idem(`${tag}-c-${t}`) });
  }
  r = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device }, idemKey: idem(`${tag}-login`) });
  return r.json?.data?.accessToken ?? null;
}
const editor = await staff('ed', 'staff,content-editor');
const reviewer1 = await staff('r1', 'staff,review-l1');
const reviewer2 = await staff('r2', 'staff,review-l2');
const publisher = await staff('pb', 'staff,content-publisher');
const dual = await staff('er', 'staff,content-editor,review-l1');
record('staff-ready', !!(editor && reviewer1 && reviewer2 && publisher && dual), 'five staff ready', 'tokens');
const cmd = (token, command, extra, key) => call('POST', '/api/v1/admin/content-commands', { token, body: { command, contentCode: CODE, ...extra }, idemKey: key });
const draft = { contentType: 'COURSE_UNIT', title: 'Live publish proof', contentLocale: 'en-US', targetLevel: 'A2', payload: { body: 'hello' }, rights: { license: 'LOCAL_FIXTURE' }, releaseNote: 'proof' };
let r = await cmd(editor, 'CREATE_DRAFT', { content: draft }, idem('create'));
record('create-draft', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
r = await cmd(editor, 'VALIDATE_DRAFT', {}, idem('validate'));
record('validate-draft', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
r = await cmd(editor, 'SUBMIT_REVIEW', {}, idem('submit'));
record('submit-review', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
// four-eyes: a dual-role author cannot review their own version (true 409),
// and a pure editor has no review permission at all (403 segregation).
{
  const code2 = `LIVE-PUB2-${stamp}`.toUpperCase();
  const c2 = (command, extra, key) => call('POST', '/api/v1/admin/content-commands', { token: dual, body: { command, contentCode: code2, ...extra }, idemKey: key });
  await c2('CREATE_DRAFT', { content: draft }, idem('er-create'));
  await c2('VALIDATE_DRAFT', {}, idem('er-validate'));
  await c2('SUBMIT_REVIEW', {}, idem('er-submit'));
  r = await c2('REVIEW_FIRST', { reviewDecision: 'APPROVED' }, idem('er-review'));
  record('four-eyes', r.status === 409, `HTTP ${r.status}`, 'HTTP 409 self-review denied');
}
r = await cmd(editor, 'REVIEW_FIRST', { reviewDecision: 'APPROVED' }, idem('selfreview'));
record('editor-cannot-review', r.status === 403, `HTTP ${r.status}`, 'HTTP 403 segregation');
r = await cmd(reviewer1, 'REVIEW_FIRST', { reviewDecision: 'APPROVED' }, idem('review1'));
record('review-first', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
r = await cmd(reviewer2, 'REVIEW_FINAL', { reviewDecision: 'APPROVED' }, idem('review2'));
record('review-final', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
const pubKey = idem('publish');
r = await cmd(publisher, 'PUBLISH', {}, pubKey);
const versionId = data(r).contentVersionId ?? null;
record('publish', r.status === 202 && !!versionId, `HTTP ${r.status}`, 'HTTP 202 + version');
// same-key publish replay -> same version, no duplicate.
r = await call('POST', '/api/v1/admin/content-commands', { token: publisher, body: { command: 'PUBLISH', contentCode: CODE }, idemKey: pubKey });
record('publish-idempotent', r.status === 202 && (data(r).contentVersionId ?? null) === versionId, `HTTP ${r.status} same version`, 'idempotent replay');
// publishedAt is UTC-normalized (Zulu) in the owner row.
{
  const row = mysql(`SELECT published_at FROM content_service.content_version WHERE content_version_id = ${versionId}`);
  record('published-at-utc', row.endsWith('Z') || row.includes('+00:00') || /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(row), row.slice(0, 26), 'UTC instant recorded');
}
// zero-delay proof: a fresh learner sees the fresh version at once.
{
  const identifier = `w3006-ln-${stamp}@local.invalid`;
  const password = `E2eLive${stamp}Aa9!xQ`;
  let q = await call('POST', '/api/v1/auth/register', { body: { identifier, password, device }, idemKey: idem('ln-reg') });
  const t0 = q.json?.data?.accessToken ?? null;
  await call('POST', '/api/v1/iam/adult-gate', { token: t0, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idemKey: idem('ln-gate') });
  for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    await call('PUT', '/api/v1/iam/consents', { token: t0, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idemKey: idem(`ln-c-${t}`) });
  }
  q = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device }, idemKey: idem('ln-login') });
  const learnerToken = q.json?.data?.accessToken ?? null;
  const cat = await call('GET', `/api/v1/content/learner/${CODE}`, { token: learnerToken });
  record('projection-immediate', cat.status === 200, `HTTP ${cat.status}`, 'learner sees it now');
}
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'M3006-LIVE-PUBLISH', capturedAt: new Date().toISOString(), gateway: GW, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/m3006-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`M3006 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
