import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, '..', '..');
const configRelativePath = 'config/b20-security-gates.json';
const configPath = path.join(root, configRelativePath);
const errors = [];

const expectedControlIds = [
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

const forbiddenMaterialPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bghp_[A-Za-z0-9]{36}\b/,
  /\bsk-[A-Za-z0-9]{20,}\b/,
  /Bearer\s+eyJ[A-Za-z0-9_-]+\./i,
  /[A-Za-z0-9._%+-]+@(gmail|qq|163|outlook)\.com/i
];

function fail(message) {
  errors.push(message);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') fail(`${label} must be a non-empty string`);
}

function requireArray(value, label, minimum = 1) {
  if (!Array.isArray(value) || value.length < minimum) fail(`${label} must contain at least ${minimum} item(s)`);
}

function unique(values, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) fail(`${label} contains duplicate: ${value}`);
    seen.add(value);
  }
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`${label} cannot be read or parsed: ${error.message}`);
    return null;
  }
}

function safeSourcePath(relativePath) {
  if (typeof relativePath !== 'string' || relativePath.includes('..') || path.isAbsolute(relativePath)) {
    fail(`source path must be a relative repository path: ${relativePath}`);
    return null;
  }
  const resolved = path.resolve(root, relativePath);
  const repositoryRelative = path.relative(root, resolved);
  if (repositoryRelative.startsWith('..') || path.isAbsolute(repositoryRelative)) {
    fail(`source path escapes repository: ${relativePath}`);
    return null;
  }
  if (/^(node_modules|dist|target|\.nuxt|\.output)([\\/]|$)/i.test(repositoryRelative)) {
    fail(`generated/dependency source is not allowed: ${relativePath}`);
    return null;
  }
  return resolved;
}

function checkNoForbiddenMaterial(value, label) {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  for (const pattern of forbiddenMaterialPatterns) {
    if (pattern.test(serialized)) fail(`${label} contains forbidden secret/PII material matching ${pattern}`);
  }
}

function validateStaticCheck(check, controlsById, evidenceIds) {
  if (!isRecord(check)) {
    fail('staticChecks contains a non-object item');
    return;
  }
  requireString(check.id, 'staticCheck.id');
  requireString(check.controlId, `${check.id}.controlId`);
  if (!controlsById.has(check.controlId)) fail(`${check.id} references unknown control ${check.controlId}`);
  requireString(check.kind, `${check.id}.kind`);
  if (check.status !== 'defined') fail(`${check.id} must remain status=defined`);
  if (check.evidenceClass !== 'static') fail(`${check.id} must use evidenceClass=static`);
  if (check.runtimeRequired !== false) fail(`${check.id} must use runtimeRequired=false`);
  requireString(check.evidenceId, `${check.id}.evidenceId`);
  evidenceIds.add(check.evidenceId);
  requireArray(check.assertions, `${check.id}.assertions`);
  requireArray(check.policyAssertions, `${check.id}.policyAssertions`);

  requireArray(check.sourcePaths, `${check.id}.sourcePaths`);
  const sourceText = [];
  for (const sourcePath of check.sourcePaths ?? []) {
    const resolved = safeSourcePath(sourcePath);
    if (!resolved) continue;
    if (!fs.existsSync(resolved)) {
      fail(`${check.id} source does not exist: ${sourcePath}`);
      continue;
    }
    const content = fs.readFileSync(resolved, 'utf8');
    sourceText.push(content);
    checkNoForbiddenMaterial(content, `${check.id} source ${sourcePath}`);
  }
  const combinedSource = sourceText.join('\n');
  for (const assertion of check.assertions ?? []) {
    if (!isRecord(assertion) || typeof assertion.contains !== 'string' || assertion.contains === '') {
      fail(`${check.id} has an invalid contains assertion`);
      continue;
    }
    if (!combinedSource.includes(assertion.contains)) {
      fail(`${check.id} source assertion missing: ${assertion.contains}`);
    }
  }
}

function validateRuntimeCheck(check, controlsById, evidenceIds) {
  if (!isRecord(check)) {
    fail('runtimeChecks contains a non-object item');
    return;
  }
  requireString(check.id, 'runtimeCheck.id');
  requireString(check.controlId, `${check.id}.controlId`);
  if (!controlsById.has(check.controlId)) fail(`${check.id} references unknown control ${check.controlId}`);
  requireString(check.kind, `${check.id}.kind`);
  if (!['pending', 'blocked'].includes(check.status)) {
    fail(`${check.id} must remain pending/blocked until real execution; got ${check.status}`);
  }
  if (check.evidenceClass !== 'runtime') fail(`${check.id} must use evidenceClass=runtime`);
  if (check.runtimeRequired !== true) fail(`${check.id} must use runtimeRequired=true`);
  requireString(check.evidenceId, `${check.id}.evidenceId`);
  evidenceIds.add(check.evidenceId);
  for (const field of ['tools', 'targets', 'scenarios', 'evidenceRequired', 'cannotBeSatisfiedBy']) {
    requireArray(check[field], `${check.id}.${field}`);
  }
  requireString(check.expected, `${check.id}.expected`);
  const runtimeSerialized = JSON.stringify(check).toLowerCase();
  if (/\b(pass|passed|captured|verified)\b/.test(runtimeSerialized)) {
    fail(`${check.id} contains an unverified runtime result marker`);
  }
}

function validateEvidence(item, gateCheckIds, controlIds) {
  if (!isRecord(item)) {
    fail('evidenceIndex contains a non-object item');
    return;
  }
  requireString(item.id, 'evidence.id');
  if (!controlIds.has(item.controlId)) fail(`${item.id} references unknown control ${item.controlId}`);
  if (!gateCheckIds.has(item.id)) fail(`${item.id} is not referenced by a check`);
  if (!['static', 'runtime'].includes(item.class)) fail(`${item.id} class must be static or runtime`);
  if (item.class === 'static') {
    if (item.status !== 'defined' || item.runtimeRequired !== false) {
      fail(`${item.id} static evidence must be defined with runtimeRequired=false`);
    }
    if (item.collectionPolicy !== 'repository-static-validator') fail(`${item.id} static collection policy is invalid`);
  } else {
    if (!['pending', 'blocked'].includes(item.status) || item.runtimeRequired !== true) {
      fail(`${item.id} runtime evidence must remain pending/blocked with runtimeRequired=true`);
    }
    if (item.collectionPolicy !== 'runtime-runner-only') fail(`${item.id} runtime collection policy is invalid`);
  }
  requireString(item.artifactPathPattern, `${item.id}.artifactPathPattern`);
}

function validateReportSchema(reportSchema) {
  if (!isRecord(reportSchema)) {
    fail('reportSchema is required');
    return;
  }
  requireString(reportSchema.id, 'reportSchema.id');
  requireString(reportSchema.version, 'reportSchema.version');
  const schema = reportSchema.jsonSchema;
  if (!isRecord(schema)) {
    fail('reportSchema.jsonSchema is required');
    return;
  }
  if (schema.type !== 'object') fail('reportSchema.jsonSchema.type must be object');
  if (schema.additionalProperties !== false) fail('security report schema must reject unknown properties');
  for (const field of ['schemaVersion', 'reportId', 'batch', 'commitSha', 'run', 'decision', 'controls', 'findings', 'evidence']) {
    if (!schema.required?.includes(field)) fail(`report schema is missing required field: ${field}`);
  }
  for (const field of ['decision', 'controls', 'findings', 'evidence']) {
    if (!schema.properties?.[field]) fail(`report schema is missing property: ${field}`);
  }
  for (const field of ['status', 'runtimePending', 'unverifiedPassBlocked']) {
    if (!schema.properties?.decision?.required?.includes(field)) fail(`report decision is missing required field: ${field}`);
  }
}

const config = readJson(configPath, configRelativePath);

if (config) {
  if (config.schemaVersion !== 1) fail('schemaVersion must be 1');
  if (config.batch !== 'B20') fail('batch must be B20');
  if (config.taskId !== 'V2-B20-SEC-001') fail('taskId must be V2-B20-SEC-001');
  if (config.phase !== 'phase-1') fail('security Gate must remain Phase 1');
  if (config.mode !== 'static-and-synthetic') fail('mode must be static-and-synthetic');

  const task = config.task;
  if (!isRecord(task)) fail('task is required');
  else {
    if (task.id !== config.taskId) fail('task.id must match taskId');
    if (task.status !== 'defined') fail('task status must be defined');
    if (task.runtimeRequired !== true) fail('task must declare runtimeRequired=true');
    requireArray(task.acceptanceRefs, 'task.acceptanceRefs', 2);
  }

  const execution = config.execution;
  if (!isRecord(execution)) fail('execution is required');
  else {
    if (execution.mode !== 'static-fixture-only') fail('execution.mode must be static-fixture-only');
    if (execution.status !== 'runtimeBlocked' || execution.runtimeBlocked !== true) fail('execution must remain runtimeBlocked');
    if (execution.allowUnverifiedPass !== false) fail('execution must reject unverified pass');
    if (execution.runtimeEvidence !== null) fail('runtimeEvidence must be null before real execution');
    requireArray(execution.blockedReasons, 'execution.blockedReasons');
  }

  const controls = config.controls ?? [];
  requireArray(controls, 'controls', expectedControlIds.length);
  unique(controls.map((control) => control?.id), 'control ids');
  const controlsById = new Map(controls.map((control) => [control?.id, control]));
  for (const controlId of expectedControlIds) {
    if (!controlsById.has(controlId)) fail(`missing control: ${controlId}`);
  }
  for (const control of controls) {
    requireString(control?.id, 'control.id');
    requireString(control?.objective, `${control?.id}.objective`);
    if (control?.priority !== 'P0') fail(`${control?.id} must be P0 for the Phase 1 security Gate`);
    if (control?.staticPolicy !== 'defined') fail(`${control?.id} staticPolicy must be defined`);
    if (control?.runtimeStatus !== 'pending') fail(`${control?.id} runtimeStatus must be pending`);
  }

  const tooling = config.tooling;
  if (!isRecord(tooling)) fail('tooling is required');
  else {
    const requiredToolGroups = {
      sast: ['Semgrep', 'CodeQL'],
      dependency: ['OWASP Dependency-Check', 'OSV-Scanner'],
      image: ['Trivy', 'Grype'],
      secrets: ['Gitleaks', 'synthetic-fixture-scan'],
      sbomAndProvenance: ['Syft', 'CycloneDX', 'cosign']
    };
    for (const [group, tools] of Object.entries(requiredToolGroups)) {
      const definition = tooling[group];
      if (!isRecord(definition)) {
        fail(`tooling.${group} is required`);
        continue;
      }
      if (definition.required !== true || definition.runtimeRequired !== true || definition.status !== 'pending') {
        fail(`tooling.${group} must be required, runtimeRequired and pending`);
      }
      for (const tool of tools) if (!definition.tools?.includes(tool)) fail(`tooling.${group} is missing ${tool}`);
    }
  }

  const secretPolicy = config.repositorySecretPolicy;
  if (!isRecord(secretPolicy)) fail('repositorySecretPolicy is required');
  else {
    if (secretPolicy.actualSecretMaterial !== 'forbidden') fail('actual secret material must be forbidden');
    if (secretPolicy.fixtureMode !== 'synthetic-only') fail('fixture mode must be synthetic-only');
    requireArray(secretPolicy.forbiddenFixtureFields, 'repositorySecretPolicy.forbiddenFixtureFields', 8);
    requireArray(secretPolicy.forbiddenPatterns, 'repositorySecretPolicy.forbiddenPatterns', 5);
    requireArray(secretPolicy.scanTargets, 'repositorySecretPolicy.scanTargets', 4);
  }

  const kmsVault = config.kmsVault;
  if (!isRecord(kmsVault)) fail('kmsVault is required');
  else {
    if (kmsVault.providerMode !== 'external-approved-kms-or-vault') fail('KMS/Vault must be external-approved');
    if (kmsVault.repositorySecretMaterial !== false || kmsVault.environmentReferenceOnly !== true) fail('KMS/Vault material must be external and env-reference-only');
    if (kmsVault.failClosedOnUnavailable !== true || kmsVault.runtimeStatus !== 'pending') fail('KMS/Vault failure policy must be pending and fail closed');
    requireArray(kmsVault.requiredControls, 'kmsVault.requiredControls', 5);
  }

  const leastPrivilege = config.leastPrivilege;
  if (!isRecord(leastPrivilege)) fail('leastPrivilege is required');
  else {
    if (leastPrivilege.defaultEffect !== 'deny' || leastPrivilege.unknownDecision !== 'deny') fail('least privilege must default and fail closed with deny');
    if (leastPrivilege.serviceAccountPerService !== true || leastPrivilege.crossServiceSchemaWrite !== false || leastPrivilege.clientAuthorityHeadersTrusted !== false) fail('least privilege isolation flags are invalid');
    requireArray(leastPrivilege.forbiddenAuthorityHeaders, 'leastPrivilege.forbiddenAuthorityHeaders', 7);
    requireArray(leastPrivilege.requiredDecisionFacts, 'leastPrivilege.requiredDecisionFacts', 10);
  }

  const containerRuntime = config.containerRuntime;
  if (!isRecord(containerRuntime)) fail('containerRuntime is required');
  else {
    for (const [field, expected] of Object.entries({ podSecurityStandard: 'restricted', runAsNonRoot: true, allowPrivilegeEscalation: false, readOnlyRootFilesystem: true, seccompProfile: 'RuntimeDefault', imageReference: 'immutable-digest-required', runtimeStatus: 'pending' })) {
      if (containerRuntime[field] !== expected) fail(`containerRuntime.${field} must be ${expected}`);
    }
    if (!Array.isArray(containerRuntime.dropLinuxCapabilities) || !containerRuntime.dropLinuxCapabilities.includes('ALL')) fail('container runtime must drop ALL capabilities');
  }

  const networkBoundary = config.networkBoundary;
  if (!isRecord(networkBoundary)) fail('networkBoundary is required');
  else {
    if (networkBoundary.localBindAddress !== '127.0.0.1' || networkBoundary.defaultDenyNetworkPolicy !== true) fail('network boundary must bind locally and default deny');
    if (networkBoundary.publicIngressOwner !== 'api-gateway' || networkBoundary.domainServicesDirectPublicIngress !== false || networkBoundary.egressAllowlistRequired !== true) fail('network public ingress/egress boundary is invalid');
    if (networkBoundary.runtimeStatus !== 'pending') fail('network runtime status must be pending');
  }

  const mtls = config.mtlsAndSigning;
  if (!isRecord(mtls)) fail('mtlsAndSigning is required');
  else {
    if (mtls.serviceTransport !== 'mTLS' || mtls.clientCertificateRequiredForInternalCalls !== true || mtls.certificateExpiryDecision !== 'deny') fail('mTLS transport policy is invalid');
    if (mtls.forwardedIdentityHeadersTrusted !== false || mtls.artifactSignatureRequired !== true || mtls.signatureVerificationBeforeDeploy !== true || mtls.signatureKeySource !== 'KMS-or-Vault') fail('mTLS/signature trust policy is invalid');
    if (mtls.runtimeStatus !== 'pending') fail('mTLS runtime status must be pending');
  }

  const checkEvidenceIds = new Set();
  const staticChecks = config.staticChecks ?? [];
  requireArray(staticChecks, 'staticChecks', expectedControlIds.length);
  unique(staticChecks.map((check) => check?.id), 'static check ids');
  for (const check of staticChecks) validateStaticCheck(check, controlsById, checkEvidenceIds);
  const runtimeChecks = config.runtimeChecks ?? [];
  requireArray(runtimeChecks, 'runtimeChecks', expectedControlIds.length);
  unique(runtimeChecks.map((check) => check?.id), 'runtime check ids');
  for (const check of runtimeChecks) validateRuntimeCheck(check, controlsById, checkEvidenceIds);
  if (new Set(staticChecks.map((check) => check?.controlId)).size !== expectedControlIds.length) fail('static checks must cover each security control exactly once');
  if (new Set(runtimeChecks.map((check) => check?.controlId)).size !== expectedControlIds.length) fail('runtime checks must cover each security control exactly once');

  const evidenceIndex = config.evidenceIndex ?? [];
  requireArray(evidenceIndex, 'evidenceIndex', expectedControlIds.length * 2);
  unique(evidenceIndex.map((item) => item?.id), 'evidence ids');
  const controlIds = new Set(expectedControlIds);
  for (const item of evidenceIndex) validateEvidence(item, checkEvidenceIds, controlIds);
  for (const evidenceId of checkEvidenceIds) if (!evidenceIndex.some((item) => item?.id === evidenceId)) fail(`missing evidence index item: ${evidenceId}`);
  if (evidenceIndex.filter((item) => item?.class === 'runtime').some((item) => !['pending', 'blocked'].includes(item.status))) fail('runtime evidence cannot be passed or captured by static validation');

  validateReportSchema(config.reportSchema);
}

const output = {
  batch: config?.batch ?? 'B20',
  taskId: config?.taskId ?? 'V2-B20-SEC-001',
  result: errors.length === 0 ? 'PASS' : 'FAIL',
  staticChecks: config?.staticChecks?.length ?? 0,
  runtimeChecks: config?.runtimeChecks?.length ?? 0,
  runtimeEvidencePending: config?.evidenceIndex?.filter((item) => item?.class === 'runtime' && ['pending', 'blocked'].includes(item.status)).length ?? 0,
  runtimeBlocked: config?.execution?.runtimeBlocked === true,
  errors
};

console.log(JSON.stringify(output, null, 2));
if (errors.length > 0) process.exitCode = 1;
