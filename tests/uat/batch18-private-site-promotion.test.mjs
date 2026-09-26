import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  BATCH18_IAM_IMAGE,
  BATCH18_PROJECT,
  BATCH18_RELEASE_TAG,
  BATCH18_SERVICES,
  applyBatch18RollbackServices,
  applyBatch18Services,
  assertBatch18RollbackProgress,
  assertBatch18PrivateContext,
  assertBatch18PromotionProgress,
  batch18CandidateImages,
  batch18ComposeArgs,
  batch18OverrideText,
  batch18ReadinessProbeImage
} from '../../scripts/runtime/batch18-private-site-promotion.mjs';

const serviceNames = [
  'mysql', 'redis', 'minio', 'kafka', 'mysql-init', 'minio-init', 'mysql-migrate', 'iam-service',
  'api-gateway', 'official-site', 'learner-web', 'admin-web', 'mobile-h5', 'audit-service', 'workflow-service',
  'learner-service', 'content-service', 'learning-service', 'assessment-service', 'media-service',
  'notification-service', 'gamification-service', 'social-service', 'commerce-service', 'admin-ops-service',
  'analytics-service'
];
const image = (index) => `sha256:${String(index).padStart(64, '0')}`;

function snapshot() {
  return Object.fromEntries(serviceNames.map((service, index) => [service, {
    containerId: `${String(index + 1).padStart(64, 'a')}`,
    imageId: image(index + 1),
    status: ['mysql-init', 'minio-init', 'mysql-migrate'].includes(service) ? 'exited' : 'running',
    project: BATCH18_PROJECT,
    networks: [BATCH18_PROJECT],
    portBindings: {}
  }]));
}

function contextFixture() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `${BATCH18_PROJECT}-fixture-`));
  const join = (file) => path.join(tempDir, file);
  const paths = {
    tempDir,
    stateFile: join('state.json'), envFile: join('uat.env'), keyFile: join('iam-rsa-private.pem'),
    baseOverride: join('docker-compose.isolated.yml'), v17Receipt: join('iam-v17-private-promotion.json'),
    receipt: join('batch18-private-promotion.json'), override: join('docker-compose.batch18-promotion.yml'),
    rollbackOverride: join('docker-compose.batch18-rollback.yml')
  };
  for (const file of [paths.stateFile, paths.envFile, paths.keyFile, paths.baseOverride, paths.v17Receipt]) {
    fs.writeFileSync(file, '{}\n', { mode: 0o600 });
  }
  const state = {
    project: BATCH18_PROJECT,
    tempDir: paths.tempDir,
    stateFile: paths.stateFile,
    envFile: paths.envFile,
    keyFile: paths.keyFile,
    overrideFile: paths.baseOverride,
    tag: '583ab627-uat-batch9-202609231740',
    batch17ReleaseTag: '583ab627-uat-batch17-202609250206',
    batch17CandidateServices: ['official-site', 'content-service', 'learner-web', 'mobile-h5'],
    replacementImages: {
      'official-site': 'cloudstudy-clyunedev/official-site:583ab627-uat-batch17-202609250206',
      'mobile-h5': 'cloudstudy-clyunedev/mobile-h5:583ab627-uat-batch17-202609250206'
    },
    batch17CandidateImageIds: {
      'official-site': snapshot()['official-site'].imageId,
      'mobile-h5': snapshot()['mobile-h5'].imageId
    },
    sharedBefore: { containers: [], network: image(99) }
  };
  const iam = snapshot()['iam-service'];
  const v17Receipt = {
    project: BATCH18_PROJECT,
    stateFile: paths.stateFile,
    phase: 'complete',
    candidateImage: BATCH18_IAM_IMAGE,
    candidateImageId: iam.imageId,
    iamContainerId: iam.containerId,
    restoredSnapshot: { 'iam-service': iam },
    beforeSharedFingerprint: state.sharedBefore
  };
  return { state, paths, v17Receipt };
}

test('Batch18 tag and Compose commands are frozen to the exact two-service scope', () => {
  assert.deepEqual(Object.keys(batch18CandidateImages()), BATCH18_SERVICES);
  assert.deepEqual(batch18CandidateImages(), {
    'official-site': `cloudstudy-clyunedev/official-site:${BATCH18_RELEASE_TAG}`,
    'mobile-h5': `cloudstudy-clyunedev/mobile-h5:${BATCH18_RELEASE_TAG}`
  });
  assert.throws(() => batch18CandidateImages('583ab627-uat-batch18-other'), /approved build tag/u);
  assert.deepEqual(batch18ComposeArgs('official-site'), [
    'up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--force-recreate', 'official-site'
  ]);
  assert.throws(() => batch18ComposeArgs('iam-service'), /only official-site or mobile-h5/u);
});

test('Compose overlay fixes IAM V17 and only overrides the official site and mobile H5', () => {
  const text = batch18OverrideText({ images: batch18CandidateImages() });
  assert.match(text, new RegExp(`iam-service:\\n    image: ${BATCH18_IAM_IMAGE.replaceAll('/', '\\/')}`));
  assert.equal((text.match(/^  [a-z0-9-]+:$/gmu) || []).length, 3);
  assert.throws(() => batch18OverrideText({ images: { 'official-site': 'wrong' } }), /exactly the official-site/u);
});

test('private context requires completed IAM V17 from the same private state', () => {
  const { state, paths, v17Receipt } = contextFixture();
  assert.deepEqual(assertBatch18PrivateContext(state, paths.stateFile, v17Receipt, paths), paths);
  assert.throws(() => assertBatch18PrivateContext({ ...state, project: 'yuxuexing-local' }, paths.stateFile, v17Receipt, paths),
    /approved private Batch17 Compose project/u);
  assert.throws(() => assertBatch18PrivateContext(state, paths.stateFile, { ...v17Receipt, phase: 'verified' }, paths),
    /must be complete/u);
  assert.throws(() => assertBatch18PrivateContext(state, paths.stateFile, { ...v17Receipt, stateFile: 'other' }, paths),
    /another private state/u);
  assert.throws(() => assertBatch18PrivateContext(state, paths.stateFile, {
    ...v17Receipt, candidateImageId: image(80)
  }, paths), /inconsistent image identity/u);
  const resolvedTemp = path.resolve(paths.tempDir);
  const resolvedRoot = path.resolve(os.tmpdir());
  assert(path.relative(resolvedRoot, resolvedTemp).startsWith(`${BATCH18_PROJECT}-`));
  fs.rmSync(resolvedTemp, { recursive: true, force: true });
});

test('snapshot guard rejects host ports, foreign networks, and non-target service drift', () => {
  const before = snapshot();
  const ids = { 'official-site': image(90), 'mobile-h5': image(91) };
  const current = structuredClone(before);
  assert.doesNotThrow(() => assertBatch18PromotionProgress(current, before, ids));
  current.mysql.portBindings = { '3306/tcp': [{ HostPort: '13306' }] };
  assert.throws(() => assertBatch18PromotionProgress(current, before, ids), /publishes a host port/u);
  const network = structuredClone(before);
  network.redis.networks = ['shared-network'];
  assert.throws(() => assertBatch18PromotionProgress(network, before, ids), /attached to an unexpected network/u);
  const drift = structuredClone(before);
  drift['learner-web'].containerId = 'other';
  assert.throws(() => assertBatch18PromotionProgress(drift, before, ids), /changed outside the Batch18/u);
});

test('two-service promotion resumes after one exact candidate is already running', () => {
  const before = snapshot();
  const ids = { 'official-site': image(90), 'mobile-h5': image(91) };
  let current = structuredClone(before);
  current['official-site'] = {
    ...current['official-site'], containerId: 'b'.repeat(64), imageId: ids['official-site']
  };
  const applied = [];
  const result = applyBatch18Services({
    before,
    candidateImageIds: ids,
    snapshot: () => current,
    applyService: (service) => {
      applied.push(service);
      const original = current[service];
      current = {
        ...current,
        [service]: {
          ...original,
          containerId: 'c'.repeat(64),
          imageId: ids[service],
          status: 'running'
        }
      };
    }
  });
  assert.deepEqual(applied, ['mobile-h5']);
  assert.deepEqual(Object.keys(result).sort(), [...serviceNames].sort());
  assert.equal(result['official-site'].imageId, ids['official-site']);
  assert.equal(result['mobile-h5'].imageId, ids['mobile-h5']);
  assert.notEqual(result['mobile-h5'].containerId, before['mobile-h5'].containerId);
});

test('resume guard rejects candidate drift, stopped candidates, and changed non-targets', () => {
  const before = snapshot();
  const ids = { 'official-site': image(90), 'mobile-h5': image(91) };
  const changed = structuredClone(before);
  changed['official-site'] = { ...changed['official-site'], containerId: 'd'.repeat(64), imageId: image(92) };
  assert.throws(() => assertBatch18PromotionProgress(changed, before, ids), /unapproved image/u);
  const stopped = structuredClone(before);
  stopped['mobile-h5'] = { ...stopped['mobile-h5'], containerId: 'e'.repeat(64), imageId: ids['mobile-h5'], status: 'exited' };
  assert.throws(() => assertBatch18PromotionProgress(stopped, before, ids), /candidate is not running/u);
});

test('rollback resumes from mixed state and restores only the recorded Batch17 image IDs', () => {
  const before = snapshot();
  const ids = { 'official-site': image(90), 'mobile-h5': image(91) };
  let current = structuredClone(before);
  current['official-site'] = { ...current['official-site'], containerId: 'b'.repeat(64), imageId: ids['official-site'] };
  const applied = [];
  const result = applyBatch18RollbackServices({
    before,
    candidateImageIds: ids,
    snapshot: () => current,
    applyService: (service) => {
      applied.push(service);
      current = {
        ...current,
        [service]: { ...current[service], containerId: 'f'.repeat(64), imageId: before[service].imageId, status: 'running' }
      };
    }
  });
  assert.deepEqual(applied, ['official-site']);
  assertBatch18RollbackProgress(result, before, ids);
  for (const service of BATCH18_SERVICES) assert.equal(result[service].imageId, before[service].imageId);
});

test('readiness uses the selected official-site Node image for promotion or rollback', () => {
  const promoted = batch18ReadinessProbeImage({
    phase: 'promoted', images: { 'official-site': 'candidate-image' },
    imageIds: { 'official-site': image(90) }
  });
  assert.deepEqual(promoted, { image: 'candidate-image', imageId: image(90) });
  const rolledBack = batch18ReadinessProbeImage({
    phase: 'rolled-back', beforeImages: { 'official-site': 'baseline-image' },
    beforeSnapshot: { 'official-site': { imageId: image(12) } }
  });
  assert.deepEqual(rolledBack, { image: 'baseline-image', imageId: image(12) });
});
