import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const root = path.resolve(path.dirname(scriptPath), '..', '..')
const manifestRelativePath = 'config/g3-test-security-observability.json'
const runtimeRequestedByProcess = process.argv.includes('--require-runtime') || process.env.G3_REQUIRE_RUNTIME === '1'
const expectedControlIds = [
  'G3-TEST-UNIT',
  'G3-TEST-INTEGRATION',
  'G3-TEST-CONTRACT',
  'G3-TEST-E2E',
  'G3-SEC-AUTH',
  'G3-REL-IDEMPOTENCY',
  'G3-SEC-PRIVACY',
  'G3-SEC-PERFORMANCE',
  'G3-SEC-PHASE',
  'G3-SEC-SCAN',
  'G3-OBS-CORRELATION',
  'G3-OBS-AUDIT-ALERT',
]
const expectedGateIds = expectedControlIds
const allowedRuntimeStatuses = new Set(['pending', 'blocked'])
const forbiddenRuntimeResult = /\b(?:pass|passed|captured|verified|accepted|succeeded|successful)\b/i
const forbiddenCredentialPatterns = [
  /-----BEGIN [A-Z0-9 ]+PRIVATE KEY-----/i,
  /\bBearer\s+[A-Za-z0-9._~+/-]{20,}/i,
  /\b(?:sk|ghp|github_pat|AKIA)[-_A-Za-z0-9]{16,}\b/i,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/i,
  /\b[A-Z0-9._%+-]+@(gmail|qq|163|outlook|protonmail)\.[A-Z]{2,}\b/i,
  /(?:^|\D)(?:\+?86[- ]?)?1[3-9]\d{9}(?:$|\D)/,
]

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireCondition(condition, message, errors) {
  if (!condition) errors.push(message)
}

function requireArray(value, label, errors, minimum = 1) {
  requireCondition(Array.isArray(value) && value.length >= minimum, `${label} must contain at least ${minimum} item(s)`, errors)
}

function requireString(value, label, errors) {
  requireCondition(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`, errors)
}

function unique(values, label, errors) {
  const strings = values.filter((value) => typeof value === 'string')
  requireCondition(new Set(strings).size === strings.length, `${label} must be unique`, errors)
}

function safeRepositoryPath(relativePath, errors) {
  if (typeof relativePath !== 'string' || relativePath.trim() === '' || path.isAbsolute(relativePath) || relativePath.includes('\0')) {
    errors.push(`invalid repository source path: ${String(relativePath)}`)
    return null
  }
  const absolutePath = path.resolve(root, relativePath)
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${path.sep}`)) {
    errors.push(`source path escapes repository: ${relativePath}`)
    return null
  }
  return absolutePath
}

function readText(relativePath, errors) {
  const absolutePath = safeRepositoryPath(relativePath, errors)
  if (!absolutePath) return ''
  if (!fs.existsSync(absolutePath)) {
    errors.push(`missing source path ${relativePath}`)
    return ''
  }
  try {
    return fs.readFileSync(absolutePath, 'utf8')
  } catch (error) {
    errors.push(`cannot read source path ${relativePath}: ${error.message}`)
    return ''
  }
}

function readManifest() {
  return JSON.parse(fs.readFileSync(path.join(root, manifestRelativePath), 'utf8'))
}

function scanValues(value, location, errors, seen = new Set()) {
  if (typeof value === 'string') {
    for (const pattern of forbiddenCredentialPatterns) {
      requireCondition(!pattern.test(value), `${location} contains a credential or PII pattern`, errors)
    }
    return
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  for (const [key, child] of Object.entries(value)) scanValues(child, `${location}.${key}`, errors, seen)
}

function flattenChecks(manifest) {
  return (manifest.qualityGates ?? []).flatMap((gate) => [
    ...(gate.staticChecks ?? []).map((check) => ({ ...check, gateId: gate.id })),
    ...(gate.runtimeChecks ?? []).map((check) => ({ ...check, gateId: gate.id })),
  ])
}

function validateIdentityAndStatus(manifest, errors) {
  requireCondition(manifest.schemaVersion === 1, 'schemaVersion must be 1', errors)
  requireCondition(manifest.batch === 'G3' && manifest.gate === 'G3', 'manifest must be the G3 gate', errors)
  requireCondition(manifest.taskId === 'G3-TEST-SECURITY-OBSERVABILITY', 'G3 task id is invalid', errors)
  requireCondition(manifest.phase === 'phase-1', 'G3 must remain Phase 1', errors)
  requireCondition(manifest.mode === 'static-and-synthetic', 'G3 mode must be static-and-synthetic', errors)
  requireCondition(manifest.status === 'PASS' && manifest.staticStatus === 'PASS', 'static status must be PASS', errors)
  requireCondition(manifest.runtimeStatus === 'blocked' && manifest.runtimeDecision === 'BLOCKED', 'runtime status must remain blocked', errors)
  requireCondition(manifest.defaultDecision === 'NO-GO', 'G3 default decision must be NO-GO', errors)
  requireArray(manifest.scope, 'scope', errors, 10)
  for (const required of ['unit-tests', 'integration-tests', 'contract-tests', 'e2e-tests', 'authorization-and-default-deny', 'idempotency-and-retry', 'weak-network-and-offline', 'privacy-and-redaction', 'performance-and-adaptive-degradation', 'phase-1-ai-disabled', 'security-scanning', 'requestId-traceId-otel-audit-alerting']) {
    requireCondition(manifest.scope.includes(required), `scope is missing ${required}`, errors)
  }
  requireArray(manifest.sourceRefs, 'sourceRefs', errors, 3)
}

function validateTasks(manifest, errors) {
  const tasks = manifest.tasks ?? []
  requireCondition(tasks.length === 1, 'G3 must contain exactly one task', errors)
  const task = tasks[0]
  requireCondition(task?.id === manifest.taskId, 'task.id must match taskId', errors)
  requireCondition(task?.status === 'defined', 'G3 task must remain defined', errors)
  requireCondition(task?.runtimeRequired === true, 'G3 task must require runtime evidence', errors)
  requireCondition(task?.defaultDecision === 'NO-GO', 'G3 task must default to NO-GO', errors)
  requireArray(task?.dependsOn, 'task.dependsOn', errors, 2)
  requireArray(task?.scope, 'task.scope', errors, 5)
}

function validateExecution(execution, errors) {
  requireCondition(execution?.mode === 'static-fixture-only', 'execution.mode must be static-fixture-only', errors)
  requireCondition(execution?.status === 'runtimeBlocked' && execution?.runtimeBlocked === true, 'execution must remain runtimeBlocked', errors)
  requireCondition(execution?.runtimeEvidenceStatus === 'pending', 'execution runtime evidence must remain pending', errors)
  requireCondition(execution?.allowUnverifiedPass === false, 'unverified pass must be forbidden', errors)
  requireCondition(execution?.staticValidatorCannotPromoteRuntime === true, 'static validator cannot promote runtime', errors)
  requireCondition(execution?.runtimeEvidence === null, 'execution.runtimeEvidence must remain null', errors)
  for (const field of ['productionMutationAllowed', 'productionTrafficAllowed', 'destructiveOperationAllowed', 'realBrowserOrDeviceClaimAllowed', 'realSecurityScanClaimAllowed', 'realObservabilityClaimAllowed']) {
    requireCondition(execution?.[field] === false, `execution.${field} must be false`, errors)
  }
  requireArray(execution?.blockedReasons, 'execution.blockedReasons', errors, 3)
}

function validateRuntimeGate(runtimeGate, errors) {
  requireCondition(runtimeGate?.staticOnlyByDefault === true, 'runtime gate must be static-only by default', errors)
  requireCondition(runtimeGate?.requireRuntimeEnv === 'G3_REQUIRE_RUNTIME', 'runtime env must be G3_REQUIRE_RUNTIME', errors)
  requireCondition(runtimeGate?.runtimeEvidenceMustBeCapturedExternally === true, 'runtime evidence must be external', errors)
  requireCondition(runtimeGate?.runtimeEvidenceMustRemainPendingOrBlocked === true, 'runtime evidence must remain pending or blocked', errors)
  requireCondition(runtimeGate?.staticValidatorCannotPromoteRuntime === true, 'static validator cannot promote runtime', errors)
  requireCondition(runtimeGate?.requireImmutableExternalEvidence === true && runtimeGate?.requireApprovedRunner === true, 'runtime evidence must be immutable and runner-produced', errors)
  requireCondition(runtimeGate?.runtimeStatusWhenMissing === 'blocked', 'missing runtime evidence must block', errors)
  requireArray(runtimeGate?.requiredEnv, 'runtimeGate.requiredEnv', errors, 6)
  unique(runtimeGate?.requiredEnv ?? [], 'runtime required env', errors)
  for (const name of runtimeGate?.requiredEnv ?? []) requireCondition(/^G3_RUNTIME_[A-Z0-9_]+$/.test(name), `invalid G3 runtime environment variable ${name}`, errors)
  requireArray(runtimeGate?.requiredEvidence, 'runtimeGate.requiredEvidence', errors, 6)
  unique(runtimeGate?.requiredEvidence ?? [], 'runtime required evidence', errors)
  for (const boundary of ['static-manifest-only', 'synthetic-fixture-only', 'development-http-200', 'same-process-test-double', 'source-marker-only', 'fake-phase-2-ai-fixture', 'real-production-evidence-without-external-attestation']) {
    requireCondition(runtimeGate?.cannotBeSatisfiedBy?.includes(boundary), `runtime fake-pass boundary missing ${boundary}`, errors)
  }
}

function validateSafetyBoundaries(safety, errors) {
  for (const field of ['noRealCredentials', 'noPII', 'noProductionData', 'noProductionTraffic', 'noProductionMutation', 'noPayment', 'noDeletion', 'noPhase2AI', 'syntheticFixturesOnly', 'runtimeCollectionMustUseApprovedRunner', 'runtimeCollectionMustNotWriteRepository', 'runtimeEvidenceMustBeRedacted']) {
    requireCondition(safety?.[field] === true, `safety boundary ${field} must be true`, errors)
  }
}

function validatePhasePolicy(policy, errors) {
  requireCondition(policy?.currentPhase === 'phase-1', 'phase policy must be Phase 1', errors)
  requireCondition(policy?.adultAndUniversityLearnerOnly === true, 'Phase 1 adult boundary is missing', errors)
  for (const field of ['generativeAIEnabled', 'asrEnabled', 'aiScoringEnabled', 'realtimeAIEnabled', 'digitalHumanEnabled', 'phase2CapabilitiesInDefaultRoute', 'phase3CapabilitiesInDefaultRoute']) {
    requireCondition(policy?.[field] === false, `Phase 1 ${field} must be false`, errors)
  }
  requireCondition(policy?.aiStatus === 'disabled', 'Phase 1 AI status must be disabled', errors)
  requireCondition(policy?.unknownPhaseDecision === 'deny', 'unknown phase must deny', errors)
  requireArray(policy?.forbiddenCapabilities, 'phasePolicy.forbiddenCapabilities', errors, 5)
  for (const capability of ['generative-ai', 'asr', 'ai-scoring', 'realtime-ai', 'digital-human', 'k12']) requireCondition(policy.forbiddenCapabilities.includes(capability), `forbidden Phase capability missing ${capability}`, errors)
  requireCondition(policy?.runtimeStatus === 'pending', 'Phase policy runtime status must be pending', errors)
}

function validateTestPolicy(policy, errors) {
  requireCondition(policy?.fixtureMode === 'synthetic-only', 'test fixtures must be synthetic-only', errors)
  requireCondition(policy?.realSubjectDataAllowed === false && policy?.realMediaAllowed === false && policy?.realProductionReportAllowed === false, 'real test material must be forbidden', errors)
  requireCondition(JSON.stringify(policy?.requiredTestKinds) === JSON.stringify(['unit', 'integration', 'contract', 'e2e']), 'unit/integration/contract/e2e test kinds are incomplete or reordered', errors)
  requireCondition(policy?.runtimeEvidenceClass === 'runtime' && policy?.staticEvidenceClass === 'static', 'test evidence classes are invalid', errors)
  requireCondition(policy?.missingEvidenceDecision === 'NO-GO' && policy?.openP0P1Decision === 'BLOCKED', 'test failure policy must be closed', errors)
  for (const field of ['e2eBrowserDeviceEvidence', 'weakNetworkEvidence', 'performanceEvidence']) requireCondition(allowedRuntimeStatuses.has(policy?.[field]), `${field} must remain pending or blocked`, errors)
}

function validateAuthorizationPolicy(policy, errors) {
  for (const field of ['defaultEffect', 'unknownDecision', 'missingIdentityDecision', 'missingPolicyDecision', 'pdpUnavailableDecision']) requireCondition(policy?.[field] === 'deny', `authorization ${field} must deny`, errors)
  requireCondition(policy?.clientAuthorityTrusted === false && policy?.serverDerivesTenantAndOwner === true, 'client authority must be untrusted and server-derived', errors)
  requireArray(policy?.forbiddenAuthorityFields, 'authorizationPolicy.forbiddenAuthorityFields', errors, 7)
  for (const field of ['X-Role', 'X-B5-Role', 'X-Tenant-Id', 'X-Owner-Id', 'tenantId', 'ownerId', 'permissions']) requireCondition(policy.forbiddenAuthorityFields.includes(field), `forbidden authority field missing ${field}`, errors)
  requireArray(policy?.requiredDecisionFacts, 'authorizationPolicy.requiredDecisionFacts', errors, 10)
  for (const field of ['subject', 'tenant', 'role', 'permission', 'resource', 'action', 'owner', 'phase', 'contentRights', 'consent']) requireCondition(policy.requiredDecisionFacts.includes(field), `authorization fact missing ${field}`, errors)
  requireCondition(policy?.runtimeStatus === 'pending', 'authorization runtime status must be pending', errors)
}

function validateReliabilityPolicy(policy, errors) {
  requireCondition(policy?.writeRequestsRequire === 'Idempotency-Key', 'write requests must require Idempotency-Key', errors)
  requireCondition(policy?.duplicateCommandDecision === 'same-result-no-duplicate-write', 'duplicate command policy is unsafe', errors)
  requireCondition(policy?.eventDeduplicationRequired === true && policy?.retryMustBeBounded === true && policy?.outboxReplayMustBeIdempotent === true, 'idempotency/retry policy is incomplete', errors)
  requireArray(policy?.weakNetworkScenarios, 'weakNetworkScenarios', errors, 5)
  for (const scenario of ['timeout', 'retry', 'offline', 'resume', 'duplicate-submit']) requireCondition(policy.weakNetworkScenarios.includes(scenario), `weak network scenario missing ${scenario}`, errors)
  requireCondition(policy?.offlineRecoveryMustBeExplicit === true && policy?.unknownNetworkOutcomeDecision === 'recoverable-pending', 'offline recovery policy is incomplete', errors)
  requireCondition(policy?.runtimeStatus === 'pending', 'idempotency runtime status must be pending', errors)
}

function validatePrivacyPolicy(policy, errors) {
  requireCondition(policy?.fixtureMode === 'synthetic-only', 'privacy fixtures must be synthetic-only', errors)
  for (const field of ['redactionRequired', 'auditMustUseReferences']) requireCondition(policy?.[field] === true, `privacy policy ${field} must be true`, errors)
  for (const field of ['rawSecretsAllowed', 'rawPIIAllowed', 'rawAudioAllowed']) requireCondition(policy?.[field] === false, `privacy policy ${field} must be false`, errors)
  requireArray(policy?.forbiddenFixtureFields, 'privacyPolicy.forbiddenFixtureFields', errors, 8)
  for (const field of ['password', 'secret', 'token', 'authorization', 'cookie', 'privateKey', 'rawAudio', 'phone', 'email']) requireCondition(policy.forbiddenFixtureFields.includes(field), `privacy forbidden field missing ${field}`, errors)
  requireCondition(policy?.runtimeStatus === 'pending', 'privacy runtime status must be pending', errors)
}

function validatePerformancePolicy(policy, errors) {
  requireCondition(policy?.engine === 'AdaptivePerformanceEngine', 'AdaptivePerformanceEngine is required', errors)
  requireCondition(JSON.stringify(policy?.levels) === JSON.stringify(['Ultra', 'High', 'Medium', 'Performance']), 'four performance levels are incomplete or reordered', errors)
  requireCondition(policy?.lowCapabilityFallback === '2.5D-or-2D-static', 'low capability fallback is invalid', errors)
  requireCondition(policy?.weakNetworkBudgetRequired === true && policy?.layoutThrashingForbidden === true, 'performance safety policy is incomplete', errors)
  requireCondition(policy?.runtimeStatus === 'pending', 'performance runtime status must be pending', errors)
}

function validateSecurityScanPolicy(policy, errors) {
  requireCondition(policy?.status === 'pending' && policy?.runtimeRequired === true, 'security scan runtime status must remain pending', errors)
  requireCondition(policy?.highSeverityDecision === 'BLOCKED' && policy?.secretFindingDecision === 'BLOCKED', 'security findings must block', errors)
  requireCondition(policy?.scanEvidenceMustBeExternal === true && policy?.scanEvidenceMustBeRedacted === true, 'security scan evidence policy is incomplete', errors)
  requireArray(policy?.requiredScanFamilies, 'securityScanPolicy.requiredScanFamilies', errors, 5)
  for (const family of ['sast', 'dependency', 'secret', 'container-image', 'sbom-provenance']) requireCondition(policy.requiredScanFamilies.includes(family), `security scan family missing ${family}`, errors)
  requireArray(policy?.requiredTools, 'securityScanPolicy.requiredTools', errors, 6)
  for (const tool of ['Semgrep', 'CodeQL', 'OSV-Scanner', 'Trivy', 'Gitleaks', 'Syft', 'cosign']) requireCondition(policy.requiredTools.includes(tool), `security tool missing ${tool}`, errors)
}

function validateObservabilityPolicy(policy, errors) {
  requireCondition(policy?.runtimeStatus === 'pending', 'observability runtime status must be pending', errors)
  requireCondition(policy?.provider === 'OpenTelemetry', 'observability provider must be OpenTelemetry', errors)
  requireCondition(JSON.stringify(policy?.signals) === JSON.stringify(['traces', 'metrics', 'logs']), 'OTel traces/metrics/logs are required in order', errors)
  for (const attribute of ['service.name', 'service.version', 'deployment.environment']) requireCondition(policy?.resourceAttributes?.includes(attribute), `OTel resource attribute missing ${attribute}`, errors)
  for (const field of ['requestId', 'traceId', 'eventId', 'decisionId']) requireCondition(policy?.correlationFields?.includes(field), `correlation field missing ${field}`, errors)
  requireCondition(policy?.sensitiveDataPolicy === 'redact-or-do-not-record' && policy?.exporterEndpointSource === 'runtime-env-only' && policy?.crossProcessEvidenceRequired === true, 'OTel privacy and cross-process policy is incomplete', errors)
  const audit = policy?.audit
  requireCondition(audit?.status === 'pending' && audit?.appendOnly === true && audit?.replayable === true && audit?.externalSinkRequired === true, 'audit policy must remain pending, append-only, replayable and external', errors)
  for (const field of ['eventId', 'requestId', 'traceId', 'decisionId', 'actorRef', 'timestamp', 'action', 'outcome', 'artifactRef']) requireCondition(audit?.requiredFields?.includes(field), `audit field missing ${field}`, errors)
  const alerting = policy?.alerting
  requireCondition(alerting?.status === 'pending' && alerting?.runtimeTriggerRequired === true, 'alerting runtime status must remain pending', errors)
  for (const severity of ['P0', 'P1', 'P2']) requireCondition(alerting?.severityLevels?.includes(severity), `${severity} alert route is missing`, errors)
  requireCondition(alerting?.unownedAlertDecision === 'PAGE-AND-BLOCK' && alerting?.missingTraceDecision === 'BLOCKED' && alerting?.missingAuditDecision === 'BLOCKED', 'alert fail-closed policy is incomplete', errors)
}

function validateStaticCheck(check, errors) {
  requireString(check?.id, 'static check.id', errors)
  requireCondition(check?.status === 'defined' && check?.evidenceClass === 'static' && check?.runtimeRequired === false, `${check?.id} static state is invalid`, errors)
  requireString(check?.evidenceId, `${check?.id}.evidenceId`, errors)
  requireArray(check?.sourcePaths, `${check?.id}.sourcePaths`, errors)
  requireArray(check?.assertions, `${check?.id}.assertions`, errors)
  requireArray(check?.policyAssertions, `${check?.id}.policyAssertions`, errors)
  const sourceText = (check?.sourcePaths ?? []).map((sourcePath) => {
    requireCondition(!String(sourcePath).startsWith('evidence/'), `${check?.id} static source cannot be external evidence`, errors)
    requireCondition(sourcePath !== manifestRelativePath && sourcePath !== 'scripts/runtime/validate-g3-test-security-observability.mjs' && sourcePath !== 'tests/g/g3-test-security-observability.test.mjs', `${check?.id} source must not be a G3 fixture or validator`, errors)
    return readText(sourcePath, errors)
  }).join('\n')
  for (const assertion of check?.assertions ?? []) {
    if (typeof assertion?.contains === 'string') requireCondition(sourceText.includes(assertion.contains), `${check?.id} missing source marker ${assertion.contains}`, errors)
    else if (typeof assertion?.regex === 'string') {
      try {
        requireCondition(new RegExp(assertion.regex, assertion.flags ?? '').test(sourceText), `${check?.id} source regex did not match`, errors)
      } catch (error) {
        errors.push(`${check?.id} has invalid source regex: ${error.message}`)
      }
    } else errors.push(`${check?.id} assertion must contain contains or regex`)
  }
}

function validateRuntimeCheck(check, errors) {
  requireString(check?.id, 'runtime check.id', errors)
  requireCondition(allowedRuntimeStatuses.has(check?.status) && check?.evidenceClass === 'runtime' && check?.runtimeRequired === true, `${check?.id} runtime state must remain pending/blocked`, errors)
  requireString(check?.evidenceId, `${check?.id}.evidenceId`, errors)
  requireCondition(check?.sourcePaths === undefined && check?.assertions === undefined, `${check?.id} runtime check cannot use source assertions`, errors)
  for (const field of ['tools', 'targets', 'scenarios', 'evidenceRequired', 'cannotBeSatisfiedBy']) requireArray(check?.[field], `${check?.id}.${field}`, errors, 2)
  requireString(check?.expected, `${check?.id}.expected`, errors)
  requireCondition(!forbiddenRuntimeResult.test(JSON.stringify(check)), `${check?.id} contains an unverified runtime result marker`, errors)
  for (const boundary of ['static-manifest-only', 'synthetic-fixture-only']) requireCondition(check.cannotBeSatisfiedBy.includes(boundary), `${check?.id} missing fake-pass boundary ${boundary}`, errors)
}

function validateControlsAndChecks(manifest, errors) {
  requireCondition(JSON.stringify((manifest.controls ?? []).map((control) => control?.id)) === JSON.stringify(expectedControlIds), 'G3 controls are incomplete or reordered', errors)
  unique((manifest.controls ?? []).map((control) => control?.id), 'G3 control ids', errors)
  const controls = new Map((manifest.controls ?? []).map((control) => [control?.id, control]))
  for (const id of expectedControlIds) {
    const control = controls.get(id)
    requireCondition(isRecord(control), `missing G3 control ${id}`, errors)
    requireCondition(control?.priority === 'P0' && control?.staticPolicy === 'defined' && control?.runtimeStatus === 'pending', `${id} control state is invalid`, errors)
  }

  requireCondition(JSON.stringify((manifest.qualityGates ?? []).map((gate) => gate?.id)) === JSON.stringify(expectedGateIds), 'G3 quality gates are incomplete or reordered', errors)
  unique((manifest.qualityGates ?? []).map((gate) => gate?.id), 'G3 quality gate ids', errors)
  const checks = flattenChecks(manifest)
  const staticChecks = []
  const runtimeChecks = []
  const checkIds = []
  for (const gate of manifest.qualityGates ?? []) {
    requireCondition(gate?.controlId === gate?.id && controls.has(gate?.controlId), `${gate?.id} control binding is invalid`, errors)
    requireCondition(gate?.decision === 'BLOCKED', `${gate?.id} must remain BLOCKED`, errors)
    requireArray(gate?.staticChecks, `${gate?.id}.staticChecks`, errors)
    requireArray(gate?.runtimeChecks, `${gate?.id}.runtimeChecks`, errors)
    requireArray(gate?.evidenceIds, `${gate?.id}.evidenceIds`, errors, 2)
    for (const check of gate.staticChecks ?? []) {
      staticChecks.push({ ...check, gateId: gate.id })
      checkIds.push(check?.id)
      validateStaticCheck(check, errors)
    }
    for (const check of gate.runtimeChecks ?? []) {
      runtimeChecks.push({ ...check, gateId: gate.id })
      checkIds.push(check?.id)
      validateRuntimeCheck(check, errors)
    }
    const checkEvidenceIds = [...(gate.staticChecks ?? []), ...(gate.runtimeChecks ?? [])].map((check) => check?.evidenceId)
    for (const evidenceId of checkEvidenceIds) requireCondition(gate.evidenceIds.includes(evidenceId), `${gate.id} evidence ${evidenceId} is not listed`, errors)
  }
  unique(checkIds, 'G3 quality check ids', errors)
  requireCondition(staticChecks.length === expectedControlIds.length && runtimeChecks.length === expectedControlIds.length, 'G3 must have one static and one runtime check per control', errors)
  requireCondition(checks.length === staticChecks.length + runtimeChecks.length, 'quality gate checks cannot be dropped during flattening', errors)
  return { staticChecks, runtimeChecks }
}

function validateEvidenceIndex(manifest, checks, errors) {
  const evidence = manifest.evidenceIndex ?? []
  requireArray(evidence, 'evidenceIndex', errors, checks.staticChecks.length + 6)
  const evidenceIds = evidence.map((item) => item?.id)
  unique(evidenceIds, 'G3 evidence ids', errors)
  const gateIds = new Set(expectedGateIds)
  const checkEvidenceIds = new Set([...checks.staticChecks, ...checks.runtimeChecks].map((check) => check?.evidenceId))
  for (const item of evidence) {
    requireString(item?.id, 'evidence.id', errors)
    requireCondition(checkEvidenceIds.has(item?.id), `${item?.id} is not referenced by a quality check`, errors)
    requireCondition(['static', 'runtime'].includes(item?.class), `${item?.id} class must be static or runtime`, errors)
    requireCondition(expectedControlIds.includes(item?.controlId), `${item?.id} references an unknown control`, errors)
    requireString(item?.artifactPathPattern, `${item?.id}.artifactPathPattern`, errors)
    requireString(item?.collectionPolicy, `${item?.id}.collectionPolicy`, errors)
    if (item?.class === 'static') {
      requireCondition(item?.status === 'defined' && item?.runtimeRequired === false, `${item.id} static evidence state is invalid`, errors)
      requireCondition(item?.collectionPolicy === 'repository-static-validator', `${item.id} static collection policy is invalid`, errors)
      requireCondition(String(item?.artifactPathPattern).startsWith(`${manifestRelativePath}#`), `${item.id} static artifact must be repository-addressable`, errors)
    } else {
      requireCondition(allowedRuntimeStatuses.has(item?.status) && item?.runtimeRequired === true, `${item.id} runtime evidence must remain pending/blocked`, errors)
      requireCondition(item?.collectionPolicy === 'runtime-runner-only', `${item.id} runtime collection policy is invalid`, errors)
      requireCondition(String(item?.artifactPathPattern).startsWith('evidence/g3/'), `${item.id} runtime artifact must be external evidence`, errors)
    }
  }
  for (const check of [...checks.staticChecks, ...checks.runtimeChecks]) requireCondition(evidenceIds.includes(check.evidenceId), `${check.id} evidence ${check.evidenceId} is missing from index`, errors)
  for (const requiredEvidence of manifest.runtimeGate?.requiredEvidence ?? []) requireCondition(evidenceIds.includes(requiredEvidence), `runtimeGate evidence ${requiredEvidence} is missing from index`, errors)
  for (const gate of manifest.qualityGates ?? []) {
    const gateEvidence = new Set([...gate.staticChecks ?? [], ...gate.runtimeChecks ?? []].map((check) => check?.evidenceId))
    for (const evidenceId of gate.evidenceIds ?? []) requireCondition(gateEvidence.has(evidenceId), `${gate.id} evidence ${evidenceId} is not indexed for its control`, errors)
  }
  requireCondition(evidence.filter((item) => item?.class === 'runtime').every((item) => allowedRuntimeStatuses.has(item?.status)), 'runtime evidence cannot be passed by static validation', errors)
  requireCondition(gateIds.size === expectedGateIds.length, 'G3 gate id set is invalid', errors)
}

function validateSyntheticFixtures(fixtures, manifest, errors) {
  requireCondition(fixtures?.fixturePolicy === 'synthetic-references-only-no-real-subjects-no-secrets-no-production-data', 'synthetic fixture policy is unsafe or missing', errors)
  for (const field of ['subjectRef', 'requestRef', 'traceRef', 'auditRef', 'browserRef', 'deviceRef', 'scanRef']) requireCondition(typeof fixtures?.[field] === 'string' && fixtures[field].startsWith(`${field.replace('Ref', '')}-ref://synthetic/`), `${field} must be a synthetic reference`, errors)
  requireCondition(fixtures?.productionEvidence === null && fixtures?.phase2AiProvider === null && fixtures?.phase2AiEvidence === null, 'synthetic fixtures must not contain production or Phase 2 AI evidence', errors)
  requireCondition(manifest.realProductionEvidence === null, 'real production evidence must remain null', errors)
}

function validateReportSchema(reportSchema, errors) {
  requireCondition(reportSchema?.closed === true && reportSchema?.missingEvidenceDecision === 'NO-GO', 'G3 report schema must be closed and NO-GO on missing evidence', errors)
  requireString(reportSchema?.id, 'reportSchema.id', errors)
  requireString(reportSchema?.version, 'reportSchema.version', errors)
  const schema = reportSchema?.jsonSchema
  requireCondition(isRecord(schema) && schema.type === 'object' && schema.additionalProperties === false, 'G3 report schema root must be a closed object', errors)
  requireArray(schema?.required, 'reportSchema.jsonSchema.required', errors, 8)
  for (const field of ['schemaVersion', 'reportId', 'batch', 'phase', 'decision', 'testEvidence', 'securityEvidence', 'observabilityEvidence', 'runtimeEvidenceStatus', 'reportHash']) requireCondition(schema.required.includes(field), `report schema missing ${field}`, errors)
  requireCondition(schema?.properties?.decision?.enum?.includes('NO-GO') && schema?.properties?.decision?.enum?.includes('GO'), 'report decision must model NO-GO and GO', errors)
}

function validateRuntimeRequest(manifest, env, errors) {
  const requiredEnv = manifest.runtimeGate?.requiredEnv ?? []
  const missing = requiredEnv.filter((name) => !env?.[name])
  if (missing.length > 0) {
    errors.push(`runtime gate blocked; missing environment: ${missing.join(', ')}`)
    return
  }
  for (const name of requiredEnv) {
    const value = String(env[name])
    requireCondition(!/synthetic|fixture|example\.invalid|replace_with|pending|localhost|127\.0\.0\.1/i.test(value), `${name} cannot use a synthetic or placeholder evidence reference`, errors)
    requireCondition(value.length >= 8, `${name} must reference an external evidence artifact`, errors)
  }
  // Environment variables are only references. This validator has no trusted
  // attestation channel, so a runtime request is always fail-closed.
  errors.push('runtime gate blocked; external browser/device/scan/observability evidence must be attested by an approved runner')
  requireCondition(manifest.execution?.runtimeEvidence === null, 'runtime gate blocked; manifest contains runtime evidence', errors)
  requireCondition(manifest.runtimeStatus === 'blocked' && manifest.runtimeDecision === 'BLOCKED', 'runtime gate blocked; static status cannot promote runtime', errors)
}

export function validateG3TestSecurityObservability(manifest, { runtimeRequested = runtimeRequestedByProcess, env = process.env } = {}) {
  const errors = []
  if (!isRecord(manifest)) {
    return { result: 'FAIL', staticStatus: 'FAIL', runtimeStatus: runtimeRequested ? 'blocked' : 'not-requested', errors: ['manifest must be a JSON object'] }
  }

  scanValues(manifest, 'manifest', errors)
  validateIdentityAndStatus(manifest, errors)
  validateTasks(manifest, errors)
  validateExecution(manifest.execution, errors)
  validateRuntimeGate(manifest.runtimeGate, errors)
  validateSafetyBoundaries(manifest.safetyBoundaries, errors)
  validatePhasePolicy(manifest.phasePolicy, errors)
  validateTestPolicy(manifest.testPolicy, errors)
  validateAuthorizationPolicy(manifest.authorizationPolicy, errors)
  validateReliabilityPolicy(manifest.idempotencyAndNetworkPolicy, errors)
  validatePrivacyPolicy(manifest.privacyPolicy, errors)
  validatePerformancePolicy(manifest.performancePolicy, errors)
  validateSecurityScanPolicy(manifest.securityScanPolicy, errors)
  validateObservabilityPolicy(manifest.observabilityPolicy, errors)
  const checks = validateControlsAndChecks(manifest, errors)
  validateEvidenceIndex(manifest, checks, errors)
  validateSyntheticFixtures(manifest.syntheticFixtures, manifest, errors)
  validateReportSchema(manifest.reportSchema, errors)
  if (runtimeRequested) validateRuntimeRequest(manifest, env, errors)

  const staticErrors = errors.filter((error) => !error.startsWith('runtime gate blocked;'))
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    staticStatus: staticErrors.length === 0 ? 'PASS' : 'FAIL',
    runtimeStatus: runtimeRequested ? 'blocked' : 'pending',
    runtimeGate: runtimeRequested ? 'blocked' : 'static-only',
    releaseDecision: manifest.defaultDecision,
    staticChecks: checks.staticChecks.length,
    runtimeChecks: checks.runtimeChecks.length,
    runtimeEvidencePending: (manifest.evidenceIndex ?? []).filter((item) => item?.class === 'runtime' && allowedRuntimeStatuses.has(item?.status)).length,
    runtimeBlocked: manifest.execution?.runtimeBlocked === true,
    errors,
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  let manifest
  try {
    manifest = readManifest()
  } catch (error) {
    console.error(JSON.stringify({ result: 'FAIL', errors: [`cannot read ${manifestRelativePath}: ${error.message}`] }, null, 2))
    process.exitCode = 1
  }
  if (manifest) {
    const summary = validateG3TestSecurityObservability(manifest)
    console.log(JSON.stringify(summary, null, 2))
    if (summary.result !== 'PASS') process.exitCode = 1
  }
}
