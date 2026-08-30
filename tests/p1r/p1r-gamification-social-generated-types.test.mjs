import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..', '..');
const require = createRequire(import.meta.url);
const tscPath = require.resolve('typescript/bin/tsc');

function compileFixture(source) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'p1r-gamification-social-generated-types-'));
  try {
    const fixturePath = path.join(temporaryRoot, 'fixture.ts');
    const tsconfigPath = path.join(temporaryRoot, 'tsconfig.json');
    fs.writeFileSync(fixturePath, source, 'utf8');
    fs.writeFileSync(tsconfigPath, `${JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022', 'DOM'],
        module: 'ESNext',
        moduleResolution: 'Bundler',
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        baseUrl: root,
        paths: {
          '@englishflow/contracts': ['packages/contracts/generated/index.ts'],
          '@englishflow/api-client': ['packages/api-client/src/index.ts'],
        },
      },
      files: [fixturePath],
    }, null, 2)}\n`, 'utf8');
    return spawnSync(process.execPath, [tscPath, '--pretty', 'false', '--project', tsconfigPath], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
    });
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

test('M1-014 generated types preserve trusted profile coupling and client authority boundaries', () => {
  const result = compileFixture(`
import type {
  M1014FocusSession,
  M1014FocusUpdateCommand,
  M1014GameSessionCreateRequest,
  M1014Leaderboard,
  M1014RoomJoinRequest,
  M1014TrustedCompletion,
  M1014TrustedSocialEvent,
} from '@englishflow/contracts';
import type { GeneratedApiOperationRegistry } from '@englishflow/api-client';

type Assert<T extends true> = T;
type SettlementRequest = GeneratedApiOperationRegistry['settleM1014TrustedCompletion']['request'];
type SameSettlementRequest = Assert<
  SettlementRequest extends M1014TrustedCompletion
    ? M1014TrustedCompletion extends SettlementRequest ? true : false
    : false
>;
type SettlementBodyRequired = Assert<
  GeneratedApiOperationRegistry['settleM1014TrustedCompletion']['requestBodyRequired'] extends true ? true : false
>;
type GameBodyRequired = Assert<
  GeneratedApiOperationRegistry['createM1014GameSession']['requestBodyRequired'] extends true ? true : false
>;

const contentPin = {
  contentVersionId: 1,
  contentEpoch: 0,
  snapshotId: 'snapshot-1',
  snapshotHash: 'a'.repeat(64),
};

const taskCompletion = {
  producerService: 'learning-service',
  eventName: 'learning.task.completed.v2',
  schemaVersion: 'v2',
  qualifiedPredicate: {
    taskStatus: 'COMPLETED',
    completionFact: 'SERVER_SETTLED',
  },
  rewardRuleVersion: 'reward-rule.v1',
  lineage: {
    eventId: 'event-task-1',
    traceId: 'trace-task-1',
    schemaVersion: 'v2',
    taskId: 'task-1',
    completionVersion: 'completion-v1',
    rootEventId: 'root-event-1',
    contentPin,
    rulePin: {
      completionRuleVersion: 'completion-rule.v1',
      ruleDigest: 'b'.repeat(64),
    },
    outcomeDigest: 'c'.repeat(64),
  },
} satisfies M1014TrustedCompletion;

const masteryCompletion = {
  producerService: 'learning-service',
  eventName: 'learning.mastery.projected.v2',
  schemaVersion: 'v2',
  qualifiedPredicate: {
    masteryStageAfter: 'MASTERED',
    d7Gate: { result: 'PASSED', reasonCode: 'D7_PASSED' },
    stateTransition: true,
  },
  rewardRuleVersion: 'reward-rule.v1',
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
    evidenceDigest: 'd'.repeat(64),
  },
} satisfies M1014TrustedCompletion;

// @ts-expect-error an assessment event cannot reuse task predicate and lineage facts.
const crossedProfile: M1014TrustedCompletion = {
  producerService: 'assessment-service',
  eventName: 'assessment.item.assessed.v2',
  schemaVersion: 'v2',
  qualifiedPredicate: taskCompletion.qualifiedPredicate,
  rewardRuleVersion: 'reward-rule.v1',
  lineage: taskCompletion.lineage,
};

const invalidMasteryDigest: M1014TrustedCompletion = {
  producerService: 'learning-service',
  eventName: 'learning.mastery.projected.v2',
  schemaVersion: 'v2',
  qualifiedPredicate: {
    masteryStageAfter: 'MASTERED',
    d7Gate: { result: 'PASSED', reasonCode: 'D7_PASSED' },
    stateTransition: true,
  },
  rewardRuleVersion: 'reward-rule.v1',
  // @ts-expect-error mastery completion uses evidenceDigest and rejects outcomeDigest.
  lineage: {
    eventId: 'event-mastery-2',
    traceId: 'trace-mastery-2',
    schemaVersion: 'v2',
    projectionId: 'projection-2',
    masteryEpochId: 'epoch-2',
    masteryEpochVersion: 1,
    projectionVersion: 1,
    sourceAssessmentEventId: 'assessment-event-2',
    sourceItemAssessmentId: 'item-assessment-2',
    contentPin,
    masteryStageBefore: 'LEARNING',
    masteryRuleVersion: 'mastery-rule.v1',
    evidenceDigest: 'd'.repeat(64),
    outcomeDigest: 'e'.repeat(64),
  },
};

const gameRequest = {
  gameCode: 'SENTENCE_TRAIN',
  performanceTier: 'Performance',
} satisfies M1014GameSessionCreateRequest;
const forbiddenGameAuthority = {
  gameCode: 'SENTENCE_TRAIN',
  // @ts-expect-error rewardAmount is server-derived and absent from the public request.
  rewardAmount: 100,
} satisfies M1014GameSessionCreateRequest;
const forbiddenRoomAuthority = {
  preferredSeatIndex: 1,
  // @ts-expect-error leaseExpiresAt is server-derived and absent from the public request.
  leaseExpiresAt: '2026-08-31T00:00:00Z',
} satisfies M1014RoomJoinRequest;
// @ts-expect-error unknown game codes are denied by the generated catalog type.
const unknownGame: M1014GameSessionCreateRequest = { gameCode: 'CLIENT_GAME' };
// @ts-expect-error P1 catalog entries remain disabled during the P0 gate.
const disabledGame: M1014GameSessionCreateRequest = { gameCode: 'WORD_MATCH' };

const focusUpdate = {
  focusId: 'focus_12345678',
  expectedFocusVersion: 1,
  action: 'FINISH',
} satisfies M1014FocusUpdateCommand;
// @ts-expect-error focus updates must carry the last server-issued version.
const unversionedFocusUpdate: M1014FocusUpdateCommand = { focusId: 'focus_12345678', action: 'FINISH' };
const forbiddenHeartbeat = {
  focusId: 'focus_12345678',
  expectedFocusVersion: 1,
  action: 'FINISH',
  // @ts-expect-error heartbeat is not a source of focus credit.
  heartbeat: true,
} satisfies M1014FocusUpdateCommand;
const activeFocus = {
  focusId: 'focus_12345678',
  roomId: 'room_12345678',
  seatId: 'seat_12345678',
  leaseId: 'lease_12345678',
  leaseVersion: 1,
  focusVersion: 1,
  state: 'PAUSED',
  durationMinutes: 25,
  creditedMinutes: 0,
  startedAt: '2026-08-31T00:00:00Z',
  endsAt: '2026-08-31T00:25:00Z',
  serverTime: '2026-08-31T00:05:00Z',
} satisfies M1014FocusSession;
// @ts-expect-error non-completed focus states cannot receive credited minutes.
const forgedFocusCredit: M1014FocusSession = {
  focusId: 'focus_12345678', roomId: 'room_12345678', seatId: 'seat_12345678',
  leaseId: 'lease_12345678', leaseVersion: 1, focusVersion: 1, state: 'PAUSED',
  durationMinutes: 25, creditedMinutes: 25, startedAt: '2026-08-31T00:00:00Z',
  endsAt: '2026-08-31T00:25:00Z', serverTime: '2026-08-31T00:05:00Z',
};

const masterySocialFact = {
  eventId: 'event-mastered-1',
  eventName: 'learning.mastery.projected.v2',
  schemaVersion: 'v2',
  aggregateId: 'mp_12345678',
  occurredAt: '2026-08-31T00:00:00Z',
  actorId: 'prn_123456789012345',
  traceId: 'trace-mastered-1',
  requestId: 'request-mastered-1',
  dedupeKey: 'dedupe-mastered-1',
  sourceService: 'learning-service',
  payload: {
    tenantId: 'tenant_1', principalId: 'prn_123456789012345', projectionId: 'mp_12345678',
    logicalItemId: 'li_12345678', masteryEpochId: 'mep_12345678', masteryEpochVersion: 1,
    projectionVersion: 1, masteryStageBefore: 'LEARNING', masteryStageAfter: 'MASTERED',
    evidenceDigest: 'a'.repeat(64), masteryRuleVersion: 'P1_MASTERY_V1',
    masteryFactWatermark: 'wm_1', projectedAt: '2026-08-31T00:00:00Z',
  },
} satisfies M1014TrustedSocialEvent;
// @ts-expect-error a learning mastery payload cannot be paired with the gamification producer.
const crossedSocialFact: M1014TrustedSocialEvent = {
  ...masterySocialFact,
  sourceService: 'gamification-service',
};

const leaderboard = {
  snapshotId: 'snap_12345678', metric: 'MASTERED_WORDS', period: 'DAY',
  timezoneId: 'Asia/Shanghai', projectionVersion: 1, ruleVersion: 'leaderboard.v1',
  tieBreakVersion: 'tie-break.v1', snapshotAt: '2026-08-31T00:00:00Z', watermark: 'wm_1',
  auditRef: 'audit_1', entries: [], me: { present: false, visibility: 'OPT_OUT' }, delayed: false,
} satisfies M1014Leaderboard;
// @ts-expect-error leaderboard projections must pin their tie-break rule.
const unpinnedLeaderboard: M1014Leaderboard = {
  snapshotId: 'snap_12345678', metric: 'XP', period: 'WEEK', timezoneId: 'Asia/Shanghai',
  projectionVersion: 1, ruleVersion: 'leaderboard.v1', snapshotAt: '2026-08-31T00:00:00Z',
  watermark: 'wm_1', auditRef: 'audit_1', entries: [],
  me: { present: false, visibility: 'OPT_OUT' }, delayed: false,
};

void taskCompletion;
void masteryCompletion;
void crossedProfile;
void invalidMasteryDigest;
void gameRequest;
void forbiddenGameAuthority;
void forbiddenRoomAuthority;
void unknownGame;
void disabledGame;
void focusUpdate;
void unversionedFocusUpdate;
void forbiddenHeartbeat;
void activeFocus;
void forgedFocusCredit;
void masterySocialFact;
void crossedSocialFact;
void leaderboard;
void unpinnedLeaderboard;
type _Keep = SameSettlementRequest | SettlementBodyRequired | GameBodyRequired;
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
