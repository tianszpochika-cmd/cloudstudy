import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_INPUT = path.join('config', 'p1r-data-ownership.v1.json');
export const DEFAULT_B25_INPUT = path.join('config', 'b25-data.json');
export const DEFAULT_REDIS_INPUT = path.join('database', 'redis', 'keyspace.registry.json');

export const EXPECTED_SERVICES = Object.freeze([
  'api-gateway',
  'iam-service',
  'audit-service',
  'workflow-service',
  'learner-service',
  'content-service',
  'learning-service',
  'assessment-service',
  'media-service',
  'gamification-service',
  'social-service',
  'commerce-service',
  'notification-service',
  'analytics-service',
  'admin-ops-service',
]);

export const EXPECTED_DATA_OWNERS = Object.freeze(EXPECTED_SERVICES.filter((service) => service !== 'api-gateway'));
export const EXPECTED_EXISTING_MIGRATION_SERVICES = Object.freeze([
  'iam-service',
  'learner-service',
  'content-service',
  'learning-service',
  'assessment-service',
  'media-service',
  'gamification-service',
  'social-service',
  'commerce-service',
  'notification-service',
  'analytics-service',
  'admin-ops-service',
]);
export const EXPECTED_PLANNED_MIGRATION_SERVICES = Object.freeze(['audit-service', 'workflow-service']);

export const EXPECTED_B25_OWNERS = Object.freeze([
  { service: 'workflow-service', schema: 'workflow_service', redisNamespace: 'workflow' },
  { service: 'learner-service', schema: 'learner_service', redisNamespace: 'learner' },
  { service: 'content-service', schema: 'content_service', redisNamespace: 'content' },
  { service: 'learning-service', schema: 'learning_service', redisNamespace: 'learning' },
  { service: 'assessment-service', schema: 'assessment_service', redisNamespace: 'assessment' },
  { service: 'media-service', schema: 'media_service', redisNamespace: 'media' },
  { service: 'commerce-service', schema: 'commerce_service', redisNamespace: 'commerce' },
  { service: 'notification-service', schema: 'notification_service', redisNamespace: 'notification' },
]);

export const EXPECTED_CORE_API_REDIS_MAPPINGS = Object.freeze([
  { legacyOwner: 'core-api.auth', targetOwner: 'iam-service' },
  { legacyOwner: 'core-api.learning', targetOwner: 'learning-service' },
  { legacyOwner: 'core-api.assessment', targetOwner: 'assessment-service' },
  { legacyOwner: 'core-api.social', targetOwner: 'social-service' },
  { legacyOwner: 'core-api.commerce', targetOwner: 'commerce-service' },
  { legacyOwner: 'core-api.ops', targetOwner: 'admin-ops-service' },
  { legacyOwner: 'core-api.risk', targetOwner: 'admin-ops-service' },
  { legacyOwner: 'core-api.common', targetOwner: 'route-owning-domain-service' },
  { legacyOwner: 'core-api.event-consumer', targetOwner: 'consumer-owning-domain-service' },
  { legacyOwner: 'core-api.sync', targetOwner: 'per-domain-service' },
]);

export const EXPECTED_M2_RUNTIME_REQUIREMENTS = Object.freeze([
  'M2-004-OWNER-SCHEMA-GRANTS',
  'M2-004-FLYWAY-EMPTY-AND-EXISTING',
  'M2-004-TENANT-GUARD',
  'M2-004-CROSS-OWNER-DENY',
  'M2-004-REDIS-NAMESPACE-ACL',
  'M2-004-REDIS-REBUILD',
  'M2-004-ROLLBACK-COMPENSATION',
  'M2-004-RETENTION-DELETE-HOLD',
]);

const PROMOTED_STATES = new Set(['PASS', 'PASSED', 'ACCEPTED', 'VERIFIED', 'RUNTIME_VERIFIED', 'COMPLETE', 'CLOSED']);
const SOURCE_SCAN_EXTENSIONS = new Set(['.java', '.kt', '.sql', '.xml', '.yml', '.yaml', '.properties']);
const FORBIDDEN_GATEWAY_PERSISTENCE_MARKERS = [
  'spring-boot-starter-data-jpa',
  'spring-boot-starter-jdbc',
  'spring-jdbc',
  'flyway-core',
  'liquibase-core',
  'mysql-connector',
  'r2dbc-mysql',
];

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function add(errors, condition, message) {
  if (!condition) errors.push(message);
}

function exactSet(actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  const expectedSet = new Set(expected);
  return new Set(actual).size === expectedSet.size && actual.every((item) => expectedSet.has(item));
}

function serviceSchemaName(service) {
  return service.replaceAll('-', '_');
}

function serviceRedisNamespace(service) {
  return service === 'api-gateway' ? 'gateway' : service.replace(/-service$/u, '');
}

function normalizeSqlForPolicyScan(sql) {
  const source = String(sql ?? '');
  let normalized = '';
  let mode = 'NORMAL';
  let quote = '';

  const blank = (character) => (character === '\n' || character === '\r' ? character : ' ');
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (mode === 'LINE_COMMENT') {
      normalized += blank(character);
      if (character === '\n' || character === '\r') mode = 'NORMAL';
      continue;
    }
    if (mode === 'BLOCK_COMMENT') {
      normalized += blank(character);
      if (character === '*' && next === '/') {
        normalized += ' ';
        index += 1;
        mode = 'NORMAL';
      }
      continue;
    }
    if (mode === 'STRING') {
      normalized += blank(character);
      if (character === '\\' && next !== undefined) {
        normalized += blank(next);
        index += 1;
        continue;
      }
      if (character === quote && next === quote) {
        normalized += ' ';
        index += 1;
        continue;
      }
      if (character === quote) mode = 'NORMAL';
      continue;
    }

    if (character === '-' && next === '-') {
      normalized += '  ';
      index += 1;
      mode = 'LINE_COMMENT';
      continue;
    }
    if (character === '#') {
      normalized += ' ';
      mode = 'LINE_COMMENT';
      continue;
    }
    if (character === '/' && next === '*') {
      normalized += '  ';
      index += 1;
      mode = 'BLOCK_COMMENT';
      continue;
    }
    if (character === "'" || character === '"') {
      normalized += ' ';
      mode = 'STRING';
      quote = character;
      continue;
    }
    normalized += character;
  }
  return normalized;
}

function foreignSchemaReferences(text, expectedSchema) {
  const references = new Set();
  const pattern = /`?([a-z][a-z0-9_]*(?:_service)|core_api)`?\s*\./giu;
  for (const match of String(text ?? '').matchAll(pattern)) {
    const schema = match[1].toLowerCase();
    if (schema !== expectedSchema.toLowerCase()) references.add(schema);
  }
  return [...references].sort();
}

export function validateMigrationSqlText({ service, filename = '<memory>', sql } = {}) {
  const errors = [];
  if (!nonEmpty(service)) errors.push(`${filename}: migration service is required`);
  if (typeof sql !== 'string') errors.push(`${filename}: migration SQL must be a string`);
  if (errors.length > 0) return errors;
  const normalized = normalizeSqlForPolicyScan(sql);
  const forbidden = [
    [/\bUSE\s+`?[a-z0-9_]+`?/iu, 'USE is forbidden; Flyway must receive the owner schema through its service-scoped connection'],
    [/\b(?:GRANT|REVOKE)\b/iu, 'GRANT/REVOKE is forbidden in service migrations; owner grants are provisioned and verified by P1R-M2-004'],
    [/\b(?:CREATE|DROP)\s+(?:DATABASE|SCHEMA)\b/iu, 'CREATE/DROP DATABASE or SCHEMA is forbidden in service migrations'],
  ];
  for (const [pattern, message] of forbidden) {
    if (pattern.test(normalized)) errors.push(`${service}/${filename}: ${message}`);
  }
  const expectedSchema = serviceSchemaName(service);
  for (const foreignSchema of foreignSchemaReferences(normalized, expectedSchema)) {
    errors.push(`${service}/${filename}: cross-service schema reference is forbidden: ${foreignSchema}`);
  }
  return errors;
}

function expectedRole(service) {
  return ['iam-service', 'audit-service', 'workflow-service'].includes(service)
    ? 'PLATFORM_DATA_OWNER'
    : 'DOMAIN_DATA_OWNER';
}

function expectedSchemaStatus(service) {
  return EXPECTED_PLANNED_MIGRATION_SERVICES.includes(service)
    ? 'PLANNED_M2_004'
    : 'EXISTING_CANDIDATE_UNVERIFIED';
}

function expectedCredentialStatus(service) {
  return expectedSchemaStatus(service) === 'PLANNED_M2_004' ? 'PLANNED_M2_004' : 'P1R-M2-004_REQUIRED';
}

function expectedFlywayCollectionStatus(service) {
  return expectedSchemaStatus(service);
}

function expectedFlywayLocation(service) {
  return `services/${service}/src/main/resources/db/migration`;
}

function expectedMysqlCredential(service) {
  return `mysql-runtime-${service}`;
}

function expectedRedisCredential(service) {
  return `redis-runtime-${service}`;
}

function assertExpectedSet(errors, actual, expected, label) {
  add(errors, exactSet(actual, expected), `${label} must contain exactly ${expected.length} unique entries: ${expected.join(', ')}`);
}

function assertString(errors, value, label) {
  add(errors, nonEmpty(value), `${label} must be a non-empty string`);
}

function checkHeader(policy, errors) {
  add(errors, isRecord(policy), 'data ownership policy must be a JSON object');
  if (!isRecord(policy)) return;
  add(errors, policy.$schema === 'p1r.data-ownership.v1', 'data ownership policy has an unsupported $schema');
  add(errors, policy.schemaVersion === 'p1r.data-ownership.v1', 'data ownership policy schemaVersion must be p1r.data-ownership.v1');
  add(errors, policy.taskId === 'P1R-M1-005', 'data ownership policy taskId must be P1R-M1-005');
  add(errors, policy.phase === 'PHASE_1', 'data ownership policy phase must be PHASE_1');
  add(errors, policy.maturity === 'D2_CONTRACT_READY', 'data ownership policy must remain D2_CONTRACT_READY');
  add(errors, policy.runtimeStatus === 'NOT_RUNTIME_VERIFIED', 'data ownership policy runtimeStatus must remain NOT_RUNTIME_VERIFIED');
  add(errors, policy.sourceOfTruth === DEFAULT_INPUT.replaceAll('\\', '/'), 'data ownership sourceOfTruth must be the canonical P1R policy path');
  const requiredSourceRefs = [
    'requirements/backlog/v2-phase1-rebaseline/execution/P1R-M1-005.md',
    'docs/02-architecture/v2-microservices-architecture.md#4.1',
    'docs/02-architecture/v2-microservices-architecture.md#4.2',
    'docs/02-architecture/v2-microservices-architecture.md#4.3',
    'docs/10-decisions/0010-java25-microservices-gateway-iam.md#4',
  ];
  add(errors, Array.isArray(policy.sourceRefs) && requiredSourceRefs.every((ref) => policy.sourceRefs.includes(ref)), 'data ownership sourceRefs must cover the M1-005 policy and architecture anchors');

  const coverage = policy.coverage;
  add(errors, coverage?.totalServices === 15, 'coverage.totalServices must be 15');
  add(errors, coverage?.dataOwners === 14, 'coverage.dataOwners must be 14');
  add(errors, coverage?.gatewayWithoutBusinessSchema === 1, 'coverage.gatewayWithoutBusinessSchema must be 1');
  add(errors, coverage?.existingMigrationCollections === 12, 'coverage.existingMigrationCollections must be 12');
  add(errors, coverage?.plannedMigrationCollections === 2, 'coverage.plannedMigrationCollections must be 2');

  const claims = policy.prohibitedClaims;
  const requiredClaims = [
    'existing migration directory proves runtime schema isolation',
    'logical credential identifier is a provisioned credential',
    'Redis key TTL is a legal retention policy',
    'historical B25 or core-api Redis ownership is a current target owner',
    'D2 owner policy is a P1R-M2-004 runtime PASS',
  ];
  assertExpectedSet(errors, claims, requiredClaims, 'prohibitedClaims');
}

function checkGlobalPolicies(policy, errors) {
  const global = policy.globalPolicies;
  add(errors, isRecord(global), 'globalPolicies must be an object');
  if (!isRecord(global)) return;

  for (const key of [
    'oneSchemaOneServiceOwner',
    'serviceScopedDatabaseCredentialsRequired',
    'perServiceFlywayRequired',
    'perServiceRedisNamespaceRequired',
    'redisIsNeverBusinessSourceOfTruth',
  ]) add(errors, global[key] === true, `globalPolicies.${key} must be true`);
  for (const key of [
    'crossServiceTableWrites',
    'crossServiceSqlJoins',
    'sharedOrmEntities',
    'gatewayBusinessWrites',
    'coreApiNewBusinessWrites',
  ]) add(errors, global[key] === 'PROHIBITED', `globalPolicies.${key} must be PROHIBITED`);
  add(errors, global.destructiveDownMigrations === 'PROHIBITED_BY_DEFAULT', 'destructive down migrations must be PROHIBITED_BY_DEFAULT');

  const tenant = global.tenant;
  add(errors, tenant?.phase1Tenant === 'platform', 'Phase 1 tenant must be the server-derived platform tenant');
  add(errors, tenant?.clientMaySelectTenant === false, 'clients must not select tenant');
  add(errors, tenant?.authority === 'verified IAM principal and service-derived TenantScope', 'tenant authority must be a verified IAM principal and service-derived TenantScope');
  add(errors, /tenant_id.*unique.*index/i.test(tenant?.phase3SharedSchemaRequirement ?? ''), 'Phase 3 shared-schema tenant_id and scoped-index rule is required');
  add(errors, tenant?.mysqlProvidesAutomaticRowLevelIsolation === false, 'policy must not claim MySQL automatic row-level isolation');
  add(errors, tenant?.runtimeVerificationTask === 'P1R-M2-004', 'tenant runtime verification must remain assigned to P1R-M2-004');

  const lifecycle = global.lifecycle;
  add(errors, lifecycle?.exactRetentionDurationsFrozen === false, 'exact retention durations must remain unfrozen');
  add(errors, lifecycle?.exactDurationPolicyRef === 'P1R-M1-017', 'exact retention policy must remain owned by P1R-M1-017');
  add(errors, lifecycle?.redisTtlIsNotRetention === true, 'Redis TTL must not be treated as retention');
  add(errors, lifecycle?.ownerMustExecuteDeleteOrAnonymize === true, 'data owner must execute delete or anonymization');
  add(errors, lifecycle?.ownerMustCheckLegalHoldBeforeDeletion === true, 'data owner must check legal hold before deletion');
  add(errors, lifecycle?.ownerMustReturnReceiptToWorkflowAndAudit === true, 'data owner must return deletion receipt to workflow and audit');

  const migration = global.migration;
  add(errors, migration?.strategy === 'EXPAND_CONTRACT_FORWARD_REPAIR_COMPENSATE', 'migration strategy must be expand/contract, forward repair and compensation');
  add(errors, migration?.forwardOnly === true, 'migrations must be forward-only');
  for (const key of ['ownerGrantAndSchemaVerification', 'emptyAndExistingDatabaseVerification', 'rollbackAndCompensationRuntimeVerification']) {
    add(errors, migration?.[key] === 'P1R-M2-004', `globalPolicies.migration.${key} must remain assigned to P1R-M2-004`);
  }
}

function checkOwnerLifecycle(owner, errors) {
  const service = owner.service;
  const lifecycle = owner.lifecycle;
  add(errors, isRecord(lifecycle), `${service}.lifecycle is required`);
  if (isRecord(lifecycle)) {
    for (const key of ['dataClass', 'policyClass', 'policyOwner', 'laterExactPolicyRef', 'deleteOrAnonymize', 'legalHold', 'receipt']) assertString(errors, lifecycle[key], `${service}.lifecycle.${key}`);
    add(errors, lifecycle.exactDurationFrozen === false, `${service}.lifecycle.exactDurationFrozen must remain false`);
    add(errors, lifecycle.laterExactPolicyRef === 'P1R-M1-017', `${service}.lifecycle must defer exact duration to P1R-M1-017`);
    add(errors, /owner/i.test(lifecycle.deleteOrAnonymize ?? ''), `${service}.lifecycle.deleteOrAnonymize must be owner-executed`);
    add(errors, /owner.*check/i.test(lifecycle.legalHold ?? ''), `${service}.lifecycle.legalHold must be checked by the owner`);
    add(errors, /workflow|audit/i.test(lifecycle.receipt ?? ''), `${service}.lifecycle.receipt must name workflow or audit`);
  }
}

function checkOwnerMigration(owner, errors) {
  const service = owner.service;
  const migration = owner.migrationResponsibility;
  add(errors, isRecord(migration), `${service}.migrationResponsibility is required`);
  if (!isRecord(migration)) return;
  add(errors, migration.forwardRepair === service, `${service}.migrationResponsibility.forwardRepair must be ${service}`);
  assertString(errors, migration.rollback, `${service}.migrationResponsibility.rollback`);
  add(errors, migration.destructiveDownMigration === 'PROHIBITED', `${service} destructive down migration must be PROHIBITED`);
  add(errors, migration.runtimeVerificationTask === 'P1R-M2-004', `${service} runtime migration verification must remain assigned to P1R-M2-004`);
}

function checkDataOwner(owner, errors, indexes) {
  const service = owner.service;
  add(errors, owner.dataOwner === true, `${service} must be a data owner`);
  add(errors, owner.role === expectedRole(service), `${service}.role is invalid`);

  const schema = owner.schema;
  add(errors, isRecord(schema), `${service}.schema is required`);
  if (isRecord(schema)) {
    const expectedName = serviceSchemaName(service);
    assertString(errors, schema.name, `${service}.schema.name`);
    add(errors, schema.name === expectedName, `${service}.schema.name must be ${expectedName}`);
    add(errors, schema.uniqueOwner === service, `${service}.schema.uniqueOwner must be ${service}`);
    add(errors, !indexes.schemas.has(schema.name), `schema is duplicated: ${schema.name}`);
    if (nonEmpty(schema.name)) indexes.schemas.add(schema.name);
    add(errors, schema.status === expectedSchemaStatus(service), `${service}.schema.status must be ${expectedSchemaStatus(service)}`);
  }

  const credential = owner.databaseCredential;
  add(errors, isRecord(credential), `${service}.databaseCredential is required`);
  if (isRecord(credential)) {
    const expectedId = expectedMysqlCredential(service);
    add(errors, credential.logicalId === expectedId, `${service}.databaseCredential.logicalId must be ${expectedId}`);
    add(errors, credential.secretMaterialInRepository === false, `${service}.databaseCredential must not contain repository secret material`);
    add(errors, credential.status === expectedCredentialStatus(service), `${service}.databaseCredential.status must be ${expectedCredentialStatus(service)}`);
    add(errors, !indexes.credentials.has(credential.logicalId), `database credential is duplicated: ${credential.logicalId}`);
    if (nonEmpty(credential.logicalId)) indexes.credentials.add(credential.logicalId);
  }

  const flyway = owner.flyway;
  add(errors, isRecord(flyway), `${service}.flyway is required`);
  if (isRecord(flyway)) {
    const expectedLocation = expectedFlywayLocation(service);
    add(errors, flyway.location === expectedLocation, `${service}.flyway.location must be ${expectedLocation}`);
    add(errors, flyway.collectionStatus === expectedFlywayCollectionStatus(service), `${service}.flyway.collectionStatus must be ${expectedFlywayCollectionStatus(service)}`);
    add(errors, flyway.migrationOwner === service, `${service}.flyway.migrationOwner must be ${service}`);
  }

  const redis = owner.redis;
  add(errors, isRecord(redis), `${service}.redis is required`);
  if (isRecord(redis)) {
    const expectedNamespace = serviceRedisNamespace(service);
    const expectedId = expectedRedisCredential(service);
    assertString(errors, redis.namespace, `${service}.redis.namespace`);
    add(errors, redis.namespace === expectedNamespace, `${service}.redis.namespace must be ${expectedNamespace}`);
    add(errors, redis.logicalCredentialId === expectedId, `${service}.redis.logicalCredentialId must be ${expectedId}`);
    add(errors, redis.businessSourceOfTruth === false, `${service} Redis must not be a business source of truth`);
    add(errors, redis.runtimeStatus === 'P1R-M2-004_REQUIRED', `${service} Redis runtime status must remain P1R-M2-004_REQUIRED`);
    add(errors, !indexes.redisNamespaces.has(redis.namespace), `Redis namespace is duplicated: ${redis.namespace}`);
    if (nonEmpty(redis.namespace)) indexes.redisNamespaces.add(redis.namespace);
    add(errors, !indexes.redisCredentials.has(redis.logicalCredentialId), `Redis credential is duplicated: ${redis.logicalCredentialId}`);
    if (nonEmpty(redis.logicalCredentialId)) indexes.redisCredentials.add(redis.logicalCredentialId);
  }

  const tenantGuard = owner.tenantGuard;
  add(errors, isRecord(tenantGuard), `${service}.tenantGuard is required`);
  if (isRecord(tenantGuard)) {
    add(errors, tenantGuard.authority === 'server-derived platform tenant and TenantScope', `${service}.tenantGuard must use server-derived TenantScope`);
    add(errors, tenantGuard.clientSuppliedTenantAllowed === false, `${service}.tenantGuard must reject client-supplied tenant`);
    add(errors, tenantGuard.phase3TenantIdAndScopedIndexesRequired === true, `${service}.tenantGuard must require phase3 tenant_id and scoped indexes`);
    add(errors, tenantGuard.runtimeStatus === 'P1R-M2-004_REQUIRED', `${service}.tenantGuard runtime status must remain P1R-M2-004_REQUIRED`);
  }
  checkOwnerLifecycle(owner, errors);
  checkOwnerMigration(owner, errors);
}

function checkGatewayOwner(owner, errors, indexes) {
  add(errors, owner.dataOwner === false, 'Gateway must not be a data owner');
  add(errors, owner.role === 'EDGE_BOUNDARY', 'Gateway role must be EDGE_BOUNDARY');
  add(errors, owner.businessSchema === null, 'Gateway must not own a business schema');
  add(errors, owner.businessSchemaStatus === 'NOT_APPLICABLE', 'Gateway business schema status must be NOT_APPLICABLE');
  add(errors, owner.writeAuthority === 'NO_DOMAIN_WRITE_AUTHORITY', 'Gateway must have NO_DOMAIN_WRITE_AUTHORITY');
  add(errors, Array.isArray(owner.prohibitions) && ['domain-table-write', 'domain-schema-ownership', 'client-role-or-tenant-authority'].every((item) => owner.prohibitions.includes(item)), 'Gateway prohibitions must deny domain table/schema writes and client authority');
  add(errors, owner.runtimeVerificationTask === 'P1R-M2-004', 'Gateway data boundary runtime verification must remain assigned to P1R-M2-004');

  const credential = owner.databaseCredential;
  add(errors, isRecord(credential) && credential.required === false, 'Gateway database credential must not be required');
  add(errors, !credential?.logicalId, 'Gateway must not declare a database credential identifier');
  const flyway = owner.flyway;
  add(errors, isRecord(flyway) && flyway.required === false && flyway.location === null && flyway.status === 'NOT_APPLICABLE', 'Gateway Flyway/business schema must be NOT_APPLICABLE');

  const redis = owner.redis;
  add(errors, isRecord(redis), 'Gateway Redis boundary is required');
  if (isRecord(redis)) {
    add(errors, redis.namespace === 'gateway', 'Gateway Redis namespace must be gateway');
    add(errors, redis.logicalCredentialId === 'redis-runtime-gateway', 'Gateway Redis credential must be redis-runtime-gateway');
    add(errors, redis.businessSourceOfTruth === false, 'Gateway Redis must not be a business source of truth');
    add(errors, redis.runtimeStatus === 'P1R-M2-004_REQUIRED', 'Gateway Redis runtime status must remain P1R-M2-004_REQUIRED');
    add(errors, !indexes.redisNamespaces.has(redis.namespace), `Redis namespace is duplicated: ${redis.namespace}`);
    if (nonEmpty(redis.namespace)) indexes.redisNamespaces.add(redis.namespace);
    add(errors, !indexes.redisCredentials.has(redis.logicalCredentialId), `Redis credential is duplicated: ${redis.logicalCredentialId}`);
    if (nonEmpty(redis.logicalCredentialId)) indexes.redisCredentials.add(redis.logicalCredentialId);
  }
}

function checkServiceOwners(policy, errors) {
  const owners = policy.serviceOwners;
  add(errors, Array.isArray(owners), 'serviceOwners must be an array');
  if (!Array.isArray(owners)) return { ownerByService: new Map(), indexes: { schemas: new Set(), credentials: new Set(), redisNamespaces: new Set(), redisCredentials: new Set() } };
  add(errors, owners.length === EXPECTED_SERVICES.length, `serviceOwners must declare exactly ${EXPECTED_SERVICES.length} services`);
  const ids = owners.map((owner) => owner?.service);
  assertExpectedSet(errors, ids, EXPECTED_SERVICES, 'serviceOwners');
  const ownerByService = new Map();
  const indexes = { schemas: new Set(), credentials: new Set(), redisNamespaces: new Set(), redisCredentials: new Set() };
  for (const owner of owners) {
    add(errors, isRecord(owner), 'service owner entries must be objects');
    if (!isRecord(owner)) continue;
    assertString(errors, owner.service, 'service owner.service');
    add(errors, !ownerByService.has(owner.service), `service owner is duplicated: ${owner.service}`);
    ownerByService.set(owner.service, owner);
    if (owner.service === 'api-gateway') checkGatewayOwner(owner, errors, indexes);
    else if (EXPECTED_DATA_OWNERS.includes(owner.service)) checkDataOwner(owner, errors, indexes);
  }
  const dataOwnerCount = owners.filter((owner) => owner?.dataOwner === true).length;
  add(errors, dataOwnerCount === 14, `data owner count must be 14, got ${dataOwnerCount}`);
  add(errors, ownerByService.get('api-gateway')?.dataOwner === false, 'api-gateway must be the sole non-data-owner');
  return { ownerByService, indexes };
}

function checkMigrationInventory(policy, ownerByService, errors) {
  const inventory = policy.migrationInventory;
  add(errors, isRecord(inventory), 'migrationInventory must be an object');
  if (!isRecord(inventory)) return;
  add(errors, inventory.classification === 'HISTORICAL_CANDIDATE_MIGRATION_INPUT', 'migrationInventory must remain a historical candidate input');
  const existing = inventory.existingCollections;
  const planned = inventory.plannedCollections;
  add(errors, Array.isArray(existing), 'migrationInventory.existingCollections must be an array');
  add(errors, Array.isArray(planned), 'migrationInventory.plannedCollections must be an array');
  if (Array.isArray(existing)) {
    add(errors, existing.length === 12, 'migrationInventory must contain 12 existing candidate migration collections');
    const services = existing.map((item) => item?.service);
    assertExpectedSet(errors, services, EXPECTED_EXISTING_MIGRATION_SERVICES, 'existing migration services');
    const seen = new Set();
    for (const item of existing) {
      add(errors, isRecord(item), 'existing migration collection entries must be objects');
      if (!isRecord(item)) continue;
      add(errors, !seen.has(item.service), `existing migration collection is duplicated: ${item.service}`);
      seen.add(item.service);
      const owner = ownerByService.get(item.service);
      add(errors, owner?.dataOwner === true, `existing migration collection has no data owner: ${item.service}`);
      add(errors, item.path === owner?.flyway?.location, `existing migration path must match ${item.service} Flyway location`);
      add(errors, Number.isInteger(item.fileCount) && item.fileCount > 0, `existing migration fileCount must be positive: ${item.service}`);
    }
  }
  if (Array.isArray(planned)) {
    add(errors, planned.length === 2, 'migrationInventory must contain 2 planned migration collections');
    const services = planned.map((item) => item?.service);
    assertExpectedSet(errors, services, EXPECTED_PLANNED_MIGRATION_SERVICES, 'planned migration services');
    const seen = new Set();
    for (const item of planned) {
      add(errors, isRecord(item), 'planned migration collection entries must be objects');
      if (!isRecord(item)) continue;
      add(errors, !seen.has(item.service), `planned migration collection is duplicated: ${item.service}`);
      seen.add(item.service);
      const owner = ownerByService.get(item.service);
      add(errors, owner?.schema?.status === 'PLANNED_M2_004', `${item.service} schema must remain PLANNED_M2_004`);
      add(errors, item.status === 'PLANNED_M2_004', `${item.service} migration must remain PLANNED_M2_004`);
      add(errors, item.path === owner?.flyway?.location, `planned migration path must match ${item.service} Flyway location`);
    }
  }
  const gateway = inventory.gateway;
  add(errors, gateway?.service === 'api-gateway' && gateway?.businessFlyway === 'NOT_APPLICABLE' && gateway?.businessSchema === 'NOT_APPLICABLE', 'migrationInventory must mark Gateway business migration/schema NOT_APPLICABLE');
  add(errors, inventory.candidateOnly === true, 'migrationInventory.candidateOnly must be true');
  const forbiddenProof = ['independent-schema', 'owner-grant', 'tenant-isolation', 'migration-recovery', 'rollback', 'redis-rebuild'];
  assertExpectedSet(errors, inventory.mustNotBeTreatedAsRuntimeProof, forbiddenProof, 'migrationInventory.mustNotBeTreatedAsRuntimeProof');
}

function checkB25OwnerMap(policy, b25, errors) {
  const metadata = policy.historicalCandidateInputs?.b25Data;
  add(errors, isRecord(metadata), 'B25 historical candidate metadata is required');
  add(errors, isRecord(b25), 'B25 data candidate input is required');
  if (!isRecord(metadata) || !isRecord(b25)) return;
  add(errors, metadata.path === DEFAULT_B25_INPUT.replaceAll('\\', '/'), 'B25 candidate path is invalid');
  add(errors, metadata.classification === 'HISTORICAL_CANDIDATE_MIGRATION_INPUT', 'B25 must remain a historical candidate migration input');
  add(errors, metadata.ownerMapCount === 8, 'B25 candidate ownerMapCount must be 8');
  add(errors, /migration input/i.test(metadata.disposition ?? '') && /cannot.*runtime/i.test(metadata.disposition ?? ''), 'B25 disposition must deny runtime-proof promotion');
  add(errors, Array.isArray(metadata.ownerMap), 'B25 candidate ownerMap must be an array');
  const metadataOwners = Array.isArray(metadata.ownerMap) ? metadata.ownerMap : [];
  add(errors, metadataOwners.length === 8, 'B25 candidate ownerMap must contain 8 owners');
  const expectedByService = new Map(EXPECTED_B25_OWNERS.map((owner) => [owner.service, owner]));
  const seen = new Set();
  for (const owner of metadataOwners) {
    add(errors, isRecord(owner), 'B25 candidate owner entries must be objects');
    if (!isRecord(owner)) continue;
    add(errors, !seen.has(owner.service), `B25 candidate owner is duplicated: ${owner.service}`);
    seen.add(owner.service);
    const expected = expectedByService.get(owner.service);
    add(errors, Boolean(expected), `B25 candidate has unknown owner: ${owner.service}`);
    if (expected) {
      add(errors, owner.schema === expected.schema, `B25 ${owner.service} schema mapping is invalid`);
      add(errors, owner.redisNamespace === expected.redisNamespace, `B25 ${owner.service} Redis namespace mapping is invalid`);
    }
  }
  assertExpectedSet(errors, [...seen], EXPECTED_B25_OWNERS.map((owner) => owner.service), 'B25 candidate owner services');

  add(errors, b25.schemaVersion === 1 && b25.batch === 'B25' && b25.phase === 'phase-1', 'B25 candidate must remain a Phase 1 B25 input');
  add(errors, b25.runtimeStatus === 'pending', 'B25 runtimeStatus must remain pending');
  add(errors, b25.mode === 'static-and-synthetic' && b25.status === 'static-foundation', 'B25 candidate must remain static-and-synthetic');
  add(errors, b25.task?.runtimeRequired === true && b25.task?.defaultDecision === 'deny', 'B25 candidate must remain runtime-required and deny-by-default');
  const dataPolicy = b25.dataOwnerPolicy;
  add(errors, isRecord(dataPolicy), 'B25 dataOwnerPolicy is required');
  if (isRecord(dataPolicy)) {
    add(errors, dataPolicy.oneSchemaOneServiceOwner === true, 'B25 must retain one-schema/one-owner policy');
    for (const key of ['crossServiceWritesAllowed', 'crossServiceSqlJoinsAllowed', 'sharedOrmEntitiesAllowed', 'gatewayMayWriteDomainTables', 'coreApiMayWriteB25Tables', 'redisIsSourceOfTruth']) add(errors, dataPolicy[key] === false, `B25 dataOwnerPolicy.${key} must be false`);
    add(errors, dataPolicy.ownerMismatchDecision === 'stop', 'B25 owner mismatch decision must stop');
    add(errors, Array.isArray(dataPolicy.ownerMap) && dataPolicy.ownerMap.length === 8, 'B25 dataOwnerPolicy.ownerMap must contain 8 owners');
    const actualByService = new Map((dataPolicy.ownerMap ?? []).map((owner) => [owner?.service, owner]));
    assertExpectedSet(errors, [...actualByService.keys()], EXPECTED_B25_OWNERS.map((owner) => owner.service), 'B25 data owner services');
    for (const expected of EXPECTED_B25_OWNERS) {
      const owner = actualByService.get(expected.service);
      add(errors, owner?.schema === expected.schema && owner?.redisNamespace === expected.redisNamespace, `B25 data owner mapping is invalid: ${expected.service}`);
      add(errors, owner?.writeAuthority === `${expected.service}-only`, `B25 write authority must remain owner-local: ${expected.service}`);
    }
  }
  add(errors, b25.runtime?.staticValidatorCannotPromoteRuntime === true, 'B25 static validator must not promote runtime completion');
  add(errors, b25.redisRebuild?.sourceOfTruth === 'mysql-owner-schema' && b25.redisRebuild?.cacheMayStartEmpty === true && b25.redisRebuild?.unavailableRedisMustNotWriteBusinessFact === true, 'B25 Redis rebuild policy must be durable-owner based and fail closed');
}

function checkRedisKeyspace(policy, redisRegistry, ownerByService, errors) {
  const metadata = policy.historicalCandidateInputs?.redisKeyspaceRegistry;
  add(errors, isRecord(metadata), 'Redis historical candidate metadata is required');
  add(errors, isRecord(redisRegistry), 'Redis keyspace candidate input is required');
  if (!isRecord(metadata) || !isRecord(redisRegistry)) return;
  add(errors, metadata.path === DEFAULT_REDIS_INPUT.replaceAll('\\', '/'), 'Redis candidate path is invalid');
  add(errors, metadata.classification === 'HISTORICAL_CANDIDATE_MIGRATION_INPUT', 'Redis keyspace must remain a historical candidate migration input');
  add(errors, metadata.entryCount === 29, 'Redis candidate entryCount must be 29');
  add(errors, metadata.coreApiEntryCount === 28, 'Redis candidate coreApiEntryCount must be 28');
  add(errors, /historical.*core-api.*migration input/i.test(metadata.disposition ?? '') && /never proof/i.test(metadata.disposition ?? ''), 'Redis disposition must deny historical owner promotion');

  const entries = redisRegistry.entries;
  add(errors, Array.isArray(entries), 'Redis keyspace entries must be an array');
  if (!Array.isArray(entries)) return;
  add(errors, entries.length === 29, `Redis keyspace must contain 29 entries, got ${entries.length}`);
  const coreApiEntries = entries.filter((entry) => typeof entry?.owner === 'string' && entry.owner.startsWith('core-api.'));
  add(errors, coreApiEntries.length === 28, `Redis keyspace must retain exactly 28 historical core-api.* entries, got ${coreApiEntries.length}`);
  add(errors, redisRegistry.schemaVersion === 'redis.keyspace.v1' && redisRegistry.redisVersion === '7.x', 'Redis keyspace registry version is invalid');
  add(errors, redisRegistry.globalRules?.sourceOfTruth === 'mysql_or_durable_event_store', 'Redis source of truth must be MySQL or a durable event store');
  add(errors, redisRegistry.globalRules?.allKeysMustExpire === true, 'Redis keyspace must require expiring keys');

  const mapping = metadata.legacyOwnerMappings;
  add(errors, Array.isArray(mapping), 'Redis legacyOwnerMappings must be an array');
  const mappingByLegacyOwner = new Map();
  for (const item of mapping ?? []) {
    add(errors, isRecord(item), 'Redis legacy owner mappings must be objects');
    if (!isRecord(item)) continue;
    add(errors, !mappingByLegacyOwner.has(item.legacyOwner), `Redis legacy owner mapping is duplicated: ${item.legacyOwner}`);
    mappingByLegacyOwner.set(item.legacyOwner, item);
    add(errors, typeof item.legacyOwner === 'string' && item.legacyOwner.startsWith('core-api.'), `Redis legacy owner must be core-api.*: ${item.legacyOwner}`);
    add(errors, nonEmpty(item.targetOwner) && !item.targetOwner.startsWith('core-api.'), `Redis legacy owner target must not remain core-api.*: ${item.legacyOwner}`);
    add(errors, item.migrationResponsibility === 'P1R-M2-004', `Redis legacy owner migration must remain P1R-M2-004: ${item.legacyOwner}`);
  }
  add(errors, mappingByLegacyOwner.size === EXPECTED_CORE_API_REDIS_MAPPINGS.length, 'Redis legacyOwnerMappings must contain 10 mappings');
  for (const expected of EXPECTED_CORE_API_REDIS_MAPPINGS) {
    const actual = mappingByLegacyOwner.get(expected.legacyOwner);
    add(errors, actual?.targetOwner === expected.targetOwner, `Redis legacy owner target is invalid: ${expected.legacyOwner}`);
  }
  for (const owner of new Set(coreApiEntries.map((entry) => entry.owner))) add(errors, mappingByLegacyOwner.has(owner), `historical Redis owner has no migration mapping: ${owner}`);

  const allowedCurrentOwners = new Set(EXPECTED_DATA_OWNERS);
  for (const [index, entry] of entries.entries()) {
    const label = `Redis entries[${index}]`;
    assertString(errors, entry?.owner, `${label}.owner`);
    if (typeof entry?.owner === 'string' && !entry.owner.startsWith('core-api.')) add(errors, allowedCurrentOwners.has(entry.owner), `${label} has an unknown current owner: ${entry.owner}`);
    add(errors, entry?.rebuildable === true, `${label} must be rebuildable`);
    add(errors, entry?.atomicity?.notAuthoritative === true, `${label} must be non-authoritative`);
    add(errors, nonEmpty(entry?.sourceOfTruth) && !/redis/i.test(entry?.sourceOfTruth ?? ''), `${label} must name a durable/non-Redis source of truth`);
  }
  add(errors, ownerByService.get('api-gateway')?.redis?.businessSourceOfTruth === false, 'Gateway Redis source-of-truth boundary must remain false');
}

function checkM2Gaps(policy, errors) {
  const requirements = policy.m2RuntimeRequirements;
  add(errors, Array.isArray(requirements), 'm2RuntimeRequirements must be an array');
  if (!Array.isArray(requirements)) return;
  add(errors, requirements.length === EXPECTED_M2_RUNTIME_REQUIREMENTS.length, 'M2 runtime requirements must contain 8 open requirements');
  const ids = requirements.map((item) => item?.id);
  assertExpectedSet(errors, ids, EXPECTED_M2_RUNTIME_REQUIREMENTS, 'M2 runtime requirement IDs');
  for (const [index, requirement] of requirements.entries()) {
    add(errors, isRecord(requirement), `m2RuntimeRequirements[${index}] must be an object`);
    if (!isRecord(requirement)) continue;
    assertString(errors, requirement.id, `m2RuntimeRequirements[${index}].id`);
    assertString(errors, requirement.requirement, `m2RuntimeRequirements[${index}].requirement`);
  }
}

function checkNoRuntimePromotion(value, errors, location = '$', key = '') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => checkNoRuntimePromotion(item, errors, `${location}[${index}]`, key));
    return;
  }
  if (!isRecord(value)) return;
  for (const [childKey, child] of Object.entries(value)) {
    const childLocation = `${location}.${childKey}`;
    if (/^(?:runtimeStatus|status|result|decision|outcome)$/i.test(childKey) && typeof child === 'string' && PROMOTED_STATES.has(child.toUpperCase())) {
      errors.push(`${childLocation} attempts to promote a D2/candidate policy to runtime ${child}`);
    }
    checkNoRuntimePromotion(child, errors, childLocation, childKey);
  }
}

function checkCandidatePath(root, relativePath, label, errors, { mustExist = false, directory = false } = {}) {
  if (!nonEmpty(relativePath) || path.isAbsolute(relativePath)) {
    errors.push(`${label} must be a repository-relative path`);
    return null;
  }
  const absolute = path.resolve(root, relativePath);
  const relative = path.relative(path.resolve(root), absolute);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    errors.push(`${label} escapes the repository: ${relativePath}`);
    return null;
  }
  if (mustExist) {
    add(errors, fs.existsSync(absolute), `${label} does not exist: ${relativePath}`);
    if (directory) add(errors, fs.existsSync(absolute) && fs.statSync(absolute).isDirectory(), `${label} must be a directory: ${relativePath}`);
  }
  return absolute;
}

function checkMigrationFiles(root, policy, errors) {
  const collections = policy.migrationInventory?.existingCollections;
  if (!Array.isArray(collections)) return;
  for (const item of collections) {
    const directory = checkCandidatePath(root, item.path, `${item.service} migration path`, errors, { mustExist: true, directory: true });
    if (!directory) continue;
    const files = fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
      .map((entry) => entry.name);
    add(errors, files.length === item.fileCount, `${item.service} migration fileCount drift: declared ${item.fileCount}, found ${files.length}`);
    const versions = new Set();
    for (const file of files) {
      const match = file.match(/^V(\d+)__([A-Za-z0-9][A-Za-z0-9_-]*)\.sql$/);
      add(errors, Boolean(match), `${item.service} migration filename is invalid: ${file}`);
      if (!match) continue;
      add(errors, !versions.has(match[1]), `${item.service} migration version is duplicated: V${match[1]}`);
      versions.add(match[1]);
      const sql = fs.readFileSync(path.join(directory, file), 'utf8');
      errors.push(...validateMigrationSqlText({ service: item.service, filename: file, sql }));
    }
  }
}

function sourceFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  const pending = [directory];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(absolute);
      else if (entry.isFile() && SOURCE_SCAN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(absolute);
    }
  }
  return files;
}

function checkServiceSourceIsolation(root, policy, errors) {
  for (const owner of policy.serviceOwners ?? []) {
    if (owner?.dataOwner !== true || !EXPECTED_EXISTING_MIGRATION_SERVICES.includes(owner.service)) continue;
    const sourceRoot = path.join(root, 'services', owner.service, 'src', 'main');
    const expectedSchema = owner.schema?.name ?? serviceSchemaName(owner.service);
    for (const file of sourceFiles(sourceRoot)) {
      const content = fs.readFileSync(file, 'utf8');
      for (const foreignSchema of foreignSchemaReferences(content, expectedSchema)) {
        errors.push(`${owner.service}: cross-service schema reference is forbidden in ${path.relative(root, file)}: ${foreignSchema}`);
      }
    }
  }

  const gatewayRoot = path.join(root, 'services', 'api-gateway');
  const gatewayPom = path.join(gatewayRoot, 'pom.xml');
  if (fs.existsSync(gatewayPom)) {
    const pom = fs.readFileSync(gatewayPom, 'utf8').toLowerCase();
    for (const marker of FORBIDDEN_GATEWAY_PERSISTENCE_MARKERS) {
      add(errors, !pom.includes(marker), `api-gateway must not depend on business persistence capability: ${marker}`);
    }
  }
  add(errors, !fs.existsSync(path.join(gatewayRoot, 'src', 'main', 'resources', 'db', 'migration')), 'api-gateway must not contain a business Flyway migration directory');
}

export function validateDataOwnershipData({ policy, dataOwnership, b25, b25Data, redisRegistry, redisKeyspace } = {}) {
  const source = policy ?? dataOwnership;
  const b25Source = b25 ?? b25Data;
  const redisSource = redisRegistry ?? redisKeyspace;
  const errors = [];
  checkHeader(source, errors);
  if (!isRecord(source)) return { result: 'FAIL', errors, summary: {} };
  checkGlobalPolicies(source, errors);
  const { ownerByService, indexes } = checkServiceOwners(source, errors);
  checkMigrationInventory(source, ownerByService, errors);
  checkB25OwnerMap(source, b25Source, errors);
  checkRedisKeyspace(source, redisSource, ownerByService, errors);
  checkM2Gaps(source, errors);
  checkNoRuntimePromotion(source, errors);
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    errors,
    summary: {
      totalServices: source.serviceOwners?.length ?? 0,
      dataOwners: source.serviceOwners?.filter((owner) => owner?.dataOwner === true).length ?? 0,
      gatewayWithoutBusinessSchema: source.serviceOwners?.filter((owner) => owner?.service === 'api-gateway' && owner.businessSchema === null).length ?? 0,
      existingMigrationCollections: source.migrationInventory?.existingCollections?.length ?? 0,
      plannedMigrationCollections: source.migrationInventory?.plannedCollections?.length ?? 0,
      b25OwnerCount: source.historicalCandidateInputs?.b25Data?.ownerMap?.length ?? 0,
      redisEntryCount: redisSource?.entries?.length ?? 0,
      redisCoreApiEntryCount: Array.isArray(redisSource?.entries) ? redisSource.entries.filter((entry) => entry?.owner?.startsWith?.('core-api.')).length : 0,
      redisNamespaceCount: indexes.redisNamespaces.size,
      m2RuntimeRequirementCount: source.m2RuntimeRequirements?.length ?? 0,
      runtimeStatus: source.runtimeStatus,
    },
  };
}

function readJson(filePath, label, errors) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`${label} cannot be read: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export function validateDataOwnership({ root = process.cwd(), input, b25Input, redisInput, checkPaths = true, checkMigrationDirectories = checkPaths } = {}) {
  const errors = [];
  const policyPath = path.resolve(root, input ?? DEFAULT_INPUT);
  const b25Path = path.resolve(root, b25Input ?? DEFAULT_B25_INPUT);
  const redisPath = path.resolve(root, redisInput ?? DEFAULT_REDIS_INPUT);
  const policy = readJson(policyPath, 'P1R data ownership policy', errors);
  const b25 = readJson(b25Path, 'B25 candidate input', errors);
  const redisRegistry = readJson(redisPath, 'Redis keyspace candidate input', errors);
  const report = validateDataOwnershipData({ policy, b25, redisRegistry });
  report.errors.unshift(...errors);
  if (checkPaths && isRecord(policy)) {
    checkCandidatePath(root, policy.sourceOfTruth, 'policy.sourceOfTruth', report.errors, { mustExist: true });
    checkCandidatePath(root, policy.historicalCandidateInputs?.b25Data?.path, 'B25 candidate path', report.errors, { mustExist: true });
    checkCandidatePath(root, policy.historicalCandidateInputs?.redisKeyspaceRegistry?.path, 'Redis candidate path', report.errors, { mustExist: true });
    if (checkMigrationDirectories) {
      checkMigrationFiles(root, policy, report.errors);
      checkServiceSourceIsolation(root, policy, report.errors);
    }
  }
  report.result = report.errors.length === 0 ? 'PASS' : 'FAIL';
  return report;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--input' || argument === '--b25' || argument === '--redis') {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a JSON document path`);
      options[{ '--input': 'input', '--b25': 'b25Input', '--redis': 'redisInput' }[argument]] = value;
    } else if (argument.startsWith('--input=')) options.input = argument.slice('--input='.length);
    else if (argument.startsWith('--b25=')) options.b25Input = argument.slice('--b25='.length);
    else if (argument.startsWith('--redis=')) options.redisInput = argument.slice('--redis='.length);
    else if (argument === '--no-path-check') options.checkPaths = false;
    else if (argument === '--no-migration-check') options.checkMigrationDirectories = false;
    else if (argument === '--json') options.json = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new Error(`unknown argument: ${argument}`);
  }
  return options;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log('Usage: node scripts/audit/p1r-data-ownership-check.mjs [--input <policy.json>] [--b25 <b25.json>] [--redis <keyspace.json>] [--json]');
      process.exit(0);
    }
    const report = validateDataOwnership(options);
    if (options.json || report.result === 'FAIL') console.log(JSON.stringify(report, null, 2));
    else console.log(`P1R data ownership audit PASS: ${report.summary.totalServices} services, ${report.summary.dataOwners} data owners, ${report.summary.existingMigrationCollections} existing candidate migrations and ${report.summary.plannedMigrationCollections} planned migrations.`);
    process.exit(report.result === 'PASS' ? 0 : 1);
  } catch (error) {
    console.error(JSON.stringify({ result: 'FAIL', errors: [error instanceof Error ? error.message : String(error)], summary: {} }, null, 2));
    process.exit(1);
  }
}
