import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifestRelativePath = 'config/g1-contract-data.json'
const runtimeRequestedByProcess = process.argv.includes('--require-runtime') || process.env.G1_REQUIRE_RUNTIME === '1'
const httpMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'])
const forbiddenText = [
  /Bearer\s+[A-Za-z0-9._~-]+/i,
  /\bsk-[A-Za-z0-9]/i,
  /-----BEGIN [A-Z ]+-----/i,
  /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /(?:^|\D)(?:\+?86[- ]?)?1[3-9]\d{9}(?:$|\D)/,
  /https?:\/\//i,
  /(?:^|\b)(?:jdbc|mysql|redis|kafka):\/\//i,
]

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireCondition(condition, message, errors) {
  if (!condition) errors.push(message)
}

function requireString(value, label, errors) {
  requireCondition(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`, errors)
}

function requireArray(value, label, errors, minimum = 1) {
  requireCondition(Array.isArray(value) && value.length >= minimum, `${label} must contain at least ${minimum} item(s)`, errors)
}

function unique(values, label, errors) {
  const filtered = values.filter((value) => typeof value === 'string')
  requireCondition(new Set(filtered).size === filtered.length, `${label} must be unique`, errors)
}

function scanValue(value, location, errors) {
  if (typeof value === 'string') {
    for (const pattern of forbiddenText) requireCondition(!pattern.test(value), `${location} contains a credential, PII, or URL pattern`, errors)
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) scanValue(child, `${location}.${key}`, errors)
}

function safeRelativePath(relativePath, label, errors) {
  requireCondition(typeof relativePath === 'string' && !path.isAbsolute(relativePath) && !relativePath.includes('..'), `${label} must be a safe repository-relative path`, errors)
  return typeof relativePath === 'string' && !path.isAbsolute(relativePath) && !relativePath.includes('..')
}

function readText(relativePath, label, errors) {
  if (!safeRelativePath(relativePath, label, errors)) return ''
  const absolutePath = path.join(root, relativePath)
  if (!fs.existsSync(absolutePath)) {
    errors.push(`${label} source path does not exist: ${relativePath}`)
    return ''
  }
  const text = fs.readFileSync(absolutePath, 'utf8')
  for (const pattern of forbiddenText.slice(0, 6)) requireCondition(!pattern.test(text), `${relativePath} contains a credential or PII pattern`, errors)
  return text
}

function readJson(relativePath, label, errors) {
  const text = readText(relativePath, label, errors)
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch (error) {
    errors.push(`${label} is not valid JSON: ${error.message}`)
    return null
  }
}

function validateBasis(manifest, errors) {
  requireCondition(manifest.schemaVersion === 1, 'schemaVersion must be 1', errors)
  requireCondition(manifest.gate === 'G1' && manifest.taskId === 'G1-CONTRACT-DATA-001', 'manifest must be G1-CONTRACT-DATA-001', errors)
  requireCondition(manifest.phase === 'phase-1', 'G1 phase must be phase-1', errors)
  requireCondition(manifest.status === 'static-foundation' && manifest.staticDecision === 'PASS', 'G1 static status must be static-foundation/PASS', errors)
  requireCondition(manifest.defaultDecision === 'BLOCKED', 'G1 default decision must remain BLOCKED', errors)
  const semantics = manifest.staticValidatorSemantics
  requireCondition(semantics?.businessCompletion === false, 'G1 static PASS cannot mean business completion', errors)
  requireCondition(semantics?.runtimeEvidenceStatus === 'pending' && semantics?.runtimeMissingDecision === 'BLOCKED', 'G1 runtime evidence must remain pending/blocked', errors)
  requireCondition(semantics?.staticValidatorCannotPromoteRuntime === true && semantics?.generatedFilesAreNotSources === true && semantics?.syntheticEvidenceCannotPromoteRuntime === true, 'G1 static/runtime separation is incomplete', errors)
}

function validatePhaseBoundary(boundary, errors) {
  requireCondition(boundary?.currentPhase === 'phase-1', 'G1 current phase must be phase-1', errors)
  requireCondition(JSON.stringify((boundary?.futurePhases ?? []).map((item) => item?.phase)) === JSON.stringify(['phase-2', 'phase-3']), 'G1 future phase locks are incomplete or reordered', errors)
  for (const item of boundary?.futurePhases ?? []) {
    requireCondition(item?.defaultEnabled === false && item?.defaultDecision === 'deny', `${item?.phase} contract route must be disabled/deny by default`, errors)
    requireCondition(item?.requiresGate === (item?.phase === 'phase-2' ? 'G-P2' : 'G-P3'), `${item?.phase} requires the wrong unlock Gate`, errors)
  }
}

function flattenOpenApiOperations(document) {
  const operations = []
  for (const [route, item] of Object.entries(document?.paths ?? {})) {
    if (!isRecord(item)) continue
    for (const [method, operation] of Object.entries(item)) {
      if (httpMethods.has(method) && isRecord(operation)) operations.push({ route, method: method.toUpperCase(), operationId: operation.operationId })
    }
  }
  return operations
}

function generatedRegistryIds(source) {
  const ids = []
  const registryStart = source.indexOf('export interface ApiOperationRegistry')
  const registry = registryStart >= 0 ? source.slice(registryStart, source.indexOf('export type ApiOperationId', registryStart)) : ''
  for (const match of registry.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]+): \{ method:/gm)) ids.push(match[1])
  return ids
}

function validateOpenApi(contract, sourceConfig, errors) {
  requireCondition(isRecord(contract) && /^3\./.test(contract?.openapi ?? ''), 'OpenAPI canonical source must be OpenAPI 3.x', errors)
  requireString(contract?.info?.version, 'OpenAPI info.version', errors)
  const operations = flattenOpenApiOperations(contract)
  requireCondition(operations.length === sourceConfig?.expectedOperationCount, `OpenAPI operation count mismatch: expected ${sourceConfig?.expectedOperationCount}, got ${operations.length}`, errors)
  const operationIds = operations.map((operation) => operation.operationId)
  unique(operationIds, 'OpenAPI operationIds', errors)
  for (const operation of operations) requireCondition(typeof operation.operationId === 'string' && new RegExp(sourceConfig?.operationIdPattern ?? '^[A-Za-z][A-Za-z0-9]+$').test(operation.operationId), `invalid operationId ${operation.operationId}`, errors)
  requireCondition(Object.keys(contract?.components?.schemas ?? {}).length === sourceConfig?.expectedSchemaCount, `OpenAPI schema count mismatch: expected ${sourceConfig?.expectedSchemaCount}`, errors)
  const canonicalIds = contract?.['x-canonical-id-fields']
  requireCondition(isRecord(canonicalIds), 'OpenAPI canonical ID registry is missing', errors)
  return { operations, operationIds }
}

function validateGeneratedOpenApi(sourceConfig, operationIds, errors) {
  const generated = sourceConfig?.generatedPaths ?? []
  requireArray(generated, 'OpenAPI generated paths', errors, 2)
  const registrySource = readText(generated[0], 'OpenAPI generated registry', errors)
  requireCondition(registrySource.includes(sourceConfig?.sourceMarker ?? ''), 'OpenAPI generated source marker is missing', errors)
  const generatedIds = generatedRegistryIds(registrySource)
  requireCondition(generatedIds.length === operationIds.length, `generated OpenAPI operation count mismatch: expected ${operationIds.length}, got ${generatedIds.length}`, errors)
  const expected = new Set(operationIds)
  for (const id of generatedIds) requireCondition(expected.has(id), `generated OpenAPI contains unknown operationId ${id}`, errors)
  for (const id of operationIds) requireCondition(generatedIds.includes(id), `generated OpenAPI is missing operationId ${id}`, errors)
  const clientSource = readText(generated[1], 'API client generated registry', errors)
  requireCondition(clientSource.includes(sourceConfig?.sourceMarker ?? ''), 'API client generated source marker is missing', errors)
  const clientIds = [...clientSource.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]+): \{ method:/gm)].map((match) => match[1])
  requireCondition(clientIds.length === operationIds.length, `API client generated operation count mismatch: expected ${operationIds.length}, got ${clientIds.length}`, errors)
  for (const id of operationIds) requireCondition(clientIds.includes(id), `API client generated registry is missing operationId ${id}`, errors)
}

function validateEvents(catalog, sourceConfig, errors) {
  requireCondition(isRecord(catalog) && catalog?.schema === 'platform.event.catalog.v1', 'AsyncAPI catalog identity is invalid', errors)
  const envelopeRequired = catalog?.envelope?.required ?? []
  const expectedEnvelope = ['eventId', 'eventName', 'schema', 'version', 'occurredAt', 'aggregateType', 'aggregateId', 'actorId', 'traceId', 'requestId', 'payload']
  requireCondition(JSON.stringify(envelopeRequired) === JSON.stringify(expectedEnvelope), 'event envelope required fields are incomplete or reordered', errors)
  const events = catalog?.events ?? []
  requireCondition(events.length === sourceConfig?.expectedEventCount, `event count mismatch: expected ${sourceConfig?.expectedEventCount}, got ${events.length}`, errors)
  const eventNames = events.map((event) => event?.eventName)
  unique(eventNames, 'event names', errors)
  for (const event of events) {
    requireCondition(/\.v\d+$/.test(event?.eventName ?? ''), `event ${event?.eventName} must be versioned`, errors)
    requireCondition(event?.compatibility?.strategy === 'additive', `${event?.eventName} compatibility must be additive`, errors)
    const ref = event?.payloadSchema?.$ref ?? ''
    const schemaName = ref.split('/').pop()
    requireCondition(schemaName && isRecord(catalog?.payloadSchemas?.[schemaName]), `${event?.eventName} payload schema reference is unresolved`, errors)
  }
  requireCondition(Object.keys(catalog?.payloadSchemas ?? {}).length === sourceConfig?.expectedPayloadSchemaCount, `payload schema count mismatch: expected ${sourceConfig?.expectedPayloadSchemaCount}`, errors)
  requireArray(catalog?.forbiddenPayloadFieldPatterns, 'forbidden event payload field patterns', errors, 5)
  return { events, eventNames }
}

function validateGeneratedEvents(sourceConfig, eventCount, errors) {
  const source = readText(sourceConfig?.generatedPaths?.[0], 'generated event types', errors)
  requireCondition(source.includes(sourceConfig?.sourceMarker ?? ''), 'generated event source marker is missing', errors)
  const generatedEventTypes = [...source.matchAll(/^export interface [A-Za-z][A-Za-z0-9]*Event extends PlatformEventEnvelope</gm)].length
  requireCondition(generatedEventTypes === eventCount, `generated event type count mismatch: expected ${eventCount}, got ${generatedEventTypes}`, errors)
  requireCondition(source.includes('export interface PlatformEventEnvelope'), 'generated event envelope type is missing', errors)
}

function validateJsonSchemas(registry, sourceConfig, errors) {
  requireCondition(isRecord(registry) && isRecord(registry?.schemas), 'JSON Schema registry is invalid', errors)
  const entries = Object.entries(registry.schemas)
  requireCondition(entries.length === sourceConfig?.expectedSchemaCount, `JSON Schema count mismatch: expected ${sourceConfig?.expectedSchemaCount}, got ${entries.length}`, errors)
  for (const [name, schema] of entries) {
    requireCondition(schema?.type === 'object' && schema?.additionalProperties === false, `${name} must be a closed object schema`, errors)
    requireArray(schema?.required, `${name}.required`, errors)
    requireString(schema?.['$id'], `${name}.$id`, errors)
  }
  const generated = readText(sourceConfig?.generatedPaths?.[0], 'generated JSON Schemas', errors)
  requireCondition(generated.includes(sourceConfig?.sourceMarker ?? ''), 'generated JSON Schema source marker is missing', errors)
  const generatedMatch = /export const jsonSchemaRegistry = ([\s\S]+) as const;/.exec(generated)
  let generatedRegistry = null
  try { generatedRegistry = generatedMatch ? JSON.parse(generatedMatch[1]) : null } catch (error) { errors.push(`generated JSON Schema registry is not JSON-compatible: ${error.message}`) }
  requireCondition(isRecord(generatedRegistry), 'generated JSON Schema registry is missing', errors)
  const generatedNames = Object.keys(generatedRegistry ?? {})
  requireCondition(JSON.stringify(generatedNames) === JSON.stringify(Object.keys(registry.schemas)), 'generated JSON Schema registry keys diverge from canonical source', errors)
}

function validateIdentityAndSecurity(manifest, openapi, schemaRegistry, errors) {
  const identity = manifest.canonicalIdentity
  const canonicalIds = openapi?.['x-canonical-id-fields'] ?? {}
  requireCondition(identity?.sourcePath === manifest.contractSources?.openapi?.canonicalPath && identity?.registryKey === 'x-canonical-id-fields', 'canonical ID source is not the OpenAPI registry', errors)
  requireArray(identity?.requiredFields, 'canonical ID fields', errors, 10)
  for (const field of identity?.requiredFields ?? []) requireCondition(typeof canonicalIds[field] === 'string', `canonical ID field ${field} is missing from OpenAPI`, errors)
  requireCondition(identity?.generatedIdType === 'CanonicalInt64Id' && identity?.noClientSubstitution === true, 'canonical ID policy is unsafe', errors)

  const state = manifest.stateAndSecurityPolicy
  for (const values of Object.values(state?.canonicalStateValues ?? {})) requireArray(values, 'canonical state registry', errors, 1)
  requireCondition(JSON.stringify(state?.canonicalStateValues?.mastery) === JSON.stringify(['NEW', 'LEARNING', 'MASTERED', 'CONSOLIDATED']), 'mastery state enum is not canonical', errors)
  requireCondition(JSON.stringify(state?.canonicalStateValues?.mistakeVerification) === JSON.stringify(['PENDING_RETRY', 'DELAY_VERIFY_D1', 'DELAY_VERIFY_D7', 'MASTERED', 'REOPENED']), 'mistake verification enum is not canonical', errors)
  requireCondition(JSON.stringify(state?.canonicalStateValues?.authorizationDecision) === JSON.stringify(['ALLOW', 'DENY']), 'authorization decision must be ALLOW/DENY', errors)
  for (const fact of ['subject', 'tenant', 'role', 'permission', 'resource', 'action', 'owner', 'phase', 'contentRights', 'deviceTrust', 'consent', 'policyVersion']) requireCondition(state?.serverDerivedAuthorizationFacts?.includes(fact), `server-derived authorization fact missing ${fact}`, errors)
  for (const fact of ['role', 'permission', 'tenantId', 'ownerId', 'phase', 'contentRights', 'ageVerified']) requireCondition(state?.forbiddenClientAuthorityFacts?.includes(fact), `client authority fact ${fact} must be forbidden`, errors)
  requireCondition(state?.defaultDecision === 'deny' && state?.clientAuthorityRejectionCode === 'UNTRUSTED_SECURITY_FACT' && state?.tenantDerivation === 'verified-principal-and-IAM-context' && state?.tenantGuardMarker === 'assertTenant', 'G1 security policy must fail closed', errors)
  const authSchema = schemaRegistry?.schemas?.['iam.authorization.decision.v1']
  requireCondition(authSchema?.['x-server-derived-authorization-facts']?.includes('tenant'), 'IAM schema must declare server-derived tenant fact', errors)
}

function validateMigrationsAndOwners(manifest, errors) {
  const migrationPolicy = manifest.migrationPolicy
  const migrationManifest = readJson(migrationPolicy?.canonicalManifestPath, 'migration manifest', errors)
  requireCondition(migrationManifest?.engine === 'mysql-8.0' && migrationManifest?.checksumAlgorithm === 'sha256-normalized-utf8', 'migration manifest engine/checksum policy is invalid', errors)
  const migrations = migrationManifest?.migrations ?? []
  requireCondition(migrations.length >= 21, 'migration manifest must contain the current 21-version baseline', errors)
  const versions = migrations.map((migration) => migration?.version)
  unique(versions, 'migration versions', errors)
  for (const migration of migrations) {
    requireString(migration?.file, `migration ${migration?.version}.file`, errors)
    requireArray(migration?.requiredTables, `migration ${migration?.version}.requiredTables`, errors)
    const migrationPath = path.join(path.dirname(migrationPolicy?.canonicalManifestPath ?? ''), migration.file ?? '')
    const source = readText(migrationPath, `migration ${migration?.version}`, errors)
    requireCondition(source.length > 0, `migration ${migration?.version} source must be non-empty`, errors)
  }
  requireCondition(migrationPolicy?.runtimeDiffEvidenceStatus === 'pending' && migrationPolicy?.emptyUpgradeDowngradeFailureRecoveryRequired === true, 'migration runtime evidence must remain pending and require recovery', errors)
  for (const boundary of ['directory-exists', 'static-sql-only', 'synthetic-schema-diff', 'development-http-200']) requireCondition(migrationPolicy?.cannotBeSatisfiedBy?.includes(boundary), `migration fake-pass boundary missing ${boundary}`, errors)

  const services = manifest.dataOwnership?.services ?? []
  const expectedServices = ['api-gateway', 'iam-service', 'learner-service', 'content-service', 'learning-service', 'assessment-service', 'media-service', 'gamification-service', 'social-service', 'commerce-service', 'notification-service', 'analytics-service', 'admin-ops-service', 'audit-service', 'workflow-service']
  requireCondition(JSON.stringify(services.map((service) => service?.service)) === JSON.stringify(expectedServices), 'service owner list is incomplete or reordered', errors)
  const schemaNames = services.map((service) => service?.schema)
  const namespaces = services.map((service) => service?.redisNamespace)
  unique(schemaNames, 'service schema owner names', errors)
  unique(namespaces, 'service Redis namespaces', errors)
  const migrationVersions = new Set(versions)
  for (const service of services) {
    requireString(service?.service, 'service owner.service', errors)
    requireString(service?.schema, `${service?.service}.schema`, errors)
    requireString(service?.redisNamespace, `${service?.service}.redisNamespace`, errors)
    requireCondition(/^[a-z][a-z0-9._-]{1,63}$/.test(service?.redisNamespace ?? ''), `${service?.service} Redis namespace is unsafe`, errors)
    requireCondition(service?.ownerStatus === 'declared' && service?.runtimeStatus === 'pending', `${service?.service} owner must remain declared/pending`, errors)
    requireCondition(service?.writeBoundary === (service?.service === 'api-gateway' ? 'no-domain-write' : 'service-owned-only'), `${service?.service} write boundary is unsafe`, errors)
    if (service?.migrationRequired) requireCondition(migrationVersions.has(service?.migrationVersion), `${service?.service} migration version is not in manifest`, errors)
    else requireCondition(service?.schema === 'none' && service?.migrationVersion === null, `${service?.service} no-migration boundary is invalid`, errors)
  }
  requireCondition(manifest.dataOwnership?.runtimeStatus === 'pending' && manifest.dataOwnership?.sharedTableWriteAllowed === false && manifest.dataOwnership?.sharedOrmEntityAllowed === false && manifest.dataOwnership?.crossServiceSqlJoinAllowed === false, 'data ownership must remain pending and prohibit shared writes', errors)
}

function validateRedisPolicy(policy, errors) {
  requireCondition(policy?.durableSourceOfTruth === 'service-owned-mysql-facts' && policy?.namespaceRule === 'unique-service-owned-safe-namespace' && policy?.runtimeNamespaceEvidenceStatus === 'pending', 'Redis namespace policy is unsafe', errors)
  for (const segment of ['password', 'secret', 'token', 'email', 'phone', 'audio', 'payment']) requireCondition(policy?.forbiddenSegments?.includes(segment), `Redis forbidden segment missing ${segment}`, errors)
  for (const boundary of ['shared-global-namespace', 'redis-only-fact', 'static-key-list']) requireCondition(policy?.cannotBeSatisfiedBy?.includes(boundary), `Redis fake-pass boundary missing ${boundary}`, errors)
}

function validateCrossServicePolicy(policy, errors) {
  requireCondition(policy?.defaultDecision === 'deny', 'cross-service write policy must default deny', errors)
  for (const item of ['cross-service-sql-join', 'shared-orm-entity', 'cross-service-table-write', 'kafka-rpc', 'distributed-two-phase-commit']) requireCondition(policy?.prohibited?.includes(item), `cross-service prohibition missing ${item}`, errors)
  for (const item of ['versioned-api-command', 'trusted-event', 'outbox', 'idempotent-consumer', 'saga-compensation']) requireCondition(policy?.allowedIntegration?.includes(item), `cross-service integration boundary missing ${item}`, errors)
  requireArray(policy?.sourcePaths, 'cross-service policy source paths', errors, 3)
  requireArray(policy?.sourceMarkers, 'cross-service policy source markers', errors, 3)
  const sourceText = (policy?.sourcePaths ?? []).map((sourcePath) => readText(sourcePath, 'cross-service policy source', errors)).join('\n')
  for (const marker of policy?.sourceMarkers ?? []) requireCondition(sourceText.includes(marker), `cross-service policy source marker missing ${marker}`, errors)
}

function validateStaticChecks(checks, errors) {
  requireArray(checks, 'G1 static checks', errors, 6)
  unique(checks.map((check) => check?.id), 'G1 static check ids', errors)
  for (const check of checks) {
    requireString(check?.id, 'G1 check id', errors)
    requireCondition(check?.status === 'defined' && check?.evidenceClass === 'static' && check?.runtimeRequired === false, `${check?.id} must be a static defined check`, errors)
    requireArray(check?.sourcePaths, `${check?.id}.sourcePaths`, errors)
    requireArray(check?.assertions, `${check?.id}.assertions`, errors)
    const sourceText = (check?.sourcePaths ?? []).map((sourcePath) => readText(sourcePath, `${check?.id}.sourcePath`, errors)).join('\n')
    for (const assertion of check?.assertions ?? []) {
      if (typeof assertion?.contains === 'string') requireCondition(sourceText.includes(assertion.contains), `${check?.id} missing source marker ${assertion.contains}`, errors)
      else if (typeof assertion?.regex === 'string') {
        try { requireCondition(new RegExp(assertion.regex, assertion.flags ?? '').test(sourceText), `${check?.id} source regex did not match`, errors) } catch (error) { errors.push(`${check?.id} has invalid regex: ${error.message}`) }
      } else errors.push(`${check?.id} assertion must contain contains or regex`)
    }
  }
}

function validateEvidence(manifest, errors) {
  const evidence = manifest.evidenceIndex ?? []
  requireArray(evidence, 'G1 evidence index', errors, 9)
  const evidenceIds = evidence.map((item) => item?.id)
  unique(evidenceIds, 'G1 evidence ids', errors)
  for (const item of evidence) {
    requireString(item?.id, 'G1 evidence.id', errors)
    requireCondition(item?.class === 'static' || item?.class === 'runtime', `${item?.id} evidence class is invalid`, errors)
    requireString(item?.artifactPathPattern, `${item?.id}.artifactPathPattern`, errors)
    requireString(item?.collectionPolicy, `${item?.id}.collectionPolicy`, errors)
    if (item?.class === 'static') requireCondition(item?.status === 'defined' && item?.runtimeRequired === false && item?.artifactPathPattern.startsWith('config/'), `${item?.id} static evidence is invalid`, errors)
    else requireCondition(['pending', 'blocked'].includes(item?.status) && item?.runtimeRequired === true && item?.artifactPathPattern.startsWith('evidence/') && item?.collectionPolicy === 'approved-external-runner-only', `${item?.id} runtime evidence must remain pending/blocked and external`, errors)
  }
  for (const id of manifest.runtimeGate?.requiredEvidence ?? []) requireCondition(evidenceIds.includes(id), `runtime evidence ${id} is not indexed`, errors)
  const report = manifest.reportSchema
  requireCondition(report?.closed === true && report?.missingEvidenceDecision === 'BLOCKED', 'G1 report schema must be closed and BLOCKED on missing evidence', errors)
  requireArray(report?.required, 'G1 report required fields', errors, 10)
}

function validateRuntime(manifest, env, errors) {
  const required = manifest.runtimeGate?.requiredEnv ?? []
  requireArray(required, 'G1 runtime required env', errors, 6)
  unique(required, 'G1 runtime required env', errors)
  for (const name of required) requireCondition(/^G1_RUNTIME_[A-Z0-9_]+$/.test(name), `invalid G1 runtime env ${name}`, errors)
  const missing = required.filter((name) => !env?.[name])
  if (missing.length > 0) errors.push(`runtime gate blocked; missing environment: ${missing.join(', ')}`)
  for (const name of required) if (env?.[name]) requireCondition(!/synthetic|fixture|example\.invalid|replace_with|pending/i.test(String(env[name])), `${name} cannot use a synthetic or placeholder evidence reference`, errors)
  errors.push('runtime gate blocked; live contract diff, migration/schema owner and Redis evidence require an approved external runner and cannot be promoted by this static validator')
}

export function validateG1ContractData(manifest, { runtimeRequested = runtimeRequestedByProcess, env = process.env } = {}) {
  const errors = []
  if (!isRecord(manifest)) return { result: 'FAIL', gate: 'G1', runtimeGate: runtimeRequested ? 'blocked' : 'static-only', errors: ['manifest must be a JSON object'] }
  scanValue(manifest, '$.manifest', errors)
  validateBasis(manifest, errors)
  validatePhaseBoundary(manifest.phaseBoundary, errors)
  const openapi = readJson(manifest.contractSources?.openapi?.canonicalPath, 'OpenAPI canonical source', errors)
  const events = readJson(manifest.contractSources?.asyncapi?.canonicalPath, 'AsyncAPI canonical source', errors)
  const schemas = readJson(manifest.contractSources?.jsonSchema?.canonicalPath, 'JSON Schema canonical source', errors)
  const openApiResult = validateOpenApi(openapi, manifest.contractSources?.openapi, errors)
  validateGeneratedOpenApi(manifest.contractSources?.openapi, openApiResult.operationIds, errors)
  const eventResult = validateEvents(events, manifest.contractSources?.asyncapi, errors)
  validateGeneratedEvents(manifest.contractSources?.asyncapi, eventResult.events.length, errors)
  validateJsonSchemas(schemas, manifest.contractSources?.jsonSchema, errors)
  validateIdentityAndSecurity(manifest, openapi, schemas, errors)
  validateMigrationsAndOwners(manifest, errors)
  validateRedisPolicy(manifest.redisPolicy, errors)
  validateCrossServicePolicy(manifest.crossServiceWritePolicy, errors)
  validateStaticChecks(manifest.checks, errors)
  validateEvidence(manifest, errors)
  requireCondition(manifest.runtimeGate?.status === 'blocked' && manifest.runtimeGate?.runtimeStatusWhenMissing === 'blocked' && manifest.runtimeGate?.staticValidatorCannotPromoteRuntime === true, 'G1 runtime gate must remain blocked and non-promotable', errors)
  if (runtimeRequested) validateRuntime(manifest, env, errors)
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    gate: 'G1',
    phase: manifest.phase,
    defaultDecision: manifest.defaultDecision,
    runtimeGate: runtimeRequested ? 'blocked' : 'static-only',
    operationCount: openApiResult.operations.length,
    schemaCount: Object.keys(openapi?.components?.schemas ?? {}).length,
    eventCount: eventResult.events.length,
    payloadSchemaCount: Object.keys(events?.payloadSchemas ?? {}).length,
    dataOwnerCount: manifest.dataOwnership?.services?.length ?? 0,
    staticChecks: manifest.checks?.length ?? 0,
    runtimeEvidencePending: manifest.runtimeGate?.requiredEvidence?.length ?? 0,
    errors,
  }
}

function loadManifest() {
  return JSON.parse(fs.readFileSync(path.join(root, manifestRelativePath), 'utf8'))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = validateG1ContractData(loadManifest())
    console.log(JSON.stringify(result, null, 2))
    if (result.result !== 'PASS') process.exitCode = 1
  } catch (error) {
    console.error(JSON.stringify({ result: 'FAIL', gate: 'G1', errors: [error.message] }, null, 2))
    process.exitCode = 1
  }
}
