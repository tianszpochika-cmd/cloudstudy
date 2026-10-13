import { readFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
const API = 'https://api.clyunedev.com/api/v1', ORIGIN = 'https://admin.clyunedev.com', TAG = 'SMOKE-SUPGOV-20261013';
const AO = process.env.ADMINOPS; // internal admin-ops (container IP) for steps the gateway does not route
const DEVICE = { deviceType: 'WEB', clientVersion: TAG, deviceName: TAG };
const out = [];
const check = (name, ok, info = '') => { out.push(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); };
function cred(file) { return Object.fromEntries(readFileSync(file, 'utf8').trim().split('\n').map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; })); }
async function call(method, path, body, token, base = API) {
  const headers = { accept: 'application/json', origin: ORIGIN };
  if (token) headers.authorization = 'Bearer ' + token;
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (method !== 'GET') headers['idempotency-key'] = `${TAG}-${randomUUID()}`;
  const r = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null; try { json = await r.json(); } catch {}
  await new Promise((res) => setTimeout(res, 300));
  return { status: r.status, json, data: json?.data ?? json, code: json?.error?.code ?? json?.code };
}
async function login(id, pw) {
  const r = await call('POST', '/auth/login', { identifier: id, password: pw, device: DEVICE });
  if (!r.data?.accessToken) throw new Error(`login ${id} ${r.status}`);
  return r.data.accessToken;
}
const admin = cred('/root/e2e-20261013-admin.txt'), rev = cred('/root/e2e-20261013-reviewer.txt');
const Ta = await login(admin.identifier, admin.password), Tr = await login(rev.identifier, rev.password);
const fp = createHash('sha256').update(TAG).digest('hex');

// 1 tickets
const hashOnly = await call('POST', '/admin/ops/tickets', { categoryCode: 'TECHNICAL', resourceRef: TAG, descriptionFingerprint: fp, priority: 'NORMAL', attachments: [] }, Ta);
check('hash-only create -> 503', hashOnly.status === 503, `${hashOnly.status} ${hashOnly.code}`);
const created = await call('POST', '/admin/ops/tickets', { categoryCode: 'TECHNICAL', resourceRef: TAG, descriptionFingerprint: fp, priority: 'NORMAL',
  attachments: [{ objectRef: 'obj:SMOKE-SUPGOV-20261013-1', objectVersion: 'v1', purposeCode: 'SUPPORT_ISSUE', contentType: 'text/plain', sizeBytes: 64 }] }, Ta);
const ticketId = created.data?.ticketId;
check('verified create', created.status === 200 && created.data?.actionable === true, `${created.status} ${ticketId} ${created.data?.workflowVersion}`);
const gwTransition = await call('POST', `/admin/ops/tickets/${ticketId}/transitions`, 'START', Ta);
check('gateway transitions route (known gap, expect 404)', gwTransition.status === 404, `${gwTransition.status}`);
const st = await call('POST', `/internal/v1/admin-ops/tickets/${ticketId}/transitions`, 'START', Ta, AO);
check('internal START (enum body "START")', st.status === 200 && st.data?.state === 'IN_PROGRESS', `${st.status} ${st.data?.state}`);
const prep = await call('POST', `/internal/v1/admin-ops/tickets/${ticketId}/transitions/prepare`, 'RESOLVE', Ta, AO);
const token = prep.data?.token;
const res = await (async () => {
  const r = await fetch(`${AO}/internal/v1/admin-ops/tickets/${ticketId}/transitions`, { method: 'POST', headers: { authorization: 'Bearer ' + Ta, 'content-type': 'application/json', 'idempotency-key': `${TAG}-${randomUUID()}`, 'x-confirmation-token': token }, body: '"RESOLVE"' });
  return { status: r.status, json: await r.json().catch(() => null) };
})();
check('internal RESOLVE with confirmation', res.status === 200 && (res.json?.data ?? res.json)?.state === 'RESOLVED', `${res.status}`);

// 2 recovery TICKET/REOPEN end to end
const req = await call('POST', '/admin/recovery/recoveries', { subjectType: 'TICKET', subjectId: ticketId, action: 'REOPEN', reason: TAG }, Ta);
const rid = req.data?.recoveryId;
check('request recovery (admin)', req.status === 201 && req.data?.status === 'REQUESTED', `${req.status} ${rid}`);
const selfApprove = await call('POST', `/admin/recovery/recoveries/${rid}/approve`, undefined, Ta);
check('self-approve refused', selfApprove.status === 403, `${selfApprove.status}`);
const appr = await call('POST', `/admin/recovery/recoveries/${rid}/approve`, undefined, Tr);
check('approve by reviewer', appr.status === 200 && appr.data?.status === 'APPROVED', `${appr.status} ${appr.data?.status}`);
const exe = await call('POST', `/admin/recovery/recoveries/${rid}/execute`, undefined, Ta);
check('execute (admin) -> EXECUTED', exe.status === 200 && exe.data?.status === 'EXECUTED', `${exe.status} ${exe.data?.status} ${exe.data?.effectDetail ?? JSON.stringify(exe.json).slice(0, 200)}`);
const again = await call('POST', `/admin/recovery/recoveries/${rid}/execute`, undefined, Ta);
check('re-execute is no-op EXECUTED', again.status === 200 && again.data?.status === 'EXECUTED', `${again.status}`);
const tk = await call('GET', `/admin/ops/tickets/${ticketId}`, undefined, Ta);
check('ticket reopened IN_PROGRESS', tk.data?.state === 'IN_PROGRESS', `${tk.status} ${tk.data?.state}`);

// 3 unknown action fails closed
const bad = await call('POST', '/admin/recovery/recoveries', { subjectType: 'TICKET', subjectId: ticketId, action: 'DELETE', reason: TAG }, Ta);
await call('POST', `/admin/recovery/recoveries/${bad.data?.recoveryId}/approve`, undefined, Tr);
const badExe = await call('POST', `/admin/recovery/recoveries/${bad.data?.recoveryId}/execute`, undefined, Ta);
check('unknown action refused, not EXECUTED', badExe.status === 403, `${badExe.status} ${JSON.stringify(badExe.json).slice(0, 160)}`);

// 4 permission checks
const revExecNoManage = await call('POST', '/admin/recovery/recoveries', { subjectType: 'TICKET', subjectId: ticketId, action: 'REOPEN', reason: TAG }, Tr);
check('reviewer cannot request recovery (no admin.recovery.request)', revExecNoManage.status === 403, `${revExecNoManage.status}`);
const pol = await call('GET', '/iam/policy-versions?pageSize=5', undefined, Tr);
check('reviewer policy read forbidden', pol.status === 403, `${pol.status}`);
const polA = await call('GET', '/iam/policy-versions?pageSize=5', undefined, Ta);
check('admin policy read ok', polA.status === 200, `${polA.status}`);
const board = await call('GET', '/admin/ops/tickets?projection=it7', undefined, Ta);
check('governance FROZEN', JSON.stringify(board.json).includes('"writeSwitch":"FROZEN"') && JSON.stringify(board.json).includes('"dispositionOpen":false'), `${board.status}`);
for (const p of ['/internal/v1/workflow/recoveries/x/execute', `/internal/v1/admin-ops/tickets/${ticketId}/recovery-reopen`]) {
  const r = await fetch('https://api.clyunedev.com' + p, { method: 'POST', headers: { authorization: 'Bearer ' + Ta, origin: ORIGIN } });
  check(`public ${p.split('/').slice(0, 5).join('/')} not exposed`, r.status === 404 || r.status === 403, `${r.status}`);
}
console.log(out.join('\n'));
console.log(JSON.stringify({ ticketId, rid, badRid: bad.data?.recoveryId }));
