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
const policy = JSON.parse(fs.readFileSync(path.join(root, 'config/p1r-learning-loop-contract.v1.json'), 'utf8'));
const generatedOpenApiPath = path.join(root, 'packages/contracts/generated/openapi.ts');
const generatedClientPath = path.join(root, 'packages/api-client/src/generated/index.ts');

function generatedText() {
  return `${fs.readFileSync(generatedOpenApiPath, 'utf8')}\n${fs.readFileSync(generatedClientPath, 'utf8')}`;
}

function hasM1013ReviewTypeShape() {
  const text = generatedText();
  const requiredRequestFields = [
    'snapshotItemId:', 'baseStateVersion:', 'clientEventId:', 'clientSeq:', 'contentPin:', 'payloadHash:',
    'sourceAssessmentAttemptId:', 'rawQuality:', 'clientOccurredAt:',
  ];
  return text.includes('type B10CompleteReviewRequest')
    && text.includes('completeB10LearningReview')
    && requiredRequestFields.every((field) => text.includes(field));
}

function compileFixture(source) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'p1r-learning-loop-generated-types-'));
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

test('generated types are required M1-013 public promotion evidence', () => {
  assert.equal(policy.compatibilityPromotion.scope, 'OPENAPI_EVENT_GOVERNANCE_B26_STATIC');
  assert.equal(policy.compatibilityPromotion.canonicalRoutes.length, 11);
  assert.equal(policy.compatibilityPromotion.approvedCanonicalEvents.length, 3);
  assert.equal(hasM1013ReviewTypeShape(), true, 'generated B10 review types must be current promotion evidence');
});

test('M1-013 generated request types preserve server authority and deterministic offline fields', () => {
  const result = compileFixture(`
import type { B10CompleteReviewRequest } from '@englishflow/contracts';
import type { GeneratedApiOperationRegistry } from '@englishflow/api-client';

type Assert<T extends true> = T;
type RequiredKey<T, K extends keyof T> = {} extends Pick<T, K> ? false : true;
type Request = B10CompleteReviewRequest;
type RegistryRequest = GeneratedApiOperationRegistry['completeB10LearningReview']['request'];
type SameRequest = Assert<RegistryRequest extends Request ? (Request extends RegistryRequest ? true : false) : false>;
type BodyRequired = Assert<GeneratedApiOperationRegistry['completeB10LearningReview']['requestBodyRequired'] extends true ? true : false>;
type RequiredReplayFacts = Assert<
  RequiredKey<Request, 'baseStateVersion'> extends true
    ? RequiredKey<Request, 'snapshotItemId'> extends true
      ? RequiredKey<Request, 'clientEventId'> extends true
        ? RequiredKey<Request, 'clientSeq'> extends true
          ? RequiredKey<Request, 'contentPin'> extends true
            ? RequiredKey<Request, 'payloadHash'> extends true
              ? RequiredKey<Request, 'sourceAssessmentAttemptId'> extends true
                ? RequiredKey<Request, 'rawQuality'> extends true
                  ? RequiredKey<Request, 'clientOccurredAt'> extends true ? true : false
                  : false
                : false
              : false
            : false
          : false
        : false
      : false
    : false
>;
type NoServerAuthority = Assert<
  Extract<keyof Request, 'tenantId' | 'principalId' | 'ownerId' | 'objectiveOutcome' | 'effectiveQuality' | 'score' | 'mastery' | 'srsStage' | 'easeFactor' | 'intervalDays' | 'dueAt' | 'algorithmVersion' | 'pass' | 'fail'> extends never
    ? true
    : false
>;

declare const baseStateVersion: Request['baseStateVersion'];
declare const snapshotItemId: Request['snapshotItemId'];
declare const contentPin: Request['contentPin'];
declare const sourceAssessmentAttemptId: Request['sourceAssessmentAttemptId'];
declare const clientOccurredAt: Request['clientOccurredAt'];
const request = {
  snapshotItemId,
  baseStateVersion,
  clientEventId: 'evt-1',
  clientSeq: 1,
  contentPin,
  payloadHash: 'a'.repeat(64),
  sourceAssessmentAttemptId,
  rawQuality: 3,
  clientOccurredAt,
} satisfies Request;
// @ts-expect-error q must remain the generated 0..3 domain.
const badQuality: Request = { ...request, rawQuality: 4 };
const forbiddenAuthority: Request = {
  ...request,
  // @ts-expect-error dueAt is server-derived and must not enter the public request type.
  dueAt: '2026-10-01T00:00:00Z',
};
void request;
void badQuality;
void forbiddenAuthority;
type _Keep = SameRequest | BodyRequired | RequiredReplayFacts | NoServerAuthority;
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
