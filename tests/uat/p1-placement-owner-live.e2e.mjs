// Local Gateway/owner acceptance probe. Credentials and JWTs remain in process memory.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const gateway = 'http://127.0.0.1:18070';
const nonce = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
const identifier = `uat-p1-placement-${nonce}@local.invalid`;
const password = `Uat!${randomBytes(20).toString('base64url')}a9`;
const device = { deviceType: 'WEB', clientVersion: 'uat-p1-placement', deviceName: 'local-uat' };
const missingSession = `asess_missing_${nonce.replaceAll('-', '')}`;
const missingReport = `rpt_missing_${nonce.replaceAll('-', '')}`;
const base = '/api/v1/assessment/placement';
const permissions = [
  'assessment.placement.session.create',
  'assessment.placement.session.read',
  'assessment.placement.response.submit',
  'assessment.placement.skip',
  'assessment.placement.report.read',
];
const responseBody = {
  expectedStateVersion: 1, itemId: 1, itemSequence: 1,
  candidateResponse: {}, responseDigest: '0'.repeat(64), timeSpentSec: 0,
};
const routes = [
  { name: 'create', method: 'POST', path: `${base}/sessions`, body: {} },
  { name: 'read', method: 'GET', path: `${base}/sessions/${missingSession}` },
  { name: 'respond', method: 'POST', path: `${base}/sessions/${missingSession}/responses`, body: responseBody },
  { name: 'skip', method: 'POST', path: `${base}/baselines/skip`, body: {} },
  { name: 'report', method: 'GET', path: `${base}/reports/${missingReport}` },
];
const forgedHeaders = { 'x-role': 'admin', 'x-b5-role': 'admin', 'x-tenant-id': 'another-tenant' };
const stages = [];
let requestNo = 0;
let principalId;
let token;
let registered = false;
let cleanup = { status: 'not-needed' };

function mysql(sql) {
  return execFileSync('docker', ['exec', '-i', 'yuxuexing-local-mysql-1', 'sh', '-c',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -N -B'],
  { input: `${sql.trim()}\n`, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function exactIdentifier() {
  if (!/^uat-p1-placement-[a-z0-9-]+@local\.invalid$/.test(identifier)) {
    throw new Error('unsafe synthetic account identifier');
  }
  return identifier;
}

function exactPrincipal() {
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(principalId ?? '')) {
    throw new Error('unsafe synthetic principal identifier');
  }
  return principalId;
}

async function call(method, route, { bearer, body, headers: extraHeaders } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web', ...extraHeaders };
  if (bearer) headers.authorization = `Bearer ${bearer}`;
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    headers['idempotency-key'] = `uat-p1-${nonce}-${++requestNo}`;
  }
  const response = await fetch(gateway + route, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual',
  });
  const payload = await response.json().catch(() => null);
  return { status: response.status, code: payload?.error?.code ?? payload?.code ?? null,
    accessToken: payload?.data?.accessToken };
}

async function matrix(name, bearer, expectations, headers) {
  const results = [];
  for (const route of routes) {
    const outcome = await call(route.method, route.path, { bearer, body: route.body, headers });
    results.push({ route: route.name, method: route.method, status: outcome.status, code: outcome.code });
    if (outcome.status !== expectations[route.name]) {
      throw new Error(`${name}/${route.name} expected ${expectations[route.name]}, got ${outcome.status}`);
    }
  }
  stages.push({ stage: name, results });
}

function accountPrincipal() {
  const rows = mysql(`SELECT principal_id FROM iam_service.iam_account
    WHERE identifier='${exactIdentifier()}' AND status='ACTIVE';`).split(/\r?\n/).filter(Boolean);
  if (rows.length !== 1) throw new Error('synthetic account lookup was not unique');
  principalId = rows[0];
  return exactPrincipal();
}

function ownerCounts() {
  const subject = exactPrincipal();
  const tables = ['session', 'response', 'checkpoint', 'result', 'idempotency'];
  const sql = tables.map((table) => `SELECT '${table}', COUNT(*) FROM assessment_service.p1_placement_${table}
    WHERE principal_id='${subject}';`).join('\n')
    + `\nSELECT 'outbox', COUNT(*) FROM assessment_service.assessment_outbox_event
      WHERE event_name='assessment.placement.completed.v1'
        AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.principalId'))='${subject}';`;
  const rows = mysql(sql).split(/\r?\n/).filter(Boolean);
  const counts = Object.fromEntries(rows.map((row) => {
    const [table, value] = row.split('\t');
    return [table, Number(value)];
  }));
  if ([...tables, 'outbox'].some((table) => !Number.isInteger(counts[table]))) {
    throw new Error('owner count probe incomplete');
  }
  return counts;
}

function removeExactPlacementPermissions() {
  const subject = exactPrincipal();
  let expression = "CONCAT(',', permissions, ',')";
  for (const permission of permissions) {
    expression = `REPLACE(${expression}, ',${permission},', ',')`;
  }
  const rows = mysql(`UPDATE iam_service.iam_account
    SET permissions=TRIM(BOTH ',' FROM ${expression})
    WHERE identifier='${exactIdentifier()}' AND principal_id='${subject}' AND status='ACTIVE';
    SELECT ROW_COUNT();
    SELECT ${permissions.map((permission) => `FIND_IN_SET('${permission}', permissions)`).join(' + ')}
    FROM iam_service.iam_account WHERE identifier='${exactIdentifier()}' AND principal_id='${subject}';`)
    .split(/\r?\n/).filter(Boolean);
  if (rows.length !== 2 || rows[0] !== '1' || rows[1] !== '0') {
    throw new Error('exact permission removal was not verified');
  }
}

function disableExactAccount() {
  const rows = mysql(`START TRANSACTION;
    UPDATE iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id
       SET s.status='REVOKED', s.revoked_at=UTC_TIMESTAMP(6), s.revoke_reason='LOCAL_UAT_CLEANUP'
     WHERE a.identifier='${exactIdentifier()}' AND s.status='ACTIVE';
    UPDATE iam_service.iam_account SET status='DISABLED', roles='', permissions=''
     WHERE identifier='${exactIdentifier()}';
    SELECT COUNT(*), COALESCE(MAX(status),'NONE') FROM iam_service.iam_account
     WHERE identifier='${exactIdentifier()}';
    SELECT COUNT(*) FROM iam_service.iam_session s JOIN iam_service.iam_account a
      ON a.principal_id=s.principal_id WHERE a.identifier='${exactIdentifier()}' AND s.status='ACTIVE';
    COMMIT;`).split(/\r?\n/).filter(Boolean);
  const [count, status] = (rows[0] ?? '').split('\t');
  const activeSessions = Number(rows[1]);
  if (count !== '1' || status !== 'DISABLED' || activeSessions !== 0) {
    throw new Error('synthetic account cleanup verification failed');
  }
  return { accountCount: Number(count), accountStatus: status, activeSessions };
}

try {
  await matrix('anonymous', undefined,
    { create: 401, read: 401, respond: 401, skip: 401, report: 401 });

  const registration = await call('POST', '/api/v1/auth/register', {
    body: { identifier, password, device },
  });
  registered = registration.status === 201;
  stages.push({ stage: 'register', status: registration.status, code: registration.code });
  if (!registered || !registration.accessToken) throw new Error('synthetic registration failed');
  token = registration.accessToken;
  accountPrincipal();
  const before = ownerCounts();
  stages.push({ stage: 'owner-before', counts: before });
  if (Object.values(before).some((count) => count !== 0)) throw new Error('synthetic account has preexisting P1 facts');

  await matrix('before-adult-gate-with-forged-headers', token,
    { create: 403, read: 403, respond: 403, skip: 403, report: 403 }, forgedHeaders);

  const gate = await call('POST', '/api/v1/iam/adult-gate', { bearer: token,
    body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' } });
  stages.push({ stage: 'adult-gate', status: gate.status, code: gate.code });
  if (gate.status !== 200) throw new Error(`adult Gate HTTP ${gate.status}`);
  await matrix('adult-gate-without-consents', token,
    { create: 403, read: 403, respond: 403, skip: 403, report: 403 });

  for (const type of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    const consent = await call('PUT', '/api/v1/iam/consents', { bearer: token,
      body: { type, version: 'b30-consent-v1', decision: 'ACCEPTED' } });
    stages.push({ stage: `consent-${type}`, status: consent.status, code: consent.code });
    if (consent.status !== 200) throw new Error(`${type} consent HTTP ${consent.status}`);
  }
  const login = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device } });
  stages.push({ stage: 'ready-fresh-login', status: login.status, code: login.code });
  if (login.status !== 200 || !login.accessToken) throw new Error('ready login failed');
  token = login.accessToken;
  await matrix('ready-no-approved-source-with-forged-tenant', token,
    { create: 503, read: 404, respond: 404, skip: 503, report: 404 }, forgedHeaders);

  const afterReady = ownerCounts();
  stages.push({ stage: 'owner-after-ready', counts: afterReady });
  if (Object.values(afterReady).some((count) => count !== 0)) throw new Error('missing source wrote P1 owner facts');

  removeExactPlacementPermissions();
  const noPermissionLogin = await call('POST', '/api/v1/auth/login', {
    body: { identifier, password, device },
  });
  stages.push({ stage: 'no-permission-fresh-login', status: noPermissionLogin.status,
    code: noPermissionLogin.code });
  if (noPermissionLogin.status !== 200 || !noPermissionLogin.accessToken) {
    throw new Error('no-permission login failed');
  }
  token = noPermissionLogin.accessToken;
  await matrix('no-canonical-permissions', token,
    { create: 403, read: 403, respond: 403, skip: 403, report: 403 });

  const finalCounts = ownerCounts();
  stages.push({ stage: 'owner-final', counts: finalCounts });
  if (Object.values(finalCounts).some((count) => count !== 0)) throw new Error('permission denial wrote P1 owner facts');
} catch (error) {
  stages.push({ stage: 'probe-error', message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
} finally {
  if (registered) {
    try {
      cleanup = disableExactAccount();
      const postCleanup = await call('POST', '/api/v1/auth/login', {
        body: { identifier, password, device },
      });
      cleanup.postCleanupLoginStatus = postCleanup.status;
      if (postCleanup.status !== 401) throw new Error('disabled synthetic account accepted login');
    } catch (error) {
      cleanup = { error: error instanceof Error ? error.message : String(error) };
      process.exitCode = 1;
    }
  }
  const evidence = { probe: 'p1-placement-owner-live', localOnly: true,
    passed: !process.exitCode, stages, cleanup, secretsPrinted: false,
    limits: ['No approved ten-item source exists, so session/result creation remains untested.',
      'Cross-owner access to a real session/report cannot be tested without creating trusted source facts.'] };
  const directory = path.join(process.cwd(), 'artifacts', 'uat-2026-09-23', 'p1-placement-live');
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
}
