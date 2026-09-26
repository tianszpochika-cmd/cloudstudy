import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ROOT = path.resolve(moduleDir, '../..');
export const DEFAULT_POLICY_PATH = path.join(DEFAULT_ROOT, 'config/p1r-gamification-social-contract.v1.json');

const ROOT_KEYS = [
  '$schema',
  'schemaVersion',
  'task',
  'phase',
  'sourceBaseline',
  'maturity',
  'runtimeStatus',
  'collectionPolicy',
  'canonicalSources',
  'compatibilityPromotion',
  'runtimeBoundary',
  'owners',
  'authority',
  'trustedCompletion',
  'ledger',
  'randomRewards',
  'gameCatalog',
  'socialSpaces',
  'leaderboard',
  'moderation',
  'events',
  'phase1Prohibitions',
];

const REQUIRED_COLLECTION_POLICY = {
  unknownFieldDecision: 'DENY',
  unknownEnumDecision: 'DENY',
  additionalProperties: 'DENY',
  clientAuthorityExpansion: 'PROHIBITED',
};

const REQUIRED_COMPATIBILITY_PROMOTION = {
  id: 'P1R-M1-014',
  sourceContractBaseline: 'e3514c359e6f6be5445cf46a7734325b2835b941',
  previousPromotion: 'P1R-M1-013',
  immutableGovernanceBaseline: '868c2177f62b6d2cf613bed702686dddcfe6943f',
  runtimeStatus: 'NOT_RUNTIME_VERIFIED',
  scope: 'OPENAPI_EVENT_GOVERNANCE_B26_STATIC',
};

const EXPECTED_SPACE_TYPES = [
  {
    type: 'PUBLIC_THEME_ROOM',
    visibility: 'PUBLIC',
    membership: 'THEME_TEMPLATE_MANAGED',
    minCapacity: 20,
    maxCapacity: 30,
    seatLease: 'REQUIRED',
    initialGate: { priority: 'P0', enabled: true },
  },
  {
    type: 'INVITE_STUDY_ROOM',
    visibility: 'INVITE_ONLY',
    membership: 'OWNER_INVITED',
    minCapacity: 2,
    maxCapacity: 8,
    seatLease: 'REQUIRED',
    initialGate: { priority: 'P1', enabled: false },
  },
  {
    type: 'CHECKIN_GOAL_GROUP',
    visibility: 'INVITE_ONLY',
    membership: 'OWNER_INVITED',
    minCapacity: 3,
    maxCapacity: 10,
    seatLease: 'PROHIBITED',
    initialGate: { priority: 'P1', enabled: false },
  },
];

const EXPECTED_GAME_CATALOG = {
  phase1EnabledModes: ['SENTENCE_TRAIN'],
  phase1DefaultDisabledModes: [
    'WORD_MATCH',
    'WORD_DEFENSE',
    'WORD_PUZZLE',
    'GRAMMAR_BLASTER',
    'CATCH_MEANING',
  ],
  catalogEntries: [
    { gameCode: 'SENTENCE_TRAIN', releasePhase: 'P0', enabled: true },
    { gameCode: 'WORD_MATCH', releasePhase: 'P1', enabled: false },
    { gameCode: 'WORD_DEFENSE', releasePhase: 'P1', enabled: false },
    { gameCode: 'WORD_PUZZLE', releasePhase: 'P1', enabled: false },
    { gameCode: 'GRAMMAR_BLASTER', releasePhase: 'LONG_TERM', enabled: false },
    { gameCode: 'CATCH_MEANING', releasePhase: 'LONG_TERM', enabled: false },
  ],
  sentenceTrainRequirement: 'P0_ONLY_SERVER_GATED_CATALOG_ENTRY',
  clientMayEnableMode: false,
};

const EXPECTED_FOCUS_CREDIT_POLICY = {
  policyVersion: 'P1_FOCUS_CREDIT_V1',
  creditedMetric: 'FOCUS_MINUTES',
  qualifiedState: 'COMPLETED',
  creditedMinutesSource: 'durationMinutes',
  completionCondition: 'SERVER_TIME_AT_OR_AFTER_ENDS_AT_WITH_ACTIVE_LEASE_AND_MATCHING_FOCUS_VERSION',
  nonQualifiedStates: ['FOCUSING', 'PAUSED', 'ABORTED', 'AUTO_RELEASED'],
  nonQualifiedCreditMinutes: 0,
  clientFinishActionIsProof: false,
  clientHeartbeatAuthority: 'NONE',
  offlineSuccessAuthority: 'NONE',
  rewardTrigger: 'PROHIBITED',
};

const EXPECTED_LEADERBOARD_POLICY = {
  owner: 'social-service',
  sourceFacts: 'SERVER_SETTLED_ONLY',
  clientMaySetScore: false,
  snapshotRequired: true,
  snapshotFields: [
    'metric',
    'period',
    'timezoneId',
    'projectionVersion',
    'ruleVersion',
    'tieBreakVersion',
    'snapshotAt',
    'watermark',
    'auditRef',
  ],
  metricSources: [
    {
      metric: 'FOCUS_MINUTES',
      sourceKind: 'OWNER_LOCAL_SETTLED_FACT',
      owner: 'social-service',
      factSchema: 'M1014FocusSession',
      qualificationPolicy: 'P1_FOCUS_CREDIT_V1',
    },
    {
      metric: 'MASTERED_WORDS',
      sourceKind: 'CANONICAL_EVENT',
      producerService: 'learning-service',
      eventName: 'learning.mastery.projected.v2',
      consumerGroup: 'cg.social-from-learning.v1',
      projectionSchema: 'M1014LeaderboardMasteryFact',
    },
    {
      metric: 'XP',
      sourceKind: 'CANONICAL_EVENT',
      producerService: 'gamification-service',
      eventName: 'gamification.xp.ledger_posted.v2',
      consumerGroup: 'cg.social-from-gamification.v1',
      projectionSchema: 'M1014LeaderboardXpFact',
    },
  ],
  privacyModes: ['NICKNAME', 'ANONYMOUS', 'OPT_OUT'],
  defaultTimezone: 'Asia/Shanghai',
};

const EXPECTED_TRUSTED_SOCIAL_BINDINGS = [
  {
    producerService: 'learning-service',
    eventName: 'learning.mastery.projected.v2',
    schemaVersion: 'v2',
    consumerGroup: 'cg.social-from-learning.v1',
    metric: 'MASTERED_WORDS',
  },
  {
    producerService: 'gamification-service',
    eventName: 'gamification.xp.ledger_posted.v2',
    schemaVersion: 'v2',
    consumerGroup: 'cg.social-from-gamification.v1',
    metric: 'XP',
  },
];

const EXPECTED_TRUSTED_TUPLE_FIELDS = [
  'producerService',
  'eventName',
  'schemaVersion',
  'qualifiedPredicate',
  'rewardRuleVersion',
];

const EXPECTED_COMMON_LINEAGE_FIELDS = [
  'eventId',
  'traceId',
  'schemaVersion',
  'contentPin',
];

const EXPECTED_DERIVED_FIELD_MAPPINGS = {
  rewardRuleVersion: {
    kind: 'SERVER_SELECTED_GAMIFICATION_RULE_VERSION',
    owner: 'gamification-service',
    clientSupplied: false,
  },
};

const EXPECTED_APPROVED_SOURCE_FILES = [
  'packages/contracts/fragments/b12/b12-gamification-social-notification.openapi.json',
  'packages/contracts/events/v1/fragments/m1-014-gamification-social-v2.events.json',
  'packages/contracts/events/v1/catalog.json',
  'packages/contracts/events/v1/reliability-policy.json',
  'config/b26-event-runtime.json',
  'config/p1r-learning-loop-contract.v1.json',
  'config/p1r-gamification-social-contract.v1.json',
];

const CANONICAL_CURSOR_PAGINATION = {
  mode: 'cursor',
  cursorParameter: '#/components/parameters/Cursor',
  pageSizeParameter: '#/components/parameters/PageSize',
  responseMeta: '#/components/schemas/ApiCursorPageMeta',
};

const EXPECTED_AUTHORITY_BOUNDARY = {
  phase1Population: 'ADULT_18_PLUS_ONLY',
  principalAndTenant: 'SERVER_DERIVED_FROM_VERIFIED_TOKEN',
  gatewayIsNotDomainWriter: true,
  domainServicePepRequired: true,
  clientMayProduceKafkaFacts: false,
  clientMaySet: [],
  serverDerivedFields: [
    'principalId',
    'tenantId',
    'rewardAmount',
    'rewardRuleVersion',
    'probabilityVersion',
    'ledgerEntryId',
    'leaderboardScore',
    'reporterId',
  ],
  opaqueServerIssuedReferenceFields: ['leaseId'],
  forbiddenClientAuthorityFields: [
    'principalId',
    'tenantId',
    'ownerId',
    'rewardAmount',
    'rewardRuleVersion',
    'probabilityVersion',
    'ledgerEntryId',
    'leaderboardScore',
    'reporterId',
    'role',
    'permission',
  ],
};

// Update this only in the same reviewed change as the policy. It intentionally
// makes every omitted, added, or semantically altered policy field fail closed.
export const FROZEN_POLICY_SHA256 = 'b4860e3aad81f207fb2a2ff51be2b86ca1f1bdb01123d0d600f921a9846f46cb';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map((entry) => canonicalize(entry));
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new TypeError('non-finite number is not valid contract JSON');
  }
  return value;
}

export function policyDigest(policy) {
  return createHash('sha256').update(JSON.stringify(canonicalize(policy))).digest('hex');
}

function sameJson(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function addError(errors, condition, message) {
  if (!condition) errors.push(message);
}

function assertKnownKeys(errors, value, allowed, label) {
  if (!isPlainObject(value)) {
    errors.push(`${label} must be an object`);
    return false;
  }
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  const missing = allowed.filter((key) => !Object.hasOwn(value, key));
  if (unknown.length > 0) errors.push(`${label} contains unknown field(s): ${unknown.join(', ')}`);
  if (missing.length > 0) errors.push(`${label} is missing required field(s): ${missing.join(', ')}`);
  return unknown.length === 0 && missing.length === 0;
}

function assertExactObject(errors, value, expected, label) {
  const keys = Object.keys(expected);
  if (!assertKnownKeys(errors, value, keys, label)) return;
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (!sameJson(value[key], expectedValue)) {
      errors.push(`${label}.${key} must equal the frozen contract value`);
    }
  }
}

function profileById(policy, id) {
  return policy?.trustedCompletion?.sourceProfiles?.find((profile) => profile?.id === id);
}

function trustedCompletionWirePredicate(profile) {
  if (profile?.id === 'MASTERY_MILESTONE') {
    return {
      masteryStageAfter: profile.qualifiedPredicate.masteryStageAfter[0],
      d7Gate: structuredClone(profile.qualifiedPredicate.d7Gate),
      stateTransition: true,
    };
  }
  return structuredClone(profile?.qualifiedPredicate);
}

function boundedString(value, minimum = 1, maximum = 128) {
  return typeof value === 'string' && value.length >= minimum && value.length <= maximum;
}

function sha256String(value) {
  return typeof value === 'string' && /^[A-Fa-f0-9]{64}$/.test(value);
}

function assertContentPin(errors, contentPin, label) {
  if (!assertKnownKeys(errors, contentPin,
    ['contentVersionId', 'contentEpoch', 'snapshotId', 'snapshotHash'], label)) return;
  addError(errors, Number.isSafeInteger(contentPin.contentVersionId) && contentPin.contentVersionId >= 1,
    `${label}.contentVersionId must be a positive integer`);
  addError(errors, Number.isSafeInteger(contentPin.contentEpoch) && contentPin.contentEpoch >= 0,
    `${label}.contentEpoch must be a non-negative integer`);
  addError(errors, boundedString(contentPin.snapshotId), `${label}.snapshotId must be a bounded non-empty string`);
  addError(errors, sha256String(contentPin.snapshotHash), `${label}.snapshotHash must be a SHA-256 digest`);
}

function assertPinnedObject(errors, value, fields, label) {
  if (!assertKnownKeys(errors, value, fields, label)) return;
  for (const field of fields) {
    const isDigest = /Digest$/.test(field);
    addError(errors, isDigest ? sha256String(value[field]) : boundedString(value[field], 1, 96),
      `${label}.${field} must be ${isDigest ? 'a SHA-256 digest' : 'a bounded non-empty string'}`);
  }
}

function assertArrayEquals(errors, value, expected, label) {
  if (!sameJson(value, expected)) errors.push(`${label} must equal the frozen ordered value`);
}

function assertTrustedCompletionOpenApiProjection(errors, policy, canonicalOpenApi) {
  const schema = canonicalOpenApi?.components?.schemas?.M1014TrustedCompletion;
  if (!isPlainObject(schema)) {
    errors.push('canonical OpenAPI must define M1014TrustedCompletion');
    return;
  }

  const rootFields = [...policy.trustedCompletion.tupleFields, 'lineage'];
  assertArrayEquals(errors, schema.required, rootFields, 'M1014TrustedCompletion.required');
  addError(errors, schema.additionalProperties === false,
    'M1014TrustedCompletion must reject unknown fields');
  assertKnownKeys(errors, schema.properties, rootFields, 'M1014TrustedCompletion.properties');
  assertArrayEquals(errors, schema.properties?.producerService?.enum,
    [...new Set(policy.trustedCompletion.sourceProfiles.map((profile) => profile.producerService))],
    'M1014TrustedCompletion.producerService.enum');
  assertArrayEquals(errors, schema.properties?.eventName?.enum,
    policy.trustedCompletion.sourceProfiles.map((profile) => profile.eventName),
    'M1014TrustedCompletion.eventName.enum');
  addError(errors, schema.properties?.schemaVersion?.const === 'v2',
    'M1014TrustedCompletion.schemaVersion must remain v2');

  const couplings = schema.oneOf;
  const predicateBranches = schema.properties?.qualifiedPredicate?.oneOf;
  const lineageBranches = schema.properties?.lineage?.oneOf;
  addError(errors, Array.isArray(couplings) && couplings.length === 3,
    'M1014TrustedCompletion must bind exactly three trusted source profiles');
  addError(errors, Array.isArray(predicateBranches) && predicateBranches.length === 3,
    'M1014TrustedCompletion qualifiedPredicate must expose exactly three closed variants');
  addError(errors, Array.isArray(lineageBranches) && lineageBranches.length === 3,
    'M1014TrustedCompletion lineage must expose exactly three closed variants');
  if (!Array.isArray(couplings) || !Array.isArray(predicateBranches) || !Array.isArray(lineageBranches)) return;

  policy.trustedCompletion.sourceProfiles.forEach((profile, index) => {
    if (!isPlainObject(profile) || !isPlainObject(profile.qualifiedPredicate) || !Array.isArray(profile.lineageFields)) {
      errors.push(`M1014TrustedCompletion source profile at index ${index} is not a complete frozen profile`);
      return;
    }
    const coupling = couplings[index];
    const predicateBranch = predicateBranches[index];
    const lineageBranch = lineageBranches[index];
    const predicateFields = Object.keys(profile.qualifiedPredicate);
    const label = `M1014TrustedCompletion.${profile.id}`;
    addError(errors, isPlainObject(coupling), `${label} coupling must be an object`);
    if (isPlainObject(coupling)) {
      assertArrayEquals(errors, coupling.required, rootFields, `${label}.required`);
      assertKnownKeys(errors, coupling.properties,
        ['producerService', 'eventName', 'schemaVersion', 'qualifiedPredicate', 'lineage'],
        `${label}.properties`);
      addError(errors, coupling.properties?.producerService?.const === profile.producerService,
        `${label} producerService must be ${profile.producerService}`);
      addError(errors, coupling.properties?.eventName?.const === profile.eventName,
        `${label} eventName must be ${profile.eventName}`);
      addError(errors, coupling.properties?.schemaVersion?.const === profile.schemaVersion,
        `${label} schemaVersion must be ${profile.schemaVersion}`);
      addError(errors, coupling.properties?.qualifiedPredicate?.additionalProperties === false,
        `${label} qualifiedPredicate coupling must reject unknown fields`);
      assertArrayEquals(errors, coupling.properties?.qualifiedPredicate?.required,
        predicateFields, `${label}.qualifiedPredicate.required`);
      assertKnownKeys(errors, coupling.properties?.qualifiedPredicate?.properties,
        predicateFields, `${label}.qualifiedPredicate.properties`);
      addError(errors, coupling.properties?.lineage?.additionalProperties === false,
        `${label} lineage coupling must reject unknown fields`);
      assertArrayEquals(errors, coupling.properties?.lineage?.required,
        profile.lineageFields, `${label}.lineage.required`);
      assertKnownKeys(errors, coupling.properties?.lineage?.properties,
        profile.lineageFields, `${label}.lineage.properties`);
      const forbiddenDigest = profile.id === 'MASTERY_MILESTONE' ? 'outcomeDigest' : 'evidenceDigest';
      assertExactObject(errors, coupling.properties?.lineage?.not,
        { required: [forbiddenDigest] }, `${label}.lineage.not`);
    }
    addError(errors, predicateBranch?.additionalProperties === false,
      `${label} predicate variant must reject unknown fields`);
    assertArrayEquals(errors, predicateBranch?.required, predicateFields,
      `${label}.predicateVariant.required`);
    assertKnownKeys(errors, predicateBranch?.properties, predicateFields,
      `${label}.predicateVariant.properties`);
    if (profile.id === 'TASK_COMPLETED') {
      assertExactObject(errors, predicateBranch?.properties?.taskStatus,
        { type: 'string', const: 'COMPLETED' }, `${label}.predicateVariant.taskStatus`);
      assertExactObject(errors, predicateBranch?.properties?.completionFact,
        { type: 'string', const: 'SERVER_SETTLED' }, `${label}.predicateVariant.completionFact`);
    } else if (profile.id === 'ASSESSMENT_ITEM_CORRECT') {
      assertExactObject(errors, predicateBranch?.properties?.objectiveOutcome,
        { type: 'string', const: 'CORRECT_VERIFIED' }, `${label}.predicateVariant.objectiveOutcome`);
      assertExactObject(errors, predicateBranch?.properties?.objectiveCorrect,
        { type: 'boolean', const: true }, `${label}.predicateVariant.objectiveCorrect`);
      assertExactObject(errors, predicateBranch?.properties?.guessSignal,
        { type: 'boolean', const: false }, `${label}.predicateVariant.guessSignal`);
    } else if (profile.id === 'MASTERY_MILESTONE') {
      assertExactObject(errors, predicateBranch?.properties?.masteryStageAfter,
        { type: 'string', enum: ['MASTERED', 'CONSOLIDATED'] }, `${label}.predicateVariant.masteryStageAfter`);
      assertExactObject(errors, predicateBranch?.properties?.d7Gate, {
        type: 'object',
        additionalProperties: false,
        required: ['result', 'reasonCode'],
        properties: {
          result: { type: 'string', const: 'PASSED' },
          reasonCode: { type: 'string', const: 'D7_PASSED' },
        },
      }, `${label}.predicateVariant.d7Gate`);
      assertExactObject(errors, predicateBranch?.properties?.stateTransition,
        { type: 'boolean', const: true }, `${label}.predicateVariant.stateTransition`);
    }
    addError(errors, lineageBranch?.additionalProperties === false,
      `${label} lineage variant must reject unknown fields`);
    assertArrayEquals(errors, lineageBranch?.required, profile.lineageFields,
      `${label}.lineageVariant.required`);
    assertKnownKeys(errors, lineageBranch?.properties, profile.lineageFields,
      `${label}.lineageVariant.properties`);
  });
}

function assertGameCatalogOpenApiProjection(errors, policy, canonicalOpenApi) {
  const schemas = canonicalOpenApi?.components?.schemas;
  const catalog = schemas?.M1014GameCatalog;
  const item = schemas?.M1014GameCatalogItem;
  const request = schemas?.M1014GameSessionCreateRequest;
  const session = schemas?.M1014GameSession;
  for (const [name, schema] of Object.entries({ catalog, item, request, session })) {
    addError(errors, isPlainObject(schema), `M1-014 OpenAPI must define the ${name} game schema`);
  }
  if (![catalog, item, request, session].every(isPlainObject)) return;

  const entries = policy.gameCatalog.catalogEntries;
  const codes = entries.map((entry) => entry.gameCode);
  assertExactObject(errors, catalog.properties?.items, {
    type: 'array',
    minItems: 0,
    maxItems: entries.length,
    uniqueItems: true,
    'x-unique-by': 'gameCode',
    items: { $ref: '#/components/schemas/M1014GameCatalogItem' },
  }, 'M1014GameCatalog.items');
  addError(errors, catalog.properties?.policyVersion?.const === 'P1_GAME_CATALOG_V1',
    'M1014GameCatalog.policyVersion must be P1_GAME_CATALOG_V1');
  assertArrayEquals(errors, item.properties?.gameCode?.enum, codes,
    'M1014GameCatalogItem.gameCode.enum');
  addError(errors, Array.isArray(item.oneOf) && item.oneOf.length === entries.length,
    'M1014GameCatalogItem must define exactly one closed branch per frozen catalog entry');
  if (Array.isArray(item.oneOf)) {
    entries.forEach((entry, index) => {
      const branch = item.oneOf[index];
      assertArrayEquals(errors, branch?.required, ['gameCode', 'releasePhase', 'enabled'],
        `M1014GameCatalogItem.oneOf[${index}].required`);
      addError(errors, branch?.properties?.gameCode?.const === entry.gameCode,
        `M1014GameCatalogItem.oneOf[${index}] gameCode must be ${entry.gameCode}`);
      addError(errors, branch?.properties?.releasePhase?.const === entry.releasePhase,
        `M1014GameCatalogItem.oneOf[${index}] releasePhase must be ${entry.releasePhase}`);
      addError(errors, branch?.properties?.enabled?.const === entry.enabled,
        `M1014GameCatalogItem.oneOf[${index}] enabled must be ${entry.enabled}`);
    });
  }
  assertExactObject(errors, request.properties?.gameCode,
    { type: 'string', const: 'SENTENCE_TRAIN' },
    'M1014GameSessionCreateRequest.gameCode');
  assertExactObject(errors, session.properties?.gameCode,
    { type: 'string', const: 'SENTENCE_TRAIN' },
    'M1014GameSession.gameCode');
  assertExactObject(errors, item['x-game-catalog'], {
    owner: 'gamification-service',
    phase1EnabledModes: ['SENTENCE_TRAIN'],
    unknownModeDecision: 'DENY',
    disabledModeDecision: 'GAME_NOT_AVAILABLE',
    clientMayEnableMode: false,
  }, 'M1014GameCatalogItem.x-game-catalog');
}

function assertCanonicalCursorPageOperation(errors, canonicalOpenApi, {
  path: routePath,
  operationId,
  dataSchema,
}) {
  const operation = canonicalOpenApi?.paths?.[routePath]?.get;
  const label = `GET ${routePath}`;
  if (!isPlainObject(operation)) {
    errors.push(`${label} must define its canonical list operation`);
    return;
  }
  addError(errors, operation.operationId === operationId,
    `${label} operationId must be ${operationId}`);
  assertArrayEquals(errors, operation.parameters, [
    { $ref: '#/components/parameters/Cursor' },
    { $ref: '#/components/parameters/PageSize' },
  ], `${label}.parameters`);
  assertExactObject(errors, operation['x-pagination'], CANONICAL_CURSOR_PAGINATION,
    `${label}.x-pagination`);
  const responseSchema = operation.responses?.['200']?.content?.['application/json']?.schema;
  assertArrayEquals(errors, responseSchema?.allOf, [
    { $ref: '#/components/schemas/ApiCursorPageEnvelope' },
    {
      type: 'object',
      required: ['data'],
      properties: {
        data: { $ref: `#/components/schemas/${dataSchema}` },
      },
    },
  ], `${label}.responses.200.cursorPageEnvelope`);
}

function assertM1014CursorPaginationProjection(errors, canonicalOpenApi) {
  assertCanonicalCursorPageOperation(errors, canonicalOpenApi, {
    path: '/api/v1/games/catalog',
    operationId: 'listM1014GameCatalog',
    dataSchema: 'M1014GameCatalog',
  });
  assertCanonicalCursorPageOperation(errors, canonicalOpenApi, {
    path: '/api/v1/social/rooms',
    operationId: 'listM1014StudyRooms',
    dataSchema: 'M1014RoomPage',
  });

  const parameters = canonicalOpenApi?.components?.parameters ?? {};
  addError(errors, !Object.hasOwn(parameters, 'M1014Cursor') && !Object.hasOwn(parameters, 'M1014PageSize'),
    'M1-014 list operations must not retain custom cursor/page-size parameter aliases');

  const schemas = canonicalOpenApi?.components?.schemas ?? {};
  const cursorStateNames = ['cursor', 'nextCursor', 'previousCursor', 'page', 'pageSize', 'limit', 'offset', 'totalPages'];
  for (const [name, schema] of Object.entries({
    M1014GameCatalog: schemas.M1014GameCatalog,
    M1014RoomPage: schemas.M1014RoomPage,
  })) {
    for (const field of cursorStateNames) {
      addError(errors, !Object.hasOwn(schema?.properties ?? {}, field),
        `${name} must keep ${field} exclusively in ApiCursorPageMeta`);
    }
  }
}

function assertFocusAndLeaderboardOpenApiProjection(errors, policy, canonicalOpenApi) {
  const schemas = canonicalOpenApi?.components?.schemas;
  const start = schemas?.M1014FocusCommand;
  const update = schemas?.M1014FocusUpdateCommand;
  const session = schemas?.M1014FocusSession;
  const leaderboard = schemas?.M1014Leaderboard;
  for (const [name, schema] of Object.entries({ start, update, session, leaderboard })) {
    addError(errors, isPlainObject(schema), `M1-014 OpenAPI must define the ${name} focus/leaderboard schema`);
  }
  if (![start, update, session, leaderboard].every(isPlainObject)) return;

  assertArrayEquals(errors, update.required, ['focusId', 'expectedFocusVersion', 'action'],
    'M1014FocusUpdateCommand.required');
  assertExactObject(errors, update.properties?.expectedFocusVersion,
    { type: 'integer', minimum: 1 }, 'M1014FocusUpdateCommand.expectedFocusVersion');
  for (const field of [
    'elapsedSeconds', 'completedAt', 'heartbeat', 'clientDurationMinutes', 'offlineSuccess',
    'focusMinutes', 'score', 'rewardAmount',
  ]) {
    addError(errors, update['x-forbidden-client-fields']?.includes(field),
      `M1014FocusUpdateCommand must forbid client field ${field}`);
  }
  for (const field of [
    'elapsedSeconds', 'heartbeat', 'clientDurationMinutes', 'offlineSuccess',
    'focusMinutes', 'score', 'rewardAmount',
  ]) {
    addError(errors, start['x-forbidden-client-fields']?.includes(field),
      `M1014FocusCommand must forbid client field ${field}`);
  }

  const focusRequired = [
    'focusId', 'roomId', 'seatId', 'leaseId', 'leaseVersion', 'focusVersion', 'state',
    'durationMinutes', 'creditedMinutes', 'startedAt', 'endsAt', 'serverTime',
  ];
  assertArrayEquals(errors, session.required, focusRequired, 'M1014FocusSession.required');
  assertExactObject(errors, session.properties?.focusVersion,
    { type: 'integer', minimum: 1 }, 'M1014FocusSession.focusVersion');
  assertExactObject(errors, session.properties?.creditedMinutes,
    { type: 'integer', enum: [0, 25, 45] }, 'M1014FocusSession.creditedMinutes');
  assertArrayEquals(errors, session['x-p1r-cross-field-invariants'], [
    'state=COMPLETED => creditedMinutes=durationMinutes',
    'state!=COMPLETED => creditedMinutes=0',
  ], 'M1014FocusSession.x-p1r-cross-field-invariants');
  assertExactObject(errors, session['x-focus-credit-policy'], EXPECTED_FOCUS_CREDIT_POLICY,
    'M1014FocusSession.x-focus-credit-policy');
  assertArrayEquals(errors, session.oneOf, [
    {
      title: 'Server-qualified completed focus',
      required: ['state', 'creditedMinutes'],
      properties: {
        state: { const: 'COMPLETED' },
        creditedMinutes: { enum: [25, 45] },
      },
    },
    {
      title: 'Non-qualified focus state',
      required: ['state', 'creditedMinutes'],
      properties: {
        state: { enum: ['FOCUSING', 'PAUSED', 'ABORTED', 'AUTO_RELEASED'] },
        creditedMinutes: { const: 0 },
      },
    },
  ], 'M1014FocusSession.oneOf');

  const leaderboardRequired = [
    'snapshotId', 'metric', 'period', 'timezoneId', 'projectionVersion', 'ruleVersion',
    'tieBreakVersion', 'snapshotAt', 'watermark', 'auditRef', 'entries', 'me', 'delayed',
  ];
  assertArrayEquals(errors, leaderboard.required, leaderboardRequired, 'M1014Leaderboard.required');
  assertExactObject(errors, leaderboard.properties?.projectionVersion,
    { type: 'integer', minimum: 1 }, 'M1014Leaderboard.projectionVersion');
  assertExactObject(errors, leaderboard.properties?.tieBreakVersion,
    { type: 'string', minLength: 1, maxLength: 96 }, 'M1014Leaderboard.tieBreakVersion');
  assertExactObject(errors, leaderboard['x-leaderboard-policy'], {
    sourceFacts: policy.leaderboard.sourceFacts,
    clientMaySetScore: policy.leaderboard.clientMaySetScore,
    snapshotRequired: policy.leaderboard.snapshotRequired,
    projectionVersionRequired: true,
    tieBreakVersionRequired: true,
    metricSources: policy.leaderboard.metricSources,
    privacyModes: policy.leaderboard.privacyModes,
    defaultTimezone: policy.leaderboard.defaultTimezone,
  }, 'M1014Leaderboard.x-leaderboard-policy');
}

function assertTrustedSocialOpenApiProjection(errors, canonicalOpenApi) {
  const schemas = canonicalOpenApi?.components?.schemas;
  const event = schemas?.M1014TrustedSocialEvent;
  const mastery = schemas?.M1014LeaderboardMasteryFact;
  const xp = schemas?.M1014LeaderboardXpFact;
  for (const [name, schema] of Object.entries({ event, mastery, xp })) {
    addError(errors, isPlainObject(schema), `M1-014 OpenAPI must define ${name}`);
  }
  if (![event, mastery, xp].every(isPlainObject)) return;

  const envelopeFields = [
    'eventId', 'eventName', 'schemaVersion', 'aggregateId', 'occurredAt', 'actorId',
    'traceId', 'requestId', 'dedupeKey', 'sourceService', 'payload',
  ];
  assertArrayEquals(errors, event.required, envelopeFields, 'M1014TrustedSocialEvent.required');
  assertKnownKeys(errors, event.properties, envelopeFields, 'M1014TrustedSocialEvent.properties');
  assertExactObject(errors, event.properties?.eventName, {
    type: 'string', enum: ['learning.mastery.projected.v2', 'gamification.xp.ledger_posted.v2'],
  }, 'M1014TrustedSocialEvent.eventName');
  assertExactObject(errors, event.properties?.sourceService, {
    type: 'string', enum: ['learning-service', 'gamification-service'],
  }, 'M1014TrustedSocialEvent.sourceService');
  assertExactObject(errors, event.properties?.payload, {
    oneOf: [
      { $ref: '#/components/schemas/M1014LeaderboardMasteryFact' },
      { $ref: '#/components/schemas/M1014LeaderboardXpFact' },
    ],
  }, 'M1014TrustedSocialEvent.payload');
  const expectedBranches = EXPECTED_TRUSTED_SOCIAL_BINDINGS.map((binding) => ({
    title: binding.metric === 'MASTERED_WORDS' ? 'Mastered word leaderboard fact' : 'XP leaderboard fact',
    required: ['sourceService', 'eventName', 'schemaVersion', 'payload'],
    properties: {
      sourceService: { const: binding.producerService },
      eventName: { const: binding.eventName },
      schemaVersion: { const: binding.schemaVersion },
      payload: {
        $ref: binding.metric === 'MASTERED_WORDS'
          ? '#/components/schemas/M1014LeaderboardMasteryFact'
          : '#/components/schemas/M1014LeaderboardXpFact',
      },
    },
  }));
  assertArrayEquals(errors, event.oneOf, expectedBranches, 'M1014TrustedSocialEvent.oneOf');
  assertArrayEquals(errors, event['x-p1r-cross-field-invariants'], [
    'sourceService=MUST_EQUAL_VERIFIED_WORKLOAD_IDENTITY_SERVICE',
    'actorId=MUST_EQUAL_PAYLOAD_PRINCIPAL_ID',
    'eventName=learning.mastery.projected.v2 => sourceService=learning-service AND aggregateId=payload.projectionId',
    'eventName=gamification.xp.ledger_posted.v2 => sourceService=gamification-service AND aggregateId=payload.ledgerEntryId',
  ], 'M1014TrustedSocialEvent.x-p1r-cross-field-invariants');
  assertExactObject(errors, event['x-trusted-event-boundary'], {
    transport: 'KAFKA_COMPATIBLE_OUTBOX_ONLY',
    clientMayProduce: false,
    sourceServiceBinding: 'MUST_EQUAL_VERIFIED_WORKLOAD_IDENTITY_SERVICE',
    unknownEventDecision: 'DENY',
    unknownFieldDecision: 'DENY',
    acceptedBindings: EXPECTED_TRUSTED_SOCIAL_BINDINGS,
  }, 'M1014TrustedSocialEvent.x-trusted-event-boundary');
  const operation = canonicalOpenApi?.paths?.['/internal/v1/social/trusted-events']?.post;
  assertArrayEquals(errors, operation?.['x-authorization']?.trustedFacts, [
    'workloadIdentity', 'sourceService', 'eventName', 'schemaVersion', 'aggregateId',
    'payloadTenant', 'payloadPrincipal', 'lineage', 'policyVersion',
  ], 'consumeM1014SocialTrustedEvent.x-authorization.trustedFacts');

  const masteryFields = [
    'tenantId', 'principalId', 'projectionId', 'logicalItemId', 'masteryEpochId',
    'masteryEpochVersion', 'projectionVersion', 'masteryStageBefore', 'masteryStageAfter',
    'evidenceDigest', 'masteryRuleVersion', 'masteryFactWatermark', 'projectedAt',
  ];
  assertArrayEquals(errors, mastery.required, masteryFields, 'M1014LeaderboardMasteryFact.required');
  assertKnownKeys(errors, mastery.properties, masteryFields, 'M1014LeaderboardMasteryFact.properties');
  assertArrayEquals(errors, mastery['x-server-derived'], masteryFields,
    'M1014LeaderboardMasteryFact.x-server-derived');
  addError(errors, mastery.additionalProperties === false,
    'M1014LeaderboardMasteryFact must reject unknown fields');
  assertExactObject(errors, mastery.properties?.masteryStageBefore,
    { type: 'string', enum: ['NEW', 'LEARNING'] }, 'M1014LeaderboardMasteryFact.masteryStageBefore');
  assertExactObject(errors, mastery.properties?.masteryStageAfter,
    { type: 'string', const: 'MASTERED' }, 'M1014LeaderboardMasteryFact.masteryStageAfter');
  assertExactObject(errors, mastery['x-source-event'], {
    producerService: 'learning-service',
    eventName: 'learning.mastery.projected.v2',
    consumerGroup: 'cg.social-from-learning.v1',
    qualification: 'FIRST_TRANSITION_TO_MASTERED_ONLY',
  }, 'M1014LeaderboardMasteryFact.x-source-event');

  const xpFields = [
    'ledgerEntryId', 'principalId', 'tenantId', 'entryType', 'amount', 'currency',
    'tupleKey', 'dedupeKey', 'lineageDigest', 'rewardRuleVersion', 'sourceEventId',
    'sourceEventName', 'createdAt', 'auditRef',
  ];
  assertArrayEquals(errors, xp.required, xpFields, 'M1014LeaderboardXpFact.required');
  assertKnownKeys(errors, xp.properties, xpFields, 'M1014LeaderboardXpFact.properties');
  assertArrayEquals(errors, xp['x-server-derived'], xpFields,
    'M1014LeaderboardXpFact.x-server-derived');
  addError(errors, xp.additionalProperties === false, 'M1014LeaderboardXpFact must reject unknown fields');
  assertExactObject(errors, xp.properties?.currency,
    { type: 'string', const: 'NON_CASH_PLATFORM_CREDIT' }, 'M1014LeaderboardXpFact.currency');
  assertExactObject(errors, xp['x-source-event'], {
    producerService: 'gamification-service',
    eventName: 'gamification.xp.ledger_posted.v2',
    consumerGroup: 'cg.social-from-gamification.v1',
    qualification: 'APPEND_ONLY_LEDGER_ENTRY_WITH_ENTRY_TYPE_SIGN',
  }, 'M1014LeaderboardXpFact.x-source-event');
}

function assertCorePolicy(errors, policy) {
  if (!assertKnownKeys(errors, policy, ROOT_KEYS, 'policy')) return;

  const rootExact = {
    $schema: 'p1r.gamification-social-contract.v1',
    schemaVersion: 'p1r.gamification-social-contract.v1',
    task: 'P1R-M1-014',
    phase: 'P1',
    sourceBaseline: 'e3514c359e6f6be5445cf46a7734325b2835b941',
    maturity: 'D2_CONTRACT_READY',
    runtimeStatus: 'NOT_RUNTIME_VERIFIED',
  };
  for (const [key, value] of Object.entries(rootExact)) {
    addError(errors, policy[key] === value, `policy.${key} must be ${JSON.stringify(value)}`);
  }

  assertExactObject(errors, policy.collectionPolicy, REQUIRED_COLLECTION_POLICY, 'collectionPolicy');
  assertExactObject(errors, policy.authority, EXPECTED_AUTHORITY_BOUNDARY, 'authority');
  assertExactObject(errors, policy.canonicalSources, {
    productRequirements: 'requirements/product-requirements.md',
    featureMatrix: 'requirements/feature-matrix.md',
    phase1GrowthSocialDesign: 'docs/06-design/v2-980plus/04-Phase1-成长社群商业后台功能设计.md',
    v2980Registry: 'docs/06-design/v2-980plus/08-980plus-功能点设计登记册.md',
    fullCoverageDesign: 'docs/06-design/phase-1/full-coverage/成长社群商业后台原子功能补充设计.md',
    socialDetailedDesign: 'docs/06-design/detailed-specs/07_自习室社群与用户基础服务详细设计.md',
    m1014OpenApiFragment: 'packages/contracts/fragments/b12/b12-gamification-social-notification.openapi.json',
    m1014EventFragment: 'packages/contracts/events/v1/fragments/m1-014-gamification-social-v2.events.json',
    eventCatalog: 'packages/contracts/events/v1/catalog.json',
    eventReliabilityPolicy: 'packages/contracts/events/v1/reliability-policy.json',
    b26RuntimeContract: 'config/b26-event-runtime.json',
  }, 'canonicalSources');
  assertExactObject(errors, policy.compatibilityPromotion, {
    ...REQUIRED_COMPATIBILITY_PROMOTION,
    approvedSourceFiles: policy.compatibilityPromotion?.approvedSourceFiles,
    canonicalRoutes: policy.compatibilityPromotion?.canonicalRoutes,
    approvedCanonicalEvents: policy.compatibilityPromotion?.approvedCanonicalEvents,
    legacyAdapters: policy.compatibilityPromotion?.legacyAdapters,
    historicalOnlySources: policy.compatibilityPromotion?.historicalOnlySources,
    prohibitedRuntimeClaims: policy.compatibilityPromotion?.prohibitedRuntimeClaims,
    b26StaticPolicy: policy.compatibilityPromotion?.b26StaticPolicy,
  }, 'compatibilityPromotion');

  assertArrayEquals(errors, policy.compatibilityPromotion?.approvedSourceFiles, EXPECTED_APPROVED_SOURCE_FILES,
    'compatibilityPromotion.approvedSourceFiles');

  addError(errors, Array.isArray(policy.compatibilityPromotion?.canonicalRoutes)
    && policy.compatibilityPromotion.canonicalRoutes.length === 28,
  'compatibilityPromotion.canonicalRoutes must contain the exact 28 M1-014 canonical routes');
  addError(errors, Array.isArray(policy.compatibilityPromotion?.approvedCanonicalEvents)
    && policy.compatibilityPromotion.approvedCanonicalEvents.length === 10,
  'compatibilityPromotion.approvedCanonicalEvents must contain the exact 8 new plus 2 consumer-modified canonical events');
  addError(errors, Array.isArray(policy.compatibilityPromotion?.legacyAdapters)
    && policy.compatibilityPromotion.legacyAdapters.length === 2,
  'compatibilityPromotion.legacyAdapters must contain exact B4 and B12 historical adapters');
  addError(errors, Array.isArray(policy.compatibilityPromotion?.historicalOnlySources)
    && policy.compatibilityPromotion.historicalOnlySources.length === 3,
  'compatibilityPromotion.historicalOnlySources must contain task.v1 plus exact B4/B12 historical sources');
  const staticPolicy = policy.compatibilityPromotion?.b26StaticPolicy;
  assertExactObject(errors, staticPolicy, {
    contract: 'config/b26-event-runtime.json',
    classification: 'STATIC_GOVERNANCE_ONLY',
    runtimeEvidence: 'NOT_RUNTIME_VERIFIED',
    allowsRuntimePromotion: false,
    requiresSeparateRuntimeEvidence: true,
  }, 'compatibilityPromotion.b26StaticPolicy');

  assertExactObject(errors, policy.runtimeBoundary, {
    contractOnly: true,
    runtimeEvidence: 'NOT_RUNTIME_VERIFIED',
    deferredTasks: policy.runtimeBoundary?.deferredTasks,
  }, 'runtimeBoundary');
  addError(errors, Array.isArray(policy.runtimeBoundary?.deferredTasks)
    && policy.runtimeBoundary.deferredTasks.length > 0,
  'runtimeBoundary.deferredTasks must remain an explicit non-empty implementation boundary');

  const completion = policy.trustedCompletion;
  if (isPlainObject(completion)) {
    assertKnownKeys(errors, completion, [
      'tupleFields', 'lineageRequiredFields', 'derivedFieldMappings', 'receiptFields', 'sourceProfiles',
      'rejectedEventNames', 'rejectionReasons', 'rejectedCanonicalEvents',
    ], 'trustedCompletion');
    assertArrayEquals(errors, completion.tupleFields, EXPECTED_TRUSTED_TUPLE_FIELDS, 'trustedCompletion.tupleFields');
    assertArrayEquals(errors, completion.lineageRequiredFields, EXPECTED_COMMON_LINEAGE_FIELDS,
      'trustedCompletion.lineageRequiredFields');
    assertExactObject(errors, completion.derivedFieldMappings, EXPECTED_DERIVED_FIELD_MAPPINGS,
      'trustedCompletion.derivedFieldMappings');
    addError(errors, Array.isArray(completion.sourceProfiles) && completion.sourceProfiles.length === 3,
      'trustedCompletion.sourceProfiles must contain exactly three frozen profiles');
    const profiles = [
      ['TASK_COMPLETED', 'learning-service', 'learning.task.completed.v2', 'v2', 'FUTURE_D2_CONTRACT_ONLY'],
      ['ASSESSMENT_ITEM_CORRECT', 'assessment-service', 'assessment.item.assessed.v2', 'v2', 'CANONICAL_D2_INPUT_ONLY'],
      ['MASTERY_MILESTONE', 'learning-service', 'learning.mastery.projected.v2', 'v2', 'CANONICAL_D2_INPUT_ONLY'],
    ];
    for (const [id, producerService, eventName, schemaVersion, maturity] of profiles) {
      const profile = profileById(policy, id);
      addError(errors, isPlainObject(profile), `trustedCompletion source profile ${id} is required`);
      if (isPlainObject(profile)) {
        assertKnownKeys(errors, profile, [
          'id', 'producerService', 'eventName', 'schemaVersion', 'qualifiedPredicate',
          'lineageFields', 'lineageFieldOrigins', 'dedupeFields', 'dedupeFieldOrigins', 'maturity',
        ], `trustedCompletion.sourceProfiles.${id}`);
        addError(errors, profile.producerService === producerService,
          `trustedCompletion source profile ${id} producerService is not frozen`);
        addError(errors, profile.eventName === eventName,
          `trustedCompletion source profile ${id} eventName is not frozen`);
        addError(errors, profile.schemaVersion === schemaVersion,
          `trustedCompletion source profile ${id} schemaVersion is not frozen`);
        addError(errors, profile.maturity === maturity,
          `trustedCompletion source profile ${id} maturity is not frozen`);
        addError(errors, isPlainObject(profile.qualifiedPredicate),
          `trustedCompletion source profile ${id} requires a qualified predicate object`);
        addError(errors, Array.isArray(profile.lineageFields) && profile.lineageFields.length >= 8,
          `trustedCompletion source profile ${id} requires pinned lineage fields`);
        addError(errors, Array.isArray(profile.dedupeFields) && profile.dedupeFields.includes('rewardRuleVersion'),
          `trustedCompletion source profile ${id} must dedupe by rewardRuleVersion`);
        addError(errors, EXPECTED_COMMON_LINEAGE_FIELDS.every((field) => profile.lineageFields?.includes(field)),
          `trustedCompletion source profile ${id} must include every common lineage field`);
        addError(errors, isPlainObject(profile.lineageFieldOrigins),
          `trustedCompletion source profile ${id} must map each lineage field to an exact source`);
        addError(errors, isPlainObject(profile.dedupeFieldOrigins),
          `trustedCompletion source profile ${id} must map each dedupe field to an exact source`);
      }
    }
    const taskProfile = profileById(policy, 'TASK_COMPLETED');
    if (isPlainObject(taskProfile)) {
      addError(errors, taskProfile.lineageFields?.includes('outcomeDigest')
        && !taskProfile.lineageFields?.includes('evidenceDigest'),
      'TASK_COMPLETED lineage must use outcomeDigest from the current task-completed contract, never evidenceDigest');
    }
    const assessmentProfile = profileById(policy, 'ASSESSMENT_ITEM_CORRECT');
    if (isPlainObject(assessmentProfile)) {
      addError(errors, assessmentProfile.lineageFields?.includes('outcomeDigest')
        && !assessmentProfile.lineageFields?.includes('evidenceDigest'),
      'ASSESSMENT_ITEM_CORRECT lineage must use outcomeDigest, never evidenceDigest');
    }
    const masteryProfile = profileById(policy, 'MASTERY_MILESTONE');
    if (isPlainObject(masteryProfile)) {
      assertExactObject(errors, masteryProfile.qualifiedPredicate, {
        masteryStageAfter: ['MASTERED', 'CONSOLIDATED'],
        d7Gate: { result: 'PASSED', reasonCode: 'D7_PASSED' },
        stateTransition: {
          kind: 'DERIVED_MASTERY_STAGE_CHANGE',
          inputFields: ['masteryStageBefore', 'masteryStageAfter'],
          expression: 'masteryStageBefore != masteryStageAfter',
          clientSupplied: false,
        },
      }, 'trustedCompletion.sourceProfiles.MASTERY_MILESTONE.qualifiedPredicate');
      addError(errors, masteryProfile.lineageFields?.includes('evidenceDigest')
        && masteryProfile.lineageFields?.includes('masteryStageBefore')
        && !masteryProfile.lineageFields?.includes('outcomeDigest'),
      'MASTERY_MILESTONE lineage must use evidenceDigest and masteryStageBefore, never outcomeDigest');
      assertArrayEquals(errors, masteryProfile.dedupeFields,
        ['masteryEpochId', 'projectionVersion', 'rewardRuleVersion'],
        'MASTERY_MILESTONE.dedupeFields');
    }
    addError(errors, completion.rejectedEventNames?.includes('learning.task.completed.v1'),
      'trustedCompletion must reject historical learning.task.completed.v1');
    addError(errors, completion.rejectedEventNames?.includes('learning.review.scheduled.v2'),
      'trustedCompletion must reject learning.review.scheduled.v2 as a queue fact');
    assertArrayEquals(errors, completion.rejectedCanonicalEvents, [{
      eventName: 'learning.review.scheduled.v2',
      producerService: 'learning-service',
      schemaVersion: 'v2',
      classification: 'CANONICAL_D2_QUEUE_FACT_REJECTED_FOR_REWARD',
      reason: 'QUEUE_FACT_NOT_A_COMPLETION',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
    }], 'trustedCompletion.rejectedCanonicalEvents');
  } else {
    errors.push('trustedCompletion must be an object');
  }

  const spaces = policy.socialSpaces;
  if (isPlainObject(spaces)) {
    assertArrayEquals(errors, spaces.spaceTypes, EXPECTED_SPACE_TYPES, 'socialSpaces.spaceTypes');
    assertExactObject(errors, spaces.seatLease, {
      ttlSeconds: 90,
      renewEverySeconds: 30,
      disconnectRecoverySeconds: 60,
      noLearningActivityReleaseSeconds: 300,
      focusDurationsMinutes: [25, 45],
      serverClockOnly: true,
      clientMaySetLeaseExpiry: false,
      focusCreditPolicy: EXPECTED_FOCUS_CREDIT_POLICY,
    }, 'socialSpaces.seatLease');
    assertExactObject(errors, spaces.checkinGoalGroup, {
      sharedGoalRequired: true,
      fixedNonCashRewardSplitOnly: true,
      realtimePresence: 'OUT_OF_SCOPE',
      seatLease: 'PROHIBITED',
    }, 'socialSpaces.checkinGoalGroup');
  } else {
    errors.push('socialSpaces must be an object');
  }

  const randomRewards = policy.randomRewards;
  if (isPlainObject(randomRewards)) {
    for (const [key, expected] of Object.entries({
      paymentRequirement: 'FREE_ONLY',
      cashOrWithdrawal: 'PROHIBITED',
      paidRandomBox: 'PROHIBITED',
      gamblingMechanic: 'PROHIBITED',
      catalogVersionRequired: true,
      probabilityDisclosureRequired: true,
      probabilityAuditRequired: true,
      serverRandomnessOnly: true,
      clientCanSupplyProbabilityOrOutcome: false,
    })) {
      addError(errors, randomRewards[key] === expected, `randomRewards.${key} must equal ${JSON.stringify(expected)}`);
    }
  } else {
    errors.push('randomRewards must be an object');
  }

  assertExactObject(errors, policy.gameCatalog, EXPECTED_GAME_CATALOG, 'gameCatalog');

  const ledger = policy.ledger;
  if (isPlainObject(ledger)) {
    for (const [key, expected] of Object.entries({
      owner: 'gamification-service',
      writeModel: 'APPEND_ONLY',
      mutateExistingEntry: 'PROHIBITED',
      correctionModel: 'COMPENSATING_ENTRY_ONLY',
      directClientWrite: 'DENY',
    })) {
      addError(errors, ledger[key] === expected, `ledger.${key} must equal ${JSON.stringify(expected)}`);
    }
  } else {
    errors.push('ledger must be an object');
  }

  assertExactObject(errors, policy.leaderboard, EXPECTED_LEADERBOARD_POLICY, 'leaderboard');

  const moderation = policy.moderation;
  if (isPlainObject(moderation)) {
    addError(errors, moderation.phase1UgcMode === 'LOW_UGC_PRESET_ONLY',
      'moderation.phase1UgcMode must be LOW_UGC_PRESET_ONLY');
    addError(errors, moderation.freeText === 'PROHIBITED', 'moderation.freeText must be PROHIBITED');
    addError(errors, moderation.forbiddenSubmissionFields?.includes('text')
      && moderation.forbiddenSubmissionFields?.includes('directMessage'),
    'moderation must prohibit free text and direct messages');
  } else {
    errors.push('moderation must be an object');
  }
}

function schemaNameFromRef(ref) {
  const match = typeof ref === 'string' && ref.match(/^#\/(?:components\/schemas|payloadSchemas)\/([^/]+)$/);
  return match?.[1] ?? null;
}

function jsonContainsRef(value, expectedRef) {
  if (value === expectedRef) return true;
  if (Array.isArray(value)) return value.some((entry) => jsonContainsRef(entry, expectedRef));
  return isPlainObject(value) && Object.values(value).some((entry) => jsonContainsRef(entry, expectedRef));
}

function routeKey(route) {
  return `${route.method} ${route.path}`;
}

function consumerPairs(consumers) {
  return (consumers ?? []).map((consumer) => `${consumer.service}:${consumer.consumerGroup}`).sort();
}

function payloadSchemaForEvent(eventCatalog, event) {
  const payloadName = schemaNameFromRef(event?.payloadSchema?.$ref);
  return {
    name: payloadName,
    schema: payloadName ? eventCatalog?.payloadSchemas?.[payloadName] : null,
  };
}

function requiredEnvelopeFields(eventCatalog, event) {
  return new Set([
    ...(eventCatalog?.envelope?.required ?? []),
    ...(event?.['x-envelope-required'] ?? []),
  ]);
}

function isRequiredPayloadField(payloadSchema, field) {
  return Array.isArray(payloadSchema?.required)
    && payloadSchema.required.includes(field)
    && isPlainObject(payloadSchema.properties)
    && Object.hasOwn(payloadSchema.properties, field);
}

function assertOriginMap(errors, fieldOrigins, fields, eventCatalog, event, derivedMappings, label) {
  if (!isPlainObject(fieldOrigins)) {
    errors.push(`${label} must be an object`);
    return;
  }
  assertKnownKeys(errors, fieldOrigins, fields, label);
  const envelopeFields = requiredEnvelopeFields(eventCatalog, event);
  const { name: payloadName, schema: payloadSchema } = payloadSchemaForEvent(eventCatalog, event);
  for (const field of fields) {
    const origin = fieldOrigins[field];
    if (origin === 'ENVELOPE') {
      addError(errors, envelopeFields.has(field),
        `${label}.${field} declares ENVELOPE but ${event?.eventName} does not require that envelope field`);
    } else if (origin === 'PAYLOAD') {
      addError(errors, isRequiredPayloadField(payloadSchema, field),
        `${label}.${field} declares PAYLOAD but ${event?.eventName} payload ${payloadName ?? 'UNKNOWN'} does not require it`);
    } else if (typeof origin === 'string' && origin.startsWith('DERIVED:')) {
      const mappingName = origin.slice('DERIVED:'.length);
      addError(errors, isPlainObject(derivedMappings?.[mappingName]),
        `${label}.${field} references unknown derived mapping ${mappingName}`);
      addError(errors, field === mappingName,
        `${label}.${field} must use its same-named unique derived mapping`);
      addError(errors, derivedMappings?.[mappingName]?.clientSupplied === false,
        `${label}.${field} derived mapping must prohibit client supply`);
    } else {
      errors.push(`${label}.${field} must be ENVELOPE, PAYLOAD, or DERIVED:<mapping>`);
    }
  }
}

function assertPredicateProjection(errors, profile, eventCatalog, event) {
  const { name: payloadName, schema: payloadSchema } = payloadSchemaForEvent(eventCatalog, event);
  const predicate = profile.qualifiedPredicate;
  if (!isPlainObject(predicate)) return;
  for (const field of Object.keys(predicate)) {
    if (field === 'stateTransition') continue;
    addError(errors, isRequiredPayloadField(payloadSchema, field),
      `${profile.id} predicate ${field} must be a required field of ${event?.eventName} payload ${payloadName ?? 'UNKNOWN'}`);
  }
  if (profile.id !== 'MASTERY_MILESTONE') {
    addError(errors, !Object.hasOwn(predicate, 'stateTransition'),
      `${profile.id} must not define a derived mastery stateTransition`);
    return;
  }
  const transition = predicate.stateTransition;
  if (!isPlainObject(transition)) return;
  addError(errors, !Object.hasOwn(payloadSchema?.properties ?? {}, 'stateTransition'),
    'MASTERY_MILESTONE stateTransition is a policy-derived predicate, never a payload field');
  for (const inputField of transition.inputFields ?? []) {
    addError(errors, isRequiredPayloadField(payloadSchema, inputField),
      `MASTERY_MILESTONE derived stateTransition input ${inputField} must be a required payload field of ${payloadName ?? 'UNKNOWN'}`);
  }
}

function assertTrustedCompletionSourceProjection(errors, policy, eventCatalog) {
  if (!isPlainObject(eventCatalog) || !Array.isArray(eventCatalog.events)) return;
  const completion = policy.trustedCompletion;
  const profiles = completion?.sourceProfiles ?? [];
  for (const profile of profiles) {
    if (!isPlainObject(profile)) continue;
    const event = eventCatalog.events.find((candidate) => candidate.eventName === profile.eventName);
    if (!isPlainObject(event)) {
      errors.push(`trustedCompletion ${profile.id} event ${profile.eventName} must resolve in eventCatalog`);
      continue;
    }
    addError(errors, event['x-p1r-governance']?.producer?.service === profile.producerService,
      `trustedCompletion ${profile.id} producer must match event catalog`);
    addError(errors, event.schema === `${profile.producerService === 'assessment-service' ? 'assessment' : 'learning'}.event.${profile.schemaVersion}`,
      `trustedCompletion ${profile.id} schema version must match event catalog`);
    assertOriginMap(errors, profile.lineageFieldOrigins, profile.lineageFields, eventCatalog, event,
      completion.derivedFieldMappings, `trustedCompletion.${profile.id}.lineageFieldOrigins`);
    assertOriginMap(errors, profile.dedupeFieldOrigins, profile.dedupeFields, eventCatalog, event,
      completion.derivedFieldMappings, `trustedCompletion.${profile.id}.dedupeFieldOrigins`);
    assertPredicateProjection(errors, profile, eventCatalog, event);
    for (const commonField of completion.lineageRequiredFields ?? []) {
      addError(errors, profile.lineageFields?.includes(commonField),
        `trustedCompletion ${profile.id} must contain common lineage field ${commonField}`);
    }
  }
}

function assertNoClientAuthorityFields(errors, schema, forbiddenFields, label, schemaRegistry = {}) {
  if (!isPlainObject(schema)) {
    errors.push(`${label} request schema is missing`);
    return;
  }
  addError(errors, schema.additionalProperties === false,
    `${label} must set additionalProperties=false for unknown-field denial`);
  const seen = new Set();
  const walk = (current, currentLabel) => {
    if (!isPlainObject(current) || seen.has(current)) return;
    seen.add(current);
    const referencedSchema = schemaNameFromRef(current.$ref);
    if (referencedSchema && isPlainObject(schemaRegistry[referencedSchema])) {
      walk(schemaRegistry[referencedSchema], `${currentLabel}.$ref(${referencedSchema})`);
    }
    if (isPlainObject(current.properties)) {
      for (const [field, nested] of Object.entries(current.properties)) {
        if (forbiddenFields.includes(field)) {
          errors.push(`${currentLabel} exposes forbidden client authority field ${field}`);
        }
        walk(nested, `${currentLabel}.${field}`);
      }
    }
    for (const keyword of ['allOf', 'anyOf', 'oneOf']) {
      if (Array.isArray(current[keyword])) {
        current[keyword].forEach((entry, index) => walk(entry, `${currentLabel}.${keyword}[${index}]`));
      }
    }
    if (isPlainObject(current.items)) walk(current.items, `${currentLabel}.items`);
  };
  walk(schema, label);
}

function assertCanonicalRouteProjection(errors, policy, canonicalOpenApi) {
  if (!isPlainObject(canonicalOpenApi) || !isPlainObject(canonicalOpenApi.paths)) {
    errors.push('canonicalOpenApi must provide paths for exact M1-014 route projection');
    return { canonicalRoutes: 0, coveredCanonicalRoutes: 0 };
  }
  const routes = policy.compatibilityPromotion.canonicalRoutes;
  const expectedRouteKeys = new Set(routes.map(routeKey));
  addError(errors, expectedRouteKeys.size === routes.length,
    'compatibilityPromotion.canonicalRoutes must not contain duplicate method/path identities');

  const taggedRoutes = [];
  for (const [routePath, pathItem] of Object.entries(canonicalOpenApi.paths)) {
    if (!isPlainObject(pathItem)) continue;
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!isPlainObject(operation)) continue;
      if (operation.tags?.includes('M1-014-GAM') || operation.tags?.includes('M1-014-SOC')) {
        taggedRoutes.push({ method: method.toUpperCase(), path: routePath, operation });
      }
    }
  }
  const taggedRouteKeys = new Set(taggedRoutes.map((route) => `${route.method} ${route.path}`));
  for (const key of expectedRouteKeys) {
    addError(errors, taggedRouteKeys.has(key), `canonical OpenAPI is missing tagged M1-014 route ${key}`);
  }
  for (const key of taggedRouteKeys) {
    addError(errors, expectedRouteKeys.has(key), `canonical OpenAPI exposes unapproved M1-014 route ${key}`);
  }

  const schemas = canonicalOpenApi.components?.schemas;
  assertTrustedCompletionOpenApiProjection(errors, policy, canonicalOpenApi);
  assertGameCatalogOpenApiProjection(errors, policy, canonicalOpenApi);
  assertM1014CursorPaginationProjection(errors, canonicalOpenApi);
  assertFocusAndLeaderboardOpenApiProjection(errors, policy, canonicalOpenApi);
  assertTrustedSocialOpenApiProjection(errors, canonicalOpenApi);
  let coveredCanonicalRoutes = 0;
  for (const route of routes) {
    const operation = canonicalOpenApi.paths?.[route.path]?.[route.method.toLowerCase()];
    if (!isPlainObject(operation)) continue;
    coveredCanonicalRoutes += 1;
    addError(errors, operation.operationId === route.operationId,
      `${route.id} operationId must be ${route.operationId}`);
    const securityName = Object.keys(operation.security?.[0] ?? {})[0];
    addError(errors, securityName === route.security,
      `${route.id} security must be ${route.security}`);
    addError(errors, operation['x-authorization']?.requiredPermission === route.requiredPermission,
      `${route.id} requiredPermission must be ${route.requiredPermission}`);
    if (Object.hasOwn(operation, 'x-permission')) {
      addError(errors, operation['x-permission'] === route.requiredPermission,
        `${route.id} x-permission must be ${route.requiredPermission}`);
    }
    const requestRef = operation.requestBody?.content?.['application/json']?.schema?.$ref;
    if (route.requestSchema === 'NONE') {
      addError(errors, !operation.requestBody, `${route.id} must not declare a request body`);
    } else {
      const expectedRequestRef = `#/components/schemas/${route.requestSchema}`;
      addError(errors, requestRef === expectedRequestRef,
        `${route.id} request schema must be ${route.requestSchema}`);
      addError(errors, isPlainObject(schemas?.[route.requestSchema]),
        `${route.id} request schema ${route.requestSchema} must resolve in canonical OpenAPI`);
      if (route.security === 'bearerAuth') {
        assertNoClientAuthorityFields(errors, schemas?.[route.requestSchema],
          policy.authority.forbiddenClientAuthorityFields, route.id, schemas);
      }
    }
    const successResponse = operation.responses?.[route.successStatus];
    addError(errors, isPlainObject(successResponse), `${route.id} must expose success status ${route.successStatus}`);
    const expectedResponseRef = `#/components/schemas/${route.responseSchema.replace(/\[\]$/, '')}`;
    addError(errors, jsonContainsRef(successResponse, expectedResponseRef),
      `${route.id} success response must reference ${route.responseSchema}`);
    addError(errors, isPlainObject(schemas?.[route.responseSchema.replace(/\[\]$/, '')]),
      `${route.id} response schema ${route.responseSchema} must resolve in canonical OpenAPI`);
    const idempotencyRequired = operation['x-idempotency']?.required === true;
    addError(errors, idempotencyRequired === (route.idempotency === 'REQUIRED'),
      `${route.id} idempotency must be ${route.idempotency}`);
    const expectedOwner = route.id.includes('-GAM-') ? 'gamification-service' : 'social-service';
    addError(errors, route.owner === expectedOwner, `${route.id} owner must be ${expectedOwner}`);
  }
  return { canonicalRoutes: routes.length, coveredCanonicalRoutes };
}

function assertCanonicalEventProjection(errors, policy, eventFragment, eventCatalog) {
  if (!isPlainObject(eventFragment) || !Array.isArray(eventFragment.events) || !isPlainObject(eventFragment.payloadSchemas)) {
    errors.push('m1014EventFragment must provide events and payloadSchemas for exact projection');
    return { canonicalEvents: 0, coveredCanonicalEvents: 0, fragmentEvents: 0 };
  }
  if (!isPlainObject(eventCatalog) || !Array.isArray(eventCatalog.events) || !isPlainObject(eventCatalog.payloadSchemas)) {
    errors.push('eventCatalog must provide events and payloadSchemas for exact projection');
    return { canonicalEvents: 0, coveredCanonicalEvents: 0, fragmentEvents: eventFragment.events.length };
  }

  const policyEvents = policy.compatibilityPromotion.approvedCanonicalEvents;
  const policyEventNames = new Set(policyEvents.map((event) => event.eventName));
  addError(errors, policyEventNames.size === policyEvents.length,
    'approvedCanonicalEvents must not contain duplicate event names');
  const newPolicyEvents = policyEvents.filter((event) => event.payloadRef?.includes('/M1014'));
  addError(errors, newPolicyEvents.length === 8,
    'approvedCanonicalEvents must have exactly eight M1-014 fragment events');
  const fragmentNames = new Set(eventFragment.events.map((event) => event.eventName));
  addError(errors, fragmentNames.size === eventFragment.events.length && eventFragment.events.length === 8,
    'm1014EventFragment must contain exactly eight unique events');
  for (const event of newPolicyEvents) {
    addError(errors, fragmentNames.has(event.eventName),
      `m1014EventFragment is missing approved event ${event.eventName}`);
  }
  for (const eventName of fragmentNames) {
    addError(errors, policyEventNames.has(eventName),
      `m1014EventFragment contains unapproved event ${eventName}`);
  }

  let coveredCanonicalEvents = 0;
  for (const expected of policyEvents) {
    const catalogEvent = eventCatalog.events.find((event) => event.eventName === expected.eventName);
    if (!isPlainObject(catalogEvent)) {
      errors.push(`eventCatalog is missing approved canonical event ${expected.eventName}`);
      continue;
    }
    coveredCanonicalEvents += 1;
    addError(errors, catalogEvent.status === 'CANONICAL_D2',
      `${expected.eventName} must remain CANONICAL_D2`);
    addError(errors, catalogEvent['x-p1r-governance']?.runtimeStatus === 'NOT_RUNTIME_VERIFIED',
      `${expected.eventName} must remain NOT_RUNTIME_VERIFIED`);
    addError(errors, catalogEvent.aggregateType === expected.aggregateType,
      `${expected.eventName} aggregateType must be ${expected.aggregateType}`);
    addError(errors, catalogEvent.aggregateIdField === expected.aggregateIdField,
      `${expected.eventName} aggregateIdField must be ${expected.aggregateIdField}`);
    addError(errors, catalogEvent.payloadSchema?.$ref === expected.payloadRef,
      `${expected.eventName} payload reference must be ${expected.payloadRef}`);
    addError(errors, catalogEvent['x-p1r-governance']?.producer?.service === expected.producer,
      `${expected.eventName} producer must be ${expected.producer}`);
    addError(errors, catalogEvent['x-p1r-governance']?.transport?.topic === expected.topic,
      `${expected.eventName} topic must be ${expected.topic}`);
    assertArrayEquals(errors, consumerPairs(catalogEvent['x-p1r-governance']?.consumers),
      consumerPairs(expected.consumers), `${expected.eventName} consumers`);
    const payloadName = schemaNameFromRef(expected.payloadRef);
    const catalogSchema = eventCatalog.payloadSchemas[payloadName];
    addError(errors, isPlainObject(catalogSchema), `${expected.eventName} payload schema ${payloadName} must resolve in eventCatalog`);
    if (isPlainObject(catalogSchema)) {
      assertArrayEquals(errors, catalogSchema.required, expected.requiredPayloadFields,
        `${expected.eventName} required payload fields`);
    }
    if (expected.payloadRef.includes('/M1014')) {
      const fragmentEvent = eventFragment.events.find((event) => event.eventName === expected.eventName);
      const fragmentSchema = eventFragment.payloadSchemas[payloadName];
      addError(errors, isPlainObject(fragmentEvent), `${expected.eventName} must resolve in m1014EventFragment`);
      addError(errors, isPlainObject(fragmentSchema), `${expected.eventName} payload schema ${payloadName} must resolve in m1014EventFragment`);
      if (isPlainObject(fragmentEvent)) {
        addError(errors, fragmentEvent.aggregateType === expected.aggregateType,
          `${expected.eventName} fragment aggregateType must be ${expected.aggregateType}`);
        addError(errors, fragmentEvent.aggregateIdField === expected.aggregateIdField,
          `${expected.eventName} fragment aggregateIdField must be ${expected.aggregateIdField}`);
        addError(errors, fragmentEvent.payloadSchema?.$ref === expected.payloadRef,
          `${expected.eventName} fragment payload reference must be ${expected.payloadRef}`);
      }
      if (isPlainObject(fragmentSchema) && isPlainObject(catalogSchema)) {
        addError(errors, sameJson(fragmentSchema, catalogSchema),
          `${expected.eventName} catalog payload schema must exactly match M1-014 fragment`);
      }
    }
  }

  const rejected = policy.trustedCompletion.rejectedEventNames ?? [];
  addError(errors, rejected.includes('learning.review.scheduled.v2'),
    'learning.review.scheduled.v2 must be an explicit trusted-completion rejection');
  const rejectedCanonical = policy.trustedCompletion.rejectedCanonicalEvents?.find(
    (event) => event?.eventName === 'learning.review.scheduled.v2',
  );
  addError(errors, rejectedCanonical?.classification === 'CANONICAL_D2_QUEUE_FACT_REJECTED_FOR_REWARD'
    && rejectedCanonical?.reason === 'QUEUE_FACT_NOT_A_COMPLETION'
    && rejectedCanonical?.runtimeStatus === 'NOT_RUNTIME_VERIFIED',
  'learning.review.scheduled.v2 must have an independent D2-only queue-fact rejection classification');
  addError(errors, !policyEventNames.has('learning.review.scheduled.v2'),
    'learning.review.scheduled.v2 must not be an approved M1-014 promotion event');
  const reviewEvent = eventCatalog.events.find((event) => event.eventName === 'learning.review.scheduled.v2');
  addError(errors, reviewEvent?.status === 'CANONICAL_D2'
    && reviewEvent?.['x-p1r-governance']?.runtimeStatus === 'NOT_RUNTIME_VERIFIED',
  'learning.review.scheduled.v2 must remain a D2-only queue fact');

  for (const legacy of [...policy.compatibilityPromotion.legacyAdapters, ...policy.compatibilityPromotion.historicalOnlySources]) {
    for (const eventName of legacy.eventNames ?? [legacy.source]) {
      const historicEvent = eventCatalog.events.find((event) => event.eventName === eventName);
      addError(errors, historicEvent?.status === 'HISTORICAL_CANDIDATE',
        `historical source ${eventName} must remain HISTORICAL_CANDIDATE`);
      addError(errors, !policyEventNames.has(eventName),
        `historical source ${eventName} must not be an approved M1-014 canonical event`);
    }
  }
  assertTrustedCompletionSourceProjection(errors, policy, eventCatalog);
  return {
    canonicalEvents: policyEvents.length,
    coveredCanonicalEvents,
    fragmentEvents: eventFragment.events.length,
  };
}

function assertB26StaticBoundary(errors, policy, b26Runtime) {
  if (!isPlainObject(b26Runtime)) {
    errors.push('b26Runtime must be a JSON object');
    return;
  }
  addError(errors, b26Runtime.mode === 'static-only', 'B26 must remain static-only');
  addError(errors, b26Runtime.defaultDecision === 'NO-GO', 'B26 default decision must remain NO-GO');
  addError(errors, b26Runtime.execution?.staticValidatorCannotPromoteRuntime === true,
    'B26 static validator must not promote runtime');
  addError(errors, b26Runtime.execution?.syntheticEvidenceCannotPromoteRuntime === true,
    'B26 synthetic evidence must not promote runtime');
  addError(errors, b26Runtime.runtimeGate?.status === 'blocked', 'B26 runtime gate must remain blocked');
  const authorityFacts = b26Runtime.safety?.forbiddenClientAuthorityFacts ?? [];
  for (const field of ['role', 'permission', 'tenantId', 'ownerId']) {
    addError(errors, authorityFacts.includes(field), `B26 must forbid client authority fact ${field}`);
  }
  const routingByEvent = new Map((b26Runtime.eventRouting ?? []).map((route) => [route.eventName, route]));
  for (const event of policy.compatibilityPromotion.approvedCanonicalEvents) {
    const route = routingByEvent.get(event.eventName);
    addError(errors, isPlainObject(route), `B26 eventRouting must include ${event.eventName}`);
    if (isPlainObject(route)) {
      addError(errors, route.topic === event.topic, `${event.eventName} B26 topic must be ${event.topic}`);
      assertArrayEquals(errors, [...(route.consumerGroups ?? [])].sort(),
        event.consumers.map((consumer) => consumer.consumerGroup).sort(),
        `${event.eventName} B26 consumer groups`);
    }
  }
}

function validatePolicyOnly(policy) {
  const errors = [];
  if (!isPlainObject(policy)) {
    errors.push('policy must be a JSON object');
    return errors;
  }
  assertCorePolicy(errors, policy);
  const digest = policyDigest(policy);
  if (digest !== FROZEN_POLICY_SHA256) {
    errors.push('policy digest does not match the frozen P1R-M1-014 projection; additional, unknown, or altered semantics are denied');
  }
  return errors;
}

/**
 * Pure D2 projection validator. It validates the immutable policy against
 * supplied OpenAPI, event-fragment, catalog, and B26 static-governance data;
 * it performs no I/O and never promotes runtime status.
 */
export function validateGamificationSocialContractData({
  policy,
  canonicalOpenApi,
  eventFragment,
  eventCatalog,
  b26Runtime,
} = {}) {
  const errors = validatePolicyOnly(policy);
  let routeCounts = { canonicalRoutes: 0, coveredCanonicalRoutes: 0 };
  let eventCounts = { canonicalEvents: 0, coveredCanonicalEvents: 0, fragmentEvents: 0 };
  if (isPlainObject(policy)) {
    routeCounts = assertCanonicalRouteProjection(errors, policy, canonicalOpenApi);
    eventCounts = assertCanonicalEventProjection(errors, policy, eventFragment, eventCatalog);
    assertB26StaticBoundary(errors, policy, b26Runtime);
  }

  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    task: 'P1R-M1-014',
    maturity: 'D2_CONTRACT_READY',
    runtimeStatus: 'NOT_RUNTIME_VERIFIED',
    policyDigest: isPlainObject(policy) ? policyDigest(policy) : null,
    frozenPolicyDigest: FROZEN_POLICY_SHA256,
    counts: { ...routeCounts, ...eventCounts },
    errors,
  };
}

/**
 * Pure candidate validator for future reward ingestion. It does not emit a
 * reward or assert runtime readiness; it only validates the frozen D2 trust
 * tuple, predicate, and lineage shape.
 */
export function validateTrustedCompletionCandidate({ candidate, policy } = {}) {
  const errors = validatePolicyOnly(policy);
  const allowedKeys = ['producerService', 'eventName', 'schemaVersion', 'qualifiedPredicate', 'rewardRuleVersion', 'lineage'];
  if (!assertKnownKeys(errors, candidate, allowedKeys, 'candidate')) {
    return { result: 'FAIL', runtimeStatus: 'NOT_RUNTIME_VERIFIED', errors, profileId: null };
  }

  const profile = policy?.trustedCompletion?.sourceProfiles?.find((entry) => entry?.producerService === candidate.producerService
    && entry?.eventName === candidate.eventName && entry?.schemaVersion === candidate.schemaVersion);
  if (!profile) {
    errors.push('candidate tuple producerService/eventName/schemaVersion is not in the trusted completion whitelist');
    return { result: 'FAIL', runtimeStatus: 'NOT_RUNTIME_VERIFIED', errors, profileId: null };
  }
  addError(errors, boundedString(candidate.rewardRuleVersion, 1, 96),
    'candidate.rewardRuleVersion must be a non-empty server-selected version');
  addError(errors, sameJson(candidate.qualifiedPredicate, trustedCompletionWirePredicate(profile)),
    `candidate.qualifiedPredicate must equal frozen predicate for ${profile.id}`);
  if (!isPlainObject(candidate.lineage)) {
    errors.push('candidate.lineage must be an object');
  } else {
    assertKnownKeys(errors, candidate.lineage, profile.lineageFields, 'candidate.lineage');
    addError(errors, boundedString(candidate.lineage.eventId, 8),
      'candidate.lineage.eventId must be a bounded event identifier');
    addError(errors, boundedString(candidate.lineage.traceId, 8),
      'candidate.lineage.traceId must be a bounded trace identifier');
    addError(errors, candidate.lineage.schemaVersion === 'v2',
      'candidate.lineage.schemaVersion must be v2');
    assertContentPin(errors, candidate.lineage.contentPin, 'candidate.lineage.contentPin');
    if (profile.id === 'TASK_COMPLETED') {
      addError(errors, boundedString(candidate.lineage.taskId), 'candidate.lineage.taskId must be a bounded identifier');
      addError(errors, boundedString(candidate.lineage.completionVersion, 1, 64),
        'candidate.lineage.completionVersion must be a bounded version');
      addError(errors, boundedString(candidate.lineage.rootEventId, 8),
        'candidate.lineage.rootEventId must be a bounded event identifier');
      assertPinnedObject(errors, candidate.lineage.rulePin,
        ['completionRuleVersion', 'ruleDigest'], 'candidate.lineage.rulePin');
      addError(errors, sha256String(candidate.lineage.outcomeDigest),
        'candidate.lineage.outcomeDigest must be a SHA-256 digest');
    } else if (profile.id === 'ASSESSMENT_ITEM_CORRECT') {
      for (const field of ['itemAssessmentId', 'attemptId', 'logicalItemId']) {
        addError(errors, boundedString(candidate.lineage[field]),
          `candidate.lineage.${field} must be a bounded identifier`);
      }
      assertPinnedObject(errors, candidate.lineage.rulePin, [
        'answerRuleSetVersion', 'answerRuleVersion', 'ruleDigest', 'completionRuleVersion', 'assessmentVersion',
      ], 'candidate.lineage.rulePin');
      assertPinnedObject(errors, candidate.lineage.objectivePolicyPin,
        ['policyVersion', 'policyDigest'], 'candidate.lineage.objectivePolicyPin');
      addError(errors, sha256String(candidate.lineage.outcomeDigest),
        'candidate.lineage.outcomeDigest must be a SHA-256 digest');
    } else if (profile.id === 'MASTERY_MILESTONE') {
      for (const field of ['projectionId', 'masteryEpochId', 'sourceAssessmentEventId', 'sourceItemAssessmentId']) {
        addError(errors, boundedString(candidate.lineage[field]),
          `candidate.lineage.${field} must be a bounded identifier`);
      }
      for (const field of ['masteryEpochVersion', 'projectionVersion']) {
        addError(errors, Number.isSafeInteger(candidate.lineage[field]) && candidate.lineage[field] >= 1,
          `candidate.lineage.${field} must be a positive integer`);
      }
      addError(errors, ['NEW', 'LEARNING', 'MASTERED', 'CONSOLIDATED'].includes(candidate.lineage.masteryStageBefore),
        'candidate.lineage.masteryStageBefore must be a frozen mastery stage');
      addError(errors, boundedString(candidate.lineage.masteryRuleVersion, 1, 96),
        'candidate.lineage.masteryRuleVersion must be a bounded version');
      addError(errors, sha256String(candidate.lineage.evidenceDigest),
        'candidate.lineage.evidenceDigest must be a SHA-256 digest');
    }
  }
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    runtimeStatus: 'NOT_RUNTIME_VERIFIED',
    profileId: profile.id,
    errors,
  };
}

export function readGamificationSocialContract({ root = DEFAULT_ROOT, policyPath } = {}) {
  const resolvedPolicyPath = policyPath ?? path.join(root, 'config/p1r-gamification-social-contract.v1.json');
  const policy = JSON.parse(readFileSync(resolvedPolicyPath, 'utf8'));
  const sourcePath = (source) => path.join(root, source);
  return {
    policy,
    canonicalOpenApi: JSON.parse(readFileSync(sourcePath(policy.canonicalSources.m1014OpenApiFragment), 'utf8')),
    eventFragment: JSON.parse(readFileSync(sourcePath(policy.canonicalSources.m1014EventFragment), 'utf8')),
    eventCatalog: JSON.parse(readFileSync(sourcePath(policy.canonicalSources.eventCatalog), 'utf8')),
    b26Runtime: JSON.parse(readFileSync(sourcePath(policy.canonicalSources.b26RuntimeContract), 'utf8')),
  };
}

export function validateGamificationSocialContract(options = {}) {
  return validateGamificationSocialContractData(readGamificationSocialContract(options));
}

function parseCliArguments(argv) {
  const options = { json: false };
  for (const argument of argv) {
    if (argument === '--json') options.json = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new Error(`unknown argument: ${argument}`);
  }
  return options;
}

function runCli() {
  try {
    const options = parseCliArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write('Usage: node scripts/audit/p1r-gamification-social-contract-check.mjs [--json]\n');
      return;
    }
    const report = validateGamificationSocialContract();
    process.stdout.write(`${JSON.stringify(report, null, options.json ? 2 : 2)}\n`);
    if (report.result !== 'PASS') process.exitCode = 1;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({
      result: 'FAIL',
      task: 'P1R-M1-014',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      errors: [error instanceof Error ? error.message : String(error)],
    }, null, 2)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
