import { execFileSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const iam = process.env.IAM_BASE || 'https://127.0.0.1:18087';
const schema = process.env.IAM_SCHEMA || '';
const outDir = process.env.OUT_DIR || '';
if (!/^r1_012_iam_\d{8}_[a-f0-9]{12}$/.test(schema)) throw new Error('IAM_SCHEMA_INVALID');
if (!outDir) throw new Error('OUT_DIR_REQUIRED');

const failures = [];
const cases = [];
const secrets = new Set();

function note(name, detail) {
  const safe = redact(detail);
  cases.push({ name, ...safe });
  console.log(name + ' ' + JSON.stringify(safe));
}

function expect(name, ok, detail) {
  if (!ok) {
    const safe = redact(detail);
    failures.push({ name, detail: safe });
    console.log('FAIL ' + name + ' ' + JSON.stringify(safe));
  }
}

function redact(value) {
  let out = JSON.stringify(value);
  const ordered = [...secrets].filter((secret) => secret && secret.length >= 8)
    .sort((left, right) => right.length - left.length);
  for (const secret of ordered) out = out.split(secret).join('[REDACTED]');
  return JSON.parse(out);
}

function sql(statement) {
  return execFileSync('docker', [
    'exec', '-i', 'yuxuexing-local-mysql-1', 'sh', '-c',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --protocol=socket --user=root --batch --skip-column-names',
  ], { input: statement, encoding: 'utf8' }).trim();
}

function challengeCount() {
  return Number(sql(`SELECT COUNT(*) FROM \`${schema}\`.iam_password_reset_challenge;`));
}

function leakHits(text) {
  const hay = String(text).toLowerCase();
  const hits = [];
  for (const secret of secrets) {
    if (secret && secret.length >= 8 && hay.includes(secret.toLowerCase())) hits.push('account-or-credential');
  }
  for (const phrase of [
    'not_found', 'not found', 'does not exist', 'unknown account', 'no such',
    '不存在', 'principal.not_found', 'account.not_found', 'account_not_found', 'principal_not_found',
  ]) {
    if (hay.includes(phrase)) hits.push(phrase);
  }
  return hits;
}

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
  }
  return value;
}

const VOLATILE_HEADERS = new Set(['date', 'x-request-id', 'x-trace-id', 'content-length']);

function publicView(response) {
  const headers = {};
  for (const [key, value] of Object.entries(response.headers)) {
    if (!VOLATILE_HEADERS.has(key)) headers[key] = value;
  }
  let body = response.json == null ? null : structuredClone(response.json);
  if (body?.meta) {
    delete body.meta.requestId;
    delete body.meta.traceId;
    delete body.meta.serverTime;
  }
  return { status: response.status, headers: sorted(headers), body: sorted(body) };
}

function samePublic(left, right) {
  const a = publicView(left);
  const b = publicView(right);
  const equal = JSON.stringify(a) === JSON.stringify(b);
  return { equal, left: a, right: b };
}

async function post(path, body) {
  const idem = 'r1012-' + randomUUID();
  const res = await fetch(iam + path, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-auth-transport': 'WEB_COOKIE',
      'idempotency-key': idem,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  const headers = {};
  res.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });
  return { status: res.status, json, text, headers };
}

function codeOf(response) {
  return {
    status: response.status,
    errorCode: response.json?.error?.errorCode ?? null,
    message: response.json?.error?.message ?? null,
    retryable: response.json?.error?.retryable ?? null,
  };
}

function remember(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.length >= 8) {
      secrets.add(value);
      secrets.add(value.toLowerCase());
    }
  }
}

function requireUuid(value, label) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '')) {
    throw new Error('UUID_EXPECTED ' + label);
  }
  return value;
}

function claims(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
}

async function register(label) {
  const identifier = `r1012-${label}-${randomUUID().slice(0, 8)}@example.invalid`;
  const password = randomUUID().replaceAll('-', '') + 'Aa1';
  remember(identifier, password);
  const response = await post('/api/v1/auth/register', {
    identifier,
    password,
    device: {
      deviceId: randomUUID(),
      deviceType: 'WEB',
      deviceName: 'r1-012',
      osVersion: 'test',
      clientVersion: 'r1-012',
    },
  });
  const token = response.json?.data?.accessToken;
  if (token) remember(token);
  const principalId = token ? claims(token).sub : null;
  if (principalId) remember(principalId);
  note('register.' + label, { status: response.status, hasPrincipal: Boolean(principalId) });
  expect('register.' + label, response.status === 201 && Boolean(principalId), codeOf(response));
  return { identifier, password, principalId };
}

async function requestReset(identifier) {
  return post('/api/v1/auth/password-reset/request', { identifier });
}

async function confirmReset(identifier, resetToken) {
  remember(resetToken, 'reset-evidence-password-2026');
  return post('/api/v1/auth/password-reset/confirm', {
    identifier,
    resetToken,
    newPassword: 'reset-evidence-password-2026',
  });
}

function naturalRow(principalId) {
  requireUuid(principalId, 'principal');
  const text = sql(
    `SELECT challenge_id, CHAR_LENGTH(HEX(token_digest)), consumed_at IS NULL, ` +
    `expires_at > UTC_TIMESTAMP(6), HEX(token_digest) ` +
    `FROM \`${schema}\`.iam_password_reset_challenge WHERE principal_id='${principalId}' ` +
    `ORDER BY created_at DESC LIMIT 1;`
  );
  if (!text) return null;
  const [challengeId, digestChars, unconsumed, unexpired, digest] = text.split('\t');
  remember(digest, digest?.toLowerCase());
  return {
    challengeId,
    digestChars: Number(digestChars),
    unconsumed: unconsumed === '1',
    unexpired: unexpired === '1',
    digest,
  };
}

function insertChallenge(principalId, sourceChallengeId, { expired = false, consumed = false } = {}) {
  requireUuid(principalId, 'principal');
  requireUuid(sourceChallengeId, 'source-challenge');
  const challengeId = randomUUID();
  const token = randomBytes(48).toString('base64url');
  const digest = createHash('sha256').update(token, 'utf8').digest('hex');
  if (!/^[0-9a-f]{64}$/.test(digest)) throw new Error('DIGEST_EXPECTED');
  remember(token, digest);
  const expires = expired ? 'DATE_SUB(src.created_at, INTERVAL 1 HOUR)' : 'src.expires_at';
  const consumedAt = consumed ? 'src.created_at' : 'NULL';
  sql(
    `INSERT INTO \`${schema}\`.iam_password_reset_challenge ` +
    `(challenge_id, principal_id, token_digest, created_at, expires_at, consumed_at) ` +
    `SELECT '${challengeId}', '${principalId}', UNHEX('${digest}'), src.created_at, ${expires}, ${consumedAt} ` +
    `FROM \`${schema}\`.iam_password_reset_challenge src WHERE src.challenge_id='${sourceChallengeId}';`
  );
  return { challengeId, token, digest };
}

function consumedFlag(challengeId) {
  return sql(
    `SELECT consumed_at IS NOT NULL FROM \`${schema}\`.iam_password_reset_challenge WHERE challenge_id='${challengeId}';`
  ) === '1';
}

function assertNoAccountSignal(name, response) {
  const hits = leakHits(response.text);
  expect(name + '.no-account-signal', hits.length === 0 && response.status !== 404
    && response.json?.error?.errorCode !== 'NOT_FOUND', { status: response.status, code: codeOf(response), hits });
}

function assertSame(name, left, right) {
  const compared = samePublic(left, right);
  expect(name, compared.equal, {
    left: compared.left,
    right: compared.right,
  });
  note(name, {
    equal: compared.equal,
    status: compared.left.status,
    errorCode: left.json?.error?.errorCode ?? null,
    message: left.json?.error?.message ?? null,
  });
  return compared;
}

let probeError = null;
try {
const known = await register('known');
const other = await register('other');
const limitedKnown = await register('limited');
if (!known.principalId || !other.principalId || !limitedKnown.principalId) {
  throw new Error('REGISTER_FAILED');
}

const before = challengeCount();
note('sql.before', { challenges: before });
expect('sql.before', before === 0, { before });

const missingIdentifier = `missing-${randomUUID().slice(0, 8)}@example.invalid`;
remember(missingIdentifier);
const missing = await requestReset(missingIdentifier);
const afterMissing = challengeCount();
note('request.missing', { status: missing.status, challenges: afterMissing, code: codeOf(missing) });
expect('request.missing.status', missing.status === 202, codeOf(missing));
expect('request.missing.no-row', afterMissing === before, { before, afterMissing });

const present = await requestReset(known.identifier);
const afterPresent = challengeCount();
const row = naturalRow(known.principalId);
note('request.present', {
  status: present.status,
  challenges: afterPresent,
  digestChars: row?.digestChars ?? null,
  unconsumed: row?.unconsumed ?? null,
  unexpired: row?.unexpired ?? null,
});
expect('request.present.status', present.status === 202, codeOf(present));
expect('request.present.one-row', afterPresent === before + 1, { before, afterPresent });
expect('request.present.row-shape', Boolean(row) && row.digestChars === 64 && row.unconsumed && row.unexpired, {
  digestChars: row?.digestChars ?? null,
  unconsumed: row?.unconsumed ?? null,
  unexpired: row?.unexpired ?? null,
});

const pair = samePublic(present, missing);
expect('request.pair.same-public', pair.equal, { left: pair.left, right: pair.right });
expect('request.pair.accepted-only', present.json?.data?.accepted === true && missing.json?.data?.accepted === true
  && Object.keys(present.json?.data ?? {}).length === 1 && Object.keys(missing.json?.data ?? {}).length === 1, {
  presentKeys: Object.keys(present.json?.data ?? {}),
  missingKeys: Object.keys(missing.json?.data ?? {}),
});
const presentLeaks = leakHits(present.text);
const missingLeaks = leakHits(missing.text);
expect('request.present.no-token-or-identifier', presentLeaks.length === 0, { hits: presentLeaks });
expect('request.missing.no-token-or-identifier', missingLeaks.length === 0, { hits: missingLeaks });
const presentHeaderLeaks = leakHits(Object.values(present.headers).join('\n'));
const missingHeaderLeaks = leakHits(Object.values(missing.headers).join('\n'));
expect('request.present.headers-clean', presentHeaderLeaks.length === 0, { hits: presentHeaderLeaks });
expect('request.missing.headers-clean', missingHeaderLeaks.length === 0, { hits: missingHeaderLeaks });
note('request.pair', {
  equal: pair.equal,
  status: pair.left.status,
  publicHeaders: pair.left.headers,
  publicBody: pair.left.body,
  contentLength: [present.headers['content-length'] ?? null, missing.headers['content-length'] ?? null],
  presentLeaks,
  missingLeaks,
  presentHeaderLeaks,
  missingHeaderLeaks,
});

const blankBodies = [
  ['empty', ''],
  ['spaces', '   '],
  ['newline', '\n'],
  ['omitted', undefined],
];
const blankCountBefore = challengeCount();
for (const [label, identifier] of blankBodies) {
  const body = identifier === undefined ? {} : { identifier };
  const response = await post('/api/v1/auth/password-reset/request', body);
  const count = challengeCount();
  note('request.blank.' + label, { status: response.status, code: codeOf(response), challenges: count });
  expect('request.blank.' + label + '.400', response.status === 400
    && response.json?.error?.errorCode === 'VALIDATION_ERROR'
    && response.json?.error?.message === 'iam.password_reset.invalid', codeOf(response));
  expect('request.blank.' + label + '.not-202', response.status !== 202, codeOf(response));
  expect('request.blank.' + label + '.no-row', count === blankCountBefore, { count, blankCountBefore });
}

if (!row?.challengeId) {
  expect('confirm.available', false, { reason: 'no natural challenge row' });
} else {
const live = insertChallenge(known.principalId, row.challengeId);
const wrongToken = randomBytes(48).toString('base64url');
remember(wrongToken);
const wrong = await confirmReset(known.identifier, wrongToken);
const mismatchOther = await confirmReset(other.identifier, live.token);
const mismatchMissing = await confirmReset(missingIdentifier, live.token);
assertNoAccountSignal('confirm.wrong-token', wrong);
assertNoAccountSignal('confirm.token-right-other-account', mismatchOther);
assertNoAccountSignal('confirm.token-right-missing', mismatchMissing);
assertSame('confirm.wrong-vs-other-account', wrong, mismatchOther);
assertSame('confirm.wrong-vs-missing', wrong, mismatchMissing);
expect('confirm.mismatch-did-not-consume', consumedFlag(live.challengeId) === false, {
  consumed: consumedFlag(live.challengeId),
});

const confirmed = await confirmReset(known.identifier, live.token);
note('confirm.success', { status: confirmed.status, consumed: consumedFlag(live.challengeId) });
expect('confirm.success', confirmed.status === 204 && consumedFlag(live.challengeId), {
  status: confirmed.status,
  consumed: consumedFlag(live.challengeId),
  code: codeOf(confirmed),
});

const usedReal = await confirmReset(known.identifier, live.token);
const usedMissing = await confirmReset(missingIdentifier, live.token);
assertNoAccountSignal('confirm.used-real', usedReal);
assertNoAccountSignal('confirm.used-missing', usedMissing);
assertSame('confirm.used-real-vs-missing', usedReal, usedMissing);
assertSame('confirm.used-vs-wrong-token', usedReal, wrong);

const expired = insertChallenge(known.principalId, row.challengeId, { expired: true });
const expiredReal = await confirmReset(known.identifier, expired.token);
const expiredMissing = await confirmReset(missingIdentifier, expired.token);
assertNoAccountSignal('confirm.expired-real', expiredReal);
assertNoAccountSignal('confirm.expired-missing', expiredMissing);
assertSame('confirm.expired-real-vs-missing', expiredReal, expiredMissing);
assertSame('confirm.expired-vs-wrong-token', expiredReal, wrong);
expect('confirm.expired-did-not-consume', consumedFlag(expired.challengeId) === false, {
  consumed: consumedFlag(expired.challengeId),
});

const spent = insertChallenge(known.principalId, row.challengeId, { consumed: true });
const spentReal = await confirmReset(known.identifier, spent.token);
const spentMissing = await confirmReset(missingIdentifier, spent.token);
assertNoAccountSignal('confirm.preconsumed-real', spentReal);
assertNoAccountSignal('confirm.preconsumed-missing', spentMissing);
assertSame('confirm.preconsumed-real-vs-missing', spentReal, spentMissing);
assertSame('confirm.preconsumed-vs-wrong-token', spentReal, wrong);
}

const limitedMissingIdentifier = `missing-limit-${randomUUID().slice(0, 8)}@example.invalid`;
remember(limitedMissingIdentifier);
const beforeLimit = challengeCount();
const knownBurst = [];
for (let i = 0; i < 6; i += 1) knownBurst.push(await requestReset(limitedKnown.identifier));
const afterKnownLimit = challengeCount();
const missingBurst = [];
for (let i = 0; i < 6; i += 1) missingBurst.push(await requestReset(limitedMissingIdentifier));
const afterMissingLimit = challengeCount();
const knownLimited = knownBurst[5];
const missingLimited = missingBurst[5];
note('rate.known', { statuses: knownBurst.map((item) => item.status), challenges: afterKnownLimit });
note('rate.missing', { statuses: missingBurst.map((item) => item.status), challenges: afterMissingLimit });
expect('rate.known.not-202', knownLimited.status !== 202, codeOf(knownLimited));
expect('rate.missing.not-202', missingLimited.status !== 202, codeOf(missingLimited));
expect('rate.known.first-five-202', knownBurst.slice(0, 5).every((item) => item.status === 202), {
  statuses: knownBurst.map((item) => item.status),
});
expect('rate.missing.first-five-202', missingBurst.slice(0, 5).every((item) => item.status === 202), {
  statuses: missingBurst.map((item) => item.status),
});
expect('rate.known.rows', afterKnownLimit === beforeLimit + 5, { beforeLimit, afterKnownLimit });
expect('rate.missing.no-row', afterMissingLimit === afterKnownLimit, { afterKnownLimit, afterMissingLimit });
assertSame('rate.limited-pair', knownLimited, missingLimited);
expect('rate.known.429', knownLimited.status === 429 && knownLimited.json?.error?.errorCode === 'RATE_LIMITED'
  && knownLimited.json?.error?.message === 'iam.password_reset.rate_limited'
  && knownLimited.headers['retry-after'] === '60', codeOf(knownLimited));
expect('rate.missing.429', missingLimited.status === 429 && missingLimited.json?.error?.errorCode === 'RATE_LIMITED'
  && missingLimited.json?.error?.message === 'iam.password_reset.rate_limited'
  && missingLimited.headers['retry-after'] === '60', codeOf(missingLimited));
expect('rate.known.no-identifier', leakHits(knownLimited.text).length === 0, { hits: leakHits(knownLimited.text) });
expect('rate.missing.no-identifier', leakHits(missingLimited.text).length === 0, { hits: leakHits(missingLimited.text) });
const rateCounts = sql(
  `SELECT request_count FROM \`${schema}\`.iam_rate_limit WHERE scope_key='password_reset' ORDER BY request_count;`
);
note('sql.rate-counts', { counts: rateCounts.split('\n').filter(Boolean) });
} catch (error) {
  probeError = error && error.message ? error.message : String(error);
  failures.push({ name: 'probe-exception', detail: probeError });
  console.log('PROBE_EXCEPTION ' + probeError);
}

const result = {
  card: 'R1-012',
  bc: 'BC-012',
  date: '2026-10-09',
  branch: 'dev-redesign',
  iam: iam,
  schema,
  assertionsPassed: failures.length === 0,
  failureCount: failures.length,
  probeError,
  failures,
  cases,
};
writeFileSync(join(outDir, 'http-result.json'), JSON.stringify(result, null, 2) + '\n');
console.log('HTTP_ASSERTIONS ' + (failures.length === 0 ? 'OK' : 'FAILED ' + failures.length));
process.exit(failures.length === 0 ? 0 : 2);
