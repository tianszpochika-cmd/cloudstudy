// M3-003 live: fixture-driven validation blocking + audit-evidence replay
// against MySQL. validate/auto is read-only; rights windows are
// server-defaulted at create, so expiry fixtures go straight to the
// owner schema (documented), then validate by code and cross-check.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const stamp = Date.now().toString(36);
const identifier = `w3003-${stamp}@local.invalid`;
const password = `E2eLive${stamp}Aa9!xQ`;
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
const idem = (s) => `w3003-live-${stamp}-${++idemN}-${s}`.slice(0, 60);
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
  return execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-e', q], { encoding: 'utf8' }).trim();
}
// staff editor (documented local fixture, same as W8).
const device = { deviceType: 'WEB', clientVersion: 'w3003-live-1', deviceName: 'w3003-live-probe' };
let r = await call('POST', '/api/v1/auth/register', { body: { identifier, password, device }, idemKey: idem('reg') });
record('setup-register', r.status === 201, `HTTP ${r.status}`, 'HTTP 201');
mysql(`UPDATE iam_service.iam_account SET roles = 'staff,content-editor,content-reviewer', permissions = 'content:write,content:review,content:read' WHERE identifier = '${identifier}'`);
r = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device }, idemKey: idem('login') });
const token = r.json?.data?.accessToken ?? null;
record('setup-login', r.status === 200 && !!token, `HTTP ${r.status}`, 'HTTP 200 + token');
async function draft(code) {
  return call('POST', '/api/v1/admin/content-commands', { token, body: { command: 'CREATE_DRAFT', contentCode: code, content: { contentType: 'COURSE_UNIT', title: `m3003 ${code}`, contentLocale: 'en-US', targetLevel: 'A1' } }, idemKey: idem(`draft-${code}`) });
}
async function validate(body) {
  return call('POST', '/api/v1/admin/content-commands/validate/auto', { token, body });
}
const codes = (r) => (data(r).findings ?? []).map((f) => f.code);
// fixture VALID: passes, carries rule version.
const VALID = `wct-m3003-ok-${stamp}`;
r = await draft(VALID);
record('valid-draft', r.status === 202, `HTTP ${r.status}`, 'HTTP 202');
r = await validate({ contentCode: VALID });
{
  const d = data(r);
  record('valid-pass', r.status === 200 && d.passed === true && d.ruleVersion === 'P1_AUTO_VALIDATE_V1', `HTTP ${r.status} passed=${d.passed} rule=${d.ruleVersion}`, 'passed + rule version');
}
// fixture EXPIRED: DB window fully in the past (starts < expires < now;
// expiry-before-start rows are rejected at rehydrate, so both ends move).
const EXP = `wct-m3003-exp-${stamp}`;
await draft(EXP);
mysql(`UPDATE content_service.content_version SET rights_starts_at = '2020-01-01 00:00:00.000000', rights_expires_at = '2020-06-01 00:00:00.000000' WHERE content_id = (SELECT content_id FROM content_service.content_definition WHERE content_code = '${EXP}')`);
r = await validate({ contentCode: EXP });
record('expired-blocked', r.status === 200 && data(r).passed === false && codes(r).includes('RIGHTS_EXPIRED'), `HTTP ${r.status} findings=${codes(r).join(',')}`, 'RIGHTS_EXPIRED BLOCKER');
// audit-evidence replay against MySQL: the report must match the stored window.
{
  const row = mysql(`SELECT rights_starts_at, rights_expires_at FROM content_service.content_version WHERE content_id = (SELECT content_id FROM content_service.content_definition WHERE content_code = '${EXP}') ORDER BY version_no DESC LIMIT 1`);
  const r2 = await validate({ contentCode: EXP });
  const stillBlocked = data(r2).passed === false && codes(r2).includes('RIGHTS_EXPIRED');
  record('audit-replay', row.startsWith('2020-01-01') && row.includes('2020-06-01') && stillBlocked, `db_window=${row} replay_blocked=${stillBlocked}`, 'DB window + replay agree');
}
// fixture FUTURE: window not started -> RIGHTS_NOT_YET_VALID.
const FUT = `wct-m3003-fut-${stamp}`;
await draft(FUT);
mysql(`UPDATE content_service.content_version SET rights_starts_at = '2099-01-01 00:00:00.000000', rights_expires_at = NULL WHERE content_id = (SELECT content_id FROM content_service.content_definition WHERE content_code = '${FUT}')`);
r = await validate({ contentCode: FUT });
record('future-blocked', r.status === 200 && data(r).passed === false && codes(r).includes('RIGHTS_NOT_YET_VALID'), `HTTP ${r.status} findings=${codes(r).join(',')}`, 'RIGHTS_NOT_YET_VALID BLOCKER');
// leak fixture: posted draft carrying an assessment-only key.
r = await validate({ content: { contentType: 'COURSE_UNIT', title: 'leak probe', targetLevel: 'A1', solution: 'must stay assessment-only' } });
record('leak-blocked', r.status === 200 && codes(r).includes('ANSWER_LEAK_DETECTED'), `HTTP ${r.status} findings=${codes(r).join(',')}`, 'ANSWER_LEAK_DETECTED');
// read-only proof: validation mutates nothing (version count stable).
{
  const before = mysql(`SELECT COUNT(*) FROM content_service.content_version WHERE content_id = (SELECT content_id FROM content_service.content_definition WHERE content_code = '${VALID}')`);
  await validate({ contentCode: VALID });
  const after = mysql(`SELECT COUNT(*) FROM content_service.content_version WHERE content_id = (SELECT content_id FROM content_service.content_definition WHERE content_code = '${VALID}')`);
  record('read-only', before === after, `versions before=${before} after=${after}`, 'no mutation');
}
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'M3003-LIVE-VALIDATE', capturedAt: new Date().toISOString(), gateway: GW, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/m3003-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`M3003 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
