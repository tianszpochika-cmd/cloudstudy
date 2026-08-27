import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const manifest = readJson('config/b17-runtime-services.json');
const base = readJson('config/v2-runtime-services.json');
const ports = readJson('config/local-ports.json');
const errors = [];
const expectedIds = [
  'learner-service', 'content-service', 'learning-service', 'assessment-service', 'media-service',
  'notification-service', 'gamification-service', 'social-service', 'commerce-service',
  'admin-ops-service', 'analytics-service'
];

function fail(message) { errors.push(message); }
function hasUnique(values, label) {
  if (new Set(values).size !== values.length) fail(`${label} must be unique`);
}

if (manifest.version !== 1) fail('b17 runtime manifest version must be 1');
if (manifest.phase !== 'phase-1') fail('B17 runtime manifest must be Phase 1');
if (manifest.baseManifest !== 'config/v2-runtime-services.json') fail('B17 must extend the v2 runtime manifest');
if (manifest.host !== '127.0.0.1') fail('B17 local services must bind to loopback');
if (manifest.defaults.independentProcess !== true) fail('independent process default must be true');
if (manifest.defaults.independentSchema !== true) fail('independent schema default must be true');
if (manifest.defaults.independentCredentials !== true) fail('independent credential default must be true');
if (manifest.defaults.crossServiceSql !== false || manifest.defaults.sharedOrmEntities !== false) {
  fail('cross-service SQL and shared ORM entities must be denied');
}
if (manifest.workflow.mayWriteDomainTables !== false) fail('workflow must not write domain tables');
if (manifest.compatibility.coreApiMayWriteDomainSchemas !== false) fail('core-api must not write v2 domain schemas');
if (manifest.compatibility.shadowReadAndRollbackRequired !== true) fail('core-api migration requires shadow read and rollback');

const actualIds = manifest.services.map((service) => service.id);
if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) fail('B17 service list/order does not match the Phase 1 target services');
const baseById = new Map(base.services.map((service) => [service.id, service]));
for (const service of manifest.services) {
  const baseService = baseById.get(service.id);
  if (!baseService) fail(`${service.id} is missing from the v2 runtime manifest`);
  if (service.port !== ports.services?.[service.id]?.port) fail(`${service.id} port is not the fixed registry port`);
  if (baseService?.portKey !== service.id) fail(`${service.id} does not bind through its v2 port key`);
  if (!/^[a-z][a-z0-9_]+$/.test(service.schema)) fail(`${service.id} schema name is invalid`);
  if (!/^svc_[a-z0-9_]+$/.test(service.dbCredential)) fail(`${service.id} database credential name is invalid`);
  if (!/^[a-z][a-z0-9-]*$/.test(service.eventNamespace)) fail(`${service.id} event namespace is invalid`);
  if (service.rollback !== service.id) fail(`${service.id} must own its rollback responsibility`);
  if (service.dependencies.includes(service.id)) fail(`${service.id} cannot depend on itself`);
  const pom = path.join(root, 'services', service.id, 'pom.xml');
  if (!fs.existsSync(pom)) fail(`${service.id} pom.xml is missing`);
  const source = fs.existsSync(path.join(root, 'services', service.id, 'src', 'main', 'java'))
    ? fs.readdirSync(path.join(root, 'services', service.id, 'src', 'main', 'java'), { recursive: true })
    : [];
  const mainClassPath = service.mainClass.split('.').join(path.sep) + '.java';
  const hasMainClass = source.some((entry) => entry.endsWith(mainClassPath));
  if (!hasMainClass) fail(`${service.id} main class is not present: ${service.mainClass}`);
  const resources = path.join(root, 'services', service.id, 'src', 'main', 'resources');
  if (!fs.existsSync(path.join(resources, 'application.yml')) && !fs.existsSync(path.join(resources, 'application.yaml'))) {
    fail(`${service.id} application configuration is missing`);
  }
  if (!service.migrationPath) {
    fail(`${service.id} migration path is missing`);
  } else {
    const migrationPath = path.join(root, service.migrationPath);
    if (!fs.existsSync(migrationPath)) fail(`${service.id} migration is missing: ${service.migrationPath}`);
    else {
      const migration = fs.readFileSync(migrationPath, 'utf8');
      if (!/CREATE\s+TABLE\b/i.test(migration)) fail(`${service.id} migration has no table creation`);
      if (/\bDROP\s+(DATABASE|SCHEMA|TABLE|VIEW)\b|\bTRUNCATE\s+TABLE\b|\bCREATE\s+DATABASE\b/i.test(migration)) fail(`${service.id} migration contains destructive SQL`);
      if (/\bef_[a-z0-9_]+\./i.test(migration)) {
        fail(`${service.id} migration appears to reference another schema`);
      }
    }
  }
}
hasUnique(manifest.services.map((service) => service.port), 'B17 ports');
hasUnique(manifest.services.map((service) => service.schema), 'B17 schemas');
hasUnique(manifest.services.map((service) => service.dbCredential), 'B17 database credentials');
if (manifest.services.some((service) => service.id === 'core-api')) fail('core-api cannot be a B17 domain service');
if (JSON.stringify(manifest).match(/ai-orchestrator|realtime-voice|guardian-service|institution-service|curriculum-rights-service/)) {
  fail('Phase 2/3 service leaked into the B17 default runtime manifest');
}

if (errors.length > 0) {
  for (const error of errors) console.error(`B17 runtime manifest error: ${error}`);
  process.exitCode = 1;
} else {
  console.log(`B17 runtime service manifest passed: ${manifest.services.length} independent Phase 1 domain services, loopback-only, unique schema/credential/port`);
}
