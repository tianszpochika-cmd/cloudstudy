import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ROOT = path.resolve(moduleDir, '../..');
export const DEFAULT_POLICY_PATH = 'config/p1r-privacy-lifecycle-contract.v1.json';
export const DEFAULT_OPENAPI_PATH = 'packages/contracts/fragments/m1-017-privacy-lifecycle.openapi.json';
export const DEFAULT_LEGACY_B1_PATH = 'packages/contracts/fragments/b1/b1-onboarding-privacy.openapi.json';

// Updated in the same reviewed change as the policy. A pending value is a
// failure, never an opt-out from source binding.
export const FROZEN_POLICY_SHA256 = 'e84d829c56519008720551631921bdf43184a3489142988cf6edfc4aa3c48fff';

const EXPECTED_ROOT_KEYS = Object.freeze([
  '$schema', 'schemaVersion', 'task', 'phase', 'startCommit', 'sourceBaseline', 'maturity', 'runtimeStatus',
  'collectionPolicy', 'canonicalSources', 'compatibilityPromotion', 'runtimeBoundary', 'ownership', 'authority',
  'export', 'deletion', 'eventIntegration', 'adversarialCases',
]);

const EXPECTED_EXPORT_OPERATIONS = Object.freeze([
  ['post', '/api/v1/privacy/exports', 'createM1017PrivacyExport', 'learner-service.privacy', 'public', 'M1017PrivacyExportRequest'],
  ['get', '/api/v1/privacy/exports/{exportId}', 'getM1017PrivacyExportStatus', 'learner-service.privacy', 'public'],
  ['post', '/api/v1/privacy/exports/{exportId}/download', 'createM1017PrivacyExportDownloadGrant', 'learner-service.privacy', 'public'],
  ['get', '/api/v1/privacy/exports/{exportId}/receipt', 'getM1017PrivacyExportReceipt', 'learner-service.privacy', 'public'],
  ['post', '/internal/v1/privacy/exports/{exportId}/owner-receipts', 'recordM1017PrivacyExportOwnerReceipt', 'learner-service.privacy', 'internal', 'M1017OwnerReceiptSubmission'],
  ['post', '/internal/v1/privacy/exports/{exportId}/recovery', 'recoverM1017PrivacyExport', 'learner-service.privacy', 'internal', 'M1017PrivacyRecoveryCommand'],
]);

const EXPECTED_DELETION_OPERATIONS = Object.freeze([
  ['post', '/api/v1/iam/account-deletions', 'createM1017AccountDeletionRequest', 'iam-service', 'public', 'M1017AccountDeletionRequest'],
  ['get', '/api/v1/iam/account-deletions/{deletionRequestId}', 'getM1017AccountDeletionStatus', 'iam-service', 'public'],
  ['post', '/api/v1/iam/account-deletions/{deletionRequestId}/cancel', 'cancelM1017AccountDeletionRequest', 'iam-service', 'public', 'M1017AccountDeletionCancelRequest'],
  ['post', '/internal/v1/iam/account-deletions/{deletionRequestId}/execute', 'executeM1017AccountDeletion', 'iam-service', 'internal'],
  ['post', '/internal/v1/iam/account-deletions/{deletionRequestId}/owner-receipts', 'recordM1017AccountDeletionOwnerReceipt', 'iam-service', 'internal', 'M1017OwnerReceiptSubmission'],
  ['post', '/internal/v1/iam/account-deletions/{deletionRequestId}/recovery', 'recoverM1017AccountDeletion', 'iam-service', 'internal', 'M1017DeletionRecoveryCommand'],
]);

const EXPECTED_EXPORT_STATES = Object.freeze(['REQUESTED', 'COLLECTING', 'ASSEMBLING', 'READY', 'DOWNLOAD_ISSUED', 'EXPIRED', 'FAILED', 'RECOVERY_REQUIRED']);
const EXPECTED_DELETION_STATES = Object.freeze(['PENDING_COOLING_OFF', 'CANCELLED', 'EXECUTING', 'RECOVERY_REQUIRED', 'ANONYMIZED']);
const FORBIDDEN_PUBLIC_AUTHORITY_FIELDS = Object.freeze([
  'principalId', 'subjectId', 'tenantId', 'owner', 'ownerId', 'ownerService', 'status', 'state', 'executeAt',
  'coolingOffHours', 'sessionRevocationState', 'legalHoldDecision', 'receiptId', 'receiptSummary',
  'recoveryTaskRef', 'policyVersion', 'auditRef', 'deletedAt', 'anonymizedAt',
]);
const FORBIDDEN_INTERNAL_RECEIPT_FIELDS = Object.freeze(['principalId', 'subjectId', 'tenantId', 'owner', 'ownerId', 'ownerService', 'status', 'state', 'executeAt']);

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (plainObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function policyDigest(policy) {
  return createHash('sha256').update(stableJson(policy)).digest('hex');
}

function sameArray(actual, expected) {
  return Array.isArray(actual)
    && Array.isArray(expected)
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function exactKeys(errors, value, expected, label) {
  if (!plainObject(value)) {
    errors.push(`${label} must be an object`);
    return;
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (!sameArray(actual, wanted)) errors.push(`${label} keys drifted: expected ${wanted.join(', ')}; got ${actual.join(', ')}`);
}

function expect(errors, condition, message) {
  if (!condition) errors.push(message);
}

function readJson(root, relativePath, label, readErrors) {
  const absolutePath = path.join(root, ...relativePath.split('/'));
  if (!existsSync(absolutePath)) {
    readErrors.push(`${label} missing: ${relativePath}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    readErrors.push(`${label} is invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export function readPrivacyLifecycleContractInputs({ root = DEFAULT_ROOT } = {}) {
  const readErrors = [];
  return {
    root,
    policy: readJson(root, DEFAULT_POLICY_PATH, 'policy', readErrors),
    openApi: readJson(root, DEFAULT_OPENAPI_PATH, 'M1-017 OpenAPI source', readErrors),
    legacyB1OpenApi: readJson(root, DEFAULT_LEGACY_B1_PATH, 'legacy B1 OpenAPI source', readErrors),
    readErrors,
  };
}

function localSchema(source, schema) {
  if (!plainObject(schema)) return null;
  const ref = schema.$ref;
  if (typeof ref !== 'string') return schema;
  const match = /^#\/components\/schemas\/([A-Za-z][A-Za-z0-9_]*)$/.exec(ref);
  return match ? source?.components?.schemas?.[match[1]] ?? null : null;
}

function schemaPropertyNames(source, schema, visited = new Set()) {
  const resolved = localSchema(source, schema);
  if (!plainObject(resolved)) return new Set();
  if (visited.has(resolved)) return new Set();
  visited.add(resolved);
  const names = new Set(Object.keys(resolved.properties ?? {}));
  for (const keyword of ['allOf', 'anyOf', 'oneOf']) {
    for (const child of resolved[keyword] ?? []) {
      for (const name of schemaPropertyNames(source, child, visited)) names.add(name);
    }
  }
  return names;
}

function findRequestSchema(source, operation) {
  return localSchema(source, operation?.requestBody?.content?.['application/json']?.schema);
}

function hasSecurityScheme(operation, scheme) {
  return Array.isArray(operation?.security) && operation.security.some((entry) => plainObject(entry) && Object.hasOwn(entry, scheme));
}

function operationAt(source, route, method) {
  return source?.paths?.[route]?.[method] ?? null;
}

function validatePolicy(policy, errors) {
  exactKeys(errors, policy, EXPECTED_ROOT_KEYS, 'policy');
  if (!plainObject(policy)) return;
  expect(errors, policy.$schema === 'p1r.privacy-lifecycle-contract.v1', 'policy $schema must be p1r.privacy-lifecycle-contract.v1');
  expect(errors, policy.schemaVersion === 'p1r.privacy-lifecycle-contract.v1', 'policy schemaVersion must be p1r.privacy-lifecycle-contract.v1');
  expect(errors, policy.task === 'P1R-M1-017', 'policy task must be P1R-M1-017');
  expect(errors, policy.phase === 'P1', 'policy phase must be P1');
  expect(errors, policy.maturity === 'D2_CONTRACT_READY', 'policy maturity must be D2_CONTRACT_READY');
  expect(errors, policy.runtimeStatus === 'NOT_RUNTIME_VERIFIED', 'policy runtimeStatus must remain NOT_RUNTIME_VERIFIED');
  expect(errors, /^[0-9a-f]{40}$/i.test(policy.startCommit ?? ''), 'policy startCommit must be a 40-character SHA');
  expect(errors, /^[0-9a-f]{40}$/i.test(policy.sourceBaseline ?? ''), 'policy sourceBaseline must be a 40-character SHA');
  expect(errors, policy.collectionPolicy?.unknownFieldDecision === 'DENY', 'policy unknown fields must deny');
  expect(errors, policy.collectionPolicy?.unknownEnumDecision === 'DENY', 'policy unknown enums must deny');
  expect(errors, policy.collectionPolicy?.additionalProperties === 'DENY', 'policy additional properties must deny');
  expect(errors, policy.collectionPolicy?.clientAuthorityExpansion === 'PROHIBITED', 'policy client authority expansion must be prohibited');
  expect(errors, policy.collectionPolicy?.unverifiedRuntimeClaim === 'DENY', 'policy unverified runtime claims must deny');

  expect(errors, policy.compatibilityPromotion?.promotionMode === 'FUTURE_M1017_OPENAPI_ONLY', 'M1-017 promotion mode must stay future M1017 OpenAPI only');
  expect(errors, policy.compatibilityPromotion?.allowsHistoricalV1Promotion === false, 'historical v1 promotion must be false');
  expect(errors, policy.compatibilityPromotion?.allowsDualPublish === false, 'dual publish must be false');
  expect(errors, policy.compatibilityPromotion?.legacyB1ExportRoute?.classification === 'HISTORICAL_B1_ADAPTER_ONLY', 'legacy B1 export must stay adapter-only');
  expect(errors, policy.compatibilityPromotion?.legacyB1ExportRoute?.canonicalSuccessor === 'createM1017PrivacyExport', 'legacy B1 export successor drifted');
  expect(errors, policy.runtimeBoundary?.contractOnly === true, 'runtime boundary must remain contract-only');
  expect(errors, policy.runtimeBoundary?.runtimeEvidence === 'NOT_RUNTIME_VERIFIED', 'runtime evidence must remain NOT_RUNTIME_VERIFIED');

  expect(errors, policy.authority?.principalAndTenant === 'SERVER_DERIVED_FROM_VERIFIED_TOKEN_OR_WORKLOAD_IDENTITY', 'principal and tenant authority must be server-derived');
  expect(errors, Array.isArray(policy.authority?.clientMaySet) && policy.authority.clientMaySet.length === 0, 'clientMaySet must remain empty');
  for (const field of FORBIDDEN_PUBLIC_AUTHORITY_FIELDS) {
    expect(errors, policy.authority?.forbiddenClientAuthorityFields?.includes(field), `policy must forbid client authority field ${field}`);
  }

  expect(errors, policy.export?.owner === 'learner-service.privacy', 'privacy export owner must be learner-service.privacy');
  expect(errors, sameArray(policy.export?.canonicalOperations, EXPECTED_EXPORT_OPERATIONS.map((entry) => entry[2])), 'privacy export canonical operation list drifted');
  expect(errors, sameArray(policy.export?.states, EXPECTED_EXPORT_STATES), 'privacy export state set drifted');
  expect(errors, policy.export?.download?.oneTime === true, 'privacy download must be one-time');
  expect(errors, policy.export?.download?.cacheControl === 'no-store', 'privacy download must be no-store');
  expect(errors, policy.export?.receipt?.ownerReceiptRequired === true, 'privacy export must require owner receipt');
  expect(errors, policy.export?.recovery?.failureState === 'RECOVERY_REQUIRED', 'privacy export recovery state must be RECOVERY_REQUIRED');

  expect(errors, policy.deletion?.owner === 'iam-service', 'account deletion owner must be iam-service');
  expect(errors, sameArray(policy.deletion?.canonicalOperations, EXPECTED_DELETION_OPERATIONS.map((entry) => entry[2])), 'account deletion canonical operation list drifted');
  expect(errors, sameArray(policy.deletion?.states, EXPECTED_DELETION_STATES), 'account deletion state set drifted');
  expect(errors, policy.deletion?.coolingOffHours === 168, 'account deletion cooling-off must be 168 hours');
  expect(errors, sameArray(policy.deletion?.cancelAllowedOnlyIn, ['PENDING_COOLING_OFF']), 'account deletion cancellation must be limited to cooling-off');
  expect(errors, policy.deletion?.sessionRevocation?.requiredBeforeFinalState === true, 'session revocation must precede final deletion state');
  expect(errors, policy.deletion?.sessionRevocation?.state === 'REVOKED', 'session revocation state must be REVOKED');
  expect(errors, policy.deletion?.legalHold?.mustCheckBeforeOwnerDeleteOrAnonymize === true, 'legal hold must be checked before owner deletion');
  expect(errors, policy.deletion?.legalHold?.unknownDecision === 'DENY', 'unknown legal hold must deny');
  expect(errors, policy.deletion?.receipt?.ownerReceiptRequired === true, 'account deletion must require owner receipts');
  expect(errors, policy.deletion?.receipt?.allExpectedOwnersMustReconcileBeforeAnonymized === true, 'all owner receipts must reconcile before ANONYMIZED');
  expect(errors, policy.deletion?.recovery?.partialSuccessDoesNotClaimAnonymized === true, 'partial deletion success must not claim ANONYMIZED');

  expect(errors, policy.eventIntegration?.coordinatorOwned === true, 'event integration must be coordinator-owned');
  expect(errors, policy.eventIntegration?.e1MayCreateOrModifyEventFragment === false, 'E1 must not mutate event fragments');
  expect(errors, policy.eventIntegration?.e1MayCreateOrModifyCatalogAsyncApiOrB26 === false, 'E1 must not mutate catalog, AsyncAPI or B26');
  expect(errors, sameArray(policy.eventIntegration?.requiredGapBindings, ['EVENT-GAP-BIND-PRIV-001', 'EVENT-GAP-USR-DEL-001']), 'privacy event gap bindings drifted');
}

function assertSchemaStrict(source, name, errors) {
  const schema = source?.components?.schemas?.[name];
  expect(errors, plainObject(schema), `missing schema ${name}`);
  if (plainObject(schema)) expect(errors, schema.additionalProperties === false, `${name} must set additionalProperties false`);
  return schema;
}

function assertExactEnum(errors, schema, property, expected, label) {
  const actual = schema?.properties?.[property]?.enum;
  expect(errors, sameArray(actual, expected), `${label}.${property} enum drifted`);
}

function validateOperation(source, errors, specification) {
  const [method, route, operationId, owner, mode, bodySchemaName] = specification;
  const operation = operationAt(source, route, method);
  expect(errors, plainObject(operation), `missing ${method.toUpperCase()} ${route}`);
  if (!plainObject(operation)) return;
  expect(errors, operation.operationId === operationId, `${method.toUpperCase()} ${route} operationId drifted`);
  expect(errors, operation['x-owner'] === owner, `${operationId} owner must be ${owner}`);
  expect(errors, operation['x-contract']?.task === 'P1R-M1-017', `${operationId} task binding drifted`);
  expect(errors, operation['x-contract']?.canonical === true, `${operationId} must be canonical`);
  expect(errors, operation['x-contract']?.maturity === 'D2_CONTRACT_READY', `${operationId} maturity must be D2_CONTRACT_READY`);
  expect(errors, operation['x-contract']?.runtimeStatus === 'NOT_RUNTIME_VERIFIED', `${operationId} runtime status must remain unverified`);
  expect(errors, operation['x-contract']?.clientAuthority === 'NONE', `${operationId} contract client authority must be NONE`);
  expect(errors, operation['x-authorization']?.defaultDecision === 'DENY', `${operationId} must default deny`);
  expect(errors, operation['x-authorization']?.clientAuthority === 'NONE', `${operationId} authorization client authority must be NONE`);
  expect(errors, operation['x-authorization']?.serviceSidePepRequired === true, `${operationId} must require service-side PEP`);
  expect(errors, Boolean(operation['x-idempotency']) === (method === 'post'), `${operationId} idempotency metadata mismatch`);
  if (method === 'post') expect(errors, operation['x-idempotency']?.required === true, `${operationId} must require Idempotency-Key`);
  if (mode === 'public') {
    expect(errors, hasSecurityScheme(operation, 'bearerAuth'), `${operationId} must require bearerAuth`);
    expect(errors, !hasSecurityScheme(operation, 'B8ServiceIdentity'), `${operationId} public operation must not accept workload identity`);
  } else {
    expect(errors, hasSecurityScheme(operation, 'B8ServiceIdentity'), `${operationId} internal operation must require B8ServiceIdentity`);
    expect(errors, !hasSecurityScheme(operation, 'bearerAuth'), `${operationId} internal operation must not accept end-user bearerAuth`);
    expect(errors, operation['x-authorization']?.trustedFacts?.includes('trustedWorkloadIdentity'), `${operationId} must bind trusted workload identity`);
  }
  if (bodySchemaName) {
    const body = operation?.requestBody?.content?.['application/json']?.schema;
    expect(errors, body?.$ref === `#/components/schemas/${bodySchemaName}`, `${operationId} request schema must be ${bodySchemaName}`);
    const schema = findRequestSchema(source, operation);
    expect(errors, plainObject(schema), `${operationId} request schema must resolve locally`);
    if (plainObject(schema)) {
      expect(errors, schema.additionalProperties === false, `${operationId} request schema must deny additional properties`);
      const forbidden = mode === 'public' ? FORBIDDEN_PUBLIC_AUTHORITY_FIELDS : FORBIDDEN_INTERNAL_RECEIPT_FIELDS;
      for (const field of forbidden) {
        expect(errors, !schemaPropertyNames(source, body).has(field), `${operationId} must reject request field ${field}`);
      }
    }
  } else {
    expect(errors, operation.requestBody === undefined, `${operationId} must not accept a request body`);
  }
}

function validateOpenApi(openApi, policy, errors) {
  expect(errors, plainObject(openApi), 'M1-017 OpenAPI source must be an object');
  if (!plainObject(openApi)) return;
  expect(errors, openApi['x-source-task'] === 'P1R-M1-017', 'OpenAPI x-source-task must be P1R-M1-017');
  expect(errors, openApi['x-contract-status'] === 'active', 'M1-017 OpenAPI source must remain active');
  const actualRoutes = Object.entries(openApi.paths ?? {}).flatMap(([route, pathItem]) => Object.entries(pathItem ?? {})
    .filter(([method]) => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
    .map(([method, operation]) => `${method}:${route}:${operation?.operationId ?? ''}`)).sort();
  const expectedRoutes = [...EXPECTED_EXPORT_OPERATIONS, ...EXPECTED_DELETION_OPERATIONS]
    .map(([method, route, operationId]) => `${method}:${route}:${operationId}`).sort();
  expect(errors, sameArray(actualRoutes, expectedRoutes), 'M1-017 OpenAPI operation set drifted');
  for (const specification of [...EXPECTED_EXPORT_OPERATIONS, ...EXPECTED_DELETION_OPERATIONS]) validateOperation(openApi, errors, specification);

  const exportRequest = assertSchemaStrict(openApi, 'M1017PrivacyExportRequest', errors);
  expect(errors, sameArray(exportRequest?.required, ['reauthenticationRef', 'scope', 'purposeCode']), 'M1017PrivacyExportRequest required fields drifted');
  assertExactEnum(errors, exportRequest, 'scope', ['ACCOUNT_AND_LEARNER_DATA'], 'M1017PrivacyExportRequest');
  assertExactEnum(errors, exportRequest, 'purposeCode', ['DATA_EXPORT'], 'M1017PrivacyExportRequest');
  const exportStatus = assertSchemaStrict(openApi, 'M1017PrivacyExport', errors);
  assertExactEnum(errors, exportStatus, 'status', EXPECTED_EXPORT_STATES, 'M1017PrivacyExport');
  const download = assertSchemaStrict(openApi, 'M1017PrivacyDownloadGrant', errors);
  expect(errors, download?.properties?.oneTime?.const === true, 'privacy download oneTime must be true');
  expect(errors, download?.properties?.cacheControl?.const === 'no-store', 'privacy download cacheControl must be no-store');
  const exportReceipt = assertSchemaStrict(openApi, 'M1017PrivacyExportReceipt', errors);
  expect(errors, exportReceipt?.properties?.ownerReceipts?.items?.$ref === '#/components/schemas/M1017OwnerReceiptSummary', 'privacy receipt must expose redacted owner summaries only');
  const receiptSubmission = assertSchemaStrict(openApi, 'M1017OwnerReceiptSubmission', errors);
  for (const field of FORBIDDEN_INTERNAL_RECEIPT_FIELDS) {
    expect(errors, !Object.hasOwn(receiptSubmission?.properties ?? {}, field), `owner receipt submission must not accept ${field}`);
  }

  const deletionRequest = assertSchemaStrict(openApi, 'M1017AccountDeletionRequest', errors);
  expect(errors, sameArray(deletionRequest?.required, ['reauthenticationRef', 'confirmation', 'reasonCode']), 'M1017AccountDeletionRequest required fields drifted');
  expect(errors, deletionRequest?.properties?.confirmation?.const === 'DELETE_ACCOUNT', 'account deletion confirmation must be DELETE_ACCOUNT');
  const cancellation = assertSchemaStrict(openApi, 'M1017AccountDeletionCancelRequest', errors);
  expect(errors, sameArray(cancellation?.required, ['reauthenticationRef']), 'M1017AccountDeletionCancelRequest required fields drifted');
  const deletion = assertSchemaStrict(openApi, 'M1017AccountDeletion', errors);
  assertExactEnum(errors, deletion, 'status', EXPECTED_DELETION_STATES, 'M1017AccountDeletion');
  expect(errors, deletion?.properties?.coolingOffHours?.const === 168, 'account deletion response must freeze 168 cooling-off hours');
  assertExactEnum(errors, deletion, 'sessionRevocationState', ['NOT_STARTED', 'REVOKED'], 'M1017AccountDeletion');
  const deletionReceipt = assertSchemaStrict(openApi, 'M1017AccountDeletionReceipt', errors);
  expect(errors, deletionReceipt?.properties?.sessionRevocationState?.const === 'REVOKED', 'account deletion receipt must prove session revocation');

  expect(errors, sameArray(policy?.export?.states, exportStatus?.properties?.status?.enum), 'policy and OpenAPI export state sets diverged');
  expect(errors, sameArray(policy?.deletion?.states, deletion?.properties?.status?.enum), 'policy and OpenAPI deletion state sets diverged');
}

function validateLegacyB1(legacyB1OpenApi, errors) {
  const operation = operationAt(legacyB1OpenApi, '/api/v1/privacy/export', 'post');
  expect(errors, plainObject(operation), 'legacy B1 privacy export route missing');
  if (!plainObject(operation)) return;
  expect(errors, operation.operationId === 'createPrivacyExport', 'legacy B1 privacy export operationId drifted');
  expect(errors, operation.deprecated === true, 'legacy B1 privacy export must be deprecated');
  expect(errors, operation['x-contract']?.canonical === false, 'legacy B1 privacy export must not be canonical');
  expect(errors, operation['x-contract']?.classification === 'HISTORICAL_B1_ADAPTER_ONLY', 'legacy B1 privacy export classification drifted');
  expect(errors, operation['x-migration']?.canonicalOperationId === 'createM1017PrivacyExport', 'legacy B1 privacy export successor operation drifted');
  expect(errors, operation['x-migration']?.canonicalRoute === '/api/v1/privacy/exports', 'legacy B1 privacy export successor route drifted');
  expect(errors, operation['x-authorization']?.defaultDecision === 'DENY', 'legacy B1 privacy export must default deny');
  expect(errors, operation['x-authorization']?.clientAuthority === 'NONE', 'legacy B1 privacy export client authority must be NONE');
  const request = legacyB1OpenApi?.components?.schemas?.B1PrivacyExportRequest;
  expect(errors, plainObject(request), 'legacy B1 privacy export request schema missing');
  if (plainObject(request)) {
    expect(errors, request.additionalProperties === false, 'legacy B1 privacy export request must deny additional properties');
    expect(errors, !Object.hasOwn(request.properties ?? {}, 'subjectId'), 'legacy B1 privacy export request must reject client subjectId');
    expect(errors, !Object.hasOwn(request.properties ?? {}, 'tenantId'), 'legacy B1 privacy export request must reject client tenantId');
    expect(errors, sameArray(request.required, ['policyName', 'reauthenticationRef']), 'legacy B1 privacy export request must require policyName and reauthenticationRef');
  }
}

export function validatePrivacyLifecycleContractData(input) {
  const errors = [...(input?.readErrors ?? [])];
  const policy = input?.policy;
  validatePolicy(policy, errors);
  validateOpenApi(input?.openApi, policy, errors);
  validateLegacyB1(input?.legacyB1OpenApi, errors);
  const digest = policy ? policyDigest(policy) : null;
  if (FROZEN_POLICY_SHA256 === 'PENDING') errors.push('FROZEN_POLICY_SHA256 is pending');
  else expect(errors, digest === FROZEN_POLICY_SHA256, 'policy digest drifted from frozen source binding');
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    runtimeStatus: policy?.runtimeStatus ?? null,
    policyDigest: digest,
    summary: {
      canonicalPrivacyOperations: EXPECTED_EXPORT_OPERATIONS.length,
      canonicalDeletionOperations: EXPECTED_DELETION_OPERATIONS.length,
      coolingOffHours: policy?.deletion?.coolingOffHours ?? null,
      eventIntegration: policy?.eventIntegration?.coordinatorOwned === true ? 'COORDINATOR_OWNED_PENDING_PROJECTION' : null,
    },
    errors,
  };
}

export function validatePrivacyLifecycleContractFiles({ root = DEFAULT_ROOT } = {}) {
  return validatePrivacyLifecycleContractData(readPrivacyLifecycleContractInputs({ root }));
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isCli) {
  const report = validatePrivacyLifecycleContractFiles();
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else if (report.result === 'PASS') console.log(`P1R M1-017 privacy lifecycle contract PASS (${report.summary.canonicalPrivacyOperations + report.summary.canonicalDeletionOperations} canonical operations, runtimeStatus=${report.runtimeStatus}).`);
  else console.error(`P1R M1-017 privacy lifecycle contract FAIL:\n${report.errors.map((error) => `- ${error}`).join('\n')}`);
  if (report.result !== 'PASS') process.exitCode = 1;
}
