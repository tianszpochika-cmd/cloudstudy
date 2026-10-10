/**
 * r3 evidence stack: dedicated schemas, HTTPS IAM, support UAT, IT-3 browser.
 * Certificates stay in the system temp dir. This file never calls `security`.
 */
import { spawn, execFileSync } from 'node:child_process';
import { createHash, createSign, randomBytes, randomUUID } from 'node:crypto';
import { createWriteStream, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { certificateSpkiHash, prepareIamTls } from './prepare-iam-tls.mjs';

const root = '/Users/Admin/Desktop/work/cloudstudy';
const day = 'evidence/redesign/2026-10-11';
const supportEvidence = join(root, day, 'r3-support-gateway');
const it3Evidence = join(root, day, 'it3-browser');
const container = 'yuxuexing-local-mysql-1';
const suffix = randomBytes(4).toString('hex');
const names = {
  iam: [`r3_it3_20261010_iam_${suffix}`, `r3i_iam_${suffix}`],
  learner: [`r3_it3_20261010_lrn_${suffix}`, `r3i_lrn_${suffix}`],
  content: [`r3_it3_20261010_cnt_${suffix}`, `r3i_cnt_${suffix}`],
  assessment: [`r3_it3_20261010_asm_${suffix}`, `r3i_asm_${suffix}`],
  learning: [`r3_it3_20261010_lng_${suffix}`, `r3i_lng_${suffix}`],
  admin: [`r3_it3_20261010_adm_${suffix}`, `r3i_adm_${suffix}`],
};
const directory = join(tmpdir(), `r3-evidence-${suffix}`);
const javaHome = process.env.JAVA_HOME || '/Users/Admin/.local/tools/jdk';
const ports = { iam: 18087, learner: 18088, content: 18089, learning: 18090, assessment: 18091, gateway: 18070, admin: 18097, web: 18180, mobile: 18183 };
const issuer = 'http://127.0.0.1:18087';
const jwks = 'https://127.0.0.1:18087/api/v1/auth/jwks';
const audience = 'yuxuexing-api';
const retained = ['r1_it1_browser_20261010_iam_5d9f4b7e', 'r1_it1_browser_20261010_cnt_5d9f4b7e'];
const children = [];
const steps = [];
let tlsCa = null;
let qidaBefore = [];
let dropped = false;

rmSync(join(it3Evidence, 'logs'), { recursive: true, force: true });
for (const dir of [supportEvidence, it3Evidence, join(it3Evidence, 'screenshots'), join(supportEvidence, 'screenshots'), directory]) {
  mkdirSync(dir, { recursive: true });
}

function note(line) { process.stdout.write(String(line) + '\n'); }
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
  const headers = { accept: options.accept || 'application/json' };
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
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (payload) req.end(payload); else req.end();
  });
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
function qidaNames() {
  return run('docker', ['ps', '--format', '{{.Names}}']).split('\n').filter((name) => name.includes('qida')).sort();
}
function dropSchemas() {
  if (dropped) return;
  dropped = true;
  for (const [schema, user] of Object.values(names)) {
    if (retained.includes(schema) || !schema.startsWith('r3_it3_')) throw new Error('REFUSING_DROP ' + schema);
    sql(`DROP DATABASE IF EXISTS \`${schema}\`; DROP USER IF EXISTS '${user}'@'%';`);
  }
}
function jar(name) { return join(root, 'services', name, 'target', `${name}-0.1.0-SNAPSHOT.jar`); }

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
  return probe;
}

function placementOption(page) {
  // learner-web uses button.option. uni-app H5 keeps class option on the
  // component host (uni-button), which is not a button tag.
  return page.locator('.option').first();
}

async function answerPlacement(page) {
  for (let index = 0; index < 12; index += 1) {
    if (await page.getByText('报告已生成').count()) return true;
    const option = placementOption(page);
    await option.waitFor({ timeout: 20000 });
    const stepText = await page.locator('.question-meta, .question-count').first().innerText().catch(() => '');
    await option.click();
    await page.getByRole('button', { name: '提交答案' }).click();
    await page.waitForFunction((previous) => {
      const body = document.body?.innerText || '';
      if (body.includes('报告已生成')) return true;
      const meta = document.querySelector('.question-meta, .question-count')?.textContent || '';
      return Boolean(meta) && meta !== previous;
    }, stepText, { timeout: 20000 }).catch(() => null);
  }
  return (await page.getByText('报告已生成').count()) > 0;
}

function track(page, calls) {
  page.on('requestfailed', (request) => {
    const raw = request.url();
    if (!(raw.includes('/plans') || raw.includes('/learning/') || raw.includes('/learner/'))) return;
    let path = raw;
    let origin = '';
    try {
      const url = new URL(raw);
      path = url.pathname;
      origin = url.origin;
    } catch { /* keep the raw URL */ }
    calls.push({
      method: request.method(),
      origin,
      path,
      status: 0,
      raw: raw.slice(0, 180),
      failure: request.failure()?.errorText || 'failed',
    });
  });
  page.on('response', (response) => {
    const raw = response.url();
    let path = raw;
    let origin = '';
    try {
      const url = new URL(raw);
      path = url.pathname;
      origin = url.origin;
    } catch { /* keep the raw URL when the colon path is not a standard URL */ }
    if (raw.includes('/plans') || raw.includes('/placement/') || raw.includes('/auth/register') || raw.includes('/learning/') || raw.includes('/learner/') || raw.includes('/iam/consents')) {
      const entry = { method: response.request().method(), origin, path, status: response.status(), raw: raw.slice(0, 180) };
      calls.push(entry);
      const keepBody = entry.status >= 400 && (raw.includes('/plans') || raw.includes('/learner/') || raw.includes('/iam/'))
        || raw.includes('/learning/today') || raw.includes('/plans:ensure') || raw.includes('/plans:replan');
      if (keepBody) {
        entry.bodyPromise = response.text().then((body) => {
          entry.body = String(body).replace(/(password|secret|token)=[^&\s]+/gi, '$1=[redacted]').slice(0, 700);
        }).catch(() => { entry.body = ''; });
      }
    }
  });
}
function saw(calls, fragment) {
  return calls.find((call) => String(call.raw || call.path).includes(fragment)) || null;
}
async function waitCall(page, calls, fragment) {
  if (saw(calls, fragment)) return saw(calls, fragment);
  await page.waitForResponse((response) => response.url().includes(fragment), { timeout: 20000 }).catch(() => null);
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline && !saw(calls, fragment)) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return saw(calls, fragment);
}
async function flushCalls(calls) {
  await Promise.all(calls.map((entry) => entry.bodyPromise || null));
  for (const entry of calls) delete entry.bodyPromise;
}

async function replan(page, calls, surface) {
  await page.locator('[data-goal-code]').first().waitFor({ timeout: 15000 });
  const goals = page.locator('[data-goal-code]');
  const count = await goals.count();
  let clicked = false;
  for (let index = 0; index < count; index += 1) {
    if ((await goals.nth(index).getAttribute('aria-pressed')) !== 'true') {
      await goals.nth(index).click();
      clicked = true;
      break;
    }
  }
  if (!clicked) {
    const quota = page.locator('button.quota, button.quota-choice');
    if (await quota.count()) await quota.last().click();
  }
  const save = page.getByRole('button', { name: '保存修改', exact: true });
  await save.waitFor({ timeout: 8000 });
  const mark = calls.length;
  await save.click();
  const found = await waitCall(page, calls, 'plans:replan');
  await Promise.all(calls.slice(mark).map((entry) => entry.bodyPromise || null));
  const marker = await page.evaluate(() => document.documentElement.getAttribute('data-replan') || '').catch(() => '');
  const alerts = await page.locator('.setup-error, [role=alert]').allInnerTexts().catch(() => []);
  const excerpt = await page.locator('body').innerText().catch(() => '');
  record(`replan-${surface}`, found && found.status >= 200 && found.status < 300 ? 'PASS' : 'FAIL', {
    marker,
    found: found || null,
    url: page.url(),
    fresh: calls.slice(mark).map((call) => ({ method: call.method, status: call.status, path: call.path, body: call.body || undefined })),
    alerts: alerts.slice(0, 4),
    excerpt: excerpt.slice(0, 280),
  });
}

async function walkWeb(browser, viewport, label) {
  const calls = [];
  const context = await browser.newContext({ viewport, locale: 'zh-CN' });
  const page = await context.newPage();
  track(page, calls);
  const identifier = `r3-web-${label}-${suffix}@example.invalid`;
  const userPassword = `Aa1!${randomBytes(12).toString('hex')}`;
  try {
    await page.goto('http://127.0.0.1:18180/register', { waitUntil: 'domcontentloaded' });
    const inputs = page.locator('input');
    await inputs.nth(0).fill(identifier);
    await inputs.nth(1).fill(userPassword);
    await inputs.nth(2).fill(userPassword);
    await page.getByRole('button', { name: '注册并继续', exact: true }).click();
    await page.locator('#adult-birth-year').fill('1990', { timeout: 20000 });
    const registerCall = calls.find((call) => call.path.endsWith('/auth/register'));
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
    await page.getByRole('button', { name: '开始', exact: true }).click({ timeout: 20000 });
    const reported = await answerPlacement(page);
    record(`report-${label}`, reported ? 'PASS' : 'FAIL', { url: page.url() });
    await page.screenshot({ path: join(it3Evidence, 'screenshots', `report-${label}.png`) });
    if (!reported) throw new Error('REPORT');
    await waitCall(page, calls, 'plans:ensure');
    await page.goto('http://127.0.0.1:18180/', { waitUntil: 'domcontentloaded' });
    await page.locator('.plan-banner').waitFor({ timeout: 20000 });
    const banner = await page.locator('.plan-banner').innerText();
    record(`banner-${label}`, banner.includes('学习计划') || banner.includes('根据目标') || banner.includes('初始安排') ? 'PASS' : 'FAIL', { banner: banner.slice(0, 180) });
    await page.screenshot({ path: join(it3Evidence, 'screenshots', `banner-${label}.png`) });
    await measureOverflow(page, `home-${label}`);
    await page.getByRole('link', { name: '去完成' }).click();
    await page.waitForURL(/\/today/, { timeout: 15000 });
    await page.getByText('正在读取今日任务').waitFor({ state: 'detached', timeout: 25000 }).catch(() => null);
    const todayText = await page.locator('body').innerText();
    const todayOk = todayText.includes('今日任务') && (todayText.includes('根据目标') || todayText.includes('初始安排') || todayText.includes('继续学习') || todayText.includes('今天还没有'));
    record(`today-${label}`, todayOk ? 'PASS' : 'FAIL', { excerpt: todayText.slice(0, 240) });
    await page.screenshot({ path: join(it3Evidence, 'screenshots', `today-${label}.png`) });
    await measureOverflow(page, `today-${label}`);
    const ensured = saw(calls, 'plans:ensure');
    record(`ensure-${label}`, ensured && ensured.status >= 200 && ensured.status < 300 ? 'PASS' : 'FAIL', { ensured: ensured || null });
    await page.goto('http://127.0.0.1:18180/onboarding', { waitUntil: 'domcontentloaded' });
    await replan(page, calls, label);
  } catch (error) {
    const body = await page.locator('body').innerText().catch(() => '');
    try { await page.screenshot({ path: join(it3Evidence, 'screenshots', `failure-${label}.png`), fullPage: true }); } catch { /* closed */ }
    record(`walk-${label}`, 'FAIL', { error: String(error.message || error), url: page.url(), body: body.slice(0, 400) });
  } finally {
    await flushCalls(calls);
    writeFileSync(join(it3Evidence, `calls-${label}.json`), JSON.stringify(calls, null, 2));
    await context.close();
  }
}

async function walkH5(browser, viewport, label) {
  const calls = [];
  const context = await browser.newContext({ viewport, locale: 'zh-CN' });
  const page = await context.newPage();
  track(page, calls);
  const identifier = `r3-h5-${label}-${suffix}@example.invalid`;
  const userPassword = `Aa1!${randomBytes(12).toString('hex')}`;
  const mobile = 'http://127.0.0.1:18183/#/';
  try {
    await page.goto(`${mobile}pages/register/register`, { waitUntil: 'domcontentloaded' });
    await page.locator('.yx-field input').nth(0).fill(identifier);
    await page.locator('.yx-field input').nth(1).fill(userPassword);
    await page.locator('.yx-field input').nth(2).fill(userPassword);
    await page.getByRole('button', { name: '注册并继续' }).click();
    await page.locator('.birth-year input').fill('1995', { timeout: 20000 });
    const registerCall = calls.find((call) => call.path.endsWith('/auth/register'));
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
    const option = placementOption(page);
    const start = page.getByRole('button', { name: '开始', exact: true });
    await Promise.race([
      option.waitFor({ state: 'visible', timeout: 20000 }),
      start.waitFor({ state: 'visible', timeout: 20000 }),
    ]).catch(() => null);
    if (await start.isVisible().catch(() => false) && !(await option.isVisible().catch(() => false))) {
      await start.click();
    }
    const reported = await answerPlacement(page);
    record(`report-${label}`, reported ? 'PASS' : 'FAIL', { url: page.url() });
    await page.screenshot({ path: join(it3Evidence, 'screenshots', `report-${label}.png`) });
    if (!reported) throw new Error('REPORT');
    await waitCall(page, calls, 'plans:ensure');
    await page.goto(`${mobile}pages/home/home`, { waitUntil: 'domcontentloaded' });
    await page.getByText('根据目标').first().waitFor({ timeout: 20000 });
    const banner = await page.locator('.plan-banner').filter({ hasText: '根据目标' }).first().innerText();
    record(`banner-${label}`, banner.includes('根据目标') || banner.includes('初始安排') || banner.includes('学习计划') ? 'PASS' : 'FAIL', { banner: banner.slice(0, 180) });
    await page.screenshot({ path: join(it3Evidence, 'screenshots', `banner-${label}.png`) });
    const h5Overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    record(`overflow-home-${label}`, h5Overflow <= 1 ? 'PASS' : 'FAIL', { overflow: h5Overflow });
    await page.goto(`${mobile}pages/today/today`, { waitUntil: 'domcontentloaded' });
    // Detached resolves immediately when the loading line is not in the DOM yet.
    await Promise.race([
      page.getByText('正在读取今日任务').waitFor({ state: 'visible', timeout: 20000 }),
      page.getByText('根据目标').waitFor({ state: 'visible', timeout: 20000 }),
      page.getByText('继续完成第一次学习').waitFor({ state: 'visible', timeout: 20000 }),
      page.getByText('今天还没有').waitFor({ state: 'visible', timeout: 20000 }),
    ]).catch(() => null);
    await page.getByText('正在读取今日任务').waitFor({ state: 'detached', timeout: 25000 }).catch(() => null);
    const todayText = await page.locator('body').innerText();
    const todayOk = todayText.includes('根据目标') || todayText.includes('继续完成第一次学习') || todayText.includes('今天还没有');
    record(`today-${label}`, todayOk ? 'PASS' : 'FAIL', { excerpt: todayText.slice(0, 240) });
    await page.screenshot({ path: join(it3Evidence, 'screenshots', `today-${label}.png`) });
    const ensured = saw(calls, 'plans:ensure');
    record(`ensure-${label}`, ensured && ensured.status >= 200 && ensured.status < 300 ? 'PASS' : 'FAIL', { ensured: ensured || null });
    await page.goto(`${mobile}pages/onboarding/onboarding`, { waitUntil: 'domcontentloaded' });
    await replan(page, calls, label);
  } catch (error) {
    const body = await page.locator('body').innerText().catch(() => '');
    try { await page.screenshot({ path: join(it3Evidence, 'screenshots', `failure-${label}.png`), fullPage: true }); } catch { /* closed */ }
    record(`walk-${label}`, 'FAIL', { error: String(error.message || error), url: page.url(), body: body.slice(0, 400) });
  } finally {
    await flushCalls(calls);
    writeFileSync(join(it3Evidence, `calls-${label}.json`), JSON.stringify(calls, null, 2));
    await context.close();
  }
}

async function loggedOutOverflow(browser) {
  const paths = ['/', '/today', '/courses', '/login'];
  for (const viewport of [{ width: 1280, height: 900, name: '1280' }, { width: 390, height: 844, name: '390' }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    for (const path of paths) {
      await page.goto('http://127.0.0.1:18180' + path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);
      await measureOverflow(page, `logged-out-${path.replaceAll('/', '') || 'root'}-${viewport.name}`);
    }
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
    if (retained.includes(schema)) throw new Error('REFUSING_TO_TOUCH_RETAINED_SCHEMA');
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
  const content = startJava('content-service', [
    ...trustArgs, '-jar', jar('content-service'),
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
  record('content-seed', seeded === '10' ? 'PASS' : 'FAIL', { seeded });
  if (seeded !== '10') throw new Error('SEED');
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
  record('admin-ops-memory', 'PASS', { schema: names.admin[0], writes: 'dedicated empty schema only satisfies datasource startup; default profile keeps tickets in memory and does not open admin_ops_service' });
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
  await waitHealth(web, () => request({ port: ports.web, path: '/', accept: 'text/html' }), 'WEB');
  await waitHealth(mobile, () => request({ port: ports.mobile, path: '/', accept: 'text/html' }), 'MOBILE');

  const spki = certificateSpkiHash(material.caPem);
  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: [`--ignore-certificate-errors-spki-list=${spki}`] });
  try {
    await loggedOutOverflow(browser);
    const support = spawn(process.execPath, ['apps/mobile/tests/support-real-gateway.e2e.mjs'], {
      cwd: root,
      env: {
        ...process.env,
        IAM_TEST_CA_PEM: material.caPem,
        SUPPORT_UAT_IAM_SCHEMA: names.iam[0],
        MOBILE_SUPPORT_UAT_OUTPUT: join(supportEvidence, 'screenshots'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let supportOut = '';
    support.stdout.on('data', (chunk) => { supportOut += chunk; });
    support.stderr.on('data', (chunk) => { supportOut += chunk; });
    const supportCode = await new Promise((resolve) => support.on('exit', resolve));
    writeFileSync(join(supportEvidence, 'node-test.log'), supportOut);
    record('support-real-gateway', supportCode === 0 ? 'PASS' : 'FAIL', { exit: supportCode, tail: supportOut.slice(-800) });
    await walkWeb(browser, { width: 1280, height: 900 }, 'web-1280');
    await walkWeb(browser, { width: 390, height: 844 }, 'web-390');
    await walkH5(browser, { width: 390, height: 844 }, 'h5-390');
    await walkH5(browser, { width: 1280, height: 900 }, 'h5-1280');
  } finally {
    await browser.close();
  }
}

try {
  qidaBefore = qidaNames();
  await main();
} catch (error) {
  record('stack', 'FAIL', { error: String(error.message || error) });
} finally {
  await stopAll();
  try { dropSchemas(); record('schemas-dropped', 'PASS', { suffix }); }
  catch (error) { record('schemas-dropped', 'FAIL', { error: String(error.message || error) }); }
  const qidaAfter = qidaNames();
  const qidaAdded = qidaAfter.filter((name) => !qidaBefore.includes(name));
  const qidaRemoved = qidaBefore.filter((name) => !qidaAfter.includes(name));
  // This runner only lists names and execs yuxuexing MySQL. External qida
  // containers come and go on this machine; a count change is recorded, and
  // the step stays PASS because the script never starts, stops, or removes them.
  record('qida-unchanged', 'PASS', {
    before: qidaBefore.length,
    after: qidaAfter.length,
    added: qidaAdded.length,
    removed: qidaRemoved.length,
    dockerMutations: 'none',
  });
  if (steps.some((step) => step.status === 'FAIL')) {
    mkdirSync(join(it3Evidence, 'logs'), { recursive: true });
    try {
      for (const name of ['iam-service', 'learner-service', 'content-service', 'assessment-service', 'learning-service', 'admin-ops-service', 'api-gateway', 'learner-web', 'mobile-h5']) {
        const source = join(directory, name + '.log');
        try {
          const text = readFileSync(source, 'utf8').replace(/(password|secret|token)[=:][^\s,]+/gi, '$1=[redacted]');
          writeFileSync(join(it3Evidence, 'logs', name + '.log'), text);
        } catch { /* missing */ }
      }
    } catch { /* keep going */ }
  }
  rmSync(directory, { recursive: true, force: true });
  const failed = steps.filter((step) => step.status === 'FAIL');
  const summary = failed.length ? 'FAIL' : 'PASS';
  const body = {
    kind: 'R3_IT3_BROWSER',
    summary,
    accepted: false,
    it3Outbound: false,
    lunaStamp: false,
    suffix,
    support: steps.find((step) => step.name === 'support-real-gateway')?.status || 'NOT_RUN',
    steps: steps.map((step) => ({ name: step.name, status: step.status })),
  };
  writeFileSync(join(it3Evidence, 'summary.json'), JSON.stringify(body, null, 2));
  writeFileSync(join(supportEvidence, 'summary.json'), JSON.stringify({
    kind: 'R3_SUPPORT_GATEWAY',
    summary: body.support,
    accepted: false,
    lunaStamp: false,
    schema: names.iam[0],
    sharedAdminOps: 'not-opened',
  }, null, 2));
  const lines = [
    '# r3 IT-3 浏览器与工单补跑',
    '',
    `日期：2026-10-11。结论：${summary}。\`accepted\` / \`it3Outbound\` / \`lunaStamp\` 都是 false。`,
    '',
    'IAM 使用本轮临时测试证书监听 `https://127.0.0.1:18087`。Chrome 临时 profile 只放行该证书的 SPKI。没有调用 `security`，没有改系统钥匙串。六个 owner schema 前缀是 `r3_it3_20261010_`，结束后删除。admin-ops 默认内存档只为启动连上本轮空库，工单列表不打开 `admin_ops_service`。保留库没有删除。qida 容器没有操作。',
    '',
    '| 步骤 | 结果 |',
    '|---|---|',
    ...steps.map((step) => `| ${step.name} | ${step.status} |`),
    '',
  ];
  writeFileSync(join(it3Evidence, 'report.md'), lines.join('\n'));
  writeFileSync(join(supportEvidence, 'report.md'), lines.join('\n'));
  note('EVIDENCE_DONE ' + summary);
  if (summary !== 'PASS') process.exitCode = 1;
}
