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
const canonicalB8AuthFragment = 'packages/contracts/fragments/b8/b8-auth-iam.openapi.json';
const requiredCanonicalB8Metadata = ['x-b8-authentication', 'x-b8-compatibility', 'x-b8-iam-policy-governance'];
const canonicalGatewayFragment = 'packages/contracts/fragments/p1r-gateway-boundary.openapi.json';
const requiredCanonicalGatewayMetadata = ['x-p1r-gateway-boundary'];

const canonicalAsyncApiInfo = {
  title: '语学星 v2 平台集成事件',
  version: '1.0.0',
  description: '语学星 v2 跨服务集成事实的 canonical AsyncAPI 3.0 投影。每个活动事件对应唯一的发送操作与频道；事件通过 Kafka 兼容总线和事务性 Outbox 按至少一次语义发布。',
};

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

function encodeJsonPointerToken(value) {
  return String(value).replace(/~/g, '~0').replace(/\//g, '~1');
}

function uniqueName(base, used) {
  if (!used.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}_${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}

function normalizedAsyncApiName(eventName) {
  return eventName.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function projectedChannelAddress(event) {
  const topic = event['x-kafka']?.topic;
  if (topic !== undefined) {
    if (typeof topic !== 'string' || topic.length === 0) {
      throw new Error(`Cannot project AsyncAPI for ${event.eventName}: x-kafka.topic must be a non-empty string when declared`);
    }
    return topic;
  }
  return event.eventName;
}

function eventNamesHintedByChannel(channel) {
  const eventNames = new Set();
  for (const message of Object.values(channel?.messages ?? {})) {
    if (!message || typeof message !== 'object') continue;
    for (const candidate of [message['x-event-name'], message.name]) {
      if (typeof candidate === 'string') eventNames.add(candidate);
    }
  }
  // Legacy fragments projected event names as addresses and did not yet carry
  // Message Objects. Retain those keys during the one-time normalization.
  if (typeof channel?.address === 'string') eventNames.add(channel.address);
  return eventNames;
}

/**
 * Build the catalog's embedded canonical AsyncAPI projection from active events.
 * Fragment channels are used only as stable key/message-key hints; their
 * routes, operations and IAM-specific document metadata cannot become a
 * partial second source of truth.
 */
function projectCanonicalAsyncApi(catalog) {
  const existingChannels = catalog.asyncapi?.channels ?? {};
  const existingKeysByEventName = new Map();
  for (const [channelKey, channel] of Object.entries(existingChannels)) {
    if (!channel || typeof channel !== 'object') continue;
    for (const eventName of eventNamesHintedByChannel(channel)) {
      const keys = existingKeysByEventName.get(eventName) ?? [];
      keys.push(channelKey);
      existingKeysByEventName.set(eventName, keys);
    }
  }
  for (const keys of existingKeysByEventName.values()) keys.sort();

  const channels = {};
  const operations = {};
  const usedChannelKeys = new Set();
  const usedOperationKeys = new Set();

  for (const event of catalog.events ?? []) {
    const eventName = event.eventName;
    const payloadReference = event.payloadSchema?.$ref;
    if (typeof eventName !== 'string' || typeof payloadReference !== 'string') {
      throw new Error(`Cannot project AsyncAPI for invalid event entry: ${eventName ?? '(missing eventName)'}`);
    }

    const reusableChannelKey = (existingKeysByEventName.get(eventName) ?? []).find((key) => !usedChannelKeys.has(key));
    const channelKey = reusableChannelKey ?? uniqueName(`event_${normalizedAsyncApiName(eventName)}`, usedChannelKeys);
    const existingChannel = reusableChannelKey ? existingChannels[reusableChannelKey] : undefined;
    const matchingMessage = Object.entries(existingChannel?.messages ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .find(([, message]) => message?.payload?.$ref === payloadReference || message?.$ref === payloadReference);
    const messageKey = matchingMessage?.[0] ?? 'event';
    const messagePointer = `#/asyncapi/channels/${encodeJsonPointerToken(channelKey)}/messages/${encodeJsonPointerToken(messageKey)}`;

    channels[channelKey] = {
      address: projectedChannelAddress(event),
      messages: {
        [messageKey]: {
          name: eventName,
          'x-event-name': eventName,
          payload: { $ref: payloadReference },
        },
      },
    };
    usedChannelKeys.add(channelKey);

    const operationKey = uniqueName(`publish_${normalizedAsyncApiName(eventName)}`, usedOperationKeys);
    operations[operationKey] = {
      action: 'send',
      channel: { $ref: `#/asyncapi/channels/${encodeJsonPointerToken(channelKey)}` },
      messages: [{ $ref: messagePointer }],
    };
    usedOperationKeys.add(operationKey);
  }

  catalog.asyncapi = {
    asyncapi: '3.0.0',
    info: { ...canonicalAsyncApiInfo, version: catalog.catalogVersion },
    channels,
    operations,
  };
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

function mergeOpenApi(base, fragment, filePath, canonicalB8MetadataWrites, canonicalGatewayMetadataWrites) {
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

  if (fragment.asyncapi?.channels) {
    base.asyncapi ??= {};
    mergeNamedMap(base.asyncapi.channels ??= {}, fragment.asyncapi.channels, 'AsyncAPI channel', { allowOverride: isOverrideFragment });
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
  const canonicalB8MetadataWrites = new Set();
  const canonicalGatewayMetadataWrites = new Set();
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

  for (const filePath of openApiFiles) mergeOpenApi(openApi, readJson(filePath), path.relative(repoRoot, filePath), canonicalB8MetadataWrites, canonicalGatewayMetadataWrites);
  const missingCanonicalB8Metadata = requiredCanonicalB8Metadata.filter((metadataKey) => !canonicalB8MetadataWrites.has(metadataKey));
  if (missingCanonicalB8Metadata.length > 0) {
    throw new Error(`${canonicalB8AuthFragment} must define ${missingCanonicalB8Metadata.join(', ')} during every canonical merge`);
  }
  const missingCanonicalGatewayMetadata = requiredCanonicalGatewayMetadata.filter((metadataKey) => !canonicalGatewayMetadataWrites.has(metadataKey));
  if (missingCanonicalGatewayMetadata.length > 0) {
    throw new Error(`${canonicalGatewayFragment} must define ${missingCanonicalGatewayMetadata.join(', ')} during every canonical merge`);
  }
  for (const filePath of eventFiles) mergeEvents(catalog, readJson(filePath), path.relative(repoRoot, filePath));
  projectCanonicalAsyncApi(catalog);

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
