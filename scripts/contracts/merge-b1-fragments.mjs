import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const openApiPath = path.join(repoRoot, 'packages', 'contracts', 'openapi', 'v1', 'openapi.json');
const eventCatalogPath = path.join(repoRoot, 'packages', 'contracts', 'events', 'v1', 'catalog.json');
const openApiFragmentDir = path.join(repoRoot, 'packages', 'contracts', 'fragments', 'b1');
const openApiB2FragmentDir = path.join(repoRoot, 'packages', 'contracts', 'fragments', 'b2');
const openApiB3FragmentDir = path.join(repoRoot, 'packages', 'contracts', 'fragments', 'b3');
const openApiB8FragmentDir = path.join(repoRoot, 'packages', 'contracts', 'fragments', 'b8');
const openApiB9FragmentDir = path.join(repoRoot, 'packages', 'contracts', 'fragments', 'b9');
const openApiB10FragmentDir = path.join(repoRoot, 'packages', 'contracts', 'fragments', 'b10');
const openApiB11FragmentDir = path.join(repoRoot, 'packages', 'contracts', 'fragments', 'b11');
const openApiB12FragmentDir = path.join(repoRoot, 'packages', 'contracts', 'fragments', 'b12');
const openApiB13FragmentDir = path.join(repoRoot, 'packages', 'contracts', 'fragments', 'b13');
const openApiB25FragmentDir = path.join(repoRoot, 'packages', 'contracts', 'fragments', 'b25');
const openApiSharedFragmentDir = path.join(repoRoot, 'packages', 'contracts', 'fragments');
const eventFragmentDir = path.join(repoRoot, 'packages', 'contracts', 'events', 'v1', 'fragments');

// v2 canonicalization boundary. These routes were exposed by the historical B1/B2/B4/B6
// slices or by the pre-B11 commerce/media naming. They must not leak back into the generated
// registry even if an old compatibility fragment is still present in a branch. The active
// clients use learner/iam, B12 notifications, signed-url and B13 payment-intents instead.
const retiredRoutes = new Set([
  '/api/v1/auth/refresh',
  '/api/v1/auth/sessions',
  '/api/v1/auth/sms/send-code',
  '/api/v1/auth/login/phone',
  '/api/v1/auth/oidc/{provider}/authorization/start',
  '/api/v1/auth/oidc/{provider}/callback',
  '/api/v1/auth/oidc/{provider}/metadata',
  '/api/v1/auth/oidc/{provider}/jwks',
  '/api/v1/iam/session/refresh',
  '/api/v1/iam/session/logout',
  '/api/v1/iam/sessions/{sessionId}/revoke',
  '/api/v1/home/feed',
  '/api/v1/user/profile',
  '/api/v1/user/learning-preferences',
  '/api/v1/user/privacy',
  '/api/v1/user/devices',
  '/api/v1/user/devices/{devicePublicId}/kick',
  '/api/v1/user/devices/kickout',
  '/api/v1/user/login-alerts',
  '/api/v1/user/deletion',
  '/api/v1/user/notifications',
  '/api/v1/user/notifications/{messageId}/read',
  '/api/v1/user/notifications/read-all',
  '/api/v1/user/notification-preferences',
  '/api/v1/notifications',
  '/api/v1/gamification/profile',
  '/api/v1/gamification/ledger',
  '/api/v1/gamification/events',
  '/api/v1/gamification/seasons/current',
  '/api/v1/social/rooms/{roomId}/focus-sessions',
  '/api/v1/social/focus-sessions/{sessionId}',
  '/api/v1/platform/release-matrix',
  '/api/v1/platform/builds',
  '/api/v1/platform/builds/{buildId}',
  '/api/v1/platform/compatibility-checks',
  '/api/v1/platform/performance/budget',
  '/api/v1/platform/accessibility/checklist',
  '/api/v1/platform/responsive/checklist',
  '/api/v1/observability/dashboard',
  '/api/v1/commerce/orders/{orderId}/payment-attempts',
  '/api/v1/media/assets/{assetId}/access',

  // B5's pre-v2 admin surface was implemented by the compatibility core-api and
  // is not a current browser contract.  The active admin browser uses B9
  // content commands, B12 governance routes, and B13 admin-ops projections and
  // commands.  Keep these paths retired at the merge boundary so an old
  // compatibility fragment cannot regenerate them into the client registry.
  '/api/v1/admin/content',
  '/api/v1/admin/content/{contentId}/draft',
  '/api/v1/admin/content/{contentId}/validate',
  '/api/v1/admin/content/{contentId}/submit-review',
  '/api/v1/admin/reviews',
  '/api/v1/admin/reviews/{reviewTaskId}/decision',
  '/api/v1/admin/content/{contentId}/publish',
  '/api/v1/admin/content/{contentId}/rollback',
  '/api/v1/admin/import-jobs',
  '/api/v1/admin/import-jobs/{importJobId}',
  '/api/v1/admin/correction-tickets',
  '/api/v1/admin/correction-tickets/{ticketId}/resolve',
  '/api/v1/admin/risk/users/{userId}',
  '/api/v1/admin/risk/users/{userId}/actions',
  '/api/v1/admin/dashboard/metrics',
  '/api/v1/admin/reconciliation/batches',
  '/api/v1/admin/reconciliation/batches/import',
  '/api/v1/admin/reconciliation/items/{itemId}/resolve',
  '/api/v1/admin/feature-flags',
  '/api/v1/admin/feature-flags/{flagKey}',
  '/api/v1/admin/activation-batches',
  '/api/v1/admin/activation-codes/{code}/revoke',
  '/api/v1/admin/commerce/orders/{orderId}/adjust',
  '/api/v1/admin/commerce/orders',
  '/api/v1/admin/commerce/users/{userId}/entitlements',
  '/api/v1/admin/session',
  '/api/v1/admin/audit-logs',
  '/api/v1/admin/audit-logs/export',
  '/api/v1/admin/ops/commands/{commandId}/confirm',
]);

// B5's historical admin paths are excluded before merge, but the canonical
// document may have been generated by an older run that already retained
// their tags and component schemas. Prune those orphaned definitions so the
// generated contract cannot continue to advertise the old surface.
const retiredB5AdminTags = new Set(['b5-admin-content', 'b5-admin-operations']);
const retiredB5AdminSchemas = new Set([
  'B5ContentDraftRequest',
  'B5ContentSaveRequest',
  'B5ReviewDecisionRequest',
  'B5ImportJobRequest',
  'B5CorrectionResolveRequest',
  'B5RiskActionRequest',
  'B5ReconciliationImportRequest',
  'B5ReconciliationResolveRequest',
  'B5FlagUpdateRequest',
  'B5ActivationBatchRequest',
  'B5OrderAdjustmentRequest',
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function listJsonFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

function mergeNamedMap(target, source, label, { allowOverride = false } = {}) {
  for (const [name, value] of Object.entries(source ?? {})) {
    if (target[name] !== undefined && stableJson(target[name]) !== stableJson(value) && !allowOverride) {
      throw new Error(`${label} duplicate with different definitions: ${name}`);
    }
    target[name] = value;
  }
}

function mergeOpenApi(base, fragment, filePath) {
  for (const tag of fragment.tags ?? []) {
    const existing = (base.tags ?? []).find((candidate) => candidate.name === tag.name);
    if (existing && stableJson(existing) !== stableJson(tag)) {
      if (tag.name === 'b8-auth') {
        base.tags = base.tags.map((candidate) => candidate.name === tag.name ? tag : candidate);
        continue;
      }
      throw new Error(`${filePath} conflicts with OpenAPI tag ${tag.name}`);
    }
    if (!existing) (base.tags ??= []).push(tag);
  }

  for (const [route, pathItem] of Object.entries(fragment.paths ?? {})) {
    const isOverrideFragment = /[\\/]b(?:2|3|4|5|6|8|9|10|11|12|13)(?:[\\/]|-)/i.test(filePath);
    const isB1LegacyAuthRoute = /[\\/]b1(?:[\\/]|-)/i.test(filePath) && route.startsWith('/api/v1/auth/');
    if (base.paths[route] && stableJson(base.paths[route]) !== stableJson(pathItem) && !isOverrideFragment && !isB1LegacyAuthRoute) {
      throw new Error(`${filePath} conflicts with OpenAPI route ${route}; reconcile manually`);
    }
    base.paths[route] = pathItem;
  }

  const isOverrideFragment = /[\\/]b(?:2|3|4|5|6|8|9|10|11|12|13|25)(?:[\\/]|-)/i.test(filePath);
  for (const componentGroup of ['schemas', 'parameters', 'responses', 'headers', 'securitySchemes', 'requestBodies', 'examples']) {
    mergeNamedMap(base.components[componentGroup] ??= {}, fragment.components?.[componentGroup], `OpenAPI ${componentGroup}`, { allowOverride: isOverrideFragment });
  }

  for (const metadataKey of ['x-b8-authentication', 'x-b8-compatibility']) {
    if (fragment[metadataKey] === undefined) continue;
    if (base[metadataKey] !== undefined && stableJson(base[metadataKey]) !== stableJson(fragment[metadataKey]) && metadataKey !== 'x-b8-compatibility') {
      throw new Error(`${filePath} conflicts with OpenAPI metadata ${metadataKey}`);
    }
    base[metadataKey] = fragment[metadataKey];
  }
}

function mergeEvents(base, fragment, filePath) {
  const isOverrideFragment = /[\\/]b(?:2|3|4|5|6|8|9|10|11|12|13)-/i.test(filePath);
  for (const event of fragment.events ?? []) {
    const existing = base.events.find((candidate) => candidate.eventName === event.eventName);
    if (existing && stableJson(existing) !== stableJson(event)) {
      if (!isOverrideFragment) throw new Error(`${filePath} conflicts with event ${event.eventName}`);
      base.events = base.events.map((candidate) => candidate.eventName === event.eventName ? event : candidate);
      continue;
    }
    if (!existing) base.events.push(event);
  }
  mergeNamedMap(base.payloadSchemas, fragment.payloadSchemas, 'event payload schema', { allowOverride: isOverrideFragment });

  if (fragment.asyncapi) {
    base.asyncapi ??= {};
    for (const key of ['version', 'info']) {
      if (fragment.asyncapi[key] === undefined) continue;
      if (base.asyncapi[key] !== undefined && stableJson(base.asyncapi[key]) !== stableJson(fragment.asyncapi[key])) {
        throw new Error(`${filePath} conflicts with AsyncAPI ${key}`);
      }
      base.asyncapi[key] = fragment.asyncapi[key];
    }
    mergeNamedMap(base.asyncapi.channels ??= {}, fragment.asyncapi.channels, 'AsyncAPI channel', { allowOverride: isOverrideFragment });
    mergeNamedMap(base.asyncapi.operations ??= {}, fragment.asyncapi.operations, 'AsyncAPI operation', { allowOverride: isOverrideFragment });
  }
}

function merge({ write = false } = {}) {
  const openApi = readJson(openApiPath);
  const catalog = readJson(eventCatalogPath);
  const retiredAuthEvents = new Set([
    'auth.oidc.authorization.started.v1',
    'auth.oidc.callback.completed.v1',
  ]);
  const retiredAuthPayloadSchemas = new Set([
    'AuthOidcAuthorizationStarted',
    'AuthOidcCallbackCompleted',
  ]);
  catalog.events = (catalog.events ?? []).filter((event) => !retiredAuthEvents.has(event.eventName));
  for (const eventName of retiredAuthEvents) {
    for (const channelName of Object.keys(catalog.asyncapi?.channels ?? {})) {
      if (catalog.asyncapi.channels[channelName]?.address === eventName) delete catalog.asyncapi.channels[channelName];
    }
  }
  for (const schemaName of retiredAuthPayloadSchemas) delete catalog.payloadSchemas?.[schemaName];
  const openApiFiles = [...listJsonFiles(openApiSharedFragmentDir), ...listJsonFiles(openApiFragmentDir), ...listJsonFiles(openApiB2FragmentDir), ...listJsonFiles(openApiB3FragmentDir), ...listJsonFiles(openApiB8FragmentDir), ...listJsonFiles(openApiB9FragmentDir), ...listJsonFiles(openApiB10FragmentDir), ...listJsonFiles(openApiB11FragmentDir), ...listJsonFiles(openApiB12FragmentDir), ...listJsonFiles(openApiB13FragmentDir), ...listJsonFiles(openApiB25FragmentDir)]
    .filter((filePath, index, files) => files.indexOf(filePath) === index)
    .filter((filePath) => readJson(filePath)['x-contract-status'] !== 'historical-compatibility');
  const eventFiles = listJsonFiles(eventFragmentDir).filter((filePath) => /^(b1|b2|b3|b4|b5|b6|b8|b9|b10|b11|b12|b13|b26)-/.test(path.basename(filePath)));

  for (const filePath of openApiFiles) mergeOpenApi(openApi, readJson(filePath), path.relative(repoRoot, filePath));
  for (const filePath of eventFiles) mergeEvents(catalog, readJson(filePath), path.relative(repoRoot, filePath));

  for (const route of retiredRoutes) delete openApi.paths[route];
  openApi.tags = (openApi.tags ?? []).filter((tag) => !retiredB5AdminTags.has(tag.name));
  openApi.tags = openApi.tags.filter((tag) => tag.name !== 'b8-iam');
  for (const schema of retiredB5AdminSchemas) delete openApi.components?.schemas?.[schema];

  for (const schema of [
    'B8AuthorizationStartResponse', 'B8OidcCallbackRequest', 'B8OidcCallbackResponse',
    'B8SessionEstablishedResponse', 'B8SessionRefreshRequest', 'B8SessionTokenResponse',
    'B8OidcProviderMetadata', 'B8AuthorizationTransaction',
  ]) delete openApi.components?.schemas?.[schema];
  for (const parameter of [
    'B8Provider', 'B8RedirectUri', 'B8AuthIntent', 'B8ReturnTo', 'B8UiLocale', 'B8Theme',
    'B8CodeChallenge', 'B8CodeChallengeMethod', 'B8State', 'B8Nonce', 'B8CallbackCode',
    'B8OidcCallbackError', 'B8OidcCallbackErrorDescription', 'B8OidcCallbackErrorUri',
  ]) delete openApi.components?.parameters?.[parameter];
  for (const header of ['B8CallbackLocation', 'B8SessionCookie']) {
    delete openApi.components?.headers?.[header];
  }
  for (const response of ['B8IdpUnavailable']) delete openApi.components?.responses?.[response];
  delete openApi.components?.securitySchemes?.B8WorkloadIdentity;
  delete openApi['x-b8-idp-integration'];

  if (write) {
    writeJson(openApiPath, openApi);
    writeJson(eventCatalogPath, catalog);
  }

  return {
    openApiFragments: openApiFiles.map((filePath) => path.relative(repoRoot, filePath)),
    eventFragments: eventFiles.map((filePath) => path.relative(repoRoot, filePath)),
    routes: Object.keys(openApi.paths).length,
    events: catalog.events.length,
  };
}

try {
  const result = merge({ write: process.argv.includes('--write') });
  console.log(`Contract fragment merge ${process.argv.includes('--write') ? 'written' : 'checked'}: ${result.openApiFragments.length} OpenAPI fragments, ${result.eventFragments.length} event fragments, ${result.routes} routes, ${result.events} events.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
