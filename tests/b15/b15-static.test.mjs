import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

test('B15 runtime manifest covers Phase 1 services and excludes future phases', () => {
  const manifest = readJson('config/v2-runtime-services.json');
  assert.equal(manifest.host, '127.0.0.1');
  assert.equal(manifest.services.length, 14);
  assert.ok(manifest.services.every((service) => service.profile === 'v2' || service.profile === 'legacy-compatibility'));
  assert.deepEqual(manifest.disabledPhaseServices.sort(), [
    'ai-orchestrator',
    'curriculum-rights-service',
    'guardian-service',
    'institution-service',
    'realtime-voice'
  ].sort());
});

test('B15 static toolchain and runtime manifest checks pass', () => {
  const toolchain = spawnSync(process.execPath, ['scripts/toolchain/check-toolchain.mjs', '--static-only'], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.equal(toolchain.status, 0, toolchain.stdout || toolchain.stderr);
  const runtimeManifest = spawnSync(process.execPath, ['scripts/runtime/validate-v2-runtime-manifest.mjs'], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.equal(runtimeManifest.status, 0, runtimeManifest.stdout || runtimeManifest.stderr);
});

test('B15 Kafka-compatible local event platform is registered and loopback-only', () => {
  const ports = readJson('config/local-ports.json');
  const services = readJson('config/local-services.json');
  const compose = fs.readFileSync(path.join(root, 'infra/docker/docker-compose.dev.yml'), 'utf8');
  assert.equal(ports.services.kafka.port, 19092);
  assert.equal(ports.services.kafka.protocol, 'kafka');
  assert.equal(services.services.kafka.composeService, 'kafka');
  assert.ok(services.requiredDependencies.includes('kafka'));
  assert.match(compose, /\n  kafka:\n/);
  assert.match(compose, /127\.0\.0\.1:\$\{KAFKA_HOST_PORT:-19092\}:19092/);
  assert.match(compose, /healthcheck:/);
});

test('B15 bootstrap is explicit and does not auto-start or destroy data', () => {
  const script = fs.readFileSync(path.join(root, 'scripts/runtime/b15-bootstrap.mjs'), 'utf8');
  assert.match(script, /--start-infra/);
  assert.match(script, /--require-healthy/);
  assert.doesNotMatch(script, /docker.*down|DROP DATABASE|TRUNCATE TABLE/i);
});

test('B15 provides explicit build and independent-process runners', () => {
  const build = fs.readFileSync(path.join(root, 'scripts/runtime/build-v2-services.mjs'), 'utf8');
  const runner = fs.readFileSync(path.join(root, 'scripts/runtime/run-v2-services.mjs'), 'utf8');
  assert.match(build, /--all/);
  assert.match(build, /-DskipTests/);
  assert.match(runner, /assertJava25/);
  assert.match(runner, /assertPortFree/);
  assert.match(runner, /healthPath/);
  assert.match(runner, /--real-oidc/);
  assert.match(runner, /B30_REAL_OIDC/);
  assert.match(runner, /spawn\(['"]java['"]/);
  assert.doesNotMatch(build, /\bclean\b|DROP DATABASE|TRUNCATE TABLE/i);
  assert.doesNotMatch(runner, /docker\s+compose[\s\S]+\bdown\b|DROP DATABASE|TRUNCATE TABLE/i);
});
