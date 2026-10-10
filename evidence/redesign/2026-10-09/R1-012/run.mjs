import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = '/Users/Admin/Desktop/work/cloudstudy';
const evidence = join(root, 'evidence/redesign/2026-10-09/R1-012');
const container = 'yuxuexing-local-mysql-1';
const day = '20261009';
const suffix = randomBytes(6).toString('hex');
const iamSchema = `r1_012_iam_${day}_${suffix}`;
const dbUser = `r1_012_${suffix}`;
const directory = join(tmpdir(), `r1-012-runtime-${suffix}`);

let iamChild = null;
let created = false;
let cleaned = false;

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

function assertPortFree() {
  const text = listeners(18087).trim();
  if (text) throw new Error('FIXED_PORT_OCCUPIED 18087');
  console.log('PORT_18087_FREE');
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
    const req = https.get(url, { ca, rejectUnauthorized: true, timeout: 2000 }, (res) => {
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
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('HEALTH_TIMEOUT ' + url);
}

function spawnJava(argsFile, configFile) {
  const log = openSync(join(directory, 'iam-service.log'), 'a', 0o600);
  const jar = join(root, 'services/iam-service/target/iam-service-0.1.0-SNAPSHOT.jar');
  const env = { PATH: process.env.PATH, LANG: 'en_US.UTF-8' };
  if (process.env.JAVA_HOME) env.JAVA_HOME = process.env.JAVA_HOME;
  const child = spawn('java', [
    '@' + argsFile,
    '-jar', jar,
    '--spring.profiles.active=local',
    '--spring.config.import=' + pathToFileURL(configFile).href,
    '--management.otlp.metrics.export.enabled=false',
    '--management.opentelemetry.enabled=false',
  ], { cwd: directory, env, stdio: ['ignore', log, log] });
  closeSync(log);
  if (!child.pid) throw new Error('CHILD_START_FAILED iam-service');
  return child;
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  for (let i = 0; i < 50 && child.exitCode === null; i++) {
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (child.exitCode === null) child.kill('SIGKILL');
}

async function cleanup() {
  if (cleaned) return;
  cleaned = true;
  await stop(iamChild);
  if (created) {
    sql(`DROP DATABASE IF EXISTS ${iamSchema}; DROP USER IF EXISTS '${dbUser}'@'%';`);
    const leftSchemas = sql(`SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name LIKE 'r1_012%';`);
    const leftUsers = sql(`SELECT COUNT(*) FROM mysql.user WHERE user LIKE 'r1_012%';`);
    console.log('CLEANUP_LEFT schemas=' + leftSchemas + ' users=' + leftUsers);
  }
  const busy = listeners(18087).trim();
  console.log(busy ? 'PORT_18087_STILL_BUSY' : 'PORT_18087_FREE_AFTER');
}

process.on('SIGINT', () => { cleanup().finally(() => process.exit(1)); });
process.on('SIGTERM', () => { cleanup().finally(() => process.exit(1)); });

try {
  assertMysql();
  assertPortFree();
  mkdirSync(directory, { mode: 0o700 });
  chmodSync(directory, 0o700);
  const partial = sql('SELECT @@GLOBAL.partial_revokes;');
  if (!['0', '1'].includes(partial)) throw new Error('MYSQL_GRANT_MODE_UNKNOWN');
  const partialRevokes = partial === '1';
  console.log('PARTIAL_REVOKES=' + partial);
  const existing = sql(`SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='${iamSchema}';`);
  const existingUser = sql(`SELECT COUNT(*) FROM mysql.user WHERE user='${dbUser}';`);
  if (existing !== '0' || existingUser !== '0') throw new Error('RESOURCE_EXISTS');
  const dbPassword = randomBytes(24).toString('hex');
  created = true;
  sql(
    `CREATE DATABASE ${iamSchema} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; ` +
    `CREATE USER '${dbUser}'@'%' IDENTIFIED BY '${dbPassword}'; ` +
    `GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,DROP,INDEX,REFERENCES ON ${grantScope(iamSchema, partialRevokes)} TO '${dbUser}'@'%';`
  );
  console.log('SCHEMA_CREATED ' + iamSchema + ' ' + dbUser);

  const keyPassword = randomBytes(18).toString('hex');
  const env = { ...process.env, R1_KEYSTORE_PASSWORD: keyPassword };
  run('openssl', [
    'req', '-x509', '-newkey', 'rsa:3072', '-nodes', '-sha256', '-days', '7',
    '-subj', '/CN=R1-012 loopback',
    '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost',
    '-keyout', join(directory, 'test-key.pem'), '-out', join(directory, 'test-ca.pem'),
  ]);
  chmodSync(join(directory, 'test-key.pem'), 0o600);
  chmodSync(join(directory, 'test-ca.pem'), 0o600);
  run('openssl', [
    'pkcs12', '-export', '-in', join(directory, 'test-ca.pem'), '-inkey', join(directory, 'test-key.pem'),
    '-out', join(directory, 'iam-server.p12'), '-name', 'r1-012-test', '-passout', 'env:R1_KEYSTORE_PASSWORD',
  ], { env });
  chmodSync(join(directory, 'iam-server.p12'), 0o600);
  run('openssl', [
    'genpkey', '-algorithm', 'RSA', '-pkeyopt', 'rsa_keygen_bits:3072',
    '-out', join(directory, 'iam-signer.pem'),
  ]);
  chmodSync(join(directory, 'iam-signer.pem'), 0o600);

  const jdbc = 'jdbc:mysql://127.0.0.1:13306/' + iamSchema
    + '?serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true&characterEncoding=utf8';
  const iamConfig = secretFile('iam-runtime.properties', [
    'server.address=127.0.0.1',
    'server.port=18087',
    'server.ssl.enabled=true',
    'server.ssl.key-store-type=PKCS12',
    'server.ssl.key-alias=r1-012-test',
    'server.ssl.key-store=' + join(directory, 'iam-server.p12'),
    'server.ssl.key-store-password=' + keyPassword,
    'iam.persistence.enabled=true',
    'spring.flyway.enabled=true',
    'iam.persistence.jdbc-url=' + jdbc,
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
  const iamArgs = secretFile('iam-jvm.args', '-Dfile.encoding=UTF-8\n');
  const ca = join(directory, 'test-ca.pem');

  iamChild = spawnJava(iamArgs, iamConfig);
  await waitHealth(iamChild, 'https://127.0.0.1:18087/actuator/health', readFileSync(ca));
  console.log('IAM_HEALTH_OK');
  const iamFlyway = sql(`SELECT COUNT(*), SUM(success=0) FROM ${iamSchema}.flyway_schema_history WHERE version IS NOT NULL;`);
  console.log('FLYWAY iam=' + iamFlyway.replaceAll('\t', ','));

  const probe = spawn(process.execPath, [join(evidence, 'probe.mjs')], {
    cwd: evidence,
    env: {
      PATH: process.env.PATH,
      NODE_EXTRA_CA_CERTS: ca,
      IAM_BASE: 'https://127.0.0.1:18087',
      IAM_SCHEMA: iamSchema,
      OUT_DIR: evidence,
    },
    stdio: 'inherit',
  });
  const probeCode = await new Promise(resolve => probe.on('exit', resolve));
  console.log('PROBE_EXIT ' + probeCode);
  if (probeCode !== 0 && probeCode !== 2) throw new Error('PROBE_FAILED ' + probeCode);
  if (probeCode === 2) process.exitCode = 2;
  console.log('RUN_DONE');
} catch (error) {
  console.log('RUN_FAILED ' + redact(error && error.stack ? error.stack : error));
  try {
    console.log('--- iam-service.log ---\n' + redact(run('tail', ['-n', '80', join(directory, 'iam-service.log')])));
  } catch { /* log may not exist */ }
  process.exitCode = 1;
} finally {
  await cleanup();
}
