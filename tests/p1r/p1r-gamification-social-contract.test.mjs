import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  FROZEN_POLICY_SHA256,
  policyDigest,
  readGamificationSocialContract,
  validateGamificationSocialContract,
  validateGamificationSocialContractData,
  validateTrustedCompletionCandidate,
} from '../../scripts/audit/p1r-gamification-social-contract-check.mjs';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDir, '../..');
const baselineInputs = readGamificationSocialContract({ root });
const policy = baselineInputs.policy;

test('canonical merged OpenAPI removes the retired M1-014 pagination aliases', () => {
  const canonical = JSON.parse(readFileSync(path.join(root, 'packages/contracts/openapi/v1/openapi.json'), 'utf8'));
  assert.equal(canonical.components.parameters.M1014Cursor, undefined);
  assert.equal(canonical.components.parameters.M1014PageSize, undefined);
});

function clonePolicy() {
  return structuredClone(policy);
}

function cloneInputs() {
  return structuredClone(baselineInputs);
}

function candidateFor(profile) {
  const contentPin = {
    contentVersionId: 1,
    contentEpoch: 0,
    snapshotId: 'snapshot-1',
    snapshotHash: 'a'.repeat(64),
  };
  const base = {
    producerService: profile.producerService,
    eventName: profile.eventName,
    schemaVersion: profile.schemaVersion,
    rewardRuleVersion: 'reward-rule.v1',
  };
  if (profile.id === 'TASK_COMPLETED') {
    return {
      ...base,
      qualifiedPredicate: structuredClone(profile.qualifiedPredicate),
      lineage: {
        eventId: 'event-task-1',
        traceId: 'trace-task-1',
        schemaVersion: 'v2',
        taskId: 'task-1',
        completionVersion: 'completion-v1',
        rootEventId: 'root-event-1',
        contentPin,
        rulePin: { completionRuleVersion: 'completion-rule.v1', ruleDigest: 'b'.repeat(64) },
        outcomeDigest: 'c'.repeat(64),
      },
    };
  }
  if (profile.id === 'ASSESSMENT_ITEM_CORRECT') {
    return {
      ...base,
      qualifiedPredicate: structuredClone(profile.qualifiedPredicate),
      lineage: {
        eventId: 'event-assessment-1',
        traceId: 'trace-assessment-1',
        schemaVersion: 'v2',
        itemAssessmentId: 'item-assessment-1',
        attemptId: 'attempt-1',
        logicalItemId: 'logical-item-1',
        contentPin,
        rulePin: {
          answerRuleSetVersion: 'answer-rule-set.v1',
          answerRuleVersion: 'answer-rule.v1',
          ruleDigest: 'd'.repeat(64),
          completionRuleVersion: 'completion-rule.v1',
          assessmentVersion: 'assessment.v1',
        },
        objectivePolicyPin: { policyVersion: 'objective-policy.v1', policyDigest: 'e'.repeat(64) },
        outcomeDigest: 'f'.repeat(64),
      },
    };
  }
  return {
    ...base,
    qualifiedPredicate: {
      masteryStageAfter: profile.qualifiedPredicate.masteryStageAfter[0],
      d7Gate: structuredClone(profile.qualifiedPredicate.d7Gate),
      stateTransition: true,
    },
    lineage: {
      eventId: 'event-mastery-1',
      traceId: 'trace-mastery-1',
      schemaVersion: 'v2',
      projectionId: 'projection-1',
      masteryEpochId: 'epoch-1',
      masteryEpochVersion: 1,
      projectionVersion: 1,
      sourceAssessmentEventId: 'assessment-event-1',
      sourceItemAssessmentId: 'item-assessment-1',
      contentPin,
      masteryStageBefore: 'LEARNING',
      masteryRuleVersion: 'mastery-rule.v1',
      evidenceDigest: '1'.repeat(64),
    },
  };
}

function assertPolicyMutationFails(mutate) {
  const localPolicy = clonePolicy();
  mutate(localPolicy);
  const report = validateGamificationSocialContractData({ ...baselineInputs, policy: localPolicy });
  assert.equal(report.result, 'FAIL', report.errors.join('\n'));
  assert(report.errors.some((error) => /frozen|unknown|NOT_RUNTIME_VERIFIED|DENY|PROHIBITED/.test(error)),
    `expected fail-closed diagnostic; got ${report.errors.join('\n')}`);
}

test('M1-014 frozen D2 policy and repository projection pass without runtime promotion', () => {
  const direct = validateGamificationSocialContractData(baselineInputs);
  const repository = validateGamificationSocialContract({ root });
  assert.equal(direct.result, 'PASS', direct.errors.join('\n'));
  assert.equal(repository.result, 'PASS', repository.errors.join('\n'));
  assert.equal(direct.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
  assert.equal(direct.policyDigest, FROZEN_POLICY_SHA256);
  assert.equal(policyDigest(policy), FROZEN_POLICY_SHA256);
  assert.deepEqual(policy.socialSpaces.spaceTypes.map((space) => [space.type, space.minCapacity, space.maxCapacity, space.initialGate]), [
    ['PUBLIC_THEME_ROOM', 20, 30, { priority: 'P0', enabled: true }],
    ['INVITE_STUDY_ROOM', 2, 8, { priority: 'P1', enabled: false }],
    ['CHECKIN_GOAL_GROUP', 3, 10, { priority: 'P1', enabled: false }],
  ]);
  for (const pathName of ['/api/v1/games/catalog', '/api/v1/social/rooms']) {
    const operation = baselineInputs.canonicalOpenApi.paths[pathName].get;
    assert.deepEqual(operation.parameters, [
      { $ref: '#/components/parameters/Cursor' },
      { $ref: '#/components/parameters/PageSize' },
    ]);
    assert.deepEqual(operation['x-pagination'], {
      mode: 'cursor',
      cursorParameter: '#/components/parameters/Cursor',
      pageSizeParameter: '#/components/parameters/PageSize',
      responseMeta: '#/components/schemas/ApiCursorPageMeta',
    });
    assert.equal(operation.responses[200].content['application/json'].schema.allOf[0].$ref,
      '#/components/schemas/ApiCursorPageEnvelope');
  }
  assert.equal(baselineInputs.canonicalOpenApi.components.parameters.M1014Cursor, undefined);
  assert.equal(baselineInputs.canonicalOpenApi.components.parameters.M1014PageSize, undefined);
  assert.equal(baselineInputs.canonicalOpenApi.components.schemas.M1014RoomPage.properties.nextCursor, undefined);
  assert.deepEqual(baselineInputs.canonicalOpenApi.components.schemas.M1014GameCatalog.properties.items, {
    type: 'array',
    minItems: 0,
    maxItems: 6,
    uniqueItems: true,
    'x-unique-by': 'gameCode',
    items: { $ref: '#/components/schemas/M1014GameCatalogItem' },
  });
});

test('M1-014 checker CLI emits JSON D2 PASS', () => {
  const result = spawnSync(process.execPath, ['scripts/audit/p1r-gamification-social-contract-check.mjs', '--json'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.result, 'PASS');
  assert.equal(report.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
  assert.equal(report.policyDigest, FROZEN_POLICY_SHA256);
});

test('all frozen trusted-completion profiles accept a complete server-derived tuple', async (t) => {
  for (const profile of policy.trustedCompletion.sourceProfiles) {
    await t.test(profile.id, () => {
      const report = validateTrustedCompletionCandidate({ candidate: candidateFor(profile), policy });
      assert.equal(report.result, 'PASS', report.errors.join('\n'));
      assert.equal(report.profileId, profile.id);
      assert.equal(report.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
    });
  }
});

test('adversarial frozen-policy mutations fail closed', async (t) => {
  const cases = [
    ['unknown root field', (local) => { local.unrecognizedAuthority = true; }],
    ['missing root field', (local) => { delete local.events; }],
    ['schema version drift', (local) => { local.schemaVersion = 'p1r.gamification-social-contract.v2'; }],
    ['source baseline drift', (local) => { local.sourceBaseline = 'deadbeef'; }],
    ['maturity promotion', (local) => { local.maturity = 'RUNTIME_VERIFIED'; }],
    ['runtime promotion', (local) => { local.runtimeStatus = 'RUNTIME_VERIFIED'; }],
    ['unknown field policy relaxed', (local) => { local.collectionPolicy.unknownFieldDecision = 'ALLOW'; }],
    ['additional properties relaxed', (local) => { local.collectionPolicy.additionalProperties = 'ALLOW'; }],
    ['client authority expanded', (local) => { local.collectionPolicy.clientAuthorityExpansion = 'ALLOW'; }],
    ['collection unknown field', (local) => { local.collectionPolicy.clientHint = 'ALLOW'; }],
    ['compatibility id drift', (local) => { local.compatibilityPromotion.id = 'P1R-M1-099'; }],
    ['compatibility baseline drift', (local) => { local.compatibilityPromotion.sourceContractBaseline = 'deadbeef'; }],
    ['compatibility predecessor drift', (local) => { local.compatibilityPromotion.previousPromotion = 'P1R-M1-012'; }],
    ['immutable governance baseline drift', (local) => { local.compatibilityPromotion.immutableGovernanceBaseline = 'deadbeef'; }],
    ['compatibility scope drift', (local) => { local.compatibilityPromotion.scope = 'RUNTIME'; }],
    ['compatibility runtime promotion', (local) => { local.compatibilityPromotion.runtimeStatus = 'RUNTIME_VERIFIED'; }],
    ['B26 static policy promotes runtime', (local) => { local.compatibilityPromotion.b26StaticPolicy.allowsRuntimePromotion = true; }],
    ['B26 evidence promotes runtime', (local) => { local.compatibilityPromotion.b26StaticPolicy.runtimeEvidence = 'RUNTIME_VERIFIED'; }],
    ['canonical route injected', (local) => { local.compatibilityPromotion.canonicalRoutes.push({ path: '/api/v1/games' }); }],
    ['legacy adapter injected', (local) => { local.compatibilityPromotion.legacyAdapters.push({ id: 'B12' }); }],
    ['historical B4 promoted', (local) => { local.compatibilityPromotion.historicalOnlySources[1].canonical = true; }],
    ['historical B12 gains runtime authority', (local) => { local.compatibilityPromotion.historicalOnlySources[2].runtimeAuthority = true; }],
    ['D2 runtime claim removed', (local) => { local.compatibilityPromotion.prohibitedRuntimeClaims.shift(); }],
    ['canonical assessment reward eligibility relaxed', (local) => { local.compatibilityPromotion.approvedCanonicalEvents[0].rewardEligibility = 'ALLOW'; }],
    ['owner set changes', (local) => { local.owners['gamification-service'].push('shared-table-write'); }],
    ['client Kafka fact authority', (local) => { local.authority.clientMayProduceKafkaFacts = true; }],
    ['client server-derived field', (local) => { local.authority.serverDerivedFields.pop(); }],
    ['forbidden client role omitted', (local) => { local.authority.forbiddenClientAuthorityFields = local.authority.forbiddenClientAuthorityFields.filter((field) => field !== 'role'); }],
    ['trusted tuple field injected', (local) => { local.trustedCompletion.tupleFields.push('clientScore'); }],
    ['common lineage expands beyond the real intersection', (local) => { local.trustedCompletion.lineageRequiredFields.push('rootEventId'); }],
    ['reward rule derived mapping becomes client supplied', (local) => { local.trustedCompletion.derivedFieldMappings.rewardRuleVersion.clientSupplied = true; }],
    ['trusted profile injected', (local) => { local.trustedCompletion.sourceProfiles.push({ id: 'CLIENT_COMPLETION' }); }],
    ['future task completion producer drift', (local) => { local.trustedCompletion.sourceProfiles[0].producerService = 'client'; }],
    ['future task completion event v1', (local) => { local.trustedCompletion.sourceProfiles[0].eventName = 'learning.task.completed.v1'; }],
    ['task profile substitutes evidence digest', (local) => { local.trustedCompletion.sourceProfiles[0].lineageFields = local.trustedCompletion.sourceProfiles[0].lineageFields.map((field) => field === 'outcomeDigest' ? 'evidenceDigest' : field); }],
    ['task lineage origin loses payload source', (local) => { local.trustedCompletion.sourceProfiles[0].lineageFieldOrigins.outcomeDigest = 'ENVELOPE'; }],
    ['assessment predicate allows guessed answer', (local) => { local.trustedCompletion.sourceProfiles[1].qualifiedPredicate.guessSignal = true; }],
    ['assessment predicate loses objective correctness', (local) => { delete local.trustedCompletion.sourceProfiles[1].qualifiedPredicate.objectiveCorrect; }],
    ['mastery predicate accepts D7 failure', (local) => { local.trustedCompletion.sourceProfiles[2].qualifiedPredicate.d7Gate = 'FAILED'; }],
    ['mastery stage injection', (local) => { local.trustedCompletion.sourceProfiles[2].qualifiedPredicate.masteryStageAfter.push('LEARNING'); }],
    ['completion lineage stripped', (local) => { local.trustedCompletion.sourceProfiles[0].lineageFields.pop(); }],
    ['completion dedupe loses rule version', (local) => { local.trustedCompletion.sourceProfiles[0].dedupeFields = local.trustedCompletion.sourceProfiles[0].dedupeFields.filter((field) => field !== 'rewardRuleVersion'); }],
    ['historical task event becomes eligible', (local) => { local.trustedCompletion.rejectedEventNames = local.trustedCompletion.rejectedEventNames.filter((name) => name !== 'learning.task.completed.v1'); }],
    ['review queue becomes eligible', (local) => { local.trustedCompletion.rejectedEventNames = local.trustedCompletion.rejectedEventNames.filter((name) => name !== 'learning.review.scheduled.v2'); }],
    ['review queue loses independent rejection classification', (local) => { local.trustedCompletion.rejectedCanonicalEvents = []; }],
    ['ledger mutate existing entry', (local) => { local.ledger.mutateExistingEntry = 'ALLOW'; }],
    ['ledger correction overwrites', (local) => { local.ledger.correctionModel = 'UPDATE_EXISTING'; }],
    ['ledger client write allowed', (local) => { local.ledger.directClientWrite = 'ALLOW'; }],
    ['ledger type injection', (local) => { local.ledger.allowedEntryTypes.push('UPDATE'); }],
    ['random reward becomes paid', (local) => { local.randomRewards.paymentRequirement = 'PAID_ALLOWED'; }],
    ['paid random box allowed', (local) => { local.randomRewards.paidRandomBox = 'ALLOW'; }],
    ['cash withdrawal allowed', (local) => { local.randomRewards.cashOrWithdrawal = 'ALLOW'; }],
    ['probability audit removed', (local) => { local.randomRewards.probabilityAuditRequired = false; }],
    ['client controls random outcome', (local) => { local.randomRewards.clientCanSupplyProbabilityOrOutcome = true; }],
    ['random reward unknown field', (local) => { local.randomRewards.clientProbability = 1; }],
    ['P0 catalog expands', (local) => { local.gameCatalog.phase1EnabledModes.push('VOCABULARY_BATTLE'); }],
    ['Sentence Train removed', (local) => { local.gameCatalog.phase1EnabledModes = []; }],
    ['disabled catalog code drifts', (local) => { local.gameCatalog.phase1DefaultDisabledModes[0] = 'VOCABULARY_BATTLE'; }],
    ['catalog entry is enabled before its gate', (local) => { local.gameCatalog.catalogEntries[1].enabled = true; }],
    ['catalog entry phase drifts', (local) => { local.gameCatalog.catalogEntries[4].releasePhase = 'P1'; }],
    ['Sentence Train loses server gate', (local) => { local.gameCatalog.sentenceTrainRequirement = 'CLIENT_GATED'; }],
    ['public room capacity floor drift', (local) => { local.socialSpaces.spaceTypes[0].minCapacity = 19; }],
    ['public room capacity ceiling drift', (local) => { local.socialSpaces.spaceTypes[0].maxCapacity = 31; }],
    ['public room P0 gate disabled', (local) => { local.socialSpaces.spaceTypes[0].initialGate.enabled = false; }],
    ['invite room capacity floor drift', (local) => { local.socialSpaces.spaceTypes[1].minCapacity = 1; }],
    ['invite room capacity ceiling drift', (local) => { local.socialSpaces.spaceTypes[1].maxCapacity = 9; }],
    ['invite room P1 gate enabled', (local) => { local.socialSpaces.spaceTypes[1].initialGate.enabled = true; }],
    ['checkin group capacity floor drift', (local) => { local.socialSpaces.spaceTypes[2].minCapacity = 2; }],
    ['checkin group capacity ceiling drift', (local) => { local.socialSpaces.spaceTypes[2].maxCapacity = 11; }],
    ['checkin group lease enabled', (local) => { local.socialSpaces.spaceTypes[2].seatLease = 'REQUIRED'; }],
    ['checkin group P1 gate enabled', (local) => { local.socialSpaces.spaceTypes[2].initialGate.enabled = true; }],
    ['lease TTL drift', (local) => { local.socialSpaces.seatLease.ttlSeconds = 91; }],
    ['lease renewal drift', (local) => { local.socialSpaces.seatLease.renewEverySeconds = 31; }],
    ['lease reconnect drift', (local) => { local.socialSpaces.seatLease.disconnectRecoverySeconds = 61; }],
    ['lease inactivity release drift', (local) => { local.socialSpaces.seatLease.noLearningActivityReleaseSeconds = 301; }],
    ['focus duration drift', (local) => { local.socialSpaces.seatLease.focusDurationsMinutes = [25]; }],
    ['client lease expiry accepted', (local) => { local.socialSpaces.seatLease.clientMaySetLeaseExpiry = true; }],
    ['client finish becomes focus proof', (local) => { local.socialSpaces.seatLease.focusCreditPolicy.clientFinishActionIsProof = true; }],
    ['client heartbeat gains minute authority', (local) => { local.socialSpaces.seatLease.focusCreditPolicy.clientHeartbeatAuthority = 'CREDIT'; }],
    ['offline success gains minute authority', (local) => { local.socialSpaces.seatLease.focusCreditPolicy.offlineSuccessAuthority = 'CREDIT'; }],
    ['non-completed focus earns minutes', (local) => { local.socialSpaces.seatLease.focusCreditPolicy.nonQualifiedCreditMinutes = 1; }],
    ['focus completion triggers rewards', (local) => { local.socialSpaces.seatLease.focusCreditPolicy.rewardTrigger = 'ALLOW'; }],
    ['checkin realtime presence asserted', (local) => { local.socialSpaces.checkinGoalGroup.realtimePresence = 'ENABLED'; }],
    ['leaderboard client score allowed', (local) => { local.leaderboard.clientMaySetScore = true; }],
    ['leaderboard non-settled source', (local) => { local.leaderboard.sourceFacts = 'CLIENT_STREAM'; }],
    ['leaderboard privacy injection', (local) => { local.leaderboard.privacyModes.push('PUBLIC_ID'); }],
    ['leaderboard mastery source group drifts', (local) => { local.leaderboard.metricSources[1].consumerGroup = 'cg.client.v1'; }],
    ['leaderboard XP source becomes client fact', (local) => { local.leaderboard.metricSources[2].sourceKind = 'CLIENT_EVENT'; }],
    ['leaderboard tie-break pin removed', (local) => { local.leaderboard.snapshotFields = local.leaderboard.snapshotFields.filter((field) => field !== 'tieBreakVersion'); }],
    ['low UGC relaxed', (local) => { local.moderation.phase1UgcMode = 'FREE_TEXT'; }],
    ['free text allowed', (local) => { local.moderation.freeText = 'ALLOW'; }],
    ['direct message allowed', (local) => { local.moderation.forbiddenSubmissionFields = local.moderation.forbiddenSubmissionFields.filter((field) => field !== 'directMessage'); }],
    ['event transport weakened', (local) => { local.events.transport = 'CLIENT_HTTP'; }],
    ['cross-service write allowed', (local) => { local.events.crossServiceWrite = 'ALLOW'; }],
    ['phase one paid random ban removed', (local) => { local.phase1Prohibitions = local.phase1Prohibitions.filter((entry) => entry !== 'PAID_RANDOM_REWARD'); }],
  ];

  assert(cases.length >= 50, `expected at least 50 adversarial cases, received ${cases.length}`);
  for (const [name, mutate] of cases) {
    await t.test(name, () => assertPolicyMutationFails(mutate));
  }
});

function assertProjectionMutationFails(mutate) {
  const inputs = cloneInputs();
  mutate(inputs);
  const report = validateGamificationSocialContractData(inputs);
  assert.equal(report.result, 'FAIL', report.errors.join('\n'));
}

test('M1-014 exact OpenAPI, event, source-file, authority, and D2 mappings fail closed', async (t) => {
  const cases = [
    ['approved source file list emptied', (inputs) => { inputs.policy.compatibilityPromotion.approvedSourceFiles = []; }],
    ['canonical route list emptied', (inputs) => { inputs.policy.compatibilityPromotion.canonicalRoutes = []; }],
    ['canonical event list emptied', (inputs) => { inputs.policy.compatibilityPromotion.approvedCanonicalEvents = []; }],
    ['canonical OpenAPI route removed', (inputs) => { delete inputs.canonicalOpenApi.paths['/api/v1/games/catalog']; }],
    ['gamification permission drifts from the frozen route', (inputs) => {
      inputs.canonicalOpenApi.paths['/api/v1/gamification/me/summary'].get
        ['x-authorization'].requiredPermission = 'gamification.read.any';
    }],
    ['social permission is omitted from the canonical route', (inputs) => {
      delete inputs.canonicalOpenApi.paths['/api/v1/social/rooms'].get
        ['x-authorization'].requiredPermission;
    }],
    ['secondary permission declaration conflicts with the frozen route', (inputs) => {
      inputs.canonicalOpenApi.paths['/api/v1/gamification/me/summary'].get
        ['x-permission'] = 'gamification.read.any';
    }],
    ['unapproved tagged OpenAPI route added', (inputs) => {
      const operation = structuredClone(inputs.canonicalOpenApi.paths['/api/v1/games/catalog'].get);
      operation.operationId = 'unapprovedM1014Route';
      inputs.canonicalOpenApi.paths['/api/v1/games/unapproved'] = { get: operation };
    }],
    ['event fragment entry removed', (inputs) => {
      inputs.eventFragment.events = inputs.eventFragment.events.filter((event) => event.eventName !== 'social.report.created.v2');
    }],
    ['event catalog entry removed', (inputs) => {
      inputs.eventCatalog.events = inputs.eventCatalog.events.filter((event) => event.eventName !== 'learning.task.completed.v2');
    }],
    ['event catalog M1 payload schema removed', (inputs) => { delete inputs.eventCatalog.payloadSchemas.M1014LearningTaskCompleted; }],
    ['client authority field is accepted by a request schema', (inputs) => {
      inputs.canonicalOpenApi.components.schemas.M1014GameSessionCreateRequest.properties.role = { type: 'string' };
    }],
    ['client request unknown fields are accepted', (inputs) => {
      inputs.canonicalOpenApi.components.schemas.M1014GameSessionCreateRequest.additionalProperties = true;
    }],
    ['trusted completion profile coupling removed', (inputs) => {
      delete inputs.canonicalOpenApi.components.schemas.M1014TrustedCompletion.oneOf;
    }],
    ['trusted completion producer/event coupling crossed', (inputs) => {
      inputs.canonicalOpenApi.components.schemas.M1014TrustedCompletion.oneOf[0]
        .properties.eventName.const = 'assessment.item.assessed.v2';
    }],
    ['trusted completion predicate coupling weakened', (inputs) => {
      inputs.canonicalOpenApi.components.schemas.M1014TrustedCompletion.oneOf[1]
        .properties.qualifiedPredicate.required.pop();
    }],
    ['trusted completion lineage coupling weakened', (inputs) => {
      inputs.canonicalOpenApi.components.schemas.M1014TrustedCompletion.oneOf[2]
        .properties.lineage.required.pop();
    }],
    ['mastery lineage substitutes outcome digest', (inputs) => {
      const lineage = inputs.canonicalOpenApi.components.schemas.M1014TrustedCompletion.properties.lineage.oneOf[2];
      lineage.required = lineage.required.map((field) => field === 'evidenceDigest' ? 'outcomeDigest' : field);
      lineage.properties.outcomeDigest = lineage.properties.evidenceDigest;
      delete lineage.properties.evidenceDigest;
    }],
    ['mastery lineage loses prior stage', (inputs) => {
      const lineage = inputs.canonicalOpenApi.components.schemas.M1014TrustedCompletion.properties.lineage.oneOf[2];
      lineage.required = lineage.required.filter((field) => field !== 'masteryStageBefore');
      delete lineage.properties.masteryStageBefore;
    }],
    ['disabled game becomes a create-session input', (inputs) => {
      inputs.canonicalOpenApi.components.schemas.M1014GameSessionCreateRequest.properties.gameCode = {
        type: 'string', enum: ['SENTENCE_TRAIN', 'WORD_MATCH'],
      };
    }],
    ['disabled game becomes a successful session projection', (inputs) => {
      inputs.canonicalOpenApi.components.schemas.M1014GameSession.properties.gameCode = {
        type: 'string', enum: ['SENTENCE_TRAIN', 'WORD_MATCH'],
      };
    }],
    ['catalog cursor page minimum drifts from the canonical empty-page bound', (inputs) => {
      inputs.canonicalOpenApi.components.schemas.M1014GameCatalog.properties.items.minItems = 1;
    }],
    ['catalog cursor page cannot represent all fixed entries', (inputs) => {
      inputs.canonicalOpenApi.components.schemas.M1014GameCatalog.properties.items.maxItems = 5;
    }],
    ['catalog unique game-code policy removed', (inputs) => {
      delete inputs.canonicalOpenApi.components.schemas.M1014GameCatalog.properties.items['x-unique-by'];
    }],
    ['game catalog replaces the canonical cursor parameter', (inputs) => {
      inputs.canonicalOpenApi.paths['/api/v1/games/catalog'].get.parameters[0] = {
        $ref: '#/components/parameters/M1014Cursor',
      };
    }],
    ['study-room list replaces the canonical page-size parameter', (inputs) => {
      inputs.canonicalOpenApi.paths['/api/v1/social/rooms'].get.parameters[1] = {
        $ref: '#/components/parameters/M1014PageSize',
      };
    }],
    ['game catalog cursor metadata drifts', (inputs) => {
      inputs.canonicalOpenApi.paths['/api/v1/games/catalog'].get['x-pagination'].responseMeta =
        '#/components/schemas/ApiResponseMeta';
    }],
    ['study-room list loses canonical page envelope', (inputs) => {
      inputs.canonicalOpenApi.paths['/api/v1/social/rooms'].get.responses[200]
        .content['application/json'].schema.allOf[0] = { $ref: '#/components/schemas/ApiSuccessEnvelope' };
    }],
    ['study-room data duplicates meta cursor state', (inputs) => {
      const roomPage = inputs.canonicalOpenApi.components.schemas.M1014RoomPage;
      roomPage.required.push('nextCursor');
      roomPage.properties.nextCursor = { type: 'string', maxLength: 256, nullable: true };
    }],
    ['custom M1-014 pagination aliases are restored', (inputs) => {
      inputs.canonicalOpenApi.components.parameters.M1014Cursor = {
        name: 'cursor', in: 'query', required: false, schema: { type: 'string' },
      };
    }],
    ['focus update loses optimistic version', (inputs) => {
      inputs.canonicalOpenApi.components.schemas.M1014FocusUpdateCommand.required = ['focusId', 'action'];
    }],
    ['non-completed focus can earn minutes', (inputs) => {
      inputs.canonicalOpenApi.components.schemas.M1014FocusSession.oneOf[1].properties.creditedMinutes.const = 25;
    }],
    ['offline success becomes focus proof', (inputs) => {
      inputs.canonicalOpenApi.components.schemas.M1014FocusSession['x-focus-credit-policy'].offlineSuccessAuthority = 'CREDIT';
    }],
    ['leaderboard loses tie-break pin', (inputs) => {
      inputs.canonicalOpenApi.components.schemas.M1014Leaderboard.required = inputs.canonicalOpenApi.components.schemas.M1014Leaderboard.required.filter((field) => field !== 'tieBreakVersion');
    }],
    ['trusted social event accepts unrelated event', (inputs) => {
      inputs.canonicalOpenApi.components.schemas.M1014TrustedSocialEvent.properties.eventName.enum.push('social.report.created.v2');
    }],
    ['trusted social source and event are crossed', (inputs) => {
      inputs.canonicalOpenApi.components.schemas.M1014TrustedSocialEvent.oneOf[0].properties.sourceService.const = 'gamification-service';
    }],
    ['trusted social source is no longer bound to workload identity', (inputs) => {
      inputs.canonicalOpenApi.components.schemas.M1014TrustedSocialEvent['x-trusted-event-boundary'].sourceServiceBinding = 'TRUST_BODY';
    }],
    ['mastered-word projection accepts repeat mastered stage', (inputs) => {
      inputs.canonicalOpenApi.components.schemas.M1014LeaderboardMasteryFact.properties.masteryStageBefore.enum.push('MASTERED');
    }],
    ['XP projection drops append-only lineage identity', (inputs) => {
      inputs.canonicalOpenApi.components.schemas.M1014LeaderboardXpFact.required = inputs.canonicalOpenApi.components.schemas.M1014LeaderboardXpFact.required.filter((field) => field !== 'ledgerEntryId');
    }],
    ['B26 static data promotes runtime', (inputs) => { inputs.b26Runtime.defaultDecision = 'GO'; }],
    ['B26 social mastery consumer removed', (inputs) => {
      inputs.b26Runtime.eventRouting.find((route) => route.eventName === 'learning.mastery.projected.v2').consumerGroups = inputs.b26Runtime.eventRouting.find((route) => route.eventName === 'learning.mastery.projected.v2').consumerGroups.filter((group) => group !== 'cg.social-from-learning.v1');
    }],
    ['mastery state transition becomes a payload field', (inputs) => {
      inputs.eventCatalog.payloadSchemas.B10LearningMasteryProjectedV2.properties.stateTransition = { type: 'boolean' };
    }],
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, () => assertProjectionMutationFails(mutate));
  }
});

test('adversarial trusted-completion candidates fail closed', async (t) => {
  const assessment = policy.trustedCompletion.sourceProfiles.find((profile) => profile.id === 'ASSESSMENT_ITEM_CORRECT');
  const mastery = policy.trustedCompletion.sourceProfiles.find((profile) => profile.id === 'MASTERY_MILESTONE');
  const cases = [
    ['historical v1 event', () => ({ ...candidateFor(assessment), eventName: 'learning.task.completed.v1' })],
    ['review scheduled queue fact', () => ({ ...candidateFor(assessment), eventName: 'learning.review.scheduled.v2' })],
    ['unknown producer', () => ({ ...candidateFor(assessment), producerService: 'client-app' })],
    ['wrong schema version', () => ({ ...candidateFor(assessment), schemaVersion: 'v1' })],
    ['guessed objective answer', () => ({ ...candidateFor(assessment), qualifiedPredicate: { ...assessment.qualifiedPredicate, guessSignal: true } })],
    ['empty rule version', () => ({ ...candidateFor(assessment), rewardRuleVersion: '' })],
    ['missing lineage fact', () => { const candidate = candidateFor(assessment); delete candidate.lineage.outcomeDigest; return candidate; }],
    ['unknown lineage fact', () => { const candidate = candidateFor(assessment); candidate.lineage.clientAward = '999'; return candidate; }],
    ['mastery D7 failure', () => { const candidate = candidateFor(mastery); candidate.qualifiedPredicate.d7Gate.result = 'FAILED'; return candidate; }],
    ['mastery non-transition', () => { const candidate = candidateFor(mastery); candidate.qualifiedPredicate.stateTransition = false; return candidate; }],
    ['malformed content pin', () => { const candidate = candidateFor(assessment); candidate.lineage.contentPin.contentVersionId = 0; return candidate; }],
    ['malformed outcome digest', () => { const candidate = candidateFor(assessment); candidate.lineage.outcomeDigest = 'not-a-digest'; return candidate; }],
    ['mastery projection version zero', () => { const candidate = candidateFor(mastery); candidate.lineage.projectionVersion = 0; return candidate; }],
    ['mastery stage before unknown', () => { const candidate = candidateFor(mastery); candidate.lineage.masteryStageBefore = 'UNKNOWN'; return candidate; }],
    ['candidate client score injection', () => ({ ...candidateFor(assessment), clientScore: 999 })],
    ['invalid frozen policy passed to candidate validator', () => candidateFor(assessment), (local) => { local.randomRewards.probabilityAuditRequired = false; }],
  ];
  for (const [name, makeCandidate, mutatePolicy] of cases) {
    await t.test(name, () => {
      const localPolicy = clonePolicy();
      mutatePolicy?.(localPolicy);
      const report = validateTrustedCompletionCandidate({ candidate: makeCandidate(), policy: localPolicy });
      assert.equal(report.result, 'FAIL', report.errors.join('\n'));
      assert.equal(report.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
    });
  }
});
