import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = '/Users/Admin/Desktop/work/cloudstudy';
const evidence = join(root, 'evidence/redesign/2026-10-09/R1-014');
const container = 'yuxuexing-local-mysql-1';
const day = '20261009';
const suffix = randomBytes(6).toString('hex');
const iamSchema = `r1_014_iam_${day}_${suffix}`;
const learnerSchema = `r1_014_lrn_${day}_${suffix}`;
const dbUser = `r1_014_${suffix}`;
const directory = join(tmpdir(), `r1-014-runtime-${suffix}`);

let iamChild = null;
let learnerChild = null;
let created = false;
let cleaned = false;
let clientDigest = '';

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', ...options });
}

function sql(statement) {
  return run('docker', [
    'exec', '-i', container, 'sh', '-c',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --protocol=socket --user=root --batch --skip-column-names',
  ], { input: statement }).trim();
}

function redact(text) {
  return String(text)
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
}

function listeners(port) {
  try {
    return run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN']);
  } catch (error) {
    if (error.status === 1) return '';
    throw error;
  }
}

function assertPortsFree() {
  for (const port of [18087, 18088]) {
    const text = listeners(port).trim();
    if (text) throw new Error('FIXED_PORT_OCCUPIED ' + port + '\n' + text);
  }
  console.log('PORTS_FREE');
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
    if (child.exitCode !== null) throw new Error('OWNED_CHILD_EARLY_EXIT');
    try {
      if (await requestStatus(url, ca) === 200) return;
    } catch { /* listener not up yet */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('HEALTH_TIMEOUT ' + url);
}

function spawnJava(id, argsFile, configFile) {
  const log = openSync(join(directory, id + '.log'), 'a', 0o600);
  const jar = join(root, 'services', id, 'target', id + '-0.1.0-SNAPSHOT.jar');
  const env = {
    PATH: process.env.PATH,
    LANG: 'en_US.UTF-8',
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

async function cleanup() {
  if (cleaned) return;
  cleaned = true;
  await stop(learnerChild);
  await stop(iamChild);
  if (created) {
    sql(
      `DROP DATABASE IF EXISTS ${iamSchema}; DROP DATABASE IF EXISTS ${learnerSchema}; `
      + `DROP USER IF EXISTS '${dbUser}'@'%';`
    );
    const leftSchemas = sql(`SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name LIKE 'r1_014%';`);
    const leftUsers = sql(`SELECT COUNT(*) FROM mysql.user WHERE user LIKE 'r1_014%';`);
    console.log('CLEANUP_LEFT schemas=' + leftSchemas + ' users=' + leftUsers);
  }
  const busy = [18087, 18088].filter((port) => listeners(port).trim());
  console.log(busy.length === 0 ? 'PORTS_FREE_AFTER' : 'PORTS_STILL_BUSY ' + busy.join(','));
}

process.on('SIGINT', () => { cleanup().finally(() => process.exit(1)); });
process.on('SIGTERM', () => { cleanup().finally(() => process.exit(1)); });

try {
  if (process.env.LEARNER_CONSENT_RECHECK_ENABLED !== undefined) {
    console.log('PARENT_CONSENT_RECHECK_ENV_PRESENT_NOT_FORWARDED');
  } else {
    console.log('PARENT_CONSENT_RECHECK_ENV_UNSET');
  }
  assertMysql();
  assertPortsFree();
  mkdirSync(directory, { mode: 0o700 });
  chmodSync(directory, 0o700);
  const partial = sql('SELECT @@GLOBAL.partial_revokes;');
  if (!['0', '1'].includes(partial)) throw new Error('MYSQL_GRANT_MODE_UNKNOWN');
  const partialRevokes = partial === '1';
  console.log('PARTIAL_REVOKES=' + partial);
  const existing = sql(
    `SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name IN ('${iamSchema}','${learnerSchema}');`
  );
  const existingUser = sql(`SELECT COUNT(*) FROM mysql.user WHERE user='${dbUser}';`);
  if (existing !== '0' || existingUser !== '0') throw new Error('RESOURCE_EXISTS');
  const dbPassword = randomBytes(24).toString('hex');
  created = true;
  sql(
    `CREATE DATABASE ${iamSchema} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; `
    + `CREATE DATABASE ${learnerSchema} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; `
    + `CREATE USER '${dbUser}'@'%' IDENTIFIED BY '${dbPassword}'; `
    + `GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,DROP,INDEX,REFERENCES ON ${grantScope(iamSchema, partialRevokes)} TO '${dbUser}'@'%'; `
    + `GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,DROP,INDEX,REFERENCES ON ${grantScope(learnerSchema, partialRevokes)} TO '${dbUser}'@'%';`
  );
  console.log('SCHEMA_CREATED ' + iamSchema + ' ' + learnerSchema + ' ' + dbUser);

  const keyPassword = randomBytes(18).toString('hex');
  const trustPassword = randomBytes(18).toString('hex');
  const clientSecret = randomBytes(24).toString('hex');
  clientDigest = createHash('sha256').update(clientSecret).digest('hex');
  const env = { ...process.env, R1_KEYSTORE_PASSWORD: keyPassword, R1_TRUST_PASSWORD: trustPassword };
  run('openssl', [
    'req', '-x509', '-newkey', 'rsa:3072', '-nodes', '-sha256', '-days', '7',
    '-subj', '/CN=R1-014 loopback',
    '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost',
    '-keyout', join(directory, 'test-key.pem'), '-out', join(directory, 'test-ca.pem'),
  ]);
  chmodSync(join(directory, 'test-key.pem'), 0o600);
  chmodSync(join(directory, 'test-ca.pem'), 0o600);
  run('openssl', [
    'pkcs12', '-export', '-in', join(directory, 'test-ca.pem'), '-inkey', join(directory, 'test-key.pem'),
    '-out', join(directory, 'iam-server.p12'), '-name', 'r1-014-test', '-passout', 'env:R1_KEYSTORE_PASSWORD',
  ], { env });
  chmodSync(join(directory, 'iam-server.p12'), 0o600);
  run('keytool', [
    '-importcert', '-noprompt', '-alias', 'r1-014-iam', '-file', join(directory, 'test-ca.pem'),
    '-keystore', join(directory, 'learner-trust.p12'), '-storetype', 'PKCS12',
    '-storepass:env', 'R1_TRUST_PASSWORD',
  ], { env });
  chmodSync(join(directory, 'learner-trust.p12'), 0o600);
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
    'server.ssl.key-alias=r1-014-test',
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
  const props = readFileSync(learnerConfig, 'utf8');
  if (!props.includes('learner.consent-recheck.enabled=true')) throw new Error('CONSENT_RECHECK_NOT_ON');
  if (props.includes('LEARNER_CONSENT_RECHECK_ENABLED=false')) throw new Error('CONSENT_RECHECK_DISABLED');
  console.log('CONSENT_RECHECK_EXPLICIT_TRUE');
  const learnerArgs = secretFile('learner-jvm.args', [
    '-Djavax.net.ssl.trustStore=' + join(directory, 'learner-trust.p12'),
    '-Djavax.net.ssl.trustStoreType=PKCS12',
    '-Djavax.net.ssl.trustStorePassword=' + trustPassword,
  ].join('\n') + '\n');
  const iamArgs = secretFile('iam-jvm.args', '-Dfile.encoding=UTF-8\n');
  const ca = readFileSync(join(directory, 'test-ca.pem'));

  iamChild = spawnJava('iam-service', iamArgs, iamConfig);
  await waitHealth(iamChild, 'https://127.0.0.1:18087/actuator/health', ca);
  console.log('IAM_HEALTH_OK');
  learnerChild = spawnJava('learner-service', learnerArgs, learnerConfig);
  await waitHealth(learnerChild, 'http://127.0.0.1:18088/actuator/health', ca);
  console.log('LEARNER_HEALTH_OK');

  const probe = spawn(process.execPath, [join(evidence, 'probe.mjs')], {
    cwd: evidence,
    env: {
      PATH: process.env.PATH,
      NODE_EXTRA_CA_CERTS: join(directory, 'test-ca.pem'),
      IAM_BASE: 'https://127.0.0.1:18087',
      LEARNER_BASE: 'http://127.0.0.1:18088',
      IAM_SCHEMA: iamSchema,
      LEARNER_SCHEMA: learnerSchema,
      OUT_DIR: evidence,
    },
    stdio: 'inherit',
  });
  const probeCode = await new Promise((resolve) => probe.on('exit', resolve));
  console.log('PROBE_EXIT ' + probeCode);
  if (probeCode !== 0) throw new Error('PROBE_FAILED ' + probeCode);
  console.log('RUN_DONE');
} catch (error) {
  console.log('RUN_FAILED ' + redact(error && error.stack ? error.stack : error));
  for (const name of ['iam-service.log', 'learner-service.log']) {
    try {
      console.log('--- ' + name + ' ---\n' + redact(run('tail', ['-n', '80', join(directory, name)])));
    } catch { /* log may not exist */ }
  }
  process.exitCode = 1;
} finally {
  await cleanup();
}
