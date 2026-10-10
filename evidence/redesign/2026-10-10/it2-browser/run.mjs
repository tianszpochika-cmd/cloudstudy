import { spawn, execFileSync } from 'node:child_process';
import { createHash, createSign, randomBytes, randomUUID } from 'node:crypto';
import { chmodSync, createWriteStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = '/Users/Admin/Desktop/work/cloudstudy';
const evidence = join(root, 'evidence/redesign/2026-10-10/it2-browser');
const container = 'yuxuexing-local-mysql-1';
const suffix = randomBytes(4).toString('hex');
const names = {
  iam: [`it2_browser_20261010_iam_${suffix}`, `it2b_iam_${suffix}`],
  learner: [`it2_browser_20261010_lrn_${suffix}`, `it2b_lrn_${suffix}`],
  content: [`it2_browser_20261010_cnt_${suffix}`, `it2b_cnt_${suffix}`],
  assessment: [`it2_browser_20261010_asm_${suffix}`, `it2b_asm_${suffix}`],
};
const directory = join(tmpdir(), `it2-browser-${suffix}`);
const javaHome = process.env.JAVA_HOME || '/Users/Admin/.local/tools/jdk';
const ports = { iam: 18087, learner: 18088, content: 18089, assessment: 18091, gateway: 18070, web: 18180, mobile: 18183 };
const issuer = 'http://127.0.0.1:18087';
const jwks = 'https://127.0.0.1:18087/api/v1/auth/jwks';
const audience = 'yuxuexing-api';
const children = [];
const steps = [];
let password = '';
let tlsCa = null;
let keychainsBefore = [];
let keychainPath = '';
let qidaBefore = [];
const retained = ['r1_it1_browser_20261010_iam_5d9f4b7e', 'r1_it1_browser_20261010_cnt_5d9f4b7e'];

mkdirSync(evidence, { recursive: true });
mkdirSync(join(evidence, 'screenshots'), { recursive: true });

function note(line) { console.log(String(line)); }
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
  steps.push({ name, status, detail });
  note(`${status} ${name} ${JSON.stringify(detail).slice(0, 400)}`);
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
function startJava(id, jar, args, env) {
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
async function stopAll() {
  for (const entry of children.reverse()) {
    const child = entry.child;
    if (!child || child.pid == null || child.exitCode != null) continue;
    try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch { /* gone */ } }
    const deadline = Date.now() + 12000;
    while (child.exitCode == null && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 200));
    if (child.exitCode == null) {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* gone */ } }
    }
  }
}
function restoreKeychains() {
  if (!keychainsBefore.length) return;
  run('security', ['list-keychains', '-d', 'user', '-s', ...keychainsBefore]);
  if (keychainPath) {
    try { run('security', ['delete-keychain', keychainPath]); } catch { /* already gone */ }
  }
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
    '-subj', '/CN=IT2 browser loopback', '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost',
    '-keyout', join(directory, 'test-key.pem'), '-out', join(directory, 'test-ca.pem')]);
  chmodSync(join(directory, 'test-key.pem'), 0o600);
  run('openssl', ['pkcs12', '-export', '-in', join(directory, 'test-ca.pem'), '-inkey', join(directory, 'test-key.pem'),
    '-out', join(directory, 'iam-server.p12'), '-name', 'it2-browser', '-passout', 'env:R1_KEYSTORE_PASSWORD'], { env });
  run('keytool', ['-importcert', '-noprompt', '-alias', 'it2-browser', '-file', join(directory, 'test-ca.pem'),
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
    'server.ssl.key-store-type=PKCS12', 'server.ssl.key-alias=it2-browser',
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

  const iam = startJava('iam-service', 'iam-service', [
    '-Dfile.encoding=UTF-8', '-jar', join(root, 'services/iam-service/target/iam-service-0.1.0-SNAPSHOT.jar'),
    '--spring.profiles.active=local', '--spring.config.import=' + pathToFileURL(iamConfig).href,
    '--iam.jwt.ephemeral-keys-allowed=false',
    '--management.otlp.metrics.export.enabled=false', '--management.opentelemetry.enabled=false',
  ], { IAM_SERVICE_CLIENT_LEARNER_SECRET_DIGEST: clientDigest });
  await waitHealth(iam, () => request({ port: ports.iam, path: '/actuator/health', https: true }), 'IAM');

  const commonSecurity = {
    IAM_JWT_ISSUER: issuer, IAM_JWT_JWKS_URI: jwks, IAM_JWT_AUDIENCE: audience,
  };
  const content = startJava('content-service', 'content-service', [
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

  const learner = startJava('learner-service', 'learner-service', [
    ...trustArgs, '-jar', join(root, 'services/learner-service/target/learner-service-0.1.0-SNAPSHOT.jar'),
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

  const assessment = startJava('assessment-service', 'assessment-service', [
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

  const gateway = startJava('api-gateway', 'api-gateway', [
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

  await walkBrowser();
}

async function walkBrowser() {
  const calls = [];
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN' });
  const page = await context.newPage();
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api/v1/auth/') || url.pathname.includes('/placement/') || url.pathname.includes('/learner/') || url.pathname.includes('/iam/')) {
      calls.push({ method: response.request().method(), origin: url.origin, path: url.pathname, status: response.status() });
    }
  });
  const identifier = `synthetic-${suffix}@example.invalid`;
  const userPassword = `Aa1!${randomBytes(12).toString('hex')}`;
  try {
    await page.goto('http://127.0.0.1:18180/register', { waitUntil: 'networkidle' });
    const inputs = page.locator('input');
    await inputs.nth(0).fill(identifier);
    await inputs.nth(1).fill(userPassword);
    await inputs.nth(2).fill(userPassword);
    await page.getByRole('button', { name: '注册并继续', exact: true }).click();
    await page.waitForTimeout(2500);
    const registerCall = calls.find((call) => call.path.endsWith('/auth/register'));
    const registerOk = registerCall && registerCall.origin === 'https://127.0.0.1:18087' && registerCall.method === 'POST' && registerCall.status >= 200 && registerCall.status < 300;
    record('browser-register-direct-iam-tls', registerOk ? 'PASS' : 'FAIL', {
      call: registerCall || null, url: page.url(), body: (await page.locator('body').innerText()).slice(0, 240),
    });
    await page.screenshot({ path: join(evidence, 'screenshots', 'register.png'), mask: [inputs.nth(0), inputs.nth(1), inputs.nth(2)] });
    if (!registerOk) throw new Error('REGISTER');

    await page.waitForURL(/onboarding|adult|home|assessment/, { timeout: 15000 }).catch(() => null);
    await page.locator('#adult-birth-year').fill('1990');
    await page.getByText('我确认自己已满 18 周岁').click();
    await page.getByRole('button', { name: '继续', exact: true }).click();
    await page.getByRole('heading', { name: '完成必要同意' }).waitFor({ timeout: 15000 });
    const boxes = page.locator('form input[type=checkbox]');
    for (let index = 0; index < await boxes.count(); index += 1) await boxes.nth(index).check();
    await page.getByRole('button', { name: '继续', exact: true }).click();
    await page.locator('[data-goal-code=FOUNDATION]').click();
    await page.locator('[data-primary-action=save-target]').click();
    await page.waitForURL(/\/assessment/, { timeout: 20000 });
    await page.getByRole('button', { name: '开始', exact: true }).click({ timeout: 20000 });
    record('browser-gate-consent-goal-placement-entry', 'PASS', { url: page.url() });

    for (let index = 0; index < 12; index += 1) {
      if (await page.getByText('报告已生成').count()) break;
      const option = page.locator('button.option').first();
      await option.waitFor({ timeout: 20000 });
      const stepText = await page.locator('.question-meta').innerText().catch(() => '');
      await option.click();
      await page.getByRole('button', { name: '提交答案' }).click();
      await page.waitForFunction((previous) => {
        const body = document.body?.innerText || '';
        if (body.includes('报告已生成')) return true;
        const meta = document.querySelector('.question-meta')?.textContent || '';
        return Boolean(meta) && meta !== previous;
      }, stepText, { timeout: 20000 }).catch(() => null);
    }
    const reported = await page.getByText('报告已生成').count();
    record('browser-ten-items-report', reported ? 'PASS' : 'FAIL', { url: page.url(), body: (await page.locator('body').innerText()).slice(0, 240) });
    await page.screenshot({ path: join(evidence, 'screenshots', 'report.png') });
    if (!reported) throw new Error('REPORT');
    await page.getByRole('button', { name: '重测', exact: true }).click();
    await page.locator('button.option').first().waitFor({ timeout: 15000 });
    const retest = calls.find((call) => call.path.endsWith('/retest'));
    record('browser-retest-new-session', retest && retest.status === 201 ? 'PASS' : 'FAIL', { retest: retest || null, url: page.url() });
    await page.screenshot({ path: join(evidence, 'screenshots', 'retest.png') });
  } catch (error) {
    const body = await page.locator('body').innerText().catch(() => '');
    try { await page.screenshot({ path: join(evidence, 'screenshots', 'failure.png'), fullPage: true }); } catch { /* page already closed */ }
    record('browser-walk', 'FAIL', { error: String(error && error.message ? error.message : error), url: page.url(), body: body.slice(0, 500) });
    throw error;
  } finally {
    writeFileSync(join(evidence, 'calls.json'), JSON.stringify(calls, null, 2));
    await browser.close();
  }
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
    } catch (error) { dropped.push(schema + ' dropFailed'); }
  }
  const retainedLeft = sql(`SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name IN ('${retained.join("','")}');`);
  const busy = Object.values(ports).filter((port) => listeners(port).trim());
  const qidaAfter = run('docker', ['ps', '--format', '{{.Names}}']).split('\n').filter((name) => name.includes('qida')).sort();
  const summary = steps.some((step) => step.status === 'FAIL') ? 'FAIL' : 'PASS';
  const report = { summary, accepted: false, it2Outbound: false, lunaStamp: false, identity: 'iam-rs256', schemas: 'four-owners', steps, dropped, retainedSchemasLeft: retainedLeft, listeners: busy, qidaUnchanged: qidaBefore.join() === qidaAfter.join() };
  writeFileSync(join(evidence, 'http-result.json'), JSON.stringify(report, null, 2));
  note('SUMMARY ' + summary + ' retained=' + retainedLeft + ' listeners=' + (busy.join(',') || 'none'));
  if (summary !== 'PASS') process.exitCode = 1;
}
