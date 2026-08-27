import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const configPath = path.join(root, 'config', 'b20-security-gates.json');
const validatorPath = path.join(root, 'scripts', 'runtime', 'validate-b20-security-gates.mjs');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const expectedControls = [
  'B20-SEC-SAST',
  'B20-SEC-DEPENDENCY',
  'B20-SEC-IMAGE',
  'B20-SEC-SECRETS',
  'B20-SEC-SBOM',
  'B20-SEC-KMS',
  'B20-SEC-PRIVILEGE',
  'B20-SEC-CONTAINER',
  'B20-SEC-NETWORK',
  'B20-SEC-MTLS'
];

test('B20-SEC-001 manifest is Phase 1 and statically auditable without claiming runtime pass', () => {
  assert.equal(config.schemaVersion, 1);
  assert.equal(config.batch, 'B20');
  assert.equal(config.taskId, 'V2-B20-SEC-001');
  assert.equal(config.phase, 'phase-1');
  assert.equal(config.mode, 'static-and-synthetic');
  assert.equal(config.execution.mode, 'static-fixture-only');
  assert.equal(config.execution.status, 'runtimeBlocked');
  assert.equal(config.execution.runtimeBlocked, true);
  assert.equal(config.execution.allowUnverifiedPass, false);
  assert.equal(config.execution.runtimeEvidence, null);
  assert.ok(config.execution.blockedReasons.length >= 3);
});

test('security controls cover the complete SEC-001 scope and required tool families', () => {
  assert.deepEqual(config.controls.map((control) => control.id), expectedControls);
  assert.equal(new Set(config.controls.map((control) => control.id)).size, expectedControls.length);
  for (const control of config.controls) {
    assert.equal(control.priority, 'P0');
    assert.equal(control.staticPolicy, 'defined');
    assert.equal(control.runtimeStatus, 'pending');
  }
  assert.deepEqual(config.tooling.sast.tools, ['Semgrep', 'CodeQL']);
  assert.deepEqual(config.tooling.dependency.tools, ['OWASP Dependency-Check', 'OSV-Scanner']);
  assert.deepEqual(config.tooling.image.tools, ['Trivy', 'Grype']);
  assert.deepEqual(config.tooling.secrets.tools, ['Gitleaks', 'synthetic-fixture-scan']);
  assert.deepEqual(config.tooling.sbomAndProvenance.tools, ['Syft', 'CycloneDX', 'cosign']);
  for (const definition of Object.values(config.tooling)) {
    assert.equal(definition.required, true);
    assert.equal(definition.runtimeRequired, true);
    assert.equal(definition.status, 'pending');
  }
});

test('static checks are source-backed definitions, never runtime results', () => {
  assert.equal(config.staticChecks.length, expectedControls.length);
  assert.deepEqual(new Set(config.staticChecks.map((check) => check.controlId)), new Set(expectedControls));
  for (const check of config.staticChecks) {
    assert.equal(check.status, 'defined');
    assert.equal(check.evidenceClass, 'static');
    assert.equal(check.runtimeRequired, false);
    assert.ok(check.sourcePaths.length > 0);
    assert.ok(check.assertions.length > 0);
    assert.ok(check.policyAssertions.length > 0);
  }
  const source = JSON.stringify(config.staticChecks);
  for (const marker of ['ARCH-SEC-001', 'KMS/Vault', 'SBOM', 'X-Role', 'runAsNonRoot', 'mTLS']) {
    assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('runtime security checks and evidence remain pending until external execution', () => {
  assert.equal(config.runtimeChecks.length, expectedControls.length);
  assert.deepEqual(new Set(config.runtimeChecks.map((check) => check.controlId)), new Set(expectedControls));
  for (const check of config.runtimeChecks) {
    assert.ok(['pending', 'blocked'].includes(check.status));
    assert.equal(check.evidenceClass, 'runtime');
    assert.equal(check.runtimeRequired, true);
    assert.ok(check.tools.length > 0);
    assert.ok(check.targets.length > 0);
    assert.ok(check.scenarios.length > 0);
    assert.ok(check.evidenceRequired.length > 0);
    assert.ok(check.cannotBeSatisfiedBy.length > 0);
    assert.doesNotMatch(JSON.stringify(check).toLowerCase(), /\b(pass|passed|captured|verified)\b/);
  }
  const runtimeEvidence = config.evidenceIndex.filter((item) => item.class === 'runtime');
  assert.equal(runtimeEvidence.length, expectedControls.length);
  for (const item of runtimeEvidence) {
    assert.ok(['pending', 'blocked'].includes(item.status));
    assert.equal(item.runtimeRequired, true);
    assert.equal(item.collectionPolicy, 'runtime-runner-only');
    assert.match(item.artifactPathPattern, /^evidence\/b20\/security\//);
  }
});

test('security boundaries are external-secret, least-privilege, non-root and fail-closed by policy', () => {
  assert.equal(config.repositorySecretPolicy.actualSecretMaterial, 'forbidden');
  assert.equal(config.repositorySecretPolicy.fixtureMode, 'synthetic-only');
  assert.ok(config.repositorySecretPolicy.forbiddenFixtureFields.includes('paymentCredential'));
  assert.equal(config.kmsVault.providerMode, 'external-approved-kms-or-vault');
  assert.equal(config.kmsVault.repositorySecretMaterial, false);
  assert.equal(config.kmsVault.environmentReferenceOnly, true);
  assert.equal(config.kmsVault.failClosedOnUnavailable, true);
  assert.equal(config.leastPrivilege.defaultEffect, 'deny');
  assert.equal(config.leastPrivilege.unknownDecision, 'deny');
  assert.equal(config.leastPrivilege.clientAuthorityHeadersTrusted, false);
  assert.equal(config.containerRuntime.podSecurityStandard, 'restricted');
  assert.equal(config.containerRuntime.runAsNonRoot, true);
  assert.equal(config.containerRuntime.allowPrivilegeEscalation, false);
  assert.equal(config.containerRuntime.readOnlyRootFilesystem, true);
  assert.equal(config.networkBoundary.defaultDenyNetworkPolicy, true);
  assert.equal(config.networkBoundary.publicIngressOwner, 'api-gateway');
  assert.equal(config.networkBoundary.domainServicesDirectPublicIngress, false);
  assert.equal(config.mtlsAndSigning.serviceTransport, 'mTLS');
  assert.equal(config.mtlsAndSigning.clientCertificateRequiredForInternalCalls, true);
  assert.equal(config.mtlsAndSigning.certificateExpiryDecision, 'deny');
  assert.equal(config.mtlsAndSigning.artifactSignatureRequired, true);
});

test('manifest contains no real credential or PII material', () => {
  const sanitized = JSON.stringify(config, (key, value) => key === 'forbiddenPatterns' ? undefined : value);
  assert.doesNotMatch(sanitized, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i);
  assert.doesNotMatch(sanitized, /\bAKIA[0-9A-Z]{16}\b/);
  assert.doesNotMatch(sanitized, /\bghp_[A-Za-z0-9]{36}\b/);
  assert.doesNotMatch(sanitized, /\bsk-[A-Za-z0-9]{20,}\b/);
  assert.doesNotMatch(sanitized, /Bearer\s+eyJ[A-Za-z0-9_-]+\./i);
  assert.doesNotMatch(sanitized, /[A-Za-z0-9._%+-]+@(gmail|qq|163|outlook)\.com/i);
});

test('B20 security validator passes the static contract and reports runtime evidence pending', () => {
  const result = spawnSync(process.execPath, [validatorPath], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /"result": "PASS"/);
  assert.match(result.stdout, /"staticChecks": 10/);
  assert.match(result.stdout, /"runtimeChecks": 10/);
  assert.match(result.stdout, /"runtimeEvidencePending": 10/);
  assert.match(result.stdout, /"runtimeBlocked": true/);
});
