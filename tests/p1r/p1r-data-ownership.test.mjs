import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  validateDataOwnership,
  validateDataOwnershipData,
  validateGatewaySourceText,
  validateMigrationDirectory,
  validateMigrationSqlText,
  validateOwnerSourceText,
} from '../../scripts/audit/p1r-data-ownership-check.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'config', 'p1r-data-ownership.v1.json'), 'utf8'));
const b25 = JSON.parse(fs.readFileSync(path.join(root, 'config', 'b25-data.json'), 'utf8'));
const redisRegistry = JSON.parse(fs.readFileSync(path.join(root, 'database', 'redis', 'keyspace.registry.json'), 'utf8'));

function fixture() {
  return {
    policy: structuredClone(policy),
    b25: structuredClone(b25),
    redisRegistry: structuredClone(redisRegistry),
  };
}

function assertMutationFails(mutate, expected) {
  const changed = fixture();
  mutate(changed);
  const report = validateDataOwnershipData(changed);
  assert.equal(report.result, 'FAIL', report.errors.join('\n'));
  if (expected) assert(report.errors.some((error) => expected.test(error)), `missing ${expected}; got ${report.errors.join('\n')}`);
}

test('canonical data ownership policy passes static audit and retains D2 runtime boundary', () => {
  const report = validateDataOwnership({ root });
  assert.equal(report.result, 'PASS', report.errors.join('\n'));
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.summary, {
    totalServices: 15,
    dataOwners: 14,
    gatewayWithoutBusinessSchema: 1,
    existingMigrationCollections: 12,
    plannedMigrationCollections: 2,
    b25OwnerCount: 8,
    redisEntryCount: 29,
    redisCoreApiEntryCount: 28,
    redisNamespaceCount: 15,
    m2RuntimeRequirementCount: 8,
    runtimeStatus: 'NOT_RUNTIME_VERIFIED',
  });
});

test('service cardinality and data-owner count fail closed', () => {
  assertMutationFails((changed) => {
    changed.policy.serviceOwners.pop();
    changed.policy.serviceOwners[0].dataOwner = true;
  }, /exactly 15 services|serviceOwners must contain exactly|data owner count must be 14/);
});

test('Gateway cannot acquire a business schema or database write authority', () => {
  assertMutationFails((changed) => {
    const gateway = changed.policy.serviceOwners.find((owner) => owner.service === 'api-gateway');
    gateway.businessSchema = 'gateway_service';
    gateway.databaseCredential.required = true;
    gateway.databaseCredential.reason = 'Gateway may persist domain business facts';
    gateway.writeAuthority = 'gateway-service-only';
  }, /Gateway must not own a business schema|Gateway database credential must not be required|Gateway database credential reason|Gateway must have NO_DOMAIN_WRITE_AUTHORITY/);
});

test('Gateway Redis uses are an exact boundary-state allowlist', () => {
  assertMutationFails((changed) => {
    const gateway = changed.policy.serviceOwners.find((owner) => owner.service === 'api-gateway');
    gateway.redis.allowedUses = ['domain-write', 'cache-business-fact'];
  }, /api-gateway\.redis\.allowedUses/);
});

test('Gateway source scan rejects persistence APIs, write SQL, configuration and custom SQL files', () => {
  const samples = [
    ['src/main/java/UnsafeGateway.java', 'import org.springframework.jdbc.core.JdbcTemplate;'],
    ['src/main/java/UnsafeGateway.java', 'DriverManager.getConnection("jdbc:mysql://127.0.0.1/domain");'],
    ['src/main/resources/application.yaml', 'spring.datasource.url: jdbc:mysql://127.0.0.1/domain'],
    ['src/main/java/UnsafeGateway.java', 'databaseClient.sql("INSERT INTO learner_profile VALUES (1)")'],
    ['src/main/resources/custom/V1__gateway_write.sql', 'SELECT 1;'],
    ['pom.xml', '<artifactId>spring-boot-starter-data-jpa</artifactId>'],
    ['build.gradle', "implementation 'org.springframework.boot:spring-boot-starter-jdbc'"],
    ['build.gradle.kts', "runtimeOnly('com.mysql:mysql-connector-j')"],
  ];
  for (const [relativePath, content] of samples) {
    const errors = validateGatewaySourceText({ relativePath, content });
    assert(errors.length > 0, `${relativePath} should fail closed`);
  }
});

test('owner source scan applies the full migration policy to SQL outside canonical migration directories', () => {
  for (const content of [
    'USE assessment_service;',
    'GRANT SELECT ON learning_service.* TO \'reader\';',
    'CREATE SCHEMA rogue_service;',
    "PREPARE statement FROM 'DROP SCHEMA learning_service'; EXECUTE statement;",
  ]) {
    const errors = validateOwnerSourceText({
      service: 'learning-service',
      relativePath: 'services/learning-service/src/main/resources/bootstrap/unsafe.sql',
      content,
    });
    assert(errors.length > 0, `expected SQL source policy failure for: ${content}`);
  }
});

test('schema, database credential and Redis namespace identities are unique and owner-bound', () => {
  assertMutationFails((changed) => {
    changed.policy.serviceOwners.find((owner) => owner.service === 'content-service').schema.name = 'learner_service';
  }, /schema is duplicated|content-service\.schema\.name must be content_service/);
  assertMutationFails((changed) => {
    changed.policy.serviceOwners.find((owner) => owner.service === 'content-service').databaseCredential.logicalId = 'mysql-runtime-learner-service';
  }, /database credential is duplicated|logicalId must be mysql-runtime-content-service/);
  assertMutationFails((changed) => {
    changed.policy.serviceOwners.find((owner) => owner.service === 'content-service').redis.namespace = 'learner';
  }, /Redis namespace is duplicated|content-service\.redis\.namespace must be content/);
});

test('all owner schema, Flyway and credential claims remain candidate/unverified until M2-004', () => {
  assertMutationFails((changed) => {
    const learner = changed.policy.serviceOwners.find((owner) => owner.service === 'learner-service');
    learner.schema.status = 'RUNTIME_VERIFIED';
    learner.databaseCredential.status = 'PROVISIONED';
    learner.flyway.migrationOwner = 'other-service';
  }, /schema\.status must be EXISTING_CANDIDATE_UNVERIFIED|databaseCredential\.status must be P1R-M2-004_REQUIRED|migrationOwner must be learner-service|promote/);
});

test('migration inventory freezes twelve existing candidates and two planned audit/workflow collections', () => {
  assertMutationFails((changed) => {
    changed.policy.migrationInventory.existingCollections.pop();
    changed.policy.migrationInventory.plannedCollections[0].status = 'READY';
  }, /12 existing candidate|planned migration must remain PLANNED_M2_004|planned migration services/);
});

test('cross-service writes, joins, shared ORM entities and legacy writes remain prohibited', () => {
  assertMutationFails((changed) => {
    changed.policy.globalPolicies.crossServiceTableWrites = 'ALLOWED';
    changed.policy.globalPolicies.crossServiceSqlJoins = 'ALLOWED';
    changed.policy.globalPolicies.sharedOrmEntities = 'ALLOWED';
    changed.policy.globalPolicies.gatewayBusinessWrites = 'ALLOWED';
    changed.policy.globalPolicies.coreApiNewBusinessWrites = 'ALLOWED';
    changed.b25.dataOwnerPolicy.crossServiceWritesAllowed = true;
  }, /crossServiceTableWrites must be PROHIBITED|crossServiceSqlJoins must be PROHIBITED|sharedOrmEntities must be PROHIBITED|gatewayBusinessWrites must be PROHIBITED|coreApiNewBusinessWrites must be PROHIBITED|B25 dataOwnerPolicy\.crossServiceWritesAllowed must be false/);
});

test('B25 is an eight-owner historical candidate and cannot become runtime proof', () => {
  assertMutationFails((changed) => {
    changed.policy.historicalCandidateInputs.b25Data.ownerMap.pop();
    changed.policy.historicalCandidateInputs.b25Data.classification = 'CURRENT_RUNTIME_OWNER_MAP';
    changed.b25.runtimeStatus = 'PASS';
  }, /B25 candidate ownerMapCount must be 8|ownerMap must contain 8 owners|historical candidate migration input|B25 runtimeStatus must remain pending|promote/);
});

test('B25 owner map rejects a cross-owner schema/namespace mapping', () => {
  assertMutationFails((changed) => {
    const owner = changed.b25.dataOwnerPolicy.ownerMap.find((item) => item.service === 'content-service');
    owner.schema = 'learner_service';
    owner.redisNamespace = 'learner';
  }, /B25 data owner mapping is invalid: content-service/);
});

test('historical core-api Redis entries require ten explicit migration mappings and remain non-authoritative', () => {
  assertMutationFails((changed) => {
    changed.policy.historicalCandidateInputs.redisKeyspaceRegistry.legacyOwnerMappings.pop();
    changed.redisRegistry.entries.find((entry) => entry.owner === 'core-api.auth').sourceOfTruth = 'redis';
  }, /legacyOwnerMappings must contain 10 mappings|legacy owner has no migration mapping|durable\/non-Redis source of truth/);
});

test('Redis keyspace cannot promote core-api.* ownership or omit durable rebuild semantics', () => {
  assertMutationFails((changed) => {
    const entry = changed.redisRegistry.entries.find((item) => item.owner === 'core-api.learning');
    entry.owner = 'rogue-service';
    entry.rebuildable = false;
    entry.atomicity.notAuthoritative = false;
  }, /unknown current owner|must be rebuildable|must be non-authoritative/);
});

test('tenant authority and retention policy cannot be client-selected or Redis-TTL-defined', () => {
  assertMutationFails((changed) => {
    changed.policy.globalPolicies.tenant.clientMaySelectTenant = true;
    changed.policy.globalPolicies.tenant.mysqlProvidesAutomaticRowLevelIsolation = true;
    changed.policy.globalPolicies.lifecycle.redisTtlIsNotRetention = false;
    changed.policy.serviceOwners.find((owner) => owner.service === 'learning-service').tenantGuard.clientSuppliedTenantAllowed = true;
  }, /clients must not select tenant|automatic row-level isolation|Redis TTL must not be treated as retention|must reject client-supplied tenant/);
});

test('M2-004 runtime gaps stay open and cannot be represented as PASS/ACCEPTED', () => {
  assertMutationFails((changed) => {
    changed.policy.runtimeStatus = 'RUNTIME_VERIFIED';
    changed.policy.m2RuntimeRequirements[0].status = 'PASS';
    changed.policy.maturity = 'ACCEPTED';
  }, /runtimeStatus must remain NOT_RUNTIME_VERIFIED|must remain D2_CONTRACT_READY|promote/);
});

test('migration and Redis candidate metadata cannot be relabeled as current runtime evidence', () => {
  assertMutationFails((changed) => {
    changed.policy.migrationInventory.candidateOnly = false;
    changed.policy.migrationInventory.classification = 'RUNTIME_VERIFIED';
    changed.policy.historicalCandidateInputs.redisKeyspaceRegistry.disposition = 'current owner evidence';
  }, /historical candidate input|candidateOnly must be true|historical owner promotion/);
});

test('nested B25 and Redis candidate metadata cannot promote static inputs to runtime PASS', () => {
  assertMutationFails((changed) => {
    changed.b25.runtime = { status: 'PASS' };
    changed.b25.task.status = 'ACCEPTED';
    changed.b25.migration.runtimeStatus = 'RUNTIME_VERIFIED';
    changed.b25.fixture.runtimeStatus = 'PASS';
    changed.redisRegistry.globalRules.status = 'RUNTIME_VERIFIED';
    changed.redisRegistry.entries[0].status = 'PASS';
  }, /\.b25\.|\.redis\.|attempts to promote/);
});

test('unknown runtime-proof fields and aliased promoted states fail closed', () => {
  const mutations = [
    (changed) => { changed.policy.runtimeProof = 'PASS'; },
    (changed) => { changed.b25.runtimeVerified = true; },
    (changed) => { changed.redisRegistry.entries[0].verification = { state: 'PASS' }; },
    (changed) => { changed.policy.verificationState = 'PASS'; },
    (changed) => { changed.b25.proof = true; },
    (changed) => { changed.policy.attestation = 'PASS'; },
    (changed) => { changed.policy.currentStatus = 'PASS'; },
    (changed) => { changed.policy.live = true; },
    (changed) => { changed.b25.deployed = 'PASS'; },
    (changed) => { changed.redisRegistry.operationalStatus = 'PASS'; },
    (changed) => { changed.redisRegistry.certified = true; },
  ];
  for (const mutate of mutations) {
    assertMutationFails(mutate, /document shape drifted|unknown runtime-proof field|attempts to promote/);
  }
});

test('candidate document shape freezes every array item field and value type', () => {
  assertMutationFails((changed) => {
    delete changed.redisRegistry.entries[0].security;
  }, /document shape drifted/);
  assertMutationFails((changed) => {
    changed.redisRegistry.entries[0].keyPattern = 42;
  }, /document shape drifted/);
});

test('governance prose fields cannot be replaced by keyword-containing negations', () => {
  assertMutationFails((changed) => {
    changed.policy.globalPolicies.tenant.phase3SharedSchemaRequirement = 'tenant_id has no unique index';
    changed.policy.serviceOwners[0].prohibitions.push('domain-write-is-allowed');
    changed.policy.historicalCandidateInputs.b25Data.disposition = 'migration input can become runtime proof';
    changed.policy.historicalCandidateInputs.redisKeyspaceRegistry.disposition = 'historical core-api migration input is now runtime proof';
    changed.policy.m2RuntimeRequirements[0].requirement = 'Schema grants are already complete and need no runtime proof.';
  }, /shared-schema tenant_id|api-gateway\.prohibitions|frozen candidate boundary|frozen runtime gap/);
});

test('owner lifecycle and forward-repair responsibilities remain complete', () => {
  assertMutationFails((changed) => {
    const owner = changed.policy.serviceOwners.find((item) => item.service === 'assessment-service');
    owner.lifecycle.legalHold = 'skip';
    owner.migrationResponsibility.forwardRepair = 'workflow-service';
    owner.migrationResponsibility.destructiveDownMigration = 'ALLOWED';
  }, /legalHold must be owner-checks-before-delete|forwardRepair must be assessment-service|destructive down migration must be PROHIBITED/);
});

test('owner lifecycle rejects keyword-containing negations and non-canonical recovery text', () => {
  assertMutationFails((changed) => {
    const owner = changed.policy.serviceOwners.find((item) => item.service === 'assessment-service');
    owner.lifecycle.dataClass = 'NOT_ASSESSMENT_DATA';
    owner.lifecycle.policyClass = 'NO_RETENTION_POLICY';
    owner.lifecycle.policyOwner = 'workflow-service';
    owner.lifecycle.deleteOrAnonymize = 'owner must not execute deletion';
    owner.lifecycle.legalHold = 'owner does not check legal hold';
    owner.lifecycle.receipt = 'not audit receipt';
    owner.migrationResponsibility.rollback = 'destructive rollback is allowed';
  }, /must match the frozen owner classification|must match the frozen retention policy class|must match the frozen policy owner|must match the frozen owner action|must be owner-checks-before-delete|must match the frozen workflow\/audit destination|must match the frozen owner recovery action/);
});

test('migration SQL scan rejects owner switching, grant changes and foreign service schemas', () => {
  const errors = validateMigrationSqlText({
    service: 'learning-service',
    filename: 'V99__unsafe_cross_owner.sql',
    sql: `
      USE learner_service;
      GRANT SELECT ON learner_service.* TO 'learning';
      INSERT INTO assessment_service.attempt_projection (attempt_id) VALUES ('synthetic-attempt');
    `,
  });
  assert(errors.some((error) => /USE is forbidden/.test(error)), errors.join('\n'));
  assert(errors.some((error) => /GRANT\/REVOKE is forbidden/.test(error)), errors.join('\n'));
  assert(errors.some((error) => /cross-service schema reference is forbidden: learner_service/.test(error)), errors.join('\n'));
  assert(errors.some((error) => /cross-service schema reference is forbidden: assessment_service/.test(error)), errors.join('\n'));
});

test('migration SQL scan ignores policy keywords inside comments and string literals', () => {
  const errors = validateMigrationSqlText({
    service: 'content-service',
    filename: 'V99__safe_learning_copy.sql',
    sql: `
      -- USE learner_service; GRANT SELECT ON learner_service.* TO 'reader';
      /* DROP SCHEMA assessment_service; */
      INSERT INTO learning_example (copy_en, copy_zh)
      VALUES ('Use content_service.lesson to build a habit', "GRANT is vocabulary, not a statement");
    `,
  });
  assert.deepEqual(errors, []);
});

test('migration SQL scan treats MySQL executable comments as executable policy input', () => {
  const errors = validateMigrationSqlText({
    service: 'learning-service',
    filename: 'V99__unsafe_version_comments.sql',
    sql: `
      /*!50000 USE learner_service */;
      /*!50000 GRANT SELECT ON learner_service.* TO 'learning' */;
      /*!50000 INSERT INTO assessment_service.attempt_projection (attempt_id) VALUES ('synthetic-attempt') */;
    `,
  });
  assert(errors.some((error) => /USE is forbidden/.test(error)), errors.join('\n'));
  assert(errors.some((error) => /GRANT\/REVOKE is forbidden/.test(error)), errors.join('\n'));
  assert(errors.some((error) => /cross-service schema reference is forbidden: learner_service/.test(error)), errors.join('\n'));
  assert(errors.some((error) => /cross-service schema reference is forbidden: assessment_service/.test(error)), errors.join('\n'));
});

test('migration SQL scan rejects USE immediately followed by quoted identifiers', () => {
  for (const sql of ['USE`learner_service`;', 'USE"learner_service";']) {
    const errors = validateMigrationSqlText({
      service: 'learning-service',
      filename: 'V99__unsafe_compact_use.sql',
      sql,
    });
    assert(errors.some((error) => /USE is forbidden/.test(error)), errors.join('\n'));
  }
});

test('migration SQL scan rejects dynamic SQL that could hide owner switching or cross-service writes', () => {
  for (const sql of [
    "SET @statement = 'INSERT INTO assessment_service.attempts(id) VALUES (1)'; PREPARE stmt FROM @statement; EXECUTE stmt;",
    "PREPARE stmt FROM 'USE learner_service'; EXECUTE stmt;",
    "SET @statement = 'GRANT SELECT ON learner_service.* TO ''reader'''; PREPARE stmt FROM @statement; EXECUTE stmt;",
    "EXECUTE IMMEDIATE 'DROP SCHEMA learner_service';",
  ]) {
    const errors = validateMigrationSqlText({
      service: 'learning-service',
      filename: 'V99__unsafe_dynamic_sql.sql',
      sql,
    });
    assert(errors.some((error) => /dynamic SQL PREPARE\/EXECUTE is forbidden/.test(error)), errors.join('\n'));
  }
  const knownFilenameMutation = validateMigrationSqlText({
    service: 'iam-service',
    filename: 'V4__preserve_iam_consent_history.sql',
    sql: "PREPARE stmt FROM 'USE learner_service'; EXECUTE stmt;",
  });
  assert(knownFilenameMutation.some((error) => /reviewed digest/.test(error)), knownFilenameMutation.join('\n'));
});

test('migration SQL scan follows MySQL dash-comment whitespace rules', () => {
  for (const sql of [
    'SELECT 1--1; INSERT INTO assessment_service.attempts(id) VALUES (1);',
    'SELECT 1--x; INSERT INTO assessment_service.attempts(id) VALUES (1);',
    'SELECT 1--+1; INSERT INTO assessment_service.attempts(id) VALUES (1);',
  ]) {
    const errors = validateMigrationSqlText({
      service: 'learning-service',
      filename: 'V99__unsafe_false_dash_comment.sql',
      sql,
    });
    assert(errors.some((error) => /cross-service schema reference is forbidden: assessment_service/.test(error)), errors.join('\n'));
  }
});

test('migration SQL scan treats comment markers inside backtick identifiers as identifier content', () => {
  for (const sql of [
    'CREATE TABLE `foo-- hidden` (id INT); INSERT INTO assessment_service.attempts(id) VALUES (1);',
    'CREATE TABLE `foo# hidden` (id INT); INSERT INTO assessment_service.attempts(id) VALUES (1);',
    'CREATE TABLE `foo``-- hidden` (id INT); INSERT INTO assessment_service.attempts(id) VALUES (1);',
  ]) {
    const errors = validateMigrationSqlText({
      service: 'learning-service',
      filename: 'V99__unsafe_backtick_comment_marker.sql',
      sql,
    });
    assert(errors.some((error) => /cross-service schema reference is forbidden: assessment_service/.test(error)), errors.join('\n'));
  }
});

test('migration SQL scan fails closed across NO_BACKSLASH_ESCAPES string semantics', () => {
  const errors = validateMigrationSqlText({
    service: 'learning-service',
    filename: 'V99__unsafe_sql_mode_escape.sql',
    sql: "SELECT 'safe\\'; INSERT INTO assessment_service.attempts(id) VALUES (1); -- ';",
  });
  assert(errors.some((error) => /cross-service schema reference is forbidden: assessment_service/.test(error)), errors.join('\n'));
});

test('migration SQL scan fails closed across default MySQL backslash-escaped strings', () => {
  for (const sql of [
    "SELECT 'foo\\'bar'; INSERT INTO assessment_service.attempts(id) VALUES (1);",
    'SELECT "foo\\"bar"; INSERT INTO assessment_service.attempts(id) VALUES (1);',
  ]) {
    const errors = validateMigrationSqlText({
      service: 'learning-service',
      filename: 'V99__unsafe_default_escape.sql',
      sql,
    });
    assert(errors.some((error) => /cross-service schema reference is forbidden: assessment_service/.test(error)), errors.join('\n'));
  }
});

test('migration SQL scan rejects ANSI_QUOTES cross-service schema identifiers', () => {
  for (const sql of [
    'INSERT INTO "assessment_service".attempt_projection (attempt_id) VALUES (\'synthetic-attempt\');',
    'INSERT INTO "assessment_service"/* comment */.attempt_projection (attempt_id) VALUES (\'synthetic-attempt\');',
    'INSERT INTO "assessment_service" /* comment */ . attempt_projection (attempt_id) VALUES (\'synthetic-attempt\');',
  ]) {
    const errors = validateMigrationSqlText({
      service: 'learning-service',
      filename: 'V99__unsafe_ansi_quotes.sql',
      sql,
    });
    assert(errors.some((error) => /cross-service schema reference is forbidden: assessment_service/.test(error)), errors.join('\n'));
  }
});

test('migration directory audit recursively discovers and rejects nested unsafe Flyway SQL', () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'p1r-migration-audit-'));
  try {
    const nested = path.join(temporaryRoot, 'nested');
    fs.mkdirSync(nested);
    fs.writeFileSync(path.join(nested, 'V99__unsafe_nested.sql'), 'INSERT INTO assessment_service.attempts(id) VALUES (1);');
    const errors = validateMigrationDirectory({
      service: 'learning-service',
      directory: temporaryRoot,
      declaredFileCount: 1,
    });
    assert(errors.some((error) => /nested\/V99__unsafe_nested\.sql.*cross-service schema reference is forbidden: assessment_service/.test(error)), errors.join('\n'));
  } finally {
    assert(path.resolve(temporaryRoot).startsWith(path.resolve(os.tmpdir())), 'temporary migration root must stay inside the system temp directory');
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
