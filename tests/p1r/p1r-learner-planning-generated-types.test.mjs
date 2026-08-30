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
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'p1r-learner-planning-generated-types-'));
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

test('generated learner planning types preserve closed input, canonical values, recovery read-only and first-day never branches', () => {
  const result = compileFixture(`
import type {
  B9FirstDayProjection,
  B9FirstDayRecovery,
  B9GoalOption,
  B9LearnerPreferences,
  B9LearnerPreferencesPatch,
  B9LearnerProfilePatch,
  B9LearnerTargetUpsert,
  B9PlanningInputSnapshot,
  B9PlanningJobRef,
  B9PlanReference,
} from '@englishflow/contracts';
import {
  requestApiOperation,
  type ApiClient,
  type GeneratedApiOperationRegistry,
} from '@englishflow/api-client';

type Assert<T extends true> = T;
type RecoveryReadRequestIsNever = Assert<
  GeneratedApiOperationRegistry['getB9FirstDayRecovery']['request'] extends never ? true : false
>;
type TargetRequestIsPresent = Assert<
  GeneratedApiOperationRegistry['putB9LearnerTarget']['request'] extends never ? false : true
>;
type TargetBodyIsRequired = Assert<
  GeneratedApiOperationRegistry['putB9LearnerTarget']['requestBodyRequired'] extends true ? true : false
>;

const option = {
  goalCode: 'FOUNDATION' as const,
  label: '基础',
  targetLevels: ['A1'],
  dailyQuotaMinutes: [5, 15, 30, 45],
} satisfies B9GoalOption;
// @ts-expect-error labels are required localized catalog data.
const invalidOption: B9GoalOption = { goalCode: 'FOUNDATION', targetLevels: ['A1'], dailyQuotaMinutes: [5] };

const acceptedGoal: B9LearnerTargetUpsert['goalCode'] = 'WORKPLACE_DAILY';
const acceptedDuration: B9LearnerTargetUpsert['dailyQuotaMinutes'] = 45;
// @ts-expect-error legacy daily durations are not accepted by generated canonical types.
const rejectedDuration: B9LearnerTargetUpsert['dailyQuotaMinutes'] = 10;
// @ts-expect-error arbitrary goal codes are not accepted by generated canonical types.
const rejectedGoal: B9LearnerTargetUpsert['goalCode'] = 'K12';

const target = {
  expectedStateVersion: 0,
  goalCode: 'COLLEGE_CET' as const,
  targetLevel: 'B1' as const,
  dailyQuotaMinutes: 30 as const,
} satisfies B9LearnerTargetUpsert;
const rejectedTargetAuthority: B9LearnerTargetUpsert = {
  expectedStateVersion: 0,
  goalCode: 'COLLEGE_CET',
  targetLevel: 'B1',
  dailyQuotaMinutes: 30,
  // @ts-expect-error targetVersion is server-owned and absent from a canonical request type.
  targetVersion: 1,
};

const preferences: B9LearnerPreferences = {
  uiLocale: 'zh-CN',
  contentLocale: 'en-US',
  timezone: 'Asia/Shanghai',
  weeklyStudyDays: [1, 3, 5],
  themeMode: 'SYSTEM',
  highContrast: false,
  motionMode: 'REDUCED',
  preferenceVersion: 1,
  stateVersion: 1,
  updatedAt: '2026-08-30T00:00:00Z',
};
const preferencePatch: B9LearnerPreferencesPatch = { expectedStateVersion: 1, weeklyStudyDays: [2, 4, 6] };
const profilePatch: B9LearnerProfilePatch = { expectedStateVersion: 1, timezone: 'Asia/Shanghai' };
const rejectedProfileTargetGoal: B9LearnerProfilePatch = {
  expectedStateVersion: 1,
  // @ts-expect-error targetGoal is a read-only historical shadow and PATCH rejects it with 422.
  targetGoal: 'COLLEGE_CET',
};
// @ts-expect-error weeklyStudyDays is required in the response projection.
const rejectedPreferences: B9LearnerPreferences = { ...preferences, weeklyStudyDays: undefined };

const planningInput = {
  pinId: 'pin-1',
  pinVersion: 1,
  pinDigest: 'a'.repeat(64),
  targetId: 1,
  targetVersion: 1,
  profileVersion: 1,
  preferenceVersion: 1,
  goalCatalogVersion: 'catalog-v1',
  dailyQuotaMinutes: 15,
  timezone: 'Asia/Shanghai',
  weeklyStudyDays: [1, 2],
  contentLocale: 'en-US',
  contentEpoch: 1,
  projectionVersion: 1,
  rightsSnapshotVersion: 1,
  eligibilitySnapshotVersion: 1,
  eligibilitySnapshotDigest: 'b'.repeat(64),
  planningRuleVersion: 'rule-v1',
  inputFactWatermark: 'watermark-1',
  sourceEventId: 'evt-1',
  rootEventId: 'evt-root-1',
} satisfies B9PlanningInputSnapshot;
const rejectedPlanningAuthority = {
  pinId: 'pin-1', pinVersion: 1, pinDigest: 'a'.repeat(64), targetId: 1, targetVersion: 1,
  profileVersion: 1, preferenceVersion: 1, goalCatalogVersion: 'catalog-v1', dailyQuotaMinutes: 15,
  timezone: 'Asia/Shanghai', weeklyStudyDays: [1, 2], contentLocale: 'en-US', contentEpoch: 1,
  projectionVersion: 1, rightsSnapshotVersion: 1, eligibilitySnapshotVersion: 1, eligibilitySnapshotDigest: 'b'.repeat(64), planningRuleVersion: 'rule-v1', inputFactWatermark: 'watermark-1',
  sourceEventId: 'evt-1', rootEventId: 'evt-root-1',
  // @ts-expect-error IAM eligibility remains a server-derived digest, never a raw client authority fact.
  adultGate: true,
} satisfies B9PlanningInputSnapshot;
// @ts-expect-error immutable planning snapshots require their digest pin.
const rejectedPlanningPin: B9PlanningInputSnapshot = {
  pinId: 'pin-1', pinVersion: 1, targetId: 1, targetVersion: 1, profileVersion: 1,
  preferenceVersion: 1, goalCatalogVersion: 'catalog-v1', dailyQuotaMinutes: 15, timezone: 'Asia/Shanghai',
  weeklyStudyDays: [1, 2], contentLocale: 'en-US', contentEpoch: 1, projectionVersion: 1,
  rightsSnapshotVersion: 1, eligibilitySnapshotVersion: 1, eligibilitySnapshotDigest: 'b'.repeat(64), planningRuleVersion: 'rule-v1', inputFactWatermark: 'watermark-1',
  sourceEventId: 'evt-1', rootEventId: 'evt-root-1',
};

declare const job: B9PlanningJobRef;
declare const plan: B9PlanReference;
declare const recovery: B9FirstDayRecovery & {
  status: 'RETRYABLE';
  retryable: true;
  safeFailureCode: 'DEPENDENCY_UNAVAILABLE';
};
declare const completedRecovery: B9FirstDayRecovery & {
  status: 'COMPLETED';
  retryable: false;
  safeFailureCode: 'NONE';
};
// OpenAPI/checker enforce taskCount minimum and tasks minItems at the wire boundary;
// generated TypeScript here verifies required fields, state discriminators and never branches.
const ready = {
  state: 'READY' as const,
  profileReady: true as const,
  targetReady: true as const,
  placementStatus: 'COMPLETED' as const,
  taskCount: 1,
  tasks: [{ taskId: 'task-1', taskType: 'LESSON' as const, status: 'AVAILABLE' as const, position: 0 }],
  contentEpoch: 1,
  projectionVersion: 1,
  projectionWatermark: 'projection-1',
  generatedAt: '2026-08-30T00:00:00Z',
  planningInput,
  plan,
} satisfies B9FirstDayProjection;
const readyWithRecovery = { ...ready, recovery };
// @ts-expect-error READY cannot carry a DEGRADED recovery branch.
const rejectedReadyRecovery: B9FirstDayProjection = readyWithRecovery;
const degraded = {
  state: 'DEGRADED' as const,
  profileReady: true as const,
  targetReady: true as const,
  placementStatus: 'COMPLETED' as const,
  taskCount: 0,
  tasks: [],
  contentEpoch: 1,
  projectionVersion: 1,
  projectionWatermark: 'projection-1',
  generatedAt: '2026-08-30T00:00:00Z',
  planningInput,
  degradedReason: 'PLAN_FAILED' as const,
  recovery,
} satisfies B9FirstDayProjection;
const degradedWithPlan = { ...degraded, plan };
// @ts-expect-error DEGRADED cannot masquerade as a ready plan projection.
const rejectedDegradedPlan: B9FirstDayProjection = degradedWithPlan;
const rejectedDegradedCompletedRecovery: B9FirstDayProjection = {
  ...degraded,
  // @ts-expect-error DEGRADED recovery cannot be a completed terminal recovery.
  recovery: completedRecovery,
};

const retryableRecovery = {
  recoveryTaskId: 'recovery-1',
  status: 'RETRYABLE' as const,
  planningInput,
  job,
  retryable: true as const,
  safeFailureCode: 'DEPENDENCY_UNAVAILABLE' as const,
  projectionVersion: 1,
  projectionWatermark: 'projection-1',
  createdAt: '2026-08-30T00:00:00Z',
  updatedAt: '2026-08-30T00:00:00Z',
} satisfies B9FirstDayRecovery;
const invalidRetryableRecovery = { ...retryableRecovery, retryable: false };
// @ts-expect-error RETRYABLE recovery requires retryable: true.
const rejectedRecoveryState: B9FirstDayRecovery = invalidRetryableRecovery;

declare const client: ApiClient;
void requestApiOperation(
  client,
  'putB9LearnerTarget',
  '/api/v1/learner/targets',
  { method: 'PUT', body: target },
);
void requestApiOperation(
  client,
  'getB9FirstDayRecovery',
  '/api/v1/learner/first-day/recovery/recovery-1',
  { method: 'GET' },
);
void requestApiOperation(
  client,
  'getB9FirstDayRecovery',
  '/api/v1/learner/first-day/recovery/recovery-1',
  // @ts-expect-error recovery remains a no-body GET.
  { method: 'GET', body: { retry: true } },
);
void requestApiOperation(
  client,
  'getB9FirstDayRecovery',
  // @ts-expect-error recovery path keeps its required recoveryTaskId parameter.
  '/api/v1/learner/first-day/recovery',
  { method: 'GET' },
);
void option;
void invalidOption;
void acceptedGoal;
void acceptedDuration;
void rejectedDuration;
void rejectedGoal;
void rejectedTargetAuthority;
void profilePatch;
void rejectedProfileTargetGoal;
void preferencePatch;
void rejectedPreferences;
void rejectedPlanningAuthority;
void rejectedPlanningPin;
void rejectedReadyRecovery;
void rejectedDegradedPlan;
void rejectedDegradedCompletedRecovery;
void rejectedRecoveryState;
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
