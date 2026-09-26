import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  BATCH19_DRAIN_SERVICES,
  BATCH19_MIGRATOR_IMAGE,
  BATCH19_ORDER,
  BATCH19_OWNER_SCHEMAS,
  BATCH19_PROJECT,
  BATCH19_READINESS_INTERVAL_MS,
  BATCH19_READINESS_TIMEOUT_MS,
  BATCH19_RELEASE_TAG,
  BATCH19_SERVICES,
  applyBatch19Services,
  assertBatch19BackupReceipt,
  assertBatch19ContentPostState,
  assertBatch19DryRunSnapshot,
  assertBatch19NotificationPostState,
  assertBatch19PromotionProgress,
  assertBatch19RollbackGate,
  batch19CandidateImages,
  batch19ComposeArgs,
  batch19IdentityColumns,
  batch19IdentitySha256,
  batch19MigrationSourceSha256,
  batch19MigratorOverrideText,
  batch19OverrideText,
  batch19RollbackOverrideText,
  batch19StopArgs,
  batch19TargetRows,
  retryReadinessProbe
} from '../../scripts/runtime/batch19-private-promotion.mjs';
import { BATCH17_PRIVATE_SERVICES } from '../../scripts/runtime/uat-isolated-compose.mjs';
import { batch18CandidateImages } from '../../scripts/runtime/batch18-private-site-promotion.mjs';

const digest = (index) => `sha256:${String(index).padStart(64, '0')}`;

function baseSnapshot() {
  return Object.fromEntries(BATCH17_PRIVATE_SERVICES.map((service, index) => [service, {
    containerId: String(index + 1).padStart(64, 'a'), imageId: digest(index + 1),
    status: ['mysql-init', 'minio-init', 'mysql-migrate'].includes(service) ? 'exited' : 'running',
    project: BATCH19_PROJECT, networks: [BATCH19_PROJECT], portBindings: {}
  }]));
}

function targetRows() {
  return {
    'content-service': {
      b3_content_experience: [{ experience_id: 'b3-demo-1', availability: 'UNPUBLISHED' }],
      b25_content_vocabulary: [{ vocabulary_id: 'b25-item-001', availability: 'UNPUBLISHED' }],
      b2_content_chunk: [{ chunk_id: 32001, availability: 'UNPUBLISHED' }]
    },
    'iam-service': {
      iam_account: [{ principal_id: 'principal-demo-1' }],
      iam_permission: [{ permission_key: 'notification.preference.read.self' }],
      iam_role_permission: [{ role_id: 'role-learner', permission_id: 'perm-m1-016-notif-pref-read' }]
    },
    'notification-service': {
      notification_preference: [{ tenant_id: 'tenant-demo', principal_id: 'principal-demo-1',
        notification_type: 'study.reminder', channel: 'in_app' }]
    }
  };
}

function backupFixture() {
  const tempDir = path.join(os.tmpdir(), BATCH19_PROJECT + '-fixture');
  const paths = { tempDir, stateFile: path.join(tempDir, 'state.json') };
  const rows = targetRows();
  const versions = { 'content-service': 23, 'iam-service': 18, 'notification-service': 8 };
  const schemas = { 'content-service': 'content_service', 'iam-service': 'iam_service',
    'notification-service': 'notification_service' };
  const targets = {};
  for (const [service, tables] of Object.entries(rows)) {
    targets[service] = {
      schema: schemas[service], migrationVersion: versions[service],
      sourceSha256: batch19MigrationSourceSha256(service), tables: {}
    };
    for (const [table, items] of Object.entries(tables)) {
      const columns = batch19IdentityColumns(service, table);
      targets[service].tables[table] = {
        rowCount: items.length,
        identitySha256: batch19IdentitySha256(items, columns)
      };
    }
  }
  const createdAt = new Date().toISOString();
  const backup = {
    format: 1, project: BATCH19_PROJECT, stateFile: paths.stateFile, createdAt,
    schemas: [...BATCH19_OWNER_SCHEMAS],
    dump: { path: path.join(tempDir, 'batch19-full.sql'), bytes: 4096, sha256: 'b'.repeat(64) },
    preMigrationTargets: targets
  };
  const dumpInfo = { isFile: () => true, isSymbolicLink: () => false,
    size: 4096, mtimeMs: Date.now() };
  const state = { project: BATCH19_PROJECT };
  return { backup, dumpInfo, state, paths, rows };
}

test('release tag, candidate scope, and image overlays preserve Batch18 official-site', () => {
  assert.equal(BATCH19_RELEASE_TAG, '583ab627-uat-batch19-20260925');
  assert.deepEqual(BATCH19_ORDER, ['iam-service', 'content-service', 'notification-service', 'learner-web', 'mobile-h5']);
  assert.deepEqual(batch19CandidateImages(), Object.fromEntries(BATCH19_SERVICES.map((service) =>
    [service, `cloudstudy-clyunedev/${service}:${BATCH19_RELEASE_TAG}`])));
  const officialImage = batch18CandidateImages()['official-site'];
  const candidateImages = batch19CandidateImages();
  const overlay = batch19OverrideText({ images: candidateImages, officialImage });
  assert.equal((overlay.match(/^  [a-z0-9-]+:$/gmu) || []).length, 6);
  assert.match(overlay, new RegExp(`official-site:\\n    image: ${officialImage.replaceAll('/', '\\/')}`));
  assert.throws(() => batch19OverrideText({ images: candidateImages, officialImage: 'unapproved' }), /Batch18/u);
  assert.equal(BATCH19_MIGRATOR_IMAGE, `cloudstudy-clyunedev/owner-migrator:${BATCH19_RELEASE_TAG}`);
  assert.match(batch19MigratorOverrideText(), /mysql-migrate:\n    image: cloudstudy-clyunedev\/owner-migrator:/u);
  assert.deepEqual(batch19ComposeArgs('mobile-h5'), [
    'up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--force-recreate', 'mobile-h5'
  ]);
  assert.throws(() => batch19ComposeArgs('official-site'), /five approved services/u);
});

test('drain allowlist is exactly Gateway plus thirteen external owners, excluding IAM', () => {
  assert.equal(BATCH19_DRAIN_SERVICES.length, 14);
  assert.equal(new Set(BATCH19_DRAIN_SERVICES).size, 14);
  assert(BATCH19_DRAIN_SERVICES.includes('api-gateway'));
  assert(BATCH19_DRAIN_SERVICES.includes('content-service'));
  assert(BATCH19_DRAIN_SERVICES.includes('notification-service'));
  assert(!BATCH19_DRAIN_SERVICES.includes('iam-service'));
  assert.throws(() => batch19StopArgs('iam-service'), /drain list/u);
});

test('readiness probe retries transient responses and connection failures with a bounded fixed interval', async () => {
  assert.equal(BATCH19_READINESS_TIMEOUT_MS, 90_000);
  assert.equal(BATCH19_READINESS_INTERVAL_MS, 3_000);
  assert.equal(typeof batch19TargetRows, 'function');
  const outcomes = [503, new Error('connection refused'), 200];
  const delays = [];
  let clock = 0;
  const result = await retryReadinessProbe('http://content-service:18089/ready', {
    timeoutMs: 60_000,
    intervalMs: 3_000,
    requestTimeoutMs: 5_000,
    now: () => clock,
    sleep: async (delay) => { delays.push(delay); clock += delay; },
    fetchStatus: async () => {
      const outcome = outcomes.shift();
      if (outcome instanceof Error) throw outcome;
      return outcome;
    }
  });
  assert.deepEqual(result, { status: 200, attempts: 3, elapsedMs: 6_000 });
  assert.deepEqual(delays, [3_000, 3_000]);
  assert.equal(typeof new Function('return (' + retryReadinessProbe.toString() + ')')(), 'function');

  let timeoutClock = 0;
  await assert.rejects(retryReadinessProbe('http://notification-service:18093/ready', {
    timeoutMs: 60_000,
    intervalMs: 30_000,
    now: () => timeoutClock,
    sleep: async (delay) => { timeoutClock += delay; },
    fetchStatus: async () => 503
  }), /before timeout/u);
  assert.equal(timeoutClock, 60_000);
});

test('private migration drain accepts only original containers and resumes stop/start transitions', () => {
  const before = baseSnapshot();
  const ids = Object.fromEntries(BATCH19_SERVICES.map((service, index) => [service, digest(index + 80)]));
  const allStopped = structuredClone(before);
  for (const service of BATCH19_DRAIN_SERVICES) allStopped[service].status = 'exited';
  assert.doesNotThrow(() => assertBatch19PromotionProgress(allStopped, before, ids, [...BATCH19_DRAIN_SERVICES].sort()));

  const transition = structuredClone(allStopped);
  transition['api-gateway'].status = 'running';
  assert.throws(() => assertBatch19PromotionProgress(transition, before, ids,
    [...BATCH19_DRAIN_SERVICES].sort()), /should remain stopped/u);
  assert.doesNotThrow(() => assertBatch19PromotionProgress(transition, before, ids,
    [...BATCH19_DRAIN_SERVICES].sort(), BATCH19_DRAIN_SERVICES));
  transition['api-gateway'].containerId = 'wrong-container';
  assert.throws(() => assertBatch19PromotionProgress(transition, before, ids,
    [...BATCH19_DRAIN_SERVICES].sort(), BATCH19_DRAIN_SERVICES), /transitioning container changed/u);
});

test('dry-run accepts the exact verified Batch19 mobile container and diagnoses drift', () => {
  const before = baseSnapshot();
  const imageIds = Object.fromEntries(BATCH19_SERVICES.map((service, index) => [service, digest(index + 120)]));
  const current = structuredClone(before);
  for (const service of BATCH19_SERVICES) {
    current[service] = { ...current[service], containerId: `batch19-${service}`,
      imageId: imageIds[service], status: 'running' };
  }
  const receipt = {
    phase: 'verified', beforeSnapshot: before, imageIds, quiescedServices: [],
    verifiedSnapshot: structuredClone(current)
  };
  const b18 = { imageIds: {
    'official-site': before['official-site'].imageId,
    'mobile-h5': before['mobile-h5'].imageId
  } };
  const v17 = { candidateImageId: before['iam-service'].imageId };

  assert.doesNotThrow(() => assertBatch19DryRunSnapshot(current, { receipt, b18, v17 }));

  const staleMobileContainer = structuredClone(current);
  staleMobileContainer['mobile-h5'].containerId = 'unexpected-mobile-container';
  assert.throws(() => assertBatch19DryRunSnapshot(staleMobileContainer, { receipt, b18, v17 }),
    /mobile-h5 container ID differs from its verified receipt/u);

  const unapprovedMobile = structuredClone(current);
  unapprovedMobile['mobile-h5'].imageId = digest(999);
  assert.throws(() => assertBatch19DryRunSnapshot(unapprovedMobile, { receipt, b18, v17 }),
    /mobile-h5 runs an unapproved image/u);

  const changedOfficial = structuredClone(current);
  changedOfficial['official-site'].imageId = digest(1000);
  assert.throws(() => assertBatch19DryRunSnapshot(changedOfficial, { receipt, b18, v17 }),
    /official-site changed outside the five-service Batch19 scope/u);
});

test('backup receipt binds all fourteen schemas, dump hash, and all seven table identities', () => {
  const fixture = backupFixture();
  assert.doesNotThrow(() => assertBatch19BackupReceipt(fixture.backup, fixture.state,
    fixture.paths, fixture.dumpInfo, fixture.backup.dump.sha256));
  const stale = structuredClone(fixture.backup);
  stale.createdAt = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
  assert.throws(() => assertBatch19BackupReceipt(stale, fixture.state,
    fixture.paths, { ...fixture.dumpInfo, mtimeMs: Date.now() }, stale.dump.sha256), /stale/u);
  const wrongTarget = structuredClone(fixture.backup);
  wrongTarget.preMigrationTargets['iam-service'].sourceSha256 = '0'.repeat(64);
  assert.throws(() => assertBatch19BackupReceipt(wrongTarget, fixture.state,
    fixture.paths, fixture.dumpInfo, wrongTarget.dump.sha256), /source migration hash differs/u);
});

test('V23/V8 post-state preserves identities and refuses unsafe notification inference', () => {
  const fixture = backupFixture();
  assert.deepEqual(assertBatch19ContentPostState({ backup: fixture.backup,
    b3Rows: fixture.rows['content-service'].b3_content_experience,
    vocabularyRows: fixture.rows['content-service'].b25_content_vocabulary,
    chunkRows: fixture.rows['content-service'].b2_content_chunk
  }), { version: 23, targetTables: Object.keys(fixture.backup.preMigrationTargets['content-service'].tables) });
  const notificationRows = fixture.rows['notification-service'].notification_preference;
  assert.deepEqual(assertBatch19NotificationPostState({ backup: fixture.backup,
    archivedRows: notificationRows, canonicalRowCount: 0 }),
  { version: 8, archivedRows: 1, canonicalRowCount: 0 });
  assert.throws(() => assertBatch19NotificationPostState({ backup: fixture.backup,
    archivedRows: notificationRows, canonicalRowCount: 1 }), /must not infer canonical consent/u);
  assert.throws(() => assertBatch19ContentPostState({ backup: fixture.backup,
    b3Rows: [{ experience_id: 'b3-other', availability: 'UNPUBLISHED' }],
    vocabularyRows: fixture.rows['content-service'].b25_content_vocabulary,
    chunkRows: fixture.rows['content-service'].b2_content_chunk
  }), /changed target identities/u);
});

test('rollback is denied as soon as migration begins, even without history receipts', () => {
  assert.equal(assertBatch19RollbackGate({ migrationReceiptExists: false, migrationRows: {} }), true);
  assert.throws(() => assertBatch19RollbackGate({ migrationReceiptExists: false,
    migrationAttempted: true, migrationRows: {} }), /one-way/u);
  assert.throws(() => assertBatch19RollbackGate({ migrationReceiptExists: false,
    migrationRows: { 'notification-service': [{ version: 8, success: false }] } }), /one-way/u);
});

test('five-service promotion is resumable and never accepts an unlisted image', () => {
  const before = baseSnapshot();
  const imageIds = Object.fromEntries(BATCH19_SERVICES.map((service, index) => [service, digest(index + 90)]));
  let current = structuredClone(before);
  for (const service of ['content-service', 'notification-service']) current[service].status = 'exited';
  const applied = [];
  const result = applyBatch19Services({ before, imageIds, snapshot: () => current,
    quiesced: ['content-service', 'notification-service'],
    applyService: (service) => {
      applied.push(service);
      current = { ...current, [service]: { ...current[service],
        containerId: `candidate-${service}`, imageId: imageIds[service], status: 'running' } };
    }
  });
  assert.deepEqual(applied, BATCH19_ORDER);
  assert.deepEqual(Object.keys(result).sort(), [...BATCH17_PRIVATE_SERVICES].sort());
  for (const service of BATCH19_SERVICES) assert.equal(result[service].imageId, imageIds[service]);
  const drift = structuredClone(result);
  drift['learner-service'].containerId = 'unexpected-container';
  assert.throws(() => assertBatch19PromotionProgress(drift, before, imageIds), /changed outside/u);
});
