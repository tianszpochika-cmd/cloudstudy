import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifestRelativePath = 'config/g4-release-rollback.json'
const runtimeRequestedByProcess = process.argv.includes('--require-runtime') || process.env.G4_REQUIRE_RUNTIME === '1'
const expectedPlatforms = ['mobile', 'learner-web', 'admin-web', 'official-site']
const expectedArtifacts = ['api-gateway', 'iam-service', 'learner-service', 'content-service', 'learning-service', 'assessment-service', 'media-service', 'admin-ops-service']
const expectedStaticCheckIds = [
  'g4-static-immutable-artifact',
  'g4-static-manual-canary',
  'g4-static-flags-disabled',
  'g4-static-release-blocked',
  'g4-static-backup-restore',
  'g4-static-compatibility-window',
  'g4-static-platform-boundary',
  'g4-static-approval-maintenance',
  'g4-static-gitops-manual',
  'g4-static-audit-rollback',
]
const expectedRuntimeCheckIds = [
  'g4-runtime-changelog',
  'g4-runtime-compatibility',
  'g4-runtime-artifact',
  'g4-runtime-backup-restore',
  'g4-runtime-migration-rollback',
  'g4-runtime-content',
  'g4-runtime-payment',
  'g4-runtime-platform',
  'g4-runtime-approvals',
  'g4-runtime-stop-conditions',
  'g4-runtime-rollback',
  'g4-runtime-report',
]
const expectedStopConditionIds = [
  'p0-or-p1-open',
  'data-or-event-mismatch',
  'security-or-privacy-regression',
  'content-copyright-or-review-failure',
  'payment-integrity-or-refund-failure',
  'platform-health-or-pep-gap',
  'error-budget-exhausted',
  'missing-backup-or-restore-point',
  'missing-independent-approval',
  'audit-or-evidence-gap',
]
const forbiddenText = [
  /Bearer\s+[A-Za-z0-9._~-]+/i,
  /\bsk-[A-Za-z0-9]/i,
  /-----BEGIN [A-Z ]+-----/i,
  /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./,
  /AKIA[0-9A-Z]{16}/,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /(?:^|\D)(?:\+?86[- ]?)?1[3-9]\d{9}(?:$|\D)/,
]

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function loadManifest() {
  return JSON.parse(fs.readFileSync(path.join(root, manifestRelativePath), 'utf8'))
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
  const filtered = values.filter((value) => typeof value === 'string')
  requireCondition(new Set(filtered).size === filtered.length, `${label} must be unique`, errors)
}

function has(values, expected, label, errors) {
  requireCondition(Array.isArray(values) && values.includes(expected), `${label} must include ${expected}`, errors)
}

function scanValue(value, location, errors) {
  if (typeof value === 'string') {
    for (const pattern of forbiddenText) requireCondition(!pattern.test(value), `${location} contains a credential or PII pattern`, errors)
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) scanValue(child, `${location}.${key}`, errors)
}

function readSource(relativePath, errors) {
  requireCondition(typeof relativePath === 'string' && !path.isAbsolute(relativePath) && !relativePath.includes('..'), `invalid source path ${relativePath}`, errors)
  if (typeof relativePath !== 'string' || path.isAbsolute(relativePath) || relativePath.includes('..')) return ''
  const absolutePath = path.join(root, relativePath)
  if (!fs.existsSync(absolutePath)) {
    errors.push(`missing source path ${relativePath}`)
    return ''
  }
  const text = fs.readFileSync(absolutePath, 'utf8')
  for (const pattern of forbiddenText) requireCondition(!pattern.test(text), `${relativePath} contains a credential or PII pattern`, errors)
  return text
}

function validateBasis(manifest, errors) {
  requireCondition(manifest.batch === 'G4', 'batch must be G4', errors)
  requireCondition(manifest.taskId === 'V2-G4-REL-ROLLBACK-001', 'task scope must be V2-G4-REL-ROLLBACK-001', errors)
  requireCondition(manifest.phase === 'phase-1', 'G4 must remain phase-1', errors)
  requireCondition(manifest.mode === 'static-baseline', 'G4 mode must be static-baseline', errors)
  requireCondition(manifest.status === 'BLOCKED', 'G4 must remain BLOCKED until runtime evidence is accepted', errors)
  requireCondition(manifest.defaultDecision === 'NO-GO', 'G4 default decision must be NO-GO', errors)
  requireCondition(manifest.productionAction === 'disabled', 'G4 production action must be disabled', errors)
  requireArray(manifest.scope?.included, 'G4 scope included', errors, 7)
  requireArray(manifest.scope?.excluded, 'G4 scope excluded', errors, 7)
  for (const command of ['kubectl execution', 'helm execution', 'docker execution']) has(manifest.scope?.excluded, command, 'G4 scope excluded', errors)
  requireArray(manifest.sourceRefs, 'G4 source references', errors, 8)
  for (const ref of ['DoD-Gate与证据包规范', 'v2-platform-capability-matrix', 'acceptance-criteria', 'b22-production-rollout']) {
    requireCondition(manifest.sourceRefs.some((item) => String(item).includes(ref)), `G4 source references must include ${ref}`, errors)
  }
}

function validateUpstreamGates(gates, errors) {
  requireCondition(gates?.status === 'blocked' && gates?.currentDecision === 'NO-GO', 'upstream gates must remain blocked/NO-GO', errors)
  requireCondition(gates?.requiredDecision === 'GO' && gates?.missingEvidenceDecision === 'NO-GO', 'upstream gate decision policy is unsafe', errors)
  requireCondition(gates?.staticEvidenceCannotPromoteRuntime === true && gates?.syntheticEvidenceCannotPromoteRuntime === true, 'upstream static/synthetic evidence must not promote runtime', errors)
  const required = gates?.required ?? []
  requireCondition(JSON.stringify(required) === JSON.stringify(['G0', 'G1', 'G2', 'G3', 'B20', 'B21', 'B22']), 'upstream gate list is incomplete or reordered', errors)
}

function validateChangelog(changelog, errors) {
  requireCondition(changelog?.status === 'pending' && changelog?.runtimeRequired === true, 'CHANGELOG evidence must remain pending and runtime-required', errors)
  requireCondition(changelog?.sourcePath === 'CHANGELOG.md' && changelog?.entryRequired === true, 'CHANGELOG source and entry requirement are missing', errors)
  requireCondition(changelog?.entryId === 'V2-G4-REL-ROLLBACK-001' && changelog?.releaseIdMustBeBound === true, 'CHANGELOG entry must bind the G4 release identity', errors)
  requireCondition(changelog?.missingEvidenceDecision === 'NO-GO' && changelog?.staticEntryCannotCloseGate === true, 'CHANGELOG missing evidence must block and remain runtime-only', errors)
  requireArray(changelog?.requiredFields, 'CHANGELOG required fields', errors, 6)
  for (const field of ['scope', 'change', 'dataOrConfig', 'verification', 'rollback', 'uncovered']) has(changelog.requiredFields, field, 'CHANGELOG required fields', errors)
  requireString(changelog?.compatibilityWindowRef, 'CHANGELOG compatibility window reference', errors)
}

function validateCompatibility(window, errors) {
  requireCondition(window?.status === 'pending' && window?.runtimeRequired === true, 'compatibility window must remain pending and runtime-required', errors)
  requireCondition(window?.legacySystem === 'core-api' && window?.newEntryPoint === 'api-gateway' && window?.externalRoutePrefix === '/api/v1', 'compatibility window boundary is incomplete', errors)
  requireCondition(window?.windowMode === 'bounded-read-compatibility-window' && Number.isInteger(window?.windowDays) && window.windowDays > 0 && window.windowDays <= 90, 'compatibility window must be bounded', errors)
  requireCondition(window?.windowStart === null && window?.windowEnd === null, 'compatibility window cannot claim to be active in static mode', errors)
  requireCondition(window?.legacyReadAllowed === true && window?.legacyWriteAllowed === false && window?.newOwnerWriteOnly === true, 'legacy/new-owner write policy is unsafe', errors)
  requireCondition(window?.apiBackwardCompatible === true && window?.eventBackwardCompatible === true && window?.databaseExpandContractRequired === true, 'API/event/database compatibility policy is incomplete', errors)
  requireCondition(window?.expiryRequiresAudit === true && window?.mismatchDecision === 'STOP_EXPANSION_AND_ROLLBACK_OR_MANUAL_TAKEOVER', 'compatibility mismatch policy must stop expansion', errors)
  requireArray(window?.routePairs, 'compatibility route pairs', errors, 3)
  unique((window?.routePairs ?? []).map((item) => item?.operationId), 'compatibility operation ids', errors)
  for (const pair of window?.routePairs ?? []) {
    requireString(pair?.legacyRoute, 'compatibility legacy route', errors)
    requireString(pair?.gatewayRoute, 'compatibility gateway route', errors)
    requireString(pair?.owner, 'compatibility route owner', errors)
    requireString(pair?.operationId, 'compatibility operation id', errors)
  }
  requireArray(window?.requiredEvidence, 'compatibility required evidence', errors, 5)
}

function validateArtifacts(policy, errors) {
  requireCondition(policy?.status === 'pending', 'immutable artifact Gate must remain pending', errors)
  for (const field of ['requireDigest', 'requireSignature', 'requireSBOM', 'requireProvenance', 'releaseIdAndSourceRevisionBindingRequired']) requireCondition(policy?.[field] === true, `immutable artifact policy ${field} must be true`, errors)
  requireCondition(policy?.mutableTagAllowed === false && policy?.sameDigestAcrossPromotion === true, 'mutable tags or digest changes across promotion are not allowed', errors)
  requireArray(policy?.forbiddenReferences, 'immutable artifact forbidden references', errors, 4)
  const artifacts = policy?.artifacts ?? []
  requireCondition(JSON.stringify(artifacts.map((item) => item?.id)) === JSON.stringify(expectedArtifacts), 'immutable artifact set is incomplete or reordered', errors)
  unique(artifacts.map((item) => item?.id), 'artifact ids', errors)
  for (const artifact of artifacts) {
    requireString(artifact?.image, `${artifact?.id}.image`, errors)
    requireString(artifact?.digest, `${artifact?.id}.digest`, errors)
    requireCondition(/^registry\.example\.invalid\/englishflow\/[a-z0-9-]+@sha256:[0-9a-f]{64}$/.test(artifact?.image ?? ''), `${artifact?.id} must use an immutable digest image`, errors)
    requireCondition(/^sha256:[0-9a-f]{64}$/.test(artifact?.digest ?? ''), `${artifact?.id}.digest must be SHA-256`, errors)
    requireCondition(artifact?.image?.endsWith(`@${artifact.digest}`), `${artifact?.id} image and digest must match`, errors)
    requireCondition(!/(?:latest\b|(?:^|\/)\w[\w-]*:(?!sha256:)[^@\s/]+$)/i.test(artifact?.image ?? ''), `${artifact?.id} contains a mutable artifact reference`, errors)
    requireCondition(artifact?.signatureStatus === 'pending' && artifact?.sbomStatus === 'pending' && artifact?.provenanceStatus === 'pending', `${artifact?.id} runtime supply-chain evidence must remain pending`, errors)
    for (const field of ['signatureRef', 'sbomRef', 'provenanceRef']) requireString(artifact?.[field], `${artifact?.id}.${field}`, errors)
  }
}

function validateBackupRestore(backup, errors) {
  requireCondition(backup?.status === 'not-established' && backup?.required === true && backup?.runtimeRequired === true, 'backup/restore Gate must remain not-established and runtime-required', errors)
  requireCondition(Number.isInteger(backup?.rpoMinutes) && backup.rpoMinutes > 0 && Number.isInteger(backup?.rtoMinutes) && backup.rtoMinutes > 0, 'backup RPO/RTO must be positive bounded values', errors)
  const restorePoint = backup?.restorePoint
  requireCondition(restorePoint?.status === 'not-established' && restorePoint?.createdBeforeTrafficChange === true && restorePoint?.immutable === true && restorePoint?.integrityCheckRequired === true, 'restore point must be required, immutable and not-established', errors)
  for (const field of ['sourceRevision', 'artifactDigest', 'capturedAt', 'evidenceRef']) requireCondition(restorePoint?.[field] === null, `backup restore point ${field} must remain null until runtime evidence`, errors)
  const sourceIds = (backup?.sources ?? []).map((item) => item?.id)
  requireCondition(JSON.stringify(sourceIds) === JSON.stringify(['mysql-pitr', 'redis-snapshot', 'kafka-offset-and-dlq', 'object-storage-version']), 'backup sources are incomplete or reordered', errors)
  for (const source of backup?.sources ?? []) requireCondition(source?.required === true && source?.status === 'pending', `${source?.id} backup source must remain pending`, errors)
  requireArray(backup?.recoveryScenarios, 'backup recovery scenarios', errors, 5)
  requireCondition(backup?.dataAndEventReconciliationRequired === true, 'backup recovery must include data/event reconciliation', errors)
  for (const boundary of ['process-restart', 'directory-exists', 'synthetic-fixture', 'health-http-200']) has(backup?.cannotBeSatisfiedBy, boundary, 'backup fake-pass boundaries', errors)
}

function validateMigrationRollback(migration, errors) {
  requireCondition(migration?.status === 'blocked' && migration?.runtimeRequired === true, 'migration/rollback Gate must remain blocked and runtime-required', errors)
  requireCondition(migration?.strategy === 'expand-contract-forward-compatible' && migration?.migrationRunner === 'owner-service-flyway-runner', 'migration strategy must be owner-local expand/contract', errors)
  requireCondition(migration?.lockRequired === true && migration?.destructiveDowngradeAllowed === false && migration?.crossServiceTableWriteAllowed === false && migration?.twoPhaseCommitAllowed === false, 'migration safety policy is unsafe', errors)
  requireCondition(migration?.legacyWriteAllowed === false && migration?.compatibilityWindowRequired === true, 'migration compatibility write policy is unsafe', errors)
  requireArray(migration?.requiredScenarios, 'migration required scenarios', errors, 6)
  requireCondition(migration?.failureDecision === 'STOP_EXPANSION_AND_ROLLBACK_OR_MANUAL_TAKEOVER', 'migration failure must stop expansion', errors)
  requireCondition(migration?.rollbackEvidence?.status === 'pending' && migration.rollbackEvidence.runtimeRequired === true && migration.rollbackEvidence.versionBound === true && migration.rollbackEvidence.ownerRequired === true && migration.rollbackEvidence.compensationRequired === true && migration.rollbackEvidence.auditRequired === true, 'migration rollback evidence policy is incomplete', errors)
}

function validateContentGate(gate, errors) {
  requireCondition(gate?.status === 'blocked' && gate?.defaultDecision === 'NO-GO' && gate?.runtimeRequired === true, 'content Gate must remain blocked/NO-GO/runtime-required', errors)
  for (const field of ['draftIsolationRequired', 'copyrightAndSourceRequired', 'dualApprovalRequired', 'versionedReleaseRequired', 'withdrawAndRestoreRequired', 'learnerCannotSeeDraft']) requireCondition(gate?.[field] === true, `content Gate ${field} must be true`, errors)
  requireCondition(gate?.minimumIndependentApprovals >= 2, 'content Gate must require two independent approvals', errors)
  requireArray(gate?.requiredChecks, 'content Gate checks', errors, 6)
  requireArray(gate?.requiredEvidence, 'content Gate evidence', errors, 4)
  requireCondition(gate?.missingEvidenceDecision === 'NO-GO', 'content Gate missing evidence must be NO-GO', errors)
}

function validatePaymentGate(gate, errors) {
  requireCondition(gate?.status === 'disabled' && gate?.defaultDecision === 'NO-GO' && gate?.runtimeRequired === true, 'payment Gate must remain disabled/NO-GO/runtime-required', errors)
  requireCondition(gate?.realPaymentEnabled === false && gate?.sandboxOnly === true && gate?.merchantQualificationRequired === true, 'real payment must remain disabled until qualification', errors)
  for (const field of ['channelSignatureVerificationRequired', 'webhookIdempotencyRequired', 'refundAndReconciliationRequired', 'entitlementAuditRequired']) requireCondition(gate?.[field] === true, `payment Gate ${field} must be true`, errors)
  requireCondition(gate?.privateKeyInRepositoryAllowed === false && gate?.paymentTrafficSwitchRequiresIndependentApproval === true, 'payment secret and traffic policy is unsafe', errors)
  requireArray(gate?.requiredEvidence, 'payment Gate evidence', errors, 5)
  requireCondition(gate?.missingEvidenceDecision === 'NO-GO', 'payment Gate missing evidence must be NO-GO', errors)
}

function validatePlatformGate(gate, errors) {
  requireCondition(gate?.status === 'blocked' && gate?.defaultDecision === 'NO-GO' && gate?.runtimeRequired === true, 'platform Gate must remain blocked/NO-GO/runtime-required', errors)
  for (const field of ['externalTrafficGatewayOnly', 'gatewayRouteRollbackRequired', 'domainServicesValidateJwt', 'domainServicesEnforcePep', 'clientRoleHeadersIgnored', 'clientTenantAndOwnerFieldsUntrusted', 'healthAndReadinessRequired', 'sloAndAlertingRequired', 'fourPlatformBindingRequired']) requireCondition(gate?.[field] === true, `platform Gate ${field} must be true`, errors)
  requireCondition(gate?.gatewayRoutePrefix === '/api/v1' && gate?.directDomainTrafficPublic === false, 'platform external route boundary is unsafe', errors)
  const platforms = gate?.platforms ?? []
  requireCondition(JSON.stringify(platforms.map((item) => item?.id)) === JSON.stringify(expectedPlatforms), 'platform Gate four-client set is incomplete or reordered', errors)
  for (const platform of platforms) requireString(platform?.projectPath, `${platform?.id}.projectPath`, errors)
  for (const platform of platforms) requireCondition(platform?.status === 'pending' && typeof platform?.releaseFlag === 'string', `${platform?.id} platform binding must remain pending`, errors)
  requireArray(gate?.requiredEvidence, 'platform Gate evidence', errors, 5)
  requireCondition(gate?.missingEvidenceDecision === 'NO-GO', 'platform Gate missing evidence must be NO-GO', errors)
}

function validateTrafficPlan(plan, errors) {
  requireCondition(plan?.status === 'blocked' && plan?.trafficSwitchAllowed === false && plan?.automaticPromotion === false && plan?.manualApprovalRequired === true, 'traffic plan must be blocked, disabled and manual', errors)
  requireCondition(plan?.minimumIndependentApprovals >= 2, 'traffic expansion must require independent approvals', errors)
  const stages = plan?.stages ?? []
  requireCondition(JSON.stringify(stages.map((stage) => stage?.trafficPercent)) === JSON.stringify([1, 5, 25, 50, 100]), 'traffic stages must be 1/5/25/50/100 percent', errors)
  for (const stage of stages) requireCondition(stage?.enabled === false && stage?.status === 'blocked' && stage?.decision === 'NO-GO', `${stage?.id} must remain disabled/blocked/NO-GO`, errors)
  requireArray(plan?.expansionRequires, 'traffic expansion requirements', errors, 9)
}

function validateApprovals(approvals, maintenance, errors) {
  requireCondition(approvals?.status === 'pending' && approvals?.runtimeRequired === true, 'release approvals must remain pending and runtime-required', errors)
  requireCondition(approvals?.minimumIndependentApprovals >= 5 && approvals?.dualControlForReleaseAndRollback === true, 'release approvals must require independent dual control', errors)
  const roles = approvals?.requiredRoles ?? []
  requireCondition(JSON.stringify(roles) === JSON.stringify(['product', 'architecture', 'security', 'data', 'operations']), 'approval roles are incomplete or reordered', errors)
  requireArray(approvals?.approvalRefs, 'approval evidence references', errors, 5)
  requireCondition(approvals?.missingApprovalDecision === 'NO-GO' && approvals?.staticApprovalCannotCloseGate === true, 'missing approval must remain NO-GO', errors)
  requireCondition(maintenance?.status === 'pending' && maintenance?.runtimeRequired === true && maintenance?.namedOwnerRequired === true && maintenance?.windowRequired === true && maintenance?.signoffRequired === true, 'maintenance responsibility must remain pending and owner-gated', errors)
  requireString(maintenance?.ownerRef, 'maintenance owner reference', errors)
  requireString(maintenance?.runbookRef, 'maintenance runbook reference', errors)
}

function validateStopConditions(conditions, errors) {
  requireCondition(JSON.stringify((conditions ?? []).map((item) => item?.id)) === JSON.stringify(expectedStopConditionIds), 'stop expansion conditions are incomplete or reordered', errors)
  for (const condition of conditions ?? []) requireCondition(/FREEZE|STOP|BLOCK|DISABLE|ROLLBACK/i.test(condition?.action ?? ''), `${condition?.id} must freeze, stop, block, disable or rollback`, errors)
}

function validateRollback(rollback, errors) {
  requireCondition(rollback?.status === 'blocked' && rollback?.runtimeRequired === true, 'rollback Gate must remain blocked and runtime-required', errors)
  requireCondition(rollback?.automatic?.enabled === true && rollback?.manual?.enabled === true, 'automatic and manual rollback must both be defined', errors)
  requireCondition(rollback?.automatic?.status === 'pending' && rollback?.manual?.status === 'pending', 'rollback runtime status must remain pending', errors)
  requireCondition(rollback?.automatic?.rollbackTargetMustBeDigestBound === true && rollback?.automatic?.evidenceRequired === true, 'automatic rollback must be digest-bound and audited', errors)
  requireCondition(rollback?.manual?.requiresNamedOwner === true && rollback?.manual?.requiresIndependentApproval === true && rollback.manual.minimumApprovers >= 2 && rollback.manual.evidenceRequired === true, 'manual rollback governance is incomplete', errors)
  requireCondition(rollback?.restorePoint?.required === true && rollback?.restorePoint?.status === 'not-established' && rollback.restorePoint.createdBeforeTrafficChange === true && rollback.restorePoint.integrityCheckRequired === true && rollback.restorePoint.restoreAndReconcileRequired === true, 'rollback restore point must be required and not-established', errors)
  requireCondition(rollback?.mismatchDecision === 'ROLLBACK_OR_MANUAL_TAKEOVER', 'rollback mismatch decision must be explicit', errors)
  requireArray(rollback?.sequence, 'rollback sequence', errors, 9)
  requireCondition(rollback?.audit?.required === true && rollback?.audit?.status === 'pending' && rollback.audit.appendOnly === true && rollback.audit.externalSinkRequired === true, 'rollback audit must be append-only, external and pending', errors)
  requireArray(rollback?.audit?.fields, 'rollback audit fields', errors, 10)
}

function validateAudit(audit, errors) {
  requireCondition(audit?.status === 'pending' && audit?.runtimeRequired === true && audit?.required === true && audit?.appendOnly === true && audit?.externalSinkRequired === true, 'release audit must be pending, append-only and external', errors)
  requireCondition(audit?.redactionRequired === true && audit?.secretAndPiiFree === true && audit?.rollbackEvidenceRequired === true && audit?.missingEvidenceDecision === 'NO-GO', 'release audit privacy and rollback policy is incomplete', errors)
  requireArray(audit?.correlationFields, 'release audit correlation fields', errors, 6)
}

function validateChecks(checks, errors) {
  const staticChecks = checks?.staticChecks ?? []
  const runtimeChecks = checks?.runtimeChecks ?? []
  requireCondition(JSON.stringify(staticChecks.map((item) => item?.id)) === JSON.stringify(expectedStaticCheckIds), 'G4 static check ids are incomplete or reordered', errors)
  requireCondition(JSON.stringify(runtimeChecks.map((item) => item?.id)) === JSON.stringify(expectedRuntimeCheckIds), 'G4 runtime check ids are incomplete or reordered', errors)
  unique([...staticChecks, ...runtimeChecks].map((item) => item?.id), 'G4 release check ids', errors)
  for (const check of staticChecks) {
    requireCondition(check?.status === 'defined' && check?.evidenceClass === 'static' && check?.runtimeRequired === false, `${check?.id} static state is invalid`, errors)
    requireArray(check?.sourcePaths, `${check?.id}.sourcePaths`, errors)
    requireArray(check?.assertions, `${check?.id}.assertions`, errors)
    const sourceText = (check?.sourcePaths ?? []).map((sourcePath) => readSource(sourcePath, errors)).join('\n')
    for (const assertion of check?.assertions ?? []) {
      if (typeof assertion?.contains === 'string') requireCondition(sourceText.includes(assertion.contains), `${check?.id} missing source marker ${assertion.contains}`, errors)
      else if (typeof assertion?.regex === 'string') {
        try { requireCondition(new RegExp(assertion.regex, assertion.flags ?? '').test(sourceText), `${check?.id} source regex did not match`, errors) } catch (error) { errors.push(`${check?.id} has invalid source regex: ${error.message}`) }
      } else errors.push(`${check?.id} assertion must contain contains or regex`)
    }
  }
  for (const check of runtimeChecks) {
    requireCondition(['pending', 'blocked'].includes(check?.status) && check?.evidenceClass === 'runtime' && check?.runtimeRequired === true, `${check?.id} runtime state must remain pending/blocked`, errors)
    requireArray(check?.evidenceRequired, `${check?.id}.evidenceRequired`, errors, 2)
    requireArray(check?.cannotBeSatisfiedBy, `${check?.id}.cannotBeSatisfiedBy`, errors, 2)
    for (const boundary of ['synthetic-evidence']) has(check?.cannotBeSatisfiedBy, boundary, `${check?.id}.cannotBeSatisfiedBy`, errors)
  }
}

function validateRuntimeGate(gate, errors) {
  requireCondition(gate?.staticOnlyByDefault === true && gate?.requireRuntimeEnv === 'G4_REQUIRE_RUNTIME', 'G4 runtime gate must be static-only and use G4_REQUIRE_RUNTIME', errors)
  requireCondition(gate?.runtimeEvidenceMustBeCapturedExternally === true && gate?.staticValidatorCannotPromoteRuntime === true && gate?.runtimeStatusWhenMissing === 'blocked', 'G4 runtime evidence must be external, blocked when missing and non-promotable', errors)
  requireArray(gate?.requiredEnv, 'G4 runtime required env', errors, 12)
  unique(gate?.requiredEnv ?? [], 'G4 runtime required env', errors)
  for (const name of gate?.requiredEnv ?? []) requireCondition(/^G4_RUNTIME_[A-Z0-9_]+$/.test(name), `invalid G4 runtime environment variable ${name}`, errors)
  requireArray(gate?.requiredEvidence, 'G4 runtime required evidence', errors, 12)
  requireArray(gate?.cannotBeSatisfiedBy, 'G4 runtime fake-pass boundaries', errors, 6)
  for (const boundary of ['static-manifest-only', 'synthetic-fixture-only', 'directory-exists', 'development-http-200', 'unapproved-traffic-change']) has(gate?.cannotBeSatisfiedBy, boundary, 'G4 runtime fake-pass boundaries', errors)
}

function validateEvidenceIndex(index, checks, errors) {
  requireArray(index, 'G4 evidence index', errors, 22)
  const ids = (index ?? []).map((item) => item?.id)
  unique(ids, 'G4 evidence ids', errors)
  const referenced = new Set([...checks.staticChecks, ...checks.runtimeChecks].map((item) => item?.id))
  for (const item of index ?? []) {
    requireString(item?.id, 'evidence id', errors)
    requireString(item?.artifactPathPattern, `${item?.id}.artifactPathPattern`, errors)
    if (item?.class === 'static') {
      requireCondition(item?.status === 'defined' && item?.runtimeRequired === false && item?.collectionPolicy === 'repository-static-validator' && item.artifactPathPattern.startsWith('deploy/g4/'), `${item?.id} static evidence policy is invalid`, errors)
    } else if (item?.class === 'runtime') {
      requireCondition(item?.status === 'pending' && item?.runtimeRequired === true && item?.collectionPolicy === 'approved-runtime-runner-only' && item.artifactPathPattern.startsWith('evidence/g4/'), `${item?.id} runtime evidence policy is invalid`, errors)
    } else errors.push(`${item?.id} evidence class must be static or runtime`)
  }
  for (const id of referenced) requireCondition(ids.includes(id), `release check evidence is missing from index: ${id}`, errors)
  for (const id of ids) requireCondition(referenced.has(id), `evidence index id is not bound to a release check: ${id}`, errors)
  requireCondition(JSON.stringify(ids) === JSON.stringify([...expectedStaticCheckIds, ...expectedRuntimeCheckIds]), 'G4 evidence index ids/order must match release checks', errors)
}

function validateReportSchema(schema, errors) {
  requireCondition(schema?.closed === true && schema?.missingEvidenceDecision === 'NO-GO' && schema?.goRequiresAllRuntimeEvidence === true && schema?.goRequiresRestorePoint === true && schema?.goRequiresRollbackEvidence === true, 'G4 report schema must be closed and fail closed', errors)
  requireArray(schema?.required, 'G4 report required fields', errors, 17)
  for (const field of ['releaseId', 'sourceRevision', 'artifactDigests', 'changelog', 'compatibilityWindow', 'migration', 'rollback', 'backupRestore', 'contentGate', 'paymentGate', 'platformGate', 'approvals', 'maintenance', 'stopConditions', 'audit', 'evidenceRefs', 'decision']) has(schema.required, field, 'G4 report required fields', errors)
  for (const decision of ['NO-GO', 'BLOCKED', 'GO']) has(schema?.decisionEnum, decision, 'G4 report decision enum', errors)
}

function validateRuntimeRequest(manifest, env, errors) {
  const requiredEnv = manifest.runtimeGate?.requiredEnv ?? []
  const missing = requiredEnv.filter((name) => !env?.[name])
  if (missing.length > 0) {
    errors.push(`runtime gate blocked; missing environment: ${missing.join(', ')}`)
    return
  }
  for (const name of requiredEnv) requireCondition(!/synthetic|example\.invalid|fixture|replace_with|pending|todo|fake/i.test(String(env[name])), `${name} cannot use a synthetic or placeholder evidence reference`, errors)
  requireCondition(manifest.upstreamGates?.status === 'accepted' && manifest.upstreamGates?.currentDecision === 'GO', 'runtime gate blocked; upstream G0-G3/B20-B22 acceptance is not GO', errors)
  requireCondition(manifest.status === 'READY' && manifest.defaultDecision === 'GO' && manifest.productionAction === 'enabled', 'runtime gate blocked; G4 release baseline is not accepted', errors)
  requireCondition(manifest.changelog?.status === 'accepted' && manifest.compatibilityWindow?.status === 'accepted', 'runtime gate blocked; CHANGELOG or compatibility window is not accepted', errors)
  requireCondition(manifest.backupRestore?.status === 'established' && manifest.backupRestore?.restorePoint?.status === 'established', 'runtime gate blocked; restore point is not established', errors)
  requireCondition((manifest.immutableArtifactPolicy?.artifacts ?? []).every((item) => item.signatureStatus === 'verified' && item.sbomStatus === 'verified' && item.provenanceStatus === 'verified'), 'runtime gate blocked; artifact supply-chain evidence is not verified', errors)
  requireCondition(manifest.contentGate?.status === 'accepted' && manifest.contentGate?.defaultDecision === 'GO', 'runtime gate blocked; content Gate is not accepted', errors)
  requireCondition(manifest.paymentGate?.status === 'accepted' && manifest.paymentGate?.realPaymentEnabled === false, 'runtime gate blocked; payment Gate is not accepted or real payment is enabled', errors)
  requireCondition(manifest.platformGate?.status === 'accepted' && manifest.platformGate?.defaultDecision === 'GO', 'runtime gate blocked; platform Gate is not accepted', errors)
  requireCondition(manifest.approvals?.status === 'accepted' && manifest.maintenance?.status === 'accepted', 'runtime gate blocked; approvals or maintenance signoff is not accepted', errors)
  requireCondition((manifest.releaseChecks?.runtimeChecks ?? []).every((check) => check.status === 'captured'), 'runtime gate blocked; runtime release checks remain pending or blocked', errors)
  requireCondition((manifest.trafficPlan?.stages ?? []).every((stage) => stage.enabled === true && stage.decision === 'GO'), 'runtime gate blocked; traffic stages are not approved', errors)
}

export function validateG4ReleaseRollback(manifest = loadManifest(), { runtimeRequested = runtimeRequestedByProcess, env = process.env } = {}) {
  const errors = []
  if (!isRecord(manifest)) return { result: 'FAIL', status: 'BLOCKED', releaseDecision: 'NO-GO', runtimeGate: runtimeRequested ? 'blocked' : 'static-only', staticChecks: 0, runtimeChecks: 0, errors: ['manifest must be a JSON object'] }
  scanValue(manifest, 'manifest', errors)
  validateBasis(manifest, errors)
  validateUpstreamGates(manifest.upstreamGates, errors)
  validateChangelog(manifest.changelog, errors)
  validateCompatibility(manifest.compatibilityWindow, errors)
  validateArtifacts(manifest.immutableArtifactPolicy, errors)
  validateBackupRestore(manifest.backupRestore, errors)
  validateMigrationRollback(manifest.migrationRollback, errors)
  validateContentGate(manifest.contentGate, errors)
  validatePaymentGate(manifest.paymentGate, errors)
  validatePlatformGate(manifest.platformGate, errors)
  validateTrafficPlan(manifest.trafficPlan, errors)
  validateApprovals(manifest.approvals, manifest.maintenance, errors)
  validateStopConditions(manifest.stopExpansionConditions, errors)
  validateRollback(manifest.rollback, errors)
  validateAudit(manifest.audit, errors)
  validateChecks(manifest.releaseChecks, errors)
  validateRuntimeGate(manifest.runtimeGate, errors)
  validateEvidenceIndex(manifest.evidenceIndex, manifest.releaseChecks, errors)
  validateReportSchema(manifest.reportSchema, errors)
  if (runtimeRequested) validateRuntimeRequest(manifest, env, errors)
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    status: manifest.status,
    releaseDecision: manifest.defaultDecision,
    runtimeGate: runtimeRequested ? (errors.length === 0 ? 'accepted' : 'blocked') : 'static-only',
    staticChecks: manifest.releaseChecks?.staticChecks?.length ?? 0,
    runtimeChecks: manifest.releaseChecks?.runtimeChecks?.length ?? 0,
    evidenceCount: manifest.evidenceIndex?.length ?? 0,
    errors,
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let manifest
  try {
    manifest = loadManifest()
  } catch (error) {
    console.error(JSON.stringify({ result: 'FAIL', errors: [`cannot read ${manifestRelativePath}: ${error.message}`] }, null, 2))
    process.exitCode = 1
  }
  if (manifest) {
    const summary = validateG4ReleaseRollback(manifest)
    console.log(JSON.stringify(summary, null, 2))
    if (summary.result !== 'PASS') process.exitCode = 1
  }
}
