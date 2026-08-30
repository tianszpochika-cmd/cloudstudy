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
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'p1r-assessment-generated-types-'));
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

test('generated assessment types preserve closed answers, request bodies, states and discriminators', () => {
  const result = compileFixture(`
import type {
  B10AssessmentOutcome,
  B10AssessmentReport,
  B10AssessmentSession,
  B10Attempt,
  B10AttemptSubmission,
} from '@englishflow/contracts';
import {
  requestApiOperation,
  type ApiClient,
  type GeneratedApiOperationRegistry,
} from '@englishflow/api-client';

type Assert<T extends true> = T;
type GetSessionRequestIsNever = Assert<
  GeneratedApiOperationRegistry['getB10AssessmentSession']['request'] extends never ? true : false
>;
type CheckpointRequestIsPresent = Assert<
  GeneratedApiOperationRegistry['putB10AssessmentSessionCheckpoint']['request'] extends never ? false : true
>;
type CheckpointBodyIsRequired = Assert<
  GeneratedApiOperationRegistry['putB10AssessmentSessionCheckpoint']['requestBodyRequired'] extends true ? true : false
>;

const choice = {
  itemId: 1,
  sequence: 0,
  responseType: 'CHOICE' as const,
  responseDigest: 'digest',
  selectedOptionIds: ['option-a'],
} satisfies B10AttemptSubmission;

const text = {
  itemId: 2,
  sequence: 1,
  responseType: 'TEXT' as const,
  responseDigest: 'digest',
  text: 'answer',
} satisfies B10AttemptSubmission;

const choiceWithSibling = {
  itemId: 3,
  sequence: 2,
  responseType: 'CHOICE' as const,
  responseDigest: 'digest',
  selectedOptionIds: ['option-a'],
  pairs: [{ leftId: 'left', rightId: 'right' }],
};
// @ts-expect-error CHOICE cannot carry a MATCHING payload.
const rejectedSibling: B10AttemptSubmission = choiceWithSibling;

const unansweredWithText = {
  itemId: 4,
  sequence: 3,
  responseType: 'UNANSWERED' as const,
  responseDigest: 'digest',
  text: 'must not be present',
};
// @ts-expect-error UNANSWERED cannot carry TEXT payload.
const rejectedUnanswered: B10AttemptSubmission = unansweredWithText;

const choiceWithAuthority = {
  itemId: 5,
  sequence: 4,
  responseType: 'CHOICE' as const,
  responseDigest: 'digest',
  selectedOptionIds: ['option-a'],
  score: 1,
  answerRuleVersion: 'rule-v1',
};
// @ts-expect-error parent-level not must reject authority fields from a variable value too.
const rejectedAuthority: B10AttemptSubmission = choiceWithAuthority;

const missingDiscriminator = {
  itemId: 6,
  sequence: 5,
  responseDigest: 'digest',
  text: 'answer',
};
// @ts-expect-error responseType remains required for the discriminated union.
const rejectedMissingDiscriminator: B10AttemptSubmission = missingDiscriminator;

const checkpoint: GeneratedApiOperationRegistry['putB10AssessmentSessionCheckpoint']['request'] = {
  baseStateVersion: 1,
  checkpointVersion: 1,
  clientEventId: 'client-event-0001',
  clientSeq: 1,
  checkpointDigest: 'digest',
  protectedDraft: { responses: [choice, text] },
};
// @ts-expect-error protectedDraft is a required canonical checkpoint field.
const rejectedCheckpoint: GeneratedApiOperationRegistry['putB10AssessmentSessionCheckpoint']['request'] = {
  baseStateVersion: 1,
  checkpointVersion: 1,
  clientEventId: 'client-event-0001',
  clientSeq: 1,
  checkpointDigest: 'digest',
};

declare const client: ApiClient;
void requestApiOperation(
  client,
  'putB10AssessmentSessionCheckpoint',
  '/api/v1/assessment/sessions/session-1/checkpoint',
  { method: 'PUT', body: checkpoint },
);
// @ts-expect-error operation paths must keep the generated route shape.
void requestApiOperation(client, 'putB10AssessmentSessionCheckpoint', '/api/v1/assessment/reports/report-1', { method: 'PUT', body: checkpoint });
void requestApiOperation(
  client,
  'putB10AssessmentSessionCheckpoint',
  '/api/v1/assessment/sessions/session-1/checkpoint',
  // @ts-expect-error required OpenAPI request bodies cannot be omitted.
  { method: 'PUT' },
);
void requestApiOperation(
  client,
  'putB10AssessmentSessionCheckpoint',
  '/api/v1/assessment/sessions/session-1/checkpoint',
  // @ts-expect-error the generated HTTP method is required even when the body is valid.
  { body: checkpoint },
);
void requestApiOperation(
  client,
  'getB10AssessmentSession',
  '/api/v1/assessment/sessions/session-1',
  { method: 'GET' },
);
void requestApiOperation(
  client,
  'getB10AssessmentSession',
  '/api/v1/assessment/sessions/session-1',
  // @ts-expect-error no-body operations expose body?: never.
  { method: 'GET', body: {} },
);
void requestApiOperation(
  client,
  'getB10AssessmentSession',
  '/api/v1/assessment/sessions/session-1',
  // @ts-expect-error callers cannot override the generated HTTP method.
  { method: 'POST' },
);

const objective: B10AssessmentOutcome = {
  outcomeKind: 'OBJECTIVE',
  objectiveNumerator: 1,
  objectiveDenominator: 1,
  scoreBucket: 'FULL',
  errorCategory: 'NONE',
  reasonTrace: [{ ruleCode: 'rule', ruleVersion: 'rule-v1', category: 'NONE' }],
  outcomeDigest: 'digest',
};
declare const outcome: B10AssessmentOutcome;
if (outcome.outcomeKind === 'SELF_RATING') {
  // @ts-expect-error only OBJECTIVE carries an objective score summary.
  outcome.objectiveNumerator;
}

type AcceptedAttempt = B10Attempt & { status: 'ACCEPTED' };
type GeneratingReport = B10AssessmentReport & { status: 'GENERATING' };
declare let acceptedAttempt: AcceptedAttempt;
// @ts-expect-error accepted attempts cannot carry an outcome.
acceptedAttempt.outcome = objective;
declare let generatingReport: GeneratingReport;
// @ts-expect-error generating reports cannot carry an outcome.
generatingReport.outcome = objective;

const terminalSessionStatus: B10AssessmentSession['status'] = 'AUTO_SUBMITTED';
// @ts-expect-error session statuses remain distinct from attempt status.
const rejectedSessionStatus: B10AssessmentSession['status'] = 'ASSESSED';
void terminalSessionStatus;
void rejectedSibling;
void rejectedUnanswered;
void rejectedAuthority;
void rejectedMissingDiscriminator;
void rejectedCheckpoint;
void objective;
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
