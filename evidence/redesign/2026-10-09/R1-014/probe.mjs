import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const iam = process.env.IAM_BASE || 'https://127.0.0.1:18087';
const learner = process.env.LEARNER_BASE || 'http://127.0.0.1:18088';
const iamSchema = process.env.IAM_SCHEMA || '';
const learnerSchema = process.env.LEARNER_SCHEMA || '';
const outDir = process.env.OUT_DIR || '';
if (!/^r1_014_iam_\d{8}_[a-f0-9]{12}$/.test(iamSchema)) throw new Error('IAM_SCHEMA_INVALID');
if (!/^r1_014_lrn_\d{8}_[a-f0-9]{12}$/.test(learnerSchema)) throw new Error('LEARNER_SCHEMA_INVALID');
if (!outDir) throw new Error('OUT_DIR_REQUIRED');

const DIGEST = {
  TERMS: 'eb74b7254589589f61f5f3747d83379bc6f1e950ab7d8fd52f64f3ab50fb39fb',
  PRIVACY: '4ab15e31c11c9ef99b267ae620910420fdb8a9b6f720b988afeb59d5262ddd84',
  ADULT_LEARNING: '9702cd4fe3e50613f84030998f65c0c8e7961f058176b24f8a9e82006abea189',
};

const steps = [];
const failures = [];

function sql(statement) {
  return execFileSync('docker', [
    'exec', '-i', 'yuxuexing-local-mysql-1', 'sh', '-c',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --protocol=socket --user=root --batch --raw --skip-column-names',
  ], { input: statement, encoding: 'utf8' }).trim();
}

function quote(value) {
  if (!/^[0-9a-f-]{36}$/i.test(value || '')) throw new Error('UUID_REQUIRED');
  return `'${value}'`;
}

function redact(text) {
  return String(text ?? '')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]')
    .replace(/yuxuexing_refresh=[^;\s]+/g, 'yuxuexing_refresh=[REDACTED]')
    .slice(0, 600);
}

function step(id, status, pass, detail) {
  const safe = detail === undefined ? {} : JSON.parse(redact(JSON.stringify(detail)));
  steps.push({ id, httpStatus: status, result: pass ? 'PASS' : 'FAIL', detail: safe });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} status=${status ?? 'none'} ${JSON.stringify(safe)}`);
  if (!pass) failures.push({ id, httpStatus: status, detail: safe });
}

function claimsOf(token) {
  if (!token || token.split('.').length !== 3) return null;
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
}

function isLearningPermission(permission) {
  return typeof permission === 'string' && (
    permission.startsWith('learning.')
    || permission.startsWith('assessment.')
    || permission.startsWith('content.')
    || (permission.startsWith('learner.') && !permission.startsWith('learner.profile.'))
    || permission.startsWith('gamification.')
    || permission.startsWith('social.')
    || permission.startsWith('commerce:')
    || permission.startsWith('media.')
    || permission.startsWith('media:')
    || permission.startsWith('support.')
    || permission.startsWith('notification.')
  );
}

function refreshFrom(response) {
  const rows = response.setCookie || [];
  const raw = rows.find((value) => value.startsWith('yuxuexing_refresh='));
  if (!raw) return null;
  const value = raw.slice('yuxuexing_refresh='.length).split(';')[0];
  if (!value) return null;
  return { cookie: `yuxuexing_refresh=${value}`, raw };
}

function stableBody(json) {
  if (json == null) return null;
  const copy = structuredClone(json);
  if (copy.meta && typeof copy.meta === 'object') {
    delete copy.meta.requestId;
    delete copy.meta.traceId;
    delete copy.meta.serverTime;
  }
  return copy;
}

function codeOf(response) {
  return response?.json?.error?.errorCode
    ?? response?.json?.error?.code
    ?? response?.json?.error?.message
    ?? null;
}

async function call(base, path, { method = 'GET', token, body, key, transport, cookie } = {}) {
  const headers = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  if (key) headers['idempotency-key'] = key;
  if (transport) headers['x-auth-transport'] = transport;
  if (cookie) headers.cookie = cookie;
  const response = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  const setCookie = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  return { status: response.status, json, text, setCookie };
}

function device(deviceId, label) {
  return {
    deviceId,
    deviceType: 'WEB',
    deviceName: `r1-014-${label}`,
    osVersion: 'test',
    clientVersion: 'r1-014',
  };
}

function accountBody(label) {
  const identifier = `r1014-${label}-${randomBytes(4).toString('hex')}@example.invalid`;
  const password = `Aa1!${randomBytes(18).toString('hex')}`;
  const deviceId = randomUUID();
  return {
    identifier,
    password,
    deviceId,
    body: { identifier, password, device: device(deviceId, label) },
  };
}

async function register(label, key = `r1014-${label}-${randomUUID()}`) {
  const made = accountBody(label);
  const response = await call(iam, '/api/v1/auth/register', {
    method: 'POST', body: made.body, key, transport: 'WEB_COOKIE',
  });
  return { ...made, key, response };
}

function sessionStatus(sessionId) {
  const row = sql(`SELECT status FROM \`${iamSchema}\`.iam_session WHERE session_id=${quote(sessionId)};`);
  return row.split('\n')[0] || '';
}

function accountStatus(principalId) {
  return sql(`SELECT status FROM \`${iamSchema}\`.iam_account WHERE principal_id=${quote(principalId)};`).split('\n')[0] || '';
}

function goalCount(principalId) {
  return Number(sql(`SELECT COUNT(*) FROM \`${learnerSchema}\`.learner_goal WHERE owner_id=${quote(principalId)};`) || '0');
}

function goalValues(principalId) {
  const text = sql(
    `SELECT goal_type, daily_study_minutes, starting_level `
    + `FROM \`${learnerSchema}\`.learner_goal WHERE owner_id=${quote(principalId)};`
  );
  if (!text) return [];
  return text.split('\n')[0].split('\t');
}

try {
  const accountsBefore = sql(`SELECT COUNT(*) FROM \`${iamSchema}\`.iam_account;`);
  const goalsBefore = sql(`SELECT COUNT(*) FROM \`${learnerSchema}\`.learner_goal;`);
  const iamFlyway = sql(`SELECT COUNT(*), SUM(success=0) FROM \`${iamSchema}\`.flyway_schema_history WHERE version IS NOT NULL;`);
  const learnerFlyway = sql(`SELECT COUNT(*), SUM(success=0) FROM \`${learnerSchema}\`.flyway_schema_history WHERE version IS NOT NULL;`);
  step('seed.flyway', 200, accountsBefore === '0' && goalsBefore === '0'
    && iamFlyway.endsWith('\t0') && learnerFlyway.endsWith('\t0')
    && Number(iamFlyway.split('\t')[0]) > 0 && Number(learnerFlyway.split('\t')[0]) > 0, {
    iamAccounts: Number(accountsBefore),
    learnerGoals: Number(goalsBefore),
    iamFlyway: iamFlyway.replace('\t', ','),
    learnerFlyway: learnerFlyway.replace('\t', ','),
  });

  const first = await register('reg');
  const firstToken = first.response.json?.data?.accessToken ?? null;
  const firstClaims = firstToken ? claimsOf(firstToken) : null;
  const permissions = Array.isArray(firstClaims?.permissions) ? firstClaims.permissions : [];
  const learningPermissions = permissions.filter(isLearningPermission);
  const noLearning = first.response.status === 201
    && firstClaims?.adult_gate === 'NOT_EVALUATED'
    && firstClaims?.consent_state === 'UNKNOWN'
    && firstClaims?.token_type === 'access'
    && learningPermissions.length === 0
    && permissions.length > 0;
  step('register.201-no-learning', first.response.status, noLearning, {
    adult_gate: firstClaims?.adult_gate ?? null,
    consent_state: firstClaims?.consent_state ?? null,
    permissionCount: permissions.length,
    learningPermissionCount: learningPermissions.length,
    permissions,
    sessionId: first.response.json?.data?.sessionId ?? null,
    deviceId: first.response.json?.data?.deviceId ?? null,
    error: codeOf(first.response),
  });

  const replay = await call(iam, '/api/v1/auth/register', {
    method: 'POST', body: first.body, key: first.key, transport: 'WEB_COOKIE',
  });
  const accountsAfterReplay = sql(`SELECT COUNT(*) FROM \`${iamSchema}\`.iam_account;`);
  const sameReplay = replay.status === first.response.status
    && replay.status === 201
    && replay.json?.data?.sessionId
    && replay.json.data.sessionId === first.response.json?.data?.sessionId
    && replay.json?.data?.deviceId === first.response.json?.data?.deviceId
    && accountsAfterReplay === '1';
  step('register.replay-same-result', replay.status, sameReplay, {
    firstStatus: first.response.status,
    sessionSame: replay.json?.data?.sessionId === first.response.json?.data?.sessionId,
    deviceSame: replay.json?.data?.deviceId === first.response.json?.data?.deviceId,
    accounts: Number(accountsAfterReplay),
    error: codeOf(replay),
  });

  const login = await call(iam, '/api/v1/auth/login', {
    method: 'POST',
    body: first.body,
    key: `r1014-login-${randomUUID()}`,
    transport: 'WEB_COOKIE',
  });
  const loginCookie = refreshFrom(login);
  const loginToken = login.json?.data?.accessToken ?? null;
  step('login', login.status, login.status === 200 && Boolean(loginToken) && Boolean(loginCookie), {
    hasAccessToken: Boolean(loginToken),
    hasRefreshCookie: Boolean(loginCookie),
    sessionId: login.json?.data?.sessionId ?? null,
    error: codeOf(login),
  });

  const refresh = loginCookie ? await call(iam, '/api/v1/auth/token/refresh', {
    method: 'POST',
    body: {},
    key: `r1014-refresh-${randomUUID()}`,
    transport: 'WEB_COOKIE',
    cookie: loginCookie.cookie,
  }) : { status: null, json: null, setCookie: [] };
  const refreshCookie = refreshFrom(refresh);
  const refreshToken = refresh.json?.data?.accessToken ?? null;
  const rotated = Boolean(loginCookie && refreshCookie && refreshCookie.cookie !== loginCookie.cookie);
  step('refresh', refresh.status, refresh.status === 200 && rotated && Boolean(refreshToken), {
    rotated,
    error: codeOf(refresh),
  });

  const revokeToken = refreshToken || loginToken;
  const revokeSession = refresh.json?.data?.sessionId || login.json?.data?.sessionId || null;
  const logout = revokeToken ? await call(iam, '/api/v1/auth/logout', {
    method: 'POST',
    body: {},
    token: revokeToken,
    key: `r1014-logout-${randomUUID()}`,
    transport: 'WEB_COOKIE',
  }) : { status: null, json: null };
  const meAfterLogout = revokeToken ? await call(iam, '/api/v1/iam/principal/me', { token: revokeToken }) : { status: null, json: null };
  const revokedStatus = revokeSession ? sessionStatus(revokeSession) : '';
  step('revoke', logout.status, logout.status === 200 && meAfterLogout.status === 401 && revokedStatus === 'REVOKED', {
    logoutStatus: logout.status,
    meAfterStatus: meAfterLogout.status,
    session: revokedStatus || null,
    error: codeOf(meAfterLogout) || codeOf(logout),
  });

  const passed = await register('passed');
  const passedToken = passed.response.json?.data?.accessToken ?? null;
  const passedPrincipal = passedToken ? claimsOf(passedToken)?.sub : null;
  const passedGate = passedToken ? await call(iam, '/api/v1/iam/adult-gate', {
    method: 'POST',
    token: passedToken,
    key: `r1014-passed-${randomUUID()}`,
    body: { confirmed: true, birthYear: 1990, policyVersion: 'b30-adult-v1' },
  }) : { status: null, json: null };
  step('adult-gate.passed', passedGate.status, passed.response.status === 201
    && passedGate.status === 200 && passedGate.json?.data?.status === 'PASSED', {
    registerStatus: passed.response.status,
    gateStatus: passedGate.json?.data?.status ?? null,
    learningAccess: passedGate.json?.data?.learningAccess ?? null,
    error: codeOf(passedGate),
  });

  const rejected = await register('rejected');
  const rejectedToken = rejected.response.json?.data?.accessToken ?? null;
  const rejectedSession = rejected.response.json?.data?.sessionId ?? null;
  const rejectedPrincipal = rejectedToken ? claimsOf(rejectedToken)?.sub : null;
  const minorGate = rejectedToken ? await call(iam, '/api/v1/iam/adult-gate', {
    method: 'POST',
    token: rejectedToken,
    key: `r1014-minor-${randomUUID()}`,
    body: { confirmed: true, birthYear: 2015, policyVersion: 'b30-adult-v1' },
  }) : { status: null, json: null };
  step('adult-gate.rejected', minorGate.status, rejected.response.status === 201
    && minorGate.status === 200 && minorGate.json?.data?.status === 'REJECTED', {
    registerStatus: rejected.response.status,
    gateStatus: minorGate.json?.data?.status ?? null,
    learningAccess: minorGate.json?.data?.learningAccess ?? null,
    error: codeOf(minorGate),
  });

  const retryGate = rejectedToken ? await call(iam, '/api/v1/iam/adult-gate', {
    method: 'POST',
    token: rejectedToken,
    key: `r1014-adult-year-${randomUUID()}`,
    body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' },
  }) : { status: null, json: null };
  const rejectedSessionStatus = rejectedSession ? sessionStatus(rejectedSession) : '';
  step('adult-gate.rejected-retry-still-rejected', retryGate.status, retryGate.status === 200
    && retryGate.json?.data?.status === 'REJECTED'
    && rejectedSessionStatus === 'ACTIVE', {
    gateStatus: retryGate.json?.data?.status ?? null,
    learningAccess: retryGate.json?.data?.learningAccess ?? null,
    retryAllowed: retryGate.json?.data?.retryAllowed ?? null,
    session: rejectedSessionStatus || null,
    error: codeOf(retryGate),
  });

  const consentResults = [];
  if (passedToken && passedGate.json?.data?.status === 'PASSED') {
    for (const type of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
      const accepted = await call(iam, '/api/v1/iam/consents', {
        method: 'PUT',
        token: passedToken,
        key: `r1014-consent-${type}-${randomUUID()}`,
        body: {
          type,
          version: 'b30-consent-v1',
          decision: 'ACCEPTED',
          expectedDocumentDigest: DIGEST[type],
        },
      });
      consentResults.push({
        type,
        status: accepted.status,
        decision: accepted.json?.data?.decision ?? null,
        error: codeOf(accepted),
      });
    }
  }
  const consentsPass = consentResults.length === 3
    && consentResults.every((item) => item.status === 200 && item.decision === 'ACCEPTED');
  step('consents.three-accepted', consentResults.map((item) => item.status).join(',') || null, consentsPass, {
    results: consentResults,
  });

  const grantedLogin = consentsPass ? await call(iam, '/api/v1/auth/login', {
    method: 'POST',
    body: passed.body,
    key: `r1014-granted-login-${randomUUID()}`,
    transport: 'WEB_COOKIE',
  }) : { status: null, json: null };
  const grantedToken = grantedLogin.json?.data?.accessToken ?? null;
  const grantedClaims = grantedToken ? claimsOf(grantedToken) : null;
  const grantedPrincipal = grantedClaims?.sub || passedPrincipal;
  step('consents.relogin', grantedLogin.status, Boolean(grantedToken)
    && grantedClaims?.adult_gate === 'PASSED'
    && grantedClaims?.consent_state === 'GRANTED', {
    status: grantedLogin.status,
    adult_gate: grantedClaims?.adult_gate ?? null,
    consent_state: grantedClaims?.consent_state ?? null,
    error: codeOf(grantedLogin),
  });

  const missing = grantedToken ? await call(learner, '/api/v1/learner/targets', { token: grantedToken }) : { status: null, json: null };
  const goalsBeforeCount = grantedPrincipal ? goalCount(grantedPrincipal) : null;
  step('targets.missing-404', missing.status, missing.status === 404 && goalsBeforeCount === 0, {
    goalRows: goalsBeforeCount,
    error: codeOf(missing),
  });

  const targetBody = {
    expectedStateVersion: 0,
    goalCode: 'COLLEGE_CET',
    targetLevel: 'B1',
    dailyQuotaMinutes: 30,
  };
  const saved = grantedToken ? await call(learner, '/api/v1/learner/targets', {
    method: 'PUT',
    token: grantedToken,
    key: `r1014-target-${randomUUID()}`,
    body: targetBody,
  }) : { status: null, json: null };
  const savedData = saved.json?.data ?? null;
  const storedParts = grantedPrincipal && saved.status === 200 ? goalValues(grantedPrincipal) : [];
  const storedCount = grantedPrincipal && saved.status === 200 ? goalCount(grantedPrincipal) : null;
  step('targets.put-learner-goal', saved.status, saved.status === 200
    && savedData?.goalCode === 'COLLEGE_CET'
    && savedData?.dailyQuotaMinutes === 30
    && storedParts[0] === 'CET_4_6'
    && Number(storedParts[1]) === 30
    && storedParts[2] === 'B1'
    && storedCount === 1, {
    goalCode: savedData?.goalCode ?? null,
    dailyQuotaMinutes: savedData?.dailyQuotaMinutes ?? null,
    sql: storedParts.join('\t') || null,
    goalRows: storedCount,
    error: codeOf(saved),
  });

  const readBack = grantedToken ? await call(learner, '/api/v1/learner/targets', { token: grantedToken }) : { status: null, json: null };
  const readData = readBack.json?.data ?? null;
  step('targets.get-readback', readBack.status, readBack.status === 200
    && readData?.goalCode === 'COLLEGE_CET'
    && readData?.dailyQuotaMinutes === 30, {
    goalCode: readData?.goalCode ?? null,
    dailyQuotaMinutes: readData?.dailyQuotaMinutes ?? null,
    targetLevel: readData?.targetLevel ?? null,
    stateVersion: readData?.stateVersion ?? null,
    targetVersion: readData?.targetVersion ?? null,
    error: codeOf(readBack),
  });

  const withdrawn = grantedToken ? await call(iam, '/api/v1/iam/consents', {
    method: 'PUT',
    token: grantedToken,
    key: `r1014-withdraw-${randomUUID()}`,
    body: {
      type: 'ADULT_LEARNING',
      version: 'b30-consent-v1',
      decision: 'WITHDRAWN',
      expectedDocumentDigest: DIGEST.ADULT_LEARNING,
    },
  }) : { status: null, json: null };
  const profileAfter = grantedToken ? await call(learner, '/api/v1/learner/profile', { token: grantedToken }) : { status: null, json: null };
  const targetsAfter = grantedToken ? await call(learner, '/api/v1/learner/targets', { token: grantedToken }) : { status: null, json: null };
  const accountAfter = grantedPrincipal ? accountStatus(grantedPrincipal) : '';
  step('withdraw.adult-learning-403', withdrawn.status, withdrawn.status === 200
    && profileAfter.status === 403
    && targetsAfter.status === 403, {
    withdrawDecision: withdrawn.json?.data?.decision ?? null,
    profileStatus: profileAfter.status,
    profileError: codeOf(profileAfter),
    targetsStatus: targetsAfter.status,
    targetsError: codeOf(targetsAfter),
  });
  step('withdraw.account-active', null, accountAfter === 'ACTIVE', {
    accountStatus: accountAfter || null,
    principalId: grantedPrincipal || null,
  });

  const knownReset = await call(iam, '/api/v1/auth/password-reset/request', {
    method: 'POST',
    body: { identifier: first.identifier },
    key: `r1014-reset-known-${randomUUID()}`,
    transport: 'WEB_COOKIE',
  });
  const unknownReset = await call(iam, '/api/v1/auth/password-reset/request', {
    method: 'POST',
    body: { identifier: `r1014-missing-${randomBytes(4).toString('hex')}@example.invalid` },
    key: `r1014-reset-missing-${randomUUID()}`,
    transport: 'WEB_COOKIE',
  });
  const knownStable = stableBody(knownReset.json);
  const unknownStable = stableBody(unknownReset.json);
  const bodiesEqual = JSON.stringify(knownStable) === JSON.stringify(unknownStable);
  step('password-reset.known', knownReset.status, knownReset.status === 202 && knownReset.json?.data?.accepted === true, {
    accepted: knownReset.json?.data?.accepted ?? null,
    error: codeOf(knownReset),
  });
  step('password-reset.unknown', unknownReset.status, unknownReset.status === 202 && unknownReset.json?.data?.accepted === true, {
    accepted: unknownReset.json?.data?.accepted ?? null,
    error: codeOf(unknownReset),
  });
  step('password-reset.body-equal', `${knownReset.status}/${unknownReset.status}`, knownReset.status === 202
    && unknownReset.status === 202 && bodiesEqual, {
    equal: bodiesEqual,
    known: knownStable,
    unknown: unknownStable,
  });
  const blankCases = [];
  for (const [name, body] of [
    ['empty', { identifier: '' }],
    ['spaces', { identifier: '   ' }],
    ['omitted', {}],
  ]) {
    const response = await call(iam, '/api/v1/auth/password-reset/request', {
      method: 'POST',
      body,
      key: `r1014-reset-${name}-${randomUUID()}`,
      transport: 'WEB_COOKIE',
    });
    blankCases.push({ name, status: response.status, error: codeOf(response) });
  }
  step('password-reset.blank-400', blankCases.map((item) => item.status).join(','), blankCases.every((item) => item.status === 400), {
    cases: blankCases,
  });

  const devices = await register('devices');
  const deviceA = devices.deviceId;
  const deviceB = randomUUID();
  const loginA = devices.response.status === 201 ? await call(iam, '/api/v1/auth/login', {
    method: 'POST',
    body: devices.body,
    key: `r1014-device-a-${randomUUID()}`,
    transport: 'WEB_COOKIE',
  }) : { status: null, json: null };
  const loginB = devices.response.status === 201 ? await call(iam, '/api/v1/auth/login', {
    method: 'POST',
    body: { identifier: devices.identifier, password: devices.password, device: device(deviceB, 'devices-b') },
    key: `r1014-device-b-${randomUUID()}`,
    transport: 'WEB_COOKIE',
  }) : { status: null, json: null };
  const tokenA = loginA.json?.data?.accessToken ?? null;
  const tokenB = loginB.json?.data?.accessToken ?? null;
  const listA = tokenA ? await call(iam, '/api/v1/iam/devices', { token: tokenA }) : { status: null, json: null };
  const listed = listA.json?.data?.devices || [];
  const currents = listed.filter((item) => item && item.isCurrent === true);
  const kick = tokenA ? await call(iam, `/api/v1/iam/devices/${deviceB}/kickout`, {
    method: 'POST',
    token: tokenA,
    key: `r1014-kick-${randomUUID()}`,
  }) : { status: null, json: null };
  const meB = tokenB ? await call(iam, '/api/v1/iam/principal/me', { token: tokenB }) : { status: null, json: null };
  const meA = tokenA ? await call(iam, '/api/v1/iam/principal/me', { token: tokenA }) : { status: null, json: null };
  const sessionA = loginA.json?.data?.sessionId ? sessionStatus(loginA.json.data.sessionId) : '';
  const sessionB = loginB.json?.data?.sessionId ? sessionStatus(loginB.json.data.sessionId) : '';
  step('devices.kick-401', kick.status, loginA.status === 200 && loginB.status === 200
    && listA.status === 200
    && currents.length === 1
    && currents[0].deviceId === deviceA
    && kick.status === 200
    && meB.status === 401
    && meA.status === 200
    && sessionB === 'REVOKED'
    && sessionA === 'ACTIVE', {
    loginA: loginA.status,
    loginB: loginB.status,
    listStatus: listA.status,
    currentCount: currents.length,
    currentIsA: currents[0]?.deviceId === deviceA,
    kickStatus: kick.status,
    kickedMe: meB.status,
    callerMe: meA.status,
    sessionA: sessionA || null,
    sessionB: sessionB || null,
    error: codeOf(kick) || codeOf(meB),
  });
} catch (error) {
  step('probe.exception', null, false, { message: redact(error && error.stack ? error.stack : error) });
} finally {
  const payload = {
    card: 'R1-014',
    kind: 'R1_014_SAME_DATABASE_REPLAY',
    iamSchema,
    learnerSchema,
    failureCount: failures.length,
    passCount: steps.filter((item) => item.result === 'PASS').length,
    failCount: steps.filter((item) => item.result === 'FAIL').length,
    failures,
    steps,
  };
  writeFileSync(join(outDir, 'http-result.json'), JSON.stringify(payload, null, 2) + '\n');
  console.log(`PROBE_SUMMARY pass=${payload.passCount} fail=${payload.failCount}`);
  if (failures.length > 0) process.exitCode = 1;
}
