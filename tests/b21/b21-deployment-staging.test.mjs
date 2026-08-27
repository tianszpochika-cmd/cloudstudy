import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..', '..')
const configPath = path.join(root, 'config', 'b21-deployment-staging.json')
const validatorPath = path.join(root, 'scripts', 'runtime', 'validate-b21-deployment-staging.mjs')
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
const deploymentFiles = [
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

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

test('B21 DEP/STG manifest is Phase 1, scoped to two tasks and closed by default', () => {
  assert.equal(config.batch, 'B21')
  assert.equal(config.phase, 'phase-1')
  assert.equal(config.mode, 'static-and-synthetic')
  assert.equal(config.status, 'static-foundation')
  assert.deepEqual(config.tasks.map((task) => task.id), ['V2-B21-DEP-001', 'V2-B21-STG-002'])
  assert.equal(config.execution.runtimeBlocked, true)
  assert.equal(config.execution.allowUnverifiedPass, false)
  assert.equal(config.execution.staticValidatorCannotPromoteRuntime, true)
  assert.equal(config.releaseGate.status, 'BLOCKED')
  assert.equal(config.releaseGate.goAllowed, false)
})

test('OCI, signature, SBOM and immutable promotion contracts reject mutable releases', () => {
  assert.equal(config.oci.images.length, 1)
  for (const image of config.oci.images) {
    assert.match(image.image, /@sha256:[0-9a-f]{64}$/)
    assert.equal(image.tagPolicy, 'digest-only')
    assert.equal(image.signature.required, true)
    assert.equal(image.signature.tool, 'cosign')
    assert.equal(image.sbom.required, true)
    assert.equal(image.sbom.format, 'CycloneDX')
    assert.match(image.sbom.ref, /@sha256:[0-9a-f]{64}$/)
  }
  assert.equal(config.oci.promotion.stagingToProduction, 'same-digest-only')
  assert.equal(config.oci.promotion.rebuildBetweenEnvironments, false)
  assert.equal(config.deployment.immutability.noLatestTag, true)
  assert.doesNotMatch(read('deploy/b21/base/deployment.yaml'), /image:\s+\S+:latest(?:\s|$)/i)
  assert.match(read('deploy/b21/oci/image-lock.yaml'), /rejectMutableTags: true/)
})

test('Kubernetes, Kustomize, Helm, GitOps, secret and probe declarations are present', () => {
  assert.match(read('deploy/b21/base/kustomization.yaml'), /kind: Kustomization/)
  assert.match(read('deploy/b21/helm/Chart.yaml'), /apiVersion: v2/)
  assert.match(read('deploy/b21/gitops/application-staging.yaml'), /kind: Application/)
  assert.match(read('deploy/b21/gitops/application-production.yaml'), /targetRevision: REPLACE_SIGNED_RC_COMMIT_SHA/)
  const deployment = read('deploy/b21/base/deployment.yaml')
  for (const marker of ['startupProbe:', 'readinessProbe:', 'livenessProbe:', 'type: RollingUpdate', 'runAsNonRoot: true', 'readOnlyRootFilesystem: true', 'allowPrivilegeEscalation: false']) assert.match(deployment, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(read('deploy/b21/base/external-secret.yaml'), /kind: ExternalSecret/)
  assert.match(read('deploy/b21/overlays/staging/external-secret-patch.yaml'), /phase1\/staging\/englishflow-runtime/)
  assert.match(read('deploy/b21/overlays/production/external-secret-patch.yaml'), /phase1\/production\/englishflow-runtime/)
  assert.match(read('deploy/b21/base/network-policy.yaml'), /kind: NetworkPolicy/)
})

test('staging is production-like with explicit, non-business differences only', () => {
  assert.equal(config.staging.productionLike, true)
  for (const dimension of ['same-immutable-image', 'same-kubernetes-policy', 'same-migration-runner', 'same-dependency-topology']) assert.ok(config.staging.parityDimensions.includes(dimension))
  for (const difference of ['namespace', 'scale', 'synthetic-endpoints', 'approval-identities']) assert.ok(config.staging.allowedDifferences.includes(difference))
  for (const forbidden of ['business-rules', 'authorization-policy', 'schema-shape', 'event-envelope', 'secret-material']) assert.ok(config.staging.forbiddenDifferences.includes(forbidden))
  assert.equal(config.staging.dataLoading.policy, 'sanitized-fixtures-only')
  assert.equal(config.staging.dataLoading.productionDataAllowed, false)
  assert.equal(config.staging.dataLoading.rawMediaAllowed, false)
  assert.equal(config.staging.dataLoading.paymentCredentialAllowed, false)
})

test('migration, fixture and dependency failure controls remain runtime-pending', () => {
  for (const stage of ['emptyDatabase', 'upgrade', 'downgrade', 'failureRecovery']) {
    assert.ok(['pending', 'blocked'].includes(config.staging.migration[stage].status))
    assert.equal(config.staging.migration[stage].runtimeRequired, true)
  }
  assert.equal(config.staging.migration.forwardCompatible, true)
  assert.equal(config.staging.migration.destructiveDowngradeAllowed, false)
  assert.equal(config.staging.migration.rollbackMode, 'restore-and-reconcile')
  assert.equal(config.syntheticFixtures.policy, 'synthetic-references-only-no-production-data-no-raw-media-no-secrets')
  assert.ok(config.syntheticFixtures.subjects.every((subject) => subject.subjectRef.startsWith('subject-ref://synthetic/')))
  assert.ok(config.syntheticFixtures.mediaRefs.every((ref) => ref.startsWith('media-ref://synthetic/')))
  assert.deepEqual(config.staging.dependencyFailureIsolation.dependencies.map((dependency) => dependency.id), ['mysql', 'redis', 'kafka', 'object-storage'])
  assert.ok(config.staging.dependencyFailureIsolation.dependencies.every((dependency) => dependency.status === 'pending'))
  assert.match(read('deploy/b21/staging/dependency-failure-matrix.yaml'), /outbox-retained-and-no-duplicate-fact/)
})

test('static checks are source-backed while all runtime checks and evidence remain pending', () => {
  assert.equal(config.staticChecks.length, 13)
  assert.equal(config.runtimeChecks.length, 13)
  assert.equal(config.evidenceIndex.length, 26)
  for (const check of config.staticChecks) {
    assert.equal(check.status, 'defined')
    assert.equal(check.evidenceClass, 'static')
    assert.equal(check.runtimeRequired, false)
    assert.ok(check.sourcePaths.length > 0)
    assert.ok(check.assertions.length > 0)
    for (const sourcePath of check.sourcePaths) assert.ok(fs.existsSync(path.join(root, sourcePath)), sourcePath)
  }
  for (const check of config.runtimeChecks) {
    assert.equal(check.status, 'pending')
    assert.equal(check.evidenceClass, 'runtime')
    assert.equal(check.runtimeRequired, true)
    assert.ok(check.evidenceRequired.length > 0)
    assert.ok(check.cannotBeSatisfiedBy.length > 0)
    assert.doesNotMatch(JSON.stringify(check), /\b(pass|passed|captured|verified)\b/i)
  }
  const runtimeEvidence = config.evidenceIndex.filter((item) => item.class === 'runtime')
  assert.equal(runtimeEvidence.length, 13)
  assert.ok(runtimeEvidence.every((item) => item.status === 'pending' && item.runtimeRequired === true && item.collectionPolicy === 'runtime-runner-only'))
})

test('B21 validator passes the static contract and reports runtime pending', () => {
  const result = spawnSync(process.execPath, [validatorPath], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  assert.match(result.stdout, /"result": "PASS"/)
  assert.match(result.stdout, /"staticChecks": 13/)
  assert.match(result.stdout, /"runtimeChecks": 13/)
  assert.match(result.stdout, /"evidence": 26/)
  assert.match(result.stdout, /"runtimeEvidencePending": 13/)
  assert.match(result.stdout, /"runtimeBlocked": true/)
})

test('B21 runtime request is blocked and cannot be promoted by the static validator', () => {
  const environment = { ...process.env }
  for (const name of config.execution.requiredEnv) delete environment[name]
  const result = spawnSync(process.execPath, [validatorPath, '--require-runtime'], { cwd: root, encoding: 'utf8', env: environment })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /runtime gate blocked; missing environment/)
  assert.match(result.stderr, /static validator cannot promote runtime evidence/)
})

test('deployment templates contain no credentials, PII or production data', () => {
  const combined = deploymentFiles.map(read).join('\n')
  assert.doesNotMatch(combined, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i)
  assert.doesNotMatch(combined, /\bAKIA[0-9A-Z]{16}\b|\bghp_[A-Za-z0-9]{36}\b|\bsk-[A-Za-z0-9]{20,}\b|Bearer\s+eyJ/i)
  assert.doesNotMatch(combined, /[A-Za-z0-9._%+-]+@(gmail|qq|163|outlook)\.com/i)
  assert.doesNotMatch(combined, /(?:^|\D)(?:\+?86[- ]?)?1[3-9]\d{9}(?:$|\D)/)
  assert.doesNotMatch(combined, /image:\s+\S+:latest(?:\s|$)/i)
  assert.match(combined, /synthetic-references-only-no-production-data/)
  assert.match(combined, /external-secret-store/)
})
