import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BATCH22_IMAGE_IDS, BATCH22_ORDER, BATCH22_PROJECT, BATCH22_RELEASE_TAG, BATCH22_SERVICES,
  assertBatch22Baseline, assertBatch22ImageIdsReady, assertBatch22Plan, assertBatch22Progress,
  assertBatch22RollbackComplete, batch22CandidateImages, batch22ComposeArgs,
  batch22OverrideText, batch22RollbackOverrideText
} from '../../scripts/runtime/batch22-private-promotion.mjs';
import {
  BATCH21_IMAGE_IDS, BATCH21_RELEASE_TAG, BATCH21_SERVICES, batch21CandidateImages
} from '../../scripts/runtime/batch21-private-promotion.mjs';
import { BATCH17_PRIVATE_SERVICES } from '../../scripts/runtime/uat-isolated-compose.mjs';

const image = (n) => `sha256:${String(n).padStart(64, '0')}`;
function baselineSnapshot() {
  return Object.fromEntries(BATCH17_PRIVATE_SERVICES.map((service, index) => [service, {
    containerId: `container-${service}`,
    imageId: service === 'learner-web' ? BATCH21_IMAGE_IDS['learner-web'] : image(index + 1),
    status: ['mysql-init', 'minio-init', 'mysql-migrate'].includes(service) ? 'exited' : 'running',
    project: BATCH22_PROJECT, networks: [BATCH22_PROJECT], portBindings: {}
  }]));
}
function batch21Receipt(snapshot = baselineSnapshot()) {
  return { project: BATCH22_PROJECT, phase: 'verified', releaseTag: BATCH21_RELEASE_TAG,
    services: [...BATCH21_SERVICES], images: batch21CandidateImages(), imageIds: BATCH21_IMAGE_IDS,
    readinessPassed: 19, readinessResults: Array.from({ length: 19 }, () => ({ status: 200 })),
    verifiedSnapshot: structuredClone(snapshot) };
}
function promotionReceipt(before = baselineSnapshot()) {
  return { phase: 'promoting', baselineSnapshot: before,
    baselineImageIds: Object.fromEntries(BATCH22_SERVICES.map((service) => [service, before[service].imageId])),
    imageIds: Object.fromEntries(BATCH22_SERVICES.map((service, index) => [service, image(index + 101)])),
    serviceSnapshots: {}, rolledBackServices: [], rollbackInFlightServices: [] };
}

test('Batch22 candidates use the fixed tag and exactly social-service, learner-web, and mobile-h5; IDs fail closed', () => {
  assert.equal(BATCH22_RELEASE_TAG, '583ab627-uat-batch22-20260925');
  assert.deepEqual(BATCH22_SERVICES, ['social-service', 'learner-web', 'mobile-h5']);
  assert.deepEqual(BATCH22_ORDER, ['social-service', 'learner-web', 'mobile-h5']);
  assert.deepEqual([...BATCH22_ORDER].reverse(), ['mobile-h5', 'learner-web', 'social-service']);
  assert.deepEqual(BATCH22_IMAGE_IDS, {
    'social-service': 'sha256:dccc91fa27b458677dcaa01894c97e619e44e927b5a076a4ae6c928f3fa83e75',
    'learner-web': 'sha256:8e273afae78940b389333effb8175bc5b0a6ef7fda8d3c5a506c0b5c0d7c9780',
    'mobile-h5': 'sha256:b8319bd93823a07e6a8ed74e4564191205f5198001a46e2da8ff05cf1552d480'
  });
  assert.deepEqual(Object.keys(batch22CandidateImages()).sort(), [...BATCH22_SERVICES].sort());
  for (const service of BATCH22_SERVICES) {
    assert.equal(batch22CandidateImages()[service], `cloudstudy-clyunedev/${service}:${BATCH22_RELEASE_TAG}`);
  }
  assert.throws(() => batch22CandidateImages('other-tag'), /approved tag/u);
  assert.doesNotThrow(() => assertBatch22ImageIdsReady());
  assert.throws(() => assertBatch22ImageIdsReady({ 'social-service': image(200) }),
    /exactly social-service, learner-web, and mobile-h5/u);
  assert.throws(() => assertBatch22ImageIdsReady({ 'social-service': image(200), 'learner-web': image(201), 'mobile-h5': null }),
    /mobile-h5 image ID/u);
  assert.doesNotThrow(() => assertBatch22ImageIdsReady({
    'social-service': image(200), 'learner-web': image(201), 'mobile-h5': image(202)
  }));
});

test('promotion and rollback overlays contain only the three Batch22 service images', () => {
  const candidates = batch22CandidateImages();
  const baseline = Object.fromEntries(BATCH22_SERVICES.map((service) =>
    [service, `cloudstudy-clyunedev/${service}:${service === 'learner-web' ? BATCH21_RELEASE_TAG : 'batch20-baseline'}`]));
  const overlay = batch22OverrideText(candidates);
  const rollback = batch22RollbackOverrideText(baseline);
  assert.equal((overlay.match(/^  [a-z0-9-]+:$/gmu) || []).length, 3);
  assert.equal((rollback.match(/^  [a-z0-9-]+:$/gmu) || []).length, 3);
  assert.throws(() => batch22OverrideText({ ...candidates, 'iam-service': 'unexpected' }), /exactly/u);
  assert.throws(() => batch22OverrideText({ ...candidates, 'mobile-h5': 'unapproved' }), /strictly equal/u);
  assert.throws(() => batch22RollbackOverrideText({ ...baseline, 'mobile-h5': 'other/repository:tag' }), /regular expression/u);
});

test('Compose mutation args target one approved service with no dependency/build/pull', () => {
  assert.deepEqual(batch22ComposeArgs('social-service'), [
    'up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--force-recreate', 'social-service'
  ]);
  assert.deepEqual(batch22ComposeArgs('learner-web'), [
    'up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--force-recreate', 'learner-web'
  ]);
  assert.deepEqual(batch22ComposeArgs('mobile-h5').at(-1), 'mobile-h5');
  assert.throws(() => batch22ComposeArgs('admin-web'), /three approved services/u);
});

test('Batch22 baseline must exactly match the verified Batch21 snapshot and its 19/19 readiness', () => {
  const current = baselineSnapshot(); const receipt = batch21Receipt(current);
  assert.doesNotThrow(() => assertBatch22Baseline(current, receipt));
  const drift = structuredClone(current); drift['mobile-h5'].containerId = 'different';
  assert.throws(() => assertBatch22Baseline(drift, receipt), /exactly match/u);
  assert.throws(() => assertBatch22Baseline(current, { ...receipt, phase: 'promoted' }), /must be verified/u);
  assert.throws(() => assertBatch22Baseline(current, { ...receipt, readinessPassed: 18 }), /19\/19 readiness/u);
  assert.throws(() => assertBatch22Baseline(current, { ...receipt,
    readinessResults: Array.from({ length: 19 }, () => ({ status: 503 })) }), /status === 200/u);
  assert.throws(() => assertBatch22Baseline(current, { ...receipt, readinessResults: [] }), /0 !== 19/u);
  const publicPort = structuredClone(current); publicPort['mobile-h5'].portBindings = { '80/tcp': [] };
  assert.throws(() => assertBatch22Baseline(publicPort, batch21Receipt(publicPort)), /publishes a host port/u);
});

test('Compose plan changes only the three Batch22 images and preserves the verified baseline for rollback', () => {
  const baseImages = Object.fromEntries(BATCH17_PRIVATE_SERVICES.map((service, index) =>
    [service, `cloudstudy-clyunedev/${service}:base-${index}`]));
  const targetImages = batch22CandidateImages();
  const rollbackImages = Object.fromEntries(BATCH22_SERVICES.map((service) => [service, baseImages[service]]));
  const config = (overrides) => ({ services: Object.fromEntries(BATCH17_PRIVATE_SERVICES.map((service) =>
    [service, { image: overrides[service] || baseImages[service] }])) });
  assert.doesNotThrow(() => assertBatch22Plan(config({}), config(targetImages), config(rollbackImages),
    targetImages, rollbackImages));
  const drift = { ...targetImages, 'learner-service': 'cloudstudy-clyunedev/learner-service:other' };
  assert.throws(() => assertBatch22Plan(config({}), config(drift), config(rollbackImages),
    targetImages, rollbackImages), /changed outside Batch22/u);
});

test('promotion progress preserves the other 23 service identities', () => {
  const receipt = promotionReceipt(); const current = structuredClone(receipt.baselineSnapshot);
  for (const service of BATCH22_SERVICES) {
    current[service] = { ...current[service], containerId: `candidate-${service}`,
      imageId: receipt.imageIds[service], status: 'running' };
    receipt.serviceSnapshots[service] = structuredClone(current[service]);
  }
  assert.doesNotThrow(() => assertBatch22Progress(current, receipt));
  const unlistedImage = structuredClone(current); unlistedImage['api-gateway'].imageId = image(999);
  assert.throws(() => assertBatch22Progress(unlistedImage, receipt), /outside Batch22/u);
  const otherChanged = structuredClone(current); otherChanged['learning-service'].containerId = 'changed';
  assert.throws(() => assertBatch22Progress(otherChanged, receipt), /outside Batch22/u);
});

test('rollback requires recorded replacement containers and confirms all three Batch21 baseline image IDs', () => {
  const receipt = promotionReceipt(); receipt.phase = 'rolling-back';
  const current = structuredClone(receipt.baselineSnapshot);
  for (const service of BATCH22_SERVICES) current[service] = { ...current[service],
    containerId: `restored-${service}`, status: 'running' };
  assert.throws(() => assertBatch22Progress(current, receipt, { allowUnhealthyCandidate: true }),
    /not recorded or covered by a durable rollback intent/u);
  receipt.rolledBackServices = [...BATCH22_SERVICES]; receipt.rolledBackSnapshot = structuredClone(current);
  assert.doesNotThrow(() => assertBatch22RollbackComplete(current, receipt));
  const notRestored = structuredClone(current); notRestored['learner-web'].imageId = receipt.imageIds['learner-web'];
  assert.throws(() => assertBatch22RollbackComplete(notRestored, receipt),
    /candidate is not running|baseline image was not restored/u);
});

test('rollback resumes after Compose restored baseline but before the result receipt was saved', () => {
  const receipt = promotionReceipt(); receipt.phase = 'rolling-back';
  const service = 'mobile-h5';
  const current = structuredClone(receipt.baselineSnapshot);
  current[service] = { ...current[service], containerId: `restored-${service}`, status: 'running' };

  // This is the crash window: Compose has replaced the container with the exact baseline image,
  // but rolledBackServices and rolledBackSnapshot have not yet been persisted.
  assert.throws(() => assertBatch22Progress(current, receipt, { allowUnhealthyCandidate: true }),
    /not recorded or covered by a durable rollback intent/u);
  receipt.rollbackInFlightServices = [service];
  assert.doesNotThrow(() => assertBatch22Progress(current, receipt, { allowUnhealthyCandidate: true }));

  // A resumed rollback adopts the verified private baseline container and commits that receipt.
  receipt.rolledBackServices = [service];
  receipt.rolledBackSnapshot = structuredClone(current);
  receipt.rollbackInFlightServices = [];
  assert.doesNotThrow(() => assertBatch22RollbackComplete(current, receipt));

  const finalizedButUnrecorded = { ...receipt, phase: 'rolled-back', rolledBackServices: [],
    rolledBackSnapshot: {}, rollbackInFlightServices: [service] };
  assert.throws(() => assertBatch22Progress(current, finalizedButUnrecorded,
    { allowUnhealthyCandidate: true }), /unrecorded rollback container is not resumable/u);
});
