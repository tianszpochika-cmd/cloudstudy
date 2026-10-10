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
const evidence = join(root, 'evidence/redesign/2026-10-10/it1-named-gates');
const replayEvidence = join(root, 'evidence/redesign/2026-10-10/R1-014');
const scoreEvidence = join(root, 'evidence/redesign/2026-10-10/it2-score-browser');
if ([evidence, replayEvidence, scoreEvidence].some((dir) => dir.includes('station-acceptance'))) {
  throw new Error('REFUSING_HISTORICAL_EVIDENCE');
}
const container = 'yuxuexing-local-mysql-1';
const suffix = randomBytes(4).toString('hex');
const names = {
  iam: [`r1_named_20261010_iam_${suffix}`, `r1n_iam_${suffix}`],
  learner: [`r1_named_20261010_lrn_${suffix}`, `r1n_lrn_${suffix}`],
  content: [`r1_named_20261010_cnt_${suffix}`, `r1n_cnt_${suffix}`],
  assessment: [`r1_named_20261010_asm_${suffix}`, `r1n_asm_${suffix}`],
};
const directory = join(tmpdir(), `it1-named-${suffix}`);
const javaHome = process.env.JAVA_HOME || '/Users/Admin/.local/tools/jdk';
const ports = { iam: 18087, learner: 18088, content: 18089, assessment: 18091, gateway: 18070, web: 18180, mobile: 18183, official: 18182 };
const issuer = 'http://127.0.0.1:18087';
const jwks = 'https://127.0.0.1:18087/api/v1/auth/jwks';
const audience = 'yuxuexing-api';
const iamOrigin = 'https://127.0.0.1:18087';
const gatewayOrigin = 'http://127.0.0.1:18070';
const children = [];
const steps = [];
const allCalls = [];
const secrets = [];
let mysqlRoot = '';
let tlsCa = null;
let qidaBefore = [];
let learnerArgs = null;
let learnerEnv = null;
let answerKey = new Map();
const retained = ['r1_it1_browser_20261010_iam_5d9f4b7e', 'r1_it1_browser_20261010_cnt_5d9f4b7e'];
const userPassword = `Aa1!${randomBytes(12).toString('hex')}`;
secrets.push(userPassword);
const gateCopy = [
  '只收集出生年份，用来判断是否已满 18 岁。现有成人门不需要月和日，所以不收集完整生日。',
  '如果没有通过，仍可前往账号设置、帮助与反馈或退出登录。这里不提供再试一次，也不提供改年份。',
];
const consentCopy = [
  '账号条款、隐私说明和成人学习资格要逐项看见。开始时不勾选，也不默认全选。',
  '未勾选时，受影响的是学习资格，不是把账号设置、帮助与反馈和退出登录一起禁掉。',
];
const officialPages = ['/', '/about', '/announcements', '/compliance', '/courses', '/download', '/minors', '/pricing', '/privacy', '/status', '/terms'];
const desktop = { width: 1280, height: 900 };
const phone = { width: 390, height: 844 };

for (const dir of [evidence, replayEvidence, scoreEvidence, join(evidence, 'screenshots'), join(scoreEvidence, 'screenshots')]) {
  mkdirSync(dir, { recursive: true });
}

function note(line) { writeSync(1, String(line) + '\n'); }
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function waitForRecorded(calls, predicate, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = [...calls].reverse().find(predicate);
    if (found) return found;
    await delay(40);
  }
  return null;
}
async function installTokenTap(page, bag) {
  await page.exposeBinding('__r1NoteBearer', (_source, value) => {
    if (typeof value === 'string' && value.startsWith('Bearer ') && value.length > 20) bag.token = value;
  });
  await page.addInitScript(() => {
    const noteBearer = (value) => {
      if (typeof value === 'string' && value.startsWith('Bearer ') && typeof window.__r1NoteBearer === 'function') {
        void window.__r1NoteBearer(value);
      }
    };
    const readAuthorization = (headers) => {
      if (!headers) return '';
      if (typeof headers.get === 'function') return headers.get('authorization') || headers.get('Authorization') || '';
      if (Array.isArray(headers)) {
        const found = headers.find((entry) => Array.isArray(entry) && String(entry[0]).toLowerCase() === 'authorization');
        return found ? String(found[1]) : '';
      }
      return headers.authorization || headers.Authorization || '';
    };
    const originalFetch = window.fetch;
    window.fetch = function fetchWithTap(input, init) {
      try { noteBearer(readAuthorization(init && init.headers)); } catch { /* observation only */ }
      return originalFetch.apply(this, arguments);
    };
    const originalSet = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function setRequestHeaderWithTap(name, value) {
      try { if (String(name).toLowerCase() === 'authorization') this.__r1Auth = String(value); } catch { /* observation only */ }
      return originalSet.apply(this, arguments);
    };
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function sendWithTap() {
      try { noteBearer(this.__r1Auth); } catch { /* observation only */ }
      return originalSend.apply(this, arguments);
    };
  });
}
function scrub(value) {
  let text = String(value ?? '');
  for (const secret of secrets) if (secret) text = text.split(secret).join('[redacted]');
  return text.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/g, 'Bearer [redacted]');
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
function sqlQuote(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function record(name, status, detail) {
  const safe = JSON.parse(scrub(JSON.stringify(detail ?? {})));
  steps.push({ name, status, detail: safe });
  note(`${status} ${name} ${JSON.stringify(safe).slice(0, 360)}`);
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
      if (health.status === 200 && (health.body == null || health.body.includes(health.expect || ''))) {
        note(label + '_HEALTH 200');
        return;
      }
    } catch (error) { last = error.message; }
    await delay(500);
  }
  throw new Error(label + '_HEALTH_TIMEOUT ' + last);
}
async function stopChild(entry) {
  const child = entry?.child;
  if (!child || child.pid == null || child.exitCode != null) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch { /* gone */ } }
  const deadline = Date.now() + 12000;
  while (child.exitCode == null && Date.now() < deadline) await delay(200);
  if (child.exitCode == null) {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* gone */ } }
  }
}
async function stopAll() {
  for (const entry of [...children].reverse()) await stopChild(entry);
}
function certificateSpkiHash(pemPath) {
  const publicKeyPem = run('openssl', ['x509', '-in', pemPath, '-pubkey', '-noout']);
  const publicKeyDer = execFileSync('openssl', ['pkey', '-pubin', '-outform', 'der'], { input: publicKeyPem });
  return createHash('sha256').update(publicKeyDer).digest('base64');
}
async function restartLearner() {
  const current = children.filter((entry) => entry.id.startsWith('learner-service') || entry.id.startsWith('learner-restart'));
  for (const entry of current) await stopChild(entry);
  const freeDeadline = Date.now() + 20000;
  while (listeners(ports.learner).trim() && Date.now() < freeDeadline) await delay(200);
  if (listeners(ports.learner).trim()) throw new Error('LEARNER_PORT_STUCK');
  const child = startJava(`learner-restart-${children.length}`, learnerArgs, learnerEnv);
  await waitHealth(child, () => request({ port: ports.learner, path: '/actuator/health' }), 'LEARNER_RESTART');
}
function pullIds(text) {
  let json;
  try { json = JSON.parse(text); } catch { return {}; }
  const hits = {};
  const walk = (value) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (['sessionId', 'deviceId', 'errorCode', 'code', 'title', 'detail'].includes(key) && typeof item === 'string' && !hits[key]) hits[key] = item;
      else if (key === 'status' && (typeof item === 'string' || typeof item === 'number') && hits.status == null) hits.status = item;
      else if (item && typeof item === 'object') walk(item);
    }
  };
  walk(json);
  return hits;
}
function gateStatus(ids) {
  const text = JSON.stringify(ids);
  if (text.includes('REJECTED')) return 'REJECTED';
  if (text.includes('APPROVED') || text.includes('PASSED')) return 'PASSED';
  return String(ids.status ?? '');
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
  mysqlRoot = entry.slice('MYSQL_ROOT_PASSWORD='.length);
  secrets.push(mysqlRoot);
  qidaBefore = run('docker', ['ps', '--format', '{{.Names}}']).split('\n').filter((name) => name.includes('qida')).sort();
}
function authUrl(surface, kind) {
  if (surface === 'web') return `http://127.0.0.1:18180/${kind === 'reset' ? 'reset-password' : kind}`;
  const page = kind === 'reset' ? 'reset-password/reset-password' : `${kind}/${kind}`;
  return `http://127.0.0.1:18183/#/pages/${page}`;
}
function homeUrl(surface) {
  return surface === 'web' ? 'http://127.0.0.1:18180/home' : 'http://127.0.0.1:18183/#/pages/home/home';
}
function onboardingUrl(surface) {
  return surface === 'web' ? 'http://127.0.0.1:18180/onboarding' : 'http://127.0.0.1:18183/#/pages/onboarding/onboarding';
}
function observe(page, calls, bag) {
  page.on('request', (request) => {
    try {
      const url = new URL(request.url());
      const auth = request.headers().authorization || '';
      if (auth.startsWith('Bearer ') && url.origin === gatewayOrigin) bag.token = auth;
      if (request.method() === 'POST' && url.pathname.endsWith('/auth/register') && !bag.register) {
        bag.register = {
          url: request.url(),
          postData: request.postData(),
          idempotencyKey: request.headers()['idempotency-key'] || '',
        };
      }
    } catch { /* ignore malformed urls */ }
  });
  page.on('response', async (response) => {
    let url;
    try { url = new URL(response.url()); } catch { return; }
    if (!url.pathname.startsWith('/api/v1/')) return;
    const entry = { method: response.request().method(), origin: url.origin, path: url.pathname, status: response.status() };
    const interesting = entry.method !== 'GET' || response.status() >= 400 || url.pathname.includes('/learner/targets') || url.pathname.includes('/placement/');
    if (interesting) {
      try {
        const text = await response.text();
        entry.ids = pullIds(text);
        if (response.status() >= 400 && response.status() !== 404) entry.error = scrub(text).slice(0, 180);
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
  }, { timeout: 25000 });
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
  page.setDefaultTimeout(20000);
  page.on('dialog', (dialog) => { void dialog.accept(); });
  const calls = [];
  const bag = { token: '', register: null };
  observe(page, calls, bag);
  await installTokenTap(page, bag);
  try {
    await fn(page, calls, bag);
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
async function browserFetch(page, spec, body) {
  const result = await page.evaluate(async ({ url, idempotencyKey, payload }) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'idempotency-key': idempotencyKey,
      },
      body: payload,
      credentials: 'include',
    });
    return { status: response.status, text: await response.text() };
  }, { url: spec.url, idempotencyKey: spec.idempotencyKey, payload: body });
  return { status: result.status, ids: pullIds(result.text), text: scrub(result.text).slice(0, 180) };
}
async function registerReplay(page, calls, bag, surface, identifier, label) {
  bag.register = null;
  const call = await submitAuth(page, surface, 'register', identifier);
  const ok = authOk(call, 201);
  const first = await waitForRecorded(
    calls,
    (item) => item.path.endsWith('/auth/register') && item.status === 201 && item.ids && item.ids.sessionId,
    8000,
  );
  record(`register-${label}`, ok ? 'PASS' : 'FAIL', call);
  if (!ok || !bag.register?.postData || !bag.register.idempotencyKey) throw new Error('REGISTER ' + label);
  const replay = await browserFetch(page, bag.register, bag.register.postData);
  const accounts = sql(`SELECT COUNT(*) FROM \`${names.iam[0]}\`.iam_account WHERE identifier=${sqlQuote(identifier)};`);
  const same = replay.status === 201 && first?.ids?.sessionId && replay.ids.sessionId === first.ids.sessionId && accounts === '1';
  record(`replay-same-${label}`, same ? 'PASS' : 'FAIL', {
    status: replay.status, sameSession: Boolean(first?.ids?.sessionId && replay.ids.sessionId === first.ids.sessionId), accounts,
  });
  if (!same) throw new Error('REPLAY ' + label);
  const mutated = JSON.parse(bag.register.postData);
  mutated.device = { ...(mutated.device || {}), deviceName: `${mutated.device?.deviceName || 'browser'}-conflict` };
  const conflict = await browserFetch(page, bag.register, JSON.stringify(mutated));
  const accountsAfter = sql(`SELECT COUNT(*) FROM \`${names.iam[0]}\`.iam_account WHERE identifier=${sqlQuote(identifier)};`);
  const conflictOk = conflict.status === 409 && accountsAfter === '1';
  record(`replay-conflict-${label}`, conflictOk ? 'PASS' : 'FAIL', { status: conflict.status, accounts: accountsAfter });
  if (!conflictOk) throw new Error('CONFLICT ' + label);
}
async function clickRow(row) {
  const box = row.locator('.uni-checkbox-input, uni-checkbox, input[type=checkbox]').first();
  if (await box.count()) await box.click();
  else await row.click();
}
async function continueButton(page) {
  const primary = page.locator('[data-primary-action=continue]');
  if (await primary.count()) return primary.first();
  return page.getByRole('button', { name: '继续', exact: true }).last();
}
async function controlDisabled(locator) {
  return locator.evaluate((element) => element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true' || element.disabled === true);
}
async function assertGateCopy(page, label) {
  const body = await page.locator('body').innerText();
  const missing = gateCopy.filter((sentence) => !body.includes(sentence));
  // The required note itself says the page does not offer these actions. Count controls, not those words.
  const retryControl = await page.getByRole('button', { name: '再试一次', exact: true }).count()
    + await page.getByRole('link', { name: '再试一次', exact: true }).count();
  const changeYearControl = await page.getByRole('button', { name: '改年份', exact: true }).count()
    + await page.getByRole('link', { name: '改年份', exact: true }).count();
  const monthField = await page.locator('input[aria-label="出生月"], input[name="birthMonth"]').count();
  const dayField = await page.locator('input[aria-label="出生日"], input[name="birthDay"]').count();
  const blocked = [];
  if (retryControl) blocked.push('再试一次');
  if (changeYearControl) blocked.push('改年份');
  if (monthField) blocked.push('出生月');
  if (dayField) blocked.push('出生日');
  const ok = missing.length === 0 && blocked.length === 0 && body.includes('不提供再试一次') && body.includes('也不提供改年份');
  record(`copy-gate-${label}`, ok ? 'PASS' : 'FAIL', { missing, blocked });
  if (!ok) throw new Error('GATE_COPY ' + label);
}
async function assertConsentCopy(page, label) {
  await page.waitForFunction(() => {
    const text = document.body?.innerText || '';
    const match = text.match(/已发布版本\s+(\S+)/);
    return Boolean(match && match[1] && match[1] !== '版本未读到');
  }, null, { timeout: 20000 });
  const button = await continueButton(page);
  const disabledBefore = await controlDisabled(button);
  const body = await page.locator('body').innerText();
  const missing = consentCopy.filter((sentence) => !body.includes(sentence));
  const labels = ['账号条款', '隐私说明', '成人学习资格', 'ACCOUNT_TERMS', 'PRIVACY_NOTICE', 'ADULT_LEARNING_ELIGIBILITY', '必要', '已发布版本']
    .filter((word) => !body.includes(word));
  const version = (body.match(/已发布版本\s+(\S+)/) || [])[1] || '';
  const ok = disabledBefore && missing.length === 0 && labels.length === 0 && version && version !== '版本未读到';
  record(`copy-consent-${label}`, ok ? 'PASS' : 'FAIL', { disabledBefore, missing, labels, version: version || null });
  if (!ok) throw new Error('CONSENT_COPY ' + label);
  return version;
}
async function h5BirthYear(page) {
  const preferred = page.locator('input[placeholder="例如 1995"]:visible');
  if (await preferred.count()) return preferred.first();
  const inLabel = page.locator('.birth-year input:visible');
  if (await inLabel.count()) return inLabel.first();
  return page.locator('input:visible').first();
}
async function passAdult(page, surface) {
  if (surface === 'web') {
    await page.locator('#adult-birth-year').fill('1990');
    await page.getByText('我确认自己已满 18 周岁').click();
  } else {
    const year = await h5BirthYear(page);
    await year.waitFor({ timeout: 20000 });
    await year.fill('1990');
    await clickRow(page.locator('label.consent, .consent').filter({ hasText: '我确认自己已满 18 周岁' }).first());
  }
  await (await continueButton(page)).click();
}
async function passConsent(page, surface) {
  if (surface === 'web') {
    const boxes = page.locator('form input[type=checkbox]');
    const count = await boxes.count();
    for (let index = 0; index < count; index += 1) await boxes.nth(index).check();
  } else {
    const rows = page.locator('.consent');
    await rows.first().waitFor({ timeout: 15000 });
    const count = await rows.count();
    for (let index = 0; index < count; index += 1) await clickRow(rows.nth(index));
  }
  await (await continueButton(page)).click();
}
async function saveGoal(page, surface) {
  const body = await page.locator('body').innerText();
  const fields = ['学习目标', '每天愿意投入多久'].filter((word) => !body.includes(word));
  const optional = body.includes('可选重点') || body.includes('可以稍后补');
  await page.locator('[data-goal-code=FOUNDATION]').click();
  const quota = page.getByRole('button', { name: '15 分钟', exact: true });
  if (await quota.count()) await quota.click();
  record(`profile-fields-${surface}`, fields.length === 0 ? 'PASS' : 'FAIL', { fields, optional });
  if (fields.length) throw new Error('FIELDS ' + surface);
  await page.locator('[data-primary-action=save-target]').click();
  if (surface === 'web') await page.waitForURL(/\/assessment/, { timeout: 20000 });
  else await page.waitForFunction(() => /assessment/.test(location.href), null, { timeout: 20000 });
  await page.getByText('开始定级', { exact: true }).first().waitFor({ timeout: 20000 });
  record(`button-to-placement-${surface}`, /assessment/.test(page.url()) ? 'PASS' : 'FAIL', { url: page.url() });
}
async function openGuide(browser, surface, viewport, identifier, label) {
  await withPage(browser, viewport, async (page) => {
    const login = await submitAuth(page, surface, 'login', identifier);
    const loginOk = authOk(login, 200);
    record(`login-${label}`, loginOk ? 'PASS' : 'FAIL', login);
    if (!loginOk) throw new Error('LOGIN ' + label);
    await page.goto(homeUrl(surface), { waitUntil: 'domcontentloaded' });
    const guide = page.locator('.onboarding-guide');
    try {
      await guide.waitFor({ timeout: 20000 });
    } catch {
      record(`guide-bar-${label}`, 'FAIL', { url: page.url(), body: (await page.locator('body').innerText()).slice(0, 180) });
      throw new Error('GUIDE ' + label);
    }
    const text = await guide.innerText();
    const copyOk = text.includes('目标已保存，下一步进入定级') && text.includes('继续设置，开始学习');
    if (surface === 'web') await guide.click();
    else await guide.getByRole('button', { name: '继续设置，开始学习' }).click();
    if (surface === 'web') await page.waitForURL(/\/assessment/, { timeout: 20000 });
    else await page.waitForFunction(() => /assessment/.test(location.href), null, { timeout: 20000 });
    await page.getByText('开始定级').first().waitFor({ timeout: 20000 });
    const arrived = /assessment/.test(page.url());
    record(`guide-bar-${label}`, copyOk && arrived ? 'PASS' : 'FAIL', { copyOk, url: page.url() });
    await shot(page, `guide-${label}.png`);
    if (!copyOk || !arrived) throw new Error('GUIDE_DEST ' + label);
  });
}
async function readback(page, surface, label) {
  await restartLearner();
  await page.goto(onboardingUrl(surface), { waitUntil: 'domcontentloaded' });
  await page.getByText('目标已保存', { exact: true }).first().waitFor({ timeout: 25000 });
  record(`readback-${label}`, /onboarding/.test(page.url()) ? 'PASS' : 'FAIL', { url: page.url() });
  await shot(page, `readback-${label}.png`);
}
function loadAnswerKey() {
  const rows = sql(`SELECT CONCAT(stem, CHAR(31), JSON_UNQUOTE(JSON_EXTRACT(answer_rule_json, '$.correctOption')), CHAR(31), options_json) FROM \`${names.content[0]}\`.content_placement_item ORDER BY display_order;`);
  answerKey = new Map();
  for (const row of rows.split('\n').filter(Boolean)) {
    const [stem, correct, optionsJson] = row.split('\u001f');
    const options = JSON.parse(optionsJson).map((option) => ({ id: option.optionId, label: option.label }));
    const wrong = options.find((option) => option.id !== correct);
    answerKey.set(stem.trim(), { correct, wrong: wrong?.label || '', options });
  }
  record('placement-answer-key-loaded', answerKey.size === 10 ? 'PASS' : 'FAIL', { count: answerKey.size });
}
async function clickOptionByLabel(page, label) {
  const options = page.locator('button.option');
  const count = await options.count();
  for (let index = 0; index < count; index += 1) {
    const text = (await options.nth(index).locator('span').innerText()).trim();
    if (text === label) {
      await options.nth(index).click();
      return true;
    }
  }
  return false;
}
async function scoreTen(page, calls) {
  await page.goto('http://127.0.0.1:18180/assessment', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '开始', exact: true }).click({ timeout: 20000 });
  await page.locator('button.option').first().waitFor({ timeout: 20000 });
  const outcomes = [];
  for (let index = 0; index < 10; index += 1) {
    const stem = (await page.locator('.question-card h3').innerText()).trim();
    const rule = answerKey.get(stem);
    if (!rule) throw new Error('UNKNOWN_STEM ' + stem.slice(0, 80));
    const expectFull = index % 2 === 0;
    const label = expectFull ? rule.options.find((option) => option.id === rule.correct)?.label : rule.wrong;
    if (!label || !await clickOptionByLabel(page, label)) throw new Error('OPTION ' + (index + 1));
    await page.getByRole('button', { name: '提交答案' }).click();
    const expectedText = expectFull ? '刚才提交的这题答对了。' : '刚才提交的这题没有答对。';
    await page.getByRole('status').filter({ hasText: expectedText }).first().waitFor({ timeout: 20000 });
    const body = await page.locator('body').innerText();
    const matched = body.includes(expectedText);
    outcomes.push({ index: index + 1, expected: expectFull ? 'FULL' : 'ZERO', matched });
    if (!matched) throw new Error('FEEDBACK ' + (index + 1));
  }
  const body = await page.locator('body').innerText();
  const counted = body.match(/答对\s+(\d+)\s+题，共\s+(\d+)\s+题/);
  const full = outcomes.filter((item) => item.expected === 'FULL').length;
  const reportOk = Boolean(counted) && Number(counted[1]) === full && Number(counted[2]) === 10 && body.includes('报告已生成');
  record('it2-ten-item-score', reportOk ? 'PASS' : 'FAIL', { outcomes, report: counted ? counted[0] : null });
  await page.screenshot({ path: join(scoreEvidence, 'screenshots', 'score-report.png') });
  if (!reportOk) throw new Error('SCORE_REPORT');
  await page.getByRole('button', { name: '重测', exact: true }).click();
  await page.locator('button.option, .question-meta').first().waitFor({ timeout: 20000 });
  const retest = await waitForRecorded(calls, (call) => call.path.endsWith('/retest'), 15000);
  const retestOk = Boolean(retest) && retest.status === 201;
  record('it2-public-retest', retestOk ? 'PASS' : 'FAIL', { status: retest?.status || null, url: page.url() });
  await page.screenshot({ path: join(scoreEvidence, 'screenshots', 'retest.png') });
  if (!retestOk) throw new Error('RETEST');
}
async function accountFacts(identifier) {
  return sql(`SELECT CONCAT(p.adult_gate_status, ',', a.status, ',', IFNULL((SELECT GROUP_CONCAT(DISTINCT s.status) FROM \`${names.iam[0]}\`.iam_session s WHERE s.principal_id=a.principal_id), '')) FROM \`${names.iam[0]}\`.iam_account a JOIN \`${names.iam[0]}\`.iam_principal p ON p.principal_id=a.principal_id WHERE a.identifier=${sqlQuote(identifier)};`);
}
async function authedFetch(page, token, method, path, body) {
  return page.evaluate(async ({ token: bearer, method: verb, path: target, body: payload }) => {
    const response = await fetch(`http://127.0.0.1:18070${target}`, {
      method: verb,
      headers: {
        authorization: bearer,
        accept: 'application/json',
        'content-type': 'application/json',
        'idempotency-key': `named-${crypto.randomUUID()}`,
      },
      body: payload == null ? undefined : JSON.stringify(payload),
    });
    return { status: response.status, text: (await response.text()).slice(0, 300) };
  }, { token, method, path, body });
}
async function minorFlow(page, calls, bag, surface, label) {
  await page.waitForURL(/onboarding/, { timeout: 20000 });
  await assertGateCopy(page, label);
  if (surface === 'web') {
    await page.locator('#adult-birth-year').evaluate((element) => {
      element.value = '2015';
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.getByText('我确认自己已满 18 周岁').click();
  } else {
    const year = await h5BirthYear(page);
    await year.waitFor({ timeout: 20000 });
    await year.evaluate((element) => {
      element.value = '2015';
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await clickRow(page.locator('label.consent, .consent').filter({ hasText: '我确认自己已满 18 周岁' }).first());
  }
  const disabled = await controlDisabled(await continueButton(page));
  record(`minor-client-blocked-${label}`, disabled ? 'PASS' : 'FAIL', { disabled });
  if (!disabled) throw new Error('MINOR_BUTTON ' + label);
  const deadline = Date.now() + 15000;
  while (!bag.token && Date.now() < deadline) await delay(200);
  if (!bag.token) throw new Error('NO_TOKEN ' + label);
  const posted = await authedFetch(page, bag.token, 'POST', '/api/v1/iam/adult-gate', {
    confirmed: true, birthYear: 2015, policyVersion: 'b30-adult-v1',
  });
  const rejected = posted.status === 200 && posted.text.includes('REJECTED');
  record(`minor-server-${label}`, rejected ? 'PASS' : 'FAIL', { status: posted.status, rejected: posted.text.includes('REJECTED') });
  if (!rejected) throw new Error('MINOR_SERVER ' + label);
  const sentence = '当前版本仅面向 18 岁以上成人开放，暂不能向你开放学习功能。';
  // A hash-only goto keeps the H5 document, so the in-memory gate stays stale. A query change reloads it.
  const home = surface === 'h5'
    ? `http://127.0.0.1:18183/?reload=${Date.now()}#/pages/home/home`
    : homeUrl(surface);
  await page.goto(home, { waitUntil: 'domcontentloaded' });
  const sawSentence = await page.waitForFunction((expected) => (document.body?.innerText || '').includes(expected), sentence, { timeout: 25000 }).then(() => true).catch(() => false);
  if (!sawSentence) {
    const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 220);
    throw new Error(`FORBIDDEN_TEXT ${page.url()} ${body}`);
  }
  const forbidden = surface === 'web' ? page.url().includes('/forbidden') : page.url().includes('forbidden');
  record(`minor-forbidden-${label}`, forbidden ? 'PASS' : 'FAIL', { url: page.url() });
  await shot(page, `minor-${label}.png`);
  if (!forbidden) throw new Error('FORBIDDEN ' + label);
  if (surface === 'web') {
    await page.getByRole('link', { name: '前往账号设置' }).click();
    await page.waitForURL(/\/settings/, { timeout: 15000 });
    await page.getByRole('link', { name: '帮助与反馈' }).click();
    await page.waitForURL(/\/support/, { timeout: 15000 });
  } else {
    await page.getByRole('button', { name: '个人中心与设置' }).click();
    await page.waitForFunction(() => /profile/.test(location.href), null, { timeout: 15000 });
    await page.getByText('未通过').waitFor({ timeout: 15000 });
    await page.goto('http://127.0.0.1:18183/#/pages/forbidden/forbidden', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '帮助与反馈' }).click();
    await page.waitForFunction(() => /support/.test(location.href), null, { timeout: 15000 });
  }
  record(`minor-exits-${label}`, 'PASS', { url: page.url() });
  if (surface === 'web') {
    await page.goto('http://127.0.0.1:18180/forbidden', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '退出登录' }).click();
    await page.waitForURL(/\/login/, { timeout: 15000 });
  } else {
    await page.goto('http://127.0.0.1:18183/#/pages/forbidden/forbidden', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '返回登录' }).click();
    await page.waitForFunction(() => /login/.test(location.href), null, { timeout: 15000 });
  }
  const settled = page.waitForResponse((response) => {
    try {
      const path = new URL(response.url()).pathname;
      return response.ok() && (/\/iam\/principal\/me$/.test(path) || /\/iam\/permissions$/.test(path));
    } catch {
      return false;
    }
  }, { timeout: 20000 }).catch(() => null);
  const login = await submitAuth(page, surface, 'login', bag.identifier);
  const loginOk = authOk(login, 200);
  record(`login-${label}`, loginOk ? 'PASS' : 'FAIL', login);
  if (!loginOk) throw new Error('RELOGIN ' + label);
  await settled;
  const onboarding = surface === 'h5'
    ? `http://127.0.0.1:18183/?reentry=${Date.now()}#/pages/onboarding/onboarding`
    : onboardingUrl(surface);
  await page.goto(onboarding, { waitUntil: 'domcontentloaded' });
  const bounced = await page.waitForURL(/forbidden/, { timeout: 20000 }).then(() => true).catch(() => false);
  if (!bounced) throw new Error('REENTRY_BOUNCE ' + page.url());
  const sentenceAgain = '当前版本仅面向 18 岁以上成人开放，暂不能向你开放学习功能。';
  const sawAgain = await page.waitForFunction((expected) => (document.body?.innerText || '').includes(expected), sentenceAgain, { timeout: 20000 }).then(() => true).catch(() => false);
  if (!sawAgain) {
    const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 220);
    throw new Error(`REENTRY_TEXT ${page.url()} ${body}`);
  }
  const yearLeft = await page.locator('#adult-birth-year, input[aria-label="出生年份"]').count();
  const retryLeft = await page.getByRole('button', { name: '再试一次', exact: true }).count()
    + await page.getByRole('link', { name: '再试一次', exact: true }).count();
  const backOnForbidden = (surface === 'web' ? page.url().includes('/forbidden') : page.url().includes('forbidden')) && yearLeft === 0 && !retryLeft;
  record(`reentry-${label}`, backOnForbidden ? 'PASS' : 'FAIL', { url: page.url(), yearLeft, retryLeft, bounced });
  await shot(page, `reentry-${label}.png`);
  if (!backOnForbidden) throw new Error('REENTRY ' + label);
  const facts = await accountFacts(bag.identifier);
  const [gate, accountStatus, sessions] = facts.split(',');
  const stored = gate === 'REJECTED' && accountStatus === 'ACTIVE' && (sessions || '').includes('ACTIVE');
  record(`minor-db-${label}`, stored ? 'PASS' : 'FAIL', { gate, accountStatus, sessions });
  if (!stored) throw new Error('MINOR_DB ' + label);
}
async function withdrawLearning(page, bag, label) {
  const deadline = Date.now() + 15000;
  while (!bag.token && Date.now() < deadline) await delay(200);
  if (!bag.token) throw new Error('NO_TOKEN ' + label);
  const version = bag.version || 'b30-consent-v1';
  const posted = await authedFetch(page, bag.token, 'PUT', '/api/v1/iam/consents', {
    type: 'ADULT_LEARNING', version, decision: 'WITHDRAWN',
  });
  const withdrawn = posted.status === 200 && /WITHDRAWN/.test(posted.text);
  const learning = await authedFetch(page, bag.token, 'GET', '/api/v1/learner/targets');
  const forbidden = learning.status === 403 && /consent/i.test(learning.text);
  record(`withdraw-403-${label}`, withdrawn && forbidden ? 'PASS' : 'FAIL', {
    withdraw: posted.status, withdrawn, learning: learning.status, consentMentioned: /consent/i.test(learning.text),
  });
  await shot(page, `withdraw-${label}.png`);
  if (!withdrawn || !forbidden) throw new Error('WITHDRAW ' + label);
}
async function waitForSignedIn(page, surface) {
  const storageKey = surface === 'web' ? 'yx.auth.session-hint' : 'yx.auth.mobile.session-hint';
  const ready = await page.waitForFunction((key) => {
    if (window.localStorage.getItem(key) === '1') return true;
    const text = document.body?.innerText || '';
    return !text.includes('登录并继续');
  }, storageKey, { timeout: 20000 }).then(() => true).catch(() => false);
  if (ready) return;
  const detail = await page.evaluate((key) => ({
    href: location.href,
    hint: window.localStorage.getItem(key),
    keys: Object.keys(window.localStorage).slice(0, 20),
    body: (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 180),
  }), storageKey);
  throw new Error(`SESSION_HINT ${surface} ${JSON.stringify(detail)}`);
}
async function clickKickControl(page) {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll('button, uni-button')];
    const target = nodes.find((node) => {
      const text = node.textContent || '';
      const disabled = node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true';
      return !disabled && text.includes('退出此设备');
    });
    if (!target) {
      return nodes.map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 12).join(' | ');
    }
    target.click();
    return 'CLICKED';
  });
}
async function kickFrom(page, surface) {
  const home = surface === 'web'
    ? 'http://127.0.0.1:18180/settings/devices'
    : `http://127.0.0.1:18183/?devices=${Date.now()}#/pages/devices/devices`;
  await page.goto(home, { waitUntil: 'domcontentloaded' });
  if (surface === 'web') await page.getByRole('heading', { name: '设备会话' }).waitFor({ timeout: 20000 });
  const pending = page.waitForResponse((response) => response.url().includes('/kickout') && response.request().method() === 'POST', { timeout: 25000 });
  void pending.catch(() => {});
  const deadline = Date.now() + 20000;
  let clicked = '';
  while (Date.now() < deadline && clicked !== 'CLICKED') {
    clicked = await clickKickControl(page);
    if (clicked === 'CLICKED') break;
    const refreshName = surface === 'web' ? '刷新设备' : '刷新';
    const refresh = page.getByRole('button', { name: refreshName, exact: true });
    if (await refresh.count() && await refresh.first().isEnabled()) await refresh.first().click();
    await delay(700);
  }
  if (clicked !== 'CLICKED') throw new Error('KICK_UI ' + surface + ' ' + clicked);
  if (surface === 'h5') {
    const confirm = page.getByText('确认退出', { exact: true });
    await confirm.waitFor({ timeout: 8000 });
    await confirm.click();
  }
  return await pending;
}
async function expectKicked(page, surface, label) {
  const pending = page.waitForResponse((response) => {
    try { return response.status() === 401 && new URL(response.url()).pathname.startsWith('/api/v1/'); }
    catch { return false; }
  }, { timeout: 20000 });
  void pending.catch(() => {});
  const home = surface === 'h5' ? `http://127.0.0.1:18183/?kicked=${Date.now()}#/pages/home/home` : homeUrl(surface);
  await page.goto(home, { waitUntil: 'domcontentloaded' });
  const response = await pending;
  const url = new URL(response.url());
  const kicked = url.origin === iamOrigin || url.origin === gatewayOrigin;
  if (surface === 'web') await page.waitForURL(/\/login/, { timeout: 20000 });
  else await page.waitForFunction(() => /login/.test(location.href), null, { timeout: 20000 });
  record(`kick-401-${label}`, kicked ? 'PASS' : 'FAIL', { origin: url.origin, path: url.pathname, status: response.status(), url: page.url() });
  await shot(page, `kicked-${label}.png`);
  if (!kicked) throw new Error('KICK ' + label);
}
async function resetOnce(browser, viewport, surface, identifier, label, known) {
  await withPage(browser, viewport, async (page) => {
    const call = await submitAuth(page, surface, 'reset', identifier);
    const ok = authOk(call, 202);
    record(`reset-${label}`, ok ? 'PASS' : 'FAIL', { ...call, account: known ? 'existing' : 'unknown' });
    if (!ok) throw new Error('RESET ' + label);
  });
}
async function adultCell(browser, surface, viewport, identifier, label) {
  let holder = null;
  await withPage(browser, viewport, async (page, calls, bag) => {
    holder = { page, calls, bag };
    bag.identifier = identifier;
    await registerReplay(page, calls, bag, surface, identifier, label);
    await page.waitForURL(/onboarding/, { timeout: 20000 });
    await assertGateCopy(page, label);
    await passAdult(page, surface);
    await page.getByText('完成必要同意').waitFor({ timeout: 20000 });
    bag.version = await assertConsentCopy(page, label);
    const consentMark = calls.length;
    await passConsent(page, surface);
    await page.locator('[data-goal-code=FOUNDATION]').waitFor({ timeout: 20000 });
    const consentCalls = calls.slice(consentMark).filter((call) => call.method === 'PUT' && call.path.endsWith('/iam/consents'));
    const consentOk = consentCalls.length >= 3 && consentCalls.every((call) => call.origin === gatewayOrigin && call.status === 200);
    record(`consent-signed-${label}`, consentOk ? 'PASS' : 'FAIL', { count: consentCalls.length, statuses: consentCalls.map((call) => call.status) });
    if (!consentOk) throw new Error('CONSENT ' + label);
    await saveGoal(page, surface);
    await shot(page, `placement-${label}.png`);
    const refresh = calls.filter((call) => call.path.endsWith('/auth/token/refresh'));
    const refreshOk = refresh.length > 0 && refresh.every((call) => call.origin === iamOrigin && call.status === 200);
    record(`refresh-${label}`, refreshOk ? 'PASS' : 'FAIL', { count: refresh.length });
    if (!refreshOk) throw new Error('REFRESH ' + label);
  });
  // The context above is closed. Guide, readback, kick and scoring use new contexts.
  await openGuide(browser, surface, viewport, identifier, label);
  await withPage(browser, viewport, async (page, calls, bag) => {
    const login = calls;
    void login;
    const call = await submitAuth(page, surface, 'login', identifier);
    if (!authOk(call, 200)) throw new Error('READBACK_LOGIN ' + label);
    await readback(page, surface, label);
    if (surface === 'web' && label.endsWith('1280x900')) {
      try { await scoreTen(page, calls); }
      catch (error) {
        record('it2-score-cell', 'FAIL', { error: scrub(error.message).slice(0, 240), url: page.url() });
        try { await page.screenshot({ path: join(scoreEvidence, 'screenshots', 'failure.png'), mask: [page.locator('input')] }); } catch { /* closed */ }
      }
    }
    await page.goto(homeUrl(surface), { waitUntil: 'domcontentloaded' });
    if (surface === 'h5') {
      bag.version = bag.version || 'b30-consent-v1';
      try { await withdrawLearning(page, bag, label); }
      catch (error) {
        if (!String(error && error.message).startsWith('WITHDRAW')) {
          record(`withdraw-403-${label}`, 'FAIL', { error: scrub(error.message).slice(0, 240) });
        }
      }
    }
  });
}
async function pairKick(browser, keeperSurface, keeperViewport, kickedSurface, kickedViewport, identifier, label) {
  const keeperContext = await browser.newContext({ viewport: keeperViewport, locale: 'zh-CN' });
  const kickedContext = await browser.newContext({ viewport: kickedViewport, locale: 'zh-CN' });
  const keeper = await keeperContext.newPage();
  const kicked = await kickedContext.newPage();
  keeper.setDefaultTimeout(20000);
  kicked.setDefaultTimeout(20000);
  keeper.on('dialog', (dialog) => { void dialog.accept(); });
  kicked.on('dialog', (dialog) => { void dialog.accept(); });
  const keeperCalls = [];
  const kickedCalls = [];
  const keeperBag = { token: '', register: null };
  const kickedBag = { token: '', register: null };
  observe(keeper, keeperCalls, keeperBag);
  observe(kicked, kickedCalls, kickedBag);
  try {
    const keeperLogin = await submitAuth(keeper, keeperSurface, 'login', identifier);
    const kickedLogin = await submitAuth(kicked, kickedSurface, 'login', identifier);
    if (!authOk(keeperLogin, 200) || !authOk(kickedLogin, 200)) {
      record(`kick-login-${label}`, 'FAIL', { keeper: keeperLogin, kicked: kickedLogin });
      throw new Error('KICK_LOGIN');
    }
    record(`kick-login-${label}`, 'PASS', { keeper: keeperLogin.status, kicked: kickedLogin.status });
    await waitForSignedIn(keeper, keeperSurface);
    await waitForSignedIn(kicked, kickedSurface);
    const response = await kickFrom(keeper, keeperSurface);
    const kick = await response;
    const kickUrl = new URL(kick.url());
    record(`kick-request-${label}`, kick.status() === 200 && kickUrl.origin === gatewayOrigin ? 'PASS' : 'FAIL', {
      status: kick.status(), origin: kickUrl.origin, path: kickUrl.pathname,
    });
    await expectKicked(kicked, kickedSurface, label);
  } finally {
    allCalls.push(...keeperCalls, ...kickedCalls);
    await keeperContext.close();
    await kickedContext.close();
  }
}
async function official(browser) {
  for (const viewport of [{ name: '1280x900', size: desktop }, { name: '390x844', size: phone }]) {
    await withPage(browser, viewport.size, async (page) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(scrub(error.message).slice(0, 160)));
      for (const path of officialPages) {
        const response = await page.goto(`http://127.0.0.1:18182${path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.getByText('语学星').first().waitFor({ timeout: 20000 });
        if (path === '/courses') {
          const preparing = page.getByText('课程准备中', { exact: true }).first();
          await preparing.waitFor({ timeout: 20000 });
          await preparing.scrollIntoViewIfNeeded();
        }
        if (path === '/pricing') {
          const deadline = Date.now() + 20000;
          let settled = false;
          while (Date.now() < deadline && !settled) {
            settled = (await page.getByText('收费方案暂未开放', { exact: true }).count()) > 0
              || (await page.locator('[data-public-catalog]').count()) > 0;
            if (!settled) await delay(200);
          }
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
        const status = response ? response.status() : 0;
        const body = await page.locator('body').innerText();
        const courseOk = path !== '/courses' || body.includes('课程准备中');
        const priceHonest = path !== '/pricing' || (await page.locator('[data-public-catalog]').count()) === 0;
        const ok = status === 200 && !overflow && errors.length === 0 && courseOk && priceHonest;
        const slug = path === '/' ? 'home' : path.slice(1);
        record(`official-${slug}-${viewport.name}`, ok ? 'PASS' : 'FAIL', { status, overflow, errors: errors.slice(0, 3), courseOk, priceHonest });
        await page.screenshot({ path: join(evidence, 'screenshots', `official-${viewport.name}-${slug}.png`) });
        if (!ok) throw new Error('OFFICIAL ' + path);
      }
      for (const target of ['home', 'courses']) {
        await page.goto(target === 'home' ? 'http://127.0.0.1:18182/' : 'http://127.0.0.1:18182/courses', { waitUntil: 'domcontentloaded' });
        const popupPromise = page.context().waitForEvent('page', { timeout: 4000 }).catch(() => null);
        if (target === 'courses') {
          const panel = page.locator('section, article, div').filter({ hasText: '课程准备中' }).last();
          await panel.getByRole('link', { name: '去注册' }).click();
        } else {
          await page.getByRole('link', { name: '去注册' }).first().click();
        }
        const popup = await popupPromise;
        const destination = popup || page;
        await destination.waitForURL(/18180\/register/, { timeout: 20000 });
        const body = await destination.locator('body').innerText();
        const ok = body.includes('仅面向 18 岁以上成人与大学生');
        record(`official-cta-${target}-${viewport.name}`, ok ? 'PASS' : 'FAIL', { url: destination.url() });
        if (popup) await popup.close();
        if (!ok) throw new Error('CTA ' + target);
      }
    });
  }
}
async function walk(browser) {
  await official(browser);
  const webId = `r1-web-${suffix}@example.invalid`;
  const h5Id = `r1-h5-${suffix}@example.invalid`;
  const webMinorId = `r1-web-minor-${suffix}@example.invalid`;
  const h5MinorId = `r1-h5-minor-${suffix}@example.invalid`;
  await adultCell(browser, 'web', desktop, webId, 'web-1280x900');
  await adultCell(browser, 'h5', phone, h5Id, 'h5-390x844');
  await withPage(browser, phone, async (page, calls, bag) => {
    bag.identifier = webMinorId;
    await registerReplay(page, calls, bag, 'web', webMinorId, 'web-390x844');
    await minorFlow(page, calls, bag, 'web', 'web-390x844');
  });
  await withPage(browser, desktop, async (page, calls, bag) => {
    bag.identifier = h5MinorId;
    await registerReplay(page, calls, bag, 'h5', h5MinorId, 'h5-1280x900');
    await minorFlow(page, calls, bag, 'h5', 'h5-1280x900');
  });
  await resetOnce(browser, desktop, 'web', webId, 'web-1280x900', true);
  await resetOnce(browser, phone, 'web', `missing-web-${suffix}@example.invalid`, 'web-390x844-unknown', false);
  await resetOnce(browser, phone, 'h5', h5Id, 'h5-390x844', true);
  await resetOnce(browser, desktop, 'h5', `missing-h5-${suffix}@example.invalid`, 'h5-1280x900-unknown', false);
  await pairKick(browser, 'web', desktop, 'h5', phone, webId, 'web-kicks-h5');
  await pairKick(browser, 'h5', phone, 'web', desktop, h5Id, 'h5-kicks-web');
  const leaked = allCalls.filter((call) => call.origin === gatewayOrigin
    && ['/auth/register', '/auth/login', '/auth/password-reset/request', '/auth/token/refresh'].some((path) => call.path.endsWith(path)));
  record('passwords-and-refresh-stay-off-gateway', leaked.length === 0 ? 'PASS' : 'FAIL', { leaked: leaked.map((call) => ({ path: call.path, status: call.status })) });
  if (leaked.length) throw new Error('GATEWAY_AUTH');
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
  secrets.push(dbPassword);
  for (const [schema, user] of Object.values(names)) {
    if (retained.includes(schema)) throw new Error('REFUSING_TO_TOUCH_RETAINED_SCHEMA');
    sql(`CREATE DATABASE \`${schema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER '${user}'@'%' IDENTIFIED BY '${dbPassword}'; GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,DROP,INDEX,REFERENCES ON ${grantScope(schema, partialRevokes)} TO '${user}'@'%';`);
  }
  record('four-owner-schemas', 'PASS', Object.fromEntries(Object.entries(names).map(([key, value]) => [key, value[0]])));
  const keyPassword = randomBytes(18).toString('hex');
  const trustPassword = randomBytes(18).toString('hex');
  const clientSecret = randomBytes(24).toString('hex');
  secrets.push(keyPassword, trustPassword, clientSecret);
  const clientDigest = createHash('sha256').update(clientSecret).digest('hex');
  const env = { ...process.env, R1_KEYSTORE_PASSWORD: keyPassword, R1_TRUST_PASSWORD: trustPassword };
  run('openssl', ['req', '-x509', '-newkey', 'rsa:3072', '-nodes', '-sha256', '-days', '2',
    '-subj', '/CN=IT1 named gate loopback', '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost',
    '-keyout', join(directory, 'test-key.pem'), '-out', join(directory, 'test-ca.pem')]);
  chmodSync(join(directory, 'test-key.pem'), 0o600);
  run('openssl', ['pkcs12', '-export', '-in', join(directory, 'test-ca.pem'), '-inkey', join(directory, 'test-key.pem'),
    '-out', join(directory, 'iam-server.p12'), '-name', 'it1-named', '-passout', 'env:R1_KEYSTORE_PASSWORD'], { env });
  run(join(javaHome, 'bin', 'keytool'), ['-importcert', '-noprompt', '-alias', 'it1-named', '-file', join(directory, 'test-ca.pem'),
    '-keystore', join(directory, 'trust.p12'), '-storetype', 'PKCS12', '-storepass:env', 'R1_TRUST_PASSWORD'], { env });
  run('openssl', ['genpkey', '-algorithm', 'RSA', '-pkeyopt', 'rsa_keygen_bits:3072', '-out', join(directory, 'iam-signer.pem')]);
  chmodSync(join(directory, 'iam-signer.pem'), 0o600);
  tlsCa = readFileSync(join(directory, 'test-ca.pem'));
  const signer = readFileSync(join(directory, 'iam-signer.pem'), 'utf8');
  const scoreToken = serviceToken(signer);
  secrets.push(scoreToken);
  const trustArgs = [
    `-Djavax.net.ssl.trustStore=${join(directory, 'trust.p12')}`,
    '-Djavax.net.ssl.trustStoreType=PKCS12',
    `-Djavax.net.ssl.trustStorePassword=${trustPassword}`,
    '-Dio.netty.handler.ssl.noOpenSsl=true',
  ];
  const iamConfig = join(directory, 'iam.properties');
  writeFileSync(iamConfig, [
    'server.address=127.0.0.1', 'server.port=18087', 'server.ssl.enabled=true',
    'server.ssl.key-store-type=PKCS12', 'server.ssl.key-alias=it1-named',
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
  const commonSecurity = { IAM_JWT_ISSUER: issuer, IAM_JWT_JWKS_URI: jwks, IAM_JWT_AUDIENCE: audience };
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
  loadAnswerKey();
  learnerArgs = [...trustArgs, '-jar', join(root, 'services/learner-service/target/learner-service-0.1.0-SNAPSHOT.jar')];
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
    // iam-domain is classified HIGH_RISK_ADMIN (30/min) and the limiter runs before
    // the JWT principal exists, so every /api/v1/iam call from this walk shares one
    // loopback bucket. Raise it only inside this evidence process.
    GATEWAY_RATE_LIMIT_HIGH_RISK_ADMIN_REQUESTS: '2000',
  });
  record('gateway-high-risk-budget', 'PASS', { requestsPerWindow: 2000, scope: 'evidence-process' });
  await waitHealth(gateway, () => request({ port: ports.gateway, path: '/actuator/health' }), 'GATEWAY');
  const web = startNode('learner-web', ['--filter', '@englishflow/learner-web', 'dev']);
  const mobile = startNode('mobile-h5', ['--filter', '@englishflow/mobile', 'dev:h5']);
  const officialSite = startNode('official-site', ['--filter', '@englishflow/official-site', 'dev']);
  await waitHealth(web, () => request({ port: ports.web, path: '/', accept: 'text/html' }), 'WEB');
  await waitHealth(mobile, () => request({ port: ports.mobile, path: '/', accept: 'text/html' }), 'MOBILE');
  await waitHealth(officialSite, async () => {
    const health = await request({ port: ports.official, path: '/', accept: 'text/html', timeout: 15000 });
    return { status: health.status === 200 && health.body.includes('语学星') ? 200 : health.status, body: null };
  }, 'OFFICIAL');
  const spki = certificateSpkiHash(join(directory, 'test-ca.pem'));
  record('browser-ca-pinned-by-spki', 'PASS', { mode: 'ignore-certificate-errors-spki-list', profile: 'playwright-temporary' });
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: [`--ignore-certificate-errors-spki-list=${spki}`],
  });
  try { await walk(browser); }
  finally {
    writeFileSync(join(evidence, 'calls.json'), scrub(JSON.stringify(allCalls, null, 2)));
    await browser.close();
  }
}

function groupStatus(prefix) {
  const matched = steps.filter((step) => step.name.startsWith(prefix));
  if (!matched.length) return 'NOT_RUN';
  return matched.some((step) => step.status === 'FAIL') ? 'FAIL' : 'PASS';
}
function cardRows() {
  const cards = [
    ['R1-001', 'official-'],
    ['R1-002', 'register-'],
    ['R1-003', 'replay-'],
    ['R1-004', 'login-'],
    ['R1-005', 'kick-'],
    ['R1-006', 'minor-server-'],
    ['R1-007', 'minor-exits-'],
    ['R1-008', 'consent-signed-'],
    ['R1-009', 'withdraw-403-'],
    ['R1-010', 'readback-'],
    ['R1-011', 'button-to-placement-'],
    ['R1-012', 'reset-'],
    ['R1-013', 'reentry-'],
    ['R1-015', 'register-'],
    ['R1-016', 'copy-'],
    ['R1-017', 'guide-bar-'],
  ];
  return cards.map(([card, prefix]) => ({ card, status: groupStatus(prefix) }));
}
function writeReports(summary, extra) {
  const cards = cardRows();
  cards.push({ card: 'R1-014', status: cards.every((card) => card.status === 'PASS') && summary === 'PASS' ? 'PASS' : 'FAIL' });
  const it2 = groupStatus('it2-');
  const lines = [
    '# IT-1 具名门浏览器证据',
    '',
    `日期：2026-10-10。目录：\`evidence/redesign/2026-10-10/it1-named-gates\`。本轮结论：${summary}。`,
    '',
    '这不是 Luna 签收。`accepted`、`it1Outbound`、`lunaStamp` 都是 false。`station-acceptance/` 原件没有改写。',
    '',
    '认证传输沿用 ce0aa296 之后的源码：注册、登录、重置和刷新直达 IAM HTTPS。Chrome 使用 Playwright 临时 profile，只放行本轮测试证书的 SPKI，不调用 security add-trusted-cert，也不改系统钥匙串。本轮证据进程把 Gateway 高风险限额调到 2000/分钟，只作用于这次启动的进程；`/api/v1/iam` 在见到登录用户之前共用一个回环额度，默认 30/分钟会在踢设备前把权限读取打成 429。生产默认值没有改。未成年年份仍被页面拦下，不能从按钮提交；拒绝结论来自同一 Chrome 会话里发往成人门的请求，随后页面进入无权限态并在退出后重进。',
    '',
    '| 步骤 | 结果 |',
    '|---|---|',
    ...steps.map((step) => `| ${step.name} | ${step.status} |`),
    '',
    '收尾：' + JSON.stringify(extra),
    '',
  ];
  writeFileSync(join(evidence, 'report.md'), lines.join('\n'));
  const replay = {
    summary: cards.find((card) => card.card === 'R1-014')?.status || 'FAIL',
    accepted: false, it1Outbound: false, lunaStamp: false,
    cycle: 'create-empty-schema, flyway-seed, browser-regression, drop-schema',
    evidence: 'evidence/redesign/2026-10-10/it1-named-gates',
    cards, steps: steps.map((step) => ({ name: step.name, status: step.status })),
    ...extra,
  };
  writeFileSync(join(replayEvidence, 'summary.json'), JSON.stringify(replay, null, 2));
  writeFileSync(join(replayEvidence, 'report.md'), [
    '# R1-014 L1 干净库回归',
    '',
    `日期：2026-10-10。结论：${replay.summary}。新建四套 owner schema，内容库 Flyway 种子后做 Web/H5、1280×900 与 390×844 回归，结束后删除本轮库。`,
    '',
    '保留库 `r1_it1_browser_20261010_iam_5d9f4b7e` 与 `r1_it1_browser_20261010_cnt_5d9f4b7e` 未删除。qida 容器未操作。`lunaStamp` 为 false。',
    '',
    '| 卡 | 结果 |',
    '|---|---|',
    ...cards.map((card) => `| ${card.card} | ${card.status} |`),
    '',
    `IT-2 计分与公开重测：${it2}。证据目录 \`evidence/redesign/2026-10-10/it2-score-browser\`。`,
    '',
    '收尾：' + JSON.stringify(extra),
    '',
  ].join('\n'));
  writeFileSync(join(scoreEvidence, 'report.md'), [
    '# IT-2 十题计分与公开重测',
    '',
    `日期：2026-10-10。结论：${it2}。身份是 IAM RS256。Chrome 使用临时 profile，只放行本轮测试证书的 SPKI，没有改系统钥匙串。`,
    '',
    '奇数题提交正确选项，偶数题提交错误选项。页面行内反馈与报告计数分开核对。公开重测按钮发出 Gateway `POST .../retest`。',
    '',
    '这不是 IT-2 出站。`accepted`、`it2Outbound`、`lunaStamp` 都是 false。',
    '',
    '| 步骤 | 结果 |',
    '|---|---|',
    ...steps.filter((step) => step.name.startsWith('it2-') || step.name === 'placement-answer-key-loaded').map((step) => `| ${step.name} | ${step.status} |`),
    '',
  ].join('\n'));
  return { cards, it2 };
}

let cleaned = false;
async function cleanup() {
  if (cleaned) return;
  cleaned = true;
  try { await stopAll(); } catch (error) { note('STOP ' + error.message); }
  note('KEYCHAIN_UNTOUCHED');
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
  const it1Failed = steps.some((step) => step.status === 'FAIL' && !step.name.startsWith('it2-'));
  const summary = it1Failed ? 'FAIL' : 'PASS';
  const extra = { dropped, retainedSchemasLeft: retainedLeft, listeners: busy, qidaUnchanged: qidaBefore.join() === qidaAfter.join() };
  const rolled = writeReports(summary, extra);
  const report = {
    summary, accepted: false, it1Outbound: false, lunaStamp: false, historicalRejectUnchanged: true,
    cards: rolled.cards, it2: rolled.it2, steps, ...extra,
  };
  writeFileSync(join(evidence, 'http-result.json'), JSON.stringify(report, null, 2));
  note('SUMMARY ' + summary + ' it2=' + rolled.it2 + ' retained=' + retainedLeft + ' listeners=' + (busy.join(',') || 'none'));
  if (summary !== 'PASS' || extra.qidaUnchanged !== true || retainedLeft !== '2' || busy.length) process.exitCode = 1;
}

process.on('SIGTERM', () => { cleanup().finally(() => process.exit(1)); });
process.on('SIGINT', () => { cleanup().finally(() => process.exit(1)); });
process.on('unhandledRejection', (error) => {
  const message = error instanceof Error ? error.message : String(error);
  note('UNHANDLED ' + scrub(message).slice(0, 300));
  cleanup().finally(() => process.exit(1));
});
try { await main(); }
catch (error) {
  record('run', 'FAIL', { error: scrub(error && error.message ? error.message : error).slice(0, 400) });
} finally {
  await cleanup();
}
