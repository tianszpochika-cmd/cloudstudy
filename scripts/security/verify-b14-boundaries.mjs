import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));

const servicePackages = new Map([
  ['learner-service', 'learner'],
  ['content-service', 'content'],
  ['learning-service', 'learning'],
  ['assessment-service', 'assessment'],
  ['media-service', 'media'],
  ['notification-service', 'notification'],
  ['gamification-service', 'gamification'],
  ['social-service', 'social'],
  ['commerce-service', 'commerce'],
  ['admin-ops-service', 'adminops'],
  ['analytics-service', 'analytics'],
  ['api-gateway', 'gateway'],
]);

const httpPepServices = new Set([
  'content-service',
  'media-service',
  'notification-service',
  'gamification-service',
  'social-service',
  'commerce-service',
  'admin-ops-service',
  'analytics-service',
  'api-gateway',
]);

const forbiddenClientFacts = /headers\.(?:set|append)\(\s*['"]x-(?:b5-role|role|tenant-id|owner-id|user-id|principal-id)['"]|localStorage\.(?:role|tenant|owner)|sessionStorage\.(?:role|tenant|owner)/i;
const forbiddenSql = /JdbcTemplate|EntityManager|JpaRepository|@Entity|\b(?:INSERT\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM)\b/i;
const forbiddenSecret = /(?:-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|\b(?:sk|rk|ghp|github_pat|AKIA)[-_][A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._~-]{32,})/;
const forbiddenEventKeys = new Set([
  'password', 'accessToken', 'refreshToken', 'identityToken', 'thirdPartySubject',
  'rawAudio', 'audioBytes', 'rawAnswer', 'answerText', 'answerContent', 'userInput',
  'paymentCredential', 'receipt', 'phone', 'mobile', 'email', 'realName',
]);

function walk(directory, predicate = () => true) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'target', '.nuxt', '.output', 'dist'].includes(entry.name)) {
        files.push(...walk(fullPath, predicate));
      }
    } else if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function textFiles(directory, extensions = new Set(['.java', '.sql', '.yaml', '.yml'])) {
  return walk(directory, (file) => extensions.has(file.slice(file.lastIndexOf('.'))));
}

function collectObjectKeys(value, keys = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectObjectKeys(item, keys));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => {
      keys.push(key);
      collectObjectKeys(item, keys);
    });
  }
  return keys;
}

export function verifyB14Boundaries() {
  const failures = [];
  const inspected = { services: 0, sourceFiles: 0, eventFragments: 0 };
  const fail = (message) => failures.push(message);

  for (const [service, packageName] of servicePackages) {
    const serviceRoot = join(root, 'services', service);
    const pomPath = join(serviceRoot, 'pom.xml');
    if (!existsSync(pomPath)) {
      fail(`${service}: missing independent Maven owner build`);
      continue;
    }
    inspected.services += 1;
    const pom = readFileSync(pomPath, 'utf8');
    if (!/<java\.version>25<\/java\.version>/.test(pom)) {
      fail(`${service}: v2 service must target Java 25`);
    }

    const sourcePaths = textFiles(join(serviceRoot, 'src', 'main'));
    const source = sourcePaths.map((file) => readFileSync(file, 'utf8')).join('\n');
    inspected.sourceFiles += sourcePaths.length;
    if (!/(?:tenant(?:Id|_id)|TenantScope|Principal|Authorization|AccessPolicy)/i.test(source)) {
      fail(`${service}: no tenant/principal/PEP marker found`);
    }
    if (forbiddenSql.test(source)) {
      fail(`${service}: direct ORM/JDBC or SQL write marker found in target service source`);
    }
    if (forbiddenSecret.test(source)) {
      fail(`${service}: possible secret/token material found in source`);
    }
    if (httpPepServices.has(service)) {
      if (!/(?:denyAll\(\)|default.?deny|fail.?closed)/i.test(source)) {
        fail(`${service}: HTTP security boundary has no default-deny/fail-closed marker`);
      }
    }

    const migrations = textFiles(join(serviceRoot, 'src', 'main', 'resources', 'db', 'migration'), new Set(['.sql']));
    if (migrations.length > 0 && migrations.some((file) => /DROP\s+(?:DATABASE|SCHEMA|TABLE)|TRUNCATE\s+TABLE/i.test(readFileSync(file, 'utf8')))) {
      fail(`${service}: destructive migration statement found`);
    }
  }

  const appPaths = [
    ...textFiles(join(root, 'apps', 'learner-web', 'src'), new Set(['.ts', '.vue'])),
    ...textFiles(join(root, 'apps', 'mobile', 'src'), new Set(['.ts', '.vue'])),
    ...textFiles(join(root, 'apps', 'admin-web', 'src'), new Set(['.ts', '.vue'])),
  ];
  for (const file of appPaths) {
    if (forbiddenClientFacts.test(readFileSync(file, 'utf8'))) {
      fail(`${relative(root, file)}: client-controlled authority/tenant fact marker found`);
    }
  }

  const eventDirectory = join(root, 'packages', 'contracts', 'events', 'v1', 'fragments');
  for (const file of walk(eventDirectory, (candidate) => candidate.endsWith('.json'))) {
    inspected.eventFragments += 1;
    let definition;
    try {
      definition = JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      fail(`${relative(root, file)}: invalid event JSON (${error.message})`);
      continue;
    }
    const leakedKeys = collectObjectKeys(definition).filter((key) => forbiddenEventKeys.has(key));
    if (leakedKeys.length > 0) {
      fail(`${relative(root, file)}: forbidden raw event payload keys: ${[...new Set(leakedKeys)].join(', ')}`);
    }
  }

  const rootMigrations = walk(join(root, 'database', 'mysql', 'migrations'), (file) => file.endsWith('.sql'));
  if (rootMigrations.length < 21) {
    fail(`database/mysql/migrations: expected B14 baseline to retain at least 21 additive migrations, found ${rootMigrations.length}`);
  }

  const environment = readFileSync(join(root, '.env.example'), 'utf8');
  for (const marker of ['B14_STRANGLER_ENABLED', 'B14_DEPRECATION_SUNSET_AT', 'B14_ROUTE_MODE_LEARNER', 'B14_ROUTE_MODE_COMMERCE']) {
    if (!environment.includes(marker)) fail(`.env.example: missing ${marker}`);
  }

  return { ok: failures.length === 0, failures, inspected };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  const result = verifyB14Boundaries();
  if (!result.ok) {
    console.error(`B14 boundary scan failed (${result.failures.length}):`);
    result.failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
  } else {
    console.log(`B14 boundary scan passed: ${result.inspected.services} services, ${result.inspected.sourceFiles} source files, ${result.inspected.eventFragments} event fragments.`);
  }
}
