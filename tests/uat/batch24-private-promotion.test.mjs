import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BATCH17_PRIVATE_SERVICES
} from '../../scripts/runtime/uat-isolated-compose.mjs';
import {
  BATCH23_IMAGE_IDS, BATCH23_ORDER, BATCH23_PROJECT, BATCH23_RELEASE_TAG,
  BATCH23_SERVICES, batch23CandidateImages
} from '../../scripts/runtime/batch23-private-promotion.mjs';
import { batch19ReadinessTargets } from '../../scripts/runtime/batch19-private-promotion.mjs';
import {
  BATCH24_IMAGE_IDS, BATCH24_ORDER, BATCH24_PROJECT, BATCH24_RELEASE_TAG,
  BATCH24_SERVICES, assertBatch24Baseline, assertBatch24ImageIdsReady,
  assertBatch24ObservedProgress, assertBatch24Plan, assertBatch24Progress, assertBatch24Promoted,
  assertBatch24RollbackComplete, batch24CandidateImages, batch24ComposeArgs,
  batch24OverrideText, batch24ReadinessProbe, batch24RollbackOverrideText
} from '../../scripts/runtime/batch24-private-promotion.mjs';

const image = (n) => `sha256:${String(n).padStart(64, '0')}`;
const candidateIds = {
  'official-site': image(901), 'learner-web': image(902),
  'admin-web': image(903), 'mobile-h5': image(904)
};
const sharedFingerprint = { containers: ['shared-container-id|yuxuexing-local-api-gateway'], network: 'shared-network-id' };

function baseSnapshot() {
  return Object.fromEntries(BATCH17_PRIVATE_SERVICES.map((service, index) => [service, {
    containerId: `batch22-${service}`, imageId: image(index + 1),
    status: ['mysql-init', 'minio-init', 'mysql-migrate'].includes(service) ? 'exited' : 'running',
    project: BATCH24_PROJECT, networks: [BATCH24_PROJECT], portBindings: {}
  }]));
}

function batch23Receipt() {
  const baselineSnapshot = baseSnapshot();
  const verifiedSnapshot = structuredClone(baselineSnapshot);
  for (const service of BATCH23_SERVICES) verifiedSnapshot[service] = {
    ...verifiedSnapshot[service], containerId: `batch23-${service}`,
    imageId: BATCH23_IMAGE_IDS[service], status: 'running'
  };
  return {
    format: 1, project: BATCH24_PROJECT, phase: 'verified', releaseTag: BATCH23_RELEASE_TAG,
    services: [...BATCH23_SERVICES], images: batch23CandidateImages(), imageIds: BATCH23_IMAGE_IDS,
    baselineSnapshot, verifiedSnapshot,
    baselineImageIds: Object.fromEntries(BATCH23_SERVICES.map((service) =>
      [service, baselineSnapshot[service].imageId])),
    serviceSnapshots: Object.fromEntries(BATCH23_SERVICES.map((service) =>
      [service, structuredClone(verifiedSnapshot[service])])),
    promotedServices: [...BATCH23_SERVICES].sort(), proxyRefreshedForPhase: 'promoted',
    readinessPassed: 19, readinessResults: Array.from({ length: 19 }, () => ({ status: 200 })),
    beforeSharedFingerprint: structuredClone(sharedFingerprint),
    // Deliberately stale historical probe: Batch24 must never use this for its own checks.
    officialSiteImage: { image: 'cloudstudy-clyunedev/official-site:historical-b18', imageId: image(119) }
  };
}

function batch24Receipt() {
  const b23 = batch23Receipt();
  const baselineImages = Object.fromEntries(BATCH24_SERVICES.map((service) =>
    [service, `cloudstudy-clyunedev/${service}:batch23-verified` ]));
  return {
    format: 1, project: BATCH24_PROJECT, phase: 'promoting', releaseTag: BATCH24_RELEASE_TAG,
    services: [...BATCH24_SERVICES], images: batch24CandidateImages(), imageIds: structuredClone(candidateIds),
    baselineImages,
    baselineImageIds: Object.fromEntries(BATCH24_SERVICES.map((service) =>
      [service, b23.verifiedSnapshot[service].imageId])),
    baselineSnapshot: structuredClone(b23.verifiedSnapshot), beforeSharedFingerprint: structuredClone(sharedFingerprint),
    promotedServices: [], serviceSnapshots: {}, rolledBackServices: [],
    rollbackInFlightServices: [], rolledBackSnapshot: null
  };
}

test('Batch24 pins one private project, fixed tag, exactly four frontend services, and image drift fails closed', () => {
  assert.equal(BATCH24_PROJECT, 'cloudstudy-uat-isolated-3c94b27160');
  assert.equal(BATCH24_PROJECT, BATCH23_PROJECT);
  assert.equal(BATCH24_RELEASE_TAG, '583ab627-uat-batch24-20260925');
  assert.deepEqual(BATCH24_SERVICES, ['official-site', 'learner-web', 'admin-web', 'mobile-h5']);
  assert.deepEqual(BATCH24_ORDER, ['official-site', 'learner-web', 'admin-web', 'mobile-h5']);
  assert.deepEqual([...BATCH24_ORDER].reverse(), ['mobile-h5', 'admin-web', 'learner-web', 'official-site']);
  assert.deepEqual(BATCH24_IMAGE_IDS, {
    'official-site': 'sha256:6b4d3f131dee4f1dffd754a874c54ca2b2dd260c823ca0d68be99245efd4c350',
    'learner-web': 'sha256:65604b139b39b342903ffef24e0c97db234bc62ee158a62722a65a8a697c2e62',
    'admin-web': 'sha256:0b1476bc48285a819999f57766899981f6fd5d39b6f7f0f2cf5369e293c5d8aa',
    'mobile-h5': 'sha256:2e5bf1468649d95c990aa5e95e666605fe1be18d24e110bd886c24b28d57473c'
  });
  assert.doesNotThrow(() => assertBatch24ImageIdsReady());
  assert.throws(() => assertBatch24ImageIdsReady({ ...BATCH24_IMAGE_IDS, 'official-site': '__UNSET_AFTER_BUILD__' }), /image ID is not filled/u);
  assert.doesNotThrow(() => assertBatch24ImageIdsReady(candidateIds));
  assert.throws(() => assertBatch24ImageIdsReady({ ...candidateIds, 'iam-service': image(905) }), /exactly official-site/u);
  assert.throws(() => batch24CandidateImages('unapproved-tag'), /approved tag/u);
  assert.deepEqual(Object.keys(batch24CandidateImages()).sort(), [...BATCH24_SERVICES].sort());
  for (const service of BATCH24_SERVICES) {
    assert.equal(batch24CandidateImages()[service], `cloudstudy-clyunedev/${service}:${BATCH24_RELEASE_TAG}`);
  }
});

test('candidate and rollback overlays contain exactly four approved frontend services', () => {
  const candidates = batch24CandidateImages();
  const baselines = Object.fromEntries(BATCH24_SERVICES.map((service) =>
    [service, `cloudstudy-clyunedev/${service}:batch23-verified` ]));
  const overlay = batch24OverrideText(candidates);
  const rollback = batch24RollbackOverrideText(baselines);
  assert.equal((overlay.match(/^  [a-z0-9-]+:$/gmu) || []).length, 4);
  assert.equal((rollback.match(/^  [a-z0-9-]+:$/gmu) || []).length, 4);
  assert.throws(() => batch24OverrideText({ ...candidates, 'iam-service': 'unexpected' }), /exactly/u);
  assert.throws(() => batch24OverrideText({ ...candidates, 'admin-web': 'unapproved' }), /approved Batch24 tag/u);
  assert.throws(() => batch24RollbackOverrideText({ ...baselines, 'iam-service': 'unexpected' }), /exactly/u);
  assert.throws(() => batch24RollbackOverrideText({ ...baselines, 'admin-web': 'other/admin-web:tag' }), /service repository/u);
});

test('Compose mutation args replace one approved service with no dependency, build, or pull', () => {
  for (const service of BATCH24_SERVICES) assert.deepEqual(batch24ComposeArgs(service), [
    'up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--force-recreate', service
  ]);
  assert.throws(() => batch24ComposeArgs('iam-service'), /four approved frontend services/u);
});

test('Batch24 source must exactly equal the verified Batch23 snapshot and retain 19/19 evidence', () => {
  const receipt = batch23Receipt();
  const state = { sharedBefore: structuredClone(sharedFingerprint) };
  assert.doesNotThrow(() => assertBatch24Baseline(receipt.verifiedSnapshot, receipt, state));
  const drift = structuredClone(receipt.verifiedSnapshot); drift['learner-service'].containerId = 'different';
  assert.throws(() => assertBatch24Baseline(drift, receipt, state), /exactly match the Batch23 verified snapshot/u);
  assert.throws(() => assertBatch24Baseline(receipt.verifiedSnapshot, { ...receipt, phase: 'promoted' }, state), /must be verified/u);
  assert.throws(() => assertBatch24Baseline(receipt.verifiedSnapshot, { ...receipt, readinessPassed: 18 }, state), /19\/19 readiness/u);
  assert.throws(() => assertBatch24Baseline(receipt.verifiedSnapshot, {
    ...receipt, readinessResults: Array.from({ length: 19 }, () => ({ status: 503 }))
  }, state), /status === 200/u);
  assert.throws(() => assertBatch24Baseline(receipt.verifiedSnapshot, {
    ...receipt, beforeSharedFingerprint: { containers: [], network: 'changed' }
  }, state), /shared-project fingerprint/u);
});

test('Compose plan changes only the four Batch24 services and preserves exact baseline refs for rollback', () => {
  const baseImages = Object.fromEntries(BATCH17_PRIVATE_SERVICES.map((service, index) =>
    [service, `cloudstudy-clyunedev/${service}:base-${index}`]));
  const images = batch24CandidateImages();
  const baselineImages = Object.fromEntries(BATCH24_SERVICES.map((service) => [service, baseImages[service]]));
  const config = (overrides) => ({ services: Object.fromEntries(BATCH17_PRIVATE_SERVICES.map((service) =>
    [service, { image: overrides[service] || baseImages[service] }])) });
  assert.doesNotThrow(() => assertBatch24Plan(config({}), config(images), config(baselineImages), images, baselineImages));
  const drift = { ...images, 'learner-service': 'cloudstudy-clyunedev/learner-service:unexpected' };
  assert.throws(() => assertBatch24Plan(config({}), config(drift), config(baselineImages), images, baselineImages), /changed outside Batch24/u);
});

test('promotion progress preserves the other 22 service identities and locks every target image ID', () => {
  const receipt = batch24Receipt(); const current = structuredClone(receipt.baselineSnapshot);
  for (const service of BATCH24_SERVICES) {
    current[service] = { ...current[service], containerId: `candidate-${service}`,
      imageId: receipt.imageIds[service], status: 'running' };
    receipt.serviceSnapshots[service] = structuredClone(current[service]);
    receipt.promotedServices.push(service);
  }
  receipt.promotedServices.sort(); receipt.phase = 'promoted';
  assert.doesNotThrow(() => assertBatch24Progress(current, receipt));
  assert.doesNotThrow(() => assertBatch24Promoted(current, receipt));
  const changedIdentity = structuredClone(current); changedIdentity['social-service'].containerId = 'unapproved-container';
  assert.throws(() => assertBatch24Progress(changedIdentity, receipt), /changed outside Batch24/u);
  const unapprovedImage = structuredClone(current); unapprovedImage['official-site'].imageId = image(999);
  assert.throws(() => assertBatch24Progress(unapprovedImage, receipt), /unapproved image/u);
});

test('interrupted promotion status can observe created or exited candidates without relaxing identity guards', () => {
  for (const status of ['created', 'exited']) {
    const receipt = batch24Receipt(); receipt.phase = 'promoting';
    const current = structuredClone(receipt.baselineSnapshot);
    const service = 'official-site';
    current[service] = { ...current[service], containerId: `interrupted-${status}-${service}`,
      imageId: receipt.imageIds[service], status };
    receipt.serviceSnapshots[service] = structuredClone(current[service]);

    assert.throws(() => assertBatch24Progress(current, receipt), /candidate is not running/u);
    assert.doesNotThrow(() => assertBatch24ObservedProgress(current, receipt));

    const wrongImage = structuredClone(current);
    wrongImage[service].imageId = image(999);
    assert.throws(() => assertBatch24ObservedProgress(wrongImage, receipt), /unapproved image/u);

    const wrongContainer = structuredClone(current);
    wrongContainer[service].containerId = 'different-container-than-recorded';
    assert.throws(() => assertBatch24ObservedProgress(wrongContainer, receipt), /container differs from receipt/u);

    const otherServiceDrift = structuredClone(current);
    otherServiceDrift['social-service'].containerId = 'unapproved-container';
    assert.throws(() => assertBatch24ObservedProgress(otherServiceDrift, receipt), /changed outside Batch24/u);

    assert.throws(() => assertBatch24ObservedProgress(current, { ...receipt, phase: 'preflighted' }),
      /candidate is not running/u);
  }
});

test('rollback requires durable per-service intent and restores four recorded Batch23 image IDs', () => {
  const receipt = batch24Receipt(); receipt.phase = 'rolling-back';
  const interruptedRollback = structuredClone(receipt.baselineSnapshot);
  interruptedRollback['mobile-h5'] = { ...interruptedRollback['mobile-h5'],
    containerId: 'restored-mobile-h5-before-receipt-commit' };
  assert.throws(() => assertBatch24ObservedProgress(interruptedRollback, receipt),
    /not recorded or covered by a durable rollback intent/u);
  receipt.rollbackInFlightServices = ['mobile-h5'];
  assert.doesNotThrow(() => assertBatch24ObservedProgress(interruptedRollback, receipt));
  assert.throws(() => assertBatch24ObservedProgress(interruptedRollback, {
    ...receipt, rollbackInFlightServices: ['learner-web']
  }), /not recorded or covered by a durable rollback intent/u);

  const current = structuredClone(receipt.baselineSnapshot);
  for (const service of BATCH24_SERVICES) current[service] = {
    ...current[service], containerId: `restored-${service}`, status: 'running'
  };
  assert.throws(() => assertBatch24Progress(current, receipt, { allowUnhealthyCandidate: true }),
    /not recorded or covered by a durable rollback intent/u);
  receipt.rollbackInFlightServices = [];
  receipt.rolledBackServices = [...BATCH24_SERVICES].sort();
  receipt.rolledBackSnapshot = structuredClone(current);
  assert.doesNotThrow(() => assertBatch24RollbackComplete(current, receipt));
  assert.throws(() => assertBatch24Progress({ ...current, 'audit-service': {
    ...current['audit-service'], containerId: 'changed-outside-targets'
  } }, receipt, { allowUnhealthyCandidate: true }), /changed outside Batch24/u);
  const incomplete = { ...receipt, rollbackInFlightServices: ['admin-web'] };
  assert.throws(() => assertBatch24RollbackComplete(current, incomplete), /uncommitted service intents/u);
});

test('readiness uses the candidate official-site image after promotion and the exact recorded baseline during rollback', () => {
  const receipt = batch24Receipt();
  receipt.phase = 'promoted';
  receipt.officialSiteImage = { image: 'cloudstudy-clyunedev/official-site:historical-b18', imageId: image(119) };
  assert.deepEqual(batch24ReadinessProbe(receipt), {
    service: 'official-site', image: receipt.images['official-site'],
    imageId: candidateIds['official-site'], source: 'batch24-candidate'
  });
  receipt.phase = 'rolling-back';
  assert.deepEqual(batch24ReadinessProbe(receipt), {
    service: 'official-site', image: receipt.baselineImages['official-site'],
    imageId: receipt.baselineImageIds['official-site'], source: 'recorded-baseline'
  });
  receipt.phase = 'rolled-back';
  assert.equal(batch24ReadinessProbe(receipt).imageId, receipt.baselineImageIds['official-site']);
  assert.equal(batch19ReadinessTargets().length, 19);
});
