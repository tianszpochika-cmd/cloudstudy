import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isRecord, resolveJsonPointer } from '../contracts/schema-utils.mjs';

const DEFAULT_INPUT = path.join('packages', 'contracts', 'fragments', 'b8', 'b8-auth-iam.openapi.json');
const TRANSPORTS = ['WEB_COOKIE', 'NATIVE_SECURE_STORAGE'];
const CANONICAL_REPLAY_ERROR = 'AUTH_REFRESH_REUSE_DETECTED';
const AUTH_PATHS = Object.freeze({
  '/api/v1/auth/register': ['post', 'registerB8Account'],
  '/api/v1/auth/login': ['post', 'loginB8Account'],
  '/api/v1/auth/token/refresh': ['post', 'refreshB8JwtSession'],
  '/api/v1/auth/logout': ['post', 'logoutB8JwtSession'],
  '/api/v1/auth/sessions/{sessionId}/revoke': ['post', 'revokeB8JwtSession'],
  '/api/v1/auth/jwks': ['get', 'getB8JwtJwks'],
  '/api/v1/auth/password-reset/request': ['post', 'requestB8PasswordReset'],
  '/api/v1/auth/password-reset/confirm': ['post', 'confirmB8PasswordReset'],
  '/api/v1/iam/principal/me': ['get', 'getB8Principal'],
  '/api/v1/iam/permissions': ['get', 'getB8Permissions'],
  '/api/v1/iam/devices': ['get', 'listB8Devices'],
  '/api/v1/iam/devices/{deviceId}/kickout': ['post', 'kickoutB8Device'],
  '/api/v1/iam/adult-gate': ['post', 'evaluateB8AdultGate'],
  '/api/v1/iam/consents': ['get', 'listB8Consents'],
  '/internal/v1/iam/authorization/decisions': ['post', 'decideB8Authorization'],
});
const TOKEN_OPERATIONS = Object.freeze({
  registerB8Account: {
    route: '/api/v1/auth/register',
    request: 'B8RegisterRequest',
    successStatus: '201',
    variants: {
      WEB_COOKIE: ['B8WebRegisterRequest', 'B8WebAuthTokenResponse'],
      NATIVE_SECURE_STORAGE: ['B8NativeRegisterRequest', 'B8NativeAuthTokenResponse'],
    },
  },
  loginB8Account: {
    route: '/api/v1/auth/login',
    request: 'B8LoginRequest',
    successStatus: '200',
    variants: {
      WEB_COOKIE: ['B8WebLoginRequest', 'B8WebAuthTokenResponse'],
      NATIVE_SECURE_STORAGE: ['B8NativeLoginRequest', 'B8NativeAuthTokenResponse'],
    },
  },
  refreshB8JwtSession: {
    route: '/api/v1/auth/token/refresh',
    request: 'B8RefreshRequest',
    successStatus: '200',
    variants: {
      WEB_COOKIE: ['B8WebRefreshRequest', 'B8WebAuthTokenResponse'],
      NATIVE_SECURE_STORAGE: ['B8NativeRefreshRequest', 'B8NativeAuthTokenResponse'],
    },
  },
});
const REQUIRED_SERVER_VALIDATION = [
  'issuer',
  'signature',
  'algorithm',
  'audience',
  'time-window',
  'token-type',
  'scope-permission',
];
const REQUIRED_CORRELATION_HEADERS = ['X-Request-Id', 'X-Trace-Id', 'X-API-Version'];
const REQUIRED_AUDIT_CORRELATION = ['response.headers.X-Request-Id', 'response.headers.X-Trace-Id'];
const STANDARD_ERROR_RESPONSES = Object.freeze({
  registerB8Account: { 400: 'ApiBadRequest', 409: 'ApiConflict', 429: 'ApiRateLimited' },
  loginB8Account: { 401: 'ApiUnauthorized', 423: 'B8AccountLocked', 429: 'ApiRateLimited' },
  refreshB8JwtSession: { 401: 'ApiUnauthorized' },
  logoutB8JwtSession: { 401: 'ApiUnauthorized' },
  revokeB8JwtSession: { 401: 'ApiUnauthorized', 403: 'ApiForbidden' },
  requestB8PasswordReset: { 429: 'ApiRateLimited' },
  confirmB8PasswordReset: { 400: 'ApiBadRequest', 401: 'ApiUnauthorized' },
  getB8Principal: { 401: 'ApiUnauthorized' },
  getB8Permissions: { 401: 'ApiUnauthorized' },
  listB8Devices: { 401: 'ApiUnauthorized' },
  kickoutB8Device: { 401: 'ApiUnauthorized', 403: 'ApiForbidden' },
  evaluateB8AdultGate: { 403: 'ApiForbidden' },
  listB8Consents: { 401: 'ApiUnauthorized' },
  updateB8Consent: { 401: 'ApiUnauthorized', 409: 'ApiConflict' },
});
const CANONICAL_ERROR_BY_STATUS = Object.freeze({
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

function add(errors, condition, message) {
  if (!condition) errors.push(message);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function exactArray(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && expected.every((value) => actual.includes(value));
}

function hasAll(actual, expected) {
  return Array.isArray(actual) && expected.every((value) => actual.includes(value));
}

function local(document, reference) {
  if (!nonEmpty(reference)) return undefined;
  try {
    return resolveJsonPointer(document, reference);
  } catch {
    return undefined;
  }
}

function schema(document, name) {
  return document.components?.schemas?.[name];
}

function responseRef(name) {
  return `#/components/responses/${name}`;
}

function schemaRef(name) {
  return `#/components/schemas/${name}`;
}

function parameterRefs(pathItem, operation) {
  return [...(Array.isArray(pathItem?.parameters) ? pathItem.parameters : []), ...(Array.isArray(operation?.parameters) ? operation.parameters : [])]
    .map((parameter) => parameter?.$ref)
    .filter(Boolean);
}

function checkTransportParameter(document, errors) {
  const parameter = document.components?.parameters?.B8AuthTransport;
  add(errors, isRecord(parameter), 'B8AuthTransport parameter is required');
  if (!isRecord(parameter)) return;
  add(errors, parameter.name === 'X-Auth-Transport', 'B8AuthTransport.name must be X-Auth-Transport');
  add(errors, parameter.in === 'header', 'B8AuthTransport must be a header');
  add(errors, parameter.required === false, 'B8AuthTransport must be optional for WEB_COOKIE compatibility');
  add(errors, parameter.schema?.type === 'string', 'B8AuthTransport schema must be a string');
  add(errors, exactArray(parameter.schema?.enum, TRANSPORTS), 'B8AuthTransport enum must be exactly WEB_COOKIE and NATIVE_SECURE_STORAGE');
  add(errors, parameter.schema?.default === 'WEB_COOKIE', 'B8AuthTransport default must be WEB_COOKIE');
}

function checkRootAuthentication(document, errors) {
  const authentication = document['x-b8-authentication'];
  add(errors, isRecord(authentication), 'missing x-b8-authentication');
  if (!isRecord(authentication)) return;
  add(errors, authentication.mode === 'self-owned-jwt-authentication-center', 'x-b8-authentication.mode must be self-owned-jwt-authentication-center');
  add(errors, authentication.signer === 'iam-service', 'iam-service must be the token signer');
  add(errors, authentication.credentialFlow === 'account-password', 'credentialFlow must be account-password');
  add(errors, authentication.issuerBoundary?.tokenIssuer === 'iam-service-only', 'only iam-service may mint tokens');
  add(errors, authentication.issuerBoundary?.passwordReceiver === 'iam-service-only', 'only iam-service may receive passwords');
  add(errors, hasAll(authentication.issuerBoundary?.prohibitedTokenIssuers, ['api-gateway', 'domain-service', 'client-application']), 'non-IAM token issuers must be prohibited');
  add(errors, exactArray(authentication.serverValidation, REQUIRED_SERVER_VALIDATION), 'JWT server validation profile is incomplete or has drifted');
  add(errors, authentication.productionKeyBoundary === 'KMS-or-secret-manager-only; never Git-image-log', 'production signing keys must stay in KMS or secret manager');
  const compatibility = document['x-b8-compatibility'];
  add(errors, isRecord(compatibility), 'x-b8-compatibility is required');
  if (isRecord(compatibility)) {
    add(errors, Array.isArray(compatibility.legacyRoutes) && compatibility.legacyRoutes.length === 0, 'legacy authentication routes must remain empty');
    add(errors, hasAll(compatibility.removedFlows, ['external-provider-login', 'external-browser-handoff', 'browser-supplied-role-override']), 'removed external authentication flows must stay prohibited');
    add(errors, nonEmpty(compatibility.rule) && /only iam-service.*mint tokens.*fail closed/i.test(compatibility.rule), 'compatibility routes must not mint tokens and must fail closed');
  }
  const canonicalErrorCode = document.components?.schemas?.ErrorCode;
  if (isRecord(canonicalErrorCode)) add(errors, canonicalErrorCode.enum?.includes(CANONICAL_REPLAY_ERROR), `canonical ErrorCode must include ${CANONICAL_REPLAY_ERROR}`);

  const accessToken = authentication.accessToken;
  add(errors, isRecord(accessToken), 'accessToken profile is required');
  if (isRecord(accessToken)) {
    add(errors, accessToken.format === 'JWT', 'accessToken.format must be JWT');
    add(errors, accessToken.tokenType === 'Bearer', 'accessToken.tokenType must be Bearer');
    add(errors, accessToken.algorithm === 'RS256', 'accessToken.algorithm must be RS256');
    add(errors, accessToken.audience === 'yuxuexing-api', 'accessToken.audience must be yuxuexing-api');
    add(errors, nonEmpty(accessToken.jwksUri), 'accessToken.jwksUri is required');
    add(errors, Number.isInteger(accessToken.maxLifetimeSeconds) && accessToken.maxLifetimeSeconds >= 300 && accessToken.maxLifetimeSeconds <= 900, 'accessToken.maxLifetimeSeconds must be between 300 and 900 seconds');
    add(errors, hasAll(accessToken.requiredClaims, ['iss', 'sub', 'aud', 'exp', 'iat', 'nbf', 'jti', 'token_type', 'scope']), 'accessToken required claims are incomplete');
    const rotation = accessToken.keyRotation;
    add(errors, isRecord(rotation), 'accessToken.keyRotation is required');
    if (isRecord(rotation)) {
      add(errors, rotation.algorithm === 'RS256-only', 'accessToken.keyRotation.algorithm must be RS256-only');
      add(errors, nonEmpty(rotation.kid) && /required.*stable/i.test(rotation.kid), 'accessToken.keyRotation.kid must require a stable kid');
      add(errors, rotation.publishNewKidBeforeUse === true, 'accessToken.keyRotation must publish a new kid before use');
      add(errors, nonEmpty(rotation.previousPublicKeyRetention) && /max-access-token-lifetime.*clock-skew/i.test(rotation.previousPublicKeyRetention), 'accessToken previous public-key retention must cover token lifetime and clock skew');
      add(errors, rotation.unknownKid === 'fail-closed', 'unknown kid must fail closed');
    }
  }

  const refresh = authentication.refreshToken;
  add(errors, isRecord(refresh), 'refreshToken profile is required');
  if (isRecord(refresh)) {
    add(errors, refresh.format === 'opaque', 'refreshToken.format must be opaque');
    add(errors, refresh.rotation === 'every-use', 'refreshToken.rotation must be every-use');
    add(errors, refresh.reuseDetection === 'revoke-token-family', 'refreshToken.reuseDetection must revoke the token family');
    add(errors, refresh.storage?.web === 'HttpOnly-Secure-SameSite-cookie', 'Web refresh storage must be HttpOnly-Secure-SameSite-cookie');
    add(errors, refresh.storage?.mobile === 'Keychain-or-Keystore-only', 'Native refresh storage must be Keychain-or-Keystore-only');
    add(errors, refresh.webH5?.ordinaryStorage === 'prohibited', 'Web/H5 ordinary refresh-token storage must be prohibited');
    add(errors, nonEmpty(refresh.webH5?.request) && /only.*cookie/i.test(refresh.webH5.request), 'Web/H5 refresh requests must use the cookie only');
    add(errors, nonEmpty(refresh.webH5?.response) && /absent.*json|never.*json/i.test(refresh.webH5.response), 'Web/H5 refresh responses must omit refreshToken from JSON');
    add(errors, nonEmpty(refresh.native?.storage) && /Keychain.*Keystore/i.test(refresh.native.storage) && /localStorage|sessionStorage|ordinary storage|plaintext fallback/i.test(refresh.native.storage), 'Native refresh storage must require Keychain/Keystore and reject ordinary fallbacks');
    const selector = refresh.transportSelector;
    add(errors, isRecord(selector), 'refreshToken.transportSelector is required');
    if (isRecord(selector)) {
      add(errors, selector.header === 'X-Auth-Transport', 'transport selector header must be X-Auth-Transport');
      add(errors, selector.default === 'WEB_COOKIE', 'transport selector default must be WEB_COOKIE');
      add(errors, selector.nativeValue === 'NATIVE_SECURE_STORAGE', 'transport selector native value is invalid');
      add(errors, selector.nativeMustBeExplicit === true, 'native transport must be explicit');
      add(errors, nonEmpty(selector.serverCrossCheck) && /fail.?closed/i.test(selector.serverCrossCheck) && /device/i.test(selector.serverCrossCheck), 'server must fail closed on transport/device cross-check mismatch');
    }
    const replay = refresh.replay;
    add(errors, isRecord(replay), 'refreshToken.replay is required');
    if (isRecord(replay)) {
      add(errors, replay.sameIdempotencyKey === 'return-the-original-rotation-result', 'same refresh idempotency key must return the original rotation result');
      add(errors, replay.differentIdempotencyKeyOrReuse === 'revoke-token-family-and-associated-session', 'refresh reuse must revoke token family and associated session');
      add(errors, replay.httpStatus === 401, 'refresh reuse must return HTTP 401');
      add(errors, replay.errorCode === CANONICAL_REPLAY_ERROR, `refresh reuse errorCode must be ${CANONICAL_REPLAY_ERROR}`);
      add(errors, replay.auditEvent === 'auth.session.replay_detected.v1', 'refresh replay audit event is required');
    }
  }
}

function checkLifecyclePaths(document, errors) {
  const ids = new Set();
  const paths = isRecord(document.paths) ? document.paths : {};
  for (const [route, [method, operationId]] of Object.entries(AUTH_PATHS)) {
    const operation = paths[route]?.[method];
    const label = `${method.toUpperCase()} ${route}`;
    add(errors, isRecord(operation), `${label} is required`);
    if (!isRecord(operation)) continue;
    add(errors, operation.operationId === operationId, `${label} operationId must be ${operationId}`);
    add(errors, !ids.has(operation.operationId), `${label} operationId is duplicated`);
    if (nonEmpty(operation.operationId)) ids.add(operation.operationId);
    add(errors, operation['x-contract']?.owner === 'iam-service', `${label} must be owned by iam-service`);
    add(errors, operation['x-contract']?.domain === 'iam', `${label} must declare iam domain`);
    add(errors, operation['x-contract']?.phase === 'P1', `${label} must declare phase P1`);
    add(errors, operation['x-contract']?.authentication === 'self-owned-jwt', `${label} must declare self-owned-jwt authentication`);
    if (method !== 'get' && route.startsWith('/api/v1/')) {
      add(errors, operation['x-idempotency']?.required === true, `${label} must require Idempotency-Key`);
      add(errors, nonEmpty(operation['x-idempotency']?.strategy) && nonEmpty(operation['x-idempotency']?.replayBehavior), `${label} idempotency strategy and replayBehavior are required`);
      add(errors, operation['x-idempotency']?.keyHeader === 'Idempotency-Key', `${label} idempotency key header must be Idempotency-Key`);
      add(errors, parameterRefs(paths[route], operation).filter((ref) => ref === '#/components/parameters/B8IdempotencyKey').length === 1, `${label} must reference B8IdempotencyKey exactly once`);
    }
  }
}

function checkSchemaOneOf(document, errors, name, expectedVariants, mapping) {
  const candidate = schema(document, name);
  add(errors, isRecord(candidate), `${name} schema is required`);
  if (!isRecord(candidate)) return;
  add(errors, candidate.type === 'object', `${name} must be an object`);
  add(errors, exactArray(Array.isArray(candidate.oneOf) ? candidate.oneOf.map((variant) => variant?.$ref) : undefined, expectedVariants.map(schemaRef)), `${name}.oneOf must contain the exact Web/Native variants`);
  add(errors, candidate.anyOf === undefined, `${name} must not replace oneOf with anyOf`);
  const discriminator = candidate['x-transport-discriminator'];
  add(errors, isRecord(discriminator), `${name} transport discriminator is required`);
  if (isRecord(discriminator)) {
    add(errors, discriminator.header === 'X-Auth-Transport', `${name} discriminator header must be X-Auth-Transport`);
    add(errors, discriminator.default === 'WEB_COOKIE', `${name} discriminator default must be WEB_COOKIE`);
    add(errors, JSON.stringify(discriminator.mapping) === JSON.stringify(mapping), `${name} transport mapping is invalid`);
  }
}

function checkTransportAwareOperation(document, errors, operation, pathItem, label, expectedVariants) {
  const refs = parameterRefs(pathItem, operation);
  add(errors, refs.filter((ref) => ref === '#/components/parameters/B8AuthTransport').length === 1, `${label} must reference X-Auth-Transport exactly once`);
  const transport = operation['x-auth-transport'];
  add(errors, isRecord(transport), `${label} x-auth-transport is required`);
  if (!isRecord(transport)) return;
  const selector = transport.selector;
  add(errors, selector?.parameter === '#/components/parameters/B8AuthTransport', `${label} transport selector must reference B8AuthTransport`);
  add(errors, selector?.default === 'WEB_COOKIE', `${label} transport default must be WEB_COOKIE`);
  add(errors, selector?.nativeMustBeExplicit === true, `${label} native transport must be explicit`);
  const variants = transport.variants;
  add(errors, isRecord(variants) && exactArray(Object.keys(variants), TRANSPORTS), `${label} transport variants must be exactly Web and Native`);
  if (isRecord(variants)) {
    for (const transportName of TRANSPORTS) {
      const variant = variants[transportName];
      add(errors, isRecord(variant), `${label} missing ${transportName} variant`);
      if (!isRecord(variant)) continue;
      const expected = expectedVariants[transportName];
      add(errors, variant.requestSchema === schemaRef(expected[0]), `${label} ${transportName} request mapping is invalid`);
      add(errors, variant.responseDataSchema === schemaRef(expected[1]), `${label} ${transportName} response mapping is invalid`);
      const isRefresh = label.includes('/token/refresh');
      if (transportName === 'WEB_COOKIE') {
        add(errors, variant.responseHeader === '#/components/headers/B8RefreshCookie', `${label} Web variant must use B8RefreshCookie`);
        add(errors, nonEmpty(isRefresh ? variant.refreshCredentialOutput : variant.refreshCredential) && /Set-Cookie.*only.*(?:never JSON|must not contain refreshToken)/i.test(isRefresh ? variant.refreshCredentialOutput : variant.refreshCredential), `${label} Web variant must keep refreshToken out of JSON`);
      } else {
        add(errors, variant.responseHeader === 'absent', `${label} Native variant must not emit Set-Cookie`);
        add(errors, nonEmpty(isRefresh ? variant.refreshCredentialOutput : variant.refreshCredential) && /required JSON.*refreshToken.*Keychain.*Keystore/i.test(isRefresh ? variant.refreshCredentialOutput : variant.refreshCredential), `${label} Native variant must require Keychain/Keystore refreshToken`);
      }
      if (isRefresh) {
        if (transportName === 'WEB_COOKIE') add(errors, /cookie only.*must not contain refreshToken/i.test(variant.refreshCredentialInput ?? ''), `${label} Web refresh input must be cookie-only`);
        else add(errors, /required JSON refreshToken/i.test(variant.refreshCredentialInput ?? ''), `${label} Native refresh input must require refreshToken`);
        if (transportName === 'WEB_COOKIE') add(errors, /Set-Cookie only.*must not contain refreshToken/i.test(variant.refreshCredentialOutput ?? ''), `${label} Web refresh output must be cookie-only`);
        else add(errors, /required JSON data\.refreshToken.*Keychain.*Keystore/i.test(variant.refreshCredentialOutput ?? ''), `${label} Native refresh output must require Keychain/Keystore refreshToken`);
      }
    }
  }
}

function checkTokenSchemas(document, errors) {
  checkSchemaOneOf(document, errors, 'B8RegisterRequest', ['B8WebRegisterRequest', 'B8NativeRegisterRequest'], {
    WEB_COOKIE: schemaRef('B8WebRegisterRequest'),
    NATIVE_SECURE_STORAGE: schemaRef('B8NativeRegisterRequest'),
  });
  checkSchemaOneOf(document, errors, 'B8LoginRequest', ['B8WebLoginRequest', 'B8NativeLoginRequest'], {
    WEB_COOKIE: schemaRef('B8WebLoginRequest'),
    NATIVE_SECURE_STORAGE: schemaRef('B8NativeLoginRequest'),
  });
  checkSchemaOneOf(document, errors, 'B8RefreshRequest', ['B8WebRefreshRequest', 'B8NativeRefreshRequest'], {
    WEB_COOKIE: schemaRef('B8WebRefreshRequest'),
    NATIVE_SECURE_STORAGE: schemaRef('B8NativeRefreshRequest'),
  });
  for (const name of ['B8RegisterRequest', 'B8LoginRequest']) {
    add(errors, hasAll(schema(document, name)?.required, ['identifier', 'password', 'device']), `${name} must require identifier, password and device`);
    add(errors, schema(document, name)?.properties?.role === undefined && schema(document, name)?.properties?.tenantId === undefined && schema(document, name)?.properties?.ownerId === undefined, `${name} must not accept client authority fields`);
  }
  const refreshRequest = schema(document, 'B8RefreshRequest');
  add(errors, refreshRequest?.additionalProperties === false, 'B8RefreshRequest must reject undeclared credential fields');
  add(errors, refreshRequest?.['x-sensitive-fields']?.includes('refreshToken'), 'B8RefreshRequest must mark refreshToken sensitive');
  const deviceVariants = [
    ['B8WebDeviceInput', ['WEB', 'H5']],
    ['B8NativeDeviceInput', ['IOS', 'ANDROID', 'IPAD']],
  ];
  for (const [name, enumValues] of deviceVariants) {
    const device = schema(document, name);
    add(errors, isRecord(device) && Array.isArray(device.allOf) && device.allOf[0]?.$ref === schemaRef('B8DeviceInput'), `${name} must extend B8DeviceInput`);
    add(errors, exactArray(device?.allOf?.[1]?.properties?.deviceType?.enum, enumValues), `${name} deviceType mapping is invalid`);
  }

  const webRefresh = schema(document, 'B8WebRefreshRequest');
  add(errors, isRecord(webRefresh) && webRefresh.additionalProperties === false && webRefresh.maxProperties === 0, 'B8WebRefreshRequest must reject JSON refresh credentials');
  add(errors, isRecord(webRefresh) && webRefresh.properties?.refreshToken === undefined && !webRefresh.required?.includes('refreshToken'), 'Web refresh request must never declare refreshToken');
  const nativeRefresh = schema(document, 'B8NativeRefreshRequest');
  add(errors, isRecord(nativeRefresh) && nativeRefresh.required?.includes('refreshToken'), 'B8NativeRefreshRequest must require refreshToken');
  add(errors, nativeRefresh?.properties?.refreshToken?.writeOnly === true, 'B8NativeRefreshRequest.refreshToken must be writeOnly');
  add(errors, /Keychain.*Keystore/i.test(nativeRefresh?.properties?.refreshToken?.description ?? ''), 'B8NativeRefreshRequest must document Keychain/Keystore-only storage');
  add(errors, /localStorage|sessionStorage|ordinary storage|plaintext fallback/i.test(nativeRefresh?.properties?.refreshToken?.description ?? ''), 'B8NativeRefreshRequest must reject ordinary storage fallbacks');

  const webResponse = schema(document, 'B8WebAuthTokenResponse');
  add(errors, isRecord(webResponse) && webResponse.additionalProperties === false, 'B8WebAuthTokenResponse must reject undeclared credentials');
  add(errors, hasAll(webResponse?.required, ['authTransport', 'accessToken', 'tokenType', 'expiresIn', 'refreshExpiresIn', 'sessionId', 'deviceId']), 'B8WebAuthTokenResponse required fields are incomplete');
  add(errors, isRecord(webResponse) && webResponse.properties?.refreshToken === undefined && !webResponse.required?.includes('refreshToken'), 'Web auth JSON must never declare refreshToken');
  add(errors, !webResponse?.['x-sensitive-fields']?.includes('refreshToken'), 'Web auth response sensitive fields must not include a JSON refreshToken');
  add(errors, webResponse?.properties?.authTransport?.const === 'WEB_COOKIE' && webResponse.required?.includes('authTransport'), 'Web auth response must discriminate WEB_COOKIE');
  add(errors, webResponse?.properties?.tokenType?.const === 'Bearer' && webResponse?.properties?.expiresIn?.maximum === 900, 'Web access token response must use Bearer and a maximum 900-second lifetime');
  const nativeResponse = schema(document, 'B8NativeAuthTokenResponse');
  add(errors, hasAll(nativeResponse?.required, ['authTransport', 'accessToken', 'refreshToken', 'tokenType', 'expiresIn', 'refreshExpiresIn', 'sessionId', 'deviceId']), 'B8NativeAuthTokenResponse required fields are incomplete');
  add(errors, nativeResponse?.required?.includes('refreshToken'), 'B8NativeAuthTokenResponse must require refreshToken');
  add(errors, nativeResponse?.properties?.refreshToken?.readOnly === true, 'B8NativeAuthTokenResponse.refreshToken must be readOnly');
  add(errors, nativeResponse?.['x-sensitive-fields']?.includes('refreshToken'), 'Native auth response must mark refreshToken sensitive');
  add(errors, nativeResponse?.properties?.authTransport?.const === 'NATIVE_SECURE_STORAGE' && nativeResponse.required?.includes('authTransport'), 'Native auth response must discriminate NATIVE_SECURE_STORAGE');
  add(errors, nativeResponse?.properties?.tokenType?.const === 'Bearer' && nativeResponse?.properties?.expiresIn?.maximum === 900, 'Native access token response must use Bearer and a maximum 900-second lifetime');
  add(errors, /Keychain.*Keystore/i.test(nativeResponse?.properties?.refreshToken?.description ?? ''), 'B8NativeAuthTokenResponse must document Keychain/Keystore-only storage');
  add(errors, /localStorage|sessionStorage|ordinary storage|plaintext fallback/i.test(nativeResponse?.properties?.refreshToken?.description ?? ''), 'B8NativeAuthTokenResponse must reject ordinary storage fallbacks');

  const legacyResponse = schema(document, 'B8AuthTokenResponse');
  add(errors, legacyResponse?.deprecated === true, 'B8AuthTokenResponse must remain a deprecated compatibility shell');
  add(errors, nonEmpty(legacyResponse?.['x-compatibility-role']), 'B8AuthTokenResponse compatibility role is required');
  add(errors, !legacyResponse?.required?.includes('refreshToken'), 'legacy B8AuthTokenResponse.refreshToken must remain optional');

  const legacyErrorEnvelope = schema(document, 'B8ErrorEnvelope');
  add(errors, legacyErrorEnvelope?.['x-superseded-by'] === schemaRef('ApiErrorEnvelope'), 'B8ErrorEnvelope must be superseded by canonical ApiErrorEnvelope');

  const envelope = schema(document, 'B8AuthTokenEnvelope');
  add(errors, isRecord(envelope), 'B8AuthTokenEnvelope schema is required');
  if (isRecord(envelope)) {
    add(errors, Array.isArray(envelope.allOf) && envelope.allOf.some((candidate) => candidate?.$ref === schemaRef('ApiSuccessEnvelope')), 'B8AuthTokenEnvelope must extend canonical ApiSuccessEnvelope');
    const data = (Array.isArray(envelope.allOf) ? envelope.allOf : []).find((candidate) => candidate?.properties?.data)?.properties?.data;
    add(errors, isRecord(data), 'B8AuthTokenEnvelope.data is required');
    if (isRecord(data)) {
      add(errors, exactArray(data.oneOf?.map((candidate) => candidate?.$ref), [schemaRef('B8WebAuthTokenResponse'), schemaRef('B8NativeAuthTokenResponse')]), 'B8AuthTokenEnvelope.data.oneOf must map Web and Native responses');
      add(errors, data.discriminator?.propertyName === 'authTransport', 'B8AuthTokenEnvelope discriminator must use authTransport');
      add(errors, JSON.stringify(data.discriminator?.mapping) === JSON.stringify({
        WEB_COOKIE: schemaRef('B8WebAuthTokenResponse'),
        NATIVE_SECURE_STORAGE: schemaRef('B8NativeAuthTokenResponse'),
      }), 'B8AuthTokenEnvelope discriminator mapping is invalid');
    }
  }
}

function checkTokenOperations(document, errors) {
  for (const [operationId, definition] of Object.entries(TOKEN_OPERATIONS)) {
    const operation = document.paths?.[definition.route]?.post;
    const label = `POST ${definition.route}`;
    if (!isRecord(operation)) continue;
    add(errors, operation.requestBody?.content?.['application/json']?.schema?.$ref === schemaRef(definition.request), `${label} request must use ${definition.request}`);
    add(errors, operation.requestBody?.required === (operationId !== 'refreshB8JwtSession'), `${label} requestBody required flag is invalid`);
    checkTransportAwareOperation(document, errors, operation, document.paths[definition.route], label, definition.variants);
    const success = operation.responses?.[definition.successStatus];
    add(errors, success?.content?.['application/json']?.schema?.$ref === schemaRef('B8AuthTokenEnvelope'), `${label} success response must use B8AuthTokenEnvelope`);
    add(errors, success?.headers?.['Set-Cookie']?.$ref === '#/components/headers/B8RefreshCookie', `${label} success response must expose B8RefreshCookie`);
    checkResponseHeaders(success, label, errors, { cache: '#/components/headers/B8AuthNoStore' });
    add(errors, operation['x-idempotency']?.required === true, `${label} must require idempotency`);
    add(errors, operation['x-idempotency']?.keyHeader === 'Idempotency-Key', `${label} idempotency key header must be Idempotency-Key`);
    checkAudit(operation, label.replace(' responses.200', '').replace(' responses.201', ''), errors, {
      event: operationId === 'registerB8Account' ? 'auth.account.registered.v1' : operationId === 'loginB8Account' ? 'auth.login.succeeded.v1' : 'auth.session.rotated.v1',
      failureEvent: operationId === 'refreshB8JwtSession' ? 'auth.session.replay_detected.v1' : undefined,
      redacted: ['accessToken', 'refreshToken'],
    });
    if (operationId === 'refreshB8JwtSession') {
      const replay = operation['x-auth-transport']?.replay;
      add(errors, isRecord(replay), `${label} replay contract is required`);
      if (isRecord(replay)) {
        add(errors, nonEmpty(operation['x-idempotency']?.replayBehavior) && /same request key.*same rotation result/i.test(operation['x-idempotency'].replayBehavior), `${label} idempotency replay behavior must preserve the original rotation result`);
        add(errors, /previous Refresh Token.*different request key.*replay/i.test(operation['x-idempotency']?.replayBehavior ?? ''), `${label} idempotency replay behavior must detect reuse`);
        add(errors, replay.status === 401, `${label} replay must return HTTP 401`);
        add(errors, replay.response === responseRef('ApiUnauthorized'), `${label} replay must use ApiUnauthorized`);
        add(errors, replay.errorCode === CANONICAL_REPLAY_ERROR, `${label} replay errorCode must be ${CANONICAL_REPLAY_ERROR}`);
        add(errors, replay.effect === 'revoke-token-family-and-associated-session', `${label} replay must revoke family and session`);
        add(errors, replay.auditEvent === 'auth.session.replay_detected.v1', `${label} replay audit event is required`);
      }
    }
  }
}

function checkResponseHeaders(response, label, errors, { cookie, cache } = {}) {
  if (!isRecord(response)) {
    add(errors, false, `${label} response is required`);
    return;
  }
  const headers = response.headers ?? {};
  for (const header of REQUIRED_CORRELATION_HEADERS) {
    add(errors, headers[header]?.$ref === `#/components/headers/${header === 'X-API-Version' ? 'XApiVersion' : header === 'X-Request-Id' ? 'XRequestId' : 'XTraceId'}`, `${label} must expose ${header}`);
  }
  if (cookie !== undefined) add(errors, headers['Set-Cookie']?.$ref === cookie, `${label} Set-Cookie must reference ${cookie}`);
  if (cache !== undefined) add(errors, headers['Cache-Control']?.$ref === cache, `${label} Cache-Control must reference ${cache}`);
}

function containsRef(schemaValue, expectedRef, seen = new Set()) {
  if (!isRecord(schemaValue)) return false;
  if (schemaValue.$ref === expectedRef) return true;
  if (nonEmpty(schemaValue.$ref)) {
    if (seen.has(schemaValue.$ref)) return false;
    const next = new Set(seen);
    next.add(schemaValue.$ref);
    return false;
  }
  for (const keyword of ['allOf', 'oneOf', 'anyOf']) {
    if (Array.isArray(schemaValue[keyword]) && schemaValue[keyword].some((candidate) => containsRef(candidate, expectedRef, seen))) return true;
  }
  return false;
}

function checkSuccessEnvelope(response, label, errors, expectedDataRef) {
  const schemaValue = response?.content?.['application/json']?.schema;
  add(errors, isRecord(schemaValue), `${label} must declare an application/json response schema`);
  add(errors, containsRef(schemaValue, schemaRef('ApiSuccessEnvelope')) || containsRef(schemaValue, schemaRef('ApiCursorPageEnvelope')) || schemaValue?.$ref === schemaRef('B8AuthTokenEnvelope'), `${label} must extend canonical ApiSuccessEnvelope`);
  if (expectedDataRef) {
    const dataCandidates = [];
    const visit = (candidate) => {
      if (!isRecord(candidate)) return;
      if (isRecord(candidate.properties?.data)) dataCandidates.push(candidate.properties.data);
      for (const keyword of ['allOf', 'oneOf', 'anyOf']) if (Array.isArray(candidate[keyword])) for (const child of candidate[keyword]) visit(child);
    };
    visit(schemaValue);
    add(errors, dataCandidates.some((candidate) => candidate.$ref === expectedDataRef), `${label} data must use ${expectedDataRef}`);
  }
}

function checkCanonicalErrorResponse(document, operation, status, responseName, label, errors) {
  const expectedRef = responseRef(responseName);
  const actual = operation.responses?.[String(status)];
  add(errors, actual?.$ref === expectedRef, `${label} responses.${status} must reference ${expectedRef}`);
  const resolved = local(document, expectedRef);
  if (!isRecord(resolved)) return;
  if (responseName.startsWith('Api')) add(errors, resolved.content?.['application/json']?.schema?.$ref === schemaRef('ApiErrorEnvelope'), `${responseName} must use canonical ApiErrorEnvelope`);
  for (const header of REQUIRED_CORRELATION_HEADERS) {
    const expectedHeaderRef = `#/components/headers/${header === 'X-API-Version' ? 'XApiVersion' : header === 'X-Request-Id' ? 'XRequestId' : 'XTraceId'}`;
    add(errors, resolved.headers?.[header]?.$ref === expectedHeaderRef, `${responseName} must expose ${header}`);
  }
}

function checkAudit(operation, label, errors, { event, action, failureEvent, bodyCorrelation = true, redacted = [] } = {}) {
  const audit = operation?.['x-audit'];
  add(errors, isRecord(audit) && audit.required === true, `${label} audit is required`);
  if (!isRecord(audit)) return;
  if (event !== undefined) add(errors, audit.event === event, `${label} audit event must be ${event}`);
  if (action !== undefined) add(errors, audit.action === action, `${label} audit action must be ${action}`);
  if (failureEvent !== undefined) add(errors, audit.failureEvent === failureEvent, `${label} audit failure event must be ${failureEvent}`);
  add(errors, hasAll(audit.correlation, REQUIRED_AUDIT_CORRELATION), `${label} audit correlation must include request and trace headers`);
  if (bodyCorrelation) add(errors, hasAll(audit.correlation, ['response.body.meta.requestId', 'response.body.meta.traceId']), `${label} audit correlation must include response meta ids`);
  add(errors, hasAll(audit.redacted, redacted), `${label} audit must redact sensitive fields`);
}

function checkLifecycleResponses(document, errors) {
  const operations = document.paths ?? {};
  const logout = operations['/api/v1/auth/logout']?.post;
  const revoke = operations['/api/v1/auth/sessions/{sessionId}/revoke']?.post;
  const resetRequest = operations['/api/v1/auth/password-reset/request']?.post;
  const resetConfirm = operations['/api/v1/auth/password-reset/confirm']?.post;

  if (isRecord(logout)) {
    const label = 'POST /api/v1/auth/logout responses.200';
    checkSuccessEnvelope(logout.responses?.['200'], label, errors, schemaRef('B8SessionRevocationResponse'));
    checkResponseHeaders(logout.responses?.['200'], label, errors, { cookie: '#/components/headers/B8RefreshCookieClear', cache: '#/components/headers/B8AuthNoStore' });
    checkAudit(logout, 'POST /api/v1/auth/logout', errors, { event: 'iam.session.revoked.v1', bodyCorrelation: true });
  }
  if (isRecord(revoke)) {
    const label = 'POST /api/v1/auth/sessions/{sessionId}/revoke responses.200';
    checkSuccessEnvelope(revoke.responses?.['200'], label, errors, schemaRef('B8SessionRevocationResponse'));
    checkResponseHeaders(revoke.responses?.['200'], label, errors, { cookie: '#/components/headers/B8RefreshCookieClear', cache: '#/components/headers/B8AuthNoStore' });
    checkAudit(revoke, 'POST /api/v1/auth/sessions/{sessionId}/revoke', errors, { event: 'iam.session.revoked.v1', bodyCorrelation: true });
  }
  if (isRecord(resetRequest)) {
    const label = 'POST /api/v1/auth/password-reset/request responses.202';
    add(errors, resetRequest.requestBody?.required === true && resetRequest.requestBody?.content?.['application/json']?.schema?.$ref === schemaRef('B8PasswordResetRequest'), 'password reset request body must use B8PasswordResetRequest');
    checkSuccessEnvelope(resetRequest.responses?.['202'], label, errors);
    const allOf = resetRequest.responses?.['202']?.content?.['application/json']?.schema?.allOf;
    const accepted = (Array.isArray(allOf) ? allOf : []).find((candidate) => candidate?.properties?.data)?.properties?.data;
    add(errors, accepted?.properties?.accepted?.const === true && accepted.required?.includes('accepted'), 'password reset request must return an always-accepted non-enumerating result');
    checkResponseHeaders(resetRequest.responses?.['202'], label, errors, { cache: '#/components/headers/B8AuthNoStore' });
    checkAudit(resetRequest, 'POST /api/v1/auth/password-reset/request', errors, { action: 'password-reset-requested', bodyCorrelation: true });
    add(errors, resetRequest['x-audit']?.accountEnumeration === 'prohibited', 'password reset request must prohibit account enumeration');
  }
  if (isRecord(resetConfirm)) {
    add(errors, resetConfirm.requestBody?.required === true && resetConfirm.requestBody?.content?.['application/json']?.schema?.$ref === schemaRef('B8PasswordResetConfirmRequest'), 'password reset confirmation body must use B8PasswordResetConfirmRequest');
    checkAudit(resetConfirm, 'POST /api/v1/auth/password-reset/confirm', errors, { action: 'password-reset-confirmed', bodyCorrelation: false });
    const noContent = local(document, resetConfirm.responses?.['204']?.$ref);
    add(errors, isRecord(noContent), 'password reset 204 response must resolve to B8NoContent');
    if (isRecord(noContent)) {
      add(errors, noContent.headers?.['Set-Cookie']?.$ref === '#/components/headers/B8RefreshCookieClear', 'B8NoContent must clear B8RefreshCookie');
      add(errors, noContent.headers?.['Cache-Control']?.$ref === '#/components/headers/B8AuthNoStore', 'B8NoContent must use no-store cache control');
      for (const header of REQUIRED_CORRELATION_HEADERS) {
        const ref = `#/components/headers/${header === 'X-API-Version' ? 'XApiVersion' : header === 'X-Request-Id' ? 'XRequestId' : 'XTraceId'}`;
        add(errors, noContent.headers?.[header]?.$ref === ref, `B8NoContent must expose ${header}`);
      }
    }
  }
}

function checkClearTransport(document, operation, route, errors, { variants = true } = {}) {
  if (!isRecord(operation)) return;
  const label = `POST ${route}`;
  const refs = parameterRefs(document.paths?.[route], operation);
  add(errors, refs.filter((ref) => ref === '#/components/parameters/B8AuthTransport').length === 1, `${label} must reference X-Auth-Transport exactly once`);
  const transport = operation['x-auth-transport'];
  add(errors, isRecord(transport), `${label} x-auth-transport is required`);
  if (!isRecord(transport)) return;
  add(errors, transport.selector?.parameter === '#/components/parameters/B8AuthTransport', `${label} transport selector must reference B8AuthTransport`);
  add(errors, transport.selector?.default === 'WEB_COOKIE', `${label} transport default must be WEB_COOKIE`);
  add(errors, transport.selector?.nativeMustBeExplicit === true, `${label} native transport must be explicit`);
  if (variants) {
  add(errors, exactArray(isRecord(transport.variants) ? Object.keys(transport.variants) : undefined, TRANSPORTS), `${label} transport variants must be exactly Web and Native`);
    add(errors, transport.variants?.WEB_COOKIE?.responseHeader === '#/components/headers/B8RefreshCookieClear', `${label} Web variant must clear B8RefreshCookie`);
    add(errors, transport.variants?.NATIVE_SECURE_STORAGE?.responseHeader === 'absent', `${label} Native variant must not emit Set-Cookie`);
  }
}

function checkJwks(document, errors) {
  const operation = document.paths?.['/api/v1/auth/jwks']?.get;
  add(errors, Array.isArray(operation?.security) && operation.security.length === 0, 'JWKS must be public');
  const jwks = operation?.['x-jwks'];
  add(errors, isRecord(jwks), 'JWKS policy metadata is required');
  if (isRecord(jwks)) {
    add(errors, jwks.keyType === 'RSA', 'JWKS keyType must be RSA');
    add(errors, jwks.algorithm === 'RS256', 'JWKS algorithm must be RS256');
    add(errors, jwks.kid === 'required', 'JWKS kid must be required');
    add(errors, jwks.cacheControlHeader === '#/components/headers/B8JwksCacheControl', 'JWKS cache header reference is invalid');
    add(errors, Number.isInteger(jwks.maxCacheSeconds) && jwks.maxCacheSeconds > 0 && jwks.maxCacheSeconds <= 300, 'JWKS cache must be bounded to 300 seconds');
    add(errors, nonEmpty(jwks.rotation) && /publish-new-kid-before-use/i.test(jwks.rotation) && /max-access-token-lifetime.*clock-skew/i.test(jwks.rotation), 'JWKS rotation must publish the new kid and retain the previous key through token lifetime plus clock skew');
    add(errors, jwks.unknownKid === 'fail-closed', 'JWKS unknown kid must fail closed');
    add(errors, hasAll(jwks.forbidden, ['ES256', 'private-key-material']), 'JWKS must forbid ES256 and private key material');
  }
  const response = schema(document, 'B8JwksResponse');
  add(errors, isRecord(response) && response.required?.includes('keys'), 'B8JwksResponse.keys is required');
  add(errors, /Public RSA.*only/i.test(response?.['x-jwks-boundary'] ?? '') && /private.*never.*exposed|never.*private/i.test(response?.['x-jwks-boundary'] ?? ''), 'B8JwksResponse must expose only public RSA key material');
  add(errors, isRecord(response?.['x-jwks-rotation']), 'B8JwksResponse rotation policy is required');
  if (isRecord(response?.['x-jwks-rotation'])) {
    add(errors, response['x-jwks-rotation'].kidRequired === true, 'B8JwksResponse kidRequired must be true');
    add(errors, response['x-jwks-rotation'].publishNewKidBeforeUse === true, 'B8JwksResponse must publish new kid before use');
    add(errors, response['x-jwks-rotation'].cacheMaxSeconds === 300, 'B8JwksResponse cacheMaxSeconds must be 300');
    add(errors, /max-access-token-lifetime.*clock-skew/i.test(response['x-jwks-rotation'].previousKeyOverlap ?? ''), 'B8JwksResponse previous-key overlap must cover token lifetime and clock skew');
    add(errors, response['x-jwks-rotation'].unknownKid === 'fail-closed', 'B8JwksResponse unknown kid must fail closed');
    add(errors, hasAll(response['x-jwks-rotation'].forbiddenAlgorithms, ['none', 'HS256', 'ES256']), 'B8JwksResponse must forbid unsafe algorithms');
    add(errors, hasAll(response['x-jwks-rotation'].forbiddenPrivateMembers, ['d', 'k', 'p', 'q', 'dp', 'dq', 'qi', 'oth']), 'B8JwksResponse must deny private JWK members');
  }
  const item = response?.properties?.keys?.items;
  add(errors, isRecord(item) && item.type === 'object' && item.additionalProperties === false, 'JWKS keys must be closed public-key objects');
  add(errors, hasAll(item?.required, ['kty', 'kid', 'use', 'alg', 'n', 'e']), 'JWKS keys must require RSA public members');
  add(errors, item?.properties?.kty?.const === 'RSA', 'JWKS key kty must be RSA');
  add(errors, item?.properties?.use?.const === 'sig', 'JWKS key use must be sig');
  add(errors, item?.properties?.alg?.const === 'RS256', 'JWKS key alg must be RS256');
  add(errors, item?.properties?.kid?.type === 'string' && item?.properties?.n?.type === 'string' && item?.properties?.e?.type === 'string', 'JWKS public key kid and RSA material must be strings');
  for (const privateMember of ['d', 'k', 'p', 'q', 'dp', 'dq', 'qi', 'oth']) add(errors, item?.properties?.[privateMember] === undefined, `JWKS key must not expose private member ${privateMember}`);
  add(errors, operation?.responses?.['200']?.headers?.['Cache-Control']?.$ref === '#/components/headers/B8JwksCacheControl', 'JWKS response must expose bounded cache control');
  add(errors, operation?.responses?.['200']?.headers?.['Cache-Control']?.$ref !== undefined, 'JWKS response cache-control header is required');
  add(errors, Array.isArray(operation?.responses?.['200']?.content?.['application/json']?.schema?.allOf) && operation.responses['200'].content['application/json'].schema.allOf.some((candidate) => candidate?.properties?.data?.$ref === schemaRef('B8JwksResponse')), 'JWKS response data must use B8JwksResponse');
  add(errors, hasAll(operation?.['x-audit-correlation'] && Object.keys(operation['x-audit-correlation']), ['requestIdHeader', 'traceIdHeader', 'keyMaterial']), 'JWKS audit correlation must bind request/trace ids and key-material redaction');
  add(errors, operation?.['x-audit-correlation']?.requestIdHeader === 'X-Request-Id' && operation?.['x-audit-correlation']?.traceIdHeader === 'X-Trace-Id', 'JWKS audit correlation headers must be X-Request-Id and X-Trace-Id');
  add(errors, operation?.['x-audit-correlation']?.keyMaterial === 'never logged or returned beyond public JWK fields', 'JWKS audit must deny private key material');
  const cacheHeader = document.components?.headers?.B8JwksCacheControl;
  add(errors, cacheHeader?.schema?.type === 'string' && nonEmpty(cacheHeader?.schema?.pattern) && /max-age=.*300/i.test(cacheHeader.schema.pattern), 'B8JwksCacheControl must bound max-age to 300 seconds');
}

function checkCookie(document, errors) {
  const setCookie = document.components?.headers?.B8RefreshCookie;
  const clearCookie = document.components?.headers?.B8RefreshCookieClear;
  add(errors, isRecord(setCookie?.['x-cookie']), 'B8RefreshCookie security metadata is required');
  if (isRecord(setCookie?.['x-cookie'])) {
    const cookie = setCookie['x-cookie'];
    add(errors, cookie.name === 'yuxuexing_refresh' && cookie.path === '/api/v1/auth', 'B8RefreshCookie name/path are invalid');
    add(errors, cookie.maxAge === 'positive-seconds', 'B8RefreshCookie must have a positive Max-Age');
    add(errors, cookie.httpOnly === true && cookie.secure === true && cookie.sameSite === 'None' && cookie.partitioned === true, 'B8RefreshCookie must be HttpOnly, Secure, SameSite=None and Partitioned');
    add(errors, cookie.transport === 'WEB_COOKIE' && cookie.native === 'forbidden', 'B8RefreshCookie must be Web-only');
  }
  add(errors, isRecord(clearCookie?.['x-cookie']), 'B8RefreshCookieClear security metadata is required');
  if (isRecord(clearCookie?.['x-cookie'])) {
    const cookie = clearCookie['x-cookie'];
    add(errors, cookie.name === 'yuxuexing_refresh' && cookie.path === '/api/v1/auth', 'B8RefreshCookieClear name/path are invalid');
    add(errors, cookie.value === 'empty' && cookie.maxAge === 0 && cookie.expires === 'past-http-date', 'B8RefreshCookieClear must expire and empty the cookie');
    add(errors, cookie.httpOnly === true && cookie.secure === true && cookie.sameSite === 'None' && cookie.partitioned === true, 'B8RefreshCookieClear must retain cookie security attributes');
    add(errors, cookie.transport === 'WEB_COOKIE' && cookie.native === 'forbidden', 'B8RefreshCookieClear must be Web-only');
  }
}

function checkRevocationAndAudit(document, errors) {
  const logout = document.paths?.['/api/v1/auth/logout']?.post;
  const revoke = document.paths?.['/api/v1/auth/sessions/{sessionId}/revoke']?.post;
  for (const [label, operation] of [['logout', logout], ['session revoke', revoke]]) {
    add(errors, Array.isArray(operation?.security) && operation.security.some((entry) => isRecord(entry) && Object.hasOwn(entry, 'bearerAuth')), `${label} must require bearer authentication`);
    checkClearTransport(document, operation, label === 'logout' ? '/api/v1/auth/logout' : '/api/v1/auth/sessions/{sessionId}/revoke', errors);
    const revocation = operation?.['x-session-revocation'];
    add(errors, isRecord(revocation), `${label} session revocation policy is required`);
    if (label === 'logout') {
      add(errors, revocation?.defaultScope === 'current-session-and-token-family', 'logout must revoke current session and token family');
      add(errors, revocation?.allDevicesScope === 'all-principal-sessions-and-token-families', 'logout all-devices scope must revoke all principal sessions and token families');
    } else {
      add(errors, nonEmpty(revocation?.target) && /server-owned.*sessionId.*authenticated subject/i.test(revocation.target), 'session revoke target must be server-owned and subject-bound');
      add(errors, nonEmpty(revocation?.tokenFamily) && /target.*token family/i.test(revocation.tokenFamily), 'session revoke must revoke the target token family');
      add(errors, hasAll(revocation?.forbiddenClientAuthority, ['tenantId', 'ownerId', 'principalId']), 'session revoke must reject client authority fields');
    }
    if (label === 'logout') add(errors, exactArray(revocation?.terminalStatuses, ['REVOKED', 'ALREADY_REVOKED']), `${label} terminal statuses must be REVOKED and ALREADY_REVOKED`);
    checkAudit(operation, label, errors, { event: 'iam.session.revoked.v1', redacted: ['accessToken', 'refreshToken'] });
  }
  const reset = document.paths?.['/api/v1/auth/password-reset/confirm']?.post;
  checkClearTransport(document, reset, '/api/v1/auth/password-reset/confirm', errors, { variants: false });
  add(errors, reset?.['x-auth-transport']?.onSuccess?.WEB_COOKIE === 'clear the Refresh Token cookie', 'password reset Web success must clear the Refresh Token cookie');
  add(errors, reset?.['x-auth-transport']?.onSuccess?.NATIVE_SECURE_STORAGE === 'client clears its Keychain or Keystore Refresh Token after all prior sessions and token families are revoked', 'password reset Native success must clear Keychain/Keystore after revocation');
  add(errors, reset?.['x-password-reset']?.successEffect === 'revoke-all-prior-sessions-and-token-families', 'password reset must revoke all prior sessions and token families');
  add(errors, reset?.['x-password-reset']?.invalidOrConsumedChallenge?.status === 401, 'invalid password reset challenge must return 401');
  add(errors, reset?.['x-password-reset']?.invalidOrConsumedChallenge?.response === responseRef('ApiUnauthorized'), 'invalid password reset challenge must use ApiUnauthorized');
  add(errors, reset?.['x-audit']?.required === true, 'password reset audit is required');
  add(errors, hasAll(reset?.['x-audit']?.correlation, REQUIRED_AUDIT_CORRELATION), 'password reset audit correlation headers are required');
  add(errors, hasAll(reset?.['x-audit']?.redacted, ['identifier', 'resetToken', 'newPassword', 'refreshToken']), 'password reset audit must redact reset credentials');
  add(errors, reset?.responses?.['204']?.$ref === responseRef('B8NoContent'), 'password reset success must use B8NoContent');
  add(errors, document.components?.responses?.B8NoContent?.headers?.['Set-Cookie']?.$ref === '#/components/headers/B8RefreshCookieClear', 'B8NoContent must clear the Web refresh cookie');
  const revocationResponse = schema(document, 'B8SessionRevocationResponse');
  add(errors, hasAll(revocationResponse?.required, ['sessionId', 'status']), 'B8SessionRevocationResponse must require sessionId and status');
  add(errors, hasAll(revocationResponse?.properties?.status?.enum, ['REVOKED', 'ALREADY_REVOKED']), 'B8SessionRevocationResponse statuses are incomplete');
  add(errors, hasAll(revocationResponse?.properties?.reasonCode?.enum, ['LOGOUT', 'EXPLICIT_REVOKE', 'PASSWORD_RESET', 'REFRESH_REUSE']), 'B8SessionRevocationResponse reason codes are incomplete');
  add(errors, hasAll(revocationResponse?.properties?.revocationScope?.enum, ['CURRENT_SESSION_AND_TOKEN_FAMILY', 'TARGET_SESSION_AND_TOKEN_FAMILY', 'ALL_PRINCIPAL_SESSIONS_AND_TOKEN_FAMILIES']), 'B8SessionRevocationResponse scopes are incomplete');
}

function checkCanonicalErrors(document, errors) {
  for (const [operationId, statuses] of Object.entries(STANDARD_ERROR_RESPONSES)) {
    const definition = TOKEN_OPERATIONS[operationId];
    const route = definition?.route ?? Object.entries(AUTH_PATHS).find(([, [, id]]) => id === operationId)?.[0];
    const method = AUTH_PATHS[route]?.[0] ?? 'post';
    const operation = route ? document.paths?.[route]?.[method] : undefined;
    if (!isRecord(operation)) continue;
    for (const [status, response] of Object.entries(operation.responses ?? {})) {
      const responseName = CANONICAL_ERROR_BY_STATUS[status];
      if (responseName) checkCanonicalErrorResponse(document, operation, status, responseName, operationId, errors);
    }
    for (const [status, responseName] of Object.entries(statuses)) {
      if (!(status in (operation.responses ?? {}))) checkCanonicalErrorResponse(document, operation, status, responseName, operationId, errors);
    }
  }
}

function checkPublicAndProtectedSecurity(document, errors) {
  const publicOperations = [
    ['/api/v1/auth/register', 'post'],
    ['/api/v1/auth/login', 'post'],
    ['/api/v1/auth/token/refresh', 'post'],
    ['/api/v1/auth/jwks', 'get'],
    ['/api/v1/auth/password-reset/request', 'post'],
    ['/api/v1/auth/password-reset/confirm', 'post'],
  ];
  for (const [route, method] of publicOperations) add(errors, Array.isArray(document.paths?.[route]?.[method]?.security) && document.paths[route][method].security.length === 0, `${method.toUpperCase()} ${route} must explicitly be public`);
  const protectedOperations = [
    ['/api/v1/auth/logout', 'post'],
    ['/api/v1/auth/sessions/{sessionId}/revoke', 'post'],
    ['/api/v1/iam/principal/me', 'get'],
    ['/api/v1/iam/permissions', 'get'],
    ['/api/v1/iam/devices', 'get'],
    ['/api/v1/iam/devices/{deviceId}/kickout', 'post'],
    ['/api/v1/iam/adult-gate', 'post'],
    ['/api/v1/iam/consents', 'get'],
  ];
  for (const [route, method] of protectedOperations) add(errors, Array.isArray(document.paths?.[route]?.[method]?.security) && document.paths[route][method].security.some((entry) => isRecord(entry) && Object.hasOwn(entry, 'bearerAuth')), `${method.toUpperCase()} ${route} must require bearerAuth`);
  add(errors, Array.isArray(document.paths?.['/internal/v1/iam/authorization/decisions']?.post?.security) && document.paths['/internal/v1/iam/authorization/decisions'].post.security.some((entry) => isRecord(entry) && Object.hasOwn(entry, 'B8ServiceIdentity')), 'internal authorization decisions must require B8ServiceIdentity');
}

function checkRegisterAdultGate(document, errors) {
  const operation = document.paths?.['/api/v1/auth/register']?.post;
  add(errors, operation?.['x-public-entry']?.audience === 'adult-18-plus', 'register must be the adult-18-plus public entry');
  add(errors, operation?.['x-public-entry']?.adultGate === 'server-derived-before-learning-access', 'register must defer learning access to the server-derived adult Gate');
  add(errors, operation?.['x-public-entry']?.credentialBoundary === 'iam-service-only', 'register password boundary must be iam-service-only');
  add(errors, nonEmpty(operation?.description) && /18\s*or\s*above|adult/i.test(operation.description), 'register must document the adult public audience');
}

function checkGenericExternalSuccess(document, errors) {
  for (const [route, pathItem] of Object.entries(document.paths ?? {})) {
    if (!route.startsWith('/api/v1/')) continue;
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (!isRecord(operation) || !operation.operationId) continue;
      for (const [status, response] of Object.entries(operation.responses ?? {})) {
        if (!/^2\d\d$/.test(status) || response?.$ref === responseRef('B8NoContent')) continue;
        if (!response?.content?.['application/json']?.schema) continue;
        const label = `${method.toUpperCase()} ${route} responses.${status}`;
        checkResponseHeaders(response, label, errors);
        checkSuccessEnvelope(response, label, errors);
      }
    }
  }
}

export function validateAuthContractData({ document, openApi, fragment } = {}) {
  const input = document ?? openApi ?? fragment;
  const errors = [];
  add(errors, isRecord(input), 'authentication OpenAPI document must be an object');
  if (!isRecord(input)) return { result: 'FAIL', errors, summary: {} };
  checkLifecyclePaths(input, errors);
  checkRootAuthentication(input, errors);
  checkTransportParameter(input, errors);
  checkTokenSchemas(input, errors);
  checkTokenOperations(input, errors);
  checkJwks(input, errors);
  checkCookie(input, errors);
  checkRegisterAdultGate(input, errors);
  checkPublicAndProtectedSecurity(input, errors);
  checkLifecycleResponses(input, errors);
  checkGenericExternalSuccess(input, errors);
  checkRevocationAndAudit(input, errors);
  checkCanonicalErrors(input, errors);
  const covered = Object.keys(AUTH_PATHS).filter((route) => {
    const [method, operationId] = AUTH_PATHS[route];
    return input.paths?.[route]?.[method]?.operationId === operationId;
  }).length;
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    errors,
    summary: { requiredPathCount: Object.keys(AUTH_PATHS).length, coveredPathCount: covered },
  };
}

export function validateAuthContract({ root = process.cwd(), input } = {}) {
  const inputPath = path.resolve(root, input ?? DEFAULT_INPUT);
  try {
    const document = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    return { input: path.relative(root, inputPath), ...validateAuthContractData({ document }) };
  } catch (error) {
    return { input: path.relative(root, inputPath), result: 'FAIL', errors: [error instanceof Error ? error.message : String(error)], summary: {} };
  }
}

function cliInput(argv) {
  const args = [...argv];
  let input;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--input') {
      const next = args[++index];
      if (!next || next.startsWith('--')) return { error: '--input requires a JSON document path' };
      input = next;
    } else if (value?.startsWith('--input=')) {
      input = value.slice('--input='.length);
      if (!input) return { error: '--input requires a JSON document path' };
    }
    else if (value === '--help' || value === '-h') return { help: true };
    else if (value) return { error: `unknown argument: ${value}` };
  }
  return { input };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const parsed = cliInput(process.argv.slice(2));
  if (parsed.help) {
    console.log('Usage: node scripts/audit/p1r-auth-contract-check.mjs [--input <openapi.json>]');
    process.exit(0);
  }
  if (parsed.error) {
    console.error(JSON.stringify({ result: 'FAIL', errors: [parsed.error], summary: {} }, null, 2));
    process.exit(1);
  }
  const report = validateAuthContract({ input: parsed.input });
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.result === 'PASS' ? 0 : 1);
}
