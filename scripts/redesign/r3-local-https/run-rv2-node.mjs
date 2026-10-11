/**
 * rv2 node suite: HTTPS IAM, learner, content, assessment, admin-ops, Gateway, and H5.
 * Certificates stay in the system temp dir. This file never calls `security`.
 * It does not rewrite earlier evidence directories or touch qida containers.
 * steps.json is the first-run record. A failed suffix is left in place.
 */
import { spawn, execFileSync } from 'node:child_process';
import { createHash, createSign, randomBytes, randomUUID } from 'node:crypto';
import { appendFileSync, createWriteStream, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
const evidenceDir = join(root, day, `rv2-${suffix}`, 'node');
const names = {
  iam: [`rv2_node_20261011_iam_${suffix}`, `rv2n_iam_${suffix}`],
  learner: [`rv2_node_20261011_lrn_${suffix}`, `rv2n_lrn_${suffix}`],
  content: [`rv2_node_20261011_cnt_${suffix}`, `rv2n_cnt_${suffix}`],
  assessment: [`rv2_node_20261011_asm_${suffix}`, `rv2n_asm_${suffix}`],
  admin: [`rv2_node_20261011_adm_${suffix}`, `rv2n_adm_${suffix}`],
};
const directory = join(tmpdir(), `rv2-node-${suffix}`);
const progressLog = '/tmp/rv2-node.log';
const javaHome = process.env.JAVA_HOME || '/Users/Admin/.local/tools/jdk';
const ports = {
  iam: 18087, learner: 18088, content: 18089, assessment: 18091, gateway: 18070, admin: 18097, web: 18180, mobile: 18183,
};
const issuer = 'http://127.0.0.1:18087';
const jwks = 'https://127.0.0.1:18087/api/v1/auth/jwks';
const audience = 'yuxuexing-api';
const retained = ['r1_it1_browser_20261010_iam_5d9f4b7e', 'r1_it1_browser_20261010_cnt_5d9f4b7e'];
const minorYear = new Date().getFullYear() - 10;
const children = [];
const steps = [];
let tlsCa = null;
let qidaBefore = [];
let dropped = false;
let seq = 0;
let runtime = null;

for (const dir of [evidenceDir, join(evidenceDir, 'screenshots'), directory, join(directory, 'chrome-profile')]) {
  mkdirSync(dir, { recursive: true });
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
  const safe = detail == null ? {} : JSON.parse(JSON.stringify(detail, (key, value) => /password|secret|token|cookie/i.test(key) ? '[redacted]' : value));
  steps.push({ name, status, detail: safe });
  note(`${status} ${name} ${JSON.stringify(safe).slice(0, 700)}`);
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
  const deadline = Date.now() + 150000;
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
  const deadline = Date.now() + 15000;
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
  const deadline = Date.now() + 12000;
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
function idemKey() { return `rv2-${suffix}-${String(++seq).padStart(4, '0')}-${randomBytes(3).toString('hex')}`; }
async function iamWrite(method, path, body, token) {
  return request({
    port: ports.iam, https: true, method, path, token,
    headers: { 'Idempotency-Key': idemKey(), 'x-client-platform': 'web' },
    body,
  });
}
async function iamPost(path, body) { return iamWrite('POST', path, body); }
async function registerApi(identifier, password) {
  const device = { deviceType: 'WEB', clientVersion: 'rv2', deviceName: 'rv2' };
  const response = await iamPost('/api/v1/auth/register', { identifier, password, device });
  const body = parsed(response);
  const token = body && body.data && body.data.accessToken;
  const error = body && body.error ? body.error.code || body.error.message : null;
  return { status: response.status, token: token || null, error };
}
async function loginApi(identifier, password) {
  const response = await iamPost('/api/v1/auth/login', {
    identifier, password, device: { deviceType: 'WEB', clientVersion: 'rv2', deviceName: 'rv2' },
  });
  const body = parsed(response);
  return { status: response.status, token: body && body.data && body.data.accessToken ? body.data.accessToken : null };
}
function grant(identifier, extra) {
  const schema = names.iam[0];
  if (!schema.startsWith('rv2_') || retained.includes(schema)) throw new Error('REFUSING_GRANT');
  const id = identifier.replaceAll("'", '');
  sql(`UPDATE \`${schema}\`.iam_account SET permissions = CONCAT(permissions, ',${extra}') WHERE identifier = '${id}';`);
}
async function command(token, name, code, body = {}) {
  const response = await request({
    port: ports.gateway, method: 'POST', path: '/api/v1/admin/content-commands', token,
    headers: { 'Idempotency-Key': idemKey() },
    body: { command: name, contentCode: code, ...body },
  });
  const bodyJson = parsed(response);
  return { status: response.status, data: bodyJson && bodyJson.data ? bodyJson.data : null, error: bodyJson && bodyJson.error ? bodyJson.error : null };
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
  if (!schema.startsWith('rv2_')) throw new Error('REFUSING_DESK_READ');
  return sql(`SELECT CONCAT(state_version, ' ', CHAR_LENGTH(state_json)) FROM \`${schema}\`.it6_release_studio WHERE studio_id='primary';`);
}
async function simpleChain(token) {
  const created = await command(token, 'RELEASE_CREATE', 'rv1-simple', { title: '简审课文', kind: 'TEXT' });
  const rights = await command(token, 'RELEASE_BIND_RIGHTS', 'rv1-simple', { versionNumber: 1, copyrightRef: 'rights-rv1' });
  const report = await command(token, 'RELEASE_BIND_REPORT', 'rv1-simple', { versionNumber: 1, reportMode: 'SIMPLE', reportRef: 'report-rv1' });
  const submitted = await command(token, 'RELEASE_SUBMIT', 'rv1-simple', {});
  const published = await command(token, 'RELEASE_PUBLISH', 'rv1-simple', {});
  const pinned = await command(token, 'RELEASE_PIN', 'rv1-simple', { versionNumber: 1 });
  const finger = await command(token, 'RELEASE_FINGERPRINT', 'desk', {});
  const fingerprint = finger.data && typeof finger.data.fingerprint === 'string' ? finger.data.fingerprint : '';
  const ok = created.status === 202 && rights.status === 200 && report.status === 200
    && submitted.status === 202 && published.status === 202 && pinned.status === 200
    && finger.status === 200 && fingerprint.includes('rv1-simple#1') && fingerprint.includes('SIMPLE');
  return { ok, fingerprint, created: created.status, rights: rights.status, report: report.status, submitted: submitted.status, published: published.status, pinned: pinned.status, finger: finger.status };
}
function track(page, calls) {
  page.on('response', async (response) => {
    const raw = response.url();
    if (!/adult-gate|\/iam\/consents|\/learner\/targets|\/auth\/register/.test(raw)) return;
    let body = '';
    try { body = (await response.text()).slice(0, 400); } catch { body = ''; }
    body = body.replace(/("accessToken"\s*:\s*")[^"]*/g, '$1[REDACTED]');
    let path = raw;
    let origin = '';
    try { const url = new URL(raw); path = url.pathname; origin = url.origin; } catch { /* keep raw */ }
    calls.push({ method: response.request().method(), origin, path, status: response.status(), body, raw: raw.slice(0, 180) });
  });
}
async function shot(page, name) {
  try { await page.screenshot({ path: join(evidenceDir, 'screenshots', name), fullPage: true }); }
  catch { /* closed */ }
}
async function registerOnPage(page, label, mobile) {
  const identifier = `rv2-${label}-${suffix}@example.invalid`;
  const userPassword = `Aa1!${randomBytes(12).toString('hex')}`;
  if (mobile) {
    await page.goto(`http://127.0.0.1:18183/#/pages/register/register`, { waitUntil: 'domcontentloaded' });
    await page.locator('.yx-field input').nth(0).fill(identifier);
    await page.locator('.yx-field input').nth(1).fill(userPassword);
    await page.locator('.yx-field input').nth(2).fill(userPassword);
  } else {
    await page.goto('http://127.0.0.1:18180/register', { waitUntil: 'domcontentloaded' });
    const inputs = page.locator('input');
    await inputs.nth(0).fill(identifier);
    await inputs.nth(1).fill(userPassword);
    await inputs.nth(2).fill(userPassword);
  }
  await page.getByRole('button', { name: '注册并继续' }).click();
  return identifier;
}
async function walkMinor(browser, viewport, label, mobile) {
  const calls = [];
  const context = await browser.newContext({ viewport, locale: 'zh-CN' });
  const page = await context.newPage();
  track(page, calls);
  try {
    await registerOnPage(page, label, mobile);
    if (mobile) await page.locator('.birth-year input').fill(String(minorYear), { timeout: 20000 });
    else await page.locator('#adult-birth-year').fill(String(minorYear), { timeout: 20000 });
    if (mobile) await page.locator('.consent').filter({ hasText: '我确认自己已满 18 周岁' }).locator('.uni-checkbox-input, uni-checkbox').first().click();
    else await page.getByText('我确认自己已满 18 周岁').click();
    await page.getByRole('button', { name: '继续', exact: true }).click();
    await page.getByText('暂不能向你开放学习功能').waitFor({ timeout: 20000 });
    const register = calls.find((call) => call.path.endsWith('/auth/register') && call.method === 'POST');
    const gate = [...calls].reverse().find((call) => call.path.endsWith('/iam/adult-gate') && call.method === 'POST');
    const retry = await page.getByRole('button', { name: '再试一次' }).count();
    const changeYear = await page.getByRole('button', { name: '改年份' }).count();
    const onForbidden = page.url().includes('forbidden');
    const gateOriginOk = Boolean(gate) && (gate.origin === 'https://127.0.0.1:18087' || gate.origin === 'http://127.0.0.1:18070');
    const registerIam = Boolean(register) && register.origin === 'https://127.0.0.1:18087' && register.status === 201;
    const ok = registerIam && gateOriginOk && gate.status === 200 && String(gate.body).includes('REJECTED')
      && onForbidden && retry === 0 && changeYear === 0;
    record(`minor-year-${label}`, ok ? 'PASS' : 'FAIL', {
      year: minorYear, registerOrigin: register && register.origin, origin: gate && gate.origin, path: gate && gate.path,
      status: gate && gate.status, rejected: gate ? String(gate.body).includes('REJECTED') : false, url: page.url(), retry, changeYear,
    });
    await shot(page, `minor-${label}.png`);
  } catch (error) {
    await shot(page, `failure-minor-${label}.png`);
    const body = await page.locator('body').innerText().catch(() => '');
    record(`minor-year-${label}`, 'FAIL', { error: String(error.message || error), url: page.url(), body: body.slice(0, 400) });
  } finally {
    writeFileSync(join(evidenceDir, `calls-minor-${label}.json`), JSON.stringify(calls, null, 2));
    await context.close();
  }
}
async function acceptConsents(page, mobile) {
  if (mobile) {
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
  } else {
    await page.getByRole('heading', { name: '完成必要同意' }).waitFor({ timeout: 15000 });
    const boxes = page.locator('form input[type=checkbox]');
    for (let index = 0; index < await boxes.count(); index += 1) await boxes.nth(index).check();
  }
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.getByText('选择学习目标', { exact: true }).waitFor({ timeout: 20000 });
}
async function walkWithdraw(browser, viewport, label, mobile) {
  const calls = [];
  const context = await browser.newContext({ viewport, locale: 'zh-CN' });
  const page = await context.newPage();
  track(page, calls);
  try {
    await registerOnPage(page, `wd-${label}`, mobile);
    if (mobile) await page.locator('.birth-year input').fill('1990', { timeout: 20000 });
    else await page.locator('#adult-birth-year').fill('1990', { timeout: 20000 });
    if (mobile) await page.locator('.consent').filter({ hasText: '我确认自己已满 18 周岁' }).locator('.uni-checkbox-input, uni-checkbox').first().click();
    else await page.getByText('我确认自己已满 18 周岁').click();
    await page.getByRole('button', { name: '继续', exact: true }).click();
    await acceptConsents(page, mobile);
    if (mobile) await page.goto('http://127.0.0.1:18183/#/pages/settings/settings', { waitUntil: 'domcontentloaded' });
    else await page.goto('http://127.0.0.1:18180/settings/privacy', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '撤回学习同意' }).click({ timeout: 15000 });
    await page.getByRole('button', { name: '确认撤回' }).click();
    await page.getByText('学习同意已撤回').waitFor({ timeout: 20000 });
    const consentPuts = calls.filter((call) => call.method === 'PUT' && call.path.endsWith('/iam/consents'));
    const consent = consentPuts.length ? consentPuts[consentPuts.length - 1] : null;
    const consentIndex = consent ? calls.lastIndexOf(consent) : -1;
    const targets = consentIndex >= 0
      ? calls.slice(consentIndex + 1).reverse().find((call) => call.path.endsWith('/learner/targets') && call.method === 'GET')
      : null;
    const withdrawn = Boolean(consent) && consent.status === 200
      && String(consent.body).includes('ADULT_LEARNING') && String(consent.body).includes('WITHDRAWN');
    const blocked = Boolean(targets) && targets.status === 403 && String(targets.body).includes('CONSENT_REQUIRED');
    const stayed = mobile ? page.url().includes('settings') : page.url().includes('/settings');
    const ok = withdrawn && blocked && stayed;
    record(`withdraw-${label}`, ok ? 'PASS' : 'FAIL', {
      consent: consent && consent.status, withdrawn, targets: targets && targets.status,
      consentRequired: targets ? String(targets.body).includes('CONSENT_REQUIRED') : false,
      url: page.url(), stayed,
    });
    await shot(page, `withdraw-${label}.png`);
  } catch (error) {
    await shot(page, `failure-withdraw-${label}.png`);
    const body = await page.locator('body').innerText().catch(() => '');
    record(`withdraw-${label}`, 'FAIL', { error: String(error.message || error), url: page.url(), body: body.slice(0, 500), calls: calls.slice(-6) });
  } finally {
    writeFileSync(join(evidenceDir, `calls-withdraw-${label}.json`), JSON.stringify(calls, null, 2));
    await context.close();
  }
}
function nodeSuite(caPemPath) {
  const output = join(evidenceDir, 'node-suite.log');
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
        MOBILE_SUPPORT_UAT_OUTPUT: join('/tmp', `rv2-support-uat-${suffix}`),
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
  record('node-suite', exit === 0 && fail === 0 ? 'PASS' : 'FAIL', { exit, tests, pass, fail });
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
  runtime = { trustArgs, commonSecurity, dbPassword };
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
  const content = startContent();
  await waitHealth(content, () => request({ port: ports.content, path: '/actuator/health' }), 'CONTENT');
  const signer = readFileSync(material.signerPem, 'utf8');
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
    ASSESSMENT_PLACEMENT_SCORE_SERVICE_TOKEN: serviceToken(signer),
  });
  await waitHealth(assessment, () => request({ port: ports.assessment, path: '/actuator/health' }), 'ASSESSMENT');
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
    LEARNER_SERVICE_BASE_URL: 'http://127.0.0.1:18088', CONTENT_SERVICE_BASE_URL: 'http://127.0.0.1:18089',
    ASSESSMENT_SERVICE_BASE_URL: 'http://127.0.0.1:18091', ADMIN_OPS_SERVICE_BASE_URL: 'http://127.0.0.1:18097',
    IAM_SERVICE_BASE_URL: 'https://127.0.0.1:18087',
    GATEWAY_RATE_LIMIT_BACKEND: 'memory', GATEWAY_RATE_LIMIT_HIGH_RISK_ADMIN_REQUESTS: '2000',
  });
  await waitHealth(gateway, () => request({ port: ports.gateway, path: '/actuator/health' }), 'GATEWAY');
  const mobile = startNode('mobile-h5', ['--filter', '@englishflow/mobile', 'dev:h5']);
  await waitHealth(mobile, () => request({ port: ports.mobile, path: '/', accept: 'text/html' }), 'MOBILE');
  nodeSuite(material.caPem);
}

try {
  qidaBefore = qidaNames();
  await main();
} catch (error) {
  record('stack', 'FAIL', { error: String(error.stack || error.message || error).slice(0, 1200) });
} finally {
  await stopAll();
  try { dropSchemas(); record('schemas-dropped', 'PASS', { suffix, prefix: 'rv2_' }); }
  catch (error) { record('schemas-dropped', 'FAIL', { error: String(error.message || error) }); }
  const qidaAfter = qidaNames();
  record('qida-unchanged', qidaBefore.join() === qidaAfter.join() ? 'PASS' : 'FAIL', {
    before: qidaBefore.length, after: qidaAfter.length, dockerMutations: 'none',
  });
  const failed = steps.filter((step) => step.status === 'FAIL');
  writeFileSync(join(evidenceDir, 'steps.json'), JSON.stringify({ suffix, steps }, null, 2));
  const lines = [
    '# rv2 node suite',
    '',
    `suffix: ${suffix}`,
    `directory: evidence/redesign/2026-10-11/rv2-${suffix}/node`,
    '',
    ...steps.map((step) => `- ${step.status} ${step.name}`),
    '',
    failed.length ? `failed: ${failed.map((step) => step.name).join(', ')}` : 'failed: none',
  ];
  writeFileSync(join(evidenceDir, 'report.md'), lines.join('\n') + '\n');
  rmSync(directory, { recursive: true, force: true });
  note(failed.length ? `RV2_NODE_FAIL ${failed.map((step) => step.name).join(',')}` : 'RV2_NODE_PASS');
  process.exitCode = failed.length ? 1 : 0;
}
