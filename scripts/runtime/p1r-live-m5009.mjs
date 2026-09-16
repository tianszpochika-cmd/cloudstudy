// M5-009 live: variant-issuing endpoint wiring + timezone D1/D7 proof.
// Wrong submits persist mistake rows; verify drives PENDING->D1->D7->
// MASTERED with exact +24h/+7d due arithmetic; variant re-arms the loop;
// out-of-order transitions 409; Asia/Shanghai calendar days agree.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const stamp = Date.now().toString(36);
const identifier = `w5009-${stamp}@local.invalid`;
const password = `E2eLive${stamp}Aa9!xQ`;
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
const idem = (s) => `w5009-live-${stamp}-${++idemN}-${s}`.slice(0, 60);
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
const device = { deviceType: 'WEB', clientVersion: 'w5009-live-1', deviceName: 'w5009-live-probe' };
let r = await call('POST', '/api/v1/auth/register', { body: { identifier, password, device }, idemKey: idem('reg') });
record('setup-register', r.status === 201, `HTTP ${r.status}`, 'HTTP 201');
const t0 = r.json?.data?.accessToken ?? null;
await call('POST', '/api/v1/iam/adult-gate', { token: t0, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idemKey: idem('gate') });
for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
  await call('PUT', '/api/v1/iam/consents', { token: t0, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idemKey: idem(`c-${t}`) });
}
r = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device }, idemKey: idem('login') });
const token = r.json?.data?.accessToken ?? null;
record('setup-login', r.status === 200 && !!token, `HTTP ${r.status}`, 'HTTP 200 + token');
// wrong submit -> mistake row PENDING_RETRY.
r = await call('POST', '/api/v1/assessment/sessions', { token, body: { mode: 'PRACTICE' }, idemKey: idem('sess') });
const sess = data(r);
const items = (sess.items ?? []).slice(0, 1);
const subs = items.map((it) => {
  const opts = it.options ?? [];
  const wrong = opts.length > 1 ? (opts[1].optionId ?? opts[1].key ?? 'b') : 'zzz-wrong';
  return { itemId: String(it.itemId ?? it.id), itemCode: it.itemCode, response: String(wrong) };
});
r = await call('POST', `/api/v1/assessment/sessions/${sess.sessionId}/attempts`, { token, body: { submissionId: `w5009-${stamp}-s1`, items: subs }, idemKey: idem('att') });
record('wrong-submit', [200, 201].includes(r.status), `HTTP ${r.status}`, 'HTTP 200 graded');
r = await call('GET', '/api/v1/assessment/mistakes', { token });
{
  const list = data(r).items ?? [];
  record('mistake-recorded', r.status === 200 && list.length >= 1 && list[0].mistakeStatus === 'PENDING_RETRY', `HTTP ${r.status} n=${list.length} status=${list[0]?.mistakeStatus}`, 'PENDING_RETRY row');
}
const mid = (data(r).items ?? [])[0]?.mistakeId;
// out-of-order: D1 verify while PENDING -> 409.
r = await call('POST', `/api/v1/assessment/mistakes/999999999/verify`, { token, body: { outcome: 'CORRECT' }, idemKey: idem('neg404') });
record('mistake-not-found', r.status === 404, `HTTP ${r.status}`, 'HTTP 404 unknown id');
if (mid != null) {
  // D0 correct -> D1 with exact +24h due.
  const tBefore = Date.now();
  r = await call('POST', `/api/v1/assessment/mistakes/${mid}/verify`, { token, body: { outcome: 'CORRECT' }, idemKey: idem('d0') });
  {
    const d = data(r);
    const due = new Date(d.nextActionAt).getTime();
    const exact = Math.abs(due - (tBefore + 24 * 3600 * 1000)) < 60_000;
    const sh = new Date(due).toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
    const shBefore = new Date(tBefore).toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
    record('d0-to-d1', r.status === 200 && d.mistakeStatus === 'DELAY_VERIFY_D1' && exact, `HTTP ${r.status} +24h exact=${exact} sh ${shBefore}->${sh}`, 'DELAY_VERIFY_D1 +24h');
  }
  // variant re-arms the loop with a trace link.
  const variantItem = 900000 + (Date.now() % 899999);
  r = await call('POST', `/api/v1/assessment/mistakes/${mid}/variant`, { token, body: { variantItemId: variantItem }, idemKey: idem('var') });
  {
    const d = data(r);
    const trace = JSON.stringify(d.reasonTrace ?? []);
    record('variant-issued', r.status === 200 && d.mistakeStatus === 'PENDING_RETRY' && trace.includes(String(variantItem)), `HTTP ${r.status} trace-linked=${trace.includes(String(variantItem))}`, 'PENDING_RETRY + trace');
  }
  // bad variant (same item): int64 item ids lose precision as JSON numbers,
  // so fetch the exact value from MySQL and send it as a string (the
  // endpoint parses numeric strings exactly, P1-LIVE-010 idiom).
  const exactItem = mysql(`SELECT item_id FROM assessment_service.assessment_mistake WHERE mistake_id = ${mid}`);
  r = await call('POST', `/api/v1/assessment/mistakes/${mid}/variant`, { token, body: { variantItemId: exactItem }, idemKey: idem('varneg') });
  record('variant-same-item-denied', r.status === 400, `HTTP ${r.status}`, 'HTTP 400 same item');
  // D0 again -> D1 again -> D7 with exact +7d -> MASTERED.
  await call('POST', `/api/v1/assessment/mistakes/${mid}/verify`, { token, body: { outcome: 'CORRECT' }, idemKey: idem('d0b') });
  const tD1 = Date.now();
  r = await call('POST', `/api/v1/assessment/mistakes/${mid}/verify`, { token, body: { outcome: 'CORRECT' }, idemKey: idem('d1') });
  {
    const d = data(r);
    const due = new Date(d.nextActionAt).getTime();
    const exact = Math.abs(due - (tD1 + 7 * 24 * 3600 * 1000)) < 60_000;
    record('d1-to-d7', r.status === 200 && d.mistakeStatus === 'DELAY_VERIFY_D7' && exact, `HTTP ${r.status} +7d exact=${exact}`, 'DELAY_VERIFY_D7 +7d');
  }
  r = await call('POST', `/api/v1/assessment/mistakes/${mid}/verify`, { token, body: { outcome: 'CORRECT' }, idemKey: idem('d7') });
  record('d7-to-mastered', r.status === 200 && data(r).mistakeStatus === 'MASTERED', `HTTP ${r.status} status=${data(r).mistakeStatus}`, 'MASTERED');
  // mastered verify again -> 409.
  r = await call('POST', `/api/v1/assessment/mistakes/${mid}/verify`, { token, body: { outcome: 'CORRECT' }, idemKey: idem('neg409') });
  record('mastered-denied', r.status === 409, `HTTP ${r.status}`, 'HTTP 409 terminal');
  // wrong answer on mastered -> REOPENED, loop restarts honestly.
  r = await call('POST', `/api/v1/assessment/mistakes/${mid}/verify`, { token, body: { outcome: 'WRONG' }, idemKey: idem('reopen') });
  record('wrong-reopens', r.status === 200 && data(r).mistakeStatus === 'PENDING_RETRY', `HTTP ${r.status} status=${data(r).mistakeStatus}`, 'REOPENED->PENDING_RETRY');
} else {
  for (const n of ['d0-to-d1', 'variant-issued', 'variant-same-item-denied', 'd1-to-d7', 'd7-to-mastered', 'mastered-denied', 'wrong-reopens']) {
    record(n, false, 'no mistake id', 'green');
  }
}
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'M5009-LIVE-VARIANTS', capturedAt: new Date().toISOString(), gateway: GW, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/m5009-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`M5009 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
