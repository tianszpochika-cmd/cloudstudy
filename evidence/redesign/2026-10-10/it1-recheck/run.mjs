import { spawn, execFileSync } from 'node:child_process';
import { createHash, createSign, randomBytes, randomUUID } from 'node:crypto';
import { chmodSync, createWriteStream, mkdirSync, readFileSync, writeFileSync, writeSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = '/Users/Admin/Desktop/work/cloudstudy';
const evidence = join(root, 'evidence/redesign/2026-10-10/it1-recheck');
if (evidence.includes('station-acceptance')) throw new Error('REFUSING_HISTORICAL_EVIDENCE');
const container = 'yuxuexing-local-mysql-1';
const suffix = randomBytes(4).toString('hex');
const names = {
  iam: [`it1_recheck_20261010_iam_${suffix}`, `it1r_iam_${suffix}`],
  learner: [`it1_recheck_20261010_lrn_${suffix}`, `it1r_lrn_${suffix}`],
  content: [`it1_recheck_20261010_cnt_${suffix}`, `it1r_cnt_${suffix}`],
  assessment: [`it1_recheck_20261010_asm_${suffix}`, `it1r_asm_${suffix}`],
};
const directory = join(tmpdir(), `it1-recheck-${suffix}`);
const javaHome = process.env.JAVA_HOME || '/Users/Admin/.local/tools/jdk';
const ports = { iam: 18087, learner: 18088, content: 18089, assessment: 18091, gateway: 18070, web: 18180, mobile: 18183 };
const issuer = 'http://127.0.0.1:18087';
const jwks = 'https://127.0.0.1:18087/api/v1/auth/jwks';
const audience = 'yuxuexing-api';
const iamOrigin = 'https://127.0.0.1:18087';
const gatewayOrigin = 'http://127.0.0.1:18070';
const children = [];
const steps = [];
const allCalls = [];
let password = '';
let tlsCa = null;
let keychainsBefore = [];
let keychainPath = '';
let qidaBefore = [];
let learnerArgs = null;
let learnerEnv = null;
const retained = ['r1_it1_browser_20261010_iam_5d9f4b7e', 'r1_it1_browser_20261010_cnt_5d9f4b7e'];
const userPassword = `Aa1!${randomBytes(12).toString('hex')}`;

mkdirSync(evidence, { recursive: true });
mkdirSync(join(evidence, 'screenshots'), { recursive: true });

function note(line) { writeSync(1, String(line) + '\n'); }
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
  const safe = JSON.parse(JSON.stringify(detail ?? {}).split(userPassword).join('[redacted]'));
  steps.push({ name, status, detail: safe });
  note(`${status} ${name} ${JSON.stringify(safe).slice(0, 400)}`);
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
  if (payload) {
    headers['content-type'] = 'application/json';
    headers['content-length'] = String(payload.length);
  }
  const lib = options.https ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request({
      host: '127.0.0.1', port: options.port, path: options.path, method: options.method || 'GET', headers,
      ca: options.https ? tlsCa : undefined, rejectUnauthorized: true, timeout: options.timeout || 8000,
      servername: '127.0.0.1',
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        body: Buffer.concat(chunks).toString('utf8'),
        headers: response.headers,
      }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (payload) req.end(payload); else req.end();
  });
}
function startJava(id, args, env) {
  const out = createWriteStream(join(evidence, id + '.log'));
  const child = spawn(join(javaHome, 'bin', 'java'), args, {
    cwd: root, detached: true, env: { ...process.env, JAVA_HOME: javaHome, PATH: `${javaHome}/bin:${process.env.PATH}`, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(out); child.stderr.pipe(out);
  child.on('exit', (code) => note(id + '_EXIT ' + code));
  children.push({ id, child });
  return child;
}
function startNode(id, args) {
  const out = createWriteStream(join(evidence, id + '.log'));
  const child = spawn('pnpm', args, { cwd: root, detached: true, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(out); child.stderr.pipe(out);
  child.on('exit', (code) => note(id + '_EXIT ' + code));
  children.push({ id, child });
  return child;
}
async function waitHealth(child, probe, label) {
  const deadline = Date.now() + 180000;
  let last = 'none';
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(label + '_DIED ' + child.exitCode);
    try {
      const health = await probe();
      last = String(health.status);
      if (health.status === 200) { note(label + '_HEALTH 200'); return; }
    } catch (error) { last = error.message; }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(label + '_HEALTH_TIMEOUT ' + last);
}
async function stopChild(entry) {
  const child = entry?.child;
  if (!child || child.pid == null || child.exitCode != null) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch { /* gone */ } }
  const deadline = Date.now() + 12000;
  while (child.exitCode == null && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 200));
  if (child.exitCode == null) {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* gone */ } }
  }
}
async function stopAll() {
  for (const entry of children.reverse()) await stopChild(entry);
}
function restoreKeychains() {
  if (!keychainsBefore.length) return;
  run('security', ['list-keychains', '-d', 'user', '-s', ...keychainsBefore]);
  if (keychainPath) {
    try { run('security', ['delete-keychain', keychainPath]); } catch { /* already gone */ }
  }
}
async function restartLearner() {
  const current = children.filter((entry) => entry.id.startsWith('learner-service') || entry.id.startsWith('learner-restart'));
  for (const entry of current) await stopChild(entry);
  const freeDeadline = Date.now() + 20000;
  while (listeners(ports.learner).trim() && Date.now() < freeDeadline) await new Promise((resolve) => setTimeout(resolve, 200));
  if (listeners(ports.learner).trim()) throw new Error('LEARNER_PORT_STUCK');
  const child = startJava(`learner-restart-${children.length}`, learnerArgs, learnerEnv);
  await waitHealth(child, () => request({ port: ports.learner, path: '/actuator/health' }), 'LEARNER_RESTART');
}

function assertMysql() {
  const value = JSON.parse(run('docker', ['inspect', container]))[0];
  const facts = {
    name: value.Name, image: value.Config.Image,
    project: value.Config.Labels?.['com.docker.compose.project'],
    service: value.Config.Labels?.['com.docker.compose.service'],
    status: value.State.Status, health: value.State.Health?.Status,
    port: value.NetworkSettings?.Ports?.['3306/tcp'],
  };
  const ok = facts.name === '/' + container && facts.image === 'mysql:8.0' && facts.project === 'yuxuexing-local'
    && facts.service === 'mysql' && facts.status === 'running' && facts.health === 'healthy'
    && JSON.stringify(facts.port) === JSON.stringify([{ HostIp: '127.0.0.1', HostPort: '13306' }]);
  record('mysql-identity', ok ? 'PASS' : 'FAIL', facts);
  if (!ok) throw new Error('MYSQL');
  const entry = (value.Config.Env || []).find((item) => item.startsWith('MYSQL_ROOT_PASSWORD='));
  password = entry.slice('MYSQL_ROOT_PASSWORD='.length);
  qidaBefore = run('docker', ['ps', '--format', '{{.Names}}']).split('\n').filter((name) => name.includes('qida')).sort();
}

function authUrl(surface, kind) {
  if (surface === 'web') return `http://127.0.0.1:18180/${kind === 'reset' ? 'reset-password' : kind}`;
  const page = kind === 'reset' ? 'reset-password/reset-password' : `${kind}/${kind}`;
  return `http://127.0.0.1:18183/#/pages/${page}`;
}
function observe(page, calls) {
  page.on('response', async (response) => {
    let url;
    try { url = new URL(response.url()); } catch { return; }
    if (!url.pathname.startsWith('/api/v1/')) return;
    const entry = { method: response.request().method(), origin: url.origin, path: url.pathname, status: response.status() };
    if (response.request().method() === 'PUT' && url.pathname.endsWith('/learner/targets')) {
      const headers = response.request().headers();
      const request = {
        idempotencyKeyLength: String(headers['idempotency-key'] || '').length,
        requestId: headers['x-request-id'] || null,
        traceId: headers['x-trace-id'] || null,
      };
      try { request.body = response.request().postDataJSON(); }
      catch { request.body = 'unreadable'; }
      entry.request = request;
    }
    if (response.status() >= 400 && response.status() !== 404) {
      try {
        const text = await response.text();
        entry.error = text.slice(0, 240);
      } catch { entry.error = 'unreadable'; }
    }
    calls.push(entry);
  });
}
async function shot(page, name) {
  await page.screenshot({ path: join(evidence, 'screenshots', name), mask: [page.locator('input')] });
}
async function fillInput(page, selector, value) {
  const field = page.locator(selector).first();
  await field.waitFor({ timeout: 20000 });
  await field.fill(value);
}
async function clickAuth(page, buttonName, pathSuffix) {
  const pending = page.waitForResponse((response) => {
    try {
      const url = new URL(response.url());
      return response.request().method() === 'POST' && url.pathname.endsWith(pathSuffix);
    } catch { return false; }
  }, { timeout: 20000 });
  await page.getByRole('button', { name: buttonName, exact: true }).click();
  const response = await pending;
  const url = new URL(response.url());
  return { method: 'POST', origin: url.origin, path: url.pathname, status: response.status() };
}
function authOk(call, status) {
  return Boolean(call) && call.origin === iamOrigin && call.status === status;
}
async function withPage(browser, viewport, fn) {
  const context = await browser.newContext({ viewport, locale: 'zh-CN' });
  const page = await context.newPage();
  const calls = [];
  observe(page, calls);
  try {
    await fn(page, calls);
  } catch (error) {
    try { await shot(page, 'failure.png'); } catch { /* page already closed */ }
    const body = await page.locator('body').innerText().catch(() => '');
    const failed = [...calls].reverse().find((call) => call.error);
    record('browser-walk', 'FAIL', {
      error: String(error && error.message ? error.message : error).slice(0, 300),
      url: page.url(),
      body: body.slice(0, 180),
      failed: failed || null,
    });
    throw error;
  } finally {
    allCalls.push(...calls);
    await context.close();
  }
}
async function submitAuth(page, surface, kind, identifier) {
  await page.goto(authUrl(surface, kind), { waitUntil: 'domcontentloaded' });
  if (surface === 'h5') {
    const inputs = page.locator('input:visible');
    await inputs.first().waitFor({ timeout: 20000 });
    await inputs.nth(0).fill(identifier);
    if (kind !== 'reset') await inputs.nth(1).fill(userPassword);
    if (kind === 'register') await inputs.nth(2).fill(userPassword);
  } else {
    const account = 'input[name="identifier"], input[aria-label="账号"]';
    const secret = 'input[name="password"], input[aria-label="密码"], input[aria-label="密码（至少 12 位）"]';
    const confirm = 'input[name="confirm"], input[aria-label="确认密码"]';
    await fillInput(page, account, identifier);
    if (kind !== 'reset') await fillInput(page, secret, userPassword);
    if (kind === 'register') await fillInput(page, confirm, userPassword);
  }
  if (kind === 'register') return clickAuth(page, '注册并继续', '/auth/register');
  if (kind === 'login') return clickAuth(page, '登录并继续', '/auth/login');
  return clickAuth(page, '发送重置指引', '/auth/password-reset/request');
}
async function destinationCell(browser, cell, resetIdentifier) {
  const label = `${cell.surface}-${cell.viewport.width}x${cell.viewport.height}`;
  await withPage(browser, cell.viewport, async (page) => {
    const call = await submitAuth(page, cell.surface, 'register', cell.id);
    const ok = authOk(call, 201);
    record(`register-${label}`, ok ? 'PASS' : 'FAIL', call);
    if (!ok) throw new Error('REGISTER ' + label);
  });
  await withPage(browser, cell.viewport, async (page) => {
    const call = await submitAuth(page, cell.surface, 'login', cell.id);
    const ok = authOk(call, 200);
    record(`login-${label}`, ok ? 'PASS' : 'FAIL', call);
    if (!ok) throw new Error('LOGIN ' + label);
  });
  await withPage(browser, cell.viewport, async (page) => {
    const call = await submitAuth(page, cell.surface, 'reset', resetIdentifier);
    const ok = authOk(call, 202);
    record(`reset-${label}`, ok ? 'PASS' : 'FAIL', { ...call, account: resetIdentifier === cell.id ? 'existing' : 'unknown' });
    if (!ok) throw new Error('RESET ' + label);
  });
}
async function clickRow(row) {
  const box = row.locator('.uni-checkbox-input, uni-checkbox, input[type=checkbox]').first();
  if (await box.count()) await box.click();
  else await row.click();
}
async function chainWeb(page, calls) {
  await page.waitForURL(/onboarding|adult/, { timeout: 20000 });
  await page.locator('#adult-birth-year').fill('1990');
  await page.getByText('我确认自己已满 18 周岁').click();
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.getByRole('heading', { name: '完成必要同意' }).waitFor({ timeout: 20000 });
  const boxes = page.locator('form input[type=checkbox]');
  for (let index = 0; index < await boxes.count(); index += 1) await boxes.nth(index).check();
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.locator('[data-goal-code=FOUNDATION]').click();
  await page.locator('[data-primary-action=save-target]').click();
  await page.waitForURL(/\/assessment/, { timeout: 20000 });
  await page.getByRole('button', { name: '开始', exact: true }).click({ timeout: 20000 });
  await page.getByRole('button', { name: '提交答案' }).waitFor({ timeout: 20000 });
  const refresh = calls.filter((call) => call.path.endsWith('/auth/token/refresh'));
  const target = [...calls].reverse().find((call) => call.method === 'PUT' && call.path.endsWith('/learner/targets'));
  const refreshOk = refresh.length > 0 && refresh.every((call) => call.origin === iamOrigin && call.status === 200);
  const targetOk = Boolean(target) && target.origin === gatewayOrigin && target.status === 200;
  record('web-chain-placement-entry', refreshOk && targetOk ? 'PASS' : 'FAIL', { url: page.url(), refresh, target: target || null });
  await shot(page, 'web-placement.png');
  if (!refreshOk || !targetOk) throw new Error('WEB_CHAIN');
  const mark = calls.length;
  await restartLearner();
  await page.goto('http://127.0.0.1:18180/onboarding', { waitUntil: 'domcontentloaded' });
  await page.getByText('目标已保存', { exact: true }).first().waitFor({ timeout: 25000 });
  const read = calls.slice(mark).find((call) => call.method === 'GET' && call.path.endsWith('/learner/targets') && call.status === 200);
  const readOk = Boolean(read) && read.origin === gatewayOrigin;
  record('web-profile-readback-after-learner-restart', readOk ? 'PASS' : 'FAIL', { url: page.url(), read: read || null });
  await shot(page, 'web-readback.png');
  if (!readOk) throw new Error('WEB_READBACK');
}
async function chainH5(page, calls) {
  await page.waitForURL(/onboarding/, { timeout: 20000 });
  await page.getByText('确认成人身份').first().waitFor({ timeout: 20000 });
  const year = page.locator('input[placeholder="例如 1995"], input:visible').first();
  await year.waitFor({ timeout: 20000 });
  await year.fill('1990');
  await clickRow(page.locator('label.consent, .consent').filter({ hasText: '我确认自己已满 18 周岁' }).first());
  await page.locator('[data-primary-action=continue]').click();
  await page.getByText('完成必要同意').waitFor({ timeout: 20000 });
  const rows = page.locator('.consent');
  await rows.first().waitFor({ timeout: 15000 });
  for (let index = 0; index < await rows.count(); index += 1) await clickRow(rows.nth(index));
  await page.locator('[data-primary-action=continue]').click();
  await page.locator('[data-goal-code=FOUNDATION]').click();
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-primary-action=save-target]');
    return Boolean(button && !button.hasAttribute('disabled') && !button.disabled);
  }, null, { timeout: 20000 });
  await page.locator('[data-primary-action=save-target]').click();
  await page.waitForFunction(() => /assessment/.test(location.href), null, { timeout: 20000 });
  await page.getByRole('button', { name: '开始', exact: true }).click({ timeout: 20000 });
  await page.getByRole('button', { name: '提交答案' }).waitFor({ timeout: 20000 });
  const refresh = calls.filter((call) => call.path.endsWith('/auth/token/refresh'));
  const target = [...calls].reverse().find((call) => call.method === 'PUT' && call.path.endsWith('/learner/targets'));
  const refreshOk = refresh.length > 0 && refresh.every((call) => call.origin === iamOrigin && call.status === 200);
  const targetOk = Boolean(target) && target.origin === gatewayOrigin && target.status === 200;
  record('h5-chain-placement-entry', refreshOk && targetOk ? 'PASS' : 'FAIL', { url: page.url(), refresh, target: target || null });
  await shot(page, 'h5-placement.png');
  if (!refreshOk || !targetOk) throw new Error('H5_CHAIN');
  const mark = calls.length;
  await restartLearner();
  await page.goto('http://127.0.0.1:18183/#/pages/onboarding/onboarding', { waitUntil: 'domcontentloaded' });
  await page.getByText('目标已保存', { exact: true }).first().waitFor({ timeout: 25000 });
  const read = calls.slice(mark).find((call) => call.method === 'GET' && call.path.endsWith('/learner/targets') && call.status === 200);
  const readOk = Boolean(read) && read.origin === gatewayOrigin;
  record('h5-profile-readback-after-learner-restart', readOk ? 'PASS' : 'FAIL', { url: page.url(), read: read || null });
  await shot(page, 'h5-readback.png');
  if (!readOk) throw new Error('H5_READBACK');
}
async function chainCell(browser, cell) {
  const label = `${cell.surface}-${cell.viewport.width}x${cell.viewport.height}`;
  await withPage(browser, cell.viewport, async (page, calls) => {
    const call = await submitAuth(page, cell.surface, 'register', cell.id);
    const ok = authOk(call, 201);
    record(`register-${label}`, ok ? 'PASS' : 'FAIL', call);
    if (!ok) throw new Error('REGISTER ' + label);
    if (cell.surface === 'web') await chainWeb(page, calls);
    else await chainH5(page, calls);
  });
}

async function checkCors() {
  for (const origin of ['http://127.0.0.1:18180', 'http://127.0.0.1:18183']) {
    const response = await request({
      port: ports.iam, path: '/api/v1/auth/register', method: 'OPTIONS', https: true,
      headers: {
        origin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type,idempotency-key',
      },
    });
    const allowOrigin = response.headers['access-control-allow-origin'];
    const allowCredentials = String(response.headers['access-control-allow-credentials'] || '');
    const allowMethods = String(response.headers['access-control-allow-methods'] || '');
    const ok = (response.status === 200 || response.status === 204)
      && allowOrigin === origin
      && allowCredentials.toLowerCase() === 'true'
      && allowMethods.toUpperCase().includes('POST');
    record(`cors-${origin}`, ok ? 'PASS' : 'FAIL', {
      status: response.status, allowOrigin, allowCredentials, allowMethods,
    });
    if (!ok) throw new Error('CORS');
  }
}

async function walkBrowser() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const cells = [
      { surface: 'web', viewport: { width: 390, height: 844 }, chain: false, id: `it1-web-phone-${suffix}@example.invalid` },
      { surface: 'h5', viewport: { width: 1280, height: 900 }, chain: false, id: `it1-h5-desk-${suffix}@example.invalid` },
      { surface: 'web', viewport: { width: 1280, height: 900 }, chain: true, id: `it1-web-desk-${suffix}@example.invalid` },
      { surface: 'h5', viewport: { width: 390, height: 844 }, chain: true, id: `it1-h5-phone-${suffix}@example.invalid` },
    ];
    for (const cell of cells) {
      const resetIdentifier = cell.surface === 'h5' && !cell.chain
        ? `missing-${suffix}@example.invalid`
        : cell.id;
      if (cell.chain) {
        await chainCell(browser, cell);
        await withPage(browser, cell.viewport, async (page) => {
          const label = `${cell.surface}-${cell.viewport.width}x${cell.viewport.height}`;
          const login = await submitAuth(page, cell.surface, 'login', cell.id);
          const loginOk = authOk(login, 200);
          record(`login-${label}`, loginOk ? 'PASS' : 'FAIL', login);
          if (!loginOk) throw new Error('LOGIN ' + label);
        });
        await withPage(browser, cell.viewport, async (page) => {
          const label = `${cell.surface}-${cell.viewport.width}x${cell.viewport.height}`;
          const reset = await submitAuth(page, cell.surface, 'reset', resetIdentifier);
          const resetOk = authOk(reset, 202);
          record(`reset-${label}`, resetOk ? 'PASS' : 'FAIL', { ...reset, account: 'existing' });
          if (!resetOk) throw new Error('RESET ' + label);
        });
      } else {
        await destinationCell(browser, cell, resetIdentifier);
      }
    }
    const leaked = allCalls.filter((call) => call.origin === gatewayOrigin
      && ['/auth/register', '/auth/login', '/auth/password-reset/request', '/auth/token/refresh'].some((path) => call.path.endsWith(path)));
    record('passwords-and-refresh-stay-off-gateway', leaked.length === 0 ? 'PASS' : 'FAIL', { leaked });
    if (leaked.length) throw new Error('GATEWAY_AUTH');
  } finally {
    writeFileSync(join(evidence, 'calls.json'), JSON.stringify(allCalls, null, 2));
    await browser.close();
  }
}

async function main() {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  assertMysql();
  const occupied = Object.values(ports).filter((port) => listeners(port).trim());
  record('ports-free', occupied.length === 0 ? 'PASS' : 'FAIL', { occupied });
  if (occupied.length) throw new Error('PORTS');
  const partial = sql('SELECT @@GLOBAL.partial_revokes;');
  const partialRevokes = partial === '1';
  const dbPassword = randomBytes(18).toString('hex');
  for (const [schema, user] of Object.values(names)) {
    if (retained.includes(schema)) throw new Error('REFUSING_TO_TOUCH_RETAINED_SCHEMA');
    sql(`CREATE DATABASE \`${schema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER '${user}'@'%' IDENTIFIED BY '${dbPassword}'; GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,DROP,INDEX,REFERENCES ON ${grantScope(schema, partialRevokes)} TO '${user}'@'%';`);
    const grants = sql(`SHOW GRANTS FOR '${user}'@'%';`);
    const scoped = grants.split('\n').filter((line) => line.includes(' ON ') && !line.includes(' ON *.* '));
    if (scoped.length !== 1) throw new Error('GRANT_SCOPE ' + user);
  }
  record('four-owner-schemas', 'PASS', Object.fromEntries(Object.entries(names).map(([key, value]) => [key, value[0]])));

  const keyPassword = randomBytes(18).toString('hex');
  const trustPassword = randomBytes(18).toString('hex');
  const clientSecret = randomBytes(24).toString('hex');
  const clientDigest = createHash('sha256').update(clientSecret).digest('hex');
  const env = { ...process.env, R1_KEYSTORE_PASSWORD: keyPassword, R1_TRUST_PASSWORD: trustPassword };
  run('openssl', ['req', '-x509', '-newkey', 'rsa:3072', '-nodes', '-sha256', '-days', '2',
    '-subj', '/CN=IT1 recheck loopback', '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost',
    '-keyout', join(directory, 'test-key.pem'), '-out', join(directory, 'test-ca.pem')]);
  chmodSync(join(directory, 'test-key.pem'), 0o600);
  run('openssl', ['pkcs12', '-export', '-in', join(directory, 'test-ca.pem'), '-inkey', join(directory, 'test-key.pem'),
    '-out', join(directory, 'iam-server.p12'), '-name', 'it1-recheck', '-passout', 'env:R1_KEYSTORE_PASSWORD'], { env });
  run('keytool', ['-importcert', '-noprompt', '-alias', 'it1-recheck', '-file', join(directory, 'test-ca.pem'),
    '-keystore', join(directory, 'trust.p12'), '-storetype', 'PKCS12', '-storepass:env', 'R1_TRUST_PASSWORD'], { env });
  run('openssl', ['genpkey', '-algorithm', 'RSA', '-pkeyopt', 'rsa_keygen_bits:3072', '-out', join(directory, 'iam-signer.pem')]);
  chmodSync(join(directory, 'iam-signer.pem'), 0o600);
  tlsCa = readFileSync(join(directory, 'test-ca.pem'));
  const signer = readFileSync(join(directory, 'iam-signer.pem'), 'utf8');
  const scoreToken = serviceToken(signer);
  const trustArgs = [
    `-Djavax.net.ssl.trustStore=${join(directory, 'trust.p12')}`,
    '-Djavax.net.ssl.trustStoreType=PKCS12',
    `-Djavax.net.ssl.trustStorePassword=${trustPassword}`,
    '-Dio.netty.handler.ssl.noOpenSsl=true',
  ];
  const iamConfig = join(directory, 'iam.properties');
  writeFileSync(iamConfig, [
    'server.address=127.0.0.1', 'server.port=18087', 'server.ssl.enabled=true',
    'server.ssl.key-store-type=PKCS12', 'server.ssl.key-alias=it1-recheck',
    'server.ssl.key-store=' + join(directory, 'iam-server.p12'),
    'server.ssl.key-store-password=' + keyPassword,
    'iam.persistence.enabled=true', 'spring.flyway.enabled=true',
    'iam.persistence.jdbc-url=' + jdbc(names.iam[0]),
    'iam.persistence.schema=' + names.iam[0],
    'iam.persistence.username=' + names.iam[1],
    'iam.persistence.password=' + dbPassword,
    'iam.idempotency.v13-writers-drained=true',
    'iam.idempotency.replay-secret=' + randomBytes(32).toString('base64url'),
    'iam.idempotency.fingerprint-secret=' + randomBytes(32).toString('base64url'),
    'iam.jwt.private-key-file=' + join(directory, 'iam-signer.pem'),
    'iam.jwt.ephemeral-keys-allowed=false', 'iam.jwt.refresh-cookie-secure=true',
    'iam.jwt.issuer=' + issuer, 'iam.jwt.key-id=iam-local-2026-08',
    'iam.consent.policy-source=local-candidate', 'iam.local-adult-gate-enabled=true',
  ].join('\n') + '\n', { mode: 0o600 });

  const iam = startJava('iam-service', [
    '-Dfile.encoding=UTF-8', '-jar', join(root, 'services/iam-service/target/iam-service-0.1.0-SNAPSHOT.jar'),
    '--spring.profiles.active=local', '--spring.config.import=' + pathToFileURL(iamConfig).href,
    '--iam.jwt.ephemeral-keys-allowed=false',
    '--management.otlp.metrics.export.enabled=false', '--management.opentelemetry.enabled=false',
  ], { IAM_SERVICE_CLIENT_LEARNER_SECRET_DIGEST: clientDigest });
  await waitHealth(iam, () => request({ port: ports.iam, path: '/actuator/health', https: true }), 'IAM');

  const commonSecurity = {
    IAM_JWT_ISSUER: issuer, IAM_JWT_JWKS_URI: jwks, IAM_JWT_AUDIENCE: audience,
  };
  const content = startJava('content-service', [
    ...trustArgs, '-jar', join(root, 'services/content-service/target/content-service-0.1.0-SNAPSHOT.jar'),
  ], {
    ...commonSecurity, CONTENT_PERSISTENCE_MODE: 'jdbc', CONTENT_FLYWAY_ENABLED: 'true',
    CONTENT_SERVICE_SCHEMA: names.content[0], CONTENT_JDBC_URL: jdbc(names.content[0]),
    CONTENT_JDBC_USERNAME: names.content[1], CONTENT_JDBC_PASSWORD: dbPassword,
    CONTENT_SERVICE_PORT: '18089', CONTENT_SERVICE_SERVER_ADDRESS: '127.0.0.1',
    CONTENT_EVENT_RELAY_ENABLED: 'false', CONTENT_EVENT_CONSUMER_ENABLED: 'false',
    CONTENT_SERVICE_SECURITY_ISSUER_URI: issuer, CONTENT_SERVICE_SECURITY_JWK_SET_URI: jwks,
    CONTENT_SERVICE_SECURITY_AUDIENCE: audience,
  });
  await waitHealth(content, () => request({ port: ports.content, path: '/actuator/health' }), 'CONTENT');
  const seeded = sql(`SELECT COUNT(*) FROM \`${names.content[0]}\`.content_placement_item;`);
  record('content-seed-own-schema', seeded === '10' ? 'PASS' : 'FAIL', { seeded, schema: names.content[0] });
  if (seeded !== '10') throw new Error('SEED');

  learnerArgs = [
    ...trustArgs, '-jar', join(root, 'services/learner-service/target/learner-service-0.1.0-SNAPSHOT.jar'),
  ];
  learnerEnv = {
    ...commonSecurity, LEARNER_PERSISTENCE_MODE: 'jdbc', LEARNER_FLYWAY_ENABLED: 'true',
    LEARNER_SCHEMA: names.learner[0], LEARNER_JDBC_URL: jdbc(names.learner[0]),
    LEARNER_JDBC_USERNAME: names.learner[1], LEARNER_JDBC_PASSWORD: dbPassword,
    LEARNER_SERVICE_PORT: '18088', SERVER_ADDRESS: '127.0.0.1',
    LEARNER_SECURITY_ISSUER_URI: issuer, LEARNER_SECURITY_JWK_SET_URI: jwks, LEARNER_SECURITY_AUDIENCE: audience,
    LEARNER_CONSENT_RECHECK_ENABLED: 'true', LEARNER_CONSENT_RECHECK_IAM_BASE_URL: 'https://127.0.0.1:18087',
    LEARNER_CONSENT_RECHECK_CLIENT_ID: 'learner-service', LEARNER_CONSENT_RECHECK_CLIENT_SECRET: clientSecret,
  };
  const learner = startJava('learner-service', learnerArgs, learnerEnv);
  await waitHealth(learner, () => request({ port: ports.learner, path: '/actuator/health' }), 'LEARNER');

  const assessment = startJava('assessment-service', [
    ...trustArgs, '-jar', join(root, 'services/assessment-service/target/assessment-service-0.1.0-SNAPSHOT.jar'),
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

  const gateway = startJava('api-gateway', [
    ...trustArgs, '-jar', join(root, 'services/api-gateway/target/api-gateway-0.1.0-SNAPSHOT.jar'),
  ], {
    ...commonSecurity, SPRING_PROFILES_ACTIVE: 'local', API_GATEWAY_PORT: '18070', SERVER_ADDRESS: '127.0.0.1',
    ASSESSMENT_SERVICE_BASE_URL: 'http://127.0.0.1:18091', LEARNER_SERVICE_BASE_URL: 'http://127.0.0.1:18088',
    CONTENT_SERVICE_BASE_URL: 'http://127.0.0.1:18089', IAM_SERVICE_BASE_URL: 'https://127.0.0.1:18087',
    GATEWAY_RATE_LIMIT_BACKEND: 'memory',
  });
  await waitHealth(gateway, () => request({ port: ports.gateway, path: '/actuator/health' }), 'GATEWAY');

  const web = startNode('learner-web', ['--filter', '@englishflow/learner-web', 'dev']);
  const mobile = startNode('mobile-h5', ['--filter', '@englishflow/mobile', 'dev:h5']);
  await waitHealth(web, () => request({ port: ports.web, path: '/', accept: 'text/html' }), 'WEB');
  await waitHealth(mobile, () => request({ port: ports.mobile, path: '/', accept: 'text/html' }), 'MOBILE');

  keychainsBefore = run('security', ['list-keychains', '-d', 'user']).split('\n').map((line) => line.trim().replaceAll('"', '')).filter(Boolean);
  keychainPath = join(directory, 'browser.keychain-db');
  const keychainPassword = randomBytes(12).toString('hex');
  run('security', ['create-keychain', '-p', keychainPassword, keychainPath]);
  run('security', ['unlock-keychain', '-p', keychainPassword, keychainPath]);
  run('security', ['set-keychain-settings', keychainPath]);
  run('security', ['add-trusted-cert', '-r', 'trustRoot', '-k', keychainPath, join(directory, 'test-ca.pem')]);
  run('security', ['list-keychains', '-d', 'user', '-s', keychainPath, ...keychainsBefore]);
  record('browser-ca-installed-without-ignoring-errors', 'PASS', { keychain: 'temporary-user-keychain' });

  await checkCors();
  await walkBrowser();
}

function writeReport(summary, extra) {
  const lines = [
    '# IT-1 复验',
    '',
    `日期：2026-10-10。目录：\`evidence/redesign/2026-10-10/it1-recheck\`。本轮结论：${summary}。`,
    '',
    '这不是 Luna 的签收。`accepted`、`it1Outbound`、`lunaStamp` 都是 false。`station-acceptance/it1/` 和 `review/final-review.md` 没有改写。',
    '',
    '本轮覆盖 Web 与 H5、1280×900 与 390×844 的注册、登录、重置申请，密码真实提交到 IAM HTTPS；两个学习端 origin 的 CORS 预检；每端一条连续链：成人门、必要同意、画像写入、停掉 learner 再启动后读回、进入定级第一题。没有做完 10 题，也没有重跑幂等回放、踢设备、未成年拒绝、撤回同意。',
    '',
    '| 步骤 | 结果 |',
    '|---|---|',
    ...steps.map((step) => `| ${step.name} | ${step.status} |`),
    '',
    '收尾：' + JSON.stringify(extra),
    '',
  ];
  writeFileSync(join(evidence, 'report.md'), lines.join('\n'));
}

try { await main(); }
catch (error) {
  record('run', 'FAIL', { error: String(error && error.message ? error.message : error) });
} finally {
  try { await stopAll(); } catch (error) { note('STOP ' + error.message); }
  try { restoreKeychains(); note('KEYCHAIN_RESTORED'); } catch (error) { note('KEYCHAIN_RESTORE_FAILED ' + error.message); }
  const dropped = [];
  for (const [schema, user] of Object.values(names)) {
    if (retained.includes(schema)) continue;
    try {
      sql(`DROP DATABASE IF EXISTS \`${schema}\`; DROP USER IF EXISTS '${user}'@'%';`);
      dropped.push(schema + '=' + sql(`SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='${schema}';`));
    } catch { dropped.push(schema + ' dropFailed'); }
  }
  let retainedLeft = 'unchecked';
  try { retainedLeft = sql(`SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name IN ('${retained.join("','")}');`); } catch { retainedLeft = 'queryFailed'; }
  const busy = Object.values(ports).filter((port) => listeners(port).trim());
  let qidaAfter = [];
  try { qidaAfter = run('docker', ['ps', '--format', '{{.Names}}']).split('\n').filter((name) => name.includes('qida')).sort(); } catch { qidaAfter = ['queryFailed']; }
  const summary = steps.some((step) => step.status === 'FAIL') ? 'FAIL' : 'PASS';
  const extra = { dropped, retainedSchemasLeft: retainedLeft, listeners: busy, qidaUnchanged: qidaBefore.join() === qidaAfter.join() };
  const report = {
    summary, accepted: false, it1Outbound: false, lunaStamp: false, historicalRejectUnchanged: true,
    scope: 'web-and-h5-auth-destinations-cors-and-placement-entry-with-profile-readback',
    notCovered: ['idempotency-replay', 'device-kick', 'minor-rejection', 'consent-withdrawal', 'ten-item-score'],
    identity: 'iam-rs256', schemas: 'four-owners', steps, ...extra,
  };
  writeFileSync(join(evidence, 'http-result.json'), JSON.stringify(report, null, 2));
  writeReport(summary, extra);
  note('SUMMARY ' + summary + ' retained=' + retainedLeft + ' listeners=' + (busy.join(',') || 'none'));
  if (summary !== 'PASS') process.exitCode = 1;
}
