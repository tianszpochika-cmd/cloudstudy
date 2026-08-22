import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function filesUnder(relativeDirectory, predicate = () => true) {
  const directory = path.join(root, relativeDirectory);
  if (!fs.existsSync(directory)) return [];
  const result = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.nuxt' || entry.name === '.output' || entry.name === 'target' || entry.name.startsWith('.compile-check')) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (predicate(absolute)) result.push(absolute);
    }
  };
  visit(directory);
  return result;
}

function textUnder(relativeDirectory, predicate = (file) => /\.(java|json|sql|ts|vue|mjs|yaml|yml|md)$/.test(file)) {
  return filesUnder(relativeDirectory, predicate)
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');
}

test('B9 learner and content services are independent Java 25 domain boundaries', () => {
  for (const service of ['services/learner-service', 'services/content-service']) {
    assert.ok(fs.existsSync(path.join(root, service, 'pom.xml')), `${service} must have an independent Maven build`);
    const pom = fs.readFileSync(path.join(root, service, 'pom.xml'), 'utf8');
    assert.match(pom, /<java\.version>25<\/java\.version>/, `${service} must target Java 25`);
    assert.match(pom, /spring-boot-starter-actuator/, `${service} must expose health/readiness infrastructure`);
    assert.match(pom, /spring-boot-starter-validation/, `${service} must validate service-owned inputs`);
  }
  const learner = textUnder('services/learner-service');
  const content = textUnder('services/content-service');
  assert.match(learner, /profile|档案/i);
  assert.match(learner, /goal|目标/i);
  assert.match(learner, /preference|偏好/i);
  assert.match(learner, /idempot|幂等/i);
  assert.match(learner, /shadow|legacy|只读|旧/i);
  assert.match(content, /draft|草稿/i);
  assert.match(content, /publish|发布/i);
  assert.match(content, /rollback|回滚/i);
  assert.match(content, /copyright|license|版权/i);
  assert.match(content, /outbox|事件/i);
  assert.match(content, /answer.?rule|答案规则/i);
});

test('B9 contracts and migration define versioned public reads without leaking answer rules', () => {
  const contractFiles = filesUnder('packages/contracts/fragments/b9', (file) => file.endsWith('.json'));
  assert.ok(contractFiles.length > 0, 'B9 OpenAPI fragments must exist');
  const contracts = contractFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  for (const marker of ['learner', 'content', 'public', 'version']) assert.match(contracts, new RegExp(marker, 'i'));
  assert.match(contracts, /idempot/i);
  assert.match(contracts, /published|unpublish|draft/i);
  assert.match(contracts, /answer.?rule|答案规则/i);
  assert.match(contracts, /B9ExpectedStateVersion/);
  assert.match(contracts, /security/i);

  const eventFiles = filesUnder('packages/contracts/events/v1/fragments', (file) => /b9-.*\.json$/i.test(file));
  assert.ok(eventFiles.length > 0, 'B9 event fragments must exist');
  const events = eventFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  assert.match(events, /onboarding|content|publication|cache/i);
  assert.match(events, /eventId|traceId|dedupe/i);

  const migration = filesUnder('database/mysql/migrations', (file) => /^V0017__.*\.sql$/i.test(path.basename(file)));
  assert.equal(migration.length, 1, 'B9 must add exactly one V0017 migration');
  const sql = fs.readFileSync(migration[0], 'utf8');
  assert.match(sql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS/i);
  assert.match(sql, /learner|content|projection/i);
  assert.match(sql, /tenant_id/i);
  assert.doesNotMatch(sql, /DROP\s+(DATABASE|SCHEMA|TABLE)|TRUNCATE\s+TABLE/i);
});

test('B9 frontend migration keeps public site read-only and uses shared locale/theme seams', () => {
  const learner = textUnder('apps/learner-web');
  const mobile = textUnder('apps/mobile');
  const admin = textUnder('apps/admin-web');
  const official = textUnder('apps/official-site');
  for (const [name, source] of [['learner-web', learner], ['mobile', mobile]]) {
    assert.match(source, /onboard|goal|target|today|home/i, `${name} must expose the migrated learning entry seam`);
    assert.match(source, /content|course|projection/i, `${name} must read content through the B9 seam`);
    assert.match(source, /uiLocale|contentLocale|locale/i, `${name} must keep UI/content locale context`);
    assert.match(source, /theme|design.?token/i, `${name} must reuse theme tokens`);
  }
  assert.match(admin, /content|publish|review|rollback/i);
  assert.match(admin, /command|mutation|idempot/i);
  const adminAdapter = fs.readFileSync(path.join(root, 'apps/admin-web/src/api/content-service-command-adapter.ts'), 'utf8');
  assert.match(adminAdapter, /\/admin\/content-commands/);
  assert.doesNotMatch(adminAdapter, /\/admin\/content(?:\/|['"])/);
  assert.doesNotMatch(adminAdapter, /\/admin\/reviews/);
  assert.match(official, /public|course|price|download|compliance/i);
  assert.match(official, /public\/site\/projection/);
  assert.doesNotMatch(official, /refreshToken|sessionStorage|localStorage|Authorization\s*:/i);
});
