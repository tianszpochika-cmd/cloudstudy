import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const configPath = path.join(root, 'config', 'b21-deployment-staging.json')
const runtimeRequested = process.argv.includes('--require-runtime')
const allowedRuntimeStatuses = new Set(['pending', 'blocked'])
const expectedTasks = ['V2-B21-DEP-001', 'V2-B21-STG-002']
const expectedStaticIds = [
  'B21-DEP-OCI-STATIC',
  'B21-DEP-PACKAGING-STATIC',
  'B21-DEP-CONFIG-STATIC',
  'B21-DEP-SECRET-STATIC',
  'B21-DEP-PROBE-STATIC',
  'B21-DEP-ROLLOUT-STATIC',
  'B21-DEP-NETWORK-STATIC',
  'B21-DEP-IMMUTABLE-STATIC',
  'B21-STG-PARITY-STATIC',
  'B21-STG-FIXTURE-STATIC',
  'B21-STG-MIGRATION-STATIC',
  'B21-STG-DEPENDENCY-STATIC',
  'B21-STG-ROLLBACK-STATIC'
]
const expectedRuntimeIds = [
  'B21-DEP-OCI-RUNTIME',
  'B21-DEP-PACKAGING-RUNTIME',
  'B21-DEP-CONFIG-RUNTIME',
  'B21-DEP-SECRET-RUNTIME',
  'B21-DEP-PROBE-RUNTIME',
  'B21-DEP-ROLLOUT-RUNTIME',
  'B21-DEP-NETWORK-RUNTIME',
  'B21-DEP-IMMUTABLE-RUNTIME',
  'B21-STG-PARITY-RUNTIME',
  'B21-STG-FIXTURE-RUNTIME',
  'B21-STG-MIGRATION-RUNTIME',
  'B21-STG-DEPENDENCY-RUNTIME',
  'B21-STG-ROLLBACK-RUNTIME'
]
const requiredB20Tasks = [
  'V2-B20-SEC-001',
  'V2-B20-PRI-002',
  'V2-B20-CNT-003',
  'V2-B20-COM-004',
  'V2-B20-DR-005',
  'V2-B20-TEST-006'
]
const errors = []

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function fail(message) {
  errors.push(message)
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} must be a non-empty string`)
}

function requireBoolean(value, label) {
  if (typeof value !== 'boolean') fail(`${label} must be boolean`)
}

function requireArray(value, label, minimum = 1) {
  if (!Array.isArray(value) || value.length < minimum) fail(`${label} must contain at least ${minimum} item(s)`)
}

function unique(values, label) {
  if (new Set(values).size !== values.length) fail(`${label} must be unique`)
}

function has(value, item, label) {
  if (!Array.isArray(value) || !value.includes(item)) fail(`${label} must include ${item}`)
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    fail(`cannot read JSON ${path.relative(root, filePath)}: ${error.message}`)
    return null
  }
}

function readSource(relativePath) {
  const absolutePath = path.resolve(root, relativePath)
  if (!absolutePath.startsWith(`${root}${path.sep}`) && absolutePath !== root) {
    fail(`source path escapes repository: ${relativePath}`)
    return ''
  }
  if (!fs.existsSync(absolutePath)) {
    fail(`source path does not exist: ${relativePath}`)
    return ''
  }
  try {
    return fs.readFileSync(absolutePath, 'utf8')
  } catch (error) {
    fail(`cannot read source ${relativePath}: ${error.message}`)
    return ''
  }
}

function assertSourceMarker(relativePath, marker) {
  const source = readSource(relativePath)
  if (source && !source.includes(marker)) fail(`${relativePath} is missing source marker: ${marker}`)
}

function validateHeader(config) {
  if (!isRecord(config)) {
    fail('manifest must be an object')
    return
  }
  if (config.schemaVersion !== undefined && config.schemaVersion !== 1) fail('schemaVersion must be 1')
  if (config.batch !== 'B21') fail('batch must be B21')
  if (config.phase !== 'phase-1') fail('manifest must remain Phase 1')
  if (config.mode !== 'static-and-synthetic') fail('manifest mode must be static-and-synthetic')
  if (config.status !== 'static-foundation') fail('manifest status must be static-foundation')
  if (config.scope !== 'V2-B21-DEP-001+V2-B21-STG-002') fail('manifest scope must be limited to DEP-001 and STG-002')
}

function validateTasks(config) {
  requireArray(config.tasks, 'tasks', expectedTasks.length)
  const tasks = config.tasks ?? []
  const ids = tasks.map((task) => task?.id)
  if (JSON.stringify(ids) !== JSON.stringify(expectedTasks)) fail(`tasks must be exactly ${expectedTasks.join(', ')}`)
  unique(ids, 'task ids')
  for (const task of tasks) {
    requireString(task?.id, 'task.id')
    if (task.status !== 'defined') fail(`${task.id} must remain defined until runtime evidence exists`)
    requireBoolean(task.runtimeRequired, `${task.id}.runtimeRequired`)
    if (task.defaultDecision !== 'deny') fail(`${task.id} default decision must be deny`)
    requireArray(task.acceptanceRefs, `${task.id}.acceptanceRefs`)
  }
  if (!tasks[0]?.dependsOn?.includes('V2-B20-TEST-006')) fail('DEP-001 must depend on the B20 release evidence gate')
  if (!tasks[1]?.dependsOn?.includes('V2-B21-DEP-001')) fail('STG-002 must depend on DEP-001')
}

function validateExecution(config) {
  const execution = config.execution
  if (!isRecord(execution)) {
    fail('execution is required')
    return
  }
  if (execution.mode !== 'static-fixture-only') fail('execution mode must be static-fixture-only')
  if (execution.runtimeStatus !== 'blocked' || execution.runtimeBlocked !== true) fail('runtime must remain blocked')
  if (execution.allowUnverifiedPass !== false || execution.staticValidatorCannotPromoteRuntime !== true) fail('static/runtime separation policy is incomplete')
  requireArray(execution.requiredEnv, 'execution.requiredEnv', 3)
  for (const envName of execution.requiredEnv ?? []) {
    if (!/^[A-Z][A-Z0-9_]+$/.test(envName)) fail(`invalid runtime environment variable: ${envName}`)
  }
  requireArray(execution.blockedReasons, 'execution.blockedReasons', 3)
  const prerequisite = execution.b20Prerequisite
  if (!isRecord(prerequisite) || prerequisite.required !== true || prerequisite.currentDecision !== 'BLOCKED' || prerequisite.requiredDecision !== 'ACCEPTED') fail('B20 prerequisite must be required and currently BLOCKED')
  if (JSON.stringify(prerequisite.requiredTasks) !== JSON.stringify(requiredB20Tasks)) fail('B20 prerequisite task list is incomplete or reordered')
}

function validateOci(config, deploymentSources) {
  const oci = config.oci
  if (!isRecord(oci) || oci.registryMode !== 'external-approved-registry') fail('OCI registry must be external-approved-registry')
  requireArray(oci?.images, 'oci.images')
  for (const image of oci?.images ?? []) {
    requireString(image?.name, 'oci.image.name')
    const ref = image?.image ?? ''
    if (!/@sha256:[0-9a-f]{64}$/.test(ref)) fail(`${image.name} must use a 64-character immutable digest`)
    if (/:latest(?:@|$)/.test(ref) || /(^|[/:])latest($|[^a-z0-9])/.test(ref)) fail(`${image.name} may not use latest`)
    if (image?.tagPolicy !== 'digest-only') fail(`${image.name} tag policy must be digest-only`)
    if (!isRecord(image?.signature) || image.signature.required !== true || image.signature.tool !== 'cosign') fail(`${image.name} must require cosign signature evidence`)
    if (!isRecord(image?.sbom) || image.sbom.required !== true || image.sbom.format !== 'CycloneDX' || !/@sha256:[0-9a-f]{64}$/.test(image.sbom.ref ?? '')) fail(`${image.name} must require a digest-addressed CycloneDX SBOM`)
    if (image.provenance !== 'SLSA-provenance-required') fail(`${image.name} must require SLSA provenance`)
  }
  if (oci.promotion?.stagingToProduction !== 'same-digest-only' || oci.promotion?.rebuildBetweenEnvironments !== false) fail('promotion must reuse the same digest without rebuilding')
  if (!isRecord(config.deployment?.immutability) || config.deployment.immutability.imageDigestRequired !== true || config.deployment.immutability.noLatestTag !== true) fail('deployment immutability policy is incomplete')

  const forbiddenMutableRef = /image:\s+[^\n]*:latest(?:\s|$)/i
  for (const [relativePath, source] of deploymentSources) {
    if (forbiddenMutableRef.test(source)) fail(`${relativePath} contains a mutable latest image reference`)
    if (/-----BEGIN |Bearer\s+eyJ|\bghp_|\bsk-[A-Za-z0-9]{20,}/i.test(source)) fail(`${relativePath} contains credential material`)
  }
}

function validateDeployment(config, deploymentSources) {
  const deployment = config.deployment
  if (!isRecord(deployment) || deployment.orchestrator !== 'kubernetes') fail('deployment orchestrator must be Kubernetes')
  if (JSON.stringify(deployment?.packaging) !== JSON.stringify(['kustomize', 'helm', 'gitops'])) fail('deployment packaging must include Kustomize, Helm and GitOps')
  const roots = deployment?.sourceRoots
  for (const field of ['base', 'stagingOverlay', 'productionOverlay', 'helm', 'gitops', 'oci']) requireString(roots?.[field], `deployment.sourceRoots.${field}`)
  const layering = deployment.configLayering
  if (!isRecord(layering) || layering.baseIsEnvironmentNeutral !== true || layering.stagingOverlayRequired !== true || layering.productionOverlayRequired !== true || layering.overlayMayChangeBusinessRules !== false || layering.productionRequiresManualPromotion !== true) fail('environment layering policy is unsafe or incomplete')

  const secrets = deployment.secretInjection
  if (!isRecord(secrets) || secrets.provider !== 'external-secret-store' || secrets.repositorySecretMaterial !== false || secrets.imageSecretMaterial !== false || secrets.environmentReferenceOnly !== true || secrets.failClosedWhenUnavailable !== true || secrets.rotationRequired !== true) fail('external secret injection policy is incomplete')
  if (!String(secrets.stagingPath).startsWith('kv://phase1/staging/') || !String(secrets.productionPath).startsWith('kv://phase1/production/')) fail('staging and production secret paths must be isolated')

  const probes = deployment.probes
  if (!isRecord(probes)) fail('deployment probes are required')
  for (const name of ['startup', 'readiness', 'liveness']) {
    if (!isRecord(probes?.[name]) || probes[name].required !== true || !String(probes[name].path).startsWith('/actuator/health/')) fail(`${name} probe contract is incomplete`)
  }
  if (probes.mustUseServicePort !== true || probes.probeCredentials !== 'none') fail('probes must use the service port without probe credentials')

  const rollout = deployment.rollout
  if (!isRecord(rollout) || rollout.stagingStrategy !== 'rollingUpdate' || !rollout.productionStrategies?.includes('blueGreen') || !rollout.productionStrategies?.includes('rollingUpdate') || rollout.blueGreenPromotion !== 'manual-and-audited') fail('rollout strategy contract must include staging rolling and production blue-green/manual promotion')
  if (!isRecord(rollout.rollback) || rollout.rollback.enabled !== true || rollout.rollback.requiresImmutableRevision !== true || rollout.rollback.requiresRestorePoint !== true || rollout.rollback.requiresDrillEvidence !== true || rollout.rollback.defaultDecision !== 'deny') fail('rollback must be enabled, immutable, restore-point based and evidence gated')

  const network = deployment.networkPolicy
  if (!isRecord(network) || network.defaultDenyIngress !== true || network.defaultDenyEgress !== true || network.publicIngressOwner !== 'api-gateway' || network.domainServicesPubliclyReachable !== false || network.dnsEgressExplicit !== true || network.internalEgressAllowlistRequired !== true) fail('network policy boundary is incomplete')
  const podSecurity = deployment.podSecurity
  if (!isRecord(podSecurity) || podSecurity.runAsNonRoot !== true || podSecurity.readOnlyRootFilesystem !== true || podSecurity.allowPrivilegeEscalation !== false || podSecurity.seccompProfile !== 'RuntimeDefault' || !podSecurity.dropCapabilities?.includes('ALL') || podSecurity.automountServiceAccountToken !== false) fail('pod security policy is incomplete')

  const sourceMarkers = {
    'B21-DEP-OCI-STATIC': [['deploy/b21/oci/image-lock.yaml', 'requireDigest: true'], ['deploy/b21/oci/image-lock.yaml', 'tool: cosign'], ['deploy/b21/oci/image-lock.yaml', 'format: CycloneDX'], ['deploy/b21/base/deployment.yaml', '@sha256:']],
    'B21-DEP-PACKAGING-STATIC': [['deploy/b21/base/kustomization.yaml', 'kind: Kustomization'], ['deploy/b21/helm/Chart.yaml', 'apiVersion: v2'], ['deploy/b21/gitops/application-staging.yaml', 'kind: Application']],
    'B21-DEP-CONFIG-STATIC': [['deploy/b21/overlays/staging/kustomization.yaml', 'environment: staging'], ['deploy/b21/overlays/production/kustomization.yaml', 'environment: production'], ['deploy/b21/gitops/application-production.yaml', 'targetRevision: REPLACE_SIGNED_RC_COMMIT_SHA']],
    'B21-DEP-SECRET-STATIC': [['deploy/b21/base/external-secret.yaml', 'kind: ExternalSecret'], ['deploy/b21/overlays/staging/external-secret-patch.yaml', 'phase1/staging/englishflow-runtime'], ['deploy/b21/overlays/production/external-secret-patch.yaml', 'phase1/production/englishflow-runtime']],
    'B21-DEP-PROBE-STATIC': [['deploy/b21/base/deployment.yaml', 'startupProbe:'], ['deploy/b21/base/deployment.yaml', 'readinessProbe:'], ['deploy/b21/base/deployment.yaml', 'livenessProbe:'], ['deploy/b21/base/deployment.yaml', 'port: http']],
    'B21-DEP-ROLLOUT-STATIC': [['deploy/b21/base/deployment.yaml', 'type: RollingUpdate'], ['deploy/b21/helm/values-production.yaml', 'strategy: blueGreen'], ['deploy/b21/helm/values-production.yaml', 'requiresRestorePoint: true'], ['deploy/b21/gitops/application-production.yaml', 'englishflow.dev/environment: production']],
    'B21-DEP-NETWORK-STATIC': [['deploy/b21/base/network-policy.yaml', 'kind: NetworkPolicy'], ['deploy/b21/base/network-policy.yaml', 'policyTypes:'], ['deploy/b21/base/network-policy.yaml', 'port: 53']],
    'B21-DEP-IMMUTABLE-STATIC': [['deploy/b21/oci/image-lock.yaml', 'rejectMutableTags: true'], ['deploy/b21/base/deployment.yaml', '@sha256:']],
    'B21-STG-PARITY-STATIC': [['deploy/b21/overlays/staging/kustomization.yaml', 'production-like: "true"'], ['deploy/b21/overlays/production/namespace.yaml', 'production-like: "true"']],
    'B21-STG-FIXTURE-STATIC': [['deploy/b21/staging/sanitized-fixtures.yaml', 'synthetic-references-only-no-production-data-no-raw-media-no-secrets'], ['deploy/b21/staging/sanitized-fixtures.yaml', 'subject-ref://synthetic/']],
    'B21-STG-MIGRATION-STATIC': [['deploy/b21/staging/migration-plan.yaml', 'empty-database'], ['deploy/b21/staging/migration-plan.yaml', 'restore-and-reconcile'], ['deploy/b21/staging/migration-plan.yaml', 'destructiveDowngradeAllowed: false']],
    'B21-STG-DEPENDENCY-STATIC': [['deploy/b21/staging/dependency-failure-matrix.yaml', 'bounded-degradation-and-alert'], ['deploy/b21/staging/dependency-failure-matrix.yaml', 'outbox-retained-and-no-duplicate-fact'], ['deploy/b21/base/network-policy.yaml', 'default']],
    'B21-STG-ROLLBACK-STATIC': [['deploy/b21/helm/values-production.yaml', 'requiresDataAndEventReconciliation: true'], ['deploy/b21/gitops/application-production.yaml', 'targetRevision: REPLACE_SIGNED_RC_COMMIT_SHA']]
  }

  const checks = config.staticChecks ?? []
  const byId = new Map(checks.map((check) => [check?.id, check]))
  for (const check of checks) {
    requireString(check?.id, 'staticCheck.id')
    requireString(check?.evidenceId, `${check.id}.evidenceId`)
    if (check.status !== 'defined' || check.evidenceClass !== 'static' || check.runtimeRequired !== false) fail(`${check.id} must be a defined static check`)
    requireArray(check.sourcePaths, `${check.id}.sourcePaths`)
    requireArray(check.assertions, `${check.id}.assertions`)
    for (const sourcePath of check.sourcePaths ?? []) readSource(sourcePath)
    for (const [sourcePath, marker] of sourceMarkers[check.id] ?? []) assertSourceMarker(sourcePath, marker)
  }
  if (JSON.stringify([...byId.keys()]) !== JSON.stringify(expectedStaticIds)) fail('static checks must cover the complete DEP/STG static scope')
}

function validateStaging(config) {
  const staging = config.staging
  if (!isRecord(staging) || staging.environment !== 'staging' || staging.productionLike !== true || staging.runtimeEvidenceStatus !== 'pending') fail('staging must be production-like and runtime-pending')
  requireArray(staging.parityDimensions, 'staging.parityDimensions', 5)
  for (const dimension of ['same-immutable-image', 'same-kubernetes-policy', 'same-migration-runner', 'same-dependency-topology']) has(staging.parityDimensions, dimension, 'staging.parityDimensions')
  for (const allowed of ['namespace', 'scale', 'synthetic-endpoints', 'approval-identities']) has(staging.allowedDifferences, allowed, 'staging.allowedDifferences')
  for (const forbidden of ['business-rules', 'authorization-policy', 'schema-shape', 'event-envelope', 'secret-material']) has(staging.forbiddenDifferences, forbidden, 'staging.forbiddenDifferences')

  const dataLoading = staging.dataLoading
  if (!isRecord(dataLoading) || dataLoading.policy !== 'sanitized-fixtures-only' || dataLoading.productionDataAllowed !== false || dataLoading.rawMediaAllowed !== false || dataLoading.paymentCredentialAllowed !== false) fail('staging data loading must be sanitized and non-production')
  requireString(dataLoading.fixtureManifest, 'staging.dataLoading.fixtureManifest')

  const migration = staging.migration
  if (!isRecord(migration) || migration.forwardCompatible !== true || migration.destructiveDowngradeAllowed !== false || migration.backupBeforeMigration !== true || migration.rollbackMode !== 'restore-and-reconcile') fail('staging migration policy is incomplete')
  for (const stage of ['emptyDatabase', 'upgrade', 'downgrade', 'failureRecovery']) {
    const item = migration[stage]
    if (!isRecord(item) || !allowedRuntimeStatuses.has(item.status) || item.runtimeRequired !== true) fail(`staging migration ${stage} must remain runtime-pending`)
    requireString(item.evidenceId, `staging.migration.${stage}.evidenceId`)
  }
  requireString(migration.migrationPlanPath, 'staging.migration.migrationPlanPath')

  const isolation = staging.dependencyFailureIsolation
  if (!isRecord(isolation) || isolation.defaultDecision !== 'bounded-degradation-and-alert' || isolation.runtimeRequired !== true) fail('dependency failure isolation must be bounded and runtime-required')
  requireArray(isolation.dependencies, 'staging.dependencyFailureIsolation.dependencies', 4)
  const dependencyIds = isolation.dependencies.map((dependency) => dependency?.id)
  if (JSON.stringify(dependencyIds) !== JSON.stringify(['mysql', 'redis', 'kafka', 'object-storage'])) fail('dependency failure matrix must cover MySQL, Redis, Kafka and object storage')
  for (const dependency of isolation.dependencies) {
    if (!allowedRuntimeStatuses.has(dependency?.status)) fail(`${dependency?.id} dependency status must remain pending/blocked`)
    requireString(dependency?.failure, `${dependency?.id}.failure`)
    requireString(dependency?.expected, `${dependency?.id}.expected`)
  }
  requireString(isolation.matrixPath, 'staging.dependencyFailureIsolation.matrixPath')

  const rollback = staging.rollback
  if (!isRecord(rollback) || !allowedRuntimeStatuses.has(rollback.status) || rollback.runtimeRequired !== true || rollback.requiresDataReconciliation !== true || rollback.requiresEventReconciliation !== true) fail('staging rollback must remain pending and require data/event reconciliation')
  requireString(rollback.evidenceId, 'staging.rollback.evidenceId')

  const fixtures = config.syntheticFixtures
  if (!isRecord(fixtures) || fixtures.policy !== 'synthetic-references-only-no-production-data-no-raw-media-no-secrets') fail('synthetic fixture policy is unsafe or incomplete')
  requireArray(fixtures.subjects, 'syntheticFixtures.subjects', 2)
  for (const subject of fixtures.subjects ?? []) {
    if (!String(subject?.subjectRef).startsWith('subject-ref://synthetic/')) fail('fixture subject must use a synthetic reference')
    if (!String(subject?.tenantRef).startsWith('tenant-ref://synthetic/')) fail('fixture tenant must use a synthetic reference')
  }
  if (!String(fixtures.datasetRef).startsWith('dataset-ref://synthetic/') || !fixtures.mediaRefs?.every((ref) => String(ref).startsWith('media-ref://synthetic/'))) fail('fixture dataset/media references must be synthetic')
}

function validateRuntimeChecks(config) {
  const checks = config.runtimeChecks ?? []
  requireArray(checks, 'runtimeChecks', expectedRuntimeIds.length)
  const ids = checks.map((check) => check?.id)
  if (JSON.stringify(ids) !== JSON.stringify(expectedRuntimeIds)) fail('runtime checks must cover the complete DEP/STG runtime scope')
  unique(ids, 'runtime check ids')
  for (const check of checks) {
    if (!allowedRuntimeStatuses.has(check?.status) || check.evidenceClass !== 'runtime' || check.runtimeRequired !== true) fail(`${check?.id} must remain pending/blocked runtime evidence`)
    requireString(check?.evidenceId, `${check?.id}.evidenceId`)
    for (const field of ['tools', 'targets', 'scenarios', 'evidenceRequired', 'cannotBeSatisfiedBy']) requireArray(check?.[field], `${check?.id}.${field}`)
    requireString(check?.expected, `${check?.id}.expected`)
    if (/\b(pass|passed|captured|verified)\b/i.test(JSON.stringify(check))) fail(`${check.id} must not contain runtime-pass language`)
  }
}

function validateEvidence(config) {
  const evidence = config.evidenceIndex ?? []
  requireArray(evidence, 'evidenceIndex', expectedStaticIds.length + expectedRuntimeIds.length)
  unique(evidence.map((item) => item?.id), 'evidence ids')
  const evidenceById = new Map(evidence.map((item) => [item?.id, item]))
  for (const check of [...(config.staticChecks ?? []), ...(config.runtimeChecks ?? [])]) {
    const item = evidenceById.get(check?.evidenceId)
    if (!item) {
      fail(`${check?.id} evidence is not indexed: ${check?.evidenceId}`)
      continue
    }
    if (item.task !== check.task) fail(`${item.id} task does not match ${check.id}`)
    if (item.class !== check.evidenceClass) fail(`${item.id} class does not match ${check.id}`)
  }
  for (const item of evidence) {
    requireString(item?.id, 'evidence.id')
    requireString(item?.task, `${item?.id}.task`)
    requireString(item?.artifactPathPattern, `${item?.id}.artifactPathPattern`)
    requireString(item?.collectionPolicy, `${item?.id}.collectionPolicy`)
    if (item.class === 'static') {
      if (item.status !== 'defined' || item.runtimeRequired !== false || item.collectionPolicy !== 'validator-output') fail(`${item.id} static evidence must be defined and validator-produced`)
      if (!item.artifactPathPattern.startsWith('config/')) fail(`${item.id} static evidence must be repository-addressable`)
    } else if (item.class === 'runtime') {
      if (!allowedRuntimeStatuses.has(item.status) || item.runtimeRequired !== true || item.collectionPolicy !== 'runtime-runner-only') fail(`${item.id} runtime evidence must remain pending/blocked and runner-only`)
      if (!item.artifactPathPattern.startsWith('evidence/b21/')) fail(`${item.id} runtime evidence must use evidence/b21/**`)
    } else {
      fail(`${item.id} evidence class is invalid`)
    }
  }
}

function validateReleaseGate(config) {
  const gate = config.releaseGate
  if (!isRecord(gate) || gate.status !== 'BLOCKED' || gate.defaultDecision !== 'deny' || gate.goAllowed !== false) fail('release gate must remain BLOCKED/deny')
  if (JSON.stringify(gate.requiredCurrentTasks) !== JSON.stringify(expectedTasks)) fail('release gate current task list is incomplete')
  if (JSON.stringify(gate.requiredUpstreamTasks) !== JSON.stringify(requiredB20Tasks)) fail('release gate must require every B20 task')
  for (const condition of ['b20-gate-not-accepted', 'runtime-evidence-pending', 'image-digest-or-signature-missing', 'secret-source-not-external', 'migration-or-rollback-unmeasured', 'production-like-parity-unproven', 'dependency-failure-evidence-missing', 'single-reviewer-or-unreviewed']) has(gate.blockingConditions, condition, 'releaseGate.blockingConditions')
  const review = gate.dualReview
  if (!isRecord(review) || review.required !== true || review.minimumReviewers < 2 || review.independentReviewers !== true || review.reviewRecordStatus !== 'not-present' || review.samePersonCannotSatisfyBoth !== true) fail('release gate must require two independent reviewers and remain unfulfilled')
  const rollback = gate.rollback
  if (!isRecord(rollback) || rollback.required !== true || rollback.status !== 'not-established' || rollback.requiresImmutableRevision !== true || rollback.requiresRestorePoint !== true || rollback.requiresDataAndEventReconciliation !== true || rollback.requiresOwner !== true) fail('release gate rollback contract is incomplete')
}

function validateReportSchema(config) {
  const report = config.reportSchema
  const schema = report?.jsonSchema
  if (!isRecord(report) || !isRecord(schema) || schema.type !== 'object' || schema.additionalProperties !== false) {
    fail('reportSchema must be a closed JSON object schema')
    return
  }
  const required = new Set(schema.required ?? [])
  for (const field of ['schemaVersion', 'batch', 'releaseCandidate', 'environment', 'decision', 'gates', 'evidence', 'review', 'rollback']) if (!required.has(field)) fail(`reportSchema missing required field: ${field}`)
  if (!schema.properties?.decision?.enum?.includes('BLOCKED') || !schema.properties?.decision?.enum?.includes('NO-GO')) fail('reportSchema must represent blocked and no-go decisions')
}

function validateNoSecretsOrPii(config, deploymentSources) {
  const policyFields = new Set(['forbiddenPatterns', 'forbiddenReferences'])
  const sanitizedConfig = JSON.stringify(config, (key, value) => policyFields.has(key) ? undefined : value)
  const combined = [sanitizedConfig, ...deploymentSources.map(([, source]) => source)].join('\n')
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(combined)) fail('manifest contains a private key')
  if (/\bAKIA[0-9A-Z]{16}\b|\bghp_[A-Za-z0-9]{36}\b|\bsk-[A-Za-z0-9]{20,}\b|Bearer\s+eyJ[A-Za-z0-9_-]+\./i.test(combined)) fail('manifest contains credential material')
  if (/[A-Za-z0-9._%+-]+@(gmail|qq|163|outlook)\.com/i.test(combined)) fail('manifest contains personal email material')
  if (/(?:^|\D)(?:\+?86[- ]?)?1[3-9]\d{9}(?:$|\D)/.test(combined)) fail('manifest contains a phone number')
  if (!String(config.syntheticFixtures?.policy).includes('no-production-data') || config.staging?.dataLoading?.productionDataAllowed !== false) fail('synthetic/no-production-data policy is missing')
}

export function validateB21DeploymentStaging(config = readJson(configPath)) {
  errors.length = 0
  if (!config) return { result: 'FAIL', errors: [...errors] }

  validateHeader(config)
  validateTasks(config)
  validateExecution(config)
  const deploymentSources = []
  const sourceFiles = [
    'deploy/b21/base/deployment.yaml',
    'deploy/b21/base/kustomization.yaml',
    'deploy/b21/base/service.yaml',
    'deploy/b21/base/service-account.yaml',
    'deploy/b21/base/external-secret.yaml',
    'deploy/b21/base/network-policy.yaml',
    'deploy/b21/overlays/staging/kustomization.yaml',
    'deploy/b21/overlays/staging/deployment-patch.yaml',
    'deploy/b21/overlays/staging/external-secret-patch.yaml',
    'deploy/b21/overlays/staging/namespace.yaml',
    'deploy/b21/overlays/production/kustomization.yaml',
    'deploy/b21/overlays/production/deployment-patch.yaml',
    'deploy/b21/overlays/production/external-secret-patch.yaml',
    'deploy/b21/overlays/production/namespace.yaml',
    'deploy/b21/helm/Chart.yaml',
    'deploy/b21/helm/values-staging.yaml',
    'deploy/b21/helm/values-production.yaml',
    'deploy/b21/gitops/application-staging.yaml',
    'deploy/b21/gitops/application-production.yaml',
    'deploy/b21/oci/image-lock.yaml',
    'deploy/b21/staging/sanitized-fixtures.yaml',
    'deploy/b21/staging/migration-plan.yaml',
    'deploy/b21/staging/dependency-failure-matrix.yaml'
  ]
  for (const relativePath of sourceFiles) deploymentSources.push([relativePath, readSource(relativePath)])
  validateOci(config, deploymentSources)
  validateDeployment(config, deploymentSources)
  validateStaging(config)
  validateRuntimeChecks(config)
  validateEvidence(config)
  validateReleaseGate(config)
  validateReportSchema(config)
  validateNoSecretsOrPii(config, deploymentSources)

  if (runtimeRequested) {
    const missingEnv = (config.execution?.requiredEnv ?? []).filter((name) => !process.env[name])
    if (missingEnv.length > 0) fail(`runtime gate blocked; missing environment: ${missingEnv.join(', ')}`)
    fail('runtime gate blocked; static validator cannot promote runtime evidence')
  }

  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    batch: config.batch,
    tasks: expectedTasks,
    staticChecks: (config.staticChecks ?? []).length,
    runtimeChecks: (config.runtimeChecks ?? []).length,
    evidence: (config.evidenceIndex ?? []).length,
    runtimeEvidencePending: (config.evidenceIndex ?? []).filter((item) => item.class === 'runtime' && allowedRuntimeStatuses.has(item.status)).length,
    runtimeBlocked: config.execution?.runtimeBlocked === true,
    errors: [...errors]
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const result = validateB21DeploymentStaging()
  const output = JSON.stringify(result, null, 2)
  if (result.result === 'PASS') console.log(output)
  else {
    console.error(output)
    process.exitCode = 1
  }
}
