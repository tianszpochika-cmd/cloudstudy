import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { validateB27QualityRelease } from '../../scripts/runtime/validate-b27-quality-release.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const configPath = path.join(root, 'config', 'b27-quality-release.json')
const validatorPath = path.join(root, 'scripts', 'runtime', 'validate-b27-quality-release.mjs')
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))

function clone(value) {
  return structuredClone(value)
}

test('B27 QUAL/STG static slice is Phase 1 and closed by default', () => {
  assert.equal(config.schemaVersion, 1)
  assert.equal(config.batch, 'B27')
  assert.equal(config.phase, 'phase-1')
  assert.equal(config.mode, 'static-and-synthetic')
  assert.equal(config.status, 'static-foundation')
  assert.deepEqual(config.tasks.map((task) => task.id), ['V2-B27-QUAL-003', 'V2-B27-STG-004'])
  assert.equal(config.execution.runtimeBlocked, true)
  assert.equal(config.execution.allowUnverifiedPass, false)
  assert.equal(config.execution.staticValidatorCannotPromoteRuntime, true)
  assert.equal(config.execution.productionMutationAllowed, false)
  assert.equal(config.stagingRelease.goNoGo.status, 'BLOCKED')
  assert.equal(config.stagingRelease.goNoGo.defaultDecision, 'NO-GO')
})

test('security contract is deny-by-default and fails closed', () => {
  const security = config.securityQuality
  assert.equal(security.authorization.defaultDeny, true)
  assert.equal(security.authorization.gatewayJwtPreValidation, true)
  assert.equal(security.authorization.serviceSidePepRequired, true)
  assert.equal(security.authorization.clientRoleHeadersTrusted, false)
  assert.equal(security.authorization.pdpFailureDecision, 'fail-closed')
  assert.equal(security.cors.wildcardOriginAllowed, false)
  assert.equal(security.cors.originReflectionAllowed, false)
  assert.equal(security.rateLimiting.responseStatus, 429)
  assert.equal(security.rateLimiting.failOpenOnLimiterFailure, false)
  assert.deepEqual(security.jwks.forbiddenAlgorithms, ['none', 'HS256'])
  assert.equal(security.jwks.jwksUnavailableDecision, 'fail-closed')
  assert.equal(security.privacyRedaction.rawPiiAllowed, false)
  assert.equal(security.privacyRedaction.productionCredentialsAllowed, false)
})

test('performance, adaptive degradation and accessibility contracts cover required targets', () => {
  assert.equal(config.performance.webVitals.lcpP75MsMaximum, 2500)
  assert.equal(config.performance.webVitals.inpP75MsMaximum, 200)
  assert.equal(config.performance.webVitals.clsP75Maximum, 0.1)
  assert.equal(config.performance.apiLatency.readP95MsMaximum, 500)
  assert.deepEqual(config.performance.adaptivePerformance.levels, ['Ultra', 'High', 'Medium', 'Performance'])
  assert.equal(config.performance.adaptivePerformance.performanceMode.userCanExit, true)
  assert.equal(config.performance.adaptivePerformance.performanceMode.noBlockingFallback, true)
  assert.equal(config.accessibility.standard, 'WCAG-2.2-AA')
  assert.equal(config.accessibility.contrast.normalTextMinimum, 4.5)
  assert.equal(config.accessibility.contrast.colorOnlyStatusForbidden, true)
  assert.equal(config.accessibility.touch.minimumTargetCssPx, 44)
  assert.ok(config.accessibility.screenReader.testedWith.includes('NVDA'))
  assert.ok(config.accessibility.screenReader.testedWith.includes('VoiceOver'))
  assert.ok(config.accessibility.screenReader.testedWith.includes('TalkBack'))
})

test('production-like staging binds OCI digests, secrets, migrations, probes, contracts, telemetry and recovery', () => {
  const staging = config.stagingRelease
  assert.equal(staging.productionLike, true)
  assert.equal(staging.trafficSwitchAllowed, false)
  assert.equal(staging.oci.requireDigest, true)
  assert.equal(staging.oci.mutableTagAllowed, false)
  assert.equal(staging.oci.sameDigestAcrossPromotion, true)
  assert.equal(staging.oci.requireSignature, true)
  assert.equal(staging.oci.requireSBOM, true)
  assert.equal(staging.oci.requireProvenance, true)
  assert.ok(staging.oci.artifacts.some((artifact) => artifact.id === 'api-gateway'))
  assert.ok(staging.oci.artifacts.some((artifact) => artifact.id === 'iam-service'))
  for (const app of ['mobile', 'learner-web', 'admin-web', 'official-site']) assert.ok(staging.oci.artifacts.some((artifact) => artifact.id === app))
  assert.equal(staging.secrets.injectionMode, 'external-secret-store-only')
  assert.equal(staging.secrets.literalSecretValuesAllowed, false)
  assert.deepEqual(staging.deployment.probes, ['startup', 'readiness', 'liveness'])
  assert.equal(staging.deployment.networkPolicy.defaultDeny, true)
  assert.equal(staging.migration.destructiveDowngradeAllowed, false)
  assert.equal(staging.migration.rollbackMode, 'restore-and-reconcile')
  assert.equal(staging.contractBinding.generatedClientsRequired, true)
  assert.equal(staging.observability.provider, 'OpenTelemetry')
  assert.equal(staging.supplyChain.sbomFormat, 'CycloneDX')
  assert.equal(staging.supplyChain.provenanceStandard, 'SLSA')
  assert.equal(staging.backup.status, 'not-established')
  assert.equal(staging.rollback.status, 'not-established')
  assert.equal(staging.goNoGo.minimumIndependentApprovers, 2)
  assert.equal(staging.goNoGo.samePersonCannotSatisfyBothApprovals, true)
})

test('static validator passes the source-backed foundation and reports runtime pending', () => {
  const result = validateB27QualityRelease(config, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'PASS', JSON.stringify(result, null, 2))
  assert.equal(result.taskCount, 2)
  assert.equal(result.staticChecks, 7)
  assert.equal(result.runtimeChecks, 10)
  assert.equal(result.runtimeEvidencePending, 2)
  assert.equal(result.runtimeBlocked, true)
  assert.equal(result.releaseDecision, 'NO-GO')
  const cli = spawnSync(process.execPath, [validatorPath], { cwd: root, encoding: 'utf8' })
  assert.equal(cli.status, 0, `${cli.stdout}\n${cli.stderr}`)
  assert.match(cli.stdout, /"result": "PASS"/)
  assert.match(cli.stdout, /"runtimeBlocked": true/)
})

test('unsafe authorization, CORS, performance and accessibility mutations fail closed', () => {
  const candidate = clone(config)
  candidate.securityQuality.cors.wildcardOriginAllowed = true
  candidate.securityQuality.authorization.clientRoleHeadersTrusted = true
  candidate.securityQuality.jwks.jwksUnavailableDecision = 'allow'
  candidate.performance.webVitals.lcpP75MsMaximum = 3000
  candidate.accessibility.touch.minimumTargetCssPx = 32
  const result = validateB27QualityRelease(candidate, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.match(result.errors.join('\n'), /wildcardOriginAllowed|clientRoleHeadersTrusted|JWKS failure paths|Web Vitals targets|touch target requirements/)
})

test('mutable release, literal secret and single-approval mutations are rejected', () => {
  const candidate = clone(config)
  candidate.stagingRelease.oci.artifacts[0].image = 'registry.example.invalid/englishflow/api-gateway:latest'
  candidate.stagingRelease.secrets.literalSecretValuesAllowed = true
  candidate.stagingRelease.goNoGo.minimumIndependentApprovers = 1
  candidate.stagingRelease.rollback.restorePoint.createdBeforeTrafficChange = false
  const result = validateB27QualityRelease(candidate, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.match(result.errors.join('\n'), /immutable OCI digest|literalSecretValuesAllowed|independent approval|restore-point/)
})

test('runtime request fails closed even when callers provide placeholder environment values', () => {
  const env = Object.fromEntries(config.runtimeGate.requiredEnv.map((name) => [name, `synthetic-${name.toLowerCase()}`]))
  const result = validateB27QualityRelease(config, { runtimeRequested: true, env })
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('static validator cannot approve')))
  const cli = spawnSync(process.execPath, [validatorPath, '--require-runtime'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
  assert.notEqual(cli.status, 0)
  assert.match(`${cli.stdout}\n${cli.stderr}`, /runtime gate remains blocked/)
})

test('runtime checks and evidence cannot be represented as static PASS', () => {
  for (const gate of config.qualityGates) {
    for (const check of gate.runtimeChecks) {
      assert.equal(check.status, 'pending')
      assert.equal(check.runtimeRequired, true)
      assert.ok(check.evidenceRequired.length > 0)
      assert.ok(check.cannotBeSatisfiedBy.length > 0)
      assert.doesNotMatch(JSON.stringify(check), /\b(?:pass|passed|captured|verified|approved)\b/i)
    }
  }
  const runtimeEvidence = config.evidenceIndex.filter((item) => item.class === 'runtime')
  assert.ok(runtimeEvidence.length >= 2)
  assert.ok(runtimeEvidence.every((item) => item.status === 'pending' && item.runtimeRequired === true && item.collectionPolicy === 'runtime-runner-only'))
  assert.equal(config.reportSchema.jsonSchema.additionalProperties, false)
  assert.equal(config.reportSchema.missingEvidenceDecision, 'NO-GO')
})
