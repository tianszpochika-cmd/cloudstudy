import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const patchPath = path.join(root, 'packages/contracts/fragments/m1-017-audit-export.openapi.json');
const policyPath = path.join(root, 'config/p1r-m1-017-audit-export.v1.json');
const canonicalPath = path.join(root, 'packages/contracts/openapi/v1/openapi.json');
const patch = JSON.parse(fs.readFileSync(patchPath, 'utf8'));
const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
const canonical = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));

const expectedRoutes = new Map([
  ['/internal/v1/audit/exports', new Set(['post'])],
  ['/internal/v1/audit/exports/{exportId}', new Set(['get'])],
  ['/internal/v1/audit/exports/{exportId}/download', new Set(['post'])],
  ['/internal/v1/audit/exports/{exportId}/recovery', new Set(['post'])],
]);
const expectedOperations = new Set(policy.patch.canonicalOperations);
const expectedOperationContracts = new Map([
  ['/internal/v1/audit/exports:post', {
    operationId: 'createM1017AuditExport',
    permission: 'audit.export.create',
    allowedActors: ['ADMIN_OPS_SERVICE', 'WORKFLOW_SERVICE'],
  }],
  ['/internal/v1/audit/exports/{exportId}:get', {
    operationId: 'getM1017AuditExport',
    permission: 'audit.export.read',
    allowedActors: ['ADMIN_OPS_SERVICE', 'WORKFLOW_SERVICE'],
  }],
  ['/internal/v1/audit/exports/{exportId}/download:post', {
    operationId: 'requestM1017AuditExportDownload',
    permission: 'audit.export.download',
    allowedActors: ['ADMIN_OPS_SERVICE', 'WORKFLOW_SERVICE'],
  }],
  ['/internal/v1/audit/exports/{exportId}/recovery:post', {
    operationId: 'recoverM1017AuditExport',
    permission: 'audit.export.recover',
    allowedActors: ['WORKFLOW_SERVICE'],
  }],
]);
const expectedTrustedFacts = [
  'workloadIdentity', 'subject', 'tenant', 'roles', 'permissions', 'policyVersion', 'resourceOwner',
];
const forbiddenRequestFields = new Set(policy.authorization.forbiddenClientAuthorityFields);
const forbiddenPayloadFields = new Set(policy.redaction.forbiddenPropertyNames.concat([
  'subjectId', 'tenantId', 'ownerId', 'actorId', 'downloadUrl', 'downloadUri',
]));

function clone(value) {
  return structuredClone(value);
}

function walk(value, visitor, location = '$') {
  visitor(value, location);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visitor, `${location}[${index}]`));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => walk(child, visitor, `${location}.${key}`));
  }
}

function collectSchemaPropertyNames(schema, names = new Set()) {
  if (!schema || typeof schema !== 'object') return names;
  for (const name of Object.keys(schema.properties ?? {})) names.add(name);
  for (const child of [schema.items, schema.not, schema.if, schema.then, schema.else]) {
    collectSchemaPropertyNames(child, names);
  }
  for (const branch of [...(schema.allOf ?? []), ...(schema.oneOf ?? []), ...(schema.anyOf ?? [])]) {
    collectSchemaPropertyNames(branch, names);
  }
  return names;
}

function assertLocalRefs(value, document) {
  walk(value, (node, location) => {
    if (!node || typeof node !== 'object' || typeof node.$ref !== 'string') return;
    const match = /^#\/components\/(schemas|parameters|responses|headers|securitySchemes|requestBodies|examples)\/([^/]+)$/.exec(node.$ref);
    assert.ok(match, `${location} must use a local component ref`);
    assert.ok(document?.components?.[match[1]]?.[match[2]], `${location} must use a known component ref`);
  });
}

function assertNoForbiddenPayloadFields(schema, label) {
  const names = collectSchemaPropertyNames(schema);
  for (const name of names) {
    assert.equal(forbiddenPayloadFields.has(name), false, `${label} exposes forbidden property ${name}`);
  }
}

function assertClosedSchema(schema, label) {
  assert.equal(schema?.type, 'object', `${label} must be an object schema`);
  assert.equal(schema?.additionalProperties, false, `${label} must be closed`);
  assert.ok(Array.isArray(schema.required), `${label} must declare required fields`);
  assertNoForbiddenPayloadFields(schema, label);
}

function operationSchemas(operation) {
  const schemas = [];
  const requestRef = operation.requestBody?.content?.['application/json']?.schema?.$ref;
  if (requestRef) schemas.push(requestRef.split('/').pop());
  return schemas;
}

function validatePatchDocument(document, documentPolicy = policy) {
  assert.equal(document.openapi, '3.0.3');
  assert.equal(document['x-contract-status'], 'canonical');
  assert.equal(document['x-m1017-audit-export']?.task, 'P1R-M1-017');
  assert.equal(document['x-m1017-audit-export']?.owner, 'audit-service');
  assert.equal(document['x-m1017-audit-export']?.dataOwner, 'audit-service');
  assert.equal(document['x-m1017-audit-export']?.externalExposure, 'DENY');
  assert.equal(document['x-m1017-audit-export']?.immutableAudit, true);
  assert.equal(document['x-m1017-audit-export']?.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
  const knownComponents = {};
  for (const group of ['schemas', 'parameters', 'responses', 'headers', 'securitySchemes', 'requestBodies', 'examples']) {
    knownComponents[group] = { ...(canonical.components?.[group] ?? {}), ...(document.components?.[group] ?? {}) };
  }
  assertLocalRefs(document, { components: knownComponents });

  const actualRoutes = new Map();
  for (const [route, pathItem] of Object.entries(document.paths ?? {})) {
    actualRoutes.set(route, new Set(Object.keys(pathItem).filter((method) => expectedRoutes.get(route)?.has(method) || ['get', 'post', 'put', 'patch', 'delete'].includes(method))));
  }
  assert.deepEqual([...actualRoutes.keys()].sort(), [...expectedRoutes.keys()].sort(), 'route set must remain internal and exact');

  const schemaMap = document.components?.schemas ?? {};
  for (const [route, methods] of expectedRoutes) {
    const pathItem = document.paths[route];
    assert.ok(pathItem, `missing ${route}`);
    for (const method of methods) {
      const operation = pathItem[method];
      assert.ok(operation, `missing ${method.toUpperCase()} ${route}`);
      const expected = expectedOperationContracts.get(`${route}:${method}`);
      assert.ok(expected, `${route}:${method} must be explicitly allowlisted`);
      assert.equal(expectedOperations.has(operation.operationId), true, `${route} operation must be allowlisted`);
      assert.equal(operation.operationId, expected.operationId);
      assert.equal(operation.security?.length, 1);
      assert.deepEqual(operation.security[0], { B8WorkloadIdentity: [] });
      assert.equal(operation['x-owner'], 'audit-service');
      assert.equal(operation['x-data-owner'], 'audit-service');
      assert.equal(operation['x-permission'], expected.permission);
      assert.equal(operation['x-contract']?.task, 'P1R-M1-017');
      assert.equal(operation['x-contract']?.canonical, true);
      assert.equal(operation['x-contract']?.maturity, 'D2_CONTRACT_READY');
      assert.equal(operation['x-contract']?.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
      assert.equal(operation['x-contract']?.clientAuthority, 'NONE');
      assert.equal(operation['x-authorization']?.defaultDecision, 'DENY');
      assert.equal(operation['x-authorization']?.requiredPermission, expected.permission);
      assert.equal(operation['x-authorization']?.clientAuthority, 'NONE');
      assert.equal(operation['x-authorization']?.pep, 'audit-service-local');
      assert.deepEqual(operation['x-authorization']?.allowedActors, expected.allowedActors);
      assert.deepEqual(operation['x-authorization']?.trustedFacts, expectedTrustedFacts);
      if (method === 'post') {
        assert.equal(operation['x-idempotency']?.required, true, `${operation.operationId} must be idempotent`);
      }
      assert.equal(operation['x-audit']?.required, true);
      assert.equal(operation['x-audit']?.sink, 'audit-service');
      assert.equal(operation['x-audit']?.appendOnly, true);
      assert.equal(operation['x-audit']?.redacted, true);
      for (const field of policy.redaction.forbiddenPropertyNames) {
        assert.equal(operation['x-audit']?.allowedFields?.includes(field), false, `${operation.operationId} audit allows forbidden ${field}`);
        assert.equal(operation['x-audit']?.forbiddenFields?.includes(field), true, `${operation.operationId} audit must forbid ${field}`);
      }
      for (const schemaName of operationSchemas(operation)) {
        assertClosedSchema(schemaMap[schemaName], `${operation.operationId} request`);
        for (const field of collectSchemaPropertyNames(schemaMap[schemaName])) {
          assert.equal(forbiddenRequestFields.has(field), false, `${operation.operationId} accepts client authority ${field}`);
        }
      }
    }
  }

  const expectedSchemas = [
    'M1017AuditExportCreateRequest',
    'M1017AuditExportDownloadRequest',
    'M1017AuditExportRecoveryRequest',
    'M1017AuditExportCreateResponse',
    'M1017AuditExportStatusResponse',
    'M1017AuditExportDownloadGrant',
    'M1017AuditExportRecoveryReceipt',
    'M1017AuditRecordSummary',
  ];
  for (const name of expectedSchemas) assertClosedSchema(schemaMap[name], `#/components/schemas/${name}`);
  assert.equal(schemaMap.M1017AuditExportIdValue?.type, 'string');
  assert.match(schemaMap.M1017AuditExportIdValue?.pattern ?? '', /^\^audit-export_/);
  assert.equal(schemaMap.M1017AuditExportDownloadGrant.properties.grantRef.pattern.startsWith('^audit-download-ref:'), true);
  assert.equal(schemaMap.M1017AuditExportDownloadGrant.properties.oneTime.const, true);
  assert.equal(schemaMap.M1017AuditExportDownloadGrant.properties.redacted.const, true);
  assert.equal(schemaMap.M1017AuditExportStatusResponse.properties.domainFactsUntouched.const, true);
  assert.equal(schemaMap.M1017AuditExportRecoveryReceipt.properties.domainFactsUntouched.const, true);
  assert.equal(schemaMap.M1017AuditRecordSummary.properties.appendOnly.const, true);
  assert.equal(schemaMap.M1017AuditRecordSummary.properties.redacted.const, true);
  assert.equal(documentPolicy.ownership.dataOwner, 'audit-service');
  assert.equal(documentPolicy.sourceOfTruth, 'packages/contracts/fragments/m1-017-audit-export.openapi.json');
  assert.equal(documentPolicy.patch.sourceFile, documentPolicy.sourceOfTruth);
  assert.equal(documentPolicy.patch.applyMode, 'DIRECT_CANONICAL_SOURCE');
  assert.equal(documentPolicy.ownership.publicRouteEligible, false);
  assert.equal(documentPolicy.export.download.credentialInResponse, false);
  assert.equal(documentPolicy.reliability.maxAttemptsIncludingInitial, 5);
  assert.equal(documentPolicy.legacyCompatibility.deprecated, true);
  assert.equal(documentPolicy.legacyCompatibility.defaultDecision, 'DENY');
}

test('M1-017 audit export patch freezes internal-only owner and closed request/response shapes', () => {
  validatePatchDocument(patch);
});

test('M1-017 audit export patch has no external refs, public audit route, or client authority', () => {
  const mutated = clone(patch);
  mutated.paths['/api/v1/admin/audit/exports'] = mutated.paths['/internal/v1/audit/exports'];
  assert.throws(() => validatePatchDocument(mutated), /route set must remain internal and exact/);

  const withExternalRef = clone(patch);
  withExternalRef.paths['/internal/v1/audit/exports'].post.requestBody.content['application/json'].schema.$ref = 'https://evil.example/schema.json';
  assert.throws(() => validatePatchDocument(withExternalRef), /local component ref/);

  const withUnknownRef = clone(patch);
  withUnknownRef.paths['/internal/v1/audit/exports'].post.requestBody.content['application/json'].schema.$ref = '#/components/schemas/UnknownM1017Schema';
  assert.throws(() => validatePatchDocument(withUnknownRef), /known component ref/);
});

test('M1-017 audit export patch rejects nested authority, prefix bypass, raw payload and credential mutations', () => {
  const authority = clone(patch);
  authority.components.schemas.M1017AuditExportCreateRequest.allOf = [{
    type: 'object',
    additionalProperties: false,
    properties: { tenantId: { type: 'string' } },
  }];
  assert.throws(() => validatePatchDocument(authority), /forbidden property tenantId|client authority tenantId/);

  const prefix = clone(patch);
  prefix.paths['/internal/v1/audit/exports'].post['x-authorization'].clientAuthority = 'NONE;tenant';
  assert.throws(() => validatePatchDocument(prefix), /clientAuthority|NONE/);

  for (const field of ['rawText', 'rawBody', 'description', 'body', 'freeText', 'secret']) {
    const raw = clone(patch);
    raw.components.schemas.M1017AuditExportCreateRequest.properties[field] = { type: 'string' };
    assert.throws(() => validatePatchDocument(raw), new RegExp(`forbidden property ${field}|client authority ${field}`));
  }

  const credential = clone(patch);
  credential.components.schemas.M1017AuditExportDownloadGrant.properties.token = { type: 'string' };
  assert.throws(() => validatePatchDocument(credential), /forbidden property token/);
});

test('M1-017 audit export patch rejects mutable audit, recovery write and legacy promotion', () => {
  const mutableAudit = clone(patch);
  mutableAudit['x-m1017-audit-export'].immutableAudit = false;
  assert.throws(() => validatePatchDocument(mutableAudit), /immutableAudit|true/);

  const recoveryWrite = clone(patch);
  recoveryWrite.components.schemas.M1017AuditExportRecoveryReceipt.properties.domainFactsUntouched.const = false;
  assert.throws(() => validatePatchDocument(recoveryWrite), /domainFactsUntouched|true/);

  const legacy = clone(policy);
  legacy.legacyCompatibility.deprecated = false;
  assert.throws(() => validatePatchDocument(patch, legacy), /deprecated|true/);
});
