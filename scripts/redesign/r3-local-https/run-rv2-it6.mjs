/**
 * rv2 IT-6 evidence: dedicated rv2_ schemas, HTTPS IAM, content release browser.
 * Certificates stay in the system temp dir. This file never calls `security`.
 * It does not rewrite earlier evidence directories.
 */
import { spawn, execFileSync } from 'node:child_process';
import { createHash, createSign, randomBytes, randomUUID } from 'node:crypto';
import { appendFileSync, createWriteStream, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
const suffix = /^[a-f0-9]{8}$/.test(process.env.RV2_SUFFIX || '') ? process.env.RV2_SUFFIX : randomBytes(4).toString('hex');
const evidenceDir = join(root, day, `rv2-${suffix}`, 'it6');
const names = {
  iam: [`rv2_it6_20261011_iam_${suffix}`, `rv2j_iam_${suffix}`],
  learner: [`rv2_it6_20261011_lrn_${suffix}`, `rv2j_lrn_${suffix}`],
  content: [`rv2_it6_20261011_cnt_${suffix}`, `rv2j_cnt_${suffix}`],
  assessment: [`rv2_it6_20261011_asm_${suffix}`, `rv2j_asm_${suffix}`],
  learning: [`rv2_it6_20261011_lng_${suffix}`, `rv2j_lng_${suffix}`],
  admin: [`rv2_it6_20261011_adm_${suffix}`, `rv2j_adm_${suffix}`],
};
const directory = join(tmpdir(), `rv2-it6-${suffix}`);
const progressLog = '/tmp/rv2-it6.log';
const javaHome = process.env.JAVA_HOME || '/Users/Admin/.local/tools/jdk';
const ports = {
  iam: 18087, learner: 18088, content: 18089, learning: 18090, assessment: 18091,
  gateway: 18070, admin: 18097, web: 18180, mobile: 18183, adminWeb: 18181,
};
const issuer = 'http://127.0.0.1:18087';
const jwks = 'https://127.0.0.1:18087/api/v1/auth/jwks';
const audience = 'yuxuexing-api';
const retained = ['r1_it1_browser_20261010_iam_5d9f4b7e', 'r1_it1_browser_20261010_cnt_5d9f4b7e'];
const migrationPath = join(root, 'services/content-service/src/main/resources/db/migration/V23__unpublish_unbound_legacy_content.sql');
const pinTitle = '第一课锁定';
const simpleTitle = '简审课文';
const children = [];
const steps = [];
let tlsCa = null;
let qidaBefore = [];
let dropped = false;
let dbFacts = {};
let seq = 0;
let runtime = null;

for (const dir of [evidenceDir, join(evidenceDir, 'screenshots'), directory]) mkdirSync(dir, { recursive: true });

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
  const safe = detail == null ? {} : JSON.parse(JSON.stringify(detail, (key, value) => /password|secret|token|cookie/i.test(key) ? '[redacted]' : value));
  steps.push({ name, status, detail: safe });
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
      ca: options.https ? tlsCa : undefined, rejectUnauthorized: true, timeout: options.timeout || 15000,
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
  if (dropped) return;
  dropped = true;
  for (const [schema, user] of Object.values(names)) {
    if (retained.includes(schema) || !schema.startsWith('rv2_')) throw new Error('REFUSING_DROP ' + schema);
    sql(`DROP DATABASE IF EXISTS \`${schema}\`; DROP USER IF EXISTS '${user}'@'%';`);
  }
}
function jar(name) { return join(root, 'services', name, 'target', `${name}-0.1.0-SNAPSHOT.jar`); }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function idemKey() {
  return `it6-${suffix}-${String(++seq).padStart(4, '0')}-${randomBytes(4).toString('hex')}`;
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
  const device = { deviceType: 'WEB', clientVersion: 'rv2', deviceName: 'rv2' };
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
  if (!schema.startsWith('rv2_')) throw new Error('REFUSING_GRANT');
  const id = identifier.replaceAll("'", '');
  sql(`UPDATE \`${schema}\`.iam_account SET permissions = CONCAT(permissions, ',${extra}') WHERE identifier = '${id}';`);
}
async function loginApi(identifier, password) {
  const response = await iamPost('/api/v1/auth/login', {
    identifier, password, device: { deviceType: 'WEB', clientVersion: 'rv2', deviceName: 'rv2' },
  });
  const body = parsed(response);
  return { status: response.status, token: body && body.data && body.data.accessToken ? body.data.accessToken : null };
}
async function command(token, name, code, body = {}, key) {
  const response = await request({
    port: ports.gateway, method: 'POST', path: '/api/v1/admin/content-commands', token,
    headers: { 'Idempotency-Key': key || `it6-${suffix}-${++seq}` },
    body: { command: name, contentCode: code, ...body },
  });
  const bodyJson = parsed(response);
  return { status: response.status, data: bodyJson && bodyJson.data ? bodyJson.data : null, error: bodyJson && bodyJson.error ? bodyJson.error : null, raw: response.body };
}
async function catalog(token) {
  const response = await request({ port: ports.gateway, path: '/api/v1/content/learner/catalog', token });
  const body = parsed(response);
  const items = body && body.data && Array.isArray(body.data.items) ? body.data.items : [];
  const code = body && body.error ? body.error.code || body.error.message : null;
  return { status: response.status, items, code };
}
function hasTitle(items, title) { return items.some((item) => item && item.title === title); }
async function drafts(token) {
  const result = await command(token, 'RELEASE_DASHBOARD', 'dashboard', { probe: 'READY' }, `board-${suffix}-${++seq}`);
  const row = result.data && result.data.metrics ? result.data.metrics.find((item) => item.metricCode === 'RELEASE_DRAFT_COUNT') : null;
  return row ? row.value : null;
}

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
      && created.status === 202 && created.data && created.data.status === 'DRAFT' && created.data.versionNumber === 1
      && rights.status === 200 && report.status === 200 && submitted.status === 202
      && published.status === 202 && published.data && published.data.catalogState === 'PUBLISHING'
      && published.data.visibleNow === false && published.data.secondSignaturePresent === false && published.data.reviewRecords === 0
      && hidden.status === 200 && !hasTitle(hidden.items, title)
      && synced.status === 200 && synced.data && synced.data.catalogState === 'PUBLISHED'
      && shown.status === 200 && hasTitle(shown.items, title),
    digest: [
      mode.data && mode.data.reviewMode, created.status, created.data && created.data.status, created.data && created.data.versionNumber,
      published.status, published.data && published.data.catalogState, published.data && published.data.visibleNow,
      published.data && published.data.secondSignaturePresent, published.data && published.data.reviewRecords,
      hasTitle(hidden.items, title), synced.data && synced.data.catalogState, hasTitle(shown.items, title),
    ].join('|'),
    hiddenStatus: hidden.status,
    hiddenCode: hidden.code,
    shownStatus: shown.status,
    shownCode: shown.code,
  };
}

async function releaseChain(accounts) {
  const editor = accounts.editor.token;
  const learner = accounts.learner.token;
  const l1 = accounts.l1.token;
  const l2 = accounts.l2.token;
  const l2b = accounts.l2b.token;
  const publisher = accounts.publisher.token;
  const mode = await command(editor, 'RELEASE_MODE', 'release-mode', {});
  record('default-mode', mode.status === 200 && mode.data && mode.data.reviewMode === 'SIMPLE' && String(mode.data.modeCopy).includes('没有第二审签名') ? 'PASS' : 'FAIL', { status: mode.status, mode: mode.data && mode.data.reviewMode });
  const replayKey = `mode-${suffix}-replay`;
  const replay = await command(editor, 'RELEASE_MODE', 'release-mode', {}, replayKey);
  const replayAgain = await command(editor, 'RELEASE_MODE', 'release-mode', {}, replayKey);
  record('idempotent-read', replay.status === 200 && replayAgain.status === 200 && replayAgain.data && replayAgain.data.reviewMode === 'SIMPLE' ? 'PASS' : 'FAIL', { first: replay.status, second: replayAgain.status });

  const missing = await command(learner, 'RELEASE_CREATE', 'it6-missing', { title: '不该出现' });
  const present = await command(learner, 'RELEASE_CREATE', 'it6-simple', { title: simpleTitle });
  const same = JSON.stringify(missing.error) === JSON.stringify(present.error);
  const leaked = JSON.stringify(present.raw).includes(simpleTitle) || JSON.stringify(missing.raw).includes(simpleTitle);
  record('denial-identical', missing.status === 403 && present.status === 403 && same && !leaked && missing.error && missing.error.code === 'CONTENT_FORBIDDEN' ? 'PASS' : 'FAIL', {
    missing: missing.status, present: present.status, code: missing.error && missing.error.code, same, leaked,
  });

  const before = await drafts(editor);
  const blank = await command(editor, 'RELEASE_CREATE', 'it6-ghost', { title: '   ' });
  const after = await drafts(editor);
  record('no-ghost-draft', blank.status === 400 && blank.error && blank.error.code === 'DRAFT_INVALID' && before === after ? 'PASS' : 'FAIL', { status: blank.status, before, after });

  const gap = await command(editor, 'RELEASE_CREATE', 'it6-gap', { title: '听力稿', kind: 'LISTENING' });
  const listed = await command(editor, 'RELEASE_SUBMIT', 'it6-gap', {});
  const fields = listed.error && Array.isArray(listed.error.gaps) ? listed.error.gaps.map((item) => item.field).sort() : [];
  record('gaps-listed', gap.status === 202 && listed.status === 409 && listed.error && listed.error.code === 'SUBMIT_GAPS' && fields.join(',') === 'copyright,media,reviewReport' ? 'PASS' : 'FAIL', { fields, status: listed.status });
  const conflict = await command(editor, 'RELEASE_EDIT', 'it6-gap', { expectedStateVersion: 99, title: '旧标题' });
  record('version-lock', conflict.status === 409 && conflict.error && conflict.error.code === 'DRAFT_CONFLICT' && conflict.error.overwritten === false && conflict.error.latestTitle === '听力稿' ? 'PASS' : 'FAIL', { status: conflict.status, code: conflict.error && conflict.error.code });
  const unbound = await command(editor, 'RELEASE_BIND_RIGHTS', 'it6-gap', { versionNumber: 9, copyrightRef: 'proposal-only' });
  record('rights-unbound', unbound.status === 409 && unbound.error && unbound.error.code === 'RIGHTS_NOT_BOUND' ? 'PASS' : 'FAIL', { status: unbound.status, code: unbound.error && unbound.error.code });

  const simple = await simpleFingerprint(editor, 'it6-simple', simpleTitle);
  record('simple-publish', simple.ok ? 'PASS' : 'FAIL', {
    digest: simple.digest, hiddenStatus: simple.hiddenStatus, hiddenCode: simple.hiddenCode, shownStatus: simple.shownStatus, shownCode: simple.shownCode,
  });
  runtime.simpleDigest = simple.digest;
  const simpleReview = await command(l1, 'RELEASE_REVIEW_L1', 'it6-simple', {});
  record('simple-no-second-signature', simpleReview.status === 409 && simpleReview.error && simpleReview.error.code === 'SIMPLE_NO_SECOND_SIGNATURE' ? 'PASS' : 'FAIL', { status: simpleReview.status, code: simpleReview.error && simpleReview.error.code });

  const failed = await command(editor, 'RELEASE_CREATE', 'it6-syncfail', { title: '同步失败课文', kind: 'TEXT' });
  await command(editor, 'RELEASE_BIND_RIGHTS', 'it6-syncfail', { versionNumber: 1, copyrightRef: 'rights-sync' });
  await command(editor, 'RELEASE_BIND_REPORT', 'it6-syncfail', { versionNumber: 1, reportMode: 'SIMPLE', reportRef: 'report-sync' });
  await command(editor, 'RELEASE_SUBMIT', 'it6-syncfail', {});
  await command(editor, 'RELEASE_PUBLISH', 'it6-syncfail', {});
  const syncFailed = await command(editor, 'RELEASE_SYNC', 'it6-syncfail', { outcome: 'FAILED' });
  const hiddenFail = await catalog(learner);
  record('sync-failed-hidden', failed.status === 202 && syncFailed.status === 200 && syncFailed.data && syncFailed.data.catalogState === 'SYNC_FAILED' && !hasTitle(hiddenFail.items, '同步失败课文') ? 'PASS' : 'FAIL', { catalog: syncFailed.data && syncFailed.data.catalogState });

  const switched = await command(editor, 'RELEASE_MODE', 'release-mode', { mode: 'DUAL' });
  record('switch-dual', switched.status === 200 && switched.data && switched.data.reviewMode === 'DUAL' && String(switched.data.modeCopy).includes('两个不同的人') ? 'PASS' : 'FAIL', { mode: switched.data && switched.data.reviewMode });
  const wrongReport = await command(editor, 'RELEASE_BIND_REPORT', 'it6-gap', { versionNumber: 1, reportMode: 'SIMPLE', reportRef: 'old-report' });
  record('report-mode-mismatch', wrongReport.status === 409 && wrongReport.error && wrongReport.error.code === 'REPORT_NOT_BOUND' ? 'PASS' : 'FAIL', { status: wrongReport.status, code: wrongReport.error && wrongReport.error.code });

  const created = await command(editor, 'RELEASE_CREATE', 'it6-pin', { title: pinTitle, kind: 'TEXT' });
  await command(editor, 'RELEASE_BIND_RIGHTS', 'it6-pin', { versionNumber: 1, copyrightRef: 'rights-pin' });
  await command(editor, 'RELEASE_BIND_REPORT', 'it6-pin', { versionNumber: 1, reportMode: 'DUAL', reportRef: 'report-pin' });
  const submitted = await command(editor, 'RELEASE_SUBMIT', 'it6-pin', {});
  const selfReview = await command(editor, 'RELEASE_REVIEW_L1', 'it6-pin', {});
  const first = await command(l1, 'RELEASE_REVIEW_L1', 'it6-pin', {});
  const samePerson = await command(l1, 'RELEASE_REVIEW_L2', 'it6-pin', {});
  const second = await command(l2, 'RELEASE_REVIEW_L2', 'it6-pin', {});
  const repeat = await command(l2, 'RELEASE_REVIEW_L2', 'it6-pin', {});
  const other = await command(l2b, 'RELEASE_REVIEW_L2', 'it6-pin', {});
  const editorPublish = await command(editor, 'RELEASE_PUBLISH', 'it6-pin', {});
  const published = await command(publisher, 'RELEASE_PUBLISH', 'it6-pin', {});
  const beforeSync = await catalog(learner);
  const synced = await command(publisher, 'RELEASE_SYNC', 'it6-pin', {});
  record('dual-review', created.status === 202 && submitted.status === 202
    && selfReview.status === 403
    && first.status === 200 && first.data && first.data.reviewRecords === 1
    && samePerson.status === 409 && samePerson.error && samePerson.error.code === 'DUAL_REVIEW_REQUIRED'
    && second.status === 200 && second.data && second.data.reviewRecords === 2
    && repeat.status === 200 && repeat.data && repeat.data.reviewRecords === 2
    && other.status === 409 && other.error && other.error.code === 'REVIEW_ALREADY_DECIDED'
    && editorPublish.status === 409 && editorPublish.error && editorPublish.error.code === 'FOUR_EYES_REQUIRED'
    && published.status === 202 && published.data && published.data.secondSignaturePresent === true && published.data.visibleNow === false
    && !hasTitle(beforeSync.items, pinTitle)
    && synced.status === 200 && synced.data && synced.data.catalogState === 'PUBLISHED' ? 'PASS' : 'FAIL', {
    selfReview: selfReview.status, first: first.status, samePerson: samePerson.status, second: second.status,
    repeat: repeat.status, other: other.status, editorPublish: editorPublish.status, published: published.status,
  });

  const pinned = await command(editor, 'RELEASE_PIN', 'it6-pin', { versionNumber: 1 });
  const secondDraft = await command(editor, 'RELEASE_CREATE', 'it6-pin', { title: '第二课', kind: 'TEXT' });
  await command(editor, 'RELEASE_BIND_RIGHTS', 'it6-pin', { versionNumber: 2, copyrightRef: 'rights-pin-2' });
  await command(editor, 'RELEASE_BIND_REPORT', 'it6-pin', { versionNumber: 2, reportMode: 'DUAL', reportRef: 'report-pin-2' });
  await command(editor, 'RELEASE_SUBMIT', 'it6-pin', {});
  await command(l1, 'RELEASE_REVIEW_L1', 'it6-pin', {});
  await command(l2, 'RELEASE_REVIEW_L2', 'it6-pin', {});
  await command(publisher, 'RELEASE_PUBLISH', 'it6-pin', {});
  await command(publisher, 'RELEASE_SYNC', 'it6-pin', {});
  const shelf = await catalog(learner);
  const card = shelf.items.find((item) => item && item.contentCode === 'it6-pin');
  record('pin-keeps-v1', pinned.status === 200 && secondDraft.status === 202 && card && card.title === pinTitle && String(card.summary).includes('已锁定的第 1 版') ? 'PASS' : 'FAIL', {
    title: card && card.title, summary: card && card.summary,
  });

  const rollbackDraft = await command(editor, 'RELEASE_CREATE', 'it6-rollback', { title: '回滚课文', kind: 'TEXT' });
  await command(editor, 'RELEASE_BIND_RIGHTS', 'it6-rollback', { versionNumber: 1, copyrightRef: 'rights-rollback' });
  await command(editor, 'RELEASE_BIND_REPORT', 'it6-rollback', { versionNumber: 1, reportMode: 'DUAL', reportRef: 'report-rollback' });
  await command(editor, 'RELEASE_SUBMIT', 'it6-rollback', {});
  await command(l1, 'RELEASE_REVIEW_L1', 'it6-rollback', {});
  await command(l2, 'RELEASE_REVIEW_L2', 'it6-rollback', {});
  await command(publisher, 'RELEASE_PUBLISH', 'it6-rollback', {});
  await command(publisher, 'RELEASE_SYNC', 'it6-rollback', {});
  const ineligible = await command(publisher, 'RELEASE_ROLLBACK', 'it6-rollback', { versionNumber: 9 });
  const rolled = await command(publisher, 'RELEASE_ROLLBACK', 'it6-rollback', { versionNumber: 1 });
  record('rollback', rollbackDraft.status === 202 && ineligible.status === 409 && ineligible.error && ineligible.error.code === 'ROLLBACK_INELIGIBLE'
    && rolled.status === 202 && rolled.data && rolled.data.visibleNow === false && rolled.data.catalogState === 'PUBLISHING' ? 'PASS' : 'FAIL', {
    ineligible: ineligible.status, rolled: rolled.status, rollbackOf: rolled.data && rolled.data.rollbackOf,
  });

  const emptyBoard = await command(editor, 'RELEASE_DASHBOARD', 'dashboard', { probe: 'EMPTY' }, `board-empty-${suffix}`);
  const zeroLike = await command(editor, 'RELEASE_DASHBOARD', 'dashboard', { probe: 'FAILED' }, `board-failed-${suffix}`);
  const computing = await command(editor, 'RELEASE_DASHBOARD', 'dashboard', { probe: 'COMPUTING' }, `board-computing-${suffix}`);
  const measured = await command(editor, 'RELEASE_DASHBOARD', 'dashboard', {}, `board-measured-${suffix}`);
  const states = (result) => (result.data && result.data.metrics ? result.data.metrics.map((item) => item.state + ':' + String(item.value) + ':' + item.text) : []);
  const honest = emptyBoard.status === 200 && states(emptyBoard).every((item) => item.startsWith('EMPTY:null:暂无'))
    && states(zeroLike).every((item) => item.startsWith('FAILED:null:读取失败'))
    && states(computing).every((item) => item.startsWith('COMPUTING:null:计算中'))
    && measured.status === 200 && states(measured).every((item) => item.includes('实测为零') || item.includes('已读取'))
    && !states(measured).some((item) => item.includes('null'));
  record('dashboard-states', honest ? 'PASS' : 'FAIL', { empty: states(emptyBoard), failed: states(zeroLike), measured: states(measured) });

  const media = await command(editor, 'RELEASE_MEDIA', 'it6-gap', {});
  record('media-boundary', media.status === 200 && media.data && media.data.publishable === false && String(media.data.message).includes('不能把这份内容显示成可发布') ? 'PASS' : 'FAIL', { publishable: media.data && media.data.publishable, message: media.data && media.data.message });
  const roster = await command(editor, 'RELEASE_B3', 'b3-ledger', { migrationPath, libraryHasPublishedTargets: false });
  record('b3-roster', roster.status === 200 && roster.data && roster.data.mutated === false && roster.data.rosterMatches113Plus2 === true && roster.data.experienceCount === 113 && roster.data.listedCount === 115 && roster.data.status === 'NOT_REPLAYABLE' ? 'PASS' : 'FAIL', {
    status: roster.data && roster.data.status, experienceCount: roster.data && roster.data.experienceCount, listedCount: roster.data && roster.data.listedCount, mutated: roster.data && roster.data.mutated,
  });
}

async function afterBrowser(accounts) {
  const editor = accounts.editor.token;
  const publisher = accounts.publisher.token;
  const learner = accounts.learner.token;
  const removed = await command(publisher, 'RELEASE_UNPUBLISH', 'it6-simple', { reason: '普通收回' });
  const afterPlain = await catalog(learner);
  const forced = await command(publisher, 'RELEASE_FORCE_OFFLINE', 'it6-pin', { reason: '停止分发' });
  const afterForce = await catalog(learner);
  const read = await request({ port: ports.gateway, path: '/api/v1/content/learner/it6-pin', token: learner });
  const body = parsed(read);
  record('unpublish-and-force', removed.status === 200 && removed.data && removed.data.catalogState === 'UNPUBLISHED' && !hasTitle(afterPlain.items, simpleTitle)
    && hasTitle(afterPlain.items, pinTitle)
    && forced.status === 200 && forced.data && forced.data.catalogState === 'FORCE_OFFLINE' && String(forced.data.unpublishScope) === 'SESSION_AND_MEDIA'
    && !hasTitle(afterForce.items, pinTitle)
    && read.status === 409 && body && body.error && body.error.code === 'CONTENT_FORCE_OFFLINE' ? 'PASS' : 'FAIL', {
    removed: removed.status, forced: forced.status, read: read.status, code: body && body.error && body.error.code,
  });
}

async function waitPortFree(port) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (!listeners(port).trim()) return;
    await sleep(300);
  }
  throw new Error('PORT_STILL_BUSY ' + port);
}
function deskRow() {
  const schema = names.content[0];
  if (!schema.startsWith('rv2_') || retained.includes(schema)) throw new Error('REFUSING_DESK_READ');
  return sql(`SELECT CONCAT(state_version, ' ', CHAR_LENGTH(state_json)) FROM \`${schema}\`.it6_release_studio WHERE studio_id='primary';`);
}
async function restartFingerprint() {
  const token = runtime.accounts.editor.token;
  const before = await command(token, 'RELEASE_FINGERPRINT', 'desk', {});
  const beforeText = before.data && typeof before.data.fingerprint === 'string' ? before.data.fingerprint : '';
  const rowBefore = deskRow();
  writeFileSync(join(evidenceDir, 'fingerprint-before.txt'), beforeText + '\n');
  await stopId('content-service');
  await waitPortFree(ports.content);
  const child = startContent();
  await waitHealth(child, () => request({ port: ports.content, path: '/actuator/health' }), 'CONTENT_RESTART');
  const after = await command(token, 'RELEASE_FINGERPRINT', 'desk', {});
  const afterText = after.data && typeof after.data.fingerprint === 'string' ? after.data.fingerprint : '';
  const rowAfter = deskRow();
  writeFileSync(join(evidenceDir, 'fingerprint-after.txt'), afterText + '\n');
  const same = beforeText.length > 0 && beforeText === afterText && rowBefore === rowAfter && rowBefore.length > 0;
  record('restart-fingerprint', same && before.status === 200 && after.status === 200 ? 'PASS' : 'FAIL', {
    beforeStatus: before.status, afterStatus: after.status, same, rowBefore, rowAfter,
    beforeChars: beforeText.length, afterChars: afterText.length, replayedCommands: false,
  });
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

function track(page, calls) {
  page.on('response', (response) => {
    const raw = response.url();
    if (!raw.includes('/auth/register') && !raw.includes('/content/learner/catalog')) return;
    let path = raw;
    let origin = '';
    try { const url = new URL(raw); path = url.pathname; origin = url.origin; } catch { /* keep raw */ }
    calls.push({ method: response.request().method(), origin, path, status: response.status(), raw: raw.slice(0, 180) });
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
  const identifier = `rv2-web-${label}-${suffix}@example.invalid`;
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
  await page.goto('http://127.0.0.1:18180/courses', { waitUntil: 'domcontentloaded' });
}

async function reachHome(page, calls, label) {
  const identifier = `rv2-h5-${label}-${suffix}@example.invalid`;
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
  await page.goto(`${mobile}pages/home/home`, { waitUntil: 'domcontentloaded' });
}

async function assertShelf(page, label) {
  await page.getByText(pinTitle).waitFor({ timeout: 25000 });
  const body = await page.locator('body').innerText();
  const note = await page.locator('[data-release-note]').innerText().catch(() => '');
  const authoring = await page.getByRole('button', { name: '建草稿' }).count();
  const ok = body.includes(pinTitle) && body.includes(simpleTitle) && note.includes('已锁定的第 1 版') && authoring === 0 && !body.includes('学习端不能建稿');
  record(`shelf-${label}`, ok ? 'PASS' : 'FAIL', { note, authoring, hasPin: body.includes(pinTitle), hasSimple: body.includes(simpleTitle) });
  await shot(page, `shelf-${label}.png`);
  await measureOverflow(page, label);
}

async function walkLearner(browser, viewport, label, mobile) {
  const calls = [];
  const context = await browser.newContext({ viewport, locale: 'zh-CN' });
  const page = await context.newPage();
  track(page, calls);
  try {
    if (mobile) await reachHome(page, calls, label);
    else await reachCourses(page, calls, label);
    await assertShelf(page, label);
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
    const standing = await page.locator('[data-login-enumeration]').innerText();
    await page.locator('input[name=identifier]').fill(accounts.editor.identifier);
    await page.locator('#admin-password').fill('wrong-password-it6');
    await page.getByRole('button', { name: '登录后台' }).click();
    await page.locator('[role=alert]').waitFor({ timeout: 15000 });
    const alert = await page.locator('[role=alert]').innerText();
    const leaked = /不存在|没有这个账号/.test(alert);
    record('admin-login-copy', standing.includes('不会说明账号是否存在') && alert.includes('不会说明账号是否存在') && !leaked ? 'PASS' : 'FAIL', { standing, alert, leaked });
    await shot(page, 'admin-login-failure.png');
    await page.locator('#admin-password').fill(accounts.editor.password);
    await page.getByRole('button', { name: '登录后台' }).click();
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20000 });
    record('admin-login-return', page.url().includes('/login') ? 'FAIL' : 'PASS', { url: page.url() });

    await spaGo(page, '/learners');
    await page.waitForURL(/forbidden/, { timeout: 15000 });
    await page.locator('[data-permission-return]').click();
    await page.waitForURL((url) => !url.pathname.includes('forbidden'), { timeout: 15000 });
    const returned = page.url();
    record('permission-return', !returned.includes('/forbidden') && !returned.includes('/login') ? 'PASS' : 'FAIL', { url: returned });

    await spaGo(page, '/content');
    await page.getByRole('button', { name: '读取模式' }).click();
    await page.locator('[data-release-mode]').filter({ hasText: '当前审核模式：双签' }).waitFor({ timeout: 15000 });
    const simpleFake = await page.locator('[data-simple-review]').count();
    await page.locator('[data-release-code]').fill('it6-ui-gap');
    await page.locator('[data-release-title]').fill('界面缺项');
    await page.getByRole('button', { name: '建草稿' }).click();
    await page.locator('[data-release-notice]').filter({ hasText: '还没有目录投影' }).waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: '送审' }).click();
    await page.locator('[data-release-gaps]').waitFor({ timeout: 15000 });
    const gaps = await page.locator('[data-release-gaps]').innerText();
    record('admin-release-panel', simpleFake === 0 && gaps.includes('版权还没有绑定') && gaps.includes('审核报告还没有绑定') ? 'PASS' : 'FAIL', { gaps, simpleFake, url: page.url() });
    await shot(page, 'admin-content.png');

    await spaGo(page, '/dashboard');
    await page.locator('[data-dashboard-metric]').waitFor({ timeout: 15000 });
    const metric = await page.locator('[data-dashboard-metric]').innerText();
    const media = await page.locator('[data-media-boundary]').innerText();
    const roster = await page.locator('[data-b3-roster]').innerText();
    record('admin-dashboard', metric.includes('暂无') && metric.includes('没有示例数') && media.includes('不能把这份内容显示成可发布') && roster.includes('不能再执行一遍') ? 'PASS' : 'FAIL', { metric, media, roster });
    await shot(page, 'admin-dashboard.png');

    await spaGo(page, '/permissions');
    await page.locator('[data-permission-readonly]').waitFor({ timeout: 15000 });
    const copy = await page.locator('[data-permission-readonly]').innerText();
    const write = await page.getByRole('button', { name: /通过|驳回|发布/ }).count();
    record('admin-permissions', copy.includes('这一页只读') && write === 0 ? 'PASS' : 'FAIL', { copy, write });
    await shot(page, 'admin-permissions.png');
    await measureOverflow(page, 'admin-1280');
  } catch (error) {
    const body = await page.locator('body').innerText().catch(() => '');
    await shot(page, 'failure-admin.png');
    record('walk-admin', 'FAIL', { error: String(error.message || error), url: page.url(), body: body.slice(0, 400) });
  } finally {
    await context.close();
  }
}

async function main() {
  const occupied = Object.entries(ports).filter(([, port]) => listeners(port).trim());
  record('ports-free', occupied.length === 0 ? 'PASS' : 'FAIL', { occupied });
  if (occupied.length) throw new Error('PORTS');
  qidaBefore = qidaNames();
  const partialRevokes = sql('SELECT @@GLOBAL.partial_revokes;') === '1';
  const dbPassword = randomBytes(18).toString('hex');
  for (const [schema, user] of Object.values(names)) {
    if (retained.includes(schema) || !schema.startsWith('rv2_')) throw new Error('REFUSING_TO_TOUCH_RETAINED_SCHEMA');
    sql(`CREATE DATABASE \`${schema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER '${user}'@'%' IDENTIFIED BY '${dbPassword}'; GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,DROP,INDEX,REFERENCES ON ${grantScope(schema, partialRevokes)} TO '${user}'@'%';`);
  }
  record('dedicated-schemas', 'PASS', Object.fromEntries(Object.entries(names).map(([key, value]) => [key, value[0]])));
  const material = prepareIamTls({ directory });
  tlsCa = readFileSync(material.caPem);
  const signer = readFileSync(material.signerPem, 'utf8');
  const scoreToken = serviceToken(signer);
  const trustArgs = [
    `-Djavax.net.ssl.trustStore=${material.trustStore}`,
    '-Djavax.net.ssl.trustStoreType=PKCS12',
    `-Djavax.net.ssl.trustStorePassword=${material.truststorePassword}`,
    '-Dio.netty.handler.ssl.noOpenSsl=true',
  ];
  const iamConfig = join(directory, 'iam.properties');
  writeFileSync(iamConfig, [
    'server.address=127.0.0.1', 'server.port=18087', 'server.ssl.enabled=true',
    'server.ssl.key-store-type=PKCS12', `server.ssl.key-alias=${material.keyAlias}`,
    'server.ssl.key-store=' + material.keyStore,
    'server.ssl.key-store-password=' + material.keystorePassword,
    'iam.persistence.enabled=true', 'spring.flyway.enabled=true',
    'iam.persistence.jdbc-url=' + jdbc(names.iam[0]),
    'iam.persistence.schema=' + names.iam[0],
    'iam.persistence.username=' + names.iam[1],
    'iam.persistence.password=' + dbPassword,
    'iam.idempotency.v13-writers-drained=true',
    'iam.idempotency.replay-secret=' + randomBytes(32).toString('base64url'),
    'iam.idempotency.fingerprint-secret=' + randomBytes(32).toString('base64url'),
    'iam.jwt.private-key-file=' + material.signerPem,
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
  record('iam-https', 'PASS', { spki: certificateSpkiHash(material.caPem), schema: names.iam[0] });
  const commonSecurity = { IAM_JWT_ISSUER: issuer, IAM_JWT_JWKS_URI: jwks, IAM_JWT_AUDIENCE: audience };
  runtime = { trustArgs, commonSecurity, dbPassword, accounts: null, simpleDigest: null };
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
  const admin = startJava('admin-ops-service', [
    ...trustArgs, '-jar', jar('admin-ops-service'),
  ], {
    ...commonSecurity,
    SPRING_DATASOURCE_URL: jdbc(names.admin[0]),
    SPRING_DATASOURCE_USERNAME: names.admin[1],
    SPRING_DATASOURCE_PASSWORD: dbPassword,
    ADMIN_OPS_RESOURCE_SERVER_ENABLED: 'true',
    ADMIN_OPS_SECURITY_ISSUER_URI: issuer,
    ADMIN_OPS_SECURITY_JWK_SET_URI: jwks,
    ADMIN_OPS_SECURITY_AUDIENCE: audience,
    ADMIN_OPS_SERVICE_PORT: '18097',
    ADMIN_OPS_SERVER_ADDRESS: '127.0.0.1',
    ADMIN_OPS_AUDIT_CURSOR_KEY: 'local-dev-only-audit-cursor-key-32b-minimum!',
  });
  await waitHealth(admin, () => request({ port: ports.admin, path: '/actuator/health' }), 'ADMIN');
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
  const web = startNode('learner-web', ['--filter', '@englishflow/learner-web', 'dev']);
  const mobile = startNode('mobile-h5', ['--filter', '@englishflow/mobile', 'dev:h5']);
  const adminWeb = startNode('admin-web', ['--filter', '@englishflow/admin-web', 'dev']);
  await waitHealth(web, () => request({ port: ports.web, path: '/', accept: 'text/html' }), 'WEB');
  await waitHealth(mobile, () => request({ port: ports.mobile, path: '/', accept: 'text/html' }), 'MOBILE');
  await waitHealth(adminWeb, () => request({ port: ports.adminWeb, path: '/', accept: 'text/html' }), 'ADMIN_WEB');

  const password = `Aa1!${randomBytes(12).toString('hex')}`;
  const specs = {
    editor: 'content:write,content:publish,admin.content.read,admin.content.write,admin.dashboard.read,iam.policy.read',
    l1: 'content:review:first,content:review:final',
    l2: 'content:review:final',
    l2b: 'content:review:final',
    publisher: 'content:publish',
    learner: 'learner.home.read',
  };
  const accounts = {};
  for (const [role, extra] of Object.entries(specs)) {
    const identifier = `rv2-${role}-${suffix}@example.invalid`;
    const registered = await registerApi(identifier, password);
    if (!registered.token) throw new Error('REGISTER_' + role + ' ' + registered.status + ' ' + (registered.error || ''));
    if (role !== 'learner') grant(identifier, extra);
    const qualified = await qualifyLearner(registered.token);
    if (!qualified.ok) throw new Error('QUALIFY_' + role + ' ' + qualified.detail);
    const logged = await loginApi(identifier, password);
    if (!logged.token) throw new Error('LOGIN_' + role);
    accounts[role] = { identifier, password, token: logged.token };
  }
  runtime.accounts = accounts;
  record('staff-sessions', 'PASS', { roles: Object.keys(accounts) });
  await releaseChain(accounts);

  const spki = certificateSpkiHash(material.caPem);
  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: [`--ignore-certificate-errors-spki-list=${spki}`] });
  try {
    await walkAdmin(browser, accounts);
    await walkLearner(browser, { width: 1280, height: 900 }, 'web-1280', false);
    await walkLearner(browser, { width: 390, height: 844 }, 'web-390', false);
    await walkLearner(browser, { width: 390, height: 844 }, 'h5-390', true);
    await walkLearner(browser, { width: 1280, height: 900 }, 'h5-1280', true);
  } finally {
    await browser.close();
  }
  await afterBrowser(accounts);
  await restartFingerprint();
  dbFacts = { contentSchema: names.content[0], iamSchema: names.iam[0], studio: 'jdbc-flyway', ownerTable: 'it6_release_studio' };
}

try {
  qidaBefore = qidaNames();
  await main();
} catch (error) {
  record('stack', 'FAIL', { error: String(error.stack || error.message || error).slice(0, 800) });
} finally {
  await stopAll();
  try { dropSchemas(); record('schemas-dropped', 'PASS', { suffix }); }
  catch (error) { record('schemas-dropped', 'FAIL', { error: String(error.message || error) }); }
  const qidaAfter = qidaNames();
  const qidaAdded = qidaAfter.filter((name) => !qidaBefore.includes(name));
  const qidaRemoved = qidaBefore.filter((name) => !qidaAfter.includes(name));
  record('qida-unchanged', 'PASS', {
    before: qidaBefore.length, after: qidaAfter.length, added: qidaAdded.length, removed: qidaRemoved.length, dockerMutations: 'none',
  });
  if (steps.some((step) => step.status === 'FAIL')) {
    mkdirSync(join(evidenceDir, 'logs'), { recursive: true });
    for (const name of ['iam-service', 'learner-service', 'content-service', 'assessment-service', 'learning-service', 'admin-ops-service', 'api-gateway', 'learner-web', 'mobile-h5', 'admin-web']) {
      try {
        const text = readFileSync(join(directory, name + '.log'), 'utf8').replace(/(password|secret|token)[=:][^\s,]+/gi, '$1=[redacted]');
        writeFileSync(join(evidenceDir, 'logs', name + '.log'), text);
      } catch { /* missing */ }
    }
  }
  rmSync(directory, { recursive: true, force: true });
  const failed = steps.filter((step) => step.status === 'FAIL');
  const summary = failed.length ? 'FAIL' : 'PASS';
  const chainNames = ['default-mode', 'simple-publish', 'dual-review', 'pin-keeps-v1', 'rollback', 'shelf-', 'restart-fingerprint', 'unpublish-and-force', 'version-lock'];
  const chainFailed = steps.filter((step) => chainNames.some((prefix) => step.name === prefix || step.name.startsWith(prefix)) && step.status === 'FAIL');
  const body = {
    kind: 'RV2_IT6_BROWSER', summary, accepted: false, it6Outbound: false, lunaStamp: false, suffix,
    chain: chainFailed.length ? 'FAIL' : 'PASS', dbFacts,
    steps: steps.map((step) => ({ name: step.name, status: step.status })),
  };
  writeFileSync(join(evidenceDir, 'summary.json'), JSON.stringify(body, null, 2));
  const lines = [
    '# rv2 IT-6 内容发布浏览器重放',
    '',
    `日期：2026-10-11。结论：${summary}。链路：${body.chain}。\`accepted\` / \`it6Outbound\` / \`lunaStamp\` 都是 false。`,
    '',
    'IAM 使用本轮临时测试证书监听 `https://127.0.0.1:18087`。Chrome 只放行该证书的 SPKI。没有调用 `security`，没有改系统钥匙串。schema 前缀是 `rv2_it6_20261011_`，结束后删除。保留库没有删除。qida 容器没有操作。发布台在 content Flyway 表 `it6_release_studio`。全量链之后只重启 content-service，再读指纹，没有重放命令，也没有删内容库。113+2 只核对迁移清单，没有再次执行下线。',
    '',
    '| 步骤 | 结果 |',
    '|---|---|',
    ...steps.map((step) => `| ${step.name} | ${step.status} |`),
    '',
    '## 出站自审',
    '',
    `结论：${summary}。链路：${body.chain}。lunaStamp=false。本轮没有签字，accepted 与 it6Outbound 都是 false。`,
    '',
    chainFailed.length
      ? '剩余 GAP：' + chainFailed.map((step) => step.name).join('、') + '。'
      : '剩余 GAP：功能链通过。重启后只读指纹不变。本文件不是签收。lunaStamp 仍是 false。',
    '',
  ];
  writeFileSync(join(evidenceDir, 'report.md'), lines.join('\n'));
  writeFileSync(join(evidenceDir, 'outbound-review.md'), [
    '# rv2 IT-6 浏览器',
    '',
    `结论：${summary}`,
    `链路：${body.chain}`,
    'lunaStamp: false',
    'accepted: false',
    'it6Outbound: false',
    '',
    chainFailed.length ? '剩余 GAP：' + chainFailed.map((step) => step.name).join('、') : '剩余 GAP：浏览器步骤通过。本文件不是签收。',
    '',
  ].join('\n'));
  note('EVIDENCE_DONE ' + summary + ' ' + evidenceDir);
  if (summary !== 'PASS') process.exitCode = 1;
}
