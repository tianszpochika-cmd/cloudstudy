import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { readB28Inputs, validateB28LocalRuntime } from '../../scripts/runtime/b28-bootstrap.mjs';

const root = process.cwd();
const inputs = readB28Inputs(root);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('B28 local-real scope requires Web/H5 and defers native/WeChat targets', () => {
  const { config } = inputs;
  assert.equal(config.batch, 'B28');
  assert.equal(config.runtimeProfile, 'local-real');
  assert.equal(config.scope.learnerWeb, 'in-scope');
  assert.equal(config.scope.mobileH5, 'in-scope');
  assert.equal(config.scope.ios, 'deferred');
  assert.equal(config.scope.android, 'deferred');
  assert.equal(config.scope.wechatMiniProgram, 'deferred');
  assert.deepEqual(config.dependencies.filter((item) => item.required).map((item) => item.id), [
    'mysql', 'redis', 'kafka', 'minio'
  ]);
  assert.equal(config.compatibilityDependencies[0].id, 'rabbitmq');
  assert.equal(config.compatibilityDependencies[0].required, false);
});

test('B28 static validator passes fixed ports, real dependencies and owner/schema boundaries', () => {
  const result = validateB28LocalRuntime(inputs, { runtimeRequested: false });
  assert.equal(result.result, 'PASS', result.errors.join('\n'));
  assert.equal(result.staticStatus, 'PASS');
  assert.equal(result.runtimeStatus, 'not-requested');
  assert.equal(result.runtimeGate, 'static-only');
  assert.equal(result.runtimeProcessCount, 14);
  assert.equal(result.requiredDependencyCount, 4);
  assert.equal(result.ownerSchemaCount, 11);
  assert.equal(result.fixedPortCount, 5);
});

test('B28 runtime validation fails closed when no external runtime evidence exists', () => {
  const result = validateB28LocalRuntime(inputs, {
    runtimeRequested: true,
    env: {},
    commandRunner: () => ({ status: 1, stdout: '', stderr: 'unavailable' })
  });
  assert.equal(result.result, 'FAIL');
  assert.equal(result.staticStatus, 'PASS');
  assert.equal(result.runtimeStatus, 'blocked');
  assert.equal(result.runtimeGate, 'blocked');
  assert.ok(result.errors.some((error) => error.includes('B28_RUNTIME_EVIDENCE_FILE')));
  assert.equal(result.runtimeChecks.length, 0);
});

test('B28 refuses safety-policy widening to mock, fallback or in-memory facts', () => {
  for (const field of ['mockAllowed', 'fallbackAllowed', 'inMemoryFactsAllowed']) {
    const candidate = clone(inputs);
    candidate.config.safetyPolicy[field] = true;
    const result = validateB28LocalRuntime(candidate, { runtimeRequested: false });
    assert.equal(result.result, 'FAIL', `${field} must fail closed`);
    assert.ok(result.errors.some((error) => error.includes('静态检查失败')));
  }
});

test('B28 refuses fixed-port drift and duplicate owner schemas', () => {
  const portCandidate = clone(inputs);
  portCandidate.localPorts.services.mysql.port = 13307;
  const portResult = validateB28LocalRuntime(portCandidate, { runtimeRequested: false });
  assert.equal(portResult.result, 'FAIL');
  assert.ok(portResult.errors.some((error) => error.includes('mysql/mysql uses its fixed port')));

  const schemaCandidate = clone(inputs);
  schemaCandidate.ownerManifest.services[1].schema = schemaCandidate.ownerManifest.services[0].schema;
  const schemaResult = validateB28LocalRuntime(schemaCandidate, { runtimeRequested: false });
  assert.equal(schemaResult.result, 'FAIL');
  assert.ok(schemaResult.errors.some((error) => error.includes('schema') && error.includes('unique')));

  const bindingCandidate = clone(inputs);
  bindingCandidate.localServices.services.minio.bindings[1].hostPortEnv = 'MINIO_WRONG_HOST_PORT';
  const bindingResult = validateB28LocalRuntime(bindingCandidate, { runtimeRequested: false });
  assert.equal(bindingResult.result, 'FAIL');
  assert.ok(bindingResult.errors.some((error) => error.includes('minio/minio-console uses its fixed port')));
});

test('B28 bootstrap static CLI runs prerequisites and never starts Docker or changes database state', () => {
  const scriptPath = path.join(root, 'scripts/runtime/b28-bootstrap.mjs');
  assert.equal(fs.existsSync(scriptPath), true);
  const result = spawnSync(process.execPath, [scriptPath, '--static-only'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /B28 bootstrap passed \(static\)/);
  assert.doesNotMatch(result.stdout, /docker compose.*\b(up|down)\b/i);
  assert.doesNotMatch(result.stdout, /DROP DATABASE|TRUNCATE TABLE/i);
});

test('B28 bootstrap rejects ambiguous invocation instead of silently switching runtime modes', () => {
  const result = spawnSync(process.execPath, [
    path.join(root, 'scripts/runtime/b28-bootstrap.mjs'),
    '--static-only',
    '--require-runtime'
  ], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true
  });
  assert.equal(result.status, 2);
  assert.match(`${result.stdout}\n${result.stderr}`, /Usage:/);
});
