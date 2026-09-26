import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { readOwnerManifest } from '../../../scripts/database/lib/owner-manifest.mjs';
import { loadMigrations } from './owner-migration-plan.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const domainOwners = [
  'learner', 'content', 'learning', 'assessment', 'media', 'notification',
  'gamification', 'social', 'commerce', 'admin-ops', 'analytics'
];
const externalOwners = [...domainOwners, 'audit', 'workflow'].map((name) => `${name}-service`);
const dedicatedFlyway = [
  'LEARNER', 'CONTENT', 'LEARNING', 'ASSESSMENT', 'MEDIA', 'NOTIFICATION',
  'GAMIFICATION', 'SOCIAL', 'COMMERCE'
];

test('full Compose gates every external owner behind the short-lived migration job', (context) => {
  const result = spawnSync('docker', [
    'compose', '--env-file', path.join(directory, 'clyunedev.env.example'),
    '--env-file', path.join(directory, 'clyunedev.full.env.example'),
    '-f', path.join(directory, 'docker-compose.core.yml'),
    '-f', path.join(directory, 'docker-compose.full.yml'),
    'config', '--format', 'json'
  ], { cwd: root, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
  if (result.error?.code === 'ENOENT') return context.skip('Docker Compose CLI is unavailable');
  assert.equal(result.status, 0, result.stderr);
  const services = JSON.parse(result.stdout).services;
  assert.equal(services['mysql-migrate'].depends_on['mysql-init'].condition, 'service_completed_successfully');
  assert.equal(services['mysql-migrate'].restart, 'no');
  assert.equal(services['mysql-migrate'].environment.MYSQL_RUNTIME_MODE, 'host');
  assert.equal(services['mysql-migrate'].environment.MYSQL_HOST, 'mysql');
  assert.equal(services['mysql-migrate'].read_only, true);
  assert.equal(services['mysql-migrate'].volumes, undefined);
  assert.equal(services['iam-service'].environment.IAM_FLYWAY_ENABLED, 'true');
  for (const id of externalOwners) {
    assert.equal(services[id].depends_on['mysql-migrate'].condition,
      'service_completed_successfully', `${id} migration gate`);
    assert.equal(services[id].environment.SPRING_FLYWAY_ENABLED, 'false', `${id} Spring Flyway`);
    assert.equal(services[id].environment.MYSQL_ROOT_PASSWORD, undefined, `${id} admin credential isolation`);
  }
  for (const name of dedicatedFlyway) {
    assert.equal(services[`${name.toLowerCase().replaceAll('_', '-')}-service`]
      .environment[`${name}_FLYWAY_ENABLED`], 'false', `${name} dedicated Flyway`);
  }
});

test('migration image contains each declared external owner SQL directory', () => {
  const dockerfile = fs.readFileSync(path.join(directory, 'Dockerfile.owner-migrator'), 'utf8');
  const owners = readOwnerManifest(root).services;
  assert.equal(owners.length, 13);
  for (const owner of owners) {
    assert.ok(loadMigrations(root, owner).length > 0, `${owner.id} migration files`);
    const migrationDirectory = path.dirname(owner.migrationPath).replaceAll('\\', '/');
    assert.ok(dockerfile.includes(`COPY ${migrationDirectory}/ `), `${owner.id} migration image copy`);
  }
});
