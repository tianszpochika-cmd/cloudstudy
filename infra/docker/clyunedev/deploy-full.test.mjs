import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const directory = path.dirname(fileURLToPath(import.meta.url));

test('deployment preflights before any account change and starts apps without one-shot dependencies', () => {
  const script = fs.readFileSync(path.join(directory, 'deploy-full.sh'), 'utf8');
  const initialPreflight = script.indexOf('compose run --rm --no-deps mysql-migrate --preflight');
  const stopWriters = script.indexOf('compose stop api-gateway iam-service');
  const secondPreflight = script.indexOf('compose run --rm --no-deps mysql-migrate --preflight', initialPreflight + 1);
  const accountChange = script.indexOf('compose up -d --force-recreate mysql-init mysql-migrate');
  assert.ok(initialPreflight > 0 && initialPreflight < stopWriters);
  assert.ok(secondPreflight > stopWriters && secondPreflight < accountChange);
  assert.match(script, /compose run --rm --no-deps mysql-migrate --verify/u);
  assert.match(script, /compose up -d --no-deps iam-service audit-service workflow-service/u);
  assert.match(script, /compose up -d --no-deps api-gateway official-site learner-web admin-web mobile-h5/u);
  assert.doesNotMatch(script, /^compose up -d\s*$/mu);
});

test('SQL migration iterates only pending versions under a scoped temporary account', () => {
  const runner = fs.readFileSync(path.join(directory, 'run-owner-migrations.mjs'), 'utf8');
  assert.match(runner, /function migrate\(\{ owner, migrations, pending \}\)/u);
  assert.match(runner, /for \(const migration of pending\)/u);
  assert.match(runner, /GRANT ALL PRIVILEGES ON \$\{schema\}\.\* TO/u);
  assert.match(runner, /query\(migration\.sql, \{ user: migrationUser, password: migrationPassword, database: owner\.schema \}/u);
  assert.match(runner, /DROP USER \$\{literal\(migrationUser\)\}@'%'/u);
});
