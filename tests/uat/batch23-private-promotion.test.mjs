import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BATCH22_IMAGE_IDS, BATCH22_RELEASE_TAG, BATCH22_SERVICES, batch22CandidateImages
} from '../../scripts/runtime/batch22-private-promotion.mjs';
import {
  BATCH23_IMAGE_IDS, BATCH23_ORDER, BATCH23_PROJECT, BATCH23_RELEASE_TAG, BATCH23_SERVICES,
  assertBatch23Baseline, assertBatch23ImageIdsReady, assertBatch23Plan, assertBatch23Progress,
  assertBatch23RollbackComplete, batch23CandidateImages, batch23ComposeArgs,
  batch23OverrideText, batch23RollbackOverrideText
} from '../../scripts/runtime/batch23-private-promotion.mjs';
import { BATCH17_PRIVATE_SERVICES } from '../../scripts/runtime/uat-isolated-compose.mjs';

const image = (n) => `sha256:${String(n).padStart(64, '0')}`;
const candidateIds = { 'learner-web': image(801), 'mobile-h5': image(802) };

function sourceSnapshot() {
  return Object.fromEntries(BATCH17_PRIVATE_SERVICES.map((service, index) => [service, {
    containerId: `batch21-${service}`,
    imageId: image(index + 1),
    status: ['mysql-init', 'minio-init', 'mysql-migrate'].includes(service) ? 'exited' : 'running',
    project: BATCH23_PROJECT, networks: [BATCH23_PROJECT], portBindings: {}
  }]));
}

function batch22Receipt(baseline = sourceSnapshot()) {
  const verifiedSnapshot = structuredClone(baseline);
  for (const service of BATCH22_SERVICES) {
    verifiedSnapshot[service] = { ...verifiedSnapshot[service],
      containerId: `batch22-${service}`, imageId: BATCH22_IMAGE_IDS[service], status: 'running' };
  }
  return { project: BATCH23_PROJECT, phase: 'verified', releaseTag: BATCH22_RELEASE_TAG,
    services: [...BATCH22_SERVICES], images: batch22CandidateImages(), imageIds: BATCH22_IMAGE_IDS,
    baselineSnapshot: structuredClone(baseline), verifiedSnapshot,
    baselineImageIds: Object.fromEntries(BATCH22_SERVICES.map((service) =>
      [service, baseline[service].imageId])),
    serviceSnapshots: Object.fromEntries(BATCH22_SERVICES.map((service) =>
      [service, structuredClone(verifiedSnapshot[service])])),
    proxyRefreshedForPhase: 'promoted', readinessPassed: 19,
    readinessResults: Array.from({ length: 19 }, () => ({ status: 200 })) };
}

function promotionReceipt(baseline = batch22Receipt().verifiedSnapshot) {
  return { phase: 'promoting', baselineSnapshot: structuredClone(baseline),
    baselineImageIds: Object.fromEntries(BATCH23_SERVICES.map((service) =>
      [service, baseline[service].imageId])),
    imageIds: structuredClone(candidateIds), serviceSnapshots: {}, rolledBackServices: [],
    rollbackInFlightServices: [] };
}

test('Batch23 candidates use the fixed tag and exactly learner-web plus mobile-h5; IDs fail closed', () => {
  assert.equal(BATCH23_PROJECT, 'cloudstudy-uat-isolated-3c94b27160');
  assert.equal(BATCH23_RELEASE_TAG, '583ab627-uat-batch23-20260925');
  assert.deepEqual(BATCH23_SERVICES, ['learner-web', 'mobile-h5']);
  assert.deepEqual(BATCH23_ORDER, ['learner-web', 'mobile-h5']);
  assert.deepEqual([...BATCH23_ORDER].reverse(), ['mobile-h5', 'learner-web']);
  assert.deepEqual(BATCH23_IMAGE_IDS, {
    'learner-web': 'sha256:81eb110756edf6cdba48d517ae5de90c7a13952114836be087ceecf7770e0369',
    'mobile-h5': 'sha256:5205ac29584eec33fbeee69430472c6dba2320913de41d6202238477fadb30d9'
  });
  assert.deepEqual(Object.keys(batch23CandidateImages()).sort(), [...BATCH23_SERVICES].sort());
  for (const service of BATCH23_SERVICES) {
    assert.equal(batch23CandidateImages()[service], `cloudstudy-clyunedev/${service}:${BATCH23_RELEASE_TAG}`);
  }
  assert.throws(() => batch23CandidateImages('other-tag'), /approved tag/u);
  assert.doesNotThrow(() => assertBatch23ImageIdsReady());
  assert.throws(() => assertBatch23ImageIdsReady({ 'learner-web': image(801) }), /exactly learner-web and mobile-h5/u);
  assert.throws(() => assertBatch23ImageIdsReady({ 'learner-web': image(801), 'mobile-h5': null }), /mobile-h5 image ID/u);
  assert.doesNotThrow(() => assertBatch23ImageIdsReady(candidateIds));
});

test('promotion and rollback overlays contain exactly the two Batch23 services', () => {
  const candidates = batch23CandidateImages();
  const baseline = Object.fromEntries(BATCH23_SERVICES.map((service) =>
    [service, `cloudstudy-clyunedev/${service}:${BATCH22_RELEASE_TAG}`]));
  const overlay = batch23OverrideText(candidates);
  const rollback = batch23RollbackOverrideText(baseline);
  assert.equal((overlay.match(/^  [a-z0-9-]+:$/gmu) || []).length, 2);
  assert.equal((rollback.match(/^  [a-z0-9-]+:$/gmu) || []).length, 2);
  assert.throws(() => batch23OverrideText({ ...candidates, 'iam-service': 'unexpected' }), /exactly/u);
  assert.throws(() => batch23OverrideText({ ...candidates, 'mobile-h5': 'unapproved' }), /strictly equal/u);
  assert.throws(() => batch23RollbackOverrideText({ ...baseline, 'mobile-h5': 'other/repository:tag' }), /regular expression/u);
});

test('Compose mutation args target one approved service with no dependency, build, or pull', () => {
  assert.deepEqual(batch23ComposeArgs('learner-web'), [
    'up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--force-recreate', 'learner-web'
  ]);
  assert.deepEqual(batch23ComposeArgs('mobile-h5'), [
    'up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--force-recreate', 'mobile-h5'
  ]);
  assert.throws(() => batch23ComposeArgs('social-service'), /learner-web and mobile-h5/u);
});

test('Batch23 baseline must exactly match the verified Batch22 snapshot and 19/19 readiness', () => {
  const receipt = batch22Receipt();
  assert.doesNotThrow(() => assertBatch23Baseline(receipt.verifiedSnapshot, receipt));
  const drift = structuredClone(receipt.verifiedSnapshot); drift['mobile-h5'].containerId = 'different';
  assert.throws(() => assertBatch23Baseline(drift, receipt), /exactly match/u);
  assert.throws(() => assertBatch23Baseline(receipt.verifiedSnapshot, { ...receipt, phase: 'promoted' }), /must be verified/u);
  assert.throws(() => assertBatch23Baseline(receipt.verifiedSnapshot, { ...receipt, readinessPassed: 18 }), /19\/19 readiness/u);
  assert.throws(() => assertBatch23Baseline(receipt.verifiedSnapshot, { ...receipt,
    readinessResults: Array.from({ length: 19 }, () => ({ status: 503 })) }), /status === 200/u);
  assert.throws(() => assertBatch23Baseline(receipt.verifiedSnapshot, { ...receipt, readinessResults: [] }), /0 !== 19/u);
  const publicPort = structuredClone(receipt.verifiedSnapshot); publicPort['mobile-h5'].portBindings = { '80/tcp': [] };
  assert.throws(() => assertBatch23Baseline(publicPort, { ...receipt, verifiedSnapshot: publicPort }), /publishes a host port/u);
  const badCandidate = structuredClone(receipt); badCandidate.verifiedSnapshot['learner-web'].imageId = image(999);
  assert.throws(() => assertBatch23Baseline(badCandidate.verifiedSnapshot, badCandidate), /verified Batch22 image ID differs/u);
});

test('Compose plan changes only the two Batch23 images and preserves the verified baseline for rollback', () => {
  const baseImages = Object.fromEntries(BATCH17_PRIVATE_SERVICES.map((service, index) =>
    [service, `cloudstudy-clyunedev/${service}:base-${index}`]));
  const targetImages = batch23CandidateImages();
  const rollbackImages = Object.fromEntries(BATCH23_SERVICES.map((service) => [service, baseImages[service]]));
  const config = (overrides) => ({ services: Object.fromEntries(BATCH17_PRIVATE_SERVICES.map((service) =>
    [service, { image: overrides[service] || baseImages[service] }])) });
  assert.doesNotThrow(() => assertBatch23Plan(config({}), config(targetImages), config(rollbackImages),
    targetImages, rollbackImages));
  const drift = { ...targetImages, 'learner-service': 'cloudstudy-clyunedev/learner-service:other' };
  assert.throws(() => assertBatch23Plan(config({}), config(drift), config(rollbackImages),
    targetImages, rollbackImages), /changed outside Batch23/u);
});

test('promotion progress preserves the other 24 service identities', () => {
  const receipt = promotionReceipt(); const current = structuredClone(receipt.baselineSnapshot);
  for (const service of BATCH23_SERVICES) {
    current[service] = { ...current[service], containerId: `candidate-${service}`,
      imageId: receipt.imageIds[service], status: 'running' };
    receipt.serviceSnapshots[service] = structuredClone(current[service]);
  }
  assert.doesNotThrow(() => assertBatch23Progress(current, receipt));
  const unlistedImage = structuredClone(current); unlistedImage['api-gateway'].imageId = image(999);
  assert.throws(() => assertBatch23Progress(unlistedImage, receipt), /outside Batch23/u);
  const otherChanged = structuredClone(current); otherChanged['learning-service'].containerId = 'changed';
  assert.throws(() => assertBatch23Progress(otherChanged, receipt), /outside Batch23/u);
});

test('rollback requires recorded replacement containers and restores both Batch22 baseline image IDs', () => {
  const receipt = promotionReceipt(); receipt.phase = 'rolling-back';
  const current = structuredClone(receipt.baselineSnapshot);
  for (const service of BATCH23_SERVICES) current[service] = { ...current[service],
    containerId: `restored-${service}`, status: 'running' };
  assert.throws(() => assertBatch23Progress(current, receipt, { allowUnhealthyCandidate: true }),
    /not recorded or covered by a durable rollback intent/u);
  receipt.rolledBackServices = [...BATCH23_SERVICES]; receipt.rolledBackSnapshot = structuredClone(current);
  assert.doesNotThrow(() => assertBatch23RollbackComplete(current, receipt));
  const notRestored = structuredClone(current); notRestored['learner-web'].imageId = receipt.imageIds['learner-web'];
  assert.throws(() => assertBatch23RollbackComplete(notRestored, receipt),
    /candidate is not running|baseline image was not restored/u);
});

test('rollback resumes after Compose restored baseline but before the result receipt was saved', () => {
  const receipt = promotionReceipt(); receipt.phase = 'rolling-back';
  const service = 'mobile-h5';
  const current = structuredClone(receipt.baselineSnapshot);
  current[service] = { ...current[service], containerId: `restored-${service}`, status: 'running' };

  assert.throws(() => assertBatch23Progress(current, receipt, { allowUnhealthyCandidate: true }),
    /not recorded or covered by a durable rollback intent/u);
  receipt.rollbackInFlightServices = [service];
  assert.doesNotThrow(() => assertBatch23Progress(current, receipt, { allowUnhealthyCandidate: true }));

  receipt.rolledBackServices = [service];
  receipt.rolledBackSnapshot = structuredClone(current);
  receipt.rollbackInFlightServices = [];
  assert.doesNotThrow(() => assertBatch23RollbackComplete(current, receipt));

  const finalizedButUnrecorded = { ...receipt, phase: 'rolled-back', rolledBackServices: [],
    rolledBackSnapshot: {}, rollbackInFlightServices: [service] };
  assert.throws(() => assertBatch23Progress(current, finalizedButUnrecorded,
    { allowUnhealthyCandidate: true }), /unrecorded rollback container is not resumable/u);
});
