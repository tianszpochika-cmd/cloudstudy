import { spawn, execFileSync } from 'node:child_process';
import { createSign, generateKeyPairSync, randomBytes } from 'node:crypto';
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { join } from 'node:path';

const root = '/Users/Admin/Desktop/work/cloudstudy';
const evidence = join(root, 'evidence/redesign/2026-10-10/R1-026');
const container = 'yuxuexing-local-mysql-1';
const schema = `r1_026_cnt_20261010_${randomBytes(4).toString('hex')}`;
const contentPort = 18089;
const jwksPort = 18226;
const issuer = `http://127.0.0.1:${jwksPort}`;
const audience = 'yuxuexing-api';
const answerKey = /"(answer|answers|answerRule|answerRules|answer_rule_json|correctOption|correctAnswer|expectedAnswer|scoringRule)"/i;

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
  const version = sqlScalar('SELECT VERSION();');
  note('MYSQL_VERSION ' + version);
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
  note('PORTS_FREE 18087 18088 18089 18226');
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

function startJwks(publicJwk) {
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
  const header = { alg: 'RS256', typ: 'JWT', kid: 'r1-026-local' };
  const payload = {
    iss: issuer,
    aud: audience,
    sub: 'r1-026-learner',
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
  const deadline = Date.now() + 240000;
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

function itemsOf(body) {
  const parsed = JSON.parse(body);
  const items = parsed?.data?.items;
  if (!Array.isArray(items)) throw new Error('NO_ITEMS ' + body.slice(0, 240));
  return items;
}

async function main() {
  assertMysql();
  assertPorts();
  const forbidden = sqlScalar("SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name LIKE 'r1\\_018%' OR schema_name LIKE 'r1\\_025%';");
  note('FOREIGN_CARD_SCHEMAS ' + forbidden);
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicJwk = publicKey.export({ format: 'jwk' });
  publicJwk.kid = 'r1-026-local';
  publicJwk.use = 'sig';
  publicJwk.alg = 'RS256';
  await startJwks(publicJwk);
  note('SCHEMA_CREATE ' + schema);
  sql(`CREATE DATABASE ${schema} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  startContent(mysqlPassword());
  await waitHealth();
  const counts = sql(`
    SELECT 'bindings', COUNT(*) FROM ${schema}.content_b3_item_binding
    UNION ALL SELECT 'dry_experience', COUNT(*) FROM ${schema}.b3_content_experience
      WHERE experience_id IN ('p1-b3-grammar-01','p1-b3-grammar-02','p1-b3-grammar-03','p1-b3-reading-01','p1-b3-reading-02')
    UNION ALL SELECT 'placement', COUNT(*) FROM ${schema}.content_placement_item
    UNION ALL SELECT CONCAT('dim:', dimension), COUNT(*) FROM ${schema}.content_placement_item GROUP BY dimension
    UNION ALL SELECT 'placement_answers', COUNT(*) FROM ${schema}.content_placement_item
      WHERE JSON_EXTRACT(answer_rule_json, '$.correctOption') IS NOT NULL
    UNION ALL SELECT 'b3_answer_keys', COUNT(*) FROM ${schema}.b3_content_experience
      WHERE experience_id LIKE 'p1-b3-%' AND (
        JSON_EXTRACT(payload_json, '$.correctOption') IS NOT NULL
        OR JSON_EXTRACT(payload_json, '$.answerRule') IS NOT NULL
        OR JSON_EXTRACT(payload_json, '$.answerRules') IS NOT NULL
        OR JSON_EXTRACT(payload_json, '$.answer') IS NOT NULL)
    UNION ALL SELECT 'guard_row', COUNT(*) FROM ${schema}.content_b3_item_binding
      WHERE b3_resource_key = 'r1-026-seed-guard'
    UNION ALL SELECT 'legacy_published', COUNT(*) FROM ${schema}.b3_content_experience
      WHERE experience_id LIKE 'b3-%' AND availability = 'PUBLISHED'
    UNION ALL SELECT 'sealed_only', COUNT(*) FROM ${schema}.content_version
      WHERE content_version_id = 266100
        AND JSON_LENGTH(rights_permitted_channels) = 1
        AND JSON_CONTAINS(rights_permitted_channels, '"SEALED"')
        AND NOT JSON_CONTAINS(rights_permitted_channels, '"LEARNER"');
    SELECT version, description, success FROM ${schema}.flyway_schema_history ORDER BY installed_rank;
  `);
  note('SQL\n' + counts.trim());
  const token = mint(privateKey);
  const grammar = await fetchText('/internal/v1/content/learner/grammar/exercises', token);
  const reading = await fetchText('/internal/v1/content/learner/reading/questions', token);
  const grammarAnon = await fetchText('/internal/v1/content/learner/grammar/exercises');
  const sealed = await fetchText('/internal/v1/content/placement-bank/sealed', token);
  const catalog = await fetchText('/api/v1/content/learner/catalog', token);
  const learnerBank = await fetchText('/api/v1/content/learner/p1.placement.v1', token);
  note('GRAMMAR_HTTP ' + grammar.status + ' answer=' + answerKey.test(grammar.body) + ' bytes=' + grammar.body.length);
  note('READING_HTTP ' + reading.status + ' answer=' + answerKey.test(reading.body) + ' bytes=' + reading.body.length);
  note('GRAMMAR_ANON ' + grammarAnon.status);
  note('SEALED_HTTP ' + sealed.status + ' answer=' + answerKey.test(sealed.body) + ' bytes=' + sealed.body.length);
  note('CATALOG_HTTP ' + catalog.status + ' answer=' + answerKey.test(catalog.body));
  note('LEARNER_BANK_HTTP ' + learnerBank.status);
  const grammarItems = itemsOf(grammar.body);
  const readingItems = itemsOf(reading.body);
  note('GRAMMAR_COUNT ' + grammarItems.length);
  note('READING_COUNT ' + readingItems.length);
  const refs = [...grammarItems, ...readingItems].map((item) => item.practiceRef?.questionItemId).sort();
  note('PRACTICE_REFS ' + JSON.stringify(refs));
  const sealedItems = itemsOf(sealed.body);
  note('SEALED_COUNT ' + sealedItems.length);
  const catalogItems = itemsOf(catalog.body);
  note('CATALOG_COUNT ' + catalogItems.length + ' codes=' + JSON.stringify(catalogItems.map((item) => item.contentCode)));
  sql(`CREATE TABLE ${schema}.r1_026_hold AS SELECT * FROM ${schema}.content_placement_item WHERE placement_item_id = 266010;`);
  sql(`DELETE FROM ${schema}.content_placement_item WHERE placement_item_id = 266010;`);
  const partial = await fetchText('/internal/v1/content/placement-bank/sealed', token);
  note('PARTIAL_HTTP ' + partial.status + ' hasStem=' + partial.body.includes('p1.place.vocab.01'));
  sql(`INSERT INTO ${schema}.content_placement_item SELECT * FROM ${schema}.r1_026_hold;`);
  sql(`DROP TABLE ${schema}.r1_026_hold;`);
  const restored = sqlScalar(`SELECT COUNT(*) FROM ${schema}.content_placement_item;`);
  const sealedAgain = await fetchText('/internal/v1/content/placement-bank/sealed', token);
  note('PLACEMENT_RESTORED ' + restored + ' SEALED_AGAIN ' + sealedAgain.status + ' answer=' + answerKey.test(sealedAgain.body));
  writeFileSync(join(evidence, 'sql.txt'), counts);
  writeFileSync(join(evidence, 'grammar.json'), grammar.body);
  writeFileSync(join(evidence, 'reading.json'), reading.body);
  writeFileSync(join(evidence, 'sealed.json'), sealed.body);
  writeFileSync(join(evidence, 'catalog.json'), catalog.body);
  writeFileSync(join(evidence, 'learner-bank.txt'), learnerBank.status + '\n' + learnerBank.body);
  writeFileSync(join(evidence, 'partial.txt'), partial.status + '\n' + partial.body);
  writeFileSync(join(evidence, 'anon.txt'), grammarAnon.status + '\n' + grammarAnon.body);
  if (grammar.status !== 200 || reading.status !== 200 || answerKey.test(grammar.body) || answerKey.test(reading.body)) {
    throw new Error('DRY_DELIVERY_NOT_ISOLATED');
  }
  if (grammarItems.length !== 3 || readingItems.length !== 2) throw new Error('DRY_COUNT');
  if (JSON.stringify(refs) !== JSON.stringify(['266004', '266005', '266006', '266007', '266008'])) {
    throw new Error('PRACTICE_REFS_WRONG');
  }
  if (grammarAnon.status !== 401) throw new Error('ANON_NOT_401');
  if (sealed.status !== 200 || sealedItems.length !== 10 || answerKey.test(sealed.body)) {
    throw new Error('SEALED_DELIVERY_CHANGED');
  }
  if (catalog.status !== 200 || catalogItems.length !== 0) throw new Error('CATALOG_OPENED');
  if (learnerBank.status !== 403) throw new Error('LEARNER_CHANNEL_OPENED ' + learnerBank.status);
  if (partial.status !== 503 || partial.body.includes('p1.place.vocab.01')) throw new Error('PARTIAL_NOT_CLOSED');
  if (restored !== '10' || sealedAgain.status !== 200 || answerKey.test(sealedAgain.body)) {
    throw new Error('PLACEMENT_NOT_RESTORED');
  }
  const flyway29 = sqlScalar(`SELECT CONCAT(version, ':', success) FROM ${schema}.flyway_schema_history WHERE version = '29';`);
  note('FLYWAY_29 ' + flyway29);
  if (flyway29 !== '29:1') throw new Error('FLYWAY_29_NOT_SUCCESS');
  note('RUN_OK');
}

async function cleanup() {
  if (contentChild && contentChild.pid && contentChild.exitCode == null) {
    try { process.kill(-contentChild.pid, 'SIGTERM'); } catch { /* already gone */ }
    await new Promise((resolve) => setTimeout(resolve, 4000));
    if (contentChild.exitCode == null) {
      try { process.kill(-contentChild.pid, 'SIGKILL'); } catch { /* already gone */ }
    }
  }
  if (jwksServer) await new Promise((resolve) => jwksServer.close(resolve));
  try {
    const left = sqlScalar("SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name LIKE 'r1\\_026\\_%';");
    note('SCHEMAS_BEFORE_DROP ' + left);
    sql(`DROP DATABASE IF EXISTS ${schema};`);
    const after = sqlScalar("SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name LIKE 'r1\\_026\\_%';");
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
  writeFileSync(join(evidence, 'run.log'), log.join('\n') + '\n');
}
