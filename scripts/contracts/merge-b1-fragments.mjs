import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEventGovernanceData } from '../audit/p1r-event-governance-check.mjs';
import { projectCanonicalAsyncApi } from './event-governance-projection.mjs';

export { projectCanonicalAsyncApi } from './event-governance-projection.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const openApiPath = path.join(repoRoot, 'packages', 'contracts', 'openapi', 'v1', 'openapi.json');
const eventCatalogPath = path.join(repoRoot, 'packages', 'contracts', 'events', 'v1', 'catalog.json');
const dataOwnershipPath = path.join(repoRoot, 'config', 'p1r-data-ownership.v1.json');
const b26RuntimePath = path.join(repoRoot, 'config', 'b26-event-runtime.json');
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
const canonicalB8AuthFragment = 'packages/contracts/fragments/b8/b8-auth-iam.openapi.json';
const canonicalB1ContentFragment = 'packages/contracts/fragments/b1-content.openapi.json';
const canonicalB1AdapterRouteAllowlist = new Map([
  ['packages/contracts/fragments/b1/b1-auth-user-onboarding.openapi.json', new Set([
    '/api/v1/onboarding/options',
    '/api/v1/onboarding/profile',
    '/api/v1/onboarding/goals/first',
    '/api/v1/onboarding/daily-tasks/today',
    '/api/v1/onboarding/daily-tasks/{taskId}/complete',
    '/api/v1/onboarding/daily-tasks/reorder',
    '/api/v1/assessment/placement/skip',
    '/api/v1/assessment/placement/report/{sessionId}',
  ])],
  ['packages/contracts/fragments/b1/b1-onboarding-privacy.openapi.json', new Set([
    '/api/v1/assessment/placement/start',
    '/api/v1/assessment/placement/submit-step',
  ])],
]);
const canonicalB1AdapterSchemaAllowlist = new Map([
  ['packages/contracts/fragments/b1/b1-auth-user-onboarding.openapi.json', new Set(['B1OnboardingProfileRequest'])],
]);
const requiredCanonicalB8Metadata = ['x-b8-authentication', 'x-b8-compatibility', 'x-b8-iam-policy-governance'];
const canonicalGatewayFragment = 'packages/contracts/fragments/p1r-gateway-boundary.openapi.json';
const requiredCanonicalGatewayMetadata = ['x-p1r-gateway-boundary'];
const canonicalMediaFragment = 'packages/contracts/fragments/b11/p1r-media.openapi.json';
const requiredCanonicalMediaMetadata = ['x-p1r-media-contract'];

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

function normalizeRepoPath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function listJsonFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

function listEventJsonFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  const visit = (currentDirectory) => {
    for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const filePath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) visit(filePath);
      else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.json') files.push(filePath);
    }
  };
  visit(directory);
  return files.sort();
}

function mergeNamedMap(target, source, label, { allowOverride = false, allowOverrideNames = new Set() } = {}) {
  for (const [name, value] of Object.entries(source ?? {})) {
    if (target[name] !== undefined && stableJson(target[name]) !== stableJson(value)
      && !allowOverride && !allowOverrideNames.has(name)) {
      throw new Error(`${label} duplicate with different definitions: ${name}`);
    }
    target[name] = value;
  }
}

function mergeOpenApi(
  base,
  fragment,
  filePath,
  canonicalB8MetadataWrites,
  canonicalGatewayMetadataWrites,
  canonicalMediaMetadataWrites,
) {
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
    const normalizedFilePath = normalizeRepoPath(filePath);
    const isCanonicalB1AdapterRoute = canonicalB1AdapterRouteAllowlist
      .get(normalizedFilePath)?.has(route) === true;
    const isOverrideFragment = /[\\/]b(?:2|3|4|5|6|8|9|10|11|12|13)(?:[\\/]|-)/i.test(filePath)
      || isCanonicalB1AdapterRoute;
    const isB1LegacyAuthRoute = /[\\/]b1(?:[\\/]|-)/i.test(filePath) && route.startsWith('/api/v1/auth/');
    const isCanonicalB1ContentRoute = normalizeRepoPath(filePath) === canonicalB1ContentFragment;
    if (base.paths[route] && stableJson(base.paths[route]) !== stableJson(pathItem) && !isOverrideFragment && !isB1LegacyAuthRoute && !isCanonicalB1ContentRoute) {
      throw new Error(`${filePath} conflicts with OpenAPI route ${route}; reconcile manually`);
    }
    base.paths[route] = pathItem;
  }

  const normalizedFilePath = normalizeRepoPath(filePath);
  const isOverrideFragment = /[\\/]b(?:2|3|4|5|6|8|9|10|11|12|13|25)(?:[\\/]|-)/i.test(filePath)
    || normalizedFilePath === canonicalB1ContentFragment;
  for (const componentGroup of ['schemas', 'parameters', 'responses', 'headers', 'securitySchemes', 'requestBodies', 'examples']) {
    const allowOverrideNames = componentGroup === 'schemas'
      ? canonicalB1AdapterSchemaAllowlist.get(normalizedFilePath) ?? new Set()
      : new Set();
    mergeNamedMap(base.components[componentGroup] ??= {}, fragment.components?.[componentGroup], `OpenAPI ${componentGroup}`, {
      allowOverride: isOverrideFragment,
      allowOverrideNames,
    });
  }

  for (const metadataKey of requiredCanonicalB8Metadata) {
    if (fragment[metadataKey] === undefined) continue;
    const isB8CanonicalOverride = normalizeRepoPath(filePath) === canonicalB8AuthFragment;
    if (!isB8CanonicalOverride) throw new Error(`${filePath} cannot define canonical OpenAPI metadata ${metadataKey}`);
    base[metadataKey] = fragment[metadataKey];
    canonicalB8MetadataWrites.add(metadataKey);
  }

  for (const metadataKey of requiredCanonicalGatewayMetadata) {
    if (fragment[metadataKey] === undefined) continue;
    const isGatewayCanonicalSource = normalizeRepoPath(filePath) === canonicalGatewayFragment;
    if (!isGatewayCanonicalSource) throw new Error(`${filePath} cannot define canonical OpenAPI metadata ${metadataKey}`);
    base[metadataKey] = fragment[metadataKey];
    canonicalGatewayMetadataWrites.add(metadataKey);
  }

  for (const metadataKey of requiredCanonicalMediaMetadata) {
    if (fragment[metadataKey] === undefined) continue;
    const isMediaCanonicalSource = normalizeRepoPath(filePath) === canonicalMediaFragment;
    if (!isMediaCanonicalSource) throw new Error(`${filePath} cannot define canonical OpenAPI metadata ${metadataKey}`);
    base[metadataKey] = fragment[metadataKey];
    canonicalMediaMetadataWrites.add(metadataKey);
  }
}

export function selectEventFragmentFiles(files) {
  return files.filter((filePath) => path.basename(filePath).toLowerCase().endsWith('.events.json'));
}

export function mergeEvents(base, fragment, filePath) {
  if (fragment.asyncapi !== undefined) {
    throw new Error(`${filePath} must not define asyncapi; canonical channels and operations are generated from catalog event governance`);
  }
  const normalizedFragmentPath = normalizeRepoPath(filePath);
  const isOverrideFragment = /[\\/]b(?:2|3|4|5|6|8|9|10|11|12|13|26)-/i.test(filePath)
    || normalizedFragmentPath === 'packages/contracts/events/v1/fragments/m1-014-gamification-social-v2.events.json'
    || normalizedFragmentPath === 'packages/contracts/events/v1/fragments/m1-015-commerce-v2.events.json';
  for (const event of fragment.events ?? []) {
    if (event.status !== undefined || event['x-p1r-governance'] !== undefined) {
      throw new Error(`${filePath} must not define catalog-owned status or x-p1r-governance for ${event.eventName ?? '(missing eventName)'}`);
    }
    const existing = base.events.find((candidate) => candidate.eventName === event.eventName);
    if (!existing) {
      throw new Error(`${filePath} introduces ${event.eventName ?? '(missing eventName)'} without a catalog-owned governance record`);
    }
    const catalogOwned = {
      status: existing.status,
      governance: existing['x-p1r-governance'],
    };
    const existingFragmentFields = { ...existing };
    delete existingFragmentFields.status;
    delete existingFragmentFields['x-p1r-governance'];
    if (stableJson(existingFragmentFields) !== stableJson(event)) {
      if (!isOverrideFragment) throw new Error(`${filePath} conflicts with event ${event.eventName}`);
      base.events = base.events.map((candidate) => candidate.eventName === event.eventName
        ? {
            ...event,
            status: catalogOwned.status,
            ...(catalogOwned.governance === undefined ? {} : { 'x-p1r-governance': catalogOwned.governance }),
          }
        : candidate);
      continue;
    }
  }
  mergeNamedMap(base.payloadSchemas, fragment.payloadSchemas, 'event payload schema', { allowOverride: isOverrideFragment });
}

function eventPayloadSchemaName(event, label) {
  const payloadSchema = event?.payloadSchema;
  if (!payloadSchema || typeof payloadSchema !== 'object' || Array.isArray(payloadSchema)
    || Object.keys(payloadSchema).length !== 1 || typeof payloadSchema.$ref !== 'string') {
    throw new Error(`${label} payloadSchema must be exactly { $ref: '#/payloadSchemas/<Name>' } before merge pruning`);
  }
  const match = /^#\/payloadSchemas\/([A-Za-z][A-Za-z0-9_]*)$/.exec(payloadSchema.$ref);
  if (!match) throw new Error(`${label} payloadSchema must reference a local #/payloadSchemas/<Name> definition before merge pruning`);
  return match[1];
}

function pruneUnreferencedEventPayloadSchemas(catalog) {
  const payloadSchemas = catalog.payloadSchemas ?? {};
  const referenced = new Set();
  for (const event of catalog.events ?? []) {
    const schemaName = eventPayloadSchemaName(event, event?.eventName ?? 'event');
    if (!Object.hasOwn(payloadSchemas, schemaName)) {
      throw new Error(`${event?.eventName ?? 'event'} references missing payload schema ${schemaName} before merge pruning`);
    }
    referenced.add(schemaName);
  }
  for (const schemaName of Object.keys(payloadSchemas)) {
    if (!referenced.has(schemaName)) delete payloadSchemas[schemaName];
  }
}

export function findCanonicalMergeDrift({
  expectedOpenApi,
  actualOpenApi,
  expectedEventCatalog,
  actualEventCatalog,
} = {}) {
  const drift = [];
  if (stableJson(expectedOpenApi) !== stableJson(actualOpenApi)) {
    drift.push('packages/contracts/openapi/v1/openapi.json');
  }
  if (stableJson(expectedEventCatalog) !== stableJson(actualEventCatalog)) {
    drift.push('packages/contracts/events/v1/catalog.json');
  }
  return drift;
}

export function merge({ write = false } = {}) {
  const openApi = readJson(openApiPath);
  const catalog = readJson(eventCatalogPath);
  // Never retain stale canonical security metadata from a previous generated
  // document. Every value must be supplied again by its one exact source
  // fragment, so a future deletion fails both write and --check modes.
  for (const metadataKey of requiredCanonicalB8Metadata) delete openApi[metadataKey];
  for (const metadataKey of requiredCanonicalGatewayMetadata) delete openApi[metadataKey];
  for (const metadataKey of requiredCanonicalMediaMetadata) delete openApi[metadataKey];
  const canonicalB8MetadataWrites = new Set();
  const canonicalGatewayMetadataWrites = new Set();
  const canonicalMediaMetadataWrites = new Set();
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
  const eventFiles = selectEventFragmentFiles(listEventJsonFiles(eventFragmentDir));

  for (const filePath of openApiFiles) mergeOpenApi(
    openApi,
    readJson(filePath),
    path.relative(repoRoot, filePath),
    canonicalB8MetadataWrites,
    canonicalGatewayMetadataWrites,
    canonicalMediaMetadataWrites,
  );
  const missingCanonicalB8Metadata = requiredCanonicalB8Metadata.filter((metadataKey) => !canonicalB8MetadataWrites.has(metadataKey));
  if (missingCanonicalB8Metadata.length > 0) {
    throw new Error(`${canonicalB8AuthFragment} must define ${missingCanonicalB8Metadata.join(', ')} during every canonical merge`);
  }
  const missingCanonicalGatewayMetadata = requiredCanonicalGatewayMetadata.filter((metadataKey) => !canonicalGatewayMetadataWrites.has(metadataKey));
  if (missingCanonicalGatewayMetadata.length > 0) {
    throw new Error(`${canonicalGatewayFragment} must define ${missingCanonicalGatewayMetadata.join(', ')} during every canonical merge`);
  }
  const missingCanonicalMediaMetadata = requiredCanonicalMediaMetadata.filter((metadataKey) => !canonicalMediaMetadataWrites.has(metadataKey));
  if (missingCanonicalMediaMetadata.length > 0) {
    throw new Error(`${canonicalMediaFragment} must define ${missingCanonicalMediaMetadata.join(', ')} during every canonical merge`);
  }
  for (const filePath of eventFiles) mergeEvents(catalog, readJson(filePath), path.relative(repoRoot, filePath));
  pruneUnreferencedEventPayloadSchemas(catalog);
  const eventGovernanceInputs = {
    catalog,
    ownerPolicy: readJson(dataOwnershipPath),
    b26Runtime: readJson(b26RuntimePath),
    fragments: eventFiles.map((filePath) => ({
      path: normalizeRepoPath(path.relative(repoRoot, filePath)),
      data: readJson(filePath),
    })),
  };
  const eventGovernanceResult = validateEventGovernanceData({
    ...eventGovernanceInputs,
    checkProjection: false,
  });
  if (eventGovernanceResult.result !== 'PASS') {
    throw new Error(`Event governance validation failed before AsyncAPI projection:\n${eventGovernanceResult.errors.join('\n')}`);
  }
  projectCanonicalAsyncApi(catalog);
  const projectionResult = validateEventGovernanceData(eventGovernanceInputs);
  if (projectionResult.result !== 'PASS') {
    throw new Error(`Event governance validation failed after AsyncAPI projection:\n${projectionResult.errors.join('\n')}`);
  }

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
    // M1-014 list routes use the platform Cursor/PageSize pair. These aliases
    // were source-owned by the replaced B12 fragment and must not survive as
    // unused second definitions in the canonical projection.
    'M1014Cursor', 'M1014PageSize',
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
  } else {
    const drift = findCanonicalMergeDrift({
      expectedOpenApi: openApi,
      actualOpenApi: readJson(openApiPath),
      expectedEventCatalog: catalog,
      actualEventCatalog: readJson(eventCatalogPath),
    });
    if (drift.length > 0) {
      throw new Error(`Canonical merge drift detected in ${drift.join(', ')}. Run pnpm contracts:merge to write canonical outputs.`);
    }
  }

  return {
    openApiFragments: openApiFiles.map((filePath) => path.relative(repoRoot, filePath)),
    eventFragments: eventFiles.map((filePath) => path.relative(repoRoot, filePath)),
    routes: Object.keys(openApi.paths).length,
    events: catalog.events.length,
    asyncApiChannels: Object.keys(catalog.asyncapi.channels).length,
    asyncApiOperations: Object.keys(catalog.asyncapi.operations).length,
  };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isCli) {
  try {
    const write = process.argv.includes('--write');
    const result = merge({ write });
    console.log(`Contract fragment merge ${write ? 'written' : 'checked'}: ${result.openApiFragments.length} OpenAPI fragments, ${result.eventFragments.length} event fragments, ${result.routes} routes, ${result.events} events, ${result.asyncApiChannels} AsyncAPI channels, ${result.asyncApiOperations} AsyncAPI operations.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
