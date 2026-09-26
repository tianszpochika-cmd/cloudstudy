import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BATCH20_IMAGE_IDS, BATCH20_ORDER, BATCH20_PROJECT, BATCH20_RELEASE_TAG,
  BATCH20_SERVICES, assertBatch20Baseline, assertBatch20Plan,
  assertBatch20Progress, assertBatch20RollbackComplete, batch20CandidateImages,
  batch20ComposeArgs, batch20OverrideText, batch20RollbackOverrideText
} from '../../scripts/runtime/batch20-private-promotion.mjs';
import { BATCH17_PRIVATE_SERVICES } from '../../scripts/runtime/uat-isolated-compose.mjs';
import { batch19CandidateImages } from '../../scripts/runtime/batch19-private-promotion.mjs';

const image = (n) => `sha256:${String(n).padStart(64, '0')}`;
function baselineSnapshot() {
  return Object.fromEntries(BATCH17_PRIVATE_SERVICES.map((service, index) => [service, {
    containerId: `container-${service}`, imageId: image(index + 1),
    status: ['mysql-init', 'minio-init', 'mysql-migrate'].includes(service) ? 'exited' : 'running',
    project: BATCH20_PROJECT, networks: [BATCH20_PROJECT], portBindings: {}
  }]));
}
function promotionReceipt(before = baselineSnapshot()) {
  return { phase: 'promoting', baselineSnapshot: before,
    baselineImageIds: Object.fromEntries(BATCH20_SERVICES.map((service) => [service, before[service].imageId])),
    imageIds: Object.fromEntries(BATCH20_SERVICES.map((service, index) => [service, image(index + 101)])),
    serviceSnapshots: {}, rolledBackServices: [] };
}

test('Batch20 candidates are fixed to the approved tag and image IDs', () => {
  assert.equal(BATCH20_RELEASE_TAG, '583ab627-uat-batch20-20260925');
  assert.deepEqual(BATCH20_SERVICES, ['api-gateway', 'admin-web', 'mobile-h5']);
  assert.deepEqual(BATCH20_ORDER, ['admin-web', 'mobile-h5', 'api-gateway']);
  assert.deepEqual(BATCH20_IMAGE_IDS, {
    'api-gateway': 'sha256:22f6c2761ed0ed17b1b2f882105e21f24d72ba6f05edab536aae2d5643468072',
    'admin-web': 'sha256:69f8618a1a5bc6bd95bea289625f1448130a01039bb956652c4e7928e27f288c',
    'mobile-h5': 'sha256:89a09c93ad95b4f668ac23babb1e41e703ba39325d7b0ee1d46638128ead3304'
  });
  assert.deepEqual(Object.keys(batch20CandidateImages()).sort(), [...BATCH20_SERVICES].sort());
  for (const service of BATCH20_SERVICES) {
    assert.equal(batch20CandidateImages()[service], `cloudstudy-clyunedev/${service}:${BATCH20_RELEASE_TAG}`);
    assert.match(BATCH20_IMAGE_IDS[service], /^sha256:[a-f0-9]{64}$/u);
  }
  assert.throws(() => batch20CandidateImages('other-tag'), /approved tag/u);
});

test('promotion and rollback overlays contain exactly three service images', () => {
  const candidates = batch20CandidateImages();
  const baseline = Object.fromEntries(BATCH20_SERVICES.map((service) =>
    [service, `cloudstudy-clyunedev/${service}:583ab627-uat-batch19-20260925`]));
  const overlay = batch20OverrideText(candidates);
  const rollback = batch20RollbackOverrideText(baseline);
  assert.equal((overlay.match(/^  [a-z0-9-]+:$/gmu) || []).length, 3);
  assert.equal((rollback.match(/^  [a-z0-9-]+:$/gmu) || []).length, 3);
  assert.throws(() => batch20OverrideText({ ...candidates, 'iam-service': 'unexpected' }), /exactly/u);
  assert.throws(() => batch20OverrideText({ ...candidates, 'api-gateway': 'unapproved' }), /Expected values to be strictly equal/u);
  assert.throws(() => batch20RollbackOverrideText({ ...baseline, 'api-gateway': 'other/repository:tag' }), /regular expression/u);
});

test('compose mutation args are restricted to one approved service and have no dependencies/build/pull', () => {
  assert.deepEqual(batch20ComposeArgs('api-gateway'), [
    'up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--force-recreate', 'api-gateway'
  ]);
  assert.throws(() => batch20ComposeArgs('iam-service'), /three approved services/u);
});

test('source baseline must exactly match the verified Batch19 snapshot', () => {
  const current = baselineSnapshot();
  const receipt = { project: BATCH20_PROJECT, phase: 'verified',
    services: ['content-service', 'iam-service', 'notification-service', 'learner-web', 'mobile-h5'],
    images: batch19CandidateImages(), quiescedServices: [], verifiedSnapshot: structuredClone(current) };
  assert.doesNotThrow(() => assertBatch20Baseline(current, receipt));
  const drift = structuredClone(current); drift['api-gateway'].containerId = 'different';
  assert.throws(() => assertBatch20Baseline(drift, receipt), /exactly match/u);
  assert.throws(() => assertBatch20Baseline(current, { ...receipt, phase: 'promoted' }), /must be verified/u);
});

test('Compose plan changes only the three Batch20 images and restores recorded baseline tags', () => {
  const baseImages = Object.fromEntries(BATCH17_PRIVATE_SERVICES.map((service, index) =>
    [service, `cloudstudy-clyunedev/${service}:base-${index}`]));
  const targetImages = batch20CandidateImages();
  const rollbackImages = Object.fromEntries(BATCH20_SERVICES.map((service) => [service, baseImages[service]]));
  const config = (overrides) => ({ services: Object.fromEntries(BATCH17_PRIVATE_SERVICES.map((service) =>
    [service, { image: overrides[service] || baseImages[service] }])) });
  assert.doesNotThrow(() => assertBatch20Plan(config({}), config(targetImages), config(rollbackImages),
    targetImages, rollbackImages));
  const drift = { ...targetImages, 'learning-service': 'cloudstudy-clyunedev/learning-service:other' };
  assert.throws(() => assertBatch20Plan(config({}), config(drift), config(rollbackImages),
    targetImages, rollbackImages), /changed outside Batch20/u);
});

test('progress permits only exact Batch20 candidate images and preserves other 23 container/image identities', () => {
  const receipt = promotionReceipt(); const current = structuredClone(receipt.baselineSnapshot);
  for (const [index, service] of BATCH20_SERVICES.entries()) {
    current[service] = { ...current[service], containerId: `candidate-${service}`,
      imageId: receipt.imageIds[service], status: 'running' };
  }
  for (const service of BATCH20_SERVICES) receipt.serviceSnapshots[service] = structuredClone(current[service]);
  assert.doesNotThrow(() => assertBatch20Progress(current, receipt));
  const unlistedImage = structuredClone(current); unlistedImage['api-gateway'].imageId = image(999);
  assert.throws(() => assertBatch20Progress(unlistedImage, receipt), /unapproved image/u);
  const otherChanged = structuredClone(current); otherChanged['learning-service'].containerId = 'changed';
  assert.throws(() => assertBatch20Progress(otherChanged, receipt), /outside Batch20/u);
});

test('rollback requires recorded replacement containers and confirms all three baseline image IDs', () => {
  const receipt = promotionReceipt(); receipt.phase = 'rolling-back';
  const current = structuredClone(receipt.baselineSnapshot);
  for (const service of BATCH20_SERVICES) current[service] = { ...current[service],
    containerId: `restored-${service}`, status: 'running' };
  assert.throws(() => assertBatch20Progress(current, receipt, { allowUnhealthyCandidate: true }),
    /rollback container is not recorded/u);
  receipt.rolledBackServices = [...BATCH20_SERVICES]; receipt.rolledBackSnapshot = structuredClone(current);
  assert.doesNotThrow(() => assertBatch20RollbackComplete(current, receipt));
  const notRestored = structuredClone(current); notRestored['mobile-h5'].imageId = receipt.imageIds['mobile-h5'];
  assert.throws(() => assertBatch20RollbackComplete(notRestored, receipt), /candidate is not running|baseline image was not restored/u);
});
