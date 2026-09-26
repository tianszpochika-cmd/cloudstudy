// Local-only acceptance probe. Emits status codes, never credentials or tokens.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const gateway = 'http://127.0.0.1:18070';
const stamp = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
const identifier = `uat-owner-${stamp}@local.invalid`;
const password = `Uat!${randomBytes(20).toString('base64url')}a9`;
const device = { deviceType: 'WEB', clientVersion: 'uat-owner-matrix', deviceName: 'local-uat' };
const paths = [
  '/api/v1/learner/profile',
  '/api/v1/learning/plan/current',
  '/api/v1/assessment/placement/start',
  '/api/v1/content/learner/catalog',
];
let sequence = 0;
let registered = false;
const stages = [];

async function call(method, path, { token, body } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    headers['idempotency-key'] = `uat-owner-${stamp}-${++sequence}`;
  }
  const response = await fetch(`${gateway}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual',
  });
  const payload = await response.json().catch(() => null);
  return { status: response.status, token: payload?.data?.accessToken,
    code: payload?.error?.code ?? payload?.code ?? null };
}

async function snapshot(stage, token, expected) {
  const results = [];
  for (const path of paths) {
    const response = await call('GET', path, { token });
    results.push({ path, status: response.status, code: response.code });
  }
  stages.push({ stage, results });
  if (expected !== undefined && results.some((result) => result.status !== expected)) {
    throw new Error(`${stage}: expected each owner read HTTP ${expected}`);
  }
}

function disableExactAccount() {
  // The generated identifier uses a strict safe alphabet. Fail if it cannot be
  // matched exactly, or if Docker is not the known local MySQL container.
  if (!/^uat-owner-[a-z0-9-]+@local\.invalid$/.test(identifier)) throw new Error('unsafe local identifier');
  const sql = `START TRANSACTION;
UPDATE iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id
 SET s.status='REVOKED', s.revoked_at=UTC_TIMESTAMP(6), s.revoke_reason='LOCAL_UAT_CLEANUP'
 WHERE a.identifier='${identifier}' AND s.status='ACTIVE';
UPDATE iam_service.iam_account SET status='DISABLED', roles='', permissions=''
 WHERE identifier='${identifier}';
SELECT status, roles, permissions FROM iam_service.iam_account WHERE identifier='${identifier}';
SELECT COUNT(*) FROM iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id
 WHERE a.identifier='${identifier}' AND s.status='ACTIVE';
COMMIT;`;
  return execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only',
    'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-e', sql],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

let cleanup = 'not-needed';
try {
  const registration = await call('POST', '/api/v1/auth/register', { body: { identifier, password, device } });
  registered = registration.status === 201;
  if (!registered || !registration.token) throw new Error(`registration HTTP ${registration.status}`);
  await snapshot('before-adult-gate', registration.token, 403);

  const adultGate = await call('POST', '/api/v1/iam/adult-gate', {
    token: registration.token,
    body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' },
  });
  stages.push({ stage: 'adult-gate-write', status: adultGate.status, code: adultGate.code });
  if (adultGate.status !== 200) throw new Error(`adult Gate HTTP ${adultGate.status}`);
  await snapshot('adult-gate-without-consent', registration.token, 403);

  for (const type of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    const consent = await call('PUT', '/api/v1/iam/consents', { token: registration.token,
      body: { type, version: 'b30-consent-v1', decision: 'ACCEPTED' } });
    stages.push({ stage: `accept-${type}`, status: consent.status, code: consent.code });
    if (consent.status !== 200) throw new Error(`${type} consent HTTP ${consent.status}`);
  }
  const consentedLogin = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device } });
  if (consentedLogin.status !== 200 || !consentedLogin.token) throw new Error(`consented login HTTP ${consentedLogin.status}`);
  await snapshot('after-adult-gate-and-consent', consentedLogin.token, 200);

  const withdrawal = await call('PUT', '/api/v1/iam/consents', { token: consentedLogin.token,
    body: { type: 'PRIVACY', version: 'b30-consent-v1', decision: 'WITHDRAWN' } });
  stages.push({ stage: 'withdraw-privacy', status: withdrawal.status, code: withdrawal.code });
  if (withdrawal.status !== 200) throw new Error(`privacy withdrawal HTTP ${withdrawal.status}`);
  // ADR-0017 explicitly freezes consent claims until the 900 s access-token
  // expiry; record the current exposure window without asserting it as PASS.
  await snapshot('old-jwt-after-privacy-withdrawal', consentedLogin.token);
  const restrictedLogin = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device } });
  if (restrictedLogin.status !== 200 || !restrictedLogin.token) throw new Error(`restricted login HTTP ${restrictedLogin.status}`);
  await snapshot('new-jwt-after-privacy-withdrawal', restrictedLogin.token, 403);
} catch (error) {
  stages.push({ stage: 'probe-error', message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
} finally {
  try { cleanup = disableExactAccount(); }
  catch (error) {
    cleanup = `FAILED: ${error instanceof Error ? error.message : String(error)}`;
    process.exitCode = 1;
  }
  console.log(JSON.stringify({ probe: 'adult-consent-owner-matrix', localOnly: true, stages,
    cleanup, secretsPrinted: false }, null, 2));
}
