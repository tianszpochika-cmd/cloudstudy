import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifestRelativePath = 'config/b27-quality-release.json'
const runtimeRequestedByProcess = process.argv.includes('--require-runtime') || process.env.B27_REQUIRE_RUNTIME === '1'
const expectedTasks = ['V2-B27-QUAL-003', 'V2-B27-STG-004']
const expectedApps = ['mobile', 'learner-web', 'admin-web', 'official-site']
const forbiddenMaterial = [
  /-----BEGIN [A-Z ]+-----/i,
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/i,
  /\b(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,})\b/i,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/i,
  /[A-Za-z0-9._%+-]+@(gmail|qq|163|outlook|hotmail)\.[A-Za-z]{2,}/i,
  /(?:^|\D)(?:\+?86[- ]?)?1[3-9]\d{9}(?:$|\D)/,
  /https?:\/\/(?!(?:json-schema\.org|englishflow\.invalid|registry\.example\.invalid)(?:\/|$))/i,
]

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function loadManifest() {
  return JSON.parse(fs.readFileSync(path.join(root, manifestRelativePath), 'utf8'))
}

function fail(condition, message, errors) {
  if (!condition) errors.push(message)
}

function requireArray(value, label, errors, minimum = 1) {
  fail(Array.isArray(value) && value.length >= minimum, `${label} must contain at least ${minimum} item(s)`, errors)
}

function requireString(value, label, errors) {
  fail(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`, errors)
}

function unique(values, label, errors) {
  const strings = values.filter((value) => typeof value === 'string')
  fail(new Set(strings).size === strings.length, `${label} must be unique`, errors)
}

function scanValue(value, location, errors) {
  if (typeof value === 'string') {
    for (const pattern of forbiddenMaterial) fail(!pattern.test(value), `${location} contains forbidden credential, PII or production-domain material`, errors)
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) scanValue(child, `${location}.${key}`, errors)
}

function readSource(relativePath, errors) {
  fail(typeof relativePath === 'string' && !path.isAbsolute(relativePath) && !relativePath.includes('..'), `invalid source path ${relativePath}`, errors)
  if (typeof relativePath !== 'string' || path.isAbsolute(relativePath) || relativePath.includes('..')) return ''
  const absolutePath = path.join(root, relativePath)
  if (!fs.existsSync(absolutePath)) {
    errors.push(`missing source path ${relativePath}`)
    return ''
  }
  return fs.readFileSync(absolutePath, 'utf8')
}

function validateSourceBackedCheck(check, errors) {
  requireString(check?.id, 'static check id', errors)
  fail(check?.status === 'defined', `${check?.id} static status must be defined`, errors)
  fail(check?.evidenceClass === 'static', `${check?.id} must be static evidence`, errors)
  fail(check?.runtimeRequired === false, `${check?.id} static check cannot require runtime`, errors)
  requireArray(check?.sourcePaths, `${check?.id}.sourcePaths`, errors)
  requireArray(check?.assertions, `${check?.id}.assertions`, errors)
  for (const sourcePath of check?.sourcePaths ?? []) readSource(sourcePath, errors)
  for (const assertion of check?.assertions ?? []) {
    const sourceText = readSource(assertion?.sourcePath, errors)
    requireString(assertion?.contains, `${check?.id}.assertion.contains`, errors)
    if (sourceText && assertion?.contains) fail(sourceText.includes(assertion.contains), `${check?.id} missing source marker ${assertion.contains}`, errors)
  }
}

function validateRuntimeCheck(check, errors) {
  requireString(check?.id, 'runtime check id', errors)
  fail(check?.status === 'pending', `${check?.id} runtime status must remain pending`, errors)
  fail(check?.evidenceClass === 'runtime', `${check?.id} must be runtime evidence`, errors)
  fail(check?.runtimeRequired === true, `${check?.id} must require runtime`, errors)
  requireArray(check?.evidenceRequired, `${check?.id}.evidenceRequired`, errors)
  requireArray(check?.cannotBeSatisfiedBy, `${check?.id}.cannotBeSatisfiedBy`, errors)
  fail(!/\b(?:pass|passed|captured|verified|approved)\b/i.test(JSON.stringify(check)), `${check?.id} cannot claim runtime evidence`, errors)
}

function validateTasks(config, errors) {
  requireArray(config?.tasks, 'tasks', errors, expectedTasks.length)
  const ids = (config?.tasks ?? []).map((task) => task?.id)
  fail(JSON.stringify(ids) === JSON.stringify(expectedTasks), 'B27 task IDs/order must be QUAL-003 and STG-004', errors)
  unique(ids, 'task ids', errors)
  for (const task of config?.tasks ?? []) {
    fail(task?.status === 'defined', `${task?.id} must remain defined`, errors)
    fail(task?.runtimeRequired === true, `${task?.id} must require runtime evidence`, errors)
    fail(task?.defaultDecision === 'NO-GO', `${task?.id} default decision must be NO-GO`, errors)
    requireArray(task?.scope, `${task?.id}.scope`, errors, 3)
    requireArray(task?.dependsOn, `${task?.id}.dependsOn`, errors, 1)
  }
}

function validateExecution(config, errors) {
  const execution = config?.execution
  fail(isRecord(execution), 'execution is required', errors)
  if (!isRecord(execution)) return
  fail(execution.mode === 'static-fixture-only', 'execution must be static-fixture-only', errors)
  fail(execution.status === 'runtimeBlocked' && execution.runtimeBlocked === true, 'execution must remain runtimeBlocked', errors)
  fail(execution.allowUnverifiedPass === false, 'unverified runtime pass must be disabled', errors)
  fail(execution.staticValidatorCannotPromoteRuntime === true, 'static validator must not promote runtime', errors)
  fail(execution.runtimeEvidence === null, 'runtime evidence must remain null in the static slice', errors)
  for (const field of ['productionMutationAllowed', 'trafficSwitchAllowed', 'secretMaterialAllowed', 'paymentOperationAllowed', 'destructiveOperationAllowed']) fail(execution[field] === false, `execution.${field} must be false`, errors)
  requireArray(execution.blockedReasons, 'execution.blockedReasons', errors, 3)
}

function validateRuntimeGate(config, errors) {
  const gate = config?.runtimeGate
  fail(isRecord(gate), 'runtimeGate is required', errors)
  if (!isRecord(gate)) return
  fail(gate.staticOnlyByDefault === true, 'runtime gate must be static-only by default', errors)
  requireString(gate.requireRuntimeEnv, 'runtimeGate.requireRuntimeEnv', errors)
  requireArray(gate.requiredEnv, 'runtimeGate.requiredEnv', errors, 5)
  requireArray(gate.requiredEvidence, 'runtimeGate.requiredEvidence', errors, 5)
  fail(gate.runtimeStatusWhenMissing === 'blocked', 'missing runtime evidence must block', errors)
  fail(gate.runtimeEvidenceMustBeCapturedExternally === true, 'runtime evidence must be externally captured', errors)
  fail(gate.runtimeEvidenceMustRemainPendingOrBlocked === true, 'runtime evidence must remain pending or blocked', errors)
  fail(gate.staticValidatorCannotPromoteRuntime === true, 'runtime gate must reject static promotion', errors)
  requireArray(gate.cannotBeSatisfiedBy, 'runtimeGate.cannotBeSatisfiedBy', errors, 5)
}

function validateAuthorizationAndSecurity(config, errors) {
  const quality = config?.securityQuality
  fail(isRecord(quality) && quality.defaultDecision === 'BLOCKED', 'security quality must default to BLOCKED', errors)
  const authorization = quality?.authorization
  for (const [field, expected] of Object.entries({ defaultDeny: true, gatewayJwtPreValidation: true, serviceSidePepRequired: true, clientRoleHeadersTrusted: false, clientTenantHeadersTrusted: false, tenantDerivedServerSide: true, ownerAndResourceCheckRequired: true })) fail(authorization?.[field] === expected, `authorization.${field} has unsafe value`, errors)
  fail(authorization?.pdpFailureDecision === 'fail-closed' && authorization?.revocationOrPolicyVersionFailureDecision === 'fail-closed', 'authorization failure paths must fail closed', errors)
  fail(authorization?.crossTenantAccessDecision === 'deny', 'cross-tenant access must deny by default', errors)
  requireArray(authorization?.requiredDecisionInputs, 'authorization.requiredDecisionInputs', errors, 7)

  const cors = quality?.cors
  fail(cors?.policy === 'explicit-runtime-origin-allowlist', 'CORS must use an explicit runtime origin allowlist', errors)
  fail(cors?.allowedOriginsSource === 'runtime-env-only', 'CORS origins must come from runtime environment', errors)
  for (const field of ['wildcardOriginAllowed', 'originReflectionAllowed', 'privateNetworkAccessAllowed']) fail(cors?.[field] === false, `cors.${field} must be false`, errors)
  fail(cors?.credentialsAllowed === true && cors?.varyOriginRequired === true && cors?.preflightRequired === true, 'CORS credential/preflight boundary is incomplete', errors)
  fail(cors?.preflightDeniedOriginStatus === 403, 'denied CORS preflight must return 403', errors)
  requireArray(cors?.allowHeaders, 'cors.allowHeaders', errors, 2)

  const limiter = quality?.rateLimiting
  fail(limiter?.algorithm === 'token-bucket' && limiter?.enforcementPoint === 'gateway-and-sensitive-service', 'rate limiting boundary is incomplete', errors)
  requireArray(limiter?.dimensions, 'rateLimiting.dimensions', errors, 3)
  fail(limiter?.clientSuppliedRoleDimensionAllowed === false && limiter?.responseStatus === 429 && limiter?.retryAfterRequired === true && limiter?.failOpenOnLimiterFailure === false, 'rate limiting must fail closed and return retry metadata', errors)
  requireArray(limiter?.sensitiveRouteOverrides, 'rateLimiting.sensitiveRouteOverrides', errors, 3)

  const jwks = quality?.jwks
  fail(jwks?.protocol === 'OIDC-OAuth2.1', 'JWKS must be bound to standard OIDC/OAuth 2.1', errors)
  fail(jwks?.issuerSource === 'runtime-env-only' && jwks?.jwksUriSource === 'runtime-env-only', 'JWKS issuer and URI must be runtime-only', errors)
  fail(JSON.stringify(jwks?.allowedAlgorithms) === JSON.stringify(['RS256', 'ES256']), 'JWKS allowed algorithms must be asymmetric', errors)
  fail((jwks?.forbiddenAlgorithms ?? []).includes('none') && (jwks?.forbiddenAlgorithms ?? []).includes('HS256'), 'JWKS unsafe algorithms must be forbidden', errors)
  for (const field of ['issuerAndAudienceValidation', 'keyRotationRequired', 'tokenForwardingToLogs']) fail(jwks?.[field] === (field === 'tokenForwardingToLogs' ? false : true), `jwks.${field} has unsafe value`, errors)
  fail(jwks?.unknownKeyDecision === 'fail-closed' && jwks?.jwksUnavailableDecision === 'fail-closed', 'JWKS failure paths must fail closed', errors)
  fail(jwks?.expiredTokenDecision === '401' && jwks?.missingScopeDecision === '403', 'JWKS authentication/authorization status mapping is incomplete', errors)

  const privacy = quality?.privacyRedaction
  fail(privacy?.policy === 'redact-or-do-not-record', 'privacy policy must redact or avoid recording sensitive data', errors)
  fail(privacy?.rawPiiAllowed === false && privacy?.rawMediaAllowed === false && privacy?.productionCredentialsAllowed === false && privacy?.paymentCredentialsAllowed === false, 'privacy raw material must be forbidden', errors)
  requireArray(privacy?.redactFields, 'privacyRedaction.redactFields', errors, 7)
  requireArray(privacy?.redactSources, 'privacyRedaction.redactSources', errors, 5)
  fail(privacy?.evidenceMustBeReproducibleWithoutPii === true, 'privacy evidence must be reproducible without PII', errors)
}

function validateQualityDimensions(config, errors) {
  const performance = config?.performance
  requireArray(performance?.targets, 'performance.targets', errors, 4)
  const vitals = performance?.webVitals
  fail(vitals?.measurement === 'real-browser-runtime' && vitals?.lcpP75MsMaximum <= 2500 && vitals?.inpP75MsMaximum <= 200 && vitals?.clsP75Maximum <= 0.1 && vitals?.ttfbP75MsMaximum <= 800, 'Web Vitals targets are missing or too loose', errors)
  fail(vitals?.status === 'not-measured' && vitals?.runtimeRequired === true && vitals?.routeAndDeviceMatrixRequired === true, 'Web Vitals must remain runtime-pending', errors)
  const latency = performance?.apiLatency
  fail(latency?.measurement === 'gateway-trace-runtime' && latency?.readP95MsMaximum <= 500 && latency?.writeP95MsMaximum <= 800 && latency?.criticalAuthP95MsMaximum <= 1000 && latency?.errorRateMaximumPercent <= 1, 'API latency targets are missing or too loose', errors)
  fail(latency?.status === 'not-measured' && latency?.runtimeRequired === true, 'API latency evidence must remain runtime-pending', errors)
  const adaptive = performance?.adaptivePerformance
  fail(adaptive?.engine === 'AdaptivePerformanceEngine', 'AdaptivePerformanceEngine is required', errors)
  fail(JSON.stringify(adaptive?.levels) === JSON.stringify(['Ultra', 'High', 'Medium', 'Performance']), 'all four adaptive performance levels are required', errors)
  requireArray(adaptive?.lowDeviceSignals, 'adaptivePerformance.lowDeviceSignals', errors, 4)
  fail(adaptive?.performanceMode?.userCanExit === true && adaptive?.performanceMode?.persisted === true && adaptive?.performanceMode?.noBlockingFallback === true, 'low-device fallback must remain controllable and non-blocking', errors)
  requireArray(adaptive?.performanceMode?.disable, 'adaptivePerformance.performanceMode.disable', errors, 3)
  requireArray(adaptive?.performanceMode?.retain, 'adaptivePerformance.performanceMode.retain', errors, 3)

  const accessibility = config?.accessibility
  fail(accessibility?.standard === 'WCAG-2.2-AA', 'accessibility standard must be WCAG 2.2 AA', errors)
  requireArray(accessibility?.targets, 'accessibility.targets', errors, 4)
  for (const [field, expected] of Object.entries({ coreJourneysKeyboardComplete: true, visibleFocusRequired: true, focusOrderRequired: true, escapeClosesTransientUi: true, noUnrecoverableFocusTrap: true, skipNavigationRequired: true })) fail(accessibility?.keyboard?.[field] === expected, `accessibility.keyboard.${field} is incomplete`, errors)
  for (const [field, expected] of Object.entries({ semanticHeadingsRequired: true, accessibleNamesRequired: true, liveStatusAndErrorAnnouncementsRequired: true, loadingEmptyErrorPermissionStatesRequired: true })) fail(accessibility?.screenReader?.[field] === expected, `accessibility.screenReader.${field} is incomplete`, errors)
  requireArray(accessibility?.screenReader?.testedWith, 'accessibility.screenReader.testedWith', errors, 3)
  fail(accessibility?.contrast?.normalTextMinimum >= 4.5 && accessibility?.contrast?.largeTextMinimum >= 3 && accessibility?.contrast?.nonTextAndFocusMinimum >= 3 && accessibility?.contrast?.colorOnlyStatusForbidden === true && accessibility?.contrast?.highContrastModeRequired === true, 'contrast and non-color status requirements are incomplete', errors)
  fail(accessibility?.touch?.minimumTargetCssPx >= 44 && accessibility?.touch?.spacingOrOverlapReviewRequired === true && accessibility?.touch?.portraitAndLandscapeRequired === true, 'touch target requirements are incomplete', errors)
  fail(accessibility?.status === 'not-measured' && accessibility?.runtimeRequired === true, 'accessibility evidence must remain runtime-pending', errors)
}

function validateArtifacts(oci, errors) {
  fail(oci?.requireDigest === true && oci?.mutableTagAllowed === false && oci?.sameDigestAcrossPromotion === true, 'OCI promotion must be immutable and same-digest-only', errors)
  fail(oci?.requireSignature === true && oci?.signatureTool === 'cosign' && oci?.requireSBOM === true && oci?.sbomFormat === 'CycloneDX' && oci?.requireProvenance === true && oci?.provenanceStandard === 'SLSA', 'OCI signature/SBOM/provenance policy is incomplete', errors)
  fail(oci?.verificationStatus === 'pending', 'OCI runtime verification must remain pending', errors)
  requireArray(oci?.artifacts, 'oci.artifacts', errors, expectedApps.length + 2)
  const ids = (oci?.artifacts ?? []).map((artifact) => artifact?.id)
  unique(ids, 'OCI artifact ids', errors)
  for (const id of ['api-gateway', 'iam-service', ...expectedApps]) fail(ids.includes(id), `OCI artifact missing ${id}`, errors)
  for (const artifact of oci?.artifacts ?? []) {
    const image = artifact?.image ?? ''
    const digest = artifact?.digest ?? ''
    fail(/^registry\.example\.invalid\/englishflow\/[a-z0-9-]+@sha256:[0-9a-f]{64}$/.test(image), `${artifact?.id} must use a synthetic immutable OCI digest`, errors)
    fail(/^sha256:[0-9a-f]{64}$/.test(digest) && image.endsWith(`@${digest}`), `${artifact?.id} digest must match image`, errors)
    fail(artifact?.signatureStatus === 'pending' && artifact?.provenanceStatus === 'pending', `${artifact?.id} runtime supply-chain statuses must remain pending`, errors)
    fail(/^oci:\/\/registry\.example\.invalid\/englishflow\/sbom\/[a-z0-9-]+@sha256:[0-9a-f]{64}$/.test(artifact?.sbomRef ?? ''), `${artifact?.id} SBOM ref must be a synthetic OCI digest`, errors)
  }
}

function validateStaging(staging, errors) {
  fail(staging?.environment === 'production-like-staging' && staging?.productionLike === true, 'staging must be production-like', errors)
  fail(staging?.status === 'BLOCKED' && staging?.trafficSwitchAllowed === false, 'staging traffic must remain blocked', errors)
  for (const field of ['productionDataAllowed', 'rawMediaAllowed', 'paymentCredentialsAllowed']) fail(staging?.[field] === false, `staging.${field} must be false`, errors)
  requireArray(staging?.allowedDifferences, 'staging.allowedDifferences', errors, 3)
  requireArray(staging?.forbiddenDifferences, 'staging.forbiddenDifferences', errors, 4)
  validateArtifacts(staging?.oci, errors)
  const secrets = staging?.secrets
  fail(secrets?.injectionMode === 'external-secret-store-only' && secrets?.literalSecretValuesAllowed === false && secrets?.productionSecretAccessAllowed === false && secrets?.secretKeyRefsRequired === true && secrets?.secretRotationRequired === true, 'staging secrets must be externally injected and rotated', errors)
  requireArray(secrets?.forbiddenSources, 'staging.secrets.forbiddenSources', errors, 4)
  const deployment = staging?.deployment
  fail(deployment?.orchestrator === 'Kubernetes', 'staging must target Kubernetes', errors)
  fail((deployment?.packaging ?? []).includes('Helm') && (deployment?.packaging ?? []).includes('Kustomize') && deployment?.promotion === 'GitOps-signed-commit', 'staging packaging/promotion binding is incomplete', errors)
  for (const [field, expected] of Object.entries({ runAsNonRoot: true, readOnlyRootFilesystem: true, allowPrivilegeEscalation: false, automountServiceAccountToken: false, gracefulShutdownRequired: true })) fail(deployment?.[field] === expected, `deployment.${field} has unsafe value`, errors)
  fail(JSON.stringify(deployment?.probes) === JSON.stringify(['startup', 'readiness', 'liveness']), 'startup/readiness/liveness probes are required', errors)
  for (const [field, expected] of Object.entries({ defaultDeny: true, ingressOnlyFromApprovedGateway: true, egressAllowlistRequired: true, crossNamespaceWildcardAllowed: false })) fail(deployment?.networkPolicy?.[field] === expected, `networkPolicy.${field} has unsafe value`, errors)
  fail(deployment?.networkPolicy?.status === 'pending', 'network-policy runtime status must remain pending', errors)

  const migration = staging?.migration
  fail(migration?.owner === 'database-migration-runner' && migration?.schemaOwnershipRequired === true && migration?.backupBeforeMigration === true && migration?.forwardCompatible === true && migration?.destructiveDowngradeAllowed === false && migration?.rollbackMode === 'restore-and-reconcile', 'migration safety boundary is incomplete', errors)
  requireArray(migration?.stages, 'migration.stages', errors, 4)
  fail(migration?.status === 'pending' && migration?.runtimeRequired === true, 'migration runtime status must remain pending', errors)
  requireArray(migration?.requiredEvidence, 'migration.requiredEvidence', errors, 4)

  const binding = staging?.contractBinding
  fail(binding?.openapiSource === 'packages/contracts/openapi' && binding?.asyncapiSource === 'packages/contracts/events' && binding?.generatedClientsRequired === true && binding?.contractValidationRequired === true && binding?.fourPlatformBindingRequired === true && binding?.sameSourceRevisionRequired === true && binding?.manifestDigestRequired === true && binding?.eventEnvelopeVersionRequired === true, 'contract and release binding is incomplete', errors)
  fail(binding?.status === 'pending', 'contract binding runtime status must remain pending', errors)
  const observability = staging?.observability
  fail(observability?.provider === 'OpenTelemetry', 'OpenTelemetry is required for staging', errors)
  fail(JSON.stringify(observability?.signals) === JSON.stringify(['traces', 'metrics', 'logs']), 'OpenTelemetry traces/metrics/logs are required', errors)
  requireArray(observability?.requiredResourceAttributes, 'observability.requiredResourceAttributes', errors, 3)
  requireArray(observability?.correlationFields, 'observability.correlationFields', errors, 4)
  fail(observability?.sensitiveDataPolicy === 'redact-or-do-not-record' && observability?.exporterEndpointSource === 'runtime-env-only' && observability?.status === 'pending', 'observability secret/redaction boundary is incomplete', errors)
  const supplyChain = staging?.supplyChain
  for (const field of ['sbomRequired', 'provenanceRequired', 'signatureRequired', 'dependencyScanRequired']) fail(supplyChain?.[field] === true, `supplyChain.${field} must be true`, errors)
  fail(supplyChain?.sbomFormat === 'CycloneDX' && supplyChain?.provenanceStandard === 'SLSA' && supplyChain?.verificationTool === 'cosign' && supplyChain?.status === 'pending', 'supply-chain verification must remain pending', errors)

  const backup = staging?.backup
  requireArray(backup?.facts, 'backup.facts', errors, 3)
  for (const field of ['backupBeforeChange', 'restoreTestRequired', 'pointInTimeReferenceRequired', 'immutableEvidenceRequired', 'runtimeRequired']) fail(backup?.[field] === true, `backup.${field} must be true`, errors)
  fail(backup?.status === 'not-established', 'backup evidence must remain not-established', errors)
  const rollback = staging?.rollback
  fail(rollback?.status === 'not-established', 'rollback must remain not-established', errors)
  fail(rollback?.automatic?.enabled === true && rollback?.automatic?.failClosed === true && rollback?.automatic?.lastApprovedDigestRequired === true, 'automatic rollback must fail closed on immutable digest', errors)
  fail(rollback?.manual?.enabled === true && rollback?.manual?.namedOwnerRequired === true && rollback?.manual?.independentApprovalRequired === true && rollback?.manual?.minimumApprovers >= 2, 'manual rollback must require named owner and independent approval', errors)
  fail(rollback?.restorePoint?.required === true && rollback?.restorePoint?.createdBeforeTrafficChange === true && rollback?.restorePoint?.immutableReferenceRequired === true && rollback?.restorePoint?.dataAndEventReconciliationRequired === true, 'rollback restore-point contract is incomplete', errors)
  fail(rollback?.audit?.appendOnly === true && rollback?.audit?.externalSinkRequired === true && rollback?.audit?.sensitiveDataPolicy === 'redact-or-do-not-record' && rollback?.audit?.status === 'pending', 'rollback audit contract is incomplete', errors)

  const goNoGo = staging?.goNoGo
  fail(goNoGo?.status === 'BLOCKED' && goNoGo?.defaultDecision === 'NO-GO', 'Go/No-Go must default to BLOCKED/NO-GO', errors)
  fail(goNoGo?.minimumIndependentApprovers >= 2 && goNoGo?.samePersonCannotSatisfyBothApprovals === true && goNoGo?.selfApprovalAllowed === false && goNoGo?.decisionRecordRequired === true && goNoGo?.changeWindowRequired === true, 'Go/No-Go must require independent auditable approvals', errors)
  requireArray(goNoGo?.requiredRoles, 'goNoGo.requiredRoles', errors, 5)
  fail(goNoGo?.openP0MustEqual === 0 && goNoGo?.openP1MustEqual === 0 && goNoGo?.p2RequiresDisposition === true && goNoGo?.runtimeEvidenceStatus === 'pending' && goNoGo?.approvalStatus === 'not-present', 'Go/No-Go blocker policy is incomplete', errors)
}

function validateQualityGates(config, errors) {
  const gates = config?.qualityGates
  requireArray(gates, 'qualityGates', errors, 2)
  const gateIds = (gates ?? []).map((gate) => gate?.id)
  fail(JSON.stringify(gateIds) === JSON.stringify(['B27-QUAL-003-SECURITY', 'B27-STG-004-RELEASE']), 'quality gate IDs/order are invalid', errors)
  unique(gateIds, 'quality gate ids', errors)
  for (const gate of gates ?? []) {
    requireString(gate?.task, `${gate?.id}.task`, errors)
    requireArray(gate?.staticChecks, `${gate?.id}.staticChecks`, errors, 1)
    requireArray(gate?.runtimeChecks, `${gate?.id}.runtimeChecks`, errors, 1)
    for (const check of gate?.staticChecks ?? []) validateSourceBackedCheck(check, errors)
    for (const check of gate?.runtimeChecks ?? []) validateRuntimeCheck(check, errors)
  }
}

function validateEvidenceAndReport(config, errors) {
  const evidence = config?.evidenceIndex
  requireArray(evidence, 'evidenceIndex', errors, 4)
  const ids = (evidence ?? []).map((item) => item?.id)
  unique(ids, 'evidence ids', errors)
  const staticEvidence = (evidence ?? []).filter((item) => item?.class === 'static')
  const runtimeEvidence = (evidence ?? []).filter((item) => item?.class === 'runtime')
  fail(staticEvidence.length >= 4 && runtimeEvidence.length >= 2, 'static and runtime evidence index is incomplete', errors)
  for (const item of staticEvidence) fail(item?.status === 'defined' && item?.runtimeRequired === false && item?.collectionPolicy === 'repository-static-validator', `${item?.id} static evidence is invalid`, errors)
  for (const item of runtimeEvidence) fail(item?.status === 'pending' && item?.runtimeRequired === true && item?.collectionPolicy === 'runtime-runner-only', `${item?.id} runtime evidence must remain pending`, errors)
  const report = config?.reportSchema
  fail(report?.closed === true && report?.missingEvidenceDecision === 'NO-GO', 'report schema must be closed and fail to NO-GO when evidence is missing', errors)
  const schema = report?.jsonSchema
  fail(schema?.type === 'object' && schema?.additionalProperties === false, 'report schema must be a closed object', errors)
  for (const field of ['schemaVersion', 'reportId', 'batch', 'decision', 'quality', 'staging', 'artifacts', 'evidence', 'approvals', 'rollback', 'reportHash']) fail((schema?.required ?? []).includes(field), `report schema missing ${field}`, errors)
  fail(schema?.properties?.decision?.enum?.includes('NO-GO') && schema?.properties?.decision?.enum?.includes('BLOCKED'), 'report decision must support NO-GO and BLOCKED', errors)
}

function validateSourceSafety(config, errors) {
  const serialized = JSON.stringify(config)
  for (const pattern of forbiddenMaterial) fail(!pattern.test(serialized), 'B27 manifest contains forbidden credentials, PII or production domain', errors)
  fail(!serialized.includes('production.com') && !serialized.includes('example.com'), 'B27 manifest must not contain production domains', errors)
}

export function validateB27QualityRelease(config = loadManifest(), { runtimeRequested = runtimeRequestedByProcess, env = process.env } = {}) {
  const errors = []
  if (!config) return { result: 'FAIL', errors: ['manifest is missing'] }
  validateSourceSafety(config, errors)
  fail(config.schemaVersion === 1, 'schemaVersion must be 1', errors)
  fail(config.batch === 'B27' && config.phase === 'phase-1', 'manifest must be B27 Phase 1', errors)
  fail(config.mode === 'static-and-synthetic' && config.status === 'static-foundation', 'manifest mode/status must remain static-foundation', errors)
  fail(config.runtimeDecision === 'BLOCKED', 'runtimeDecision must be BLOCKED', errors)
  validateTasks(config, errors)
  validateExecution(config, errors)
  validateRuntimeGate(config, errors)
  validateAuthorizationAndSecurity(config, errors)
  validateQualityDimensions(config, errors)
  validateStaging(config?.stagingRelease, errors)
  validateQualityGates(config, errors)
  validateEvidenceAndReport(config, errors)

  if (runtimeRequested) {
    const missing = (config.runtimeGate?.requiredEnv ?? []).filter((name) => !env?.[name])
    if (missing.length > 0) errors.push(`runtime gate blocked; missing environment: ${missing.join(', ')}`)
    errors.push('runtime gate remains blocked; static validator cannot approve security, performance, accessibility, staging or release evidence')
  }

  const staticChecks = (config.qualityGates ?? []).flatMap((gate) => gate?.staticChecks ?? [])
  const runtimeChecks = (config.qualityGates ?? []).flatMap((gate) => gate?.runtimeChecks ?? [])
  const runtimeEvidencePending = (config.evidenceIndex ?? []).filter((item) => item?.class === 'runtime' && item?.status === 'pending').length
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    batch: config.batch,
    taskCount: config.tasks?.length ?? 0,
    staticChecks: staticChecks.length,
    runtimeChecks: runtimeChecks.length,
    runtimeEvidencePending,
    runtimeBlocked: config.execution?.runtimeBlocked === true,
    releaseDecision: config.stagingRelease?.goNoGo?.defaultDecision ?? 'NO-GO',
    errors,
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const result = validateB27QualityRelease()
  console.log(JSON.stringify(result, null, 2))
  if (result.result !== 'PASS') process.exitCode = 1
}
