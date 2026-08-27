import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const manifest = readJson('config/b17-runtime-services.json');
const base = readJson('config/v2-runtime-services.json');
const ports = readJson('config/local-ports.json');

test('B17 runtime manifest declares all Phase 1 domain services as independent owners', () => {
  assert.equal(manifest.services.length, 11);
  assert.equal(manifest.host, '127.0.0.1');
  assert.equal(manifest.defaults.independentProcess, true);
  assert.equal(manifest.defaults.independentSchema, true);
  assert.equal(manifest.defaults.independentCredentials, true);
  assert.equal(manifest.defaults.crossServiceSql, false);
  assert.equal(manifest.defaults.sharedOrmEntities, false);
  assert.deepEqual(manifest.services.map((service) => service.id), [
    'learner-service', 'content-service', 'learning-service', 'assessment-service', 'media-service',
    'notification-service', 'gamification-service', 'social-service', 'commerce-service',
    'admin-ops-service', 'analytics-service'
  ]);
});

test('B17 runtime manifest matches fixed ports, main classes and readiness configuration', () => {
  const baseById = new Map(base.services.map((service) => [service.id, service]));
  for (const service of manifest.services) {
    assert.equal(service.port, ports.services[service.id].port);
    assert.equal(baseById.get(service.id).portKey, service.id);
    assert.match(service.schema, /^[a-z][a-z0-9_]+$/);
    assert.match(service.dbCredential, /^svc_[a-z0-9_]+$/);
    assert.match(service.eventNamespace, /^[a-z][a-z0-9-]*$/);
    assert.equal(service.rollback, service.id);
    assert.ok(service.migrationPath.endsWith('.sql'));
    assert.equal(fs.existsSync(path.join(root, service.migrationPath)), true);
    assert.ok(service.dependencies.length > 0);
  }
  assert.equal(new Set(manifest.services.map((service) => service.port)).size, 11);
  assert.equal(new Set(manifest.services.map((service) => service.schema)).size, 11);
  assert.equal(new Set(manifest.services.map((service) => service.dbCredential)).size, 11);
});

test('B17 workflow and legacy compatibility cannot write v2 domain facts', () => {
  assert.equal(manifest.workflow.mayWriteDomainTables, false);
  assert.equal(manifest.compatibility.coreApiMayWriteDomainSchemas, false);
  assert.equal(manifest.compatibility.shadowReadAndRollbackRequired, true);
  assert.equal(manifest.services.some((service) => service.id === 'core-api'), false);
  assert.doesNotMatch(JSON.stringify(manifest), /shared[_-](schema|table)|cross[_-]service[_-]sql\s*[:=]\s*true/i);
});

test('B17 static runtime evidence is separate from service startup evidence', () => {
  assert.ok(manifest.runtimeEvidence.static.includes('unique-schema'));
  assert.ok(manifest.runtimeEvidence.static.includes('no-cross-service-sql'));
  assert.ok(manifest.runtimeEvidence.runtime.includes('independent-process'));
  assert.ok(manifest.runtimeEvidence.runtime.includes('fault-isolation'));
});
