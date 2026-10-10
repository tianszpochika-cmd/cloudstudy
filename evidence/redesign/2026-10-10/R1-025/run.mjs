import { spawn, execFileSync } from 'node:child_process';
import { createSign, generateKeyPairSync, randomBytes } from 'node:crypto';
import { createWriteStream, mkdirSync } from 'node:fs';
import http from 'node:http';
import { join } from 'node:path';

const root = '/Users/Admin/Desktop/work/cloudstudy';
const evidence = join(root, 'evidence/redesign/2026-10-10/R1-025');
const container = 'yuxuexing-local-mysql-1';
const schema = `r1_025_cnt_20261010_${randomBytes(4).toString('hex')}`;
const contentPort = 18089;
const jwksPort = 18199;
const issuer = `http://127.0.0.1:${jwksPort}`;
const audience = 'yuxuexing-api';

mkdirSync(evidence, { recursive: true });

let contentChild = null;
let jwksServer = null;
const log = [];

function note(line) {
  const text = String(line);
  log.push(text);
  console.log(text);
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', ...options });
}

function sql(statement) {
  return run('docker', [
    'exec', '-i', container, 'sh', '-c',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --protocol=socket --user=root --default-character-set=utf8mb4 --batch --raw',
  ], { input: statement });
}

function sqlScalar(statement) {
  return run('docker', [
    'exec', '-i', container, 'sh', '-c',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --protocol=socket --user=root --default-character-set=utf8mb4 --batch --skip-column-names --raw',
  ], { input: statement }).trim();
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
  note('MYSQL_IDENTITY ' + JSON.stringify(facts));
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

function assertPorts() {
  for (const port of [18087, 18088, contentPort, jwksPort]) {
    const text = listeners(port).trim();
    if (text) throw new Error('PORT_OCCUPIED ' + port + '\n' + text);
  }
  note('PORTS_FREE 18087 18088 18089 18199');
}

function mysqlPassword() {
  const value = JSON.parse(run('docker', ['inspect', container]))[0];
  const entry = (value.Config.Env || []).find((item) => item.startsWith('MYSQL_ROOT_PASSWORD='));
  if (!entry) throw new Error('MYSQL_ROOT_PASSWORD missing from container env');
  return entry.slice('MYSQL_ROOT_PASSWORD='.length);
}

function b64(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function startJwks(privateKey, publicJwk) {
  const body = JSON.stringify({ keys: [publicJwk] });
  jwksServer = http.createServer((request, response) => {
    if (request.url === '/jwks') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(body);
      return;
    }
    response.writeHead(404);
    response.end();
  });
  return new Promise((resolve) => {
    jwksServer.listen(jwksPort, '127.0.0.1', () => {
      note('JWKS_UP ' + issuer + '/jwks');
      resolve();
    });
  });
}

function mint(privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: 'r1-025-local' };
  const payload = {
    iss: issuer,
    aud: audience,
    sub: 'r1-025-learner',
    tenant_id: 'platform',
    roles: ['learner'],
    permissions: ['content.read'],
    adult_gate: 'PASSED',
    consent_state: 'GRANTED',
    token_type: 'access',
    scope: 'content.read',
    iat: now,
    nbf: now - 5,
    exp: now + 600,
  };
  const input = `${b64(header)}.${b64(payload)}`;
  const signature = createSign('RSA-SHA256').update(input).end().sign(privateKey).toString('base64url');
  return `${input}.${signature}`;
}

function startContent(password) {
  const jdbc = `jdbc:mysql://127.0.0.1:13306/${schema}?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&allowPublicKeyRetrieval=true&useSSL=false`;
  const out = createWriteStream(join(evidence, 'content-service.log'));
  contentChild = spawn('mvn', ['-f', 'services/content-service/pom.xml', 'spring-boot:run'], {
    cwd: root,
    detached: true,
    env: {
      ...process.env,
      CONTENT_PERSISTENCE_MODE: 'jdbc',
      CONTENT_FLYWAY_ENABLED: 'true',
      CONTENT_SERVICE_SCHEMA: schema,
      CONTENT_JDBC_URL: jdbc,
      CONTENT_JDBC_USERNAME: 'root',
      CONTENT_JDBC_PASSWORD: password,
      CONTENT_SERVICE_PORT: String(contentPort),
      CONTENT_SERVICE_SERVER_ADDRESS: '127.0.0.1',
      CONTENT_EVENT_RELAY_ENABLED: 'false',
      CONTENT_EVENT_CONSUMER_ENABLED: 'false',
      OTEL_ENABLED: 'false',
      OTEL_TRACING_EXPORT_ENABLED: 'false',
      CONTENT_SERVICE_SECURITY_ISSUER_URI: issuer,
      CONTENT_SERVICE_SECURITY_JWK_SET_URI: `${issuer}/jwks`,
      CONTENT_SERVICE_SECURITY_AUDIENCE: audience,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  contentChild.stdout.pipe(out);
  contentChild.stderr.pipe(out);
  contentChild.on('exit', (code) => note('CONTENT_EXIT ' + code));
}

function fetchText(path, token) {
  return new Promise((resolve, reject) => {
    const headers = { accept: 'application/json' };
    if (token) headers.authorization = 'Bearer ' + token;
    const request = http.request({
      host: '127.0.0.1',
      port: contentPort,
      path,
      method: 'GET',
      headers,
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    request.on('error', reject);
    request.end();
  });
}

async function waitHealth() {
  const deadline = Date.now() + 180000;
  let last = 'none';
  while (Date.now() < deadline) {
    if (contentChild.exitCode != null) throw new Error('CONTENT_DIED ' + contentChild.exitCode);
    try {
      const health = await fetchText('/actuator/health');
      last = health.status + ' ' + health.body.slice(0, 180);
      if (health.status === 200) {
        note('CONTENT_HEALTH ' + last);
        return;
      }
    } catch (error) {
      last = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('CONTENT_HEALTH_TIMEOUT ' + last);
}

function containsAnswer(body) {
  return /answer|correctoption/i.test(body);
}

async function main() {
  assertMysql();
  assertPorts();
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicJwk = publicKey.export({ format: 'jwk' });
  publicJwk.kid = 'r1-025-local';
  publicJwk.use = 'sig';
  publicJwk.alg = 'RS256';
  await startJwks(privateKey, publicJwk);
  note('SCHEMA_CREATE ' + schema);
  sql(`CREATE DATABASE ${schema} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  startContent(mysqlPassword());
  await waitHealth();
  const counts = sql(`
    SELECT 'rows', COUNT(*) FROM ${schema}.content_placement_item
    UNION ALL SELECT CONCAT('dim:', dimension), COUNT(*) FROM ${schema}.content_placement_item GROUP BY dimension
    UNION ALL SELECT 'bank', COUNT(*) FROM ${schema}.content_placement_item WHERE bank_code = 'P1_PLACEMENT_V1'
    UNION ALL SELECT 'answers', COUNT(*) FROM ${schema}.content_placement_item
      WHERE JSON_EXTRACT(answer_rule_json, '$.correctOption') IS NOT NULL
    UNION ALL SELECT 'version', COUNT(*) FROM ${schema}.content_version WHERE content_version_id = 266100;
    SELECT version, description, success FROM ${schema}.flyway_schema_history ORDER BY installed_rank;
  `);
  note('SQL\n' + counts.trim());
  const token = mint(privateKey);
  const sealed = await fetchText('/internal/v1/content/placement-bank/sealed', token);
  note('SEALED_HTTP ' + sealed.status + ' answer=' + containsAnswer(sealed.body) + ' bytes=' + sealed.body.length);
  const anonymous = await fetchText('/internal/v1/content/placement-bank/sealed');
  note('SEALED_ANON ' + anonymous.status);
  const plan = await fetchText('/internal/v1/content/placement-bank/plan-items', token);
  note('PLAN_HTTP ' + plan.status + ' answer=' + containsAnswer(plan.body));
  sql(`DELETE FROM ${schema}.content_placement_item WHERE placement_item_id = 266010;`);
  const partial = await fetchText('/internal/v1/content/placement-bank/sealed', token);
  note('PARTIAL_HTTP ' + partial.status + ' hasStem=' + partial.body.includes('p1.place.vocab.01') + ' body=' + partial.body.slice(0, 240));
  const fs = await import('node:fs');
  fs.writeFileSync(join(evidence, 'sql.txt'), counts);
  fs.writeFileSync(join(evidence, 'sealed.json'), sealed.body);
  fs.writeFileSync(join(evidence, 'plan-items.json'), plan.body);
  fs.writeFileSync(join(evidence, 'partial.txt'), partial.status + '\n' + partial.body);
  fs.writeFileSync(join(evidence, 'anon.txt'), anonymous.status + '\n' + anonymous.body);
  if (sealed.status !== 200 || containsAnswer(sealed.body)) {
    throw new Error('SEALED_DELIVERY_NOT_ISOLATED');
  }
  const parsed = JSON.parse(sealed.body);
  const items = parsed.data.items;
  if (!Array.isArray(items) || items.length !== 10) throw new Error('SEALED_ITEM_COUNT ' + items?.length);
  const tally = {};
  for (const item of items) tally[item.dimension] = (tally[item.dimension] || 0) + 1;
  note('DELIVERY_DIMS ' + JSON.stringify(tally));
  if (tally.VOCABULARY !== 3 || tally.BASIC_GRAMMAR !== 3 || tally.READING !== 2 || tally.LISTENING !== 2) {
    throw new Error('DELIVERY_DIMS_WRONG');
  }
  if (partial.status !== 503 || partial.body.includes('p1.place.vocab.01')) {
    throw new Error('PARTIAL_NOT_CLOSED');
  }
  note('RUN_OK');
}

async function cleanup() {
  if (contentChild && contentChild.pid && contentChild.exitCode == null) {
    try { process.kill(-contentChild.pid, 'SIGTERM'); } catch { /* already gone */ }
    await new Promise((resolve) => setTimeout(resolve, 3000));
    if (contentChild.exitCode == null) {
      try { process.kill(-contentChild.pid, 'SIGKILL'); } catch { /* already gone */ }
    }
  }
  if (jwksServer) await new Promise((resolve) => jwksServer.close(resolve));
  try {
    const left = sqlScalar("SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name LIKE 'r1_025\\_%';");
    note('SCHEMAS_BEFORE_DROP ' + left);
    sql(`DROP DATABASE IF EXISTS ${schema};`);
    const after = sqlScalar("SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name LIKE 'r1_025\\_%';");
    note('SCHEMAS_AFTER_DROP ' + after);
  } catch (error) {
    note('CLEANUP_SQL_FAILED ' + error.message);
  }
  note('PORTS_AFTER content=' + (listeners(contentPort).trim() ? 'busy' : 'free')
      + ' jwks=' + (listeners(jwksPort).trim() ? 'busy' : 'free')
      + ' iam=' + (listeners(18087).trim() ? 'busy' : 'free')
      + ' learner=' + (listeners(18088).trim() ? 'busy' : 'free'));
}

try {
  await main();
} catch (error) {
  note('RUN_FAILED ' + (error.stack || error.message));
  process.exitCode = 1;
} finally {
  await cleanup();
  const fs = await import('node:fs');
  fs.writeFileSync(join(evidence, 'run.log'), log.join('\n') + '\n');
}
