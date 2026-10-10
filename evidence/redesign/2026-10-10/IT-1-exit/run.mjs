import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { chmodSync, closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = '/Users/Admin/Desktop/work/cloudstudy';
const evidence = join(root, 'evidence/redesign/2026-10-10/IT-1-exit');
const container = 'yuxuexing-local-mysql-1';
const day = '20261010';
const suffix = randomBytes(4).toString('hex');
const iamSchema = `r1_it1_exit_${day}_iam_${suffix}`;
const learnerSchema = `r1_it1_exit_${day}_lrn_${suffix}`;
const assessmentSchema = `r1_it1_exit_${day}_asm_${suffix}`;
const dbUser = `r1_it1_exit_${day}_${suffix}`;
const directory = join(tmpdir(), `r1-it1-exit-${suffix}`);
const CANONICAL_GOALS = ['FOUNDATION', 'COLLEGE_CET', 'POSTGRADUATE_ENGLISH', 'WORKPLACE_DAILY'];
const DIGEST = {
  TERMS: 'eb74b7254589589f61f5f3747d83379bc6f1e950ab7d8fd52f64f3ab50fb39fb',
  PRIVACY: '4ab15e31c11c9ef99b267ae620910420fdb8a9b6f720b988afeb59d5262ddd84',
  ADULT_LEARNING: '9702cd4fe3e50613f84030998f65c0c8e7961f058176b24f8a9e82006abea189',
};

const children = [];
let created = false;
let cleaned = false;
let clientDigest = '';
let tlsCa = null;
const steps = [];
const logNotes = [];

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', ...options });
}

function sql(statement) {
  return run('docker', [
    'exec', '-i', container, 'sh', '-c',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --protocol=socket --user=root --batch --raw --skip-column-names',
  ], { input: statement }).trim();
}

function redact(text) {
  return String(text ?? '')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]')
    .replace(/yuxuexing_refresh=[^;\s]+/g, 'yuxuexing_refresh=[REDACTED]')
    .replace(/password[=:][^\s,]+/gi, 'password=[REDACTED]')
    .replace(/secret[=:][^\s,]+/gi, 'secret=[REDACTED]')
    .replace(/jdbc:mysql:\/\/\S+/gi, 'jdbc:mysql://[REDACTED]');
}

function assertMysql() {
  const value = JSON.parse(run('docker', ['inspect', container]))[0];
  const facts = {
    name: value.Name,
    image: value.Config.Image,
    project: value.Config.Labels?.['com.docker.compose.project'],
    service: value.Config.Labels?.['com.docker.compose.service'],
    status: value.State.Status,
    health: value.State.Health?.Status,
    port: value.NetworkSettings?.Ports?.['3306/tcp'],
  };
  console.log('MYSQL_IDENTITY ' + JSON.stringify(facts));
  if (facts.name !== '/' + container || facts.image !== 'mysql:8.0' || facts.project !== 'yuxuexing-local'
      || facts.service !== 'mysql' || facts.status !== 'running' || facts.health !== 'healthy'
      || JSON.stringify(facts.port) !== JSON.stringify([{ HostIp: '127.0.0.1', HostPort: '13306' }])) {
    throw new Error('MYSQL_OWNER_OR_PORT_CHANGED');
  }
  return facts;
}

function listeners(port) {
  try {
    return run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN']);
  } catch (error) {
    if (error.status === 1) return '';
    throw error;
  }
}

function assertPortsFree(ports) {
  for (const port of ports) {
    const text = listeners(port).trim();
    if (text) throw new Error('FIXED_PORT_OCCUPIED ' + port + '\n' + text);
  }
  console.log('PORTS_FREE ' + ports.join(','));
}

function grantScope(schema, partialRevokes) {
  const name = partialRevokes ? schema : schema.replaceAll('_', '\\_');
  return '`' + name + '`.*';
}

function secretFile(name, text) {
  const path = join(directory, name);
  writeFileSync(path, text, { mode: 0o600 });
  chmodSync(path, 0o600);
  return path;
}

function requestStatus(url, ca) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, { ca, rejectUnauthorized: true, timeout: 2000 }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

async function waitHealth(child, url, ca) {
  for (let i = 0; i < 180; i++) {
    if (child.exitCode !== null) throw new Error('OWNED_CHILD_EARLY_EXIT ' + url);
    try {
      if (await requestStatus(url, ca) === 200) return;
    } catch { /* listener not up yet */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('HEALTH_TIMEOUT ' + url);
}

function spawnJava(id, jarName, argsFile, configFile, extraEnv = {}) {
  const log = openSync(join(directory, id + '.log'), 'a', 0o600);
  const jar = join(root, 'services', jarName, 'target', jarName + '-0.1.0-SNAPSHOT.jar');
  const env = {
    PATH: process.env.PATH,
    LANG: 'en_US.UTF-8',
    HOME: process.env.HOME,
    ...extraEnv,
  };
  if (process.env.JAVA_HOME) env.JAVA_HOME = process.env.JAVA_HOME;
  if (id === 'iam-service') env.IAM_SERVICE_CLIENT_LEARNER_SECRET_DIGEST = clientDigest;
  if (id === 'learner-service') env.LEARNER_SCHEMA = learnerSchema;
  if (Object.hasOwn(env, 'LEARNER_CONSENT_RECHECK_ENABLED')) {
    throw new Error('CONSENT_RECHECK_ENV_MUST_STAY_UNSET');
  }
  const child = spawn('java', [
    '@' + argsFile,
    '-jar', jar,
    '--spring.profiles.active=local',
    '--spring.config.import=' + pathToFileURL(configFile).href,
    '--management.otlp.metrics.export.enabled=false',
    '--management.opentelemetry.enabled=false',
  ], { cwd: directory, env, stdio: ['ignore', log, log] });
  closeSync(log);
  if (!child.pid) throw new Error('CHILD_START_FAILED ' + id);
  children.push(child);
  return child;
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  for (let i = 0; i < 50 && child.exitCode === null; i++) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (child.exitCode === null) child.kill('SIGKILL');
}

function tail(name) {
  try {
    return redact(run('tail', ['-n', '60', join(directory, name)]));
  } catch {
    return '';
  }
}

function step(id, status, pass, detail) {
  const safe = detail === undefined ? {} : JSON.parse(redact(JSON.stringify(detail)));
  steps.push({ id, httpStatus: status, result: pass ? 'PASS' : 'FAIL', detail: safe });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} status=${status ?? 'none'} ${JSON.stringify(safe)}`);
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

function codeOf(response) {
  return response?.json?.error?.errorCode
    ?? response?.json?.error?.code
    ?? response?.json?.code
    ?? response?.json?.error?.message
    ?? response?.json?.message
    ?? null;
}

function summarizeBody(json) {
  if (!json || typeof json !== 'object') return null;
  const data = json.data && typeof json.data === 'object' ? json.data : json;
  const keep = {};
  for (const key of ['status', 'goalCode', 'dailyQuotaMinutes', 'targetLevel', 'stateVersion', 'targetVersion', 'decision', 'learningAccess', 'contentLocale', 'sessionId']) {
    if (data[key] !== undefined) keep[key] = data[key];
  }
  if (json.error) keep.error = codeOf({ json });
  return keep;
}

function call(base, path, { method = 'GET', token, body, key, transport } = {}) {
  const url = new URL(base + path);
  const payload = body === undefined ? null : JSON.stringify(body);
  const headers = { accept: 'application/json' };
  if (payload !== null) {
    headers['content-type'] = 'application/json';
    headers['content-length'] = Buffer.byteLength(payload);
  }
  if (token) headers.authorization = `Bearer ${token}`;
  if (key) headers['idempotency-key'] = key;
  if (transport) headers['x-auth-transport'] = transport;
  const lib = url.protocol === 'https:' ? https : http;
  return new Promise((resolve) => {
    const req = lib.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method,
      headers,
      ca: url.protocol === 'https:' ? tlsCa : undefined,
      rejectUnauthorized: true,
      timeout: 20000,
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch { json = null; }
        resolve({ status: res.statusCode, json, text: text.slice(0, 500), error: null });
      });
    });
    req.on('error', (error) => resolve({
      status: null, json: null, text: '', error: String(error && error.message ? error.message : error),
    }));
    req.on('timeout', () => req.destroy(new Error('timeout')));
    if (payload !== null) req.write(payload);
    req.end();
  });
}

async function cleanup() {
  if (cleaned) return;
  cleaned = true;
  for (const child of children.reverse()) await stop(child);
  if (created) {
    sql(
      `DROP DATABASE IF EXISTS ${iamSchema}; DROP DATABASE IF EXISTS ${learnerSchema}; DROP DATABASE IF EXISTS ${assessmentSchema}; `
      + `DROP USER IF EXISTS '${dbUser}'@'%';`
    );
    const leftSchemas = sql(
      `SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name IN ('${iamSchema}','${learnerSchema}','${assessmentSchema}');`
    );
    const leftUsers = sql(`SELECT COUNT(*) FROM mysql.user WHERE user='${dbUser}';`);
    console.log('CLEANUP_LEFT schemas=' + leftSchemas + ' users=' + leftUsers);
    logNotes.push('cleanup schemas=' + leftSchemas + ' users=' + leftUsers);
  }
  const busy = [18087, 18088, 18091, 18070].filter((port) => listeners(port).trim());
  console.log(busy.length === 0 ? 'PORTS_FREE_AFTER' : 'PORTS_STILL_BUSY ' + busy.join(','));
  logNotes.push(busy.length === 0 ? 'PORTS_FREE_AFTER' : 'PORTS_STILL_BUSY ' + busy.join(','));
}

process.on('SIGINT', () => { cleanup().finally(() => process.exit(1)); });
process.on('SIGTERM', () => { cleanup().finally(() => process.exit(1)); });

const result = {
  date: '2026-10-10',
  branch: 'dev-redesign',
  suffix,
  iamSchema,
  learnerSchema,
  assessmentSchema,
  dbUser,
  consentRecheckEnv: process.env.LEARNER_CONSENT_RECHECK_ENABLED === undefined ? 'unset' : 'present-not-forwarded',
  steps,
  notes: logNotes,
};

try {
  if (dbUser.length > 32) throw new Error('DB_USER_TOO_LONG ' + dbUser.length);
  console.log(result.consentRecheckEnv === 'unset' ? 'PARENT_CONSENT_RECHECK_ENV_UNSET' : 'PARENT_CONSENT_RECHECK_ENV_PRESENT_NOT_FORWARDED');
  result.mysql = assertMysql();
  assertPortsFree([18087, 18088, 18091, 18070]);
  mkdirSync(directory, { mode: 0o700 });
  chmodSync(directory, 0o700);
  const partial = sql('SELECT @@GLOBAL.partial_revokes;');
  if (!['0', '1'].includes(partial)) throw new Error('MYSQL_GRANT_MODE_UNKNOWN');
  const partialRevokes = partial === '1';
  console.log('PARTIAL_REVOKES=' + partial);
  const existing = sql(
    `SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name IN ('${iamSchema}','${learnerSchema}','${assessmentSchema}');`
  );
  const existingUser = sql(`SELECT COUNT(*) FROM mysql.user WHERE user='${dbUser}';`);
  if (existing !== '0' || existingUser !== '0') throw new Error('RESOURCE_EXISTS');
  const dbPassword = randomBytes(24).toString('hex');
  created = true;
  sql(
    `CREATE DATABASE ${iamSchema} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; `
    + `CREATE DATABASE ${learnerSchema} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; `
    + `CREATE DATABASE ${assessmentSchema} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; `
    + `CREATE USER '${dbUser}'@'%' IDENTIFIED BY '${dbPassword}'; `
    + `GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,DROP,INDEX,REFERENCES ON ${grantScope(iamSchema, partialRevokes)} TO '${dbUser}'@'%'; `
    + `GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,DROP,INDEX,REFERENCES ON ${grantScope(learnerSchema, partialRevokes)} TO '${dbUser}'@'%'; `
    + `GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,DROP,INDEX,REFERENCES ON ${grantScope(assessmentSchema, partialRevokes)} TO '${dbUser}'@'%';`
  );
  console.log('SCHEMA_CREATED ' + iamSchema + ' ' + learnerSchema + ' ' + assessmentSchema + ' ' + dbUser);

  const keyPassword = randomBytes(18).toString('hex');
  const trustPassword = randomBytes(18).toString('hex');
  const clientSecret = randomBytes(24).toString('hex');
  clientDigest = createHash('sha256').update(clientSecret).digest('hex');
  const env = { ...process.env, R1_KEYSTORE_PASSWORD: keyPassword, R1_TRUST_PASSWORD: trustPassword };
  run('openssl', [
    'req', '-x509', '-newkey', 'rsa:3072', '-nodes', '-sha256', '-days', '7',
    '-subj', '/CN=R1-IT1-exit loopback',
    '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost',
    '-keyout', join(directory, 'test-key.pem'), '-out', join(directory, 'test-ca.pem'),
  ]);
  chmodSync(join(directory, 'test-key.pem'), 0o600);
  chmodSync(join(directory, 'test-ca.pem'), 0o600);
  run('openssl', [
    'pkcs12', '-export', '-in', join(directory, 'test-ca.pem'), '-inkey', join(directory, 'test-key.pem'),
    '-out', join(directory, 'iam-server.p12'), '-name', 'r1-it1-test', '-passout', 'env:R1_KEYSTORE_PASSWORD',
  ], { env });
  chmodSync(join(directory, 'iam-server.p12'), 0o600);
  run('keytool', [
    '-importcert', '-noprompt', '-alias', 'r1-it1-iam', '-file', join(directory, 'test-ca.pem'),
    '-keystore', join(directory, 'trust.p12'), '-storetype', 'PKCS12',
    '-storepass:env', 'R1_TRUST_PASSWORD',
  ], { env });
  chmodSync(join(directory, 'trust.p12'), 0o600);
  run('openssl', [
    'genpkey', '-algorithm', 'RSA', '-pkeyopt', 'rsa_keygen_bits:3072',
    '-out', join(directory, 'iam-signer.pem'),
  ]);
  chmodSync(join(directory, 'iam-signer.pem'), 0o600);

  const jdbc = (schema) => 'jdbc:mysql://127.0.0.1:13306/' + schema
    + '?serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true&characterEncoding=utf8';
  const iamConfig = secretFile('iam-runtime.properties', [
    'server.address=127.0.0.1',
    'server.port=18087',
    'server.ssl.enabled=true',
    'server.ssl.key-store-type=PKCS12',
    'server.ssl.key-alias=r1-it1-test',
    'server.ssl.key-store=' + join(directory, 'iam-server.p12'),
    'server.ssl.key-store-password=' + keyPassword,
    'iam.persistence.enabled=true',
    'spring.flyway.enabled=true',
    'iam.persistence.jdbc-url=' + jdbc(iamSchema),
    'iam.persistence.schema=' + iamSchema,
    'iam.persistence.username=' + dbUser,
    'iam.persistence.password=' + dbPassword,
    'iam.idempotency.v13-writers-drained=true',
    'iam.idempotency.replay-secret=' + randomBytes(32).toString('base64url'),
    'iam.idempotency.fingerprint-secret=' + randomBytes(32).toString('base64url'),
    'iam.jwt.private-key-file=' + join(directory, 'iam-signer.pem'),
    'iam.jwt.ephemeral-keys-allowed=false',
    'iam.jwt.refresh-cookie-secure=true',
    'iam.jwt.issuer=http://127.0.0.1:18087',
    'iam.consent.policy-source=local-candidate',
    'iam.local-adult-gate-enabled=true',
  ].join('\n') + '\n');
  const learnerConfig = secretFile('learner-runtime.properties', [
    'server.address=127.0.0.1',
    'server.port=18088',
    'learner.persistence.mode=jdbc',
    'spring.flyway.enabled=true',
    'LEARNER_SCHEMA=' + learnerSchema,
    'spring.flyway.schemas=' + learnerSchema,
    'spring.flyway.default-schema=' + learnerSchema,
    'service.schema=' + learnerSchema,
    'learner.persistence.jdbc-url=' + jdbc(learnerSchema),
    'learner.persistence.username=' + dbUser,
    'learner.persistence.password=' + dbPassword,
    'learner.persistence.driver-class-name=com.mysql.cj.jdbc.Driver',
    'security.resource-server.enabled=true',
    'security.resource-server.jwk-set-uri=https://127.0.0.1:18087/api/v1/auth/jwks',
    'security.resource-server.issuer-uri=http://127.0.0.1:18087',
    'security.resource-server.audience=yuxuexing-api',
    'learner.consent-recheck.enabled=true',
    'learner.consent-recheck.iam-base-url=https://127.0.0.1:18087',
    'learner.consent-recheck.client-id=learner-service',
    'learner.consent-recheck.client-secret=' + clientSecret,
  ].join('\n') + '\n');
  const assessmentConfig = secretFile('assessment-runtime.properties', [
    'server.address=127.0.0.1',
    'server.port=18091',
    'assessment.persistence.enabled=true',
    'spring.flyway.enabled=true',
    'ASSESSMENT_SCHEMA=' + assessmentSchema,
    'spring.flyway.schemas=' + assessmentSchema,
    'spring.flyway.default-schema=' + assessmentSchema,
    'service.schema=' + assessmentSchema,
    'assessment.persistence.schema=' + assessmentSchema,
    'assessment.persistence.jdbc-url=' + jdbc(assessmentSchema),
    'assessment.persistence.username=' + dbUser,
    'assessment.persistence.password=' + dbPassword,
    'assessment.persistence.driver-class-name=com.mysql.cj.jdbc.Driver',
    'security.resource-server.enabled=true',
    'security.resource-server.jwk-set-uri=https://127.0.0.1:18087/api/v1/auth/jwks',
    'security.resource-server.issuer-uri=http://127.0.0.1:18087',
    'security.resource-server.audience=yuxuexing-api',
  ].join('\n') + '\n');
  const gatewayConfig = secretFile('gateway-runtime.properties', [
    'server.address=127.0.0.1',
    'server.port=18070',
    'IAM_JWT_ISSUER=http://127.0.0.1:18087',
    'IAM_JWT_JWKS_URI=https://127.0.0.1:18087/api/v1/auth/jwks',
    'IAM_JWT_AUDIENCE=yuxuexing-api',
    'gateway.security.issuer-uri=http://127.0.0.1:18087',
    'gateway.security.jwk-set-uri=https://127.0.0.1:18087/api/v1/auth/jwks',
    'gateway.security.audience=yuxuexing-api',
    'ASSESSMENT_SERVICE_BASE_URL=http://127.0.0.1:18091',
    'LEARNER_SERVICE_BASE_URL=http://127.0.0.1:18088',
  ].join('\n') + '\n');
  const learnerProps = readFileSync(learnerConfig, 'utf8');
  if (!learnerProps.includes('learner.consent-recheck.enabled=true')) throw new Error('CONSENT_RECHECK_NOT_ON');
  if (learnerProps.includes('LEARNER_CONSENT_RECHECK_ENABLED=false')) throw new Error('CONSENT_RECHECK_DISABLED');
  console.log('CONSENT_RECHECK_EXPLICIT_TRUE');
  const trustArgs = [
    '-Djavax.net.ssl.trustStore=' + join(directory, 'trust.p12'),
    '-Djavax.net.ssl.trustStoreType=PKCS12',
    '-Djavax.net.ssl.trustStorePassword=' + trustPassword,
  ].join('\n') + '\n';
  const learnerArgs = secretFile('learner-jvm.args', trustArgs);
  const assessmentArgs = secretFile('assessment-jvm.args', trustArgs);
  const gatewayArgs = secretFile('gateway-jvm.args', trustArgs);
  const iamArgs = secretFile('iam-jvm.args', '-Dfile.encoding=UTF-8\n');
  const ca = readFileSync(join(directory, 'test-ca.pem'));
  tlsCa = ca;

  const iamChild = spawnJava('iam-service', 'iam-service', iamArgs, iamConfig);
  await waitHealth(iamChild, 'https://127.0.0.1:18087/actuator/health', ca);
  console.log('IAM_HEALTH_OK');
  const learnerChild = spawnJava('learner-service', 'learner-service', learnerArgs, learnerConfig);
  await waitHealth(learnerChild, 'http://127.0.0.1:18088/actuator/health', ca);
  console.log('LEARNER_HEALTH_OK');
  const assessmentChild = spawnJava('assessment-service', 'assessment-service', assessmentArgs, assessmentConfig);
  await waitHealth(assessmentChild, 'http://127.0.0.1:18091/actuator/health', ca);
  console.log('ASSESSMENT_HEALTH_OK');
  const gatewayChild = spawnJava('api-gateway', 'api-gateway', gatewayArgs, gatewayConfig, {
    IAM_JWT_ISSUER: 'http://127.0.0.1:18087',
    IAM_JWT_JWKS_URI: 'https://127.0.0.1:18087/api/v1/auth/jwks',
    IAM_JWT_AUDIENCE: 'yuxuexing-api',
    ASSESSMENT_SERVICE_BASE_URL: 'http://127.0.0.1:18091',
    LEARNER_SERVICE_BASE_URL: 'http://127.0.0.1:18088',
  });
  await waitHealth(gatewayChild, 'http://127.0.0.1:18070/actuator/health', ca);
  console.log('GATEWAY_HEALTH_OK');

  const iamFlyway = sql(`SELECT COUNT(*), SUM(success=0) FROM \`${iamSchema}\`.flyway_schema_history WHERE version IS NOT NULL;`);
  const learnerFlyway = sql(`SELECT COUNT(*), SUM(success=0) FROM \`${learnerSchema}\`.flyway_schema_history WHERE version IS NOT NULL;`);
  const assessmentFlyway = sql(`SELECT COUNT(*), SUM(success=0) FROM \`${assessmentSchema}\`.flyway_schema_history WHERE version IS NOT NULL;`);
  const accountsBefore = sql(`SELECT COUNT(*) FROM \`${iamSchema}\`.iam_account;`);
  step('seed.flyway', 200, accountsBefore === '0'
    && iamFlyway.endsWith('\t0') && learnerFlyway.endsWith('\t0') && assessmentFlyway.endsWith('\t0')
    && Number(iamFlyway.split('\t')[0]) > 0 && Number(learnerFlyway.split('\t')[0]) > 0
    && Number(assessmentFlyway.split('\t')[0]) > 0, {
    iamAccounts: Number(accountsBefore),
    iamFlyway: iamFlyway.replace('\t', ','),
    learnerFlyway: learnerFlyway.replace('\t', ','),
    assessmentFlyway: assessmentFlyway.replace('\t', ','),
  });

  const identifier = `it1-${suffix}-${randomBytes(3).toString('hex')}@example.invalid`;
  const password = `Aa1!${randomBytes(18).toString('hex')}`;
  const deviceId = randomUUID();
  const registerBody = {
    identifier,
    password,
    device: {
      deviceId,
      deviceType: 'WEB',
      deviceName: 'it1-exit',
      osVersion: 'test',
      clientVersion: 'it1-exit',
    },
  };
  const registered = await call('https://127.0.0.1:18087', '/api/v1/auth/register', {
    method: 'POST', body: registerBody, key: `it1-reg-${randomUUID()}`, transport: 'WEB_COOKIE',
  });
  const registerToken = registered.json?.data?.accessToken ?? null;
  const registerClaims = registerToken ? claimsOf(registerToken) : null;
  const permissions = Array.isArray(registerClaims?.permissions) ? registerClaims.permissions : [];
  const learningPermissions = permissions.filter(isLearningPermission);
  step('register.201-no-learning', registered.status, registered.status === 201
    && registerClaims?.adult_gate === 'NOT_EVALUATED'
    && registerClaims?.consent_state === 'UNKNOWN'
    && registerClaims?.token_type === 'access'
    && learningPermissions.length === 0
    && permissions.length > 0, {
    adult_gate: registerClaims?.adult_gate ?? null,
    consent_state: registerClaims?.consent_state ?? null,
    permissionCount: permissions.length,
    learningPermissionCount: learningPermissions.length,
    permissions,
    error: codeOf(registered),
    transportError: registered.error,
  });

  const gate = registerToken ? await call('https://127.0.0.1:18087', '/api/v1/iam/adult-gate', {
    method: 'POST',
    token: registerToken,
    key: `it1-gate-${randomUUID()}`,
    body: { confirmed: true, birthYear: 1990, policyVersion: 'b30-adult-v1' },
  }) : { status: null, json: null, error: 'no token' };
  step('adult-gate.passed', gate.status, gate.status === 200 && gate.json?.data?.status === 'PASSED'
    && gate.json?.data?.learningAccess === 'ELIGIBLE', {
    gateStatus: gate.json?.data?.status ?? null,
    learningAccess: gate.json?.data?.learningAccess ?? null,
    error: codeOf(gate),
    transportError: gate.error ?? null,
  });

  const consentResults = [];
  if (registerToken && gate.json?.data?.status === 'PASSED') {
    for (const type of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
      const accepted = await call('https://127.0.0.1:18087', '/api/v1/iam/consents', {
        method: 'PUT',
        token: registerToken,
        key: `it1-consent-${type}-${randomUUID()}`,
        body: { type, version: 'b30-consent-v1', decision: 'ACCEPTED', expectedDocumentDigest: DIGEST[type] },
      });
      consentResults.push({
        type,
        status: accepted.status,
        decision: accepted.json?.data?.decision ?? null,
        error: codeOf(accepted),
        transportError: accepted.error,
      });
    }
  }
  step('consents.three-accepted', consentResults.map((item) => item.status).join(',') || null,
    consentResults.length === 3 && consentResults.every((item) => item.status === 200 && item.decision === 'ACCEPTED'),
    { results: consentResults });

  const login = await call('https://127.0.0.1:18087', '/api/v1/auth/login', {
    method: 'POST',
    body: registerBody,
    key: `it1-login-${randomUUID()}`,
    transport: 'WEB_COOKIE',
  });
  const grantedToken = login.json?.data?.accessToken ?? null;
  const grantedClaims = grantedToken ? claimsOf(grantedToken) : null;
  const grantedPermissions = Array.isArray(grantedClaims?.permissions) ? grantedClaims.permissions : [];
  step('consents.relogin', login.status, Boolean(grantedToken)
    && grantedClaims?.adult_gate === 'PASSED'
    && grantedClaims?.consent_state === 'GRANTED'
    && grantedPermissions.includes('learner.target.write')
    && grantedPermissions.includes('assessment.session.read'), {
    adult_gate: grantedClaims?.adult_gate ?? null,
    consent_state: grantedClaims?.consent_state ?? null,
    hasTargetWrite: grantedPermissions.includes('learner.target.write'),
    hasAssessmentSessionRead: grantedPermissions.includes('assessment.session.read'),
    permissionCount: grantedPermissions.length,
    error: codeOf(login),
    transportError: login.error,
  });

  const targetBody = {
    expectedStateVersion: 0,
    goalCode: 'COLLEGE_CET',
    targetLevel: 'B1',
    dailyQuotaMinutes: 30,
  };
  const saved = grantedToken ? await call('http://127.0.0.1:18088', '/api/v1/learner/targets', {
    method: 'PUT', token: grantedToken, key: `it1-target-${randomUUID()}`, body: targetBody,
  }) : { status: null, json: null, error: 'no token' };
  const savedData = saved.json?.data ?? null;
  step('targets.put', saved.status, saved.status === 200
    && savedData?.goalCode === 'COLLEGE_CET'
    && CANONICAL_GOALS.includes(savedData?.goalCode)
    && savedData?.dailyQuotaMinutes === 30, {
    goalCode: savedData?.goalCode ?? null,
    dailyQuotaMinutes: savedData?.dailyQuotaMinutes ?? null,
    targetLevel: savedData?.targetLevel ?? null,
    stateVersion: savedData?.stateVersion ?? null,
    targetVersion: savedData?.targetVersion ?? null,
    error: codeOf(saved),
    transportError: saved.error ?? null,
  });

  const readBack = grantedToken ? await call('http://127.0.0.1:18088', '/api/v1/learner/targets', {
    token: grantedToken,
  }) : { status: null, json: null, error: 'no token' };
  const readData = readBack.json?.data ?? null;
  step('targets.get-readback', readBack.status, readBack.status === 200
    && readData?.goalCode === 'COLLEGE_CET'
    && CANONICAL_GOALS.includes(readData?.goalCode)
    && readData?.goalCode !== 'CET_4_6', {
    goalCode: readData?.goalCode ?? null,
    dailyQuotaMinutes: readData?.dailyQuotaMinutes ?? null,
    targetLevel: readData?.targetLevel ?? null,
    stateVersion: readData?.stateVersion ?? null,
    targetVersion: readData?.targetVersion ?? null,
    error: codeOf(readBack),
    transportError: readBack.error ?? null,
  });

  const router = readFileSync(join(root, 'apps/learner-web/src/router/index.ts'), 'utf8');
  const routeExists = /path:\s*'\/assessment'/.test(router) && /name:\s*'assessment'/.test(router)
    && /AssessmentPage\.vue/.test(router);
  step('route.assessment-page', null, routeExists, {
    path: '/assessment',
    name: 'assessment',
    component: 'AssessmentPage.vue',
  });

  const direct = grantedToken ? await call('http://127.0.0.1:18091', '/internal/v1/assessment/placement/start', {
    token: grantedToken,
  }) : { status: null, json: null, error: 'no token' };
  const gatewayRead = grantedToken ? await call('http://127.0.0.1:18070', '/api/v1/assessment/placement/start', {
    token: grantedToken,
  }) : { status: null, json: null, error: 'no token' };
  const directDenied = [401, 403].includes(direct.status);
  const gatewayDenied = [401, 403].includes(gatewayRead.status);
  const directImplemented = direct.status !== null && direct.status !== 404;
  const gatewayImplemented = gatewayRead.status !== null && gatewayRead.status !== 404;
  step('placement.read.owner', direct.status, direct.status !== null && !directDenied && direct.status < 500, {
    path: 'GET /internal/v1/assessment/placement/start',
    body: summarizeBody(direct.json),
    error: codeOf(direct),
    transportError: direct.error,
    text: direct.json ? null : redact(direct.text || ''),
  });
  step('placement.read.gateway', gatewayRead.status, gatewayRead.status !== null && !gatewayDenied && gatewayRead.status < 500, {
    path: 'GET /api/v1/assessment/placement/start',
    body: summarizeBody(gatewayRead.json),
    error: codeOf(gatewayRead),
    transportError: gatewayRead.error,
    text: gatewayRead.json ? null : redact(gatewayRead.text || ''),
  });
  result.placement = {
    routeExists,
    ownerStatus: direct.status,
    gatewayStatus: gatewayRead.status,
    ownerDenied: directDenied,
    gatewayDenied,
    ownerImplemented: directImplemented,
    gatewayImplemented,
    ownerBody: summarizeBody(direct.json),
    gatewayBody: summarizeBody(gatewayRead.json),
  };
  const failed = steps.filter((item) => item.result !== 'PASS').map((item) => item.id);
  result.failed = failed;
  console.log('PROBE_SUMMARY pass=' + (steps.length - failed.length) + ' fail=' + failed.length);
  console.log('RUN_DONE');
} catch (error) {
  result.error = redact(error && error.stack ? error.stack : error);
  console.log('RUN_FAILED ' + result.error);
  for (const name of ['iam-service.log', 'learner-service.log', 'assessment-service.log', 'api-gateway.log']) {
    const text = tail(name);
    if (text) {
      console.log('--- ' + name + ' ---\n' + text);
      result.notes.push(name + '\n' + text);
    }
  }
  process.exitCode = 1;
} finally {
  try { await cleanup(); } catch (error) {
    console.log('CLEANUP_FAILED ' + redact(error && error.stack ? error.stack : error));
    process.exitCode = 1;
  }
  result.failed = result.failed || steps.filter((item) => item.result !== 'PASS').map((item) => item.id);
  writeFileSync(join(evidence, 'http-result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log('WROTE ' + join(evidence, 'http-result.json'));
}
