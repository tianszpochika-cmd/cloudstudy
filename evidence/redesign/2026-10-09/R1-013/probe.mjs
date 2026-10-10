import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const iam = process.env.IAM_BASE || 'https://127.0.0.1:18087';
const schema = process.env.IAM_SCHEMA || '';
const outDir = process.env.OUT_DIR || '';
if (!/^r1_013_[a-z0-9_]+$/.test(schema)) throw new Error('IAM_SCHEMA_INVALID');
if (!outDir) throw new Error('OUT_DIR_REQUIRED');

const identifier = `r1013-${randomBytes(4).toString('hex')}@example.invalid`;
const password = `Aa1!${randomBytes(18).toString('hex')}`;
const deviceA = randomUUID();
const deviceB = randomUUID();
const minorKey = `r1013-minor-${randomUUID()}`;
const adultKey = `r1013-adult-${randomUUID()}`;
const checks = [];
const sqlLines = [];

function sql(statement) {
  return execFileSync('docker', [
    'exec', '-i', 'yuxuexing-local-mysql-1', 'sh', '-c',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --protocol=socket --user=root --batch --raw --skip-column-names',
  ], { input: statement, encoding: 'utf8' }).trim();
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function record(name, ok, detail) {
  checks.push({ name, ok, detail });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + ' ' + JSON.stringify(detail));
}

function claimsOf(token) {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  return {
    adult_gate: payload.adult_gate ?? null,
    consent_state: payload.consent_state ?? null,
    token_type: payload.token_type ?? null,
    sub: payload.sub ?? null,
    session_id: payload.session_id ?? null,
  };
}

function stableGate(body) {
  if (!body?.data) return null;
  const data = { ...body.data };
  return data;
}

async function call(path, { method = 'GET', token, body, key, transport } = {}) {
  const headers = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  if (key) headers['idempotency-key'] = key;
  if (transport) headers['x-auth-transport'] = transport;
  const response = await fetch(iam + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { unparsed: true }; }
  return { status: response.status, json };
}

function principalRow(principalId) {
  const row = sql(
    `SELECT adult_gate_status, IF(adult_verified_at IS NULL, 'NULL', 'SET'), `
    + `IFNULL(adult_gate_version, '') FROM \`${schema}\`.iam_principal WHERE principal_id = ${quote(principalId)};`
  );
  const [status, verified, version] = row.split('\t');
  return { status: status ?? null, adultVerifiedAt: verified ?? null, version: version ?? null };
}

function sessionStatus(sessionId) {
  const row = sql(
    `SELECT status, IF(revoked_at IS NULL, 'NULL', 'SET') FROM \`${schema}\`.iam_session WHERE session_id = ${quote(sessionId)};`
  );
  const [status, revoked] = row.split('\t');
  return { status: status ?? null, revokedAt: revoked ?? null };
}

function auditSummary(principalId) {
  const text = sql(
    `SELECT resource_type, decision, reason_code, COUNT(*) FROM \`${schema}\`.iam_decision_audit `
    + `WHERE principal_id = ${quote(principalId)} GROUP BY resource_type, decision, reason_code ORDER BY 1, 2, 3;`
  );
  return text ? text.split('\n') : [];
}

function plaintextYearHits() {
  const rows = sql(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = ${quote(schema)} `
    + `AND data_type IN ('char','varchar','tinytext','text','mediumtext','longtext','json');`
  );
  const hits = [];
  if (!rows) return hits;
  for (const line of rows.split('\n')) {
    const [table, column] = line.split('\t');
    if (!/^[A-Za-z0-9_]+$/.test(table) || !/^[A-Za-z0-9_]+$/.test(column)) continue;
    const count = sql(
      `SELECT COUNT(*) FROM \`${schema}\`.\`${table}\` WHERE \`${column}\` LIKE '%1995%' OR \`${column}\` LIKE '%2015%';`
    );
    if (count !== '0') hits.push(`${table}.${column}=${count}`);
  }
  return hits;
}

const registerKey = `r1013-reg-${randomUUID()}`;
const loginKey = `r1013-login-${randomUUID()}`;
const logoutKey = `r1013-logout-${randomUUID()}`;
const reloginKey = `r1013-relogin-${randomUUID()}`;
const device = (id) => ({
  deviceId: id,
  deviceType: 'WEB',
  deviceName: 'R1-013 synthetic',
  osVersion: 'test',
  clientVersion: 'r1-013',
});

const registered = await call('/api/v1/auth/register', {
  method: 'POST',
  key: registerKey,
  transport: 'WEB_COOKIE',
  body: { identifier, password, device: device(deviceA) },
});
const firstToken = registered.json?.data?.accessToken;
const firstClaims = firstToken ? claimsOf(firstToken) : null;
record('register', registered.status === 201 && firstClaims?.token_type === 'access', {
  status: registered.status,
  adult_gate: firstClaims?.adult_gate ?? null,
  sessionId: registered.json?.data?.sessionId ?? null,
});
if (!firstClaims?.sub) {
  writeFileSync(join(outDir, 'http-result.json'), JSON.stringify({ checks }, null, 2));
  process.exit(1);
}

const principalId = firstClaims.sub;
const openedSession = registered.json.data.sessionId;
sqlLines.push('after-register ' + JSON.stringify(principalRow(principalId)));
sqlLines.push('after-register-session ' + JSON.stringify(sessionStatus(openedSession)));

const minorBody = { confirmed: true, birthYear: 2015, policyVersion: 'b30-adult-v1' };
const minor = await call('/api/v1/iam/adult-gate', {
  method: 'POST', token: firstToken, key: minorKey, body: minorBody,
});
const minorData = stableGate(minor.json);
record('minor-gate', minor.status === 200 && minorData?.status === 'REJECTED'
  && minorData?.learningAccess === 'RESTRICTED' && minorData?.evidenceStatus === 'REJECTED', {
  status: minor.status,
  gateStatus: minorData?.status ?? null,
  learningAccess: minorData?.learningAccess ?? null,
  evidenceStatus: minorData?.evidenceStatus ?? null,
  retryAllowed: minorData?.retryAllowed ?? null,
});
const afterMinor = principalRow(principalId);
const afterMinorSession = sessionStatus(openedSession);
const afterMinorAudit = auditSummary(principalId);
sqlLines.push('after-minor ' + JSON.stringify(afterMinor));
sqlLines.push('after-minor-session ' + JSON.stringify(afterMinorSession));
sqlLines.push('after-minor-audit ' + afterMinorAudit.join(' | '));
record('minor-db', afterMinor.status === 'REJECTED' && afterMinor.adultVerifiedAt === 'NULL'
  && afterMinorSession.status === 'ACTIVE' && afterMinorSession.revokedAt === 'NULL', {
  principal: afterMinor,
  session: afterMinorSession,
});

const meAfterMinor = await call('/api/v1/iam/principal/me', { token: firstToken });
record('me-after-minor', meAfterMinor.status === 200
  && meAfterMinor.json?.data?.adultGate?.status === 'REJECTED'
  && meAfterMinor.json?.data?.adultGate?.learningAccess === 'RESTRICTED'
  && meAfterMinor.json?.data?.status === 'RESTRICTED', {
  status: meAfterMinor.status,
  accountStatus: meAfterMinor.json?.data?.status ?? null,
  adultGate: meAfterMinor.json?.data?.adultGate?.status ?? null,
  learningAccess: meAfterMinor.json?.data?.adultGate?.learningAccess ?? null,
});

const minorReplay = await call('/api/v1/iam/adult-gate', {
  method: 'POST', token: firstToken, key: minorKey, body: minorBody,
});
record('minor-replay', minorReplay.status === 200
  && JSON.stringify(stableGate(minorReplay.json)) === JSON.stringify(minorData), {
  status: minorReplay.status,
  sameBody: JSON.stringify(stableGate(minorReplay.json)) === JSON.stringify(minorData),
});

const adultBody = { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' };
const adult = await call('/api/v1/iam/adult-gate', {
  method: 'POST', token: firstToken, key: adultKey, body: adultBody,
});
const adultData = stableGate(adult.json);
const adultText = JSON.stringify(adultData);
record('adult-year-stays-rejected', adult.status === 200 && adultData?.status === 'REJECTED'
  && adultData?.learningAccess !== 'ELIGIBLE' && adultData?.retryAllowed === false
  && adultData?.evidenceStatus === 'REJECTED' && !adultText.includes('1995') && !adultText.includes('2015'), {
  status: adult.status,
  gateStatus: adultData?.status ?? null,
  learningAccess: adultData?.learningAccess ?? null,
  evidenceStatus: adultData?.evidenceStatus ?? null,
  retryAllowed: adultData?.retryAllowed ?? null,
  sameEffectiveAt: adultData?.effectiveAt === minorData?.effectiveAt,
});
const afterAdult = principalRow(principalId);
const afterAdultSession = sessionStatus(openedSession);
const afterAdultAudit = auditSummary(principalId);
sqlLines.push('after-adult-year ' + JSON.stringify(afterAdult));
sqlLines.push('after-adult-year-session ' + JSON.stringify(afterAdultSession));
sqlLines.push('after-adult-year-audit ' + afterAdultAudit.join(' | '));
record('adult-year-db', afterAdult.status === 'REJECTED' && afterAdult.adultVerifiedAt === 'NULL'
  && afterAdultSession.status === 'ACTIVE' && afterAdult.version === afterMinor.version
  && afterAdultAudit.join('\n') === afterMinorAudit.join('\n'), {
  principal: afterAdult,
  session: afterAdultSession,
  auditUnchanged: afterAdultAudit.join('\n') === afterMinorAudit.join('\n'),
});

const adultReplay = await call('/api/v1/iam/adult-gate', {
  method: 'POST', token: firstToken, key: adultKey, body: adultBody,
});
record('adult-year-replay', adultReplay.status === 200
  && JSON.stringify(stableGate(adultReplay.json)) === JSON.stringify(adultData), {
  status: adultReplay.status,
  sameBody: JSON.stringify(stableGate(adultReplay.json)) === JSON.stringify(adultData),
  retryAllowed: stableGate(adultReplay.json)?.retryAllowed ?? null,
});

const meStill = await call('/api/v1/iam/principal/me', { token: firstToken });
record('me-before-logout', meStill.status === 200 && sessionStatus(openedSession).status === 'ACTIVE', {
  status: meStill.status,
  session: sessionStatus(openedSession),
});

const logout = await call('/api/v1/auth/logout', {
  method: 'POST', token: firstToken, key: logoutKey, transport: 'WEB_COOKIE', body: {},
});
record('logout', logout.status === 200, { status: logout.status });

const relogin = await call('/api/v1/auth/login', {
  method: 'POST',
  key: reloginKey,
  transport: 'WEB_COOKIE',
  body: { identifier, password, device: device(deviceB) },
});
const secondToken = relogin.json?.data?.accessToken;
const secondClaims = secondToken ? claimsOf(secondToken) : null;
record('relogin-claim', relogin.status === 200 && secondClaims?.adult_gate === 'REJECTED'
  && secondClaims?.adult_gate !== 'NOT_EVALUATED' && secondClaims?.adult_gate !== 'PASSED', {
  status: relogin.status,
  adult_gate: secondClaims?.adult_gate ?? null,
  consent_state: secondClaims?.consent_state ?? null,
  sessionId: secondClaims?.session_id ?? null,
});

if (secondClaims?.session_id) {
  const reloginSession = sessionStatus(secondClaims.session_id);
  const oldSession = sessionStatus(openedSession);
  sqlLines.push('after-relogin-new-session ' + JSON.stringify(reloginSession));
  sqlLines.push('after-relogin-old-session ' + JSON.stringify(oldSession));
  record('relogin-session-active', reloginSession.status === 'ACTIVE' && reloginSession.revokedAt === 'NULL', {
    newSession: reloginSession,
    loggedOutSession: oldSession,
  });
  const meAgain = await call('/api/v1/iam/principal/me', { token: secondToken });
  record('me-after-relogin', meAgain.status === 200
    && meAgain.json?.data?.adultGate?.status === 'REJECTED'
    && meAgain.json?.data?.adultGate?.learningAccess !== 'ELIGIBLE'
    && meAgain.json?.data?.consentState?.learningAccess !== 'ELIGIBLE'
    && meAgain.json?.data?.status !== 'ACTIVE', {
    status: meAgain.status,
    accountStatus: meAgain.json?.data?.status ?? null,
    adultGate: meAgain.json?.data?.adultGate?.status ?? null,
    gateLearningAccess: meAgain.json?.data?.adultGate?.learningAccess ?? null,
    consentLearningAccess: meAgain.json?.data?.consentState?.learningAccess ?? null,
  });
}

const accountCount = sql(`SELECT COUNT(*) FROM \`${schema}\`.iam_account WHERE principal_id = ${quote(principalId)};`);
const accountStatus = sql(`SELECT status FROM \`${schema}\`.iam_account WHERE principal_id = ${quote(principalId)};`);
const deletionCount = sql(`SELECT COUNT(*) FROM \`${schema}\`.iam_account_deletion WHERE principal_id = ${quote(principalId)};`);
const auditCount = sql(`SELECT COUNT(*) FROM \`${schema}\`.iam_decision_audit WHERE principal_id = ${quote(principalId)};`);
const birthColumns = sql(
  `SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = ${quote(schema)} `
  + `AND (column_name LIKE '%birth%' OR column_name LIKE '%birth_year%');`
);
const yearHits = plaintextYearHits();
const allowCount = sql(
  `SELECT COUNT(*) FROM \`${schema}\`.iam_decision_audit WHERE principal_id = ${quote(principalId)} `
  + `AND resource_type = 'adult_gate' AND decision = 'ALLOW';`
);
const denyCount = sql(
  `SELECT COUNT(*) FROM \`${schema}\`.iam_decision_audit WHERE principal_id = ${quote(principalId)} `
  + `AND resource_type = 'adult_gate' AND decision = 'DENY';`
);
sqlLines.push(`account count=${accountCount} status=${accountStatus} deletion=${deletionCount} audit=${auditCount}`);
sqlLines.push(`birthColumns=${birthColumns} adultGateAllow=${allowCount} adultGateDeny=${denyCount}`);
sqlLines.push('plaintextYearHits ' + (yearHits.length ? yearHits.join(',') : 'none'));
record('retained-account-and-audit', accountCount === '1' && accountStatus === 'ACTIVE' && deletionCount === '0'
  && Number(auditCount) > 0 && denyCount === '1' && allowCount === '0' && birthColumns === '0'
  && yearHits.length === 0 && principalRow(principalId).adultVerifiedAt === 'NULL', {
  accountCount, accountStatus, deletionCount, auditCount, denyCount, allowCount, birthColumns, yearHits,
});

writeFileSync(join(outDir, 'http-result.json'), JSON.stringify({ schema, checks }, null, 2));
writeFileSync(join(outDir, 'sql.txt'), sqlLines.join('\n') + '\n');
const failed = checks.filter((check) => !check.ok);
console.log('PROBE_SUMMARY passed=' + (checks.length - failed.length) + ' failed=' + failed.length);
process.exit(failed.length === 0 ? 0 : 1);
