import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { chmodSync, closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = '/Users/Admin/Desktop/work/cloudstudy';
const evidence = join(root, 'evidence/redesign/2026-10-10/station-acceptance/it1');
const container = 'yuxuexing-local-mysql-1';
const day = '20261010';
const suffix = randomBytes(4).toString('hex');
const iamSchema = `r1_it1_browser_${day}_iam_${suffix}`;
const learnerSchema = `r1_it1_browser_${day}_lrn_${suffix}`;
const assessmentSchema = `r1_it1_browser_${day}_asm_${suffix}`;
const dbUser = `it1_iam_${suffix}`;
const learnerUser = `it1_lrn_${suffix}`;
const assessmentUser = `it1_asm_${suffix}`;
const contentSchema = `r1_it1_browser_${day}_cnt_${suffix}`;
const contentUser = `it1_cnt_${suffix}`;
const directory = join(tmpdir(), `r1-it1-browser-${suffix}`);
const CANONICAL_GOALS = ['FOUNDATION', 'COLLEGE_CET', 'POSTGRADUATE_ENGLISH', 'WORKPLACE_DAILY'];
const DIGEST = {
  TERMS: 'eb74b7254589589f61f5f3747d83379bc6f1e950ab7d8fd52f64f3ab50fb39fb',
  PRIVACY: '4ab15e31c11c9ef99b267ae620910420fdb8a9b6f720b988afeb59d5262ddd84',
  ADULT_LEARNING: '9702cd4fe3e50613f84030998f65c0c8e7961f058176b24f8a9e82006abea189',
};

const children = [];
let created = false;
let shuttingDown = false;
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
  if(child.ownedProcessGroup) process.kill(-child.pid,'SIGTERM'); else child.kill('SIGTERM');
  for (let i = 0; i < 50 && child.exitCode === null; i++) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (child.exitCode === null) { if(child.ownedProcessGroup) process.kill(-child.pid,'SIGKILL'); else child.kill('SIGKILL'); }
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
  const busy = [18087, 18088, 18089, 18091, 18070, 18180, 18182, 18183].filter(port => listeners(port).trim());
  result.cleanup = { childrenStopped: true, remainingListeners: busy, schemasRetained: true, usersRetained: true };
  writeFileSync(join(evidence,'environment.json'), JSON.stringify(result,null,2)+'\n');
  console.log('CLEANUP '+JSON.stringify(result.cleanup));
}

process.on('SIGINT', () => { cleanup().finally(() => process.exit(1)); });
process.on('SIGTERM', () => { cleanup().finally(() => process.exit(1)); });

const result = {
  date: '2026-10-10',
  branch: 'dev',
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
  assertPortsFree([18087, 18088, 18089, 18091, 18070, 18180, 18182, 18183]);
  mkdirSync(directory, { mode: 0o700 });
  chmodSync(directory, 0o700);
  const partial = sql('SELECT @@GLOBAL.partial_revokes;');
  if (!['0', '1'].includes(partial)) throw new Error('MYSQL_GRANT_MODE_UNKNOWN');
  const partialRevokes = partial === '1';
  console.log('PARTIAL_REVOKES=' + partial);
  const existing = sql(
    `SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name IN ('${iamSchema}','${learnerSchema}','${assessmentSchema}','${contentSchema}');`
  );
  const existingUser = sql(`SELECT COUNT(*) FROM mysql.user WHERE user='${dbUser}';`);
  if (existing !== '0' || existingUser !== '0') throw new Error('RESOURCE_EXISTS');
  const dbPassword = randomBytes(24).toString('hex');
  created = true;
  for (const [schema,user] of [[iamSchema,dbUser]]) {
    sql(`CREATE DATABASE ${schema} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER '${user}'@'%' IDENTIFIED BY '${dbPassword}'; GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,DROP,INDEX,REFERENCES ON ${grantScope(schema, partialRevokes)} TO '${user}'@'%';`);
    const grants = sql(`SHOW GRANTS FOR '${user}'@'%';`);
    if (grants.split('\n').filter(line=>line.includes(' ON ')&&!line.includes(' ON *.* ')).length!==1) throw new Error('GRANT_SCOPE_INVALID');
  }
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
    'learner.persistence.username=' + learnerUser,
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
    'assessment.persistence.username=' + assessmentUser,
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
    'CONTENT_SERVICE_BASE_URL=http://127.0.0.1:18089',
  ].join('\n') + '\n');
  const contentConfig = secretFile('content-runtime.properties', [
    'server.address=127.0.0.1','server.port=18089','content.persistence.mode=jdbc','spring.flyway.enabled=true',
    'spring.flyway.schemas='+contentSchema,'spring.flyway.default-schema='+contentSchema,'service.schema='+contentSchema,
    'content.persistence.jdbc-url='+jdbc(contentSchema),'content.persistence.username='+contentUser,'content.persistence.password='+dbPassword,
    'security.resource-server.enabled=true','security.resource-server.jwk-set-uri=https://127.0.0.1:18087/api/v1/auth/jwks',
    'security.resource-server.issuer-uri=http://127.0.0.1:18087','security.resource-server.audience=yuxuexing-api',
  ].join('\n')+'\n');
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
  const contentArgs = secretFile('content-jvm.args', trustArgs);
  const iamArgs = secretFile('iam-jvm.args', '-Dfile.encoding=UTF-8\n');
  const ca = readFileSync(join(directory, 'test-ca.pem'));
  tlsCa = ca;

  const iamChild = spawnJava('iam-service', 'iam-service', iamArgs, iamConfig);
  await waitHealth(iamChild, 'https://127.0.0.1:18087/actuator/health', ca);
  console.log('IAM_HEALTH_OK');
  const gatewayChild = spawnJava('api-gateway', 'api-gateway', gatewayArgs, gatewayConfig, {
    IAM_JWT_ISSUER: 'http://127.0.0.1:18087',
    IAM_JWT_JWKS_URI: 'https://127.0.0.1:18087/api/v1/auth/jwks',
    IAM_JWT_AUDIENCE: 'yuxuexing-api',
    ASSESSMENT_SERVICE_BASE_URL: 'http://127.0.0.1:18091',
    LEARNER_SERVICE_BASE_URL: 'http://127.0.0.1:18088',
    CONTENT_SERVICE_BASE_URL: 'http://127.0.0.1:18089',
  });
  await waitHealth(gatewayChild, 'http://127.0.0.1:18070/actuator/health', ca);
  console.log('GATEWAY_HEALTH_OK');

  const iamFlyway = sql(`SELECT COUNT(*), SUM(success=0) FROM \`${iamSchema}\`.flyway_schema_history WHERE version IS NOT NULL;`);
  const accountsBefore = sql(`SELECT COUNT(*) FROM `+'`'+`${iamSchema}`+'`'+`.iam_account;`);
  step('seed.iam-flyway',200,accountsBefore==='0'&&iamFlyway.endsWith('\t0'),{iamAccounts:Number(accountsBefore),iamFlyway:iamFlyway.replace('\t',',')});
  result.sourceHead = run('git',['rev-parse','HEAD'],{cwd:root}).trim();
  result.directory = directory;
  result.schemaOwners = {iam:{schema:iamSchema,user:dbUser}};
  result.grantMode = partial;
  result.jars = Object.fromEntries(['iam-service','api-gateway'].map(id=>[id,createHash('sha256').update(readFileSync(join(root,'services',id,'target',id+'-0.1.0-SNAPSHOT.jar'))).digest('hex')]));
  const publicKey = run('openssl',['x509','-in',join(directory,'test-ca.pem'),'-pubkey','-noout']);
  const der = execFileSync('openssl',['pkey','-pubin','-outform','der'],{input:publicKey});
  result.browserSpki = createHash('sha256').update(der).digest('base64');
  secretFile('runtime.json',JSON.stringify({directory,iamSchema,learnerSchema,assessmentSchema,contentSchema,dbUser,learnerUser,assessmentUser,contentUser,spki:result.browserSpki}));
  function frontend(id,app,script,extra={}) {
    const log=openSync(join(directory,id+'.log'),'a',0o600);
    const child=spawn('pnpm',['--filter',app,script],{cwd:root,env:{...process.env,...extra},stdio:['ignore',log,log],detached:true});
    child.ownedProcessGroup=true; closeSync(log); children.push(child); return child;
  }
  const web=frontend('learner-web','@englishflow/learner-web','dev');
  const mobile=frontend('mobile-h5','@englishflow/mobile','dev:h5');
  const official=frontend('official-site','@englishflow/official-site','dev',{NUXT_PUBLIC_DOWNLOAD_ENABLED:'false'});
  await waitHealth(web,'http://127.0.0.1:18180/register');
  await waitHealth(mobile,'http://127.0.0.1:18183/');
  await waitHealth(official,'http://127.0.0.1:18182/');
  result.children=children.map(child=>({pid:child.pid,processGroup:Boolean(child.ownedProcessGroup)}));
  writeFileSync(join(evidence,'environment.json'),JSON.stringify(result,null,2)+'\n');
  console.log('SUPERVISOR_READY '+directory);
  const readline=await import('node:readline');
  const input=readline.createInterface({input:process.stdin});
  for await (const command of input) {
    if(command==='stop'){break;}
    if(command==='start-content'){assertPortsFree([18089]); for(const [schema,user] of [[contentSchema,contentUser]]) sql(`CREATE DATABASE ${schema} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER '${user}'@'%' IDENTIFIED BY '${dbPassword}'; GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,DROP,INDEX,REFERENCES ON ${grantScope(schema,partialRevokes)} TO '${user}'@'%';`); const contentChild=spawnJava('content-service','content-service',contentArgs,contentConfig);await waitHealth(contentChild,'http://127.0.0.1:18089/actuator/health',ca);result.schemaOwners.content={schema:contentSchema,user:contentUser};writeFileSync(join(evidence,'environment.json'),JSON.stringify(result,null,2)+'\n');console.log('CONTENT_READY');}
    else console.log('SUPERVISOR_ACTIVE');
  }
} catch(error) {
  result.failure = redact(error.message);
  console.error('RUNTIME_FAILURE '+result.failure);
  for(const id of ['iam-service','learner-service','assessment-service','content-service','api-gateway','learner-web','mobile-h5','official-site']) console.error(tail(id+'.log'));
  process.exitCode=1;
} finally { await cleanup(); }
