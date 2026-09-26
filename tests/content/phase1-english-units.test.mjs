import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  draftPlan,
  loadPack,
  ownerContentHash,
  validatePack,
} from '../../scripts/content/prepare-phase1-english-units.mjs';

const contract = JSON.parse(await readFile('packages/contracts/fragments/b9/b9-content.openapi.json', 'utf8'));
const schemas = contract.components.schemas;

test('the curated lessons provide a complete, ungraded adult learning loop', async () => {
  const pack = await loadPack();
  assert.equal(pack.units.length, 4);
  assert.equal(pack.units.reduce((sum, unit) => sum + unit.items.length, 0), 24);
  assert.deepEqual(pack.units.map((unit) => unit.targetLevel), ['A1', 'A1', 'A2', 'B1']);
  for (const unit of pack.units) {
    assert.match(unit.summary, /学完后/);
    const phases = unit.items.map((item) => item.definition.phase);
    assert.equal(phases[0], 'GOAL');
    assert.equal(phases.at(-1), 'REVIEW');
    assert.ok(phases.indexOf('MODEL') < phases.indexOf('PRACTICE'));
    assert.ok(phases.indexOf('EXPLAIN') < phases.indexOf('PRACTICE'));
    assert.ok(phases.indexOf('PRACTICE') < phases.indexOf('REVIEW'));
  }
});

test('prepared CREATE_DRAFT commands follow the B9 input shape and hash deterministically', async () => {
  const pack = await loadPack();
  const first = draftPlan(pack);
  const replay = draftPlan(await loadPack());
  assert.deepEqual(first, replay);
  const draftKeys = new Set(Object.keys(schemas.B9ContentDraftInput.properties));
  const itemKeys = new Set(Object.keys(schemas.B9ContentItemDefinition.properties));
  const commandKeys = new Set(Object.keys(schemas.B9ContentCommandRequest.properties));
  for (const [index, plan] of first.entries()) {
    const unit = pack.units[index];
    assert.equal(plan.path, '/api/v1/admin/content-commands');
    assert.equal(plan.body.command, 'CREATE_DRAFT');
    assert.equal(plan.body.contentCode, unit.contentCode);
    assert.equal(plan.body.expectedStateVersion, 0);
    assert.equal(plan.headers['If-Match'], '0');
    assert.match(plan.headers['Idempotency-Key'], /^[A-Za-z0-9._:-]{16,128}$/);
    assert.ok(Object.keys(plan.body).every((key) => commandKeys.has(key)));
    assert.ok(Object.keys(plan.body.content).every((key) => draftKeys.has(key)));
    assert.ok(schemas.B9ContentDraftInput.required.every((key) => key in plan.body.content));
    assert.equal(plan.body.content.contentHash, ownerContentHash(unit));
    assert.match(plan.body.content.contentHash, /^[a-f0-9]{64}$/);
    for (const item of plan.body.content.items) {
      assert.ok(Object.keys(item).every((key) => itemKeys.has(key)));
      assert.ok(schemas.B9ContentItemDefinition.required.every((key) => key in item));
      assert.ok(item.displayText.length > 25);
    }
  }
});

test('unknown rights or incomplete lesson data fail closed', async () => {
  const source = await loadPack();
  const badRights = structuredClone(source);
  badRights.units[0].licenseCode = 'ACTIVE';
  assert.throws(() => validatePack(badRights), /rights must remain pending review/);

  const missingReview = structuredClone(source);
  missingReview.units[0].items.pop();
  assert.throws(() => validatePack(missingReview), /missing REVIEW stage/);

  const unsafeQuestion = structuredClone(source);
  unsafeQuestion.units[0].items[0].definition.answerRule = { key: 'A' };
  assert.throws(() => validatePack(unsafeQuestion), /assessment-only field/);
});

test('automation refuses review or publication commands', () => {
  assert.throws(() => execFileSync(process.execPath, [
    'scripts/content/prepare-phase1-english-units.mjs', '--publish',
  ], { encoding: 'utf8', stdio: 'pipe' }), /Owner rights evidence and independent L1\/L2\/publisher review are required/);
});
