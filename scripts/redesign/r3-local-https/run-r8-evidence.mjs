/**
 * r8 evidence: IT-2 three owner schemas with real IAM RS256, then a clean boot
 * for the durable IT-7 closure desk and the IT-1..IT-7 chain.
 * Certificates stay in the system temp dir. This file never calls `security`.
 * It does not rewrite earlier evidence directories.
 */
import { spawn, execFileSync } from 'node:child_process';
import { createHash, createSign, randomBytes, randomUUID } from 'node:crypto';
import { appendFileSync, createWriteStream, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { certificateSpkiHash, prepareIamTls } from './prepare-iam-tls.mjs';

const root = '/Users/Admin/Desktop/work/cloudstudy';
const day = 'evidence/redesign/2026-10-11';
const container = 'yuxuexing-local-mysql-1';
const suffix = randomBytes(4).toString('hex');
const it2Dir = join(root, day, `it2-three-schema-r8-${suffix}`);
const it7Dir = join(root, day, `it7-persist-r8-${suffix}`);
const chainDir = join(root, day, `full-chain-r8-${suffix}`);
let evidenceDir = it2Dir;
let names = null;
const directory = join(tmpdir(), `r8-evidence-${suffix}`);
const progressLog = '/tmp/r8-evidence.log';
const javaHome = process.env.JAVA_HOME || '/Users/Admin/.local/tools/jdk';
const ports = {
  iam: 18087, learner: 18088, content: 18089, learning: 18090, assessment: 18091,
  gateway: 18070, admin: 18097, web: 18180, mobile: 18183, adminWeb: 18181,
};
const issuer = 'http://127.0.0.1:18087';
const jwks = 'https://127.0.0.1:18087/api/v1/auth/jwks';
const audience = 'yuxuexing-api';
const retained = ['r1_it1_browser_20261010_iam_5d9f4b7e', 'r1_it1_browser_20261010_cnt_5d9f4b7e'];
const planted = `r8-planted-${suffix}`;
const children = [];
const steps = [];
let tlsCa = null;
let qidaBefore = [];
let dropped = false;
let dbFacts = { it2: {}, chain: {} };
let seq = 0;
let runtime = null;
let stackUp = false;
let caPemPath = null;
let nodeRan = false;
let buckets = ['boot'];

for (const dir of [it2Dir, it7Dir, chainDir]) mkdirSync(join(dir, 'screenshots'), { recursive: true });
mkdirSync(directory, { recursive: true });

function bindNames(tag, keys) {
  const all = {
    iam: [`r8_${tag}_20261011_iam_${suffix}`, `r8j_${tag}_iam_${suffix}`],
    learner: [`r8_${tag}_20261011_lrn_${suffix}`, `r8j_${tag}_lrn_${suffix}`],
    content: [`r8_${tag}_20261011_cnt_${suffix}`, `r8j_${tag}_cnt_${suffix}`],
    assessment: [`r8_${tag}_20261011_asm_${suffix}`, `r8j_${tag}_asm_${suffix}`],
    learning: [`r8_${tag}_20261011_lng_${suffix}`, `r8j_${tag}_lng_${suffix}`],
    admin: [`r8_${tag}_20261011_adm_${suffix}`, `r8j_${tag}_adm_${suffix}`],
  };
  names = {};
  for (const key of keys) names[key] = all[key];
}

function note(line) {
  const text = String(line) + '\n';
  process.stdout.write(text);
  appendFileSync(progressLog, text);
}
function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', ...options });
}
function sql(statement) {
  return run('docker', [
    'exec', '-i', container, 'sh', '-c',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --protocol=socket --user=root --default-character-set=utf8mb4 --batch --raw --skip-column-names',
  ], { input: statement }).trim();
}
function record(name, status, detail) {
  const safe = detail == null ? {} : JSON.parse(JSON.stringify(detail, (key, value) => /password|secret|token|cookie|authorization/i.test(key) ? '[redacted]' : value));
  steps.push({ name, status, detail: safe, buckets: [...buckets] });
  note(`${status} ${name} ${JSON.stringify(safe).slice(0, 500)}`);
  return status === 'PASS';
}
function listeners(port) {
  try { return run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN']); }
  catch (error) { if (error.status === 1) return ''; throw error; }
}
function grantScope(schema, partialRevokes) {
  const name = partialRevokes ? schema : schema.replaceAll('_', '\\_');
  return '`' + name + '`.*';
}
function jdbc(schema) {
  return `jdbc:mysql://127.0.0.1:13306/${schema}?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&allowPublicKeyRetrieval=true&useSSL=false`;
}
function b64(value) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
function serviceToken(privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: 'iam-local-2026-08' };
  const payload = {
    iss: issuer, sub: 'assessment-service', aud: audience, iat: now, nbf: now - 30, exp: now + 7200,
    jti: randomUUID(), service_id: 'assessment-service', client_id: 'assessment-service',
    token_type: 'service', scope: 'content:answer-rules:read', roles: [],
    permissions: ['content:answer-rules:read'], tenant_id: 'platform',
  };
  const input = `${b64(header)}.${b64(payload)}`;
  const signature = createSign('RSA-SHA256').update(input).end().sign(privateKeyPem).toString('base64url');
  return `${input}.${signature}`;
}
function request(options) {
  const payload = options.body == null ? null : Buffer.from(JSON.stringify(options.body));
  const headers = { accept: options.accept || 'application/json', ...(options.headers || {}) };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (payload) {
    headers['content-type'] = 'application/json';
    headers['content-length'] = String(payload.length);
  }
  const lib = options.https ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request({
      host: '127.0.0.1', port: options.port, path: options.path, method: options.method || 'GET', headers,
      ca: options.https ? tlsCa : undefined, rejectUnauthorized: true, timeout: options.timeout || 20000,
      servername: '127.0.0.1',
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (payload) req.end(payload); else req.end();
  });
}
function parsed(response) {
  try { return JSON.parse(response.body); } catch { return null; }
}
function startJava(id, args, env) {
  const out = createWriteStream(join(directory, id + '.log'));
  const child = spawn(join(javaHome, 'bin', 'java'), args, {
    cwd: root, detached: true, env: { ...process.env, JAVA_HOME: javaHome, PATH: `${javaHome}/bin:${process.env.PATH}`, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(out); child.stderr.pipe(out);
  child.on('exit', (code) => note(id + '_EXIT ' + code));
  children.push({ id, child });
  return child;
}
function startNode(id, args, env = {}) {
  const out = createWriteStream(join(directory, id + '.log'));
  const child = spawn('pnpm', args, { cwd: root, detached: true, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(out); child.stderr.pipe(out);
  child.on('exit', (code) => note(id + '_EXIT ' + code));
  children.push({ id, child });
  return child;
}
async function waitHealth(child, probe, label) {
  const deadline = Date.now() + 120000;
  let last = 'no response';
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(label + ' exited ' + child.exitCode);
    try {
      const response = await probe();
      if (response.status >= 200 && response.status < 300) return;
      last = 'HTTP ' + response.status;
    } catch (error) { last = error.message; }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(label + ' health timeout ' + last);
}
async function stopAll() {
  for (const entry of [...children].reverse()) {
    const child = entry.child;
    if (!child || child.pid == null || child.exitCode != null) continue;
    try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch { /* gone */ } }
  }
  const deadline = Date.now() + 12000;
  while (children.some((entry) => entry.child.exitCode == null) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  for (const entry of children) {
    if (entry.child.exitCode == null && entry.child.pid != null) {
      try { process.kill(-entry.child.pid, 'SIGKILL'); } catch { /* gone */ }
    }
  }
}
async function stopId(id) {
  const entry = [...children].reverse().find((item) => item.id === id && item.child.exitCode == null);
  if (!entry) return;
  try { process.kill(-entry.child.pid, 'SIGTERM'); } catch { try { entry.child.kill('SIGTERM'); } catch { /* gone */ } }
  const deadline = Date.now() + 10000;
  while (entry.child.exitCode == null && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 200));
  if (entry.child.exitCode == null) {
    try { process.kill(-entry.child.pid, 'SIGKILL'); } catch { /* gone */ }
  }
}
function qidaNames() {
  return run('docker', ['ps', '--format', '{{.Names}}']).split('\n').filter((name) => name.includes('qida')).sort();
}
function dropSchemas() {
  if (dropped || !names) return;
  dropped = true;
  for (const [schema, user] of Object.values(names)) {
    if (retained.includes(schema) || !schema.startsWith('r8_')) throw new Error('REFUSING_DROP ' + schema);
    sql(`DROP DATABASE IF EXISTS \`${schema}\`; DROP USER IF EXISTS '${user}'@'%';`);
  }
}
function jar(name) { return join(root, 'services', name, 'target', `${name}-0.1.0-SNAPSHOT.jar`); }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function idemKey() {
  return `it7-${suffix}-${String(++seq).padStart(4, '0')}-${randomBytes(3).toString('hex')}`;
}
function codeOf(result) {
  return result && result.error ? result.error.code || result.error.message : null;
}
async function iamWrite(method, path, body, token) {
  return request({
    port: ports.iam, https: true, method, path, token,
    headers: { 'Idempotency-Key': idemKey(), 'x-client-platform': 'web' },
    body,
  });
}
async function iamPost(path, body) {
  return iamWrite('POST', path, body);
}
async function qualifyLearner(token) {
  const gate = await iamWrite('POST', '/api/v1/iam/adult-gate', {
    confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1',
  }, token);
  const gateBody = parsed(gate);
  if (gate.status !== 200) {
    return { ok: false, detail: `gate ${gate.status} ${gateBody && gateBody.error ? gateBody.error.code || gateBody.error.message : ''}` };
  }
  for (const type of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    const consent = await iamWrite('PUT', '/api/v1/iam/consents', {
      type, version: 'b30-consent-v1', decision: 'ACCEPTED',
    }, token);
    const consentBody = parsed(consent);
    if (consent.status !== 200) {
      return { ok: false, detail: `${type} ${consent.status} ${consentBody && consentBody.error ? consentBody.error.code || consentBody.error.message : ''}` };
    }
  }
  return { ok: true, detail: 'PASSED' };
}
async function registerApi(identifier, password) {
  const device = { deviceType: 'WEB', clientVersion: 'r8', deviceName: 'r8' };
  let response = await iamPost('/api/v1/auth/register', { identifier, password, device });
  let body = parsed(response);
  let token = body && body.data && body.data.accessToken;
  if (!token) {
    response = await iamPost('/api/v1/auth/login', { identifier, password, device });
    body = parsed(response);
    token = body && body.data && body.data.accessToken;
  }
  const error = body && body.error ? body.error.code || body.error.message : null;
  return { status: response.status, token: token || null, error };
}
function grant(identifier, extra) {
  const schema = names.iam[0];
  if (!schema.startsWith('r8_')) throw new Error('REFUSING_GRANT');
  const id = identifier.replaceAll("'", '');
  sql(`UPDATE \`${schema}\`.iam_account SET permissions = CONCAT(permissions, ',${extra}') WHERE identifier = '${id}';`);
}
async function loginApi(identifier, password) {
  const response = await iamPost('/api/v1/auth/login', {
    identifier, password, device: { deviceType: 'WEB', clientVersion: 'r8', deviceName: 'r8' },
  });
  const body = parsed(response);
  return { status: response.status, token: body && body.data && body.data.accessToken ? body.data.accessToken : null };
}
async function closure(token, command, input = {}) {
  const response = await request({
    port: ports.gateway, method: 'POST', path: '/api/v1/admin/ops/commands', token,
    headers: { 'Idempotency-Key': input.idempotencyKey || idemKey() },
    body: { closureCommand: command, closureInput: input },
  });
  const body = parsed(response);
  return {
    status: response.status,
    data: body && body.data ? body.data : null,
    error: body && body.error ? body.error : null,
    raw: response.body,
  };
}
async function board(token) {
  const response = await request({
    port: ports.gateway, path: '/api/v1/support/tickets?projection=it7', token,
  });
  const body = parsed(response);
  return { status: response.status, data: body && body.data ? body.data : null, error: body && body.error ? body.error : null, raw: response.body };
}
function closureDigest(data) {
  const privacy = data && data.privacy ? data.privacy : {};
  const observation = data && data.observation ? data.observation : {};
  const cases = Array.isArray(data && data.cases) ? data.cases : [];
  return [
    data && data.writeSwitch, data && data.dispositionOpen, data && data.casesState, cases.length,
    cases.map((item) => `${item.status}|${item.disposition}`).sort().join(','),
    data && data.understandable, data && data.auditSharedWithLearner, data && data.supportNumber,
    observation.productionReady, observation.anySchemaRollback,
    privacy.allComplete, privacy.dataDeleted, privacy.retentionDays, privacy.workerGap, privacy.longTermCapture,
    privacy.exportState,
  ].join('|');
}
async function command(token, name, code, body = {}, key) {
  const response = await request({
    port: ports.gateway, method: 'POST', path: '/api/v1/admin/content-commands', token,
    headers: { 'Idempotency-Key': key || idemKey() },
    body: { command: name, contentCode: code, ...body },
  });
  const bodyJson = parsed(response);
  return { status: response.status, data: bodyJson && bodyJson.data ? bodyJson.data : null, error: bodyJson && bodyJson.error ? bodyJson.error : null };
}
async function catalog(token) {
  const response = await request({ port: ports.gateway, path: '/api/v1/content/learner/catalog', token });
  const body = parsed(response);
  const items = body && body.data && Array.isArray(body.data.items) ? body.data.items : [];
  return { status: response.status, items };
}
function hasTitle(items, title) { return items.some((item) => item && item.title === title); }
async function simpleFingerprint(token, code, title) {
  const mode = await command(token, 'RELEASE_MODE', 'release-mode', {});
  const created = await command(token, 'RELEASE_CREATE', code, { title, kind: 'TEXT' });
  const rights = await command(token, 'RELEASE_BIND_RIGHTS', code, { versionNumber: 1, copyrightRef: 'rights-' + code });
  const report = await command(token, 'RELEASE_BIND_REPORT', code, { versionNumber: 1, reportMode: 'SIMPLE', reportRef: 'report-' + code });
  const submitted = await command(token, 'RELEASE_SUBMIT', code, {});
  const published = await command(token, 'RELEASE_PUBLISH', code, {});
  const hidden = await catalog(token);
  const synced = await command(token, 'RELEASE_SYNC', code, {});
  const shown = await catalog(token);
  return {
    ok: mode.data && mode.data.reviewMode === 'SIMPLE'
      && created.status === 202 && created.data && created.data.status === 'DRAFT'
      && rights.status === 200 && report.status === 200 && submitted.status === 202
      && published.status === 202 && published.data && published.data.catalogState === 'PUBLISHING'
      && hidden.status === 200 && !hasTitle(hidden.items, title)
      && synced.status === 200 && synced.data && synced.data.catalogState === 'PUBLISHED'
      && shown.status === 200 && hasTitle(shown.items, title),
    digest: [
      mode.data && mode.data.reviewMode, created.status, published.data && published.data.catalogState,
      hasTitle(hidden.items, title), synced.data && synced.data.catalogState, hasTitle(shown.items, title),
    ].join('|'),
  };
}

async function smokeStations(accounts) {
  const learner = accounts.learner.token;
  const target = await request({
    port: ports.gateway, method: 'PUT', path: '/api/v1/learner/targets', token: learner,
    headers: { 'Idempotency-Key': idemKey() },
    body: { expectedStateVersion: 0, goalCode: 'ZERO_BASIS', targetLevel: 'A1', dailyQuotaMinutes: 15, status: 'ACTIVE' },
  });
  const readBack = await request({ port: ports.gateway, path: '/api/v1/learner/targets', token: learner });
  record('smoke-it1-target', target.status >= 200 && target.status < 300 && readBack.status === 200 && readBack.body.includes('FOUNDATION') && readBack.body.includes('"dailyQuotaMinutes":15') ? 'PASS' : 'FAIL', {
    write: target.status, read: readBack.status, excerpt: readBack.body.slice(0, 180),
  });
  const placement = await request({
    port: ports.gateway, method: 'POST', path: '/api/v1/assessment/placement/sessions', token: learner,
    headers: { 'Idempotency-Key': idemKey() },
    body: {},
  });
  const placementBody = parsed(placement);
  record('smoke-it2-placement', placement.status === 201 ? 'PASS' : 'FAIL', {
    status: placement.status, code: placementBody && placementBody.error ? placementBody.error.code || placementBody.error.message : null,
  });
  const task = await request({
    port: ports.gateway, method: 'POST', path: '/api/v1/onboarding/daily-tasks/ensure', token: learner,
    headers: { 'Idempotency-Key': idemKey() },
    body: { contentCode: 'p1-b3-grammar-01', title: '语法练习', minutes: 15 },
  });
  record('smoke-it3-daily-task', task.status >= 200 && task.status < 300 ? 'PASS' : 'FAIL', { status: task.status, excerpt: task.body.slice(0, 180) });
  const fingerprint = await simpleFingerprint(accounts.ops.token, 'it7-smoke-text', '收口冒烟课文');
  runtime.simpleDigest = fingerprint.digest;
  record('smoke-it6-release', fingerprint.ok ? 'PASS' : 'FAIL', { digest: fingerprint.digest });
  const report = await request({ port: ports.gateway, path: '/api/v1/learning/stats/daily-report', token: learner });
  const reportBody = parsed(report);
  const official = reportBody && (reportBody.officialScore === true || (reportBody.data && reportBody.data.officialScore === true));
  record('smoke-it5-period', report.status === 200 && report.body.includes('officialScore') && !official ? 'PASS' : 'FAIL', {
    status: report.status, official, excerpt: report.body.slice(0, 180),
  });
}

async function closureSequence(accounts) {
  const ops = accounts.ops.token;
  const learner = accounts.learner.token;
  const other = accounts.other.token;
  const empty = await board(ops);
  record('lock-read-board', empty.status === 200 && empty.data && empty.data.writeSwitch === 'FROZEN' && empty.data.dispositionOpen === false ? 'PASS' : 'FAIL', {
    status: empty.status, writeSwitch: empty.data && empty.data.writeSwitch,
  });
  const lock = await closure(ops, 'LOCK_READ', {});
  record('bc085-lock', lock.status === 200 && lock.data && lock.data.executed === false && lock.data.writeSwitch === 'FROZEN' ? 'PASS' : 'FAIL', { status: lock.status, executed: lock.data && lock.data.executed });
  const sample = await closure(ops, 'FILE', { sample: true, sourceRef: 'sample' });
  const filed = await closure(ops, 'FILE', { sourceRef: 'source-r8-persist', title: '有来源的档案' });
  record('bc086-file', sample.status === 409 && codeOf(sample) === 'SAMPLE_REJECTED' && filed.status === 200 && filed.data && filed.data.disposition === 'NOT_STARTED' && filed.data.status === 'FILED' ? 'PASS' : 'FAIL', {
    sample: sample.status, code: codeOf(sample), filed: filed.status, disposition: filed.data && filed.data.disposition,
  });
  const caseId = filed.data && filed.data.caseId;
  const triage = await closure(ops, 'TRIAGE', { caseId });
  record('bc087-triage', triage.status === 409 && codeOf(triage) === 'DISPOSITION_NOT_ADMITTED' && triage.error && triage.error.dispatched === false ? 'PASS' : 'FAIL', { status: triage.status, code: codeOf(triage) });
  const isolate = await closure(ops, 'ISOLATE', { caseId });
  const isolateAgain = await closure(ops, 'ISOLATE', { caseId });
  record('bc088-isolate', isolate.status === 409 && isolateAgain.status === 409 && isolate.error && isolate.error.unlockAvailable === false && isolate.error.isolationWrites === 0 && isolate.error.sameAsLock === false ? 'PASS' : 'FAIL', {
    status: isolate.status, writes: isolate.error && isolate.error.isolationWrites,
  });
  const escalate = await closure(ops, 'ESCALATE', { caseId, receiverAvailable: false });
  const escalateOpen = await closure(ops, 'ESCALATE', { caseId, receiverAvailable: true });
  record('bc089-escalate', escalate.status === 409 && codeOf(escalate) === 'RECEIVER_UNAVAILABLE' && escalate.error && escalate.error.accepted === false && escalateOpen.status === 409 && codeOf(escalateOpen) === 'DISPOSITION_NOT_ADMITTED' ? 'PASS' : 'FAIL', {
    closed: codeOf(escalate), open: codeOf(escalateOpen),
  });
  const close = await closure(ops, 'CLOSE', { caseId });
  record('bc090-close', close.status === 409 && codeOf(close) === 'CHAIN_INCOMPLETE' && close.error && close.error.closed === false && close.error.claimsFullChain === false ? 'PASS' : 'FAIL', { code: codeOf(close) });
  const cases = await closure(ops, 'CASES', { status: 'FILED' });
  const denied = await closure(learner, 'CASES', {});
  record('bc091-cases', cases.status === 200 && cases.data && cases.data.casesState === 'HAS_CASES' && cases.data.items && cases.data.items[0] && cases.data.items[0].updatedAt && denied.status === 403 && codeOf(denied) === 'CLOSURE_FORBIDDEN' ? 'PASS' : 'FAIL', {
    state: cases.data && cases.data.casesState, denied: denied.status,
  });
  const route = await closure(ops, 'RISK_ROUTE', {});
  record('bc092-route', route.status === 200 && route.data && route.data.independentRiskRoute === false && route.data.redirect === '/governance' && route.data.permissionStillRequired === true ? 'PASS' : 'FAIL', { redirect: route.data && route.data.redirect });
  const reports = await closure(ops, 'REPORTS', {});
  record('bc093-reports', reports.status === 200 && reports.data && reports.data.readOnly === true && reports.data.dispositionButtons === false && reports.data.masked === true ? 'PASS' : 'FAIL', { readOnly: reports.data && reports.data.readOnly });
  const submit = await closure(learner, 'TICKET_SUBMIT', { bodyHash: 'hash-r8-persist', description: planted });
  record('bc185-ticket', submit.status === 409 && codeOf(submit) === 'DEC06_NOT_APPROVED' && submit.error && submit.error.understandable === false && submit.error.storedRawText === false && !submit.raw.includes(planted) ? 'PASS' : 'FAIL', { code: codeOf(submit) });
  const own = await closure(learner, 'TICKETS', {});
  const ticketId = own.data && own.data.items && own.data.items[0] && own.data.items[0].ticketId;
  const missing = await closure(learner, 'TICKET_GET', { ticketId: 'trace-missing' });
  const foreign = await closure(other, 'TICKET_GET', { ticketId });
  record('bc186-visibility', own.status === 200 && own.data && own.data.items && own.data.items[0] && own.data.items[0].information === 'INSUFFICIENT' && own.data.items[0].reply == null && missing.status === 404 && foreign.status === 404 && codeOf(missing) === 'TICKET_NOT_VISIBLE' && codeOf(foreign) === codeOf(missing) ? 'PASS' : 'FAIL', {
    own: own.status, missing: missing.status, foreign: foreign.status,
  });
  const unconfirmed = await closure(learner, 'EXPORT', {});
  const queued = await closure(learner, 'EXPORT', { confirmed: true, mark: 'QUEUED' });
  const complete = await closure(learner, 'EXPORT', { confirmed: true, mark: 'COMPLETE' });
  record('bc188-export', unconfirmed.status === 403 && codeOf(unconfirmed) === 'IDENTITY_UNCONFIRMED' && queued.status === 200 && queued.data && queued.data.state === 'QUEUED' && queued.data.allComplete === false && complete.status === 409 && codeOf(complete) === 'WORKER_GAP' ? 'PASS' : 'FAIL', {
    unconfirmed: unconfirmed.status, queued: queued.data && queued.data.state, complete: codeOf(complete),
  });
  const deletionDenied = await closure(learner, 'DELETE', {});
  const deletion = await closure(learner, 'DELETE', { secondFactor: true });
  const deletionAgain = await closure(learner, 'DELETE', { secondFactor: true });
  record('bc189-delete', deletionDenied.status === 403 && deletion.status === 200 && deletion.data && deletion.data.accepted === true && deletion.data.dataDeleted === false && deletion.data.accessStopped === false && deletion.data.tokenRevokeMeansDeleted === false && deletionAgain.status === 200 && deletionAgain.data && deletionAgain.data.dataDeleted === false ? 'PASS' : 'FAIL', {
    denied: deletionDenied.status, deleted: deletion.data && deletion.data.dataDeleted,
  });
  const audioDays = await closure(learner, 'AUDIO', { retentionDays: 30 });
  const audio = await closure(learner, 'AUDIO', {});
  record('bc190-audio', audioDays.status === 409 && codeOf(audioDays) === 'POLICY_NOT_APPROVED' && audio.status === 200 && audio.data && audio.data.retentionDays == null && audio.data.longTermCapture === false ? 'PASS' : 'FAIL', { days: codeOf(audioDays) });
  const worker = await closure(learner, 'WORKER', {});
  record('bc191-worker', worker.status === 200 && worker.data && worker.data.m6Gap === true && worker.data.allComplete === false && Array.isArray(worker.data.tasks) && worker.data.tasks.length > 0 ? 'PASS' : 'FAIL', {
    tasks: worker.data && worker.data.tasks && worker.data.tasks.length, allComplete: worker.data && worker.data.allComplete,
  });
  const logout = await closure(learner, 'SESSION', { kind: 'LOGOUT' });
  const deletionPrompt = await closure(learner, 'SESSION', { kind: 'DELETION_ACCEPTED' });
  record('bc192-session', logout.status === 200 && logout.data && logout.data.reloginAllowed === true && String(logout.data.prompt).includes('重新登录') && deletionPrompt.data && deletionPrompt.data.reloginAllowed === false && String(deletionPrompt.data.prompt).includes('不能登录') ? 'PASS' : 'FAIL', {
    logout: logout.data && logout.data.reloginAllowed, deletion: deletionPrompt.data && deletionPrompt.data.reloginAllowed,
  });
  const bare = await request({
    port: ports.gateway, method: 'POST', path: '/api/v1/admin/ops/commands',
    headers: { 'Idempotency-Key': idemKey() },
    body: { closureCommand: 'UNAUTHORIZED_ENVELOPE', closureInput: { password: planted, token: planted } },
  });
  const envelope = await closure(learner, 'UNAUTHORIZED_ENVELOPE', { password: planted, token: planted, requestId: planted, traceId: planted });
  const ids = envelope.error || {};
  const distinct = ids.requestId && ids.traceId && ids.auditId && new Set([ids.requestId, ids.traceId, ids.auditId]).size === 3;
  record('bc193-401', bare.status === 401 && !bare.body.includes(planted) && envelope.status === 401 && ids.factId && ids.receiptId && ids.secretsLogged === false && !envelope.raw.includes(planted) && distinct ? 'PASS' : 'FAIL', {
    bare: bare.status, envelope: envelope.status, distinct, secretsLogged: ids.secretsLogged,
  });
  const learnerIds = await closure(learner, 'CORRELATE', {});
  const staffIds = await closure(ops, 'CORRELATE', {});
  record('bc194-correlate', learnerIds.status === 200 && learnerIds.data && learnerIds.data.supportNumber && learnerIds.data.auditVisible === false && !learnerIds.data.requestId && staffIds.data && staffIds.data.idsDistinct === true && staffIds.data.requestId !== staffIds.data.traceId ? 'PASS' : 'FAIL', {
    learnerVisible: learnerIds.data && learnerIds.data.auditVisible, staffDistinct: staffIds.data && staffIds.data.idsDistinct,
  });
  const saga = await closure(ops, 'SAGA', { name: 'RETRY_EXPORT' });
  const unknown = await closure(ops, 'SAGA', { name: 'DROP_SCHEMA' });
  record('bc195-saga', saga.status === 200 && saga.data && saga.data.compensated === true && saga.data.originalSuccess === false && unknown.status === 409 && codeOf(unknown) === 'UNKNOWN_COMPENSATION' ? 'PASS' : 'FAIL', { unknown: codeOf(unknown) });
  const queuedEvent = await closure(ops, 'OUTBOX', { type: 'closure.case.filed' });
  const failedEvent = await closure(ops, 'OUTBOX', { type: 'closure.export.queued', fail: true });
  const replay = await closure(ops, 'OUTBOX', { type: 'closure.deletion.accepted', replay: true });
  record('bc196-outbox', queuedEvent.status === 200 && queuedEvent.data && queuedEvent.data.factCount === queuedEvent.data.projectionCount && queuedEvent.data.padded === false && failedEvent.data && failedEvent.data.deadLetters && failedEvent.data.deadLetters.length > 0 && replay.status === 409 && codeOf(replay) === 'REPLAY_NOT_APPROVED' ? 'PASS' : 'FAIL', {
    counts: queuedEvent.data && queuedEvent.data.factCount, replay: codeOf(replay),
  });
  const gate = await closure(ops, 'RELEASE_GATE', {});
  record('bc197-gate', gate.status === 200 && gate.data && gate.data.productionReady === false && gate.data.evidencePresent === false && gate.data.sbomRecorded === false && gate.data.gracefulShutdownDrilled === false ? 'PASS' : 'FAIL', { ready: gate.data && gate.data.productionReady });
  const rollback = await closure(ops, 'ROLLBACK', { name: 'it7-named-rollback' });
  record('bc198-rollback', rollback.status === 200 && rollback.data && rollback.data.anySchemaRollback === false && rollback.data.drill === 'NOT_DRILLED' && String(rollback.data.limits).includes('不能承诺任意数据库变更') ? 'PASS' : 'FAIL', { drill: rollback.data && rollback.data.drill });
  const learnerAudit = await closure(learner, 'AUDIT_LIST', {});
  const audit = await closure(ops, 'AUDIT_LIST', { operation: 'CASE_FILED' });
  const auditExport = await closure(ops, 'AUDIT_EXPORT', {});
  record('bc208-audit', learnerAudit.status === 403 && codeOf(learnerAudit) === 'CLOSURE_AUDIT_FORBIDDEN' && audit.status === 200 && audit.data && audit.data.masked === true && audit.data.auditSharedWithLearner === false && auditExport.status === 409 && codeOf(auditExport) === 'EXPORT_NOT_OPEN' && auditExport.error && auditExport.error.fileCreated === false ? 'PASS' : 'FAIL', {
    learner: learnerAudit.status, export: codeOf(auditExport),
  });
  const viewed = await board(ops);
  return closureDigest(viewed.data);
}

function startContent() {
  return startJava('content-service', [
    ...runtime.trustArgs, '-jar', jar('content-service'),
  ], {
    ...runtime.commonSecurity, CONTENT_PERSISTENCE_MODE: 'jdbc', CONTENT_FLYWAY_ENABLED: 'true',
    CONTENT_SERVICE_SCHEMA: names.content[0], CONTENT_JDBC_URL: jdbc(names.content[0]),
    CONTENT_JDBC_USERNAME: names.content[1], CONTENT_JDBC_PASSWORD: runtime.dbPassword,
    CONTENT_SERVICE_PORT: '18089', CONTENT_SERVICE_SERVER_ADDRESS: '127.0.0.1',
    CONTENT_EVENT_RELAY_ENABLED: 'false', CONTENT_EVENT_CONSUMER_ENABLED: 'false',
    CONTENT_SERVICE_SECURITY_ISSUER_URI: issuer, CONTENT_SERVICE_SECURITY_JWK_SET_URI: jwks,
    CONTENT_SERVICE_SECURITY_AUDIENCE: audience,
  });
}
function startAdmin() {
  if (!names.admin[0].startsWith('r8_')) throw new Error('REFUSING_ADMIN_SCHEMA');
  return startJava('admin-ops-service', [
    ...runtime.trustArgs, '-jar', jar('admin-ops-service'),
    '--spring.profiles.active=local-real',
    '--spring.flyway.enabled=true',
    `--service.schema=${names.admin[0]}`,
  ], {
    ...runtime.commonSecurity,
    SPRING_PROFILES_ACTIVE: 'local-real',
    SPRING_FLYWAY_ENABLED: 'true',
    SERVICE_SCHEMA: names.admin[0],
    SPRING_DATASOURCE_URL: jdbc(names.admin[0]),
    SPRING_DATASOURCE_USERNAME: names.admin[1],
    SPRING_DATASOURCE_PASSWORD: runtime.dbPassword,
    ADMIN_OPS_RESOURCE_SERVER_ENABLED: 'true',
    ADMIN_OPS_SECURITY_ISSUER_URI: issuer,
    ADMIN_OPS_SECURITY_JWK_SET_URI: jwks,
    ADMIN_OPS_SECURITY_AUDIENCE: audience,
    ADMIN_OPS_SERVICE_PORT: '18097',
    ADMIN_OPS_SERVER_ADDRESS: '127.0.0.1',
    ADMIN_OPS_AUDIT_CURSOR_KEY: 'local-dev-only-audit-cursor-key-32b-minimum!',
  });
}
function applyAdminV1() {
  const schema = names.admin[0];
  if (!schema.startsWith('r8_') || retained.includes(schema)) throw new Error('REFUSING_ADMIN_V1');
  const text = readFileSync(join(root, 'services/admin-ops-service/src/main/resources/db/migration/V1__create_admin_ops_service_schema.sql'), 'utf8');
  sql(`USE \`${schema}\`;\n${text}`);
}
function deskVersion() {
  const schema = names.admin[0];
  if (!schema.startsWith('r8_')) throw new Error('REFUSING_DESK_READ');
  const value = sql(`SELECT state_version FROM \`${schema}\`.it7_closure_desk WHERE desk_id='primary';`);
  return value ? Number(value) : 0;
}
function caseIds(data) {
  const cases = Array.isArray(data && data.cases) ? data.cases : [];
  return cases.map((item) => item.caseId || item.id || '').sort();
}
async function restartClosure(accounts) {
  const beforeOps = await board(accounts.ops.token);
  const beforeLearner = await board(accounts.learner.token);
  const beforeOpsDigest = closureDigest(beforeOps.data);
  const beforeLearnerDigest = closureDigest(beforeLearner.data);
  const beforeCases = caseIds(beforeOps.data);
  const versionBefore = deskVersion();
  await stopId('admin-ops-service');
  await sleep(800);
  const child = startAdmin();
  await waitHealth(child, () => request({ port: ports.admin, path: '/actuator/health' }), 'ADMIN_RESTART');
  const afterOps = await board(accounts.ops.token);
  const afterLearner = await board(accounts.learner.token);
  const afterOpsDigest = closureDigest(afterOps.data);
  const afterLearnerDigest = closureDigest(afterLearner.data);
  const afterCases = caseIds(afterOps.data);
  const versionAfter = deskVersion();
  const ok = beforeOps.status === 200 && afterOps.status === 200
    && beforeLearner.status === 200 && afterLearner.status === 200
    && beforeOpsDigest === afterOpsDigest
    && beforeLearnerDigest === afterLearnerDigest
    && beforeOpsDigest === runtime.closureDigest
    && JSON.stringify(beforeCases) === JSON.stringify(afterCases)
    && beforeCases.length >= 1
    && versionBefore >= 1 && versionAfter >= versionBefore;
  record('restart-fingerprint', ok ? 'PASS' : 'FAIL', {
    before: beforeOpsDigest, after: afterOpsDigest,
    learnerBefore: beforeLearnerDigest, learnerAfter: afterLearnerDigest,
    cases: afterCases, versionBefore, versionAfter,
    replayedCommands: false, desk: 'jdbc-flyway', ownerTable: 'it7_closure_desk',
  });
}
async function replayContent() {
  const schema = names.content[0];
  if (!schema.startsWith('r8_') || retained.includes(schema)) throw new Error('REFUSING_REPLAY_SCHEMA');
  await stopId('content-service');
  await sleep(500);
  sql(`DROP DATABASE IF EXISTS \`${schema}\`; CREATE DATABASE \`${schema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  const child = startContent();
  await waitHealth(child, () => request({ port: ports.content, path: '/actuator/health' }), 'CONTENT_REPLAY');
  const replay = await simpleFingerprint(runtime.accounts.ops.token, 'it7-replay-text', '重放课文');
  record('smoke-it6-replay', replay.ok && runtime.simpleDigest === replay.digest ? 'PASS' : 'FAIL', { first: runtime.simpleDigest, replay: replay.digest });
}

function track(page, calls) {
  page.on('response', (response) => {
    const raw = response.url();
    if (!/auth\/register|assessment\/|attempts|support\/tickets|daily-report/.test(raw)) return;
    let path = raw;
    let origin = '';
    try { const url = new URL(raw); path = url.pathname; origin = url.origin; } catch { /* keep raw */ }
    calls.push({ method: response.request().method(), origin, path, status: response.status() });
  });
}
async function shot(page, name) {
  try { await page.screenshot({ path: join(evidenceDir, 'screenshots', name), fullPage: true }); }
  catch { /* closed */ }
}
async function measureOverflow(page, label) {
  const probe = await page.evaluate(() => {
    const doc = document.documentElement;
    const offenders = [];
    for (const el of document.querySelectorAll('body *')) {
      const rect = el.getBoundingClientRect();
      const extra = Math.max(0, rect.right - doc.clientWidth, -rect.left);
      if (extra > 1 && rect.width > 1) offenders.push({ extra: Math.round(extra), cls: String(el.className).slice(0, 80) });
    }
    offenders.sort((a, b) => b.extra - a.extra);
    return { overflow: doc.scrollWidth - doc.clientWidth, offenders: offenders.slice(0, 5) };
  });
  record(`overflow-${label}`, probe.overflow <= 1 ? 'PASS' : 'FAIL', probe);
}
async function reachCourses(page, calls, label) {
  const identifier = `r8-web-${label}-${suffix}@example.invalid`;
  const userPassword = `Aa1!${randomBytes(12).toString('hex')}`;
  await page.goto('http://127.0.0.1:18180/register', { waitUntil: 'domcontentloaded' });
  const inputs = page.locator('input');
  await inputs.nth(0).fill(identifier);
  await inputs.nth(1).fill(userPassword);
  await inputs.nth(2).fill(userPassword);
  await page.getByRole('button', { name: '注册并继续', exact: true }).click();
  await page.locator('#adult-birth-year').fill('1990', { timeout: 20000 });
  const registerCall = calls.find((call) => String(call.path || '').endsWith('/auth/register'));
  record(`register-${label}`, registerCall && registerCall.origin === 'https://127.0.0.1:18087' && registerCall.status === 201 ? 'PASS' : 'FAIL', { call: registerCall || null });
  await page.getByText('我确认自己已满 18 周岁').click();
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.getByRole('heading', { name: '完成必要同意' }).waitFor({ timeout: 15000 });
  const boxes = page.locator('form input[type=checkbox]');
  for (let index = 0; index < await boxes.count(); index += 1) await boxes.nth(index).check();
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.locator('[data-goal-code]').first().click();
  await page.locator('[data-primary-action=save-target]').click();
  await page.waitForURL(/\/assessment/, { timeout: 20000 });
}
async function reachHome(page, calls, label) {
  const identifier = `r8-h5-${label}-${suffix}@example.invalid`;
  const userPassword = `Aa1!${randomBytes(12).toString('hex')}`;
  const mobile = 'http://127.0.0.1:18183/#/';
  await page.goto(`${mobile}pages/register/register`, { waitUntil: 'domcontentloaded' });
  await page.locator('.yx-field input').nth(0).fill(identifier);
  await page.locator('.yx-field input').nth(1).fill(userPassword);
  await page.locator('.yx-field input').nth(2).fill(userPassword);
  await page.getByRole('button', { name: '注册并继续' }).click();
  await page.locator('.birth-year input').fill('1995', { timeout: 20000 });
  const registerCall = calls.find((call) => String(call.path || '').endsWith('/auth/register'));
  record(`register-${label}`, registerCall && registerCall.origin === 'https://127.0.0.1:18087' && registerCall.status === 201 ? 'PASS' : 'FAIL', { call: registerCall || null });
  await page.locator('.consent').filter({ hasText: '我确认自己已满 18 周岁' }).locator('.uni-checkbox-input, uni-checkbox').first().click();
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.getByText('完成必要同意', { exact: true }).waitFor({ timeout: 20000 });
  await page.waitForFunction(() => {
    const match = (document.body?.innerText || '').match(/已发布版本\s+(\S+)/);
    return Boolean(match && match[1] && match[1] !== '版本未读到');
  }, null, { timeout: 20000 });
  const rows = page.locator('.yx-onboarding-step .consent');
  const rowCount = await rows.count();
  for (let index = 0; index < rowCount; index += 1) {
    const box = rows.nth(index).locator('.uni-checkbox-input, uni-checkbox, input[type=checkbox]').first();
    if (await box.count()) await box.click();
    else await rows.nth(index).click();
  }
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.getByText('选择学习目标', { exact: true }).waitFor({ timeout: 20000 });
  await page.locator('.choice-list .choice').first().click();
  await page.getByRole('button', { name: '15 分钟', exact: true }).click();
  await page.getByRole('button', { name: '保存并开始测评' }).click();
  await page.waitForURL(/assessment/, { timeout: 20000 });
}
async function practiceWeb(page, calls, label) {
  await page.goto('http://127.0.0.1:18180/grammar', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const body = document.body?.innerText || '';
    return Boolean(document.querySelector('.exercise .option')) || body.includes('暂时没有') || body.includes('无法') || body.includes('不可用');
  }, null, { timeout: 25000 }).catch(() => null);
  const option = page.locator('.exercise .option').first();
  if (!(await option.count())) {
    const body = await page.locator('body').innerText();
    record('smoke-it4-practice', 'FAIL', { excerpt: body.slice(0, 240) });
    await shot(page, `grammar-${label}.png`);
    return;
  }
  await option.click();
  await page.getByRole('button', { name: '提交练习', exact: true }).click();
  await page.locator('[data-save-receipt]').waitFor({ timeout: 20000 }).catch(() => null);
  const sessionCall = calls.find((call) => call.method === 'POST' && call.path.includes('/assessment/sessions') && !call.path.includes('/attempts'));
  const attemptCall = calls.find((call) => call.method === 'POST' && call.path.includes('/attempts'));
  const receipt = await page.locator('[data-save-receipt]').innerText().catch(() => '');
  const ok = Boolean(sessionCall && sessionCall.status >= 200 && sessionCall.status < 300 && attemptCall && attemptCall.status >= 200 && attemptCall.status < 300 && receipt.includes('已保存'));
  record('smoke-it4-practice', ok ? 'PASS' : 'FAIL', { session: sessionCall || null, attempt: attemptCall || null, receipt });
  await shot(page, `practice-${label}.png`);
}
async function assertClosureLearner(page, label, mobile) {
  if (mobile) {
    await page.goto(`http://127.0.0.1:18183/#/pages/support/support`, { waitUntil: 'domcontentloaded' });
    await page.getByText('尚未批准').waitFor({ timeout: 20000 });
    await page.getByText('支持编号').waitFor({ timeout: 20000 });
    const support = await page.locator('body').innerText();
    await page.goto(`http://127.0.0.1:18183/#/pages/settings/settings`, { waitUntil: 'domcontentloaded' });
    await page.getByText('隐私与数据').waitFor({ timeout: 20000 });
    await page.getByText('受理不等于数据已经删除').waitFor({ timeout: 20000 });
    const privacy = await page.locator('.it7-closure').innerText();
    const ok = support.includes('尚未批准') && support.includes('支持编号') && support.includes('暂不能提交新工单') && privacy.includes('不会采集长期原始录音') && privacy.includes('可以重新登录') && privacy.includes('不会提示登录继续学习');
    record(`closure-${label}`, ok ? 'PASS' : 'FAIL', { support: support.includes('尚未批准'), privacy: privacy.slice(0, 240) });
  } else {
    await page.goto('http://127.0.0.1:18180/support', { waitUntil: 'domcontentloaded' });
    await page.getByText('尚未批准').waitFor({ timeout: 20000 });
    await page.getByText('支持编号').waitFor({ timeout: 20000 });
    const support = await page.locator('.it7-closure').innerText();
    await page.goto('http://127.0.0.1:18180/settings/privacy', { waitUntil: 'domcontentloaded' });
    await page.getByText('受理不等于数据已经删除').waitFor({ timeout: 20000 });
    const privacy = await page.locator('article').innerText();
    const ok = support.includes('尚未批准') && support.includes('支持编号') && privacy.includes('不会采集长期原始录音') && privacy.includes('可以重新登录') && privacy.includes('不会提示登录继续学习') && !privacy.includes('内部审计');
    record(`closure-${label}`, ok ? 'PASS' : 'FAIL', { support: support.slice(0, 240), privacy: privacy.slice(0, 240) });
  }
  await shot(page, `closure-${label}.png`);
  await measureOverflow(page, label);
}
async function walkLearner(browser, viewport, label, mobile, practice) {
  const calls = [];
  const context = await browser.newContext({ viewport, locale: 'zh-CN' });
  const page = await context.newPage();
  track(page, calls);
  try {
    if (mobile) await reachHome(page, calls, label);
    else await reachCourses(page, calls, label);
    if (practice) await practiceWeb(page, calls, label);
    await assertClosureLearner(page, label, mobile);
  } catch (error) {
    const body = await page.locator('body').innerText().catch(() => '');
    await shot(page, `failure-${label}.png`);
    record(`walk-${label}`, 'FAIL', { error: String(error.message || error), url: page.url(), body: body.slice(0, 400) });
  } finally {
    writeFileSync(join(evidenceDir, `calls-${label}.json`), JSON.stringify(calls, null, 2));
    await context.close();
  }
}
async function spaGo(page, path) {
  await page.evaluate(async (target) => {
    const root = document.querySelector('#app');
    const app = root && root.__vue_app__;
    const router = app && app.config.globalProperties.$router;
    if (!router) throw new Error('NO_ROUTER');
    await router.push(target);
  }, path);
}
async function walkAdmin(browser, accounts) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN' });
  const page = await context.newPage();
  try {
    await page.goto('http://127.0.0.1:18181/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[name=identifier]').fill(accounts.ops.identifier);
    await page.locator('#admin-password').fill(accounts.ops.password);
    await page.getByRole('button', { name: '登录后台' }).click();
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20000 });
    record('admin-login', page.url().includes('/login') ? 'FAIL' : 'PASS', { url: page.url() });
    await spaGo(page, '/governance');
    await page.getByRole('heading', { name: '收口只读' }).waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: '按来源建档' }).click();
    await page.getByText('处置写链没有打开').first().waitFor({ timeout: 20000 });
    const governance = await page.locator('.it7-closure').innerText();
    const newCase = await page.getByRole('button', { name: '新建案件' }).count();
    const triage = await page.getByRole('button', { name: 'TRIAGE', exact: true }).count();
    const evaluate = await page.getByRole('button', { name: '评估规则' }).count();
    const refresh = await page.getByRole('button', { name: '刷新' }).count();
    const refusal = await page.locator('[data-disposition-refusal="true"]').innerText().catch(() => '');
    const governanceOk = governance.includes('收口只读') && governance.includes('处置写链没有打开') && governance.includes('/risk')
      && newCase === 0 && triage === 0 && evaluate === 0 && refresh > 0
      && refusal.includes('旧的风险处置写入口已关闭');
    record('admin-governance', governanceOk ? 'PASS' : 'FAIL', {
      governance: governance.slice(0, 300), newCase, triage, evaluate, refresh, refusal: refusal.slice(0, 180),
    });
    await shot(page, 'admin-governance.png');
    await spaGo(page, '/risk');
    await page.waitForURL(/governance/, { timeout: 15000 });
    const riskBody = await page.locator('.it7-closure').innerText();
    record('admin-risk-redirect', page.url().includes('/governance') && riskBody.includes('收口只读') ? 'PASS' : 'FAIL', { url: page.url() });
    await spaGo(page, '/audit');
    await page.locator('.it7-closure').waitFor({ timeout: 20000 });
    const audit = await page.locator('.it7-closure').innerText();
    record('admin-audit', audit.includes('不能标成已可生产发布') && audit.includes('不能承诺任意数据库变更') && audit.includes('内部审计不提供给学习端') ? 'PASS' : 'FAIL', { audit: audit.slice(0, 300) });
    await shot(page, 'admin-audit.png');
    await measureOverflow(page, 'admin-1280');
  } catch (error) {
    const body = await page.locator('body').innerText().catch(() => '');
    await shot(page, 'failure-admin.png');
    record('walk-admin', 'FAIL', { error: String(error.message || error), url: page.url(), body: body.slice(0, 400) });
  } finally {
    await context.close();
  }
}
function nodeSuite() {
  if (!names.iam[0].startsWith('r8_')) throw new Error('REFUSING_NODE_SCHEMA');
  const output = join('/tmp', `r8-node-${suffix}.log`);
  let text = '';
  let exit = 1;
  try {
    const files = ['apps/mobile/tests', 'apps/learner-web/tests'].flatMap((dir) =>
      readdirSync(join(root, dir)).filter((name) => name.endsWith('.mjs')).map((name) => join(dir, name)));
    text = execFileSync(process.execPath, ['--test', '--test-concurrency=1', ...files], {
      cwd: root, encoding: 'utf8', timeout: 900000, maxBuffer: 20 * 1024 * 1024,
      env: {
        ...process.env,
        SUPPORT_UAT_IAM_SCHEMA: names.iam[0],
        IAM_TEST_CA_PEM: caPemPath,
        NODE_EXTRA_CA_CERTS: caPemPath,
        MOBILE_SUPPORT_UAT_OUTPUT: join('/tmp', `r8-support-uat-${suffix}`),
      },
    });
    exit = 0;
  } catch (error) {
    text = `${error.stdout || ''}\n${error.stderr || ''}`;
    exit = error.status || 1;
  }
  writeFileSync(output, text);
  const tests = [...text.matchAll(/# tests (\d+)/g)].map((item) => Number(item[1])).pop();
  const pass = [...text.matchAll(/# pass (\d+)/g)].map((item) => Number(item[1])).pop();
  const fail = [...text.matchAll(/# fail (\d+)/g)].map((item) => Number(item[1])).pop();
  const ok = exit === 0 && fail === 0 && pass >= 352;
  record('node-suite', ok ? 'PASS' : 'FAIL', { exit, tests, pass, fail, schema: names.iam[0] });
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
function dataOf(body) {
  const parsedBody = typeof body === 'string' ? parsed({ body }) : body;
  if (parsedBody && typeof parsedBody === 'object' && parsedBody.data && typeof parsedBody.data === 'object') return parsedBody.data;
  return null;
}
function leaks(text) {
  const value = String(text ?? '');
  return /correctOption/i.test(value) || /answer_rule/i.test(value) || /"answerRule"/.test(value);
}
function jwtSub(token) {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  return String(payload.sub || '').replace(/[^A-Za-z0-9_.:-]/g, '');
}
function assertR8(schema, label) {
  if (!schema || !schema.startsWith('r8_') || retained.includes(schema)) throw new Error('REFUSING_' + label);
}
function sessionCount(principal) {
  const schema = names.assessment[0];
  assertR8(schema, 'COUNT');
  return Number(sql(`SELECT COUNT(*) FROM \`${schema}\`.p1_placement_session WHERE principal_id='${principal}' AND tenant_id='platform';`));
}
function responseCount(sessionId) {
  const schema = names.assessment[0];
  assertR8(schema, 'RESPONSES');
  const id = String(sessionId).replaceAll("'", '');
  return Number(sql(`SELECT COUNT(*) FROM \`${schema}\`.p1_placement_response WHERE session_id='${id}';`));
}
function answerKey(itemId) {
  const schema = names.content[0];
  assertR8(schema, 'ANSWER');
  return sql(`SELECT JSON_UNQUOTE(JSON_EXTRACT(answer_rule_json, '$.correctOption')) FROM \`${schema}\`.content_placement_item WHERE placement_item_id=${Number(itemId)};`);
}
function sharedAdminMarker() {
  const desk = sql("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='admin_ops_service' AND table_name='it7_closure_desk';");
  const history = sql("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='admin_ops_service' AND table_name='flyway_schema_history';");
  return `${desk}|${history}`;
}
let tlsMaterial = null;

async function waitPortsFree() {
  const deadline = Date.now() + 20000;
  let occupied = [];
  while (Date.now() < deadline) {
    occupied = Object.entries(ports).filter(([, port]) => listeners(port).trim());
    if (!occupied.length) return;
    await sleep(400);
  }
  throw new Error('PORTS_STILL_BUSY ' + JSON.stringify(occupied));
}
function salvageLogs(dir) {
  mkdirSync(join(dir, 'logs'), { recursive: true });
  for (const name of ['iam-service', 'learner-service', 'content-service', 'assessment-service', 'learning-service', 'admin-ops-service', 'api-gateway', 'learner-web', 'mobile-h5', 'admin-web']) {
    try {
      const text = readFileSync(join(directory, name + '.log'), 'utf8').replace(/(password|secret|token)[=:][^\s,]+/gi, '$1=[redacted]');
      writeFileSync(join(dir, 'logs', name + '.log'), text.slice(-200000));
    } catch { /* missing */ }
  }
}
async function shutdownPhase() {
  await stopAll();
  children.length = 0;
  stackUp = false;
  try { await waitPortsFree(); }
  catch (error) { record('ports-released', 'FAIL', { error: String(error.message || error) }); }
  try {
    dropSchemas();
    record('schemas-dropped', 'PASS', { suffix, schemas: names ? Object.values(names).map((pair) => pair[0]) : [] });
  } catch (error) {
    record('schemas-dropped', 'FAIL', { error: String(error.message || error) });
  }
}

async function boot(options) {
  const occupied = Object.entries(ports).filter(([, port]) => listeners(port).trim());
  record('ports-free', occupied.length === 0 ? 'PASS' : 'FAIL', { occupied });
  if (occupied.length) throw new Error('PORTS');
  const partialRevokes = sql('SELECT @@GLOBAL.partial_revokes;') === '1';
  const dbPassword = randomBytes(18).toString('hex');
  for (const [schema, user] of Object.values(names)) {
    if (retained.includes(schema) || !schema.startsWith('r8_')) throw new Error('REFUSING_TO_TOUCH_RETAINED_SCHEMA');
    sql(`CREATE DATABASE \`${schema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER '${user}'@'%' IDENTIFIED BY '${dbPassword}'; GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,DROP,INDEX,REFERENCES ON ${grantScope(schema, partialRevokes)} TO '${user}'@'%';`);
  }
  record('dedicated-schemas', 'PASS', Object.fromEntries(Object.entries(names).map(([key, value]) => [key, value[0]])));
  if (options.adminV1) applyAdminV1();
  if (!tlsMaterial) tlsMaterial = prepareIamTls({ directory });
  tlsCa = readFileSync(tlsMaterial.caPem);
  caPemPath = tlsMaterial.caPem;
  const signer = readFileSync(tlsMaterial.signerPem, 'utf8');
  const scoreToken = serviceToken(signer);
  const trustArgs = [
    `-Djavax.net.ssl.trustStore=${tlsMaterial.trustStore}`,
    '-Djavax.net.ssl.trustStoreType=PKCS12',
    `-Djavax.net.ssl.trustStorePassword=${tlsMaterial.truststorePassword}`,
    '-Dio.netty.handler.ssl.noOpenSsl=true',
  ];
  const iamConfig = join(directory, 'iam.properties');
  writeFileSync(iamConfig, [
    'server.address=127.0.0.1', 'server.port=18087', 'server.ssl.enabled=true',
    'server.ssl.key-store-type=PKCS12', `server.ssl.key-alias=${tlsMaterial.keyAlias}`,
    'server.ssl.key-store=' + tlsMaterial.keyStore,
    'server.ssl.key-store-password=' + tlsMaterial.keystorePassword,
    'iam.persistence.enabled=true', 'spring.flyway.enabled=true',
    'iam.persistence.jdbc-url=' + jdbc(names.iam[0]),
    'iam.persistence.schema=' + names.iam[0],
    'iam.persistence.username=' + names.iam[1],
    'iam.persistence.password=' + dbPassword,
    'iam.idempotency.v13-writers-drained=true',
    'iam.idempotency.replay-secret=' + randomBytes(32).toString('base64url'),
    'iam.idempotency.fingerprint-secret=' + randomBytes(32).toString('base64url'),
    'iam.jwt.private-key-file=' + tlsMaterial.signerPem,
    'iam.jwt.ephemeral-keys-allowed=false', 'iam.jwt.refresh-cookie-secure=true',
    'iam.jwt.issuer=' + issuer, 'iam.jwt.key-id=iam-local-2026-08',
    'iam.consent.policy-source=local-candidate', 'iam.local-adult-gate-enabled=true',
  ].join('\n') + '\n', { mode: 0o600 });
  const clientSecret = randomBytes(24).toString('hex');
  const clientDigest = createHash('sha256').update(clientSecret).digest('hex');
  const iam = startJava('iam-service', [
    '-Dfile.encoding=UTF-8', '-jar', jar('iam-service'),
    '--spring.profiles.active=local', '--spring.config.import=' + pathToFileURL(iamConfig).href,
    '--iam.jwt.ephemeral-keys-allowed=false',
    '--management.otlp.metrics.export.enabled=false', '--management.opentelemetry.enabled=false',
  ], { IAM_SERVICE_CLIENT_LEARNER_SECRET_DIGEST: clientDigest });
  await waitHealth(iam, () => request({ port: ports.iam, path: '/actuator/health', https: true }), 'IAM');
  record('iam-https', 'PASS', { spki: certificateSpkiHash(tlsMaterial.caPem), schema: names.iam[0] });
  const commonSecurity = { IAM_JWT_ISSUER: issuer, IAM_JWT_JWKS_URI: jwks, IAM_JWT_AUDIENCE: audience };
  runtime = { trustArgs, commonSecurity, dbPassword, accounts: null, simpleDigest: null, closureDigest: null };
  const content = startContent();
  await waitHealth(content, () => request({ port: ports.content, path: '/actuator/health' }), 'CONTENT');
  const learner = startJava('learner-service', [
    ...trustArgs, '-jar', jar('learner-service'),
  ], {
    ...commonSecurity, LEARNER_PERSISTENCE_MODE: 'jdbc', LEARNER_FLYWAY_ENABLED: 'true',
    LEARNER_SCHEMA: names.learner[0], LEARNER_JDBC_URL: jdbc(names.learner[0]),
    LEARNER_JDBC_USERNAME: names.learner[1], LEARNER_JDBC_PASSWORD: dbPassword,
    LEARNER_SERVICE_PORT: '18088', SERVER_ADDRESS: '127.0.0.1',
    LEARNER_SECURITY_ISSUER_URI: issuer, LEARNER_SECURITY_JWK_SET_URI: jwks, LEARNER_SECURITY_AUDIENCE: audience,
    LEARNER_CONSENT_RECHECK_ENABLED: 'true', LEARNER_CONSENT_RECHECK_IAM_BASE_URL: 'https://127.0.0.1:18087',
    LEARNER_CONSENT_RECHECK_CLIENT_ID: 'learner-service', LEARNER_CONSENT_RECHECK_CLIENT_SECRET: clientSecret,
  });
  await waitHealth(learner, () => request({ port: ports.learner, path: '/actuator/health' }), 'LEARNER');
  const assessment = startJava('assessment-service', [
    ...trustArgs, '-jar', jar('assessment-service'),
  ], {
    ...commonSecurity, ASSESSMENT_PERSISTENCE_ENABLED: 'true', ASSESSMENT_FLYWAY_ENABLED: 'true',
    ASSESSMENT_SCHEMA: names.assessment[0], ASSESSMENT_DB_URL: jdbc(names.assessment[0]),
    ASSESSMENT_DB_USERNAME: names.assessment[1], ASSESSMENT_DB_PASSWORD: dbPassword,
    ASSESSMENT_SERVICE_PORT: '18091', ASSESSMENT_SERVICE_SERVER_ADDRESS: '127.0.0.1',
    ASSESSMENT_SECURITY_ISSUER_URI: issuer, ASSESSMENT_SECURITY_JWK_SET_URI: jwks, ASSESSMENT_SECURITY_AUDIENCE: audience,
    ASSESSMENT_PLACEMENT_BANK_CONTENT_BASE_URL: 'http://127.0.0.1:18089',
    ASSESSMENT_PLACEMENT_BANK_LEARNER_BASE_URL: 'http://127.0.0.1:18088',
    ASSESSMENT_PLACEMENT_SCORE_CONTENT_BASE_URL: 'http://127.0.0.1:18089',
    ASSESSMENT_PLACEMENT_SCORE_SERVICE_TOKEN: scoreToken,
  });
  await waitHealth(assessment, () => request({ port: ports.assessment, path: '/actuator/health' }), 'ASSESSMENT');
  if (options.learning) {
    const learning = startJava('learning-service', [
      ...trustArgs, '-jar', jar('learning-service'),
    ], {
      ...commonSecurity, LEARNING_PERSISTENCE_MODE: 'jdbc', LEARNING_FLYWAY_ENABLED: 'true',
      LEARNING_SCHEMA: names.learning[0], LEARNING_JDBC_URL: jdbc(names.learning[0]),
      LEARNING_JDBC_USERNAME: names.learning[1], LEARNING_JDBC_PASSWORD: dbPassword,
      LEARNING_SERVICE_PORT: '18090', LEARNING_SERVICE_SERVER_ADDRESS: '127.0.0.1',
      LEARNING_SECURITY_ISSUER_URI: issuer, LEARNING_SECURITY_JWK_SET_URI: jwks, LEARNING_SECURITY_AUDIENCE: audience,
      LEARNING_RESOURCE_SERVER_ENABLED: 'true', LEARNING_PORTS_MODE: 'http', LEARNING_EVENT_RELAY_ENABLED: 'false',
      LEARNING_PORTS_LEARNER_BASE_URL: 'http://127.0.0.1:18088',
      LEARNING_PORTS_CONTENT_BASE_URL: 'http://127.0.0.1:18089',
      LEARNING_PORTS_ASSESSMENT_BASE_URL: 'http://127.0.0.1:18091',
    });
    await waitHealth(learning, () => request({ port: ports.learning, path: '/actuator/health' }), 'LEARNING');
  }
  if (options.admin) {
    const admin = startAdmin();
    await waitHealth(admin, () => request({ port: ports.admin, path: '/actuator/health' }), 'ADMIN');
  }
  const gateway = startJava('api-gateway', [
    ...trustArgs, '-jar', jar('api-gateway'),
  ], {
    ...commonSecurity, SPRING_PROFILES_ACTIVE: 'local', API_GATEWAY_PORT: '18070', SERVER_ADDRESS: '127.0.0.1',
    ASSESSMENT_SERVICE_BASE_URL: 'http://127.0.0.1:18091', LEARNER_SERVICE_BASE_URL: 'http://127.0.0.1:18088',
    CONTENT_SERVICE_BASE_URL: 'http://127.0.0.1:18089', IAM_SERVICE_BASE_URL: 'https://127.0.0.1:18087',
    LEARNING_SERVICE_BASE_URL: 'http://127.0.0.1:18090', ADMIN_OPS_SERVICE_BASE_URL: 'http://127.0.0.1:18097',
    GATEWAY_RATE_LIMIT_BACKEND: 'memory', GATEWAY_RATE_LIMIT_HIGH_RISK_ADMIN_REQUESTS: '2000',
  });
  await waitHealth(gateway, () => request({ port: ports.gateway, path: '/actuator/health' }), 'GATEWAY');
  if (options.frontends.includes('web')) {
    const web = startNode('learner-web', ['--filter', '@englishflow/learner-web', 'dev']);
    await waitHealth(web, () => request({ port: ports.web, path: '/', accept: 'text/html' }), 'WEB');
  }
  if (options.frontends.includes('mobile')) {
    const mobile = startNode('mobile-h5', ['--filter', '@englishflow/mobile', 'dev:h5']);
    await waitHealth(mobile, () => request({ port: ports.mobile, path: '/', accept: 'text/html' }), 'MOBILE');
  }
  if (options.frontends.includes('admin')) {
    const adminWeb = startNode('admin-web', ['--filter', '@englishflow/admin-web', 'dev']);
    await waitHealth(adminWeb, () => request({ port: ports.adminWeb, path: '/', accept: 'text/html' }), 'ADMIN_WEB');
  }
  stackUp = true;
  const password = `Aa1!${randomBytes(12).toString('hex')}`;
  const specs = {
    ops: 'content:write,content:publish,admin.content.read,admin.content.write,admin.dashboard.read,iam.policy.read,admin.risk.read,admin.moderation.read,admin.audit.read,audit.export,admin.support.read',
    learner: 'learner.home.read',
    other: 'learner.home.read',
  };
  const accounts = {};
  for (const role of options.roles) {
    const identifier = `r8-${role}-${suffix}@example.invalid`;
    const registered = await registerApi(identifier, password);
    if (!registered.token) throw new Error('REGISTER_' + role + ' ' + registered.status + ' ' + (registered.error || ''));
    grant(identifier, specs[role]);
    const qualified = await qualifyLearner(registered.token);
    if (!qualified.ok) throw new Error('QUALIFY_' + role + ' ' + qualified.detail);
    const logged = await loginApi(identifier, password);
    if (!logged.token) throw new Error('LOGIN_' + role);
    accounts[role] = { identifier, password, token: logged.token };
  }
  runtime.accounts = accounts;
  record('staff-sessions', 'PASS', { roles: Object.keys(accounts) });
  return accounts;
}

async function openSession(token, key) {
  return request({
    port: ports.gateway, method: 'POST', path: '/api/v1/assessment/placement/sessions', token,
    headers: { 'Idempotency-Key': key },
  });
}
async function readSession(token, sessionId) {
  return request({
    port: ports.gateway, path: `/api/v1/assessment/placement/sessions/${sessionId}`, token,
  });
}
async function submitPlacement(token, sessionId, sequence, itemId, option, key, expectedVersion) {
  const candidateResponse = { responseType: 'CHOICE', selectedOptionIds: [option] };
  const responseDigest = sha256(JSON.stringify([sessionId, itemId, sequence, candidateResponse]));
  return request({
    port: ports.gateway, method: 'POST',
    path: `/api/v1/assessment/placement/sessions/${sessionId}/responses`, token,
    headers: { 'Idempotency-Key': key },
    body: { expectedStateVersion: expectedVersion, itemId, itemSequence: sequence, candidateResponse, responseDigest, timeSpentSec: 4 },
  });
}
function responseCommand(sessionId, sequence, itemId, option, expectedVersion) {
  const candidateResponse = { responseType: 'CHOICE', selectedOptionIds: [option] };
  return {
    expectedStateVersion: expectedVersion, itemId, itemSequence: sequence, candidateResponse,
    responseDigest: sha256(JSON.stringify([sessionId, itemId, sequence, candidateResponse])),
    timeSpentSec: 4,
  };
}
function dropResponse(token, sessionId, body, key) {
  const payload = Buffer.from(JSON.stringify(body));
  return new Promise((resolve) => {
    const req = http.request({
      host: '127.0.0.1', port: ports.gateway,
      path: `/api/v1/assessment/placement/sessions/${sessionId}/responses`, method: 'POST',
      headers: {
        accept: 'application/json', authorization: 'Bearer ' + token, 'content-type': 'application/json',
        'content-length': String(payload.length), 'Idempotency-Key': key,
      },
    }, () => { req.destroy(); resolve('headers-then-destroyed'); });
    req.on('error', () => resolve('destroyed'));
    req.end(payload);
    setTimeout(() => { try { req.destroy(); } catch { /* already closed */ } }, 25);
  });
}

async function runIt2Api() {
  const owners = [names.learner[0], names.content[0], names.assessment[0]];
  const distinct = new Set(owners).size === 3 && owners.every((schema) => schema.startsWith('r8_') && schema !== names.iam[0]);
  record('it2-three-owner-schemas', distinct ? 'PASS' : 'FAIL', {
    iam: names.iam[0], learner: names.learner[0], content: names.content[0], assessment: names.assessment[0],
    domainOwners: ['learner', 'content', 'assessment'], signer: 'iam-rs256',
  });
  const bank = Number(sql(`SELECT COUNT(*) FROM \`${names.content[0]}\`.content_placement_item WHERE bank_code='P1_PLACEMENT_V1';`));
  record('it2-bank', bank === 10 ? 'PASS' : 'FAIL', { bank });
  const identifier = `r8-place-${suffix}@example.invalid`;
  const password = `Aa1!${randomBytes(12).toString('hex')}`;
  const registered = await registerApi(identifier, password);
  if (!registered.token) throw new Error('REGISTER_PLACE ' + registered.status);
  grant(identifier, 'learner.home.read');
  const subject = jwtSub(registered.token);
  const beforeGate = sessionCount(subject);
  const denied = await openSession(registered.token, `r8-gate-${suffix}`);
  const afterGate = sessionCount(subject);
  record('it2-gate-closed', denied.status === 403 && beforeGate === 0 && afterGate === 0 ? 'PASS' : 'FAIL', {
    status: denied.status, sessions: afterGate, excerpt: denied.body.slice(0, 240),
  });
  const qualified = await qualifyLearner(registered.token);
  record('it2-adult-gate', qualified.ok ? 'PASS' : 'FAIL', { detail: qualified.detail });
  if (!qualified.ok) throw new Error('QUALIFY_PLACE');
  const logged = await loginApi(identifier, password);
  if (!logged.token) throw new Error('LOGIN_PLACE');
  const token = logged.token;
  const target = await request({
    port: ports.gateway, method: 'PUT', path: '/api/v1/learner/targets', token,
    headers: { 'Idempotency-Key': idemKey() },
    body: { expectedStateVersion: 0, goalCode: 'ZERO_BASIS', targetLevel: 'A1', dailyQuotaMinutes: 15, status: 'ACTIVE' },
  });
  record('it2-target', target.status >= 200 && target.status < 300 ? 'PASS' : 'FAIL', { status: target.status, excerpt: target.body.slice(0, 180) });
  const opened = await openSession(token, `r8-open-${suffix}`);
  const openedData = dataOf(opened.body);
  const items = openedData && Array.isArray(openedData.items) ? [...openedData.items].sort((a, b) => Number(a.displayOrder) - Number(b.displayOrder)) : [];
  const openOk = opened.status === 201 && items.length === 10
    && items.every((item) => item.stem && Array.isArray(item.options) && item.options.length > 0)
    && Number(openedData.acceptedSequence) === 0 && !leaks(opened.body);
  record('it2-open-10', openOk ? 'PASS' : 'FAIL', {
    status: opened.status, items: items.length, leaks: leaks(opened.body), excerpt: openOk ? undefined : opened.body.slice(0, 400),
  });
  if (!openOk) throw new Error('OPEN');
  const sessionId = openedData.sessionId;
  let version = Number(openedData.stateVersion);
  const ahead = await submitPlacement(token, sessionId, 2, items[1].itemId, 'a', `r8-ahead-${suffix}`, version);
  const aheadRead = dataOf((await readSession(token, sessionId)).body);
  const aheadOk = ahead.status === 409 && Number(aheadRead.acceptedSequence) === 0 && responseCount(sessionId) === 0;
  record('it2-out-of-order', aheadOk ? 'PASS' : 'FAIL', { status: ahead.status, responses: responseCount(sessionId) });
  if (!aheadOk) throw new Error('AHEAD');
  const correct = answerKey(items[0].itemId);
  const first = await submitPlacement(token, sessionId, 1, items[0].itemId, correct, `r8-full-${suffix}`, version);
  const firstData = dataOf(first.body);
  const firstOk = first.status === 200 && firstData && firstData.outcome === 'FULL' && Number(firstData.acceptedSequence) === 1 && !leaks(first.body);
  record('it2-correct-full', firstOk ? 'PASS' : 'FAIL', { status: first.status, outcome: firstData && firstData.outcome, leaks: leaks(first.body) });
  if (!firstOk) throw new Error('FULL');
  version = Number(firstData.stateVersion);
  const secondCorrect = answerKey(items[1].itemId);
  const secondOption = secondCorrect === 'a' ? 'b' : 'a';
  const second = await submitPlacement(token, sessionId, 2, items[1].itemId, secondOption, `r8-zero-${suffix}`, version);
  const secondData = dataOf(second.body);
  const secondOk = second.status === 200 && secondData && secondData.outcome === 'ZERO' && Number(secondData.acceptedSequence) === 2 && !leaks(second.body);
  record('it2-wrong-zero', secondOk ? 'PASS' : 'FAIL', { status: second.status, outcome: secondData && secondData.outcome });
  if (!secondOk) throw new Error('ZERO');
  version = Number(secondData.stateVersion);
  let tenth = secondData;
  for (let index = 2; index < 10; index += 1) {
    const wanted = answerKey(items[index].itemId);
    const option = index % 2 === 0 ? wanted : (wanted === 'a' ? 'b' : 'a');
    const sent = await submitPlacement(token, sessionId, index + 1, items[index].itemId, option, `r8-ans-${suffix}-${index + 1}`, version);
    const sentData = dataOf(sent.body);
    const expect = option === wanted ? 'FULL' : 'ZERO';
    if (sent.status !== 200 || !sentData || sentData.outcome !== expect || leaks(sent.body)) {
      record('it2-ten-report', 'FAIL', { index: index + 1, status: sent.status, outcome: sentData && sentData.outcome, expect, excerpt: sent.body.slice(0, 300) });
      throw new Error('SCORE');
    }
    version = Number(sentData.stateVersion);
    tenth = sentData;
  }
  const report = tenth.report || null;
  const reportId = report && report.reportId;
  const digest = report && report.digest;
  const doneOk = Number(tenth.acceptedSequence) === 10 && tenth.status === 'COMPLETED' && reportId && /^[a-f0-9]{64}$/.test(digest) && !leaks(JSON.stringify(tenth));
  record('it2-ten-report', doneOk ? 'PASS' : 'FAIL', { acceptedSequence: tenth.acceptedSequence, status: tenth.status, reportId, digest });
  if (!doneOk) throw new Error('REPORT');
  const read1 = await request({ port: ports.gateway, path: `/api/v1/assessment/placement/reports/${reportId}`, token });
  const read2 = await request({ port: ports.gateway, path: `/api/v1/assessment/placement/reports/${reportId}`, token });
  const same = read1.status === 200 && read2.status === 200 && read1.body === read2.body && dataOf(read1.body) && dataOf(read1.body).digest === digest && !leaks(read1.body);
  record('it2-report-reread', same ? 'PASS' : 'FAIL', { first: read1.status, second: read2.status, sameBody: read1.body === read2.body });
  if (!same) throw new Error('REREAD');
  const beforeInternal = sessionCount(subject);
  const internal = await request({
    port: ports.assessment, method: 'POST',
    path: `/internal/v1/assessment/placement/sessions/${sessionId}/retest`, token,
    headers: { 'Idempotency-Key': `r8-retest-internal-${suffix}` },
  });
  const internalData = dataOf(internal.body);
  const internalOk = internal.status === 201 && internalData && internalData.sessionId && internalData.sessionId !== sessionId
    && Number(internalData.acceptedSequence) === 0 && !leaks(internal.body) && sessionCount(subject) === beforeInternal + 1;
  record('it2-internal-retest', internalOk ? 'PASS' : 'FAIL', { status: internal.status, newSession: internalData && internalData.sessionId, excerpt: internalOk ? undefined : internal.body.slice(0, 300) });
  if (!internalOk) throw new Error('INTERNAL_RETEST');
  const beforePublic = sessionCount(subject);
  const publicRetest = await request({
    port: ports.gateway, method: 'POST',
    path: `/api/v1/assessment/placement/sessions/${sessionId}/retest`, token,
    headers: { 'Idempotency-Key': `r8-retest-public-${suffix}` }, body: {},
  });
  const publicData = dataOf(publicRetest.body);
  const publicOld = dataOf((await request({ port: ports.gateway, path: `/api/v1/assessment/placement/reports/${reportId}`, token })).body);
  const publicOk = publicRetest.status === 201 && publicData && publicData.sessionId
    && publicData.sessionId !== sessionId && publicData.sessionId !== internalData.sessionId
    && Number(publicData.acceptedSequence) === 0 && !leaks(publicRetest.body)
    && publicOld && publicOld.digest === digest && sessionCount(subject) === beforePublic + 1;
  record('it2-public-retest', publicOk ? 'PASS' : 'FAIL', { status: publicRetest.status, newSession: publicData && publicData.sessionId, excerpt: publicOk ? undefined : publicRetest.body.slice(0, 300) });
  if (!publicOk) throw new Error('PUBLIC_RETEST');
  for (const retiredPath of ['/api/v1/assessment/placement/submit-step', '/api/v1/assessment/placement/skip']) {
    const beforeRetired = sessionCount(subject);
    const retired = await request({
      port: ports.gateway, method: 'POST', path: retiredPath, token,
      headers: { 'Idempotency-Key': idemKey() }, body: {},
    });
    const retiredBody = parsed(retired);
    const retiredOk = retired.status === 404 && retiredBody && retiredBody.error && retiredBody.error.errorCode === 'NOT_FOUND' && sessionCount(subject) === beforeRetired;
    record('it2-retired-' + retiredPath.split('/').pop(), retiredOk ? 'PASS' : 'FAIL', {
      status: retired.status, errorCode: retiredBody && retiredBody.error && retiredBody.error.errorCode, excerpt: retiredOk ? undefined : retired.body.slice(0, 240),
    });
    if (!retiredOk) throw new Error('RETIRED');
  }
  const interruptVersion = Number(internalData.stateVersion);
  const interruptBody = responseCommand(internalData.sessionId, 1, items[0].itemId, answerKey(items[0].itemId), interruptVersion);
  const droppedCall = await dropResponse(token, internalData.sessionId, interruptBody, `r8-drop-${suffix}`);
  await sleep(500);
  const checkpointRead = dataOf((await readSession(token, internalData.sessionId)).body);
  const restoredSeq = Number(checkpointRead && checkpointRead.acceptedSequence);
  let interruptOk = false;
  let resumeStatus = null;
  if (restoredSeq === 0 && Number(checkpointRead.stateVersion) === interruptVersion) {
    const resumed = await request({
      port: ports.gateway, method: 'POST',
      path: `/api/v1/assessment/placement/sessions/${internalData.sessionId}/responses`, token,
      headers: { 'Idempotency-Key': `r8-resume-${suffix}` }, body: interruptBody,
    });
    resumeStatus = resumed.status;
    const resumeData = dataOf(resumed.body);
    interruptOk = resumed.status === 200 && resumeData && Number(resumeData.acceptedSequence) === 1 && !leaks(resumed.body);
  } else if (restoredSeq === 1) {
    const replay = await request({
      port: ports.gateway, method: 'POST',
      path: `/api/v1/assessment/placement/sessions/${internalData.sessionId}/responses`, token,
      headers: { 'Idempotency-Key': `r8-drop-${suffix}` }, body: interruptBody,
    });
    resumeStatus = replay.status;
    const replayData = dataOf(replay.body);
    interruptOk = replay.status === 200 && replayData && Number(replayData.acceptedSequence) === 1 && !leaks(replay.body);
  }
  record('it2-interrupt', interruptOk ? 'PASS' : 'FAIL', { dropped: droppedCall, restoredSequence: restoredSeq, resumeStatus });
  if (!interruptOk) throw new Error('INTERRUPT');
  const beforeIncomplete = sessionCount(subject);
  const incomplete = await request({
    port: ports.assessment, method: 'POST',
    path: `/internal/v1/assessment/placement/sessions/${internalData.sessionId}/retest`, token,
    headers: { 'Idempotency-Key': `r8-incomplete-${suffix}` },
  });
  record('it2-incomplete-retest', incomplete.status === 409 && sessionCount(subject) === beforeIncomplete ? 'PASS' : 'FAIL', {
    status: incomplete.status, sessions: sessionCount(subject),
  });
}

async function answerOne(page) {
  const option = page.locator('.option').first();
  await option.waitFor({ timeout: 25000 });
  const stepText = await page.locator('.question-meta').innerText().catch(() => '');
  await option.click();
  await page.getByRole('button', { name: '提交答案' }).click();
  await page.waitForFunction((previous) => {
    const body = document.body?.innerText || '';
    if (body.includes('报告已生成')) return true;
    const meta = document.querySelector('.question-meta')?.textContent || '';
    return Boolean(meta) && meta !== previous;
  }, stepText, { timeout: 25000 });
}
async function answerRest(page) {
  for (let index = 0; index < 12; index += 1) {
    if (await page.getByText('报告已生成').count()) return true;
    await answerOne(page);
  }
  return (await page.getByText('报告已生成').count()) > 0;
}
async function placementFlow(page, calls, label) {
  const optionReady = page.locator('.option').first();
  const begin = page.getByRole('button', { name: '开始', exact: true });
  await Promise.race([
    optionReady.waitFor({ state: 'visible', timeout: 20000 }),
    begin.waitFor({ state: 'visible', timeout: 20000 }),
  ]).catch(() => null);
  if (await begin.isVisible().catch(() => false) && !(await optionReady.isVisible().catch(() => false))) await begin.click();
  await answerOne(page);
  await page.getByText('服务端已接收 1 题').waitFor({ timeout: 20000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('服务端已接收 1 题').waitFor({ timeout: 25000 });
  const resumed = (await page.locator('body').innerText()).includes('服务端已接收 1 题');
  const rest = await answerRest(page);
  const body = await page.locator('body').innerText();
  const counted = /答对 \d+ 题，共 10 题/.test(body);
  const before = calls.length;
  await page.getByRole('button', { name: '重测', exact: true }).click();
  await page.getByText('第 1 题，共 10 题').waitFor({ timeout: 25000 });
  const retestCall = calls.slice(before).reverse().find((call) => call.method === 'POST' && String(call.path).includes('/retest'));
  const ok = resumed && rest && body.includes('报告已生成') && counted && !body.includes('correctOption') && retestCall && retestCall.status === 201;
  record(`it2-browser-${label}`, ok ? 'PASS' : 'FAIL', {
    resumed, counted, report: body.includes('报告已生成'), retest: retestCall || null,
  });
  await shot(page, `placement-${label}.png`);
  await measureOverflow(page, `it2-${label}`);
}
async function walkPlacement(browser, viewport, label, mobile) {
  const calls = [];
  const context = await browser.newContext({ viewport, locale: 'zh-CN' });
  const page = await context.newPage();
  track(page, calls);
  try {
    if (mobile) await reachHome(page, calls, label);
    else await reachCourses(page, calls, label);
    await placementFlow(page, calls, label);
  } catch (error) {
    const body = await page.locator('body').innerText().catch(() => '');
    await shot(page, `failure-${label}.png`);
    if (!steps.some((step) => step.name === `it2-browser-${label}`)) {
      record(`it2-browser-${label}`, 'FAIL', { error: String(error.message || error), url: page.url(), body: body.slice(0, 400) });
    }
  } finally {
    writeFileSync(join(evidenceDir, `calls-${label}.json`), JSON.stringify(calls, null, 2));
    await context.close();
  }
}
async function runIt2Browser() {
  const browser = await chromium.launch({
    headless: true, channel: 'chrome',
    args: [`--ignore-certificate-errors-spki-list=${certificateSpkiHash(tlsMaterial.caPem)}`],
  });
  try {
    await walkPlacement(browser, { width: 1280, height: 900 }, 'web-1280', false);
    await walkPlacement(browser, { width: 390, height: 844 }, 'web-390', false);
    await walkPlacement(browser, { width: 390, height: 844 }, 'h5-390', true);
    await walkPlacement(browser, { width: 1280, height: 900 }, 'h5-1280', true);
  } finally {
    await browser.close();
  }
}

async function runPhase(tag, keys, dir, bucketList, fn, dropBuckets) {
  evidenceDir = dir;
  buckets = [...bucketList];
  bindNames(tag, keys);
  dropped = false;
  try {
    await fn();
  } catch (error) {
    record('stack', 'FAIL', { error: String(error.stack || error.message || error).slice(0, 800) });
  } finally {
    const failed = steps.some((step) => step.status === 'FAIL' && step.buckets.some((bucket) => bucketList.includes(bucket) || (dropBuckets || []).includes(bucket)));
    if (failed) salvageLogs(dir);
    buckets = [...(dropBuckets || bucketList)];
    await shutdownPhase();
  }
}

function selected(bucket) {
  return steps.filter((step) => step.buckets.includes(bucket));
}
function absent(bucket, required) {
  return required.filter((name) => !steps.some((step) => step.buckets.includes(bucket) && step.name === name && step.status === 'PASS'));
}
function writePack(dir, title, kind, bucket, required, prose, outboundKey) {
  const rows = selected(bucket);
  const failed = rows.filter((step) => step.status === 'FAIL').map((step) => step.name);
  const missing = absent(bucket, required);
  const summary = failed.length === 0 && missing.length === 0 ? 'PASS' : 'FAIL';
  const gap = summary === 'PASS'
    ? '本文件不是签收。lunaStamp 仍是 false。GAP-WALL-114 仍是 OPEN。R1-029 的 NOT_RUN 没有改写。'
    : '剩余 GAP：' + [...failed, ...missing.map((name) => name + '（缺少 PASS）')].join('、') + '。本文件不是签收。';
  const body = {
    kind, summary, accepted: false, lunaStamp: false, suffix,
    [outboundKey]: false,
    chain: summary, missing, failed, dbFacts,
    steps: rows.map((step) => ({ name: step.name, status: step.status })),
  };
  writeFileSync(join(dir, 'summary.json'), JSON.stringify(body, null, 2));
  writeFileSync(join(dir, 'report.md'), [
    `# ${title}`,
    '',
    `日期：2026-10-11。结论：${summary}。\`accepted\` / \`${outboundKey}\` / \`lunaStamp\` 都是 false。`,
    '',
    prose,
    '',
    gap,
    '',
    '| 步骤 | 结果 |',
    '|---|---|',
    ...rows.map((step) => `| ${step.name} | ${step.status} |`),
    '',
  ].join('\n'));
}

const it2Required = [
  'it2-three-owner-schemas', 'it2-bank', 'it2-gate-closed', 'it2-adult-gate', 'it2-target', 'it2-open-10',
  'it2-out-of-order', 'it2-correct-full', 'it2-wrong-zero', 'it2-ten-report', 'it2-report-reread',
  'it2-internal-retest', 'it2-public-retest', 'it2-retired-submit-step', 'it2-retired-skip', 'it2-interrupt',
  'it2-incomplete-retest', 'it2-browser-web-1280', 'it2-browser-web-390', 'it2-browser-h5-390', 'it2-browser-h5-1280',
  'schemas-dropped',
];
const it7Required = ['it7-flyway', 'restart-fingerprint', 'admin-governance', 'schemas-dropped'];
const chainRequired = [
  'smoke-it1-target', 'smoke-it2-placement', 'smoke-it3-daily-task', 'smoke-it4-practice', 'smoke-it5-period',
  'smoke-it6-release', 'smoke-it6-replay', 'restart-fingerprint', 'admin-governance',
  'closure-web-1280', 'closure-web-390', 'closure-h5-390', 'closure-h5-1280', 'node-suite', 'schemas-dropped',
];

try {
  qidaBefore = qidaNames();
  const markerBefore = sharedAdminMarker();
  const only = process.env.R8_PHASE || 'all';
  if (only !== 'chain') await runPhase('it2', ['iam', 'learner', 'content', 'assessment'], it2Dir, ['it2'], async () => {
    dbFacts.it2 = Object.fromEntries(Object.entries(names).map(([key, value]) => [key, value[0]]));
    const accounts = await boot({
      learning: false, admin: false, adminV1: false, frontends: ['web', 'mobile'], roles: ['learner'],
    });
    void accounts;
    await runIt2Api();
    await runIt2Browser();
  });
  if (only !== 'it2') await runPhase('chain', ['iam', 'learner', 'content', 'assessment', 'learning', 'admin'], chainDir, ['chain'], async () => {
    dbFacts.chain = Object.fromEntries(Object.entries(names).map(([key, value]) => [key, value[0]]));
    const accounts = await boot({
      learning: true, admin: true, adminV1: true, frontends: ['web', 'mobile', 'admin'], roles: ['ops', 'learner', 'other'],
    });
    const versions = sql(`SELECT IFNULL(GROUP_CONCAT(version ORDER BY installed_rank), '') FROM \`${names.admin[0]}\`.flyway_schema_history WHERE success=1;`);
    buckets = ['it7', 'chain'];
    record('it7-flyway', versions.split(',').includes('7') ? 'PASS' : 'FAIL', { versions, schema: names.admin[0], desk: 'jdbc-flyway' });
    buckets = ['chain'];
    await smokeStations(accounts);
    buckets = ['it7', 'chain'];
    runtime.closureDigest = await closureSequence(accounts);
    await restartClosure(accounts);
    evidenceDir = it7Dir;
    const browser = await chromium.launch({
      headless: true, channel: 'chrome',
      args: [`--ignore-certificate-errors-spki-list=${certificateSpkiHash(tlsMaterial.caPem)}`],
    });
    try {
      await walkAdmin(browser, accounts);
      evidenceDir = chainDir;
      buckets = ['chain'];
      await walkLearner(browser, { width: 1280, height: 900 }, 'web-1280', false, true);
      await walkLearner(browser, { width: 390, height: 844 }, 'web-390', false, false);
      await walkLearner(browser, { width: 390, height: 844 }, 'h5-390', true, false);
      await walkLearner(browser, { width: 1280, height: 900 }, 'h5-1280', true, false);
    } finally {
      await browser.close();
    }
    evidenceDir = chainDir;
    buckets = ['chain'];
    await replayContent();
    if (stackUp) nodeSuite();
    nodeRan = true;
  }, ['it7', 'chain']);
  buckets = ['it2', 'it7', 'chain'];
  const markerAfter = sharedAdminMarker();
  record('shared-admin-schema-untouched', markerBefore === markerAfter ? 'PASS' : 'FAIL', { before: markerBefore, after: markerAfter });
} catch (error) {
  buckets = ['it2', 'it7', 'chain'];
  record('runner', 'FAIL', { error: String(error.stack || error.message || error).slice(0, 800) });
} finally {
  await stopAll();
  try { dropSchemas(); }
  catch (error) { buckets = ['it2', 'it7', 'chain']; record('schemas-dropped-final', 'FAIL', { error: String(error.message || error) }); }
  const qidaAfter = qidaNames();
  const qidaAdded = qidaAfter.filter((name) => !qidaBefore.includes(name));
  const qidaRemoved = qidaBefore.filter((name) => !qidaAfter.includes(name));
  buckets = ['it2', 'it7', 'chain'];
  record('qida-unchanged', qidaAdded.length === 0 && qidaRemoved.length === 0 ? 'PASS' : 'FAIL', {
    before: qidaBefore.length, after: qidaAfter.length, added: qidaAdded.length, removed: qidaRemoved.length, dockerMutations: 'none',
  });
  const phase = process.env.R8_PHASE || 'all';
  if (phase !== 'chain') {
    writePack(it2Dir, 'r8 IT-2 三套 owner schema 与 IAM 真签', 'R8_IT2_THREE_SCHEMA', 'it2', it2Required,
      'IAM 使用本轮临时测试证书监听 `https://127.0.0.1:18087`，并用真实 RS256 签发。三个领域 owner schema 是 learner、content、assessment，各自独立。Chrome 临时 profile 只放行该证书的 SPKI。没有调用 `security`，没有改系统钥匙串。schema 前缀是 `r8_it2_`，结束后删除。',
      'it2Outbound');
  }
  if (phase !== 'it2') {
    writePack(it7Dir, 'r8 IT-7 收口台落库与重启指纹', 'R8_IT7_PERSIST', 'it7', it7Required,
      'admin-ops 以 `local-real` 启动，Flyway 在本轮 `r8_chain_` admin schema 上执行。V1 由建库步骤预先落入空库，随后迁移补到 V7 `it7_closure_desk`。重启后只读取看板，没有重放收口命令。治理页在处置写链关闭时隐藏旧的风险处置按钮，并显示同一句拒绝。',
      'it7Outbound');
    writePack(chainDir, 'r8 IT-1 至 IT-7 全链回归', 'R8_FULL_CHAIN', 'chain', chainRequired,
      '全链使用另一套干净的 `r8_chain_` schema、同一套最新包和 HTTPS IAM。Web 与 H5 都覆盖 1280 和 390。IT-7 重启指纹不重放命令。node 套件在 H5、Gateway 和 HTTPS IAM 仍在监听时运行。',
      'fullChainOutbound');
  }
  rmSync(directory, { recursive: true, force: true });
  const failed = steps.filter((step) => step.status === 'FAIL').map((step) => step.name);
  note(`EVIDENCE suffix=${suffix} failed=${failed.join(',') || 'none'}`);
}
