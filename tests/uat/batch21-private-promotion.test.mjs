import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BATCH21_IMAGE_IDS, BATCH21_ORDER, BATCH21_PROJECT, BATCH21_RELEASE_TAG,
  BATCH21_SERVICES, assertBatch21Baseline, assertBatch21ImageIdsReady, assertBatch21Plan,
  assertBatch21Progress, assertBatch21RollbackComplete, batch21CandidateImages,
  batch21ComposeArgs, batch21OverrideText, batch21RollbackOverrideText
} from '../../scripts/runtime/batch21-private-promotion.mjs';
import {
  BATCH20_IMAGE_IDS, BATCH20_RELEASE_TAG, BATCH20_SERVICES, batch20CandidateImages
} from '../../scripts/runtime/batch20-private-promotion.mjs';
import { BATCH17_PRIVATE_SERVICES } from '../../scripts/runtime/uat-isolated-compose.mjs';

const image = (n) => `sha256:${String(n).padStart(64, '0')}`;
function baselineSnapshot() {
  return Object.fromEntries(BATCH17_PRIVATE_SERVICES.map((service, index) => [service, {
    containerId: `container-${service}`, imageId: image(index + 1),
    status: ['mysql-init', 'minio-init', 'mysql-migrate'].includes(service) ? 'exited' : 'running',
    project: BATCH21_PROJECT, networks: [BATCH21_PROJECT], portBindings: {}
  }]));
}
function batch20Receipt(snapshot = baselineSnapshot()) {
  return { project: BATCH21_PROJECT, phase: 'verified', releaseTag: BATCH20_RELEASE_TAG,
    services: [...BATCH20_SERVICES], images: batch20CandidateImages(), imageIds: BATCH20_IMAGE_IDS,
    readinessPassed: 19, readinessResults: Array.from({ length: 19 }, () => ({ status: 200 })),
    verifiedSnapshot: structuredClone(snapshot) };
}
function promotionReceipt(before = baselineSnapshot()) {
  return { phase: 'promoting', baselineSnapshot: before,
    baselineImageIds: Object.fromEntries(BATCH21_SERVICES.map((service) => [service, before[service].imageId])),
    imageIds: Object.fromEntries(BATCH21_SERVICES.map((service, index) => [service, image(index + 101)])),
    serviceSnapshots: {}, rolledBackServices: [] };
}

test('Batch21 candidates are fixed to the approved tag and exactly two services', () => {
  assert.equal(BATCH21_RELEASE_TAG, '583ab627-uat-batch21-20260925');
  assert.deepEqual(BATCH21_SERVICES, ['admin-web', 'learner-web']);
  assert.deepEqual(BATCH21_ORDER, ['learner-web', 'admin-web']);
  assert.equal(BATCH21_IMAGE_IDS['admin-web'],
    'sha256:ea3a9fd110d32bb6d442a49458953347f23de3311a88d4936cc3a4b714d79390');
  assert.equal(BATCH21_IMAGE_IDS['learner-web'],
    'sha256:103ab13120713ce1186a12d0e60ae0d4ffcc3d63043e0cea4c539df2af99e033');
  assert.deepEqual(Object.keys(batch21CandidateImages()).sort(), [...BATCH21_SERVICES].sort());
  for (const service of BATCH21_SERVICES) {
    assert.equal(batch21CandidateImages()[service], `cloudstudy-clyunedev/${service}:${BATCH21_RELEASE_TAG}`);
  }
  assert.throws(() => batch21CandidateImages('other-tag'), /approved tag/u);
  assert.throws(() => assertBatch21ImageIdsReady({ 'admin-web': image(201), 'learner-web': null }),
    /learner-web image ID is not filled/u);
  assert.doesNotThrow(() => assertBatch21ImageIdsReady());
  assert.doesNotThrow(() => assertBatch21ImageIdsReady({ 'admin-web': image(201), 'learner-web': image(202) }));
  assert.throws(() => assertBatch21ImageIdsReady({ 'admin-web': image(201) }), /exactly admin-web and learner-web/u);
});

test('promotion and rollback overlays contain exactly two service images', () => {
  const candidates = batch21CandidateImages();
  const baseline = Object.fromEntries(BATCH21_SERVICES.map((service) =>
    [service, `cloudstudy-clyunedev/${service}:${BATCH20_RELEASE_TAG}`]));
  const overlay = batch21OverrideText(candidates);
  const rollback = batch21RollbackOverrideText(baseline);
  assert.equal((overlay.match(/^  [a-z0-9-]+:$/gmu) || []).length, 2);
  assert.equal((rollback.match(/^  [a-z0-9-]+:$/gmu) || []).length, 2);
  assert.throws(() => batch21OverrideText({ ...candidates, 'iam-service': 'unexpected' }), /exactly/u);
  assert.throws(() => batch21OverrideText({ ...candidates, 'learner-web': 'unapproved' }), /strictly equal/u);
  assert.throws(() => batch21RollbackOverrideText({ ...baseline, 'admin-web': 'other/repository:tag' }), /regular expression/u);
});

test('compose mutation args are restricted to one approved service and have no dependencies/build/pull', () => {
  assert.deepEqual(batch21ComposeArgs('learner-web'), [
    'up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--force-recreate', 'learner-web'
  ]);
  assert.throws(() => batch21ComposeArgs('iam-service'), /two approved services/u);
});

test('source baseline must exactly match the verified Batch20 snapshot with recorded readiness', () => {
  const current = baselineSnapshot(); const receipt = batch20Receipt(current);
  assert.doesNotThrow(() => assertBatch21Baseline(current, receipt));
  const drift = structuredClone(current); drift['admin-web'].containerId = 'different';
  assert.throws(() => assertBatch21Baseline(drift, receipt), /exactly match/u);
  assert.throws(() => assertBatch21Baseline(current, { ...receipt, phase: 'promoted' }), /must be verified/u);
  assert.throws(() => assertBatch21Baseline(current, { ...receipt, readinessPassed: 18 }), /19\/19 readiness/u);
});

test('Compose plan changes only the two Batch21 images and restores Batch20 image tags', () => {
  const baseImages = Object.fromEntries(BATCH17_PRIVATE_SERVICES.map((service, index) =>
    [service, `cloudstudy-clyunedev/${service}:base-${index}`]));
  const targetImages = batch21CandidateImages();
  const rollbackImages = Object.fromEntries(BATCH21_SERVICES.map((service) => [service, baseImages[service]]));
  const config = (overrides) => ({ services: Object.fromEntries(BATCH17_PRIVATE_SERVICES.map((service) =>
    [service, { image: overrides[service] || baseImages[service] }])) });
  assert.doesNotThrow(() => assertBatch21Plan(config({}), config(targetImages), config(rollbackImages),
    targetImages, rollbackImages));
  const drift = { ...targetImages, 'learning-service': 'cloudstudy-clyunedev/learning-service:other' };
  assert.throws(() => assertBatch21Plan(config({}), config(drift), config(rollbackImages),
    targetImages, rollbackImages), /changed outside Batch21/u);
});

test('progress permits only receipt candidate images and preserves the other 24 identities', () => {
  const receipt = promotionReceipt(); const current = structuredClone(receipt.baselineSnapshot);
  for (const service of BATCH21_SERVICES) {
    current[service] = { ...current[service], containerId: `candidate-${service}`,
      imageId: receipt.imageIds[service], status: 'running' };
    receipt.serviceSnapshots[service] = structuredClone(current[service]);
  }
  assert.doesNotThrow(() => assertBatch21Progress(current, receipt));
  const unlistedImage = structuredClone(current); unlistedImage['api-gateway'].imageId = image(999);
  assert.throws(() => assertBatch21Progress(unlistedImage, receipt), /outside Batch21/u);
  const otherChanged = structuredClone(current); otherChanged['learning-service'].containerId = 'changed';
  assert.throws(() => assertBatch21Progress(otherChanged, receipt), /outside Batch21/u);
});

test('rollback requires recorded replacement containers and confirms both baseline image IDs', () => {
  const receipt = promotionReceipt(); receipt.phase = 'rolling-back';
  const current = structuredClone(receipt.baselineSnapshot);
  for (const service of BATCH21_SERVICES) current[service] = { ...current[service],
    containerId: `restored-${service}`, status: 'running' };
  assert.throws(() => assertBatch21Progress(current, receipt, { allowUnhealthyCandidate: true }),
    /rollback container is not recorded/u);
  receipt.rolledBackServices = [...BATCH21_SERVICES]; receipt.rolledBackSnapshot = structuredClone(current);
  assert.doesNotThrow(() => assertBatch21RollbackComplete(current, receipt));
  const notRestored = structuredClone(current); notRestored['learner-web'].imageId = receipt.imageIds['learner-web'];
  assert.throws(() => assertBatch21RollbackComplete(notRestored, receipt), /candidate is not running|baseline image was not restored/u);
});
