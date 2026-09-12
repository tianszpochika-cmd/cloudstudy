import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const CONTROLLER = 'services/iam-service/src/main/java/com/englishflow/iam/web/IamProviderBoundaryController.java';
const EVIDENCE = 'services/iam-service/src/main/java/com/englishflow/iam/domain/TrustedAgeEvidence.java';

test('the adult gate validates the derived age before the domain type rejects it', () => {
  const controller = read(CONTROLLER);
  const evidence = read(EVIDENCE);

  // The domain type rejects an out-of-range age with an unchecked exception, so the boundary has to
  // validate the birth year first; otherwise the client sees 500 iam.internal.error with
  // retryable: true and is invited to retry an input that can never succeed.
  assert.match(evidence, /age < 0 \|\| age > 150/u,
    'TrustedAgeEvidence must keep its 0..150 range check');

  const ageComputation = controller.indexOf('int age = currentYear - request.birthYear();');
  const guard = controller.indexOf('iam.adult_gate.birth_year_invalid');
  const construction = controller.indexOf('TrustedAgeEvidence.fromServerAttestation(age');
  assert.ok(ageComputation > 0, 'the boundary must derive the age from the birth year');
  assert.ok(guard > ageComputation,
    'the boundary must reject an out-of-range birth year before building age evidence');
  assert.ok(construction > guard,
    'the range guard must run before TrustedAgeEvidence is constructed, not after');
});

test('the adult gate rejects implausible birth years as a non-retryable client error', () => {
  const controller = read(CONTROLLER);
  // A permanent input error must not carry retryable: true; the decision code is the one the
  // client-facing envelope maps to a 403.
  assert.match(controller, /ADULT_AGE_EVIDENCE_INVALID,\s*"iam\.adult_gate\.birth_year_invalid"/u);
  assert.doesNotMatch(controller, /throw new IllegalArgumentException\([^)]*birth/u);
});
