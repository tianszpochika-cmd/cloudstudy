import {
  readFileSync, writeFileSync, mkdirSync, mkdtempSync, chmodSync,
  realpathSync, lstatSync, copyFileSync, openSync, closeSync, existsSync
} from 'node:fs';
import { randomBytes, randomUUID, createHash, createPublicKey } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Reused modules from scripts/redesign/r1-002/
import {
  root,
  sha256,
  assertExternalDirectory,
  checkPrivateMetadata,
  verifyPrivateMaterialPermissions,
  certificateFacts,
  javaArgument,
} from '../r1-002/prepare.mjs';
import {
  readProcessIdentity,
  compareProcessIdentity,
} from '../r1-002/process-identity.mjs';
import {
  registeredPorts,
  inspectFixedPorts,
} from '../r1-002/lifecycle.mjs';

// Local pure assertions and validation logic
import {
  assertIamLifecycleSchema,
  assertIamLifecycleUser,
  databaseGrantScope,
  parseArgs,
  validateRunApproval,
  validateCookie,
  parseCookieValue,
  evaluateR1003Assertions,
  evaluateR1004Assertions,
  evaluateR1005Assertions,
  redactSecrets,
  generateCleanupPlan,
} from './assertions.mjs';

const CONTAINER_NAME = 'yuxuexing-local-mysql-1';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function safeJson(text, code = 'JSON_PARSE_ERROR') {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(code);
  }
}

function checked(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 8 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`COMMAND_FAILED_${path.basename(command)}_${result.status ?? 'unknown'}`);
  }
  return result.stdout;
}

export function inspectMysql(container = CONTAINER_NAME) {
  if (container !== CONTAINER_NAME) {
    throw new Error('CONTAINER_ALLOWLIST_VIOLATION');
  }
  const value = safeJson(
    checked('docker', [
      'inspect',
      '--format',
      '{"Id":{{json .Id}},"Name":{{json .Name}},"Image":{{json .Config.Image}},"Labels":{{json .Config.Labels}},"Ports":{{json .NetworkSettings.Ports}},"Status":{{json .State.Status}},"Health":{{json .State.Health.Status}}}',
      container,
    ]),
    'MYSQL_METADATA_INVALID'
  );

  const facts = {
    id: value.Id,
    name: value.Name,
    image: value.Image,
    project: value.Labels?.['com.docker.compose.project'],
    service: value.Labels?.['com.docker.compose.service'],
    port: value.Ports?.['3306/tcp'],
    state: value.Status,
    health: value.Health,
  };

  if (
    facts.name !== '/' + container ||
    facts.project !== 'yuxuexing-local' ||
    facts.service !== 'mysql' ||
    facts.image !== 'mysql:8.0' ||
    facts.state !== 'running' ||
    facts.health !== 'healthy' ||
    JSON.stringify(facts.port) !== JSON.stringify([{ HostIp: '127.0.0.1', HostPort: '13306' }])
  ) {
    throw new Error('MYSQL_OWNER_OR_PORT_CHANGED');
  }
  return facts;
}

function sql(statement, expectedMysql) {
  if (JSON.stringify(inspectMysql()) !== JSON.stringify(expectedMysql)) {
    throw new Error('MYSQL_IDENTITY_CHANGED');
  }
  return checked(
    'docker',
    [
      'exec',
      '-i',
      CONTAINER_NAME,
      'sh',
      '-c',
      'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --protocol=socket --user=root --batch --skip-column-names',
    ],
    { input: statement }
  );
}

function counts(config) {
  const schema = assertIamLifecycleSchema(config.schema);
  const values = sql(
    `SELECT ` +
      `(SELECT COUNT(*) FROM ${schema}.iam_principal),` +
      `(SELECT COUNT(*) FROM ${schema}.iam_account),` +
      `(SELECT COUNT(*) FROM ${schema}.iam_session),` +
      `(SELECT COUNT(*) FROM ${schema}.iam_device),` +
      `(SELECT COUNT(*) FROM ${schema}.iam_decision_audit),` +
      `(SELECT COUNT(*) FROM ${schema}.iam_idempotency_record WHERE state='COMPLETED');`,
    config.mysql
  )
    .trim()
    .split('\t')
    .map(Number);

  return {
    principals: values[0],
    accounts: values[1],
    sessions: values[2],
    devices: values[3],
    audits: values[4],
    completedIdempotency: values[5],
  };
}

function getSessionStatus(sessionId, config) {
  const schema = assertIamLifecycleSchema(config.schema);
  const cleanId = String(sessionId).replaceAll(/[^a-f0-9-]/gi, '');
  return sql(
    `SELECT status FROM ${schema}.iam_session WHERE session_id='${cleanId}';`,
    config.mysql
  ).trim();
}

function protectedDirectory(directory) {
  const resolved = realpathSync(directory);
  const metadata = lstatSync(resolved);
  if (
    resolved === root ||
    resolved.startsWith(root + path.sep) ||
    metadata.uid !== process.getuid() ||
    metadata.mode % 0o1000 !== 0o700 ||
    lstatSync(directory).isSymbolicLink()
  ) {
    throw new Error('PRIVATE_DIRECTORY_SCOPE');
  }
  return resolved;
}

function secretFile(directory, name, content) {
  writeFileSync(path.join(directory, name), content, { mode: 0o600, flag: 'wx' });
}

export function http(url, { method = 'GET', body, token, cookie, idempotencyKey, authTransport, ca } = {}) {
  return new Promise((resolve, reject) => {
    const secure = url.startsWith('https:');
    const payload = body !== undefined && body !== null ? JSON.stringify(body) : undefined;
    const headers = {};
    if (payload !== undefined) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (authTransport) {
      headers['X-Auth-Transport'] = authTransport;
    }
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    if (cookie) {
      headers['Cookie'] = cookie;
    }

    const req = (secure ? httpsRequest : httpRequest)(
      url,
      {
        method,
        ca,
        rejectUnauthorized: true,
        timeout: 10000,
        headers,
      },
      response => {
        let bytes = '';
        response.on('data', part => {
          bytes += part;
          if (bytes.length > 512 * 1024) req.destroy(new Error('RESPONSE_BOUND'));
        });
        response.on('end', () => {
          try {
            resolve({
              status: response.statusCode,
              headers: response.headers,
              body: bytes ? JSON.parse(bytes) : null,
            });
          } catch {
            resolve({
              status: response.statusCode,
              headers: response.headers,
              body: null,
              rawText: bytes,
            });
          }
        });
      }
    );

    req.on('timeout', () => req.destroy(new Error('REQUEST_TIMEOUT')));
    req.on('error', err => reject(new Error('HTTP_TRANSPORT_FAILED:' + err.message)));
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (
    child.r1Identity &&
    (!compareProcessIdentity(child.r1Identity, readProcessIdentity(child.pid)).matches ||
      child.r1Identity.ppid !== process.pid)
  ) {
    throw new Error('OWNED_CHILD_IDENTITY_CHANGED');
  }
  if (child._handle !== child.r1Handle || !child._handle || child._handle.pid !== child.pid) {
    throw new Error('OWNED_NATIVE_HANDLE_CHANGED');
  }
  child.kill('SIGTERM');
  for (let i = 0; i < 300 && child.exitCode === null && child.signalCode === null; i++) {
    await delay(100);
  }
  if (child.exitCode === null && child.signalCode === null) {
    throw new Error('OWNED_CHILD_STOP_TIMEOUT');
  }
}

async function startIam(directory) {
  const jarPath = path.join(directory, 'iam-service.jar');
  const log = openSync(path.join(directory, 'iam-' + randomBytes(4).toString('hex') + '.log'), 'wx', 0o600);
  const child = spawn(
    'java',
    [
      '-jar',
      jarPath,
      '--spring.profiles.active=local',
      '--spring.config.import=' + pathToFileURL(path.join(directory, 'iam-runtime.properties')).href,
      '--management.otlp.metrics.export.enabled=false',
      '--management.opentelemetry.enabled=false',
    ],
    {
      cwd: directory,
      env: {
        PATH: process.env.PATH,
        JAVA_HOME: process.env.JAVA_HOME,
        LANG: 'en_US.UTF-8',
      },
      stdio: ['ignore', log, log],
    }
  );
  closeSync(log);
  child.r1Handle = child._handle;
  if (!child.pid) throw new Error('CHILD_START_FAILED');
  child.on('error', () => {
    child.r1StartFailed = true;
  });
  await delay(100);
  if (child.r1StartFailed || child.exitCode !== null || child.signalCode !== null) {
    throw new Error('OWNED_CHILD_EARLY_EXIT');
  }
  child.r1Identity = readProcessIdentity(child.pid);
  if (child.r1Identity.ppid !== process.pid || child.r1Identity.cwd !== directory) {
    throw new Error('OWNED_CHILD_IDENTITY');
  }
  return child;
}

async function waitForHealthy(child, url, ca) {
  for (let i = 0; i < 300; i++) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error('OWNED_CHILD_EARLY_EXIT');
    }
    try {
      const res = await http(url, { ca });
      if (res.status === 200) return;
    } catch {}
    await delay(200);
  }
  throw new Error('HEALTH_TIMEOUT');
}

export function inspectMode() {
  const ports = registeredPorts(root);
  const fixedPortChecks = inspectFixedPorts(ports);
  const iamPortFree = !fixedPortChecks.find(p => p.port === 18087)?.pids?.length;

  const scriptPath = fileURLToPath(import.meta.url);
  const scriptSha256 = sha256(readFileSync(scriptPath));

  return {
    kind: 'R1_IAM_LIFECYCLE_INSPECT_REPORT',
    mode: 'inspect',
    readOnlyAudit: true,
    processesStarted: 0,
    databaseWrites: 0,
    dockerCommandsExecuted: 0,
    networkRequestsSent: 0,
    fixedPorts: {
      iamPort: 18087,
      state: iamPortFree ? 'FREE' : 'OCCUPIED',
      details: fixedPortChecks,
    },
    targetContainerAllowlist: CONTAINER_NAME,
    scriptProvenance: {
      path: path.relative(root, scriptPath),
      sha256: scriptSha256,
    },
    timestamp: new Date().toISOString(),
  };
}

export function prepareMode({ privateParent, outPath } = {}) {
  if (!privateParent) throw new Error('PRIVATE_PARENT_REQUIRED');
  const parent = assertExternalDirectory(privateParent);

  const timestamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = randomBytes(6).toString('hex');
  const directory = mkdtempSync(path.join(parent, `r1-iam-lifecycle-${timestamp}-`));
  chmodSync(directory, 0o700);

  const password = randomBytes(32).toString('base64url');
  const privateKey = path.join(directory, 'test-key.pem');
  const pem = path.join(directory, 'test-ca.pem');
  const env = { ...process.env, R1_KEYSTORE_PASSWORD: password };

  checked('openssl', [
    'req', '-x509', '-newkey', 'rsa:3072', '-nodes', '-sha256', '-days', '7',
    '-subj', '/CN=R1-IAM-Lifecycle loopback preparation',
    '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost',
    '-keyout', privateKey, '-out', pem,
  ]);
  chmodSync(privateKey, 0o600);
  chmodSync(pem, 0o600);

  checked('openssl', [
    'pkcs12', '-export', '-in', pem, '-inkey', privateKey, '-out', path.join(directory, 'iam-server.p12'),
    '-name', 'r1-iam-lifecycle-test', '-passout', 'env:R1_KEYSTORE_PASSWORD',
  ], { env });
  chmodSync(path.join(directory, 'iam-server.p12'), 0o600);

  const schema = assertIamLifecycleSchema(`r1_iam_lifecycle_${timestamp}_${suffix}`);
  const user = assertIamLifecycleUser(`r1_iam_${suffix}`);
  const dbPassword = randomBytes(32).toString('base64url');

  const mysql = inspectMysql();
  const partialValue = sql('SELECT @@GLOBAL.partial_revokes;', mysql).trim();
  if (!['0', '1'].includes(partialValue)) throw new Error('MYSQL_GRANT_MODE_UNKNOWN');
  const partialRevokes = partialValue === '1';

  const existing = sql(
    `SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='${schema}'; ` +
    `SELECT COUNT(*) FROM mysql.user WHERE user='${user}';`,
    mysql
  ).trim();
  if (existing !== '0\n0') throw new Error('RESOURCE_EXISTS');

  sql(
    `CREATE DATABASE ${schema} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; ` +
    `CREATE USER '${user}'@'%' IDENTIFIED BY '${dbPassword}'; ` +
    `GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,DROP,INDEX,REFERENCES ON ${databaseGrantScope(schema, partialRevokes)} TO '${user}'@'%';`,
    mysql
  );

  checked('openssl', [
    'genpkey', '-algorithm', 'RSA', '-pkeyopt', 'rsa_keygen_bits:3072',
    '-out', path.join(directory, 'iam-signer.pem'),
  ]);
  chmodSync(path.join(directory, 'iam-signer.pem'), 0o600);

  const iamRuntimeConfig = [
    'server.address=127.0.0.1',
    'server.port=18087',
    'server.ssl.enabled=true',
    'server.ssl.key-store-type=PKCS12',
    'server.ssl.key-alias=r1-iam-lifecycle-test',
    `server.ssl.key-store=${pathToFileURL(path.join(directory, 'iam-server.p12')).href}`,
    `server.ssl.key-store-password=${password}`,
    'iam.jwt.refresh-cookie-secure=true',
    'iam.persistence.enabled=true',
    'spring.flyway.enabled=true',
    `iam.persistence.jdbc-url=jdbc:mysql://127.0.0.1:13306/${schema}?serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true`,
    `iam.persistence.schema=${schema}`,
    `iam.persistence.username=${user}`,
    `iam.persistence.password=${dbPassword}`,
    'iam.idempotency.v13-writers-drained=true',
    `iam.idempotency.replay-secret=${randomBytes(32).toString('base64url')}`,
    `iam.idempotency.fingerprint-secret=${randomBytes(32).toString('base64url')}`,
    `iam.jwt.private-key-file=${path.join(directory, 'iam-signer.pem')}`,
    'iam.jwt.ephemeral-keys-allowed=false',
    'iam.consent.policy-source=local-candidate',
    'iam.local-adult-gate-enabled=false',
    'management.otlp.metrics.export.enabled=false',
    'management.opentelemetry.enabled=false',
  ].join('\n') + '\n';

  secretFile(directory, 'iam-runtime.properties', iamRuntimeConfig);

  const certFacts = certificateFacts(readFileSync(pem));
  const runtimeConfig = {
    kind: 'R1_IAM_LIFECYCLE_OWNED_RUNTIME',
    directory,
    schema,
    user,
    mysql,
    materialCertificateSha256: certFacts.sha256,
    preparedAt: new Date().toISOString(),
  };
  secretFile(directory, 'runtime.json', JSON.stringify(runtimeConfig, null, 2) + '\n');

  const privateFiles = [
    'test-key.pem',
    'test-ca.pem',
    'iam-server.p12',
    'iam-signer.pem',
    'iam-runtime.properties',
    'runtime.json',
  ];
  const permissions = verifyPrivateMaterialPermissions(directory, privateFiles);

  const evidence = {
    kind: runtimeConfig.kind,
    schema,
    user,
    mysql,
    privateDirectory: '<PRIVATE_MATERIAL_DIR>',
    permissions,
    certificate: certFacts,
    databaseCreated: true,
    servicesStarted: false,
    preparedAt: runtimeConfig.preparedAt,
  };

  const evidenceTarget = outPath || path.join(root, `evidence/redesign/2026-10-09/R1-IAM-LIFECYCLE/prepared-${suffix}.json`);
  const evidenceDir = path.dirname(evidenceTarget);
  if (!existsSync(evidenceDir)) mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(evidenceTarget, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });

  return {
    privateDirectory: directory,
    schema,
    user,
    evidenceFile: evidenceTarget,
    prepared: true,
  };
}

export function cleanupPlanMode({ configDir } = {}) {
  if (!configDir) throw new Error('CONFIG_DIR_REQUIRED');
  const directory = protectedDirectory(configDir);
  const config = safeJson(readFileSync(path.join(directory, 'runtime.json'), 'utf8'), 'RUNTIME_CONFIG_INVALID');
  return generateCleanupPlan(config.schema, config.user);
}

export async function runMode({ configDir, approvalPath, outPath } = {}) {
  if (!configDir) throw new Error('CONFIG_DIR_REQUIRED');
  const directory = protectedDirectory(configDir);
  const config = safeJson(readFileSync(path.join(directory, 'runtime.json'), 'utf8'), 'RUNTIME_CONFIG_INVALID');
  assertIamLifecycleSchema(config.schema);
  assertIamLifecycleUser(config.user);

  if (config.directory !== directory) throw new Error('RUNTIME_DIRECTORY_BINDING');

  const scriptSha256 = sha256(readFileSync(fileURLToPath(import.meta.url)));
  const approvalTarget = approvalPath || path.join(directory, 'run-approval.json');
  const approval = safeJson(readFileSync(approvalTarget, 'utf8'), 'RUN_APPROVAL_JSON_INVALID');

  validateRunApproval(approval, {
    scriptSha256,
    schema: config.schema,
    mysqlId: config.mysql.id,
  });

  const ports = registeredPorts(root);
  const fixedPortChecks = inspectFixedPorts(ports);
  const iamPortEntry = fixedPortChecks.find(p => p.port === 18087);
  if (!iamPortEntry || iamPortEntry.state !== 'FREE' || iamPortEntry.pids.length > 0) {
    throw new Error('FIXED_PORT_OCCUPIED');
  }

  const iamJarSource = path.join(root, 'services/iam-service/target/iam-service-0.1.0-SNAPSHOT.jar');
  if (!existsSync(iamJarSource)) throw new Error('IAM_JAR_NOT_FOUND');
  copyFileSync(iamJarSource, path.join(directory, 'iam-service.jar'));
  chmodSync(path.join(directory, 'iam-service.jar'), 0o400);

  const ca = readFileSync(path.join(directory, 'test-ca.pem'));

  const report = {
    kind: 'R1_IAM_LIFECYCLE_EXECUTION_RESULTS',
    status: 'RUNNING',
    executedAt: new Date().toISOString(),
    schema: config.schema,
    user: config.user,
    results: {
      r1003: null,
      r1004: null,
      r1005: null,
    },
    checks: {},
  };

  let iamChild = null;

  try {
    iamChild = await startIam(directory);
    await waitForHealthy(iamChild, 'https://127.0.0.1:18087/actuator/health', ca);

    const flyway = sql(
      `SELECT COUNT(*),SUM(success=0),MAX(CAST(version AS UNSIGNED)) FROM ${config.schema}.flyway_schema_history WHERE version IS NOT NULL;`,
      config.mysql
    ).trim().split('\t').map(Number);
    if (flyway[0] < 17 || flyway[1] !== 0) throw new Error('FLYWAY_BASELINE_FAILED');
    report.checks.flyway = { successfulVersions: flyway[0], failed: flyway[1], maxVersion: flyway[2] };

    const initialCounts = counts(config);
    if (Object.values(initialCounts).some(v => v !== 0)) throw new Error('NOT_CLEAN_BASELINE');
    report.checks.initialCleanCounts = initialCounts;

    // ==========================================
    // SCENARIO 1: R1-003 注册幂等回放
    // ==========================================
    const r1003Device = {
      deviceId: randomUUID(),
      deviceType: 'WEB',
      deviceName: 'R1-003 Synthetic Device',
      osVersion: 'test',
      clientVersion: 'r1-003',
    };
    const r1003Body1 = {
      identifier: 'r1003-' + randomBytes(8).toString('hex') + '@example.invalid',
      password: randomBytes(24).toString('base64url'),
      device: r1003Device,
    };
    const r1003Key = 'idemp-r1003-' + randomBytes(16).toString('hex');

    // 1.1 首次注册
    const r1003First = await http('https://127.0.0.1:18087/api/v1/auth/register', {
      method: 'POST',
      body: r1003Body1,
      idempotencyKey: r1003Key,
      authTransport: 'WEB_COOKIE',
      ca,
    });
    const countsAfterFirst = counts(config);

    // 1.2 同键同体重放
    const r1003Replay = await http('https://127.0.0.1:18087/api/v1/auth/register', {
      method: 'POST',
      body: r1003Body1,
      idempotencyKey: r1003Key,
      authTransport: 'WEB_COOKIE',
      ca,
    });
    const countsAfterReplay = counts(config);

    // 1.3 同键不同体拒绝
    const r1003ConflictBody = {
      identifier: 'r1003-conflict-' + randomBytes(8).toString('hex') + '@example.invalid',
      password: randomBytes(24).toString('base64url'),
      device: r1003Device,
    };
    const r1003Conflict = await http('https://127.0.0.1:18087/api/v1/auth/register', {
      method: 'POST',
      body: r1003ConflictBody,
      idempotencyKey: r1003Key,
      authTransport: 'WEB_COOKIE',
      ca,
    });
    const countsAfterConflict = counts(config);

    // 1.4 缺幂等键拒绝
    const r1003MissingKeyBody = {
      identifier: 'r1003-nokey-' + randomBytes(8).toString('hex') + '@example.invalid',
      password: randomBytes(24).toString('base64url'),
      device: r1003Device,
    };
    const r1003MissingKey = await http('https://127.0.0.1:18087/api/v1/auth/register', {
      method: 'POST',
      body: r1003MissingKeyBody,
      authTransport: 'WEB_COOKIE',
      ca,
    });

    report.results.r1003 = evaluateR1003Assertions({
      firstRegistration: r1003First,
      replayRegistration: r1003Replay,
      conflictRegistration: r1003Conflict,
      missingKeyRegistration: r1003MissingKey,
      dbCountsBefore: initialCounts,
      dbCountsAfterFirst: countsAfterFirst,
      dbCountsAfterReplay: countsAfterReplay,
      dbCountsAfterConflict: countsAfterConflict,
    });

    // ==========================================
    // SCENARIO 2: R1-004 登录/刷新/撤销全套
    // ==========================================
    const r1004Identifier = 'r1004-' + randomBytes(8).toString('hex') + '@example.invalid';
    const r1004Password = randomBytes(24).toString('base64url');
    const r1004Device = {
      deviceId: randomUUID(),
      deviceType: 'WEB',
      deviceName: 'R1-004 Synthetic Device',
      osVersion: 'test',
      clientVersion: 'r1-004',
    };

    // 2.1 新账号注册
    const r1004Reg = await http('https://127.0.0.1:18087/api/v1/auth/register', {
      method: 'POST',
      body: { identifier: r1004Identifier, password: r1004Password, device: r1004Device },
      idempotencyKey: 'idemp-r1004-reg-' + randomBytes(16).toString('hex'),
      authTransport: 'WEB_COOKIE',
      ca,
    });

    // 2.2 登录
    const r1004Login = await http('https://127.0.0.1:18087/api/v1/auth/login', {
      method: 'POST',
      body: { identifier: r1004Identifier, password: r1004Password, device: r1004Device },
      idempotencyKey: 'idemp-r1004-login-' + randomBytes(16).toString('hex'),
      authTransport: 'WEB_COOKIE',
      ca,
    });
    const rawRefresh1 = parseCookieValue(r1004Login.headers['set-cookie']?.[0]);
    const cookieHeader1 = `yuxuexing_refresh=${rawRefresh1}`;

    // 2.3 刷新轮换
    const r1004Refresh = await http('https://127.0.0.1:18087/api/v1/auth/token/refresh', {
      method: 'POST',
      body: {},
      cookie: cookieHeader1,
      idempotencyKey: 'idemp-r1004-ref-' + randomBytes(16).toString('hex'),
      authTransport: 'WEB_COOKIE',
      ca,
    });
    const rawRefresh2 = parseCookieValue(r1004Refresh.headers['set-cookie']?.[0]);
    const cookieHeader2 = `yuxuexing_refresh=${rawRefresh2}`;
    const cookieSecurity = validateCookie(r1004Refresh.headers['set-cookie']?.[0], r1004Refresh.body);

    // 2.4 旧 refresh token 重放应被拒且令牌族被撤销
    const r1004ReplayOldRefresh = await http('https://127.0.0.1:18087/api/v1/auth/token/refresh', {
      method: 'POST',
      body: {},
      cookie: cookieHeader1,
      idempotencyKey: 'idemp-r1004-replay-' + randomBytes(16).toString('hex'),
      authTransport: 'WEB_COOKIE',
      ca,
    });
    const statusAfterReplay = getSessionStatus(r1004Login.body?.data?.sessionId, config);

    // 2.5 重新 login
    const r1004Relogin = await http('https://127.0.0.1:18087/api/v1/auth/login', {
      method: 'POST',
      body: { identifier: r1004Identifier, password: r1004Password, device: r1004Device },
      idempotencyKey: 'idemp-r1004-relogin-' + randomBytes(16).toString('hex'),
      authTransport: 'WEB_COOKIE',
      ca,
    });
    const reloginToken = r1004Relogin.body?.data?.accessToken;
    const reloginSessionId = r1004Relogin.body?.data?.sessionId;
    const reloginRawRefresh = parseCookieValue(r1004Relogin.headers['set-cookie']?.[0]);
    const reloginCookie = `yuxuexing_refresh=${reloginRawRefresh}`;

    // 2.6 Logout
    const r1004Logout = await http('https://127.0.0.1:18087/api/v1/auth/logout', {
      method: 'POST',
      body: {},
      token: reloginToken,
      idempotencyKey: 'idemp-r1004-logout-' + randomBytes(16).toString('hex'),
      authTransport: 'WEB_COOKIE',
      ca,
    });
    const statusAfterLogout = getSessionStatus(reloginSessionId, config);

    // 2.7 撤销后失效 access / refresh 再用被拒
    const postLogoutAccess = await http('https://127.0.0.1:18087/api/v1/iam/principal/me', {
      method: 'GET',
      token: reloginToken,
      ca,
    });
    const postLogoutRefresh = await http('https://127.0.0.1:18087/api/v1/auth/token/refresh', {
      method: 'POST',
      body: {},
      cookie: reloginCookie,
      idempotencyKey: 'idemp-r1004-postlogref-' + randomBytes(16).toString('hex'),
      authTransport: 'WEB_COOKIE',
      ca,
    });

    report.results.r1004 = evaluateR1004Assertions({
      registration: r1004Reg,
      login: { ...r1004Login, rawRefreshToken: rawRefresh1 },
      refresh: { ...r1004Refresh, rawRefreshToken: rawRefresh2, cookieSecurity },
      refreshReplay: r1004ReplayOldRefresh,
      relogin: r1004Relogin,
      logout: r1004Logout,
      postLogoutAccess,
      postLogoutRefresh,
      sessionStatusAfterReplay: statusAfterReplay,
      sessionStatusAfterLogout: statusAfterLogout,
    });

    // ==========================================
    // SCENARIO 3: R1-005 多设备列表+踢出
    // ==========================================
    const r1005Identifier = 'r1005-' + randomBytes(8).toString('hex') + '@example.invalid';
    const r1005Password = randomBytes(24).toString('base64url');
    const deviceIdA = randomUUID();
    const deviceIdB = randomUUID();
    const deviceA = {
      deviceId: deviceIdA,
      deviceType: 'WEB',
      deviceName: 'Synthetic Device A',
      osVersion: 'test-mac',
      clientVersion: 'r1-005',
    };
    const deviceB = {
      deviceId: deviceIdB,
      deviceType: 'WEB',
      deviceName: 'Synthetic Device B',
      osVersion: 'test-mobile',
      clientVersion: 'r1-005',
    };

    // 3.1 注册账号 3 并用设备 A 登录
    await http('https://127.0.0.1:18087/api/v1/auth/register', {
      method: 'POST',
      body: { identifier: r1005Identifier, password: r1005Password, device: deviceA },
      idempotencyKey: 'idemp-r1005-reg-' + randomBytes(16).toString('hex'),
      authTransport: 'WEB_COOKIE',
      ca,
    });

    const loginA = await http('https://127.0.0.1:18087/api/v1/auth/login', {
      method: 'POST',
      body: { identifier: r1005Identifier, password: r1005Password, device: deviceA },
      idempotencyKey: 'idemp-r1005-loginA-' + randomBytes(16).toString('hex'),
      authTransport: 'WEB_COOKIE',
      ca,
    });
    const tokenA = loginA.body?.data?.accessToken;
    const sessionIdA = loginA.body?.data?.sessionId;

    // 3.2 同账号用设备 B 登录
    const loginB = await http('https://127.0.0.1:18087/api/v1/auth/login', {
      method: 'POST',
      body: { identifier: r1005Identifier, password: r1005Password, device: deviceB },
      idempotencyKey: 'idemp-r1005-loginB-' + randomBytes(16).toString('hex'),
      authTransport: 'WEB_COOKIE',
      ca,
    });
    const tokenB = loginB.body?.data?.accessToken;
    const sessionIdB = loginB.body?.data?.sessionId;
    const rawRefreshB = parseCookieValue(loginB.headers['set-cookie']?.[0]);
    const cookieB = `yuxuexing_refresh=${rawRefreshB}`;

    // 3.3 设备 A 读设备列表：恰一个 isCurrent=true 且为 A
    const devicesFromA = await http('https://127.0.0.1:18087/api/v1/iam/devices', {
      method: 'GET',
      token: tokenA,
      ca,
    });

    // 3.4 设备 B 读设备列表：恰一个 isCurrent=true 且为 B
    const devicesFromB = await http('https://127.0.0.1:18087/api/v1/iam/devices', {
      method: 'GET',
      token: tokenB,
      ca,
    });

    // 3.5 设备 A 踢出 设备 B
    const kickoutResult = await http(`https://127.0.0.1:18087/api/v1/iam/devices/${deviceIdB}/kickout`, {
      method: 'POST',
      token: tokenA,
      idempotencyKey: 'idemp-r1005-kick-' + randomBytes(16).toString('hex'),
      ca,
    });

    // 3.6 被踢设备 B 的旧 access 与 refresh 再用返回 401
    const accessBAfterKickout = await http('https://127.0.0.1:18087/api/v1/iam/devices', {
      method: 'GET',
      token: tokenB,
      ca,
    });
    const refreshBAfterKickout = await http('https://127.0.0.1:18087/api/v1/auth/token/refresh', {
      method: 'POST',
      body: {},
      cookie: cookieB,
      idempotencyKey: 'idemp-r1005-refBkick-' + randomBytes(16).toString('hex'),
      authTransport: 'WEB_COOKIE',
      ca,
    });

    // 3.7 设备 A 仍可用
    const accessAAfterKickout = await http('https://127.0.0.1:18087/api/v1/iam/principal/me', {
      method: 'GET',
      token: tokenA,
      ca,
    });

    // 3.8 SQL 读回 B 的 session 为 REVOKED，A 仍 ACTIVE
    const sessionStatusB = getSessionStatus(sessionIdB, config);
    const sessionStatusA = getSessionStatus(sessionIdA, config);

    report.results.r1005 = evaluateR1005Assertions({
      loginA: { ...loginA, deviceId: deviceIdA },
      loginB: { ...loginB, deviceId: deviceIdB },
      devicesFromA,
      devicesFromB,
      kickoutResult,
      accessBAfterKickout,
      refreshBAfterKickout,
      accessAAfterKickout,
      sessionStatusA,
      sessionStatusB,
    });

    const allPassed =
      report.results.r1003?.passed &&
      report.results.r1004?.passed &&
      report.results.r1005?.passed;

    report.status = allPassed ? 'PASS' : 'FAILED';
  } catch (error) {
    report.status = 'FAILED';
    report.failure = /^[A-Z0-9_]{1,100}$/.test(error.message) ? error.message : 'RUNTIME_ERROR';
    report.errorDetails = error.message;
    throw error;
  } finally {
    const cleanupErrors = [];
    if (iamChild) {
      try {
        await stopChild(iamChild);
      } catch (err) {
        cleanupErrors.push('IAM_STOP_FAILED:' + err.message);
      }
    }
    const fixedPortChecks = inspectFixedPorts(ports);
    const iamPortReleased = !fixedPortChecks.find(p => p.port === 18087)?.pids?.length;
    if (!iamPortReleased) cleanupErrors.push('PORT_18087_NOT_RELEASED');

    report.cleanup = {
      iamStopped: iamChild ? (iamChild.exitCode !== null || iamChild.signalCode !== null) : true,
      port18087Released: iamPortReleased,
      cleanupErrors,
    };

    const sanitizedReport = redactSecrets(report, [directory]);
    const outTarget = outPath || path.join(directory, 'iam-lifecycle-results.json');
    writeFileSync(outTarget, JSON.stringify(sanitizedReport, null, 2) + '\n', { flag: 'w' });
  }

  return redactSecrets(report, [directory]);
}

// CLI entry point
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    let output;
    if (options.mode === 'inspect') {
      output = inspectMode();
    } else if (options.mode === 'prepare') {
      output = prepareMode({
        privateParent: options.privateParent,
        outPath: options.outPath,
      });
    } else if (options.mode === 'cleanup-plan') {
      output = cleanupPlanMode({
        configDir: options.configDir,
      });
    } else if (options.mode === 'run') {
      output = await runMode({
        configDir: options.configDir,
        approvalPath: options.approvalPath,
        outPath: options.outPath,
      });
    }
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  } catch (error) {
    const code = /^[A-Z0-9_]{1,100}$/.test(error.message) ? error.message : 'COMMAND_FAILED';
    process.stderr.write(`R1-IAM-Lifecycle error [${code}]: ${error.message}\n`);
    process.exitCode = 1;
  }
}
