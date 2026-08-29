import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isHttpMethod, isRecord, resolveJsonPointer } from '../contracts/schema-utils.mjs';

const WRITE_METHODS = new Set(['post', 'put', 'patch', 'delete']);
const EXTERNAL_PREFIX = '/api/v1';
const INTERNAL_PREFIX = '/internal/v1';
const REQUIRED_ERROR_RESPONSES = Object.freeze({
  400: 'ApiBadRequest',
  401: 'ApiUnauthorized',
  403: 'ApiForbidden',
  404: 'ApiNotFound',
  409: 'ApiConflict',
  422: 'ApiUnprocessableEntity',
  429: 'ApiRateLimited',
  500: 'ApiInternalError',
  503: 'ApiServiceUnavailable',
  504: 'ApiGatewayTimeout',
});
const CANONICAL_SUCCESS_ENVELOPES = new Set([
  '#/components/schemas/ApiSuccessEnvelope',
  '#/components/schemas/ApiCursorPageEnvelope',
]);
const CURSOR_PARAMETER_REF = '#/components/parameters/Cursor';
const PAGE_SIZE_PARAMETER_REF = '#/components/parameters/PageSize';
const CURSOR_PAGE_ENVELOPE_REF = '#/components/schemas/ApiCursorPageEnvelope';
const CURSOR_PAGE_META_REF = '#/components/schemas/ApiCursorPageMeta';
const CURSOR_STATE_FIELDS = new Set(['cursor', 'nextcursor', 'previouscursor', 'page', 'pagesize', 'limit', 'offset', 'totalpages']);
const SIGNED_ACCESS_IDEMPOTENCY_EXCEPTION = Object.freeze({
  route: '/api/v1/content/media/{mediaAssetId}/signed-access',
  method: 'post',
  operationId: 'signContentMediaAccess',
});
const REQUIRED_META_FIELDS = ['requestId', 'traceId', 'apiVersion', 'schemaVersion', 'serverTime'];
const REQUIRED_ERROR_CODES = [
  'VALIDATION_ERROR',
  'AUTH_REQUIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'IDEMPOTENCY_REQUIRED',
  'IDEMPOTENCY_CONFLICT',
  'VERSION_CONFLICT',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
];

function add(errors, condition, message) {
  if (!condition) errors.push(message);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasAll(values, expected) {
  const actual = new Set(Array.isArray(values) ? values : []);
  return expected.every((value) => actual.has(value));
}

function dereference(document, reference, label, errors) {
  if (!isRecord(reference) || !nonEmpty(reference.$ref)) {
    errors.push(`${label} must be a local $ref`);
    return null;
  }
  try {
    return resolveJsonPointer(document, reference.$ref);
  } catch (error) {
    errors.push(`${label} cannot be resolved: ${reference.$ref} (${error.message})`);
    return null;
  }
}

function operationParameters(pathItem, operation) {
  return [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])];
}

function isIdempotencyHeader(document, parameter) {
  let resolved = parameter;
  if (isRecord(parameter) && nonEmpty(parameter.$ref)) {
    try {
      resolved = resolveJsonPointer(document, parameter.$ref);
    } catch {
      return false;
    }
  }
  return resolved?.name === 'Idempotency-Key' && resolved?.in === 'header' && resolved?.required === true;
}

function validateEnvelopeSchema(document, schemaName, required, errors) {
  const schema = document.components?.schemas?.[schemaName];
  add(errors, isRecord(schema), `missing canonical schema ${schemaName}`);
  if (!isRecord(schema)) return;
  add(errors, schema.type === 'object', `${schemaName} must be an object`);
  add(errors, schema.additionalProperties === false, `${schemaName} must reject undeclared fields`);
  add(errors, hasAll(schema.required, required), `${schemaName} must require ${required.join(', ')}`);
}

function validateCanonicalResponse(document, status, responseName, errorEnvelopeRef, errors) {
  const response = document.components?.responses?.[responseName];
  add(errors, isRecord(response), `missing canonical HTTP ${status} response ${responseName}`);
  if (!isRecord(response)) return;
  const schemaRef = response.content?.['application/json']?.schema?.$ref;
  add(errors, schemaRef === errorEnvelopeRef, `${responseName} must use ${errorEnvelopeRef}`);
  add(errors, hasAll(Object.keys(response.headers ?? {}), ['X-Request-Id', 'X-Trace-Id', 'X-API-Version']), `${responseName} must expose correlation and API version headers`);
  if (status === '429' || status === '503') add(errors, response.headers?.['Retry-After'] !== undefined, `${responseName} must expose Retry-After`);
}

function resolveResponseObject(document, response, label, errors) {
  if (!isRecord(response)) {
    errors.push(`${label} must be a response object`);
    return null;
  }
  return nonEmpty(response.$ref) ? dereference(document, response, label, errors) : response;
}

function usesCanonicalSuccessEnvelope(document, schema, seen = new Set()) {
  if (!isRecord(schema)) return false;
  if (nonEmpty(schema.$ref)) {
    if (CANONICAL_SUCCESS_ENVELOPES.has(schema.$ref)) return true;
    if (!schema.$ref.startsWith('#/') || seen.has(schema.$ref)) return false;
    try {
      const nextSeen = new Set(seen);
      nextSeen.add(schema.$ref);
      return usesCanonicalSuccessEnvelope(document, resolveJsonPointer(document, schema.$ref), nextSeen);
    } catch {
      return false;
    }
  }
  for (const key of ['oneOf', 'anyOf']) {
    if (Array.isArray(schema[key]) && schema[key].length > 0) {
      return schema[key].every((candidate) => usesCanonicalSuccessEnvelope(document, candidate, seen));
    }
  }
  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    return schema.allOf.some((candidate) => usesCanonicalSuccessEnvelope(document, candidate, seen));
  }
  return false;
}

function usesEnvelopeReference(document, schema, expectedRef, seen = new Set()) {
  if (!isRecord(schema)) return false;
  if (nonEmpty(schema.$ref)) {
    if (schema.$ref === expectedRef) return true;
    if (!schema.$ref.startsWith('#/') || seen.has(schema.$ref)) return false;
    try {
      const nextSeen = new Set(seen);
      nextSeen.add(schema.$ref);
      return usesEnvelopeReference(document, resolveJsonPointer(document, schema.$ref), expectedRef, nextSeen);
    } catch {
      return false;
    }
  }
  for (const key of ['oneOf', 'anyOf']) {
    if (Array.isArray(schema[key]) && schema[key].length > 0) {
      return schema[key].every((candidate) => usesEnvelopeReference(document, candidate, expectedRef, seen));
    }
  }
  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    return schema.allOf.some((candidate) => usesEnvelopeReference(document, candidate, expectedRef, seen));
  }
  return false;
}

function resolveParameter(document, parameter) {
  if (!isRecord(parameter)) return null;
  if (!nonEmpty(parameter.$ref)) return parameter;
  try {
    return resolveJsonPointer(document, parameter.$ref);
  } catch {
    return null;
  }
}

function normalizedParameterName(document, parameter) {
  const resolved = resolveParameter(document, parameter);
  if (resolved?.in !== 'query' || !nonEmpty(resolved.name)) return '';
  return resolved.name.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

function isLegacyPaginationParameter(document, parameter) {
  const name = normalizedParameterName(document, parameter);
  return CURSOR_STATE_FIELDS.has(name) && parameter?.$ref !== CURSOR_PARAMETER_REF && parameter?.$ref !== PAGE_SIZE_PARAMETER_REF;
}

function dataSchemas(schema, found = []) {
  if (!isRecord(schema)) return found;
  if (isRecord(schema.properties?.data)) found.push(schema.properties.data);
  for (const keyword of ['allOf', 'oneOf', 'anyOf']) {
    for (const candidate of schema[keyword] ?? []) dataSchemas(candidate, found);
  }
  return found;
}

function dataDeclaresCursorState(document, schema) {
  for (const dataSchema of dataSchemas(schema)) {
    let resolved = dataSchema;
    if (nonEmpty(dataSchema.$ref)) {
      try {
        resolved = resolveJsonPointer(document, dataSchema.$ref);
      } catch {
        continue;
      }
    }
    for (const propertyName of Object.keys(resolved?.properties ?? {})) {
      if (CURSOR_STATE_FIELDS.has(propertyName.replace(/[^A-Za-z0-9]/g, '').toLowerCase())) return true;
    }
  }
  return false;
}

export function validateApiContractData({ openApi, schemaRegistry }) {
  const errors = [];
  add(errors, isRecord(openApi), 'OpenAPI document must be an object');
  add(errors, isRecord(schemaRegistry), 'schema registry must be an object');
  if (!isRecord(openApi) || !isRecord(schemaRegistry)) return { errors, summary: {} };

  const governance = openApi['x-p1r-api-governance'];
  add(errors, isRecord(governance), 'missing x-p1r-api-governance');
  if (!isRecord(governance)) return { errors, summary: {} };
  add(errors, governance.schemaVersion === '1.0.0', 'x-p1r-api-governance.schemaVersion must be 1.0.0');
  add(errors, governance.versionPrefix === EXTERNAL_PREFIX, `external versionPrefix must be ${EXTERNAL_PREFIX}`);
  add(errors, governance.internalVersionPrefix === INTERNAL_PREFIX, `internalVersionPrefix must be ${INTERNAL_PREFIX}`);
  add(errors, governance.externalBoundary === 'api-gateway', 'externalBoundary must be api-gateway');
  add(errors, hasAll(governance.requiredTraceHeaders?.request, ['X-Request-Id', 'traceparent']), 'request trace headers must include X-Request-Id and traceparent');
  add(errors, hasAll(governance.requiredTraceHeaders?.response, ['X-Request-Id', 'X-Trace-Id']), 'response trace headers must include X-Request-Id and X-Trace-Id');
  add(errors, governance.pagination?.style === 'cursor', 'pagination.style must be cursor');
  add(errors, hasAll(governance.pagination?.requestParameters, [CURSOR_PARAMETER_REF, PAGE_SIZE_PARAMETER_REF]), 'pagination must reference canonical Cursor and PageSize');
  add(errors, governance.pagination?.responseMeta === CURSOR_PAGE_META_REF, `pagination.responseMeta must be ${CURSOR_PAGE_META_REF}`);

  for (const [field, expectedRef] of Object.entries({
    successEnvelope: '#/components/schemas/ApiSuccessEnvelope',
    cursorPageEnvelope: '#/components/schemas/ApiCursorPageEnvelope',
    errorEnvelope: '#/components/schemas/ApiErrorEnvelope',
  })) {
    add(errors, governance[field] === expectedRef, `x-p1r-api-governance.${field} must be ${expectedRef}`);
    dereference(openApi, { $ref: governance[field] }, `x-p1r-api-governance.${field}`, errors);
  }

  validateEnvelopeSchema(openApi, 'ApiResponseMeta', REQUIRED_META_FIELDS, errors);
  validateEnvelopeSchema(openApi, 'ApiCursorPageMeta', [...REQUIRED_META_FIELDS, 'hasMore', 'pageSize'], errors);
  validateEnvelopeSchema(openApi, 'ApiSuccessEnvelope', ['data', 'meta'], errors);
  validateEnvelopeSchema(openApi, 'ApiCursorPageEnvelope', ['data', 'meta'], errors);
  validateEnvelopeSchema(openApi, 'ApiErrorEnvelope', ['error', 'meta'], errors);
  validateEnvelopeSchema(openApi, 'ApiError', ['errorCode', 'message', 'retryable'], errors);

  const errorCodes = openApi.components?.schemas?.ErrorCode?.enum;
  add(errors, hasAll(errorCodes, REQUIRED_ERROR_CODES), `ErrorCode must retain ${REQUIRED_ERROR_CODES.join(', ')}`);
  const errorEnvelopeRef = '#/components/schemas/ApiErrorEnvelope';
  for (const [status, responseName] of Object.entries(REQUIRED_ERROR_RESPONSES)) {
    validateCanonicalResponse(openApi, status, responseName, errorEnvelopeRef, errors);
  }

  const statusMap = governance.errorStatusToCodeFamily;
  add(errors, isRecord(statusMap), 'errorStatusToCodeFamily is required');
  if (isRecord(statusMap)) {
    for (const [status, responseName] of Object.entries(REQUIRED_ERROR_RESPONSES)) {
      if (Number(status) >= 500) {
        const responses = statusMap['5xx']?.responses ?? [];
        add(errors, responses.includes(`#/components/responses/${responseName}`), `5xx governance must reference ${responseName}`);
      } else {
        add(errors, statusMap[status]?.response === `#/components/responses/${responseName}`, `${status} governance must reference ${responseName}`);
        add(errors, Array.isArray(statusMap[status]?.errorCodes) && statusMap[status].errorCodes.length > 0, `${status} governance needs errorCodes`);
      }
    }
  }

  const idempotencyParameter = openApi.components?.parameters?.IdempotencyKeyRequired;
  add(errors, idempotencyParameter?.name === 'Idempotency-Key' && idempotencyParameter?.in === 'header' && idempotencyParameter?.required === true, 'IdempotencyKeyRequired must be a required header parameter');
  add(errors, openApi.components?.parameters?.Cursor?.in === 'query', 'Cursor must be a query parameter');
  add(errors, openApi.components?.parameters?.PageSize?.in === 'query', 'PageSize must be a query parameter');
  add(errors, hasAll(governance.deprecationHeaders?.headers, ['Deprecation', 'Sunset', 'Link']), 'deprecationHeaders must include Deprecation, Sunset and Link');
  for (const headerName of ['Deprecation', 'Sunset', 'DeprecationLink']) add(errors, isRecord(openApi.components?.headers?.[headerName]), `missing deprecation header ${headerName}`);

  const operationIds = new Set();
  let operationCount = 0;
  let externalWriteCount = 0;
  let idempotencyExceptionCount = 0;
  let deprecatedCount = 0;
  let listOperationCount = 0;
  let cursorPaginatedOperationCount = 0;
  for (const [route, pathItem] of Object.entries(openApi.paths ?? {})) {
    add(errors, route.startsWith(`${EXTERNAL_PREFIX}/`) || route.startsWith(`${INTERNAL_PREFIX}/`), `path is outside versioned boundaries: ${route}`);
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (!isHttpMethod(method)) continue;
      operationCount += 1;
      const label = `${method.toUpperCase()} ${route}`;
      add(errors, nonEmpty(operation.operationId), `${label} needs operationId`);
      add(errors, !operationIds.has(operation.operationId), `${label} duplicates operationId ${operation.operationId}`);
      if (nonEmpty(operation.operationId)) operationIds.add(operation.operationId);

      const parameters = operationParameters(pathItem, operation);
      const listOperation = route.startsWith(`${EXTERNAL_PREFIX}/`) && String(operation.operationId ?? '').startsWith('list');
      const canonicalCursorCount = parameters.filter((parameter) => parameter?.$ref === CURSOR_PARAMETER_REF).length;
      const canonicalPageSizeCount = parameters.filter((parameter) => parameter?.$ref === PAGE_SIZE_PARAMETER_REF).length;
      const cursorPaginated = route.startsWith(`${EXTERNAL_PREFIX}/`)
        && (listOperation || canonicalCursorCount > 0 || isRecord(operation['x-pagination']));
      if (listOperation) listOperationCount += 1;
      if (cursorPaginated) {
        cursorPaginatedOperationCount += 1;
        const pagination = operation['x-pagination'];
        add(errors, isRecord(pagination), `${label} must declare x-pagination`);
        if (isRecord(pagination)) {
          add(errors, pagination.mode === 'cursor', `${label} x-pagination.mode must be cursor`);
          add(errors, pagination.cursorParameter === CURSOR_PARAMETER_REF, `${label} x-pagination.cursorParameter must be ${CURSOR_PARAMETER_REF}`);
          add(errors, pagination.pageSizeParameter === PAGE_SIZE_PARAMETER_REF, `${label} x-pagination.pageSizeParameter must be ${PAGE_SIZE_PARAMETER_REF}`);
          add(errors, pagination.responseMeta === CURSOR_PAGE_META_REF, `${label} x-pagination.responseMeta must be ${CURSOR_PAGE_META_REF}`);
        }
        add(errors, canonicalCursorCount === 1, `${label} must reference canonical Cursor exactly once`);
        add(errors, canonicalPageSizeCount === 1, `${label} must reference canonical PageSize exactly once`);
        add(errors, !parameters.some((parameter) => isLegacyPaginationParameter(openApi, parameter)), `${label} retains a legacy cursor/page/limit parameter`);
      }

      const externalWrite = route.startsWith(`${EXTERNAL_PREFIX}/`) && WRITE_METHODS.has(method);
      if (externalWrite) {
        externalWriteCount += 1;
        const rule = operation['x-idempotency'];
        add(errors, isRecord(rule), `${label} needs x-idempotency`);
        if (isRecord(rule)) {
          add(errors, typeof rule.required === 'boolean', `${label} x-idempotency.required must be boolean`);
          add(errors, nonEmpty(rule.strategy), `${label} x-idempotency.strategy is required`);
          add(errors, rule.keyHeader === undefined || rule.keyHeader === 'Idempotency-Key', `${label} x-idempotency.keyHeader must be Idempotency-Key when declared`);
          add(errors, nonEmpty(rule.replayBehavior), `${label} x-idempotency.replayBehavior is required`);
          if (rule.required === true) {
            add(errors, operationParameters(pathItem, operation).some((parameter) => isIdempotencyHeader(openApi, parameter)), `${label} must reference a required Idempotency-Key header`);
          } else if (rule.required === false) {
            idempotencyExceptionCount += 1;
            add(
              errors,
              route === SIGNED_ACCESS_IDEMPOTENCY_EXCEPTION.route
                && method === SIGNED_ACCESS_IDEMPOTENCY_EXCEPTION.method
                && operation.operationId === SIGNED_ACCESS_IDEMPOTENCY_EXCEPTION.operationId,
              `${label} is not the sole allowed signed-access idempotency exception`,
            );
            const exception = operation['x-p1r-idempotency-exception'];
            add(errors, isRecord(exception), `${label} optional idempotency needs x-p1r-idempotency-exception`);
            if (isRecord(exception)) {
              add(errors, exception.rule === 'writeIdempotency', `${label} idempotency exception rule must be writeIdempotency`);
              for (const field of ['reason', 'owner', 'safeBehavior']) add(errors, nonEmpty(exception[field]), `${label} idempotency exception.${field} is required`);
            }
          }
        }
      }

      if (route.startsWith(`${EXTERNAL_PREFIX}/`)) {
        const responses = isRecord(operation.responses) ? operation.responses : {};
        for (const [status, responseName] of Object.entries(REQUIRED_ERROR_RESPONSES)) {
          if (!(status in responses)) continue;
          add(
            errors,
            responses[status]?.$ref === `#/components/responses/${responseName}`,
            `${label} responses.${status} must reference #/components/responses/${responseName}`,
          );
        }
        for (const [status, response] of Object.entries(responses)) {
          if (!/^2\d\d$/.test(status)) continue;
          const resolvedResponse = resolveResponseObject(openApi, response, `${label} responses.${status}`, errors);
          const responseSchema = resolvedResponse?.content?.['application/json']?.schema;
          if (responseSchema === undefined) continue;
          add(
            errors,
            hasAll(Object.keys(resolvedResponse?.headers ?? {}), ['X-Request-Id', 'X-Trace-Id', 'X-API-Version']),
            `${label} responses.${status} must expose correlation and API version headers`,
          );
          add(
            errors,
            usesCanonicalSuccessEnvelope(openApi, responseSchema),
            `${label} responses.${status} must use ApiSuccessEnvelope or ApiCursorPageEnvelope`,
          );
          if (cursorPaginated) {
            add(
              errors,
              usesEnvelopeReference(openApi, responseSchema, CURSOR_PAGE_ENVELOPE_REF),
              `${label} responses.${status} must use ApiCursorPageEnvelope`,
            );
            add(
              errors,
              !dataDeclaresCursorState(openApi, responseSchema),
              `${label} responses.${status} must keep cursor/page state only in ApiCursorPageMeta`,
            );
          }
        }
      }

      if (route.startsWith(`${EXTERNAL_PREFIX}/`) && operation.deprecated === true) {
        deprecatedCount += 1;
        const declaration = operation['x-p1r-deprecation'];
        add(errors, isRecord(declaration), `${label} deprecated operation needs x-p1r-deprecation`);
        if (isRecord(declaration)) {
          for (const field of ['deprecationAt', 'sunsetAt', 'migrationLink']) add(errors, nonEmpty(declaration[field]), `${label} x-p1r-deprecation.${field} is required`);
        }
      }
    }
  }

  add(
    errors,
    idempotencyExceptionCount === 1,
    `exactly one signed-access idempotency exception is required; found ${idempotencyExceptionCount}`,
  );

  const envelopeSchema = schemaRegistry.schemas?.['platform.api.envelope.v1'];
  add(errors, isRecord(envelopeSchema), 'schema registry must contain platform.api.envelope.v1');
  if (isRecord(envelopeSchema)) {
    add(errors, envelopeSchema.$schema === 'https://json-schema.org/draft/2020-12/schema', 'platform.api.envelope.v1 must use JSON Schema 2020-12');
    for (const name of ['meta', 'cursorPageMeta', 'error', 'successEnvelope', 'cursorPageEnvelope', 'errorEnvelope']) {
      add(errors, isRecord(envelopeSchema.$defs?.[name]), `platform.api.envelope.v1 is missing $defs.${name}`);
    }
  }

  return {
    errors,
    summary: {
      operationCount,
      externalWriteCount,
      idempotencyExceptionCount,
      deprecatedCount,
      listOperationCount,
      cursorPaginatedOperationCount,
    },
  };
}

export function validateApiContract({ root = process.cwd() } = {}) {
  const openApiPath = path.join(root, 'packages', 'contracts', 'openapi', 'v1', 'openapi.json');
  const schemaRegistryPath = path.join(root, 'packages', 'contracts', 'schemas', 'v1', 'registry.json');
  try {
    const openApi = JSON.parse(fs.readFileSync(openApiPath, 'utf8'));
    const schemaRegistry = JSON.parse(fs.readFileSync(schemaRegistryPath, 'utf8'));
    const { errors, summary } = validateApiContractData({ openApi, schemaRegistry });
    return { result: errors.length === 0 ? 'PASS' : 'FAIL', ...summary, errors };
  } catch (error) {
    return { result: 'FAIL', errors: [error instanceof Error ? error.message : String(error)] };
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const report = validateApiContract();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.result === 'PASS' ? 0 : 1);
}
