import { execFileSync as exec } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const iam = process.env.IAM_BASE || 'https://127.0.0.1:18087';
const learner = process.env.LEARNER_BASE || 'http://127.0.0.1:18088';
const schema = process.env.LEARNER_SCHEMA || '';
const outDir = process.env.OUT_DIR || '';
if (!/^r1_010_lrn_\d{8}_[a-f0-9]{12}$/.test(schema)) {
  throw new Error('LEARNER_SCHEMA_INVALID');
}
if (!outDir) throw new Error('OUT_DIR_REQUIRED');

const out = [];
const failures = [];
const sqlLog = [];

function note(name, value) {
  out.push({ name, ...value });
  const status = value.status ?? '';
  const extra = value.detail !== undefined ? ' ' + JSON.stringify(value.detail) : '';
  console.log(`${name} ${status}${extra}`);
}

function expect(name, ok, detail) {
  if (!ok) failures.push({ name, detail });
}

function sql(statement) {
  const text = exec('docker', [
    'exec', '-i', 'yuxuexing-local-mysql-1', 'sh', '-c',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --protocol=socket --user=root --batch --skip-column-names',
  ], { input: statement, encoding: 'utf8' });
  sqlLog.push({ statement, text: text.trim() });
  return text.trim();
}

function counts(label) {
  const text = sql(
    `SELECT (SELECT COUNT(*) FROM ${schema}.learner_goal),` +
    `(SELECT COUNT(*) FROM ${schema}.learner_profile),` +
    `(SELECT COUNT(*) FROM ${schema}.b25_learner_goal),` +
    `(SELECT COUNT(*) FROM ${schema}.learner_idempotency_record),` +
    `(SELECT COUNT(*) FROM ${schema}.learner_outbox_event);`
  );
  const [goals, profiles, b25, idempotency, outbox] = text.split('\t').map(Number);
  const detail = { goals, profiles, b25, idempotency, outbox };
  note(label, { detail });
  return detail;
}

function goalRow(principalId) {
  return sql(
    `SELECT p.onboarding_state, p.profile_version, g.goal_type, g.daily_study_minutes,` +
    ` g.starting_level, g.target_id,` +
    ` (SELECT COUNT(*) FROM ${schema}.learner_goal g2 WHERE g2.owner_id='${principalId}')` +
    ` FROM ${schema}.learner_profile p` +
    ` LEFT JOIN ${schema}.learner_goal g ON g.profile_id=p.profile_id` +
    ` WHERE p.owner_id='${principalId}';`
  );
}

async function call(method, url, { token, body, idem } = {}) {
  const headers = { accept: 'application/json', 'x-auth-transport': 'WEB_COOKIE' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = 'Bearer ' + token;
  if (idem) headers['idempotency-key'] = idem;
  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  return { status: res.status, json, text: text.slice(0, 700) };
}

function claims(token) {
  const part = token.split('.')[1];
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

function codeOf(response) {
  return response.json?.error?.code
    ?? response.json?.code
    ?? response.json?.error
    ?? (response.json?.data ? 'has-data' : response.text.slice(0, 180));
}

function dataOf(response) {
  return response.json?.data ?? null;
}

const DIGEST = {
  TERMS: 'eb74b7254589589f61f5f3747d83379bc6f1e950ab7d8fd52f64f3ab50fb39fb',
  PRIVACY: '4ab15e31c11c9ef99b267ae620910420fdb8a9b6f720b988afeb59d5262ddd84',
  ADULT_LEARNING: '9702cd4fe3e50613f84030998f65c0c8e7961f058176b24f8a9e82006abea189',
  PRODUCT_ANALYTICS: '5fccd02376d4426e18b36ffb43743e33a844d37d5fb92e505801b5095f56f6f7',
};

const password = randomUUID().replaceAll('-', '') + 'Aa1';
const identifier = `r1010-${randomUUID().slice(0, 8)}@example.invalid`;
const device = {
  deviceId: randomUUID(),
  deviceType: 'WEB',
  deviceName: 'r1-010',
  osVersion: 'test',
  clientVersion: 'r1-010',
};
const creds = { identifier, password, device };

const registered = await call('POST', iam + '/api/v1/auth/register', { body: creds, idem: randomUUID() });
note('register', { status: registered.status, detail: codeOf(registered) });
expect('register', registered.status === 201, registered.text);
let earlyToken = registered.json?.data?.accessToken;
if (!earlyToken) throw new Error('register missing access token');

const earlyKey = 'r1010-before-grant-01';
const earlyPut = await call('PUT', learner + '/api/v1/learner/targets', {
  token: earlyToken,
  idem: earlyKey,
  body: { expectedStateVersion: 0, goalCode: 'FOUNDATION', targetLevel: 'A1', dailyQuotaMinutes: 15 },
});
note('before-grant.put', { status: earlyPut.status, detail: codeOf(earlyPut) });
expect('before-grant.put.403', earlyPut.status === 403, earlyPut.text);
const beforeGrant = counts('sql.before-grant');
expect('sql.before-grant.goals', beforeGrant.goals === 0, beforeGrant);
expect('sql.before-grant.b25', beforeGrant.b25 === 0, beforeGrant);

const adult = await call('POST', iam + '/api/v1/iam/adult-gate', {
  token: earlyToken,
  idem: randomUUID(),
  body: { confirmed: true, birthYear: 1990, policyVersion: 'b30-adult-v1' },
});
note('adult', { status: adult.status, detail: adult.json?.data?.status ?? codeOf(adult) });
expect('adult', adult.status === 200, adult.text);
for (const type of ['TERMS', 'PRIVACY', 'ADULT_LEARNING', 'PRODUCT_ANALYTICS']) {
  const accepted = await call('PUT', iam + '/api/v1/iam/consents', {
    token: earlyToken,
    idem: randomUUID(),
    body: { type, version: 'b30-consent-v1', decision: 'ACCEPTED', expectedDocumentDigest: DIGEST[type] },
  });
  note('accept.' + type, { status: accepted.status, detail: accepted.json?.data?.decision ?? codeOf(accepted) });
  expect('accept.' + type, accepted.status === 200 && accepted.json?.data?.decision === 'ACCEPTED', accepted.text);
}
const login = await call('POST', iam + '/api/v1/auth/login', { body: creds, idem: randomUUID() });
note('login', { status: login.status, detail: codeOf(login) });
expect('login', login.status === 200, login.text);
const token = login.json?.data?.accessToken;
if (!token) throw new Error('login missing access token');
const fact = claims(token);
note('claims', {
  detail: {
    consent_state: fact.consent_state,
    adult_gate: fact.adult_gate,
    token_type: fact.token_type,
    sub: fact.sub,
  },
});
expect('claims', fact.consent_state === 'GRANTED' && fact.adult_gate === 'PASSED', fact);
const principalId = fact.sub;
if (!/^[0-9a-f-]{36}$/i.test(principalId)) throw new Error('principal id is not a uuid');

const missing = await call('GET', learner + '/api/v1/learner/targets', { token });
note('get.missing', { status: missing.status, detail: codeOf(missing) });
expect('get.missing.404', missing.status === 404, missing.text);
const afterMissing = counts('sql.after-missing-get');
expect('sql.after-missing-get.goals', afterMissing.goals === 0, afterMissing);
expect('sql.after-missing-get.profiles', afterMissing.profiles === 0, afterMissing);

const partialKey = 'r1010-partial-minutes-1';
const partial = await call('PUT', learner + '/api/v1/learner/targets', {
  token,
  idem: partialKey,
  body: { expectedStateVersion: 0, goalCode: 'FOUNDATION', targetLevel: 'A1' },
});
note('put.partial', { status: partial.status, detail: codeOf(partial) });
expect('put.partial.not-success', partial.status >= 400 && partial.status < 500, partial.text);
const afterPartial = counts('sql.after-partial');
expect('sql.after-partial.goals', afterPartial.goals === 0, afterPartial);

const key = 'r1010-target-put-0001';
const body = {
  expectedStateVersion: 0,
  goalCode: 'COLLEGE_CET',
  targetLevel: 'B1',
  dailyQuotaMinutes: 30,
};
const saved = await call('PUT', learner + '/api/v1/learner/targets', { token, idem: key, body });
const savedData = dataOf(saved);
note('put.saved', {
  status: saved.status,
  detail: savedData ? {
    goalCode: savedData.goalCode,
    dailyQuotaMinutes: savedData.dailyQuotaMinutes,
    targetLevel: savedData.targetLevel,
    stateVersion: savedData.stateVersion,
    targetVersion: savedData.targetVersion,
    targetId: savedData.targetId,
    replayed: saved.json?.meta?.replayed,
  } : codeOf(saved),
});
expect('put.saved.200', saved.status === 200, saved.text);
expect('put.saved.goal', savedData?.goalCode === 'COLLEGE_CET', savedData);
expect('put.saved.minutes', savedData?.dailyQuotaMinutes === 30, savedData);
expect('put.saved.level', savedData?.targetLevel === 'B1', savedData);
expect('put.saved.version', savedData?.stateVersion === 1 && savedData?.targetVersion === 1, savedData);
expect('put.saved.not-replay', saved.json?.meta?.replayed === false, saved.json?.meta);
expect('put.saved.targetId', Number.isInteger(savedData?.targetId) && savedData.targetId >= 1, savedData);

const row = goalRow(principalId);
note('sql.row', { detail: row });
const parts = row.split('\t');
expect('sql.onboarding', parts[0] === 'DRAFT', row);
expect('sql.version', Number(parts[1]) === savedData?.stateVersion, row);
expect('sql.goal-type', parts[2] === 'CET_4_6', row);
expect('sql.minutes', Number(parts[3]) === 30, row);
expect('sql.level', parts[4] === 'B1', row);
expect('sql.one-goal', Number(parts[6]) === 1, row);
const afterPut = counts('sql.after-put');
expect('sql.after-put.goals', afterPut.goals === 1, afterPut);
expect('sql.after-put.profiles', afterPut.profiles === 1, afterPut);
expect('sql.after-put.b25', afterPut.b25 === 0, afterPut);
expect('sql.after-put.idempotency', afterPut.idempotency === 1, afterPut);
expect('sql.after-put.outbox', afterPut.outbox === 1, afterPut);

const read = await call('GET', learner + '/api/v1/learner/targets', { token });
const readData = dataOf(read);
note('get.readback', {
  status: read.status,
  detail: readData ? {
    goalCode: readData.goalCode,
    dailyQuotaMinutes: readData.dailyQuotaMinutes,
    stateVersion: readData.stateVersion,
    targetVersion: readData.targetVersion,
    targetId: readData.targetId,
  } : codeOf(read),
});
expect('get.readback.200', read.status === 200, read.text);
expect('get.readback.same', JSON.stringify({
  goalCode: readData?.goalCode,
  dailyQuotaMinutes: readData?.dailyQuotaMinutes,
  targetLevel: readData?.targetLevel,
  stateVersion: readData?.stateVersion,
  targetVersion: readData?.targetVersion,
  targetId: readData?.targetId,
}) === JSON.stringify({
  goalCode: savedData?.goalCode,
  dailyQuotaMinutes: savedData?.dailyQuotaMinutes,
  targetLevel: savedData?.targetLevel,
  stateVersion: savedData?.stateVersion,
  targetVersion: savedData?.targetVersion,
  targetId: savedData?.targetId,
}), readData);

const replay = await call('PUT', learner + '/api/v1/learner/targets', { token, idem: key, body });
const replayData = dataOf(replay);
note('put.replay', {
  status: replay.status,
  detail: replayData ? {
    goalCode: replayData.goalCode,
    dailyQuotaMinutes: replayData.dailyQuotaMinutes,
    stateVersion: replayData.stateVersion,
    targetVersion: replayData.targetVersion,
    targetId: replayData.targetId,
    replayed: replay.json?.meta?.replayed,
  } : codeOf(replay),
});
expect('put.replay.200', replay.status === 200, replay.text);
expect('put.replay.flag', replay.json?.meta?.replayed === true, replay.json?.meta);
expect('put.replay.same', JSON.stringify(replayData) === JSON.stringify(savedData), {
  saved: savedData, replay: replayData,
});

const conflict = await call('PUT', learner + '/api/v1/learner/targets', {
  token,
  idem: key,
  body: { ...body, goalCode: 'WORKPLACE_DAILY' },
});
note('put.conflict', { status: conflict.status, detail: codeOf(conflict) });
expect('put.conflict.409', conflict.status === 409, conflict.text);
expect('put.conflict.code', codeOf(conflict) === 'IDEMPOTENCY_CONFLICT', conflict.text);

const stale = await call('PUT', learner + '/api/v1/learner/targets', {
  token,
  idem: 'r1010-target-stale-02',
  body: { ...body, expectedStateVersion: 0, dailyQuotaMinutes: 15 },
});
note('put.stale', { status: stale.status, detail: codeOf(stale) });
expect('put.stale.409', stale.status === 409, stale.text);

const afterConflict = counts('sql.after-conflict');
expect('sql.after-conflict.goals', afterConflict.goals === 1, afterConflict);
expect('sql.after-conflict.b25', afterConflict.b25 === 0, afterConflict);
expect('sql.after-conflict.idempotency', afterConflict.idempotency === 1, afterConflict);
expect('sql.after-conflict.outbox', afterConflict.outbox === 1, afterConflict);
const rowAfter = goalRow(principalId);
note('sql.row-after', { detail: rowAfter });
expect('sql.row-after.unchanged', rowAfter === row, { before: row, after: rowAfter });

const again = await call('GET', learner + '/api/v1/learner/targets', { token });
expect('get.after-conflict.same', JSON.stringify(dataOf(again)) === JSON.stringify(savedData), dataOf(again));
note('get.after-conflict', { status: again.status, detail: dataOf(again)?.goalCode ?? codeOf(again) });

const firstDay = await call('GET', learner + '/api/v1/learner/first-day', { token });
const firstDayData = dataOf(firstDay);
note('get.first-day', {
  status: firstDay.status,
  detail: firstDayData ? { state: firstDayData.state, hasNextAction: Object.hasOwn(firstDayData, 'nextAction') } : codeOf(firstDay),
});
if (firstDay.status === 200 && firstDayData) {
  expect('first-day.no-nextAction', Object.hasOwn(firstDayData, 'nextAction') === false, firstDayData);
}

const result = { failures, events: out };
writeFileSync(outDir + '/http-result.json', JSON.stringify(result, null, 2) + '\n');
writeFileSync(outDir + '/sql.txt', sqlLog.map(item => `-- ${item.statement}\n${item.text}\n`).join('\n'));
console.log(failures.length === 0 ? 'HTTP_ASSERTIONS_OK' : 'HTTP_ASSERTIONS_FAILED ' + JSON.stringify(failures));
process.exit(failures.length === 0 ? 0 : 1);
