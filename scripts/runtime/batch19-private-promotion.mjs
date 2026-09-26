#!/usr/bin/env node
// Resumable Batch19 promotion for the approved isolated UAT Compose project only.
// This helper never selects or modifies the shared yuxuexing-local project.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  BATCH17_PRIVATE_SERVICES, assertBatch17PrivateSnapshot,
  assertPrivateComposeIsolation, assertPrivateTempPermissions, safeEnv
} from './uat-isolated-compose.mjs';
import {
  BATCH18_IAM_IMAGE, BATCH18_PROJECT, BATCH18_RELEASE_TAG, BATCH18_RECEIPT,
  BATCH18_SERVICES, BATCH18_OVERRIDE, BATCH18_V17_RECEIPT,
  batch18OverrideText, batch18CandidateImages
} from './batch18-private-site-promotion.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BATCH19_PROJECT = BATCH18_PROJECT;
export const BATCH19_RELEASE_TAG = '583ab627-uat-batch19-20260925';
export const BATCH19_MIGRATOR_IMAGE = 'cloudstudy-clyunedev/owner-migrator:' + BATCH19_RELEASE_TAG;
export const BATCH19_SERVICES = Object.freeze([
  'content-service', 'iam-service', 'notification-service', 'learner-web', 'mobile-h5'
]);
export const BATCH19_ORDER = Object.freeze([
  'iam-service', 'content-service', 'notification-service', 'learner-web', 'mobile-h5'
]);
export const BATCH19_READINESS_TIMEOUT_MS = 90_000;
export const BATCH19_READINESS_INTERVAL_MS = 3_000;
export const BATCH19_DRAIN_SERVICES = Object.freeze([
  'api-gateway', 'admin-ops-service', 'analytics-service', 'assessment-service',
  'audit-service', 'commerce-service', 'content-service', 'gamification-service',
  'learner-service', 'learning-service', 'media-service', 'notification-service',
  'social-service', 'workflow-service'
]);
export const BATCH19_OWNER_SCHEMAS = Object.freeze([
  'admin_ops_service', 'analytics_service', 'assessment_service', 'audit_service',
  'commerce_service', 'content_service', 'gamification_service', 'iam_service',
  'learner_service', 'learning_service', 'media_service', 'notification_service',
  'social_service', 'workflow_service'
]);
export const BATCH19_BACKUP_RECEIPT = 'batch19-full-backup.json';
export const BATCH19_MIGRATION_RECEIPT = 'batch19-migration-verification.json';
export const BATCH19_RECEIPT = 'batch19-private-promotion.json';
export const BATCH19_OVERRIDE = 'docker-compose.batch19-promotion.yml';
export const BATCH19_ROLLBACK_OVERRIDE = 'docker-compose.batch19-rollback.yml';
export const BATCH19_MIGRATOR_OVERRIDE = 'docker-compose.batch19-migrator.yml';
export const BATCH19_MIGRATIONS = Object.freeze({
  'content-service': Object.freeze({
    schema: 'content_service', version: 23, historyTable: 'p1r_schema_history',
    file: 'services/content-service/src/main/resources/db/migration/V23__unpublish_unbound_legacy_content.sql'
  }),
  'iam-service': Object.freeze({
    schema: 'iam_service', version: 18, historyTable: 'flyway_schema_history',
    script: 'V18__grant_canonical_notification_preference_permissions.sql',
    file: 'services/iam-service/src/main/resources/db/migration/V18__grant_canonical_notification_preference_permissions.sql'
  }),
  'notification-service': Object.freeze({
    schema: 'notification_service', version: 8, historyTable: 'p1r_schema_history',
    file: 'services/notification-service/src/main/resources/db/migration/V8__canonicalize_m1016_notification_preferences.sql'
  })
});
const phases = Object.freeze([
  'preflighted', 'writers-stopping', 'writers-stopped', 'migrations-verified',
  'migrations-started', 'migrator-restoring', 'migrator-restored', 'promoting',
  'promoted', 'verified', 'rollback-started', 'rolled-back'
]);

function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

function fileSha256(file) {
  const digest = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let count;
    do {
      count = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (count > 0) digest.update(buffer.subarray(0, count));
    } while (count > 0);
  } finally { fs.closeSync(fd); }
  return digest.digest('hex');
}

function migrationFile(service) {
  assert(BATCH19_MIGRATIONS[service], 'unknown Batch19 migration service');
  return path.join(root, BATCH19_MIGRATIONS[service].file);
}

export function batch19MigrationSourceSha256(service) {
  const sql = fs.readFileSync(migrationFile(service), 'utf8');
  assert(sql.trim(), service + ' migration SQL is empty');
  return sha256(sql.replaceAll('\r\n', '\n'));
}

export function batch19IdentitySha256(rows, columns) {
  assert(Array.isArray(rows) && Array.isArray(columns) && columns.length > 0,
    'identity digest requires rows and columns');
  const tuples = rows.map((row) => {
    assert(record(row), 'identity rows must be objects');
    return columns.map((column) => {
      assert(Object.hasOwn(row, column), 'identity row misses ' + column);
      return String(row[column]);
    });
  }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return sha256(JSON.stringify(tuples));
}

export async function retryReadinessProbe(url, {
  timeoutMs = 90_000, intervalMs = 3_000, requestTimeoutMs = 5_000,
  fetchStatus = async (target, timeout) =>
    (await fetch(target, { signal: AbortSignal.timeout(timeout) })).status,
  sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration)),
  now = () => Date.now()
} = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 60_000 || timeoutMs > 90_000) {
    throw new Error('readiness timeout must be between 60 and 90 seconds');
  }
  if (!Number.isFinite(intervalMs) || intervalMs <= 0 ||
      !Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) {
    throw new Error('readiness retry interval and request timeout must be positive');
  }
  const startedAt = now();
  const deadline = startedAt + timeoutMs;
  let attempts = 0;
  let lastStatus = null;
  let lastError = null;
  while (now() < deadline) {
    attempts += 1;
    try {
      lastStatus = await fetchStatus(url, requestTimeoutMs);
      lastError = null;
      if (lastStatus === 200) return { status: 200, attempts, elapsedMs: now() - startedAt };
    } catch (error) {
      lastStatus = null;
      lastError = String(error?.message || error);
    }
    const remaining = deadline - now();
    if (remaining <= 0) break;
    await sleep(Math.min(intervalMs, remaining));
  }
  throw new Error('readiness did not return HTTP 200 before timeout; attempts=' + attempts +
    '; lastStatus=' + String(lastStatus) + '; lastError=' + String(lastError || 'none'));
}

export function batch19CandidateImages(tag = BATCH19_RELEASE_TAG) {
  assert.equal(tag, BATCH19_RELEASE_TAG, 'Batch19 release tag differs from the approved tag');
  return Object.fromEntries(BATCH19_SERVICES.map((service) =>
    [service, 'cloudstudy-clyunedev/' + service + ':' + tag]));
}

export function batch19ComposeArgs(service) {
  assert(BATCH19_SERVICES.includes(service), 'Batch19 may replace only its five approved services');
  return ['up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--force-recreate', service];
}

export function batch19StopArgs(service) {
  assert(BATCH19_DRAIN_SERVICES.includes(service),
    'service is outside the exact Batch19 migrator drain list');
  return ['stop', '--timeout', '30', service];
}

export function batch19OverrideText({ images, officialImage }) {
  assert.deepEqual(Object.keys(images || {}).sort(), [...BATCH19_SERVICES].sort(),
    'Batch19 overlay must contain exactly five candidate services');
  assert.equal(officialImage, batch18CandidateImages()['official-site'],
    'Batch19 must preserve the verified Batch18 official-site image');
  for (const service of BATCH19_SERVICES) {
    assert.equal(images[service], batch19CandidateImages()[service],
      service + ' image differs from the approved Batch19 tag');
  }
  const mapping = { 'official-site': officialImage, ...images };
  return 'services:\n' + ['official-site', ...BATCH19_SERVICES].map((service) =>
    '  ' + service + ':\n    image: ' + mapping[service] + '\n').join('');
}

export function batch19RollbackOverrideText({ beforeImages, officialImage }) {
  assert.deepEqual(Object.keys(beforeImages || {}).sort(), [...BATCH19_SERVICES].sort(),
    'rollback overlay must contain exactly the five recorded baseline images');
  assert.equal(officialImage, batch18CandidateImages()['official-site'],
    'rollback must preserve the verified Batch18 official-site image');
  for (const service of BATCH19_SERVICES) {
    assert.match(beforeImages[service] || '',
      new RegExp('^cloudstudy-clyunedev/' + service + ':[A-Za-z0-9._-]+$'),
      service + ' rollback image must use the recorded private repository tag');
  }
  const mapping = { 'official-site': officialImage, ...beforeImages };
  return 'services:\n' + ['official-site', ...BATCH19_SERVICES].map((service) =>
    '  ' + service + ':\n    image: ' + mapping[service] + '\n').join('');
}

export function batch19MigratorOverrideText() {
  return 'services:\n  mysql-migrate:\n    image: ' + BATCH19_MIGRATOR_IMAGE + '\n';
}

function samePath(left, right) {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function within(base, target, message) {
  const relative = path.relative(path.resolve(base), path.resolve(target));
  assert(relative && relative !== '..' && !relative.startsWith('..' + path.sep)
    && !path.isAbsolute(relative), message);
  return path.resolve(target);
}

function pathsFor(state) {
  const tempDir = path.resolve(state.tempDir || '');
  return {
    tempDir, stateFile: path.join(tempDir, 'state.json'),
    envFile: path.join(tempDir, 'uat.env'), keyFile: path.join(tempDir, 'iam-rsa-private.pem'),
    baseOverride: path.join(tempDir, 'docker-compose.isolated.yml'),
    v17: path.join(tempDir, BATCH18_V17_RECEIPT),
    batch18: path.join(tempDir, BATCH18_RECEIPT),
    batch18Override: path.join(tempDir, BATCH18_OVERRIDE),
    backup: path.join(tempDir, BATCH19_BACKUP_RECEIPT),
    migration: path.join(tempDir, BATCH19_MIGRATION_RECEIPT),
    receipt: path.join(tempDir, BATCH19_RECEIPT),
    override: path.join(tempDir, BATCH19_OVERRIDE),
    rollbackOverride: path.join(tempDir, BATCH19_ROLLBACK_OVERRIDE),
    migratorOverride: path.join(tempDir, BATCH19_MIGRATOR_OVERRIDE)
  };
}

function validateContext(state, stateFile, paths, v17, b18) {
  assert.equal(state.project, BATCH19_PROJECT, 'only the approved private UAT project is allowed');
  assert.equal(state.tag, '583ab627-uat-batch9-202609231740', 'private base tag changed');
  assert.equal(state.batch17ReleaseTag, '583ab627-uat-batch17-202609250206',
    'private Batch17 baseline release changed');
  within(os.tmpdir(), paths.tempDir, 'private state must stay under OS temp');
  assert(path.basename(paths.tempDir).startsWith(BATCH19_PROJECT + '-'),
    'private temp directory does not match the isolated project');
  assert(samePath(stateFile, paths.stateFile), 'state.json belongs to another private project');
  for (const [key, target] of Object.entries({
    stateFile: paths.stateFile, envFile: paths.envFile, keyFile: paths.keyFile,
    overrideFile: paths.baseOverride
  })) assert(samePath(state[key], target), key + ' escaped the private temp directory');
  for (const file of [paths.tempDir, paths.stateFile, paths.envFile, paths.keyFile,
    paths.baseOverride, paths.v17, paths.batch18, paths.batch18Override]) {
    const info = fs.lstatSync(file);
    if (file === paths.tempDir) assert(info.isDirectory() && !info.isSymbolicLink(),
      'private temp root must be a real directory');
    else assert(info.isFile() && !info.isSymbolicLink(), 'private state must use regular files');
  }
  assert.equal(v17.project, BATCH19_PROJECT);
  assert(samePath(v17.stateFile, paths.stateFile));
  assert.equal(v17.phase, 'complete', 'IAM V17 must be complete');
  assert.equal(v17.candidateImage, BATCH18_IAM_IMAGE);
  assert.match(v17.candidateImageId || '', /^sha256:[a-f0-9]{64}$/u);
  assert.equal(b18.project, BATCH19_PROJECT);
  assert(samePath(b18.stateFile, paths.stateFile));
  assert.equal(b18.phase, 'verified', 'Batch18 official/mobile promotion must be verified');
  assert.equal(b18.releaseTag, BATCH18_RELEASE_TAG);
  assert.deepEqual(b18.services, [...BATCH18_SERVICES]);
  assert.deepEqual(b18.images, batch18CandidateImages());
  assert.deepEqual(b18.beforeSharedFingerprint, state.sharedBefore);
  assert.equal(b18.beforeSnapshot?.['iam-service']?.imageId, v17.candidateImageId);
  assert.equal(b18.beforeSnapshot?.['iam-service']?.containerId, v17.iamContainerId);
}

const backupTables = Object.freeze({
  'content-service': ['b3_content_experience', 'b25_content_vocabulary', 'b2_content_chunk'],
  'iam-service': ['iam_account', 'iam_permission', 'iam_role_permission'],
  'notification-service': ['notification_preference']
});

export function assertBatch19BackupReceipt(backup, state, paths, dumpInfo = null, dumpHash = null) {
  assert(record(backup), 'Batch19 full-backup receipt is missing');
  assert.equal(backup.format, 1);
  assert.equal(backup.project, BATCH19_PROJECT);
  assert(samePath(backup.stateFile, paths.stateFile));
  const createdAt = Date.parse(backup.createdAt);
  assert(Number.isFinite(createdAt) && new Date(createdAt).toISOString() === backup.createdAt,
    'backup createdAt must be an ISO date');
  const now = Date.now();
  assert(createdAt <= now + 5 * 60_000, 'backup timestamp is in the future');
  assert(now - createdAt <= 2 * 60 * 60_000, 'full database backup is stale');
  assert.deepEqual([...backup.schemas].sort(), [...BATCH19_OWNER_SCHEMAS].sort(),
    'backup must include all 14 configured owner schemas');
  assert(record(backup.dump), 'full database dump metadata is missing');
  const dump = within(paths.tempDir, backup.dump.path, 'database dump must be under the private temp directory');
  const info = dumpInfo || fs.lstatSync(dump);
  assert(info.isFile() && !info.isSymbolicLink(), 'database dump must be a regular private file');
  assert(info.mtimeMs + 60_000 >= createdAt, 'dump file predates its receipt timestamp');
  assert(Number.isSafeInteger(backup.dump.bytes) && backup.dump.bytes > 1024);
  assert.equal(info.size, backup.dump.bytes, 'database dump byte count changed');
  assert.match(backup.dump.sha256 || '', /^[a-f0-9]{64}$/u);
  assert.equal(dumpHash || fileSha256(dump), backup.dump.sha256, 'database dump hash changed');
  assert(record(backup.preMigrationTargets), 'pre-migration target counts and identities are required');
  assert.deepEqual(Object.keys(backup.preMigrationTargets).sort(), Object.keys(backupTables).sort());
  for (const [service, tables] of Object.entries(backupTables)) {
    const owner = backup.preMigrationTargets[service];
    const migration = BATCH19_MIGRATIONS[service];
    assert.equal(owner.schema, migration.schema, service + ' schema differs');
    assert.equal(Number(owner.migrationVersion), migration.version, service + ' migration version differs');
    assert.equal(owner.sourceSha256, batch19MigrationSourceSha256(service),
      service + ' source migration hash differs');
    assert.deepEqual(Object.keys(owner.tables || {}).sort(), [...tables].sort());
    for (const table of tables) {
      const item = owner.tables[table];
      assert(Number.isSafeInteger(item?.rowCount) && item.rowCount >= 0,
        service + '.' + table + ' row count is invalid');
      assert.match(item?.identitySha256 || '', /^[a-f0-9]{64}$/u,
        service + '.' + table + ' identity hash is invalid');
    }
  }
  assert.equal(state.project, backup.project);
  return { dump, digest: sha256(JSON.stringify(backup)) };
}

export function assertBatch19ContentPostState({ backup, b3Rows, vocabularyRows, chunkRows }) {
  const expected = backup.preMigrationTargets['content-service'].tables;
  for (const [table, rows, column] of [
    ['b3_content_experience', b3Rows, 'experience_id'],
    ['b25_content_vocabulary', vocabularyRows, 'vocabulary_id'],
    ['b2_content_chunk', chunkRows, 'chunk_id']
  ]) {
    assert.equal(rows.length, expected[table].rowCount, 'V23 changed target identity count for ' + table);
    assert.equal(batch19IdentitySha256(rows, [column]), expected[table].identitySha256,
      'V23 changed target identities for ' + table);
    assert(rows.every((row) => String(row.availability).toUpperCase() === 'UNPUBLISHED'),
      'V23 left a targeted legacy record published in ' + table);
  }
  return { version: 23, targetTables: Object.keys(expected) };
}

export function assertBatch19NotificationPostState({ backup, archivedRows, canonicalRowCount }) {
  const expected = backup.preMigrationTargets['notification-service'].tables.notification_preference;
  assert.equal(archivedRows.length, expected.rowCount, 'V8 did not retain all historical preference rows');
  assert.equal(batch19IdentitySha256(archivedRows,
    ['tenant_id', 'principal_id', 'notification_type', 'channel']), expected.identitySha256,
  'V8 changed archived preference identities');
  assert.equal(canonicalRowCount, 0, 'V8 must not infer canonical consent from historical enabled values');
  return { version: 8, archivedRows: archivedRows.length, canonicalRowCount };
}

export function assertBatch19PromotionProgress(snapshot, before, imageIds, quiesced = [], restoring = []) {
  assertBatch17PrivateSnapshot(snapshot, BATCH19_PROJECT);
  assertBatch17PrivateSnapshot(before, BATCH19_PROJECT);
  assert.deepEqual(Object.keys(imageIds || {}).sort(), [...BATCH19_SERVICES].sort());
  const stopped = new Set(quiesced);
  const beingRestored = new Set(restoring);
  assert([...stopped].every((service) => BATCH19_DRAIN_SERVICES.includes(service)));
  assert([...beingRestored].every((service) => BATCH19_DRAIN_SERVICES.includes(service)));
  for (const service of BATCH19_SERVICES) {
    assert.match(imageIds[service] || '', /^sha256:[a-f0-9]{64}$/u);
    assert.notEqual(imageIds[service], before[service].imageId);
  }
  for (const service of BATCH17_PRIVATE_SERVICES) {
    const actual = snapshot[service];
    const original = before[service];
    if (!BATCH19_SERVICES.includes(service)) {
      if (beingRestored.has(service)) {
        assert.equal(actual.containerId, original.containerId, service + ' transitioning container changed');
        assert.equal(actual.imageId, original.imageId, service + ' transitioning image changed');
        assert(['running', 'exited'].includes(actual.status), service + ' transition state is invalid');
      } else if (stopped.has(service)) {
        assert.equal(actual.containerId, original.containerId, service + ' stopped container changed');
        assert.equal(actual.imageId, original.imageId, service + ' stopped image changed');
        assert.equal(actual.status, 'exited', service + ' should remain stopped');
      } else assert.deepEqual(actual, original, service + ' changed outside the five-service Batch19 scope');
    } else if (actual.containerId === original.containerId) {
      assert.equal(actual.imageId, original.imageId, service + ' changed image without container replacement');
      if (beingRestored.has(service)) {
        assert(['running', 'exited'].includes(actual.status), service + ' transition state is invalid');
      } else if (stopped.has(service)) assert.equal(actual.status, 'exited', service + ' should remain stopped');
      else assert.deepEqual(actual, original, service + ' changed without candidate replacement');
    } else {
      assert.equal(actual.imageId, imageIds[service], service + ' runs an unapproved image');
      assert.equal(actual.status, 'running', service + ' candidate is not running');
    }
  }
  return snapshot;
}

export function assertBatch19RollbackGate({ migrationReceiptExists, migrationAttempted = false, migrationRows = {} }) {
  const applied = Object.entries(BATCH19_MIGRATIONS).some(([service, migration]) =>
    (migrationRows[service] || []).some((row) =>
      String(row.version) === String(migration.version)));
  assert(!migrationReceiptExists && !migrationAttempted && !applied,
    'V23/V18/V8 migrations are one-way; service rollback is blocked after any migration');
  return true;
}

export function applyBatch19Services({ before, imageIds, snapshot, applyService, recordProgress = () => {},
  quiesced = [] }) {
  for (const service of BATCH19_ORDER) {
    let current = assertBatch19PromotionProgress(snapshot(), before, imageIds, quiesced);
    if (current[service].imageId !== imageIds[service]) {
      assert.equal(current[service].containerId, before[service].containerId,
        service + ' is neither baseline nor recorded candidate');
      applyService(service);
      current = assertBatch19PromotionProgress(snapshot(), before, imageIds,
        quiesced.filter((item) => item !== service));
      assert.equal(current[service].imageId, imageIds[service], service + ' did not start exact candidate image');
      assert.notEqual(current[service].containerId, before[service].containerId,
        service + ' candidate container was not recreated');
      assert.equal(current[service].status, 'running', service + ' candidate is not running');
    }
    recordProgress(service, current);
  }
  return assertBatch19PromotionProgress(snapshot(), before, imageIds, []);
}

export function batch19ReadinessTargets() {
  return [
    ['official-site', 18182, '/'], ['learner-web', 8080, '/'],
    ['admin-web', 8080, '/'], ['mobile-h5', 8080, '/'],
    ['iam-service', 18087, '/actuator/health/readiness'],
    ['api-gateway', 18070, '/actuator/health/readiness'],
    ['audit-service', 18099, '/actuator/health/readiness'],
    ['workflow-service', 18071, '/actuator/health/readiness'],
    ['learner-service', 18088, '/actuator/health/readiness'],
    ['content-service', 18089, '/actuator/health/readiness'],
    ['learning-service', 18090, '/actuator/health/readiness'],
    ['assessment-service', 18091, '/actuator/health/readiness'],
    ['media-service', 18092, '/actuator/health/readiness'],
    ['notification-service', 18093, '/actuator/health/readiness'],
    ['gamification-service', 18094, '/actuator/health/readiness'],
    ['social-service', 18095, '/actuator/health/readiness'],
    ['commerce-service', 18096, '/actuator/health/readiness'],
    ['admin-ops-service', 18097, '/actuator/health/readiness'],
    ['analytics-service', 18098, '/actuator/health/readiness']
  ];
}

function readJson(file, message) {
  const info = fs.lstatSync(file);
  assert(info.isFile() && !info.isSymbolicLink(), message);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  const temporary = file + '.' + process.pid + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
  const fd = fs.openSync(temporary, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, JSON.stringify(data, null, 2) + '\n');
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  fs.renameSync(temporary, file);
}

function ensureOverride(file, text, label) {
  if (fs.existsSync(file)) {
    const info = fs.lstatSync(file);
    assert(info.isFile() && !info.isSymbolicLink());
    assert.equal(fs.readFileSync(file, 'utf8'), text, 'unexpected ' + label + ' exists');
    return;
  }
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, text); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

function docker(args, { output = false, timeout = 120000, input } = {}) {
  const result = spawnSync('docker', args, {
    cwd: root, env: safeEnv(), encoding: 'utf8', timeout,
    maxBuffer: 32 * 1024 * 1024, input, windowsHide: true
  });
  assert(!result.error && result.status === 0,
    'private Batch19 Docker operation failed; output was suppressed');
  return output ? result.stdout.trim() : '';
}

function composeArgs(state, paths, args, { overlay = paths.override, includeB19 = true } = {}) {
  const files = [
    'compose', '-p', state.project, '--env-file', paths.envFile,
    '-f', path.join(root, 'infra/docker/clyunedev/docker-compose.core.yml'),
    '-f', path.join(root, 'infra/docker/clyunedev/docker-compose.full.yml'),
    '-f', paths.baseOverride, '-f', paths.batch18Override
  ];
  if (includeB19 && overlay) files.push('-f', overlay);
  return [...files, ...args];
}

function compose(state, paths, args, options = {}) {
  const { overlay = paths.override, includeB19 = true, ...opts } = options;
  return docker(composeArgs(state, paths, args, { overlay, includeB19 }), opts);
}

function imageId(image) {
  const items = JSON.parse(docker(['image', 'inspect', image], { output: true }));
  assert.equal(items.length, 1);
  assert((items[0].RepoTags || []).includes(image));
  assert.match(items[0].Id || '', /^sha256:[a-f0-9]{64}$/u);
  return items[0].Id;
}

function snapshot(state) {
  const ids = docker(['ps', '-a', '--filter', 'label=com.docker.compose.project=' + state.project,
    '--format', '{{.ID}}'], { output: true }).split(/\r?\n/u).filter(Boolean);
  assert.equal(ids.length, BATCH17_PRIVATE_SERVICES.length, 'private project must contain exactly 26 containers');
  const items = JSON.parse(docker(['inspect', ...ids], { output: true }));
  const result = {};
  for (const item of items) {
    assert.equal(item.Config.Labels['com.docker.compose.project'], BATCH19_PROJECT);
    const service = item.Config.Labels['com.docker.compose.service'];
    assert(service && !Object.hasOwn(result, service));
    result[service] = {
      containerId: item.Id, imageId: item.Image, status: item.State.Status, project: BATCH19_PROJECT,
      networks: Object.keys(item.NetworkSettings.Networks || {}).sort(),
      portBindings: item.HostConfig.PortBindings || {}
    };
  }
  return assertBatch17PrivateSnapshot(result, BATCH19_PROJECT);
}

function sharedFingerprint() {
  const containers = docker(['ps', '-a', '--filter', 'name=^/yuxuexing-local-',
    '--format', '{{.ID}}|{{.Names}}'], { output: true }).split(/\r?\n/u).filter(Boolean).sort();
  const network = docker(['network', 'inspect', 'yuxuexing-local_yuxuexing-local', '--format', '{{.Id}}'],
    { output: true });
  return { containers, network };
}

function guardShared(state) {
  assert.deepEqual(sharedFingerprint(), state.sharedBefore,
    'shared yuxuexing-local fingerprint changed; Batch19 stopped');
}

function proxySnapshot(state) {
  const name = state.project + '-https-proxy';
  const items = JSON.parse(docker(['inspect', name], { output: true }));
  assert.equal(items.length, 1);
  const item = items[0];
  const result = {
    name, containerId: item.Id, imageId: item.Image, status: item.State.Status,
    project: item.Config.Labels['com.cloudstudy.uat.project'],
    networks: Object.keys(item.NetworkSettings.Networks || {}).sort(),
    portBindings: item.HostConfig.PortBindings || {}
  };
  assert.equal(item.Name, '/' + name);
  assert.equal(result.project, state.project);
  assert.equal(result.status, 'running');
  assert.deepEqual(result.networks, [state.project]);
  assert.deepEqual(result.portBindings, {});
  return result;
}

function readBaselineConfig(state, paths, b18) {
  const config = JSON.parse(docker(composeArgs(state, paths, ['config', '--format', 'json'], {
    overlay: null, includeB19: false
  }), { output: true }));
  assertPrivateComposeIsolation(state, config);
  assert.equal(config.name, state.project);
  const expected = { ...b18.images, 'iam-service': BATCH18_IAM_IMAGE };
  for (const [service, tag] of Object.entries(expected)) {
    assert.equal(config.services[service]?.image, tag, service + ' baseline tag differs from B18/V17 receipt');
  }
  return config;
}

function migrationRows(service) {
  const migration = BATCH19_MIGRATIONS[service];
  const fields = service === 'iam-service' ? 'version,script,checksum,success' : 'version,checksum';
  const version = service === 'iam-service' ? "'" + migration.version + "'" : String(migration.version);
  const sql = 'SELECT ' + fields + ' FROM ' + migration.schema + '.' + migration.historyTable +
    ' WHERE version=' + version;
  const output = docker(['exec', BATCH19_PROJECT + '-mysql-1', 'sh', '-ec',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --user=root --batch --skip-column-names -e "$1"',
    '--', sql], { output: true, timeout: 30000 });
  return output.split(/\r?\n/u).filter(Boolean).map((line) => line.split('\t'));
}

function verifyMigrationHistory(service, checksum = batch19MigrationSourceSha256(service)) {
  const rows = migrationRows(service);
  assert.equal(rows.length, 1, service + ' must have exactly one successful migration history row');
  const migration = BATCH19_MIGRATIONS[service];
  if (service === 'iam-service') {
    assert.equal(String(rows[0][0]), String(migration.version));
    assert.equal(rows[0][1], migration.script);
    assert.equal(String(rows[0][3]), '1', 'IAM V18 Flyway migration is not successful');
    return { version: migration.version, script: rows[0][1], checksum: rows[0][2], success: true };
  }
  assert.equal(Number(rows[0][0]), migration.version);
  assert.equal(rows[0][1], checksum, service + ' SQL checksum differs from reviewed source');
  return { version: migration.version, checksum: rows[0][1], success: true };
}

function mysql(sql) {
  const output = docker(['exec', BATCH19_PROJECT + '-mysql-1', 'sh', '-ec',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --user=root --batch --skip-column-names -e "$1"',
    '--', sql], { output: true, timeout: 30000 });
  return output.split(/\r?\n/u).filter(Boolean).map((line) => line.split('\t'));
}

function queryRows(schema, table, columns, where) {
  const ident = /^[a-z0-9_]+$/u;
  assert(ident.test(schema) && ident.test(table) && columns.every((item) => ident.test(item)));
  const sql = 'SELECT ' + columns.join(',') + ' FROM ' + schema + '.' + table +
    ' WHERE ' + where + ' ORDER BY ' + columns.join(',');
  return mysql(sql).map((values) => Object.fromEntries(columns.map((column, index) =>
    [column, values[index]])));
}

function parseContentRoster() {
  const sql = fs.readFileSync(migrationFile('content-service'), 'utf8');
  const start = sql.indexOf('AND (experience_id, domain_code, resource_type, resource_key) IN (');
  const end = sql.indexOf('   AND content_version_id = 301', start);
  assert(start >= 0 && end > start, 'V23 content target roster could not be parsed');
  const ids = [...sql.slice(start, end).matchAll(/\('([^']+)',\s*'[^']+',\s*'[^']+',\s*'[^']+'\)/gu)]
    .map((match) => match[1]);
  assert(ids.length > 0 && new Set(ids).size === ids.length);
  assert(ids.every((id) => /^b3-[a-z0-9-]+$/u.test(id)));
  return ids;
}

export function batch19TargetRows() {
  const ids = parseContentRoster().map((id) => "'" + id + "'").join(',');
  return {
    'content-service': {
      b3_content_experience: queryRows('content_service', 'b3_content_experience',
        ['experience_id'], 'experience_id IN (' + ids + ')'),
      b25_content_vocabulary: queryRows('content_service', 'b25_content_vocabulary',
        ['vocabulary_id'], "vocabulary_id='b25-item-001'"),
      b2_content_chunk: queryRows('content_service', 'b2_content_chunk', ['chunk_id'], 'chunk_id=32001')
    },
    'iam-service': {
      iam_account: queryRows('iam_service', 'iam_account', ['principal_id'],
        "status='ACTIVE' AND FIND_IN_SET('learner',roles)>0"),
      iam_permission: queryRows('iam_service', 'iam_permission', ['permission_key'],
        "permission_key IN ('notification.preference.read.self','notification.preference.write.self')"),
      iam_role_permission: queryRows('iam_service', 'iam_role_permission', ['role_id','permission_id'],
        "role_id='role-learner' AND permission_id IN ('perm-m1-016-notif-pref-read','perm-m1-016-notif-pref-write')")
    },
    'notification-service': {
      notification_preference: queryRows('notification_service', 'notification_preference',
        ['tenant_id','principal_id','notification_type','channel'], '1=1')
    }
  };
}

export function batch19IdentityColumns(service, table) {
  if (table === 'b3_content_experience') return ['experience_id'];
  if (table === 'b25_content_vocabulary') return ['vocabulary_id'];
  if (table === 'b2_content_chunk') return ['chunk_id'];
  if (table === 'iam_account') return ['principal_id'];
  if (table === 'iam_permission') return ['permission_key'];
  if (table === 'iam_role_permission') return ['role_id','permission_id'];
  if (service === 'notification-service') return ['tenant_id','principal_id','notification_type','channel'];
  throw new Error('unknown pre-migration identity table');
}

function compareBackupTargets(backup, observed) {
  for (const [service, tables] of Object.entries(observed)) {
    for (const [table, rows] of Object.entries(tables)) {
      const expected = backup.preMigrationTargets[service].tables[table];
      assert.equal(rows.length, expected.rowCount, service + '.' + table + ' live count differs from backup receipt');
      assert.equal(batch19IdentitySha256(rows, batch19IdentityColumns(service, table)), expected.identitySha256,
        service + '.' + table + ' live identities differ from backup receipt');
    }
  }
}

function contentPostState(backup) {
  const ids = parseContentRoster().map((id) => "'" + id + "'").join(',');
  const b3Rows = mysql('SELECT experience_id,availability FROM content_service.b3_content_experience ' +
    'WHERE experience_id IN (' + ids + ') ORDER BY experience_id')
    .map(([experience_id, availability]) => ({ experience_id, availability }));
  const vocabularyRows = mysql("SELECT vocabulary_id,availability FROM content_service.b25_content_vocabulary " +
    "WHERE vocabulary_id='b25-item-001' ORDER BY vocabulary_id")
    .map(([vocabulary_id, availability]) => ({ vocabulary_id, availability }));
  const chunkRows = mysql('SELECT chunk_id,availability FROM content_service.b2_content_chunk ' +
    'WHERE chunk_id=32001 ORDER BY chunk_id').map(([chunk_id, availability]) => ({ chunk_id, availability }));
  return assertBatch19ContentPostState({ backup, b3Rows, vocabularyRows, chunkRows });
}

function notificationPostState(backup) {
  const archivedRows = mysql('SELECT tenant_id,principal_id,notification_type,channel ' +
    'FROM notification_service.notification_preference_legacy ' +
    'ORDER BY tenant_id,principal_id,notification_type,channel')
    .map(([tenant_id,principal_id,notification_type,channel]) =>
      ({ tenant_id,principal_id,notification_type,channel }));
  const count = mysql('SELECT COUNT(*) FROM notification_service.notification_preference');
  assert.equal(count.length, 1);
  return assertBatch19NotificationPostState({
    backup, archivedRows, canonicalRowCount: Number(count[0][0])
  });
}

function readBackup(state, paths, receipt = null) {
  const backup = readJson(paths.backup, 'full-backup receipt must be a regular private file');
  assertBatch19BackupReceipt(backup, state, paths);
  if (receipt?.backupReceiptSha256) {
    assert.equal(sha256(JSON.stringify(backup)), receipt.backupReceiptSha256,
      'full-backup receipt changed after preflight');
  }
  return backup;
}

function migrationEvidence(state, paths, backup) {
  const contentChecksum = batch19MigrationSourceSha256('content-service');
  const notificationChecksum = batch19MigrationSourceSha256('notification-service');
  const contentHistory = verifyMigrationHistory('content-service', contentChecksum);
  const contentOutcome = contentPostState(backup);
  const notificationHistory = verifyMigrationHistory('notification-service', notificationChecksum);
  const notificationOutcome = notificationPostState(backup);
  guardShared(state);
  return {
    format: 1, project: state.project, stateFile: paths.stateFile,
    releaseTag: BATCH19_RELEASE_TAG, backupSha256: backup.dump.sha256,
    verifiedAt: new Date().toISOString(),
    migrations: {
      'content-service': { schema: 'content_service', historyTable: 'p1r_schema_history',
        sourceSha256: contentChecksum, ...contentHistory, outcome: contentOutcome },
      'notification-service': { schema: 'notification_service', historyTable: 'p1r_schema_history',
        sourceSha256: notificationChecksum, ...notificationHistory, outcome: notificationOutcome }
    }
  };
}

export function assertBatch19MigrationReceipt(evidence, backup, stateFile) {
  assert(record(evidence));
  assert.equal(evidence.format, 1);
  assert.equal(evidence.project, BATCH19_PROJECT);
  assert(samePath(evidence.stateFile, stateFile));
  assert.equal(evidence.releaseTag, BATCH19_RELEASE_TAG);
  assert.equal(evidence.backupSha256, backup.dump.sha256);
  assert(Number.isFinite(Date.parse(evidence.verifiedAt)));
  assert.deepEqual(Object.keys(evidence.migrations || {}).sort(),
    ['content-service','notification-service']);
  for (const service of ['content-service','notification-service']) {
    const migration = BATCH19_MIGRATIONS[service];
    const item = evidence.migrations[service];
    assert.equal(item.schema, migration.schema);
    assert.equal(item.historyTable, migration.historyTable);
    assert.equal(Number(item.version), migration.version);
    assert.equal(item.sourceSha256, batch19MigrationSourceSha256(service));
    assert.equal(item.checksum, item.sourceSha256);
    assert(item.outcome && typeof item.outcome === 'object');
  }
  return evidence;
}

function loadContext(stateFile, requireReceipt = true) {
  assert(stateFile, 'usage: node batch19-private-promotion.mjs <command> <private state.json>');
  const resolved = path.resolve(stateFile);
  const state = readJson(resolved, 'state.json must be a regular private file');
  const paths = pathsFor(state);
  const v17 = readJson(paths.v17, 'IAM V17 receipt must be a regular private file');
  const b18 = readJson(paths.batch18, 'Batch18 receipt must be a regular private file');
  validateContext(state, resolved, paths, v17, b18);
  assertPrivateTempPermissions(state);
  const receipt = fs.existsSync(paths.receipt)
    ? readJson(paths.receipt, 'Batch19 receipt must be a regular private file') : null;
  if (requireReceipt) assert(receipt, 'Batch19 preflight receipt is required');
  if (receipt) validateReceipt(state, paths, v17, b18, receipt);
  return { state, paths, v17, b18, receipt };
}

function stateFingerprint(state, v17, b18) {
  return sha256(JSON.stringify({
    project: state.project, tag: state.tag, batch17ReleaseTag: state.batch17ReleaseTag,
    candidateServices: state.batch17CandidateServices, candidateImageIds: state.batch17CandidateImageIds,
    replacementImages: state.replacementImages, sharedBefore: state.sharedBefore,
    v17: [v17.candidateImage, v17.candidateImageId, v17.iamContainerId, v17.completedAt],
    b18: [b18.phase, b18.releaseTag, b18.images, b18.imageIds, b18.verifiedAt]
  }));
}

function validateReceipt(state, paths, v17, b18, receipt) {
  assert.equal(receipt.project, BATCH19_PROJECT);
  assert(samePath(receipt.stateFile, paths.stateFile));
  assert.equal(receipt.stateFingerprint, stateFingerprint(state, v17, b18));
  assert.equal(receipt.releaseTag, BATCH19_RELEASE_TAG);
  assert.deepEqual(receipt.services, [...BATCH19_SERVICES]);
  assert.deepEqual(receipt.images, batch19CandidateImages());
  assert.equal(fs.readFileSync(paths.migratorOverride, 'utf8'), batch19MigratorOverrideText());
  assert.equal(receipt.migratorImage, BATCH19_MIGRATOR_IMAGE);
  assert.match(receipt.migratorImageId || '', /^sha256:[a-f0-9]{64}$/u);
  assert.deepEqual(Object.keys(receipt.imageIds || {}).sort(), [...BATCH19_SERVICES].sort());
  for (const id of Object.values(receipt.imageIds)) assert.match(id, /^sha256:[a-f0-9]{64}$/u);
  assertBatch17PrivateSnapshot(receipt.beforeSnapshot, BATCH19_PROJECT);
  assert.deepEqual(receipt.beforeSnapshot['official-site'].imageId, b18.imageIds['official-site']);
  assert.deepEqual(receipt.beforeSnapshot['mobile-h5'].imageId, b18.imageIds['mobile-h5']);
  assert.deepEqual(receipt.beforeSnapshot['iam-service'].imageId, v17.candidateImageId);
  assert.deepEqual(receipt.beforeSharedFingerprint, state.sharedBefore);
  assert(phases.includes(receipt.phase));
}

function checkCompose(state, paths, config, images, officialImage) {
  assert.equal(config.name, state.project);
  assert.deepEqual(Object.keys(config.services || {}).sort(), [...BATCH17_PRIVATE_SERVICES].sort());
  assertPrivateComposeIsolation(state, config);
  assert.equal(config.services['official-site']?.image, officialImage);
  for (const service of BATCH19_SERVICES) assert.equal(config.services[service]?.image, images[service]);
}

function quiesce(stateFile) {
  const { state, paths, receipt } = loadContext(stateFile);
  assert(['preflighted','writers-stopping','writers-stopped'].includes(receipt.phase));
  assert.equal(readBackup(state, paths, receipt).dump.sha256, receipt.backupSha256);
  assertBatch19PromotionProgress(snapshot(state), receipt.beforeSnapshot, receipt.imageIds,
    receipt.quiescedServices || [], BATCH19_DRAIN_SERVICES);
  if (receipt.phase !== 'writers-stopped') {
    receipt.phase = 'writers-stopping';
    receipt.updatedAt = new Date().toISOString();
    writeJson(paths.receipt, receipt);
  }
  for (const service of BATCH19_DRAIN_SERVICES) {
    const current = snapshot(state)[service];
    if (current.status === 'running') {
      assert.equal(current.containerId, receipt.beforeSnapshot[service].containerId);
      assert.equal(current.imageId, receipt.beforeSnapshot[service].imageId);
      compose(state, paths, batch19StopArgs(service), { includeB19: false, overlay: null });
    } else {
      assert.equal(current.status, 'exited', service + ' is neither running nor safely resumable');
      assert.equal(current.containerId, receipt.beforeSnapshot[service].containerId);
      assert.equal(current.imageId, receipt.beforeSnapshot[service].imageId);
    }
    const after = snapshot(state)[service];
    assert.equal(after.containerId, receipt.beforeSnapshot[service].containerId);
    assert.equal(after.imageId, receipt.beforeSnapshot[service].imageId);
    assert.equal(after.status, 'exited');
    if (!receipt.quiescedServices.includes(service)) receipt.quiescedServices.push(service);
    receipt.quiescedServices.sort();
    receipt.updatedAt = new Date().toISOString();
    writeJson(paths.receipt, receipt);
  }
  const after = snapshot(state);
  assertBatch19PromotionProgress(after, receipt.beforeSnapshot, receipt.imageIds,
    [...BATCH19_DRAIN_SERVICES]);
  const backup = readBackup(state, paths, receipt);
  compareBackupTargets(backup, batch19TargetRows());
  guardShared(state);
  receipt.phase = 'writers-stopped';
  receipt.writersStoppedSnapshot = after;
  receipt.updatedAt = new Date().toISOString();
  writeJson(paths.receipt, receipt);
  console.log('Gateway and all 13 external owner services are stopped in the private project.');
}

function beginMigrations(stateFile) {
  const { state, paths, receipt } = loadContext(stateFile);
  assert(['writers-stopped','migrations-started'].includes(receipt.phase));
  assert.deepEqual(receipt.quiescedServices, [...BATCH19_DRAIN_SERVICES].sort());
  assert.deepEqual(snapshot(state), receipt.writersStoppedSnapshot,
    'private runtime changed after the complete migrator drain');
  const backup = readBackup(state, paths, receipt);
  assert.equal(backup.dump.sha256, receipt.backupSha256);
  compareBackupTargets(backup, batch19TargetRows());
  assert.equal(fs.readFileSync(paths.migratorOverride, 'utf8'), batch19MigratorOverrideText(),
    'owner migrator override changed after preflight');
  assert.equal(imageId(receipt.migratorImage), receipt.migratorImageId,
    'owner migrator tag changed after preflight');
  if (receipt.phase === 'writers-stopped') {
    for (const service of Object.keys(BATCH19_MIGRATIONS)) {
      assert.equal(migrationRows(service).length, 0,
        service + ' target migration is already recorded; use the existing migration evidence path');
    }
    receipt.phase = 'migrations-started';
    receipt.migrationAttemptedAt = new Date().toISOString();
    receipt.updatedAt = receipt.migrationAttemptedAt;
    writeJson(paths.receipt, receipt);
  }
  guardShared(state);
  console.log('Migration attempt recorded before the external owner migrator is allowed to run.');
}

function recordVerifiedMigrations(stateFile) {
  const { state, paths, receipt } = loadContext(stateFile);
  assert(['migrations-started','migrations-verified'].includes(receipt.phase),
    'record migration attempt, drain all migrator writers, then run migration verification');
  assert.deepEqual(receipt.quiescedServices, [...BATCH19_DRAIN_SERVICES].sort());
  const backup = readBackup(state, paths, receipt);
  assert.equal(backup.dump.sha256, receipt.backupSha256);
  assert.deepEqual(snapshot(state), receipt.writersStoppedSnapshot,
    'private stack changed while applying external migrations');
  const currentEvidence = migrationEvidence(state, paths, backup);
  let evidence = currentEvidence;
  if (fs.existsSync(paths.migration)) {
    const prior = readJson(paths.migration, 'migration receipt must be a regular private file');
    const stable = (item) => {
      const { verifiedAt, ...fields } = item;
      return fields;
    };
    assert.deepEqual(stable(prior), stable(currentEvidence),
      'existing migration verification differs from current DB post-state');
    evidence = prior;
  } else writeJson(paths.migration, evidence);
  receipt.phase = 'migrations-verified';
  receipt.migrationReceiptSha256 = sha256(JSON.stringify(evidence));
  receipt.migrationVerifiedAt = evidence.verifiedAt;
  receipt.updatedAt = new Date().toISOString();
  writeJson(paths.receipt, receipt);
  guardShared(state);
  console.log('V23/V8 database history and post-state were read directly and verified against the full backup.');
}

function restoreMigratorDependencies(stateFile) {
  const { state, paths, receipt } = loadContext(stateFile);
  assert(['migrations-verified','migrator-restoring','migrator-restored'].includes(receipt.phase),
    'verify V23/V8 database post-state before restoring the stopped runtime');
  const backup = readBackup(state, paths, receipt);
  const proof = readMigrationReceipt(paths, backup);
  assert.equal(sha256(JSON.stringify(proof)), receipt.migrationReceiptSha256);
  const restoreServices = BATCH19_DRAIN_SERVICES.filter((service) =>
    !['content-service','notification-service'].includes(service));
  const activeStopped = receipt.quiescedServices || [];
  assertBatch19PromotionProgress(snapshot(state), receipt.beforeSnapshot, receipt.imageIds,
    activeStopped, restoreServices);
  if (receipt.phase !== 'migrator-restored') {
    receipt.phase = 'migrator-restoring';
    receipt.updatedAt = new Date().toISOString();
    writeJson(paths.receipt, receipt);
  }
  for (const service of restoreServices) {
    const original = receipt.beforeSnapshot[service];
    const current = snapshot(state)[service];
    assert.equal(current.containerId, original.containerId, service + ' container changed before restoration');
    assert.equal(current.imageId, original.imageId, service + ' image changed before restoration');
    if (current.status === 'exited') docker(['start', original.containerId], { timeout: 120000 });
    else assert.equal(current.status, 'running', service + ' is not safely resumable');
    const after = snapshot(state)[service];
    assert.equal(after.containerId, original.containerId);
    assert.equal(after.imageId, original.imageId);
    assert.equal(after.status, 'running');
    if (receipt.quiescedServices.includes(service)) {
      receipt.quiescedServices = receipt.quiescedServices.filter((item) => item !== service);
    }
    if (!receipt.restoredMigratorServices.includes(service)) receipt.restoredMigratorServices.push(service);
    receipt.restoredMigratorServices.sort();
    receipt.updatedAt = new Date().toISOString();
    writeJson(paths.receipt, receipt);
    assertBatch19PromotionProgress(snapshot(state), receipt.beforeSnapshot, receipt.imageIds,
      receipt.quiescedServices, restoreServices);
    guardShared(state);
  }
  for (const service of [...restoreServices].sort((a, b) =>
    a === 'api-gateway' ? 1 : b === 'api-gateway' ? -1 : a.localeCompare(b))) {
    probeOne(state, receipt, service);
  }
  assert.deepEqual(receipt.quiescedServices, ['content-service','notification-service']);
  receipt.phase = 'migrator-restored';
  receipt.migratorRestoredSnapshot = snapshot(state);
  receipt.updatedAt = new Date().toISOString();
  writeJson(paths.receipt, receipt);
  guardShared(state);
  console.log('Eleven non-candidate owners and Gateway are restored and readiness-checked; content and notification remain stopped for replacement.');
}

function readMigrationReceipt(paths, backup) {
  const evidence = readJson(paths.migration, 'V23/V8 migration verification receipt is missing');
  assertBatch19MigrationReceipt(evidence, backup, paths.stateFile);
  return evidence;
}

function probeOne(state, receipt, service) {
  const target = batch19ReadinessTargets().find((item) => item[0] === service);
  assert(target, 'no readiness endpoint registered for ' + service);
  assert.equal(imageId(receipt.officialSite.image), receipt.officialSite.imageId,
    'readiness probe image differs from the verified Batch18 official-site image');
  const probe = 'const retry=' + retryReadinessProbe.toString() + ';retry(' +
    JSON.stringify('http://' + target[0] + ':' + target[1] + target[2]) + ',{' +
    'timeoutMs:' + BATCH19_READINESS_TIMEOUT_MS + ',intervalMs:' + BATCH19_READINESS_INTERVAL_MS +
    ',requestTimeoutMs:5000}).then(result=>console.log(JSON.stringify(result)))' +
    '.catch(error=>{console.error(error.message);process.exit(1);});';
  docker(['run','--pull=never','--rm','--network',state.project,'--label',
    'com.cloudstudy.uat.project=' + state.project,'--entrypoint','node',
    receipt.officialSite.image,'--input-type=module','-e',probe], { timeout: 110000 });
}

function promote(stateFile) {
  const { state, paths, receipt } = loadContext(stateFile);
  assert(['migrator-restored','promoting','promoted','verified'].includes(receipt.phase),
    'verified migrations and restored non-candidate owners/Gateway are required before promotion');
  const backup = readBackup(state, paths, receipt);
  const migrationProof = readMigrationReceipt(paths, backup);
  assert.equal(sha256(JSON.stringify(migrationProof)), receipt.migrationReceiptSha256,
    'migration verification receipt changed after verification');
  const current = assertBatch19PromotionProgress(snapshot(state), receipt.beforeSnapshot,
    receipt.imageIds, receipt.quiescedServices);
  const config = JSON.parse(compose(state, paths, ['config','--format','json'], { output: true }));
  checkCompose(state, paths, config, receipt.images, receipt.officialSite.image);
  if (receipt.phase === 'verified') return;
  if (receipt.phase !== 'promoting') {
    receipt.phase = 'promoting';
    receipt.updatedAt = new Date().toISOString();
    writeJson(paths.receipt, receipt);
  }
  for (const service of BATCH19_ORDER) {
    let latest = assertBatch19PromotionProgress(snapshot(state), receipt.beforeSnapshot,
      receipt.imageIds, receipt.quiescedServices);
    if (latest[service].imageId !== receipt.imageIds[service]) {
      if (service === 'content-service') {
        verifyMigrationHistory(service, migrationProof.migrations[service].sourceSha256);
        contentPostState(backup);
      }
      if (service === 'notification-service') {
        verifyMigrationHistory(service, migrationProof.migrations[service].sourceSha256);
        notificationPostState(backup);
      }
      assert.equal(imageId(receipt.images[service]), receipt.imageIds[service],
        service + ' candidate tag changed after preflight');
      compose(state, paths, batch19ComposeArgs(service), { timeout: 600000 });
      latest = assertBatch19PromotionProgress(snapshot(state), receipt.beforeSnapshot,
        receipt.imageIds, receipt.quiescedServices.filter((item) => item !== service));
      assert.equal(latest[service].status, 'running');
      if (service === 'iam-service') verifyMigrationHistory(service);
      probeOne(state, receipt, service);
    }
    if (service === 'iam-service') verifyMigrationHistory(service);
    if (service === 'content-service') contentPostState(backup);
    if (service === 'notification-service') notificationPostState(backup);
    if (!receipt.promotedServices.includes(service)) receipt.promotedServices.push(service);
    receipt.promotedServices.sort();
    receipt.lastVerifiedService = service;
    receipt.lastVerifiedSnapshot = snapshot(state);
    receipt.updatedAt = new Date().toISOString();
    writeJson(paths.receipt, receipt);
  }
  const after = assertBatch19PromotionProgress(snapshot(state), receipt.beforeSnapshot, receipt.imageIds);
  guardShared(state);
  receipt.quiescedServices = [];
  receipt.phase = 'promoted';
  receipt.promotedSnapshot = after;
  receipt.updatedAt = new Date().toISOString();
  writeJson(paths.receipt, receipt);
  console.log('Five exact Batch19 images are running; refresh the private proxy and run readiness/browser checks.');
}

function rollback(stateFile) {
  const { state, paths, receipt } = loadContext(stateFile);
  assert(['preflighted','writers-stopping','writers-stopped','rollback-started','rolled-back'].includes(receipt.phase),
    'rollback is allowed only before irreversible database migrations');
  const migrationRows = Object.fromEntries(Object.keys(BATCH19_MIGRATIONS).map((service) => {
    return [service, migrationRowsForRollback(service)];
  }));
  assertBatch19RollbackGate({ migrationReceiptExists: fs.existsSync(paths.migration),
    migrationAttempted: Boolean(receipt.migrationAttemptedAt), migrationRows });
  if (receipt.phase === 'rolled-back') return;
  receipt.phase = 'rollback-started';
  writeJson(paths.receipt, receipt);
  const restoreServices = [...BATCH19_DRAIN_SERVICES];
  for (const service of restoreServices) {
    const original = receipt.beforeSnapshot[service];
    const current = snapshot(state)[service];
    assert.equal(current.containerId, original.containerId);
    assert.equal(current.imageId, original.imageId);
    if (current.status === 'exited') {
      docker(['start', original.containerId], { timeout: 120000 });
    } else assert.equal(current.status, 'running', service + ' is not safely resumable');
    const after = snapshot(state)[service];
    assert.equal(after.containerId, original.containerId);
    assert.equal(after.imageId, original.imageId);
    assert.equal(after.status, 'running');
    receipt.quiescedServices = (receipt.quiescedServices || []).filter((item) => item !== service);
    if (!receipt.restoredMigratorServices.includes(service)) receipt.restoredMigratorServices.push(service);
    receipt.restoredMigratorServices.sort();
    receipt.updatedAt = new Date().toISOString();
    writeJson(paths.receipt, receipt);
    assertBatch19PromotionProgress(snapshot(state), receipt.beforeSnapshot, receipt.imageIds,
      receipt.quiescedServices, restoreServices);
    guardShared(state);
  }
  for (const service of [...restoreServices].sort((a, b) =>
    a === 'api-gateway' ? 1 : b === 'api-gateway' ? -1 : a.localeCompare(b))) probeOne(state, receipt, service);
  assert.deepEqual(receipt.quiescedServices, []);
  guardShared(state);
  receipt.phase = 'rolled-back';
  receipt.rolledBackAt = new Date().toISOString();
  receipt.updatedAt = receipt.rolledBackAt;
  writeJson(paths.receipt, receipt);
  console.log('Pre-migration rollback restored exact original containers for all drained private owners and Gateway.');
}

function migrationRowsForRollback(service) {
  const rows = migrationRows(service);
  return rows.map((row) => ({ version: row[0], success: service === 'iam-service' ? row[3] === '1' : true }));
}

function privateProxy(state) { return proxySnapshot(state); }

function refreshProxy(stateFile) {
  const { state, paths, receipt } = loadContext(stateFile);
  assert(['promoted','verified','rolled-back'].includes(receipt.phase));
  const before = privateProxy(state);
  assert.deepEqual(before, receipt.beforeProxy);
  guardShared(state);
  docker(['restart', before.name], { timeout: 120000 });
  const after = privateProxy(state);
  assert.equal(after.containerId, before.containerId);
  assert.equal(after.imageId, before.imageId);
  receipt.proxyRefreshedForPhase = receipt.phase;
  receipt.proxyRefreshedAt = new Date().toISOString();
  receipt.updatedAt = receipt.proxyRefreshedAt;
  writeJson(paths.receipt, receipt);
  guardShared(state);
}

function runReadiness(state, receipt) {
  const targets = batch19ReadinessTargets();
  const code = 'const t=' + JSON.stringify(targets) +
    ';let bad=false;for(const [name,port,route] of t){let status=0;try{status=(await fetch("http://"+name+":"+port+route,{signal:AbortSignal.timeout(5000)})).status;}catch{}' +
    'if(status!==200)bad=true;console.log(JSON.stringify({name,status}));}if(bad)process.exit(1);';
  assert.equal(imageId(receipt.officialSite.image), receipt.officialSite.imageId);
  const out = docker(['run','--pull=never','--rm','--network',state.project,'--label',
    'com.cloudstudy.uat.project=' + state.project,'--entrypoint','node',
    receipt.officialSite.image,'--input-type=module','-e',code], { output: true, timeout: 180000 });
  const results = out.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(results.length, targets.length);
  assert(results.every((item) => item.status === 200));
  return results;
}

function readiness(stateFile) {
  const { state, paths, receipt } = loadContext(stateFile);
  assert(['promoted','verified','rolled-back'].includes(receipt.phase));
  assert.equal(receipt.proxyRefreshedForPhase, receipt.phase);
  const before = snapshot(state);
  assertBatch19PrivateReadinessSnapshot(before, receipt);
  const results = runReadiness(state, receipt);
  assert.deepEqual(snapshot(state), before);
  guardShared(state);
  console.log(JSON.stringify({ project: state.project, phase: receipt.phase,
    checked: results.length, passed: results.length, results }));
}

export function assertBatch19PrivateReadinessSnapshot(current, receipt) {
  if (receipt.phase === 'rolled-back') {
    assertBatch17PrivateSnapshot(current, BATCH19_PROJECT);
  } else {
    assertBatch19PromotionProgress(current, receipt.beforeSnapshot, receipt.imageIds);
  }
  for (const service of BATCH19_SERVICES) assert.equal(current[service].status, 'running');
  return current;
}

function verify(stateFile) {
  const { state, paths, receipt } = loadContext(stateFile);
  assert(['promoted','verified'].includes(receipt.phase));
  assert(receipt.proxyRefreshedForPhase === 'promoted'
    || (receipt.phase === 'verified' && receipt.proxyRefreshedForPhase === 'verified'));
  const backup = readBackup(state, paths, receipt);
  const proof = readJson(paths.migration, 'migration evidence is missing');
  assertBatch19MigrationReceipt(proof, backup, paths.stateFile);
  assert.equal(sha256(JSON.stringify(proof)), receipt.migrationReceiptSha256);
  const beforeReadiness = snapshot(state);
  const current = assertBatch19PromotionProgress(beforeReadiness, receipt.beforeSnapshot, receipt.imageIds);
  for (const service of BATCH19_SERVICES) {
    assert.equal(current[service].imageId, receipt.imageIds[service]);
    assert.notEqual(current[service].containerId, receipt.beforeSnapshot[service].containerId);
    assert.equal(current[service].status, 'running');
  }
  verifyMigrationHistory('iam-service');
  verifyMigrationHistory('content-service');
  verifyMigrationHistory('notification-service');
  contentPostState(backup);
  notificationPostState(backup);
  if ((receipt.quiescedServices || []).length > 0) receipt.quiescedServices = [];
  const readinessResults = runReadiness(state, receipt);
  assert.deepEqual(snapshot(state), beforeReadiness,
    'readiness probes changed private container state');
  guardShared(state);
  receipt.phase = 'verified';
  receipt.verifiedSnapshot = current;
  receipt.readinessResults = readinessResults;
  receipt.readinessPassed = readinessResults.length;
  receipt.readinessVerifiedAt = new Date().toISOString();
  receipt.verifiedAt = new Date().toISOString();
  receipt.updatedAt = receipt.verifiedAt;
  writeJson(paths.receipt, receipt);
}

function status(stateFile) {
  const { state, receipt } = loadContext(stateFile, false);
  console.log(JSON.stringify({
    project: state.project, phase: receipt?.phase || 'not-started',
    releaseTag: BATCH19_RELEASE_TAG, services: [...BATCH19_SERVICES],
    promotedServices: receipt?.promotedServices || [],
    quiescedServices: receipt?.quiescedServices || [],
    proxyRefreshedForPhase: receipt?.proxyRefreshedForPhase || null,
    verified: receipt?.phase === 'verified', rolledBack: receipt?.phase === 'rolled-back'
  }));
}

export function assertBatch19DryRunSnapshot(current, { receipt = null, b18, v17 }) {
  if (receipt) {
    assertBatch19PromotionProgress(current, receipt.beforeSnapshot, receipt.imageIds,
      receipt.quiescedServices || []);
    if (['promoted', 'verified'].includes(receipt.phase)) {
      for (const service of BATCH19_SERVICES) {
        assert.equal(current[service].imageId, receipt.imageIds[service],
          `dry-run ${receipt.phase}: ${service} must use its exact recorded Batch19 image ID`);
        assert.notEqual(current[service].containerId, receipt.beforeSnapshot[service].containerId,
          `dry-run ${receipt.phase}: ${service} must run in a replacement container`);
        assert.equal(current[service].status, 'running',
          `dry-run ${receipt.phase}: ${service} candidate container must be running`);
        if (receipt.phase === 'verified') {
          const verified = receipt.verifiedSnapshot?.[service];
          assert(verified, `dry-run verified: ${service} container snapshot is missing from receipt`);
          assert.equal(current[service].containerId, verified.containerId,
            `dry-run verified: ${service} container ID differs from its verified receipt`);
          assert.equal(current[service].imageId, verified.imageId,
            `dry-run verified: ${service} image ID differs from its verified receipt`);
          assert.equal(current[service].status, verified.status,
            `dry-run verified: ${service} status differs from its verified receipt`);
        }
      }
    }
  }

  assert.equal(current['official-site'].imageId, b18.imageIds['official-site'],
    'dry-run: official-site must remain on its exact verified Batch18 image ID');
  const mobileIsRecordedCandidate = receipt
    && current['mobile-h5'].imageId === receipt.imageIds['mobile-h5'];
  const expectedMobileImageId = mobileIsRecordedCandidate
    ? receipt.imageIds['mobile-h5'] : b18.imageIds['mobile-h5'];
  assert.equal(current['mobile-h5'].imageId, expectedMobileImageId,
    mobileIsRecordedCandidate
      ? 'dry-run: mobile-h5 must use its exact recorded Batch19 image ID'
      : 'dry-run: mobile-h5 must retain its exact Batch18 image ID until replacement');
  const iamExpected = receipt
    && current['iam-service'].imageId === receipt.imageIds['iam-service']
    ? receipt.imageIds['iam-service'] : v17.candidateImageId;
  assert.equal(current['iam-service'].imageId, iamExpected,
    'dry-run: iam-service must use its exact recorded Batch19 image ID or preserved IAM V17 image ID');
  return current;
}

function dryRun(stateFile) {
  const { state, paths, v17, b18, receipt } = loadContext(stateFile, false);
  assert.equal(fs.readFileSync(paths.batch18Override, 'utf8'),
    batch18OverrideText({ images: b18.images }), 'Batch18 overlay differs from verified receipt');
  const images = batch19CandidateImages();
  const officialImage = b18.images['official-site'];
  const overlay = batch19OverrideText({ images, officialImage });
  const args = composeArgs(state, paths, [], {
    includeB19: false, overlay: null
  }).concat(['-f','-','config','--format','json']);
  const config = JSON.parse(docker(args, { output: true, input: overlay }));
  checkCompose(state, paths, config, images, officialImage);
  const baseline = readBaselineConfig(state, paths, b18);
  const current = snapshot(state);
  if (!receipt) for (const service of BATCH19_SERVICES) {
    assert.equal(current[service].imageId, imageId(baseline.services[service].image));
    assert.notEqual(imageId(images[service]), current[service].imageId);
  }
  assertBatch19DryRunSnapshot(current, { receipt, b18, v17 });
  guardShared(state);
  console.log(JSON.stringify({ project: state.project, releaseTag: BATCH19_RELEASE_TAG,
    services: BATCH19_SERVICES, phase: receipt?.phase || 'not-started' }));
}

function preflight(stateFile) {
  const { state, paths, v17, b18, receipt } = loadContext(stateFile, false);
  assert(!receipt, 'preflight receipt already exists; resume its phase');
  const backup = readBackup(state, paths);
  const images = batch19CandidateImages();
  const officialImage = b18.images['official-site'];
  const baseline = readBaselineConfig(state, paths, b18);
  ensureOverride(paths.migratorOverride, batch19MigratorOverrideText(), 'Batch19 migrator override');
  const migratorImageId = imageId(BATCH19_MIGRATOR_IMAGE);
  ensureOverride(paths.override, batch19OverrideText({ images, officialImage }), 'Batch19 override');
  const beforeImages = Object.fromEntries(BATCH19_SERVICES.map((service) => {
    const baselineImage = baseline.services[service]?.image;
    assert(baselineImage, service + ' B18/V17 baseline image tag is missing');
    return [service, baselineImage];
  }));
  ensureOverride(paths.rollbackOverride,
    batch19RollbackOverrideText({ beforeImages, officialImage }), 'Batch19 rollback override');
  const targetConfig = JSON.parse(compose(state, paths, ['config','--format','json'], { output: true }));
  checkCompose(state, paths, targetConfig, images, officialImage);
  const before = snapshot(state);
  assert.equal(before['iam-service'].imageId, v17.candidateImageId);
  assert.equal(before['official-site'].imageId, b18.imageIds['official-site']);
  assert.equal(before['mobile-h5'].imageId, b18.imageIds['mobile-h5']);
  const imageIds = Object.fromEntries(BATCH19_SERVICES.map((service) => [service,imageId(images[service])]));
  for (const service of BATCH19_SERVICES) {
    assert.equal(before[service].imageId, imageId(baseline.services[service].image));
    assert.notEqual(imageIds[service], before[service].imageId);
  }
  for (const service of BATCH19_DRAIN_SERVICES) {
    assert.equal(before[service].status, 'running', service + ' must be running before migrator drain');
  }
  const observed = batch19TargetRows();
  compareBackupTargets(backup, observed);
  const proxy = proxySnapshot(state);
  guardShared(state);
  const now = new Date().toISOString();
  writeJson(paths.receipt, {
    format: 1, project: state.project, stateFile: paths.stateFile,
    phase: 'preflighted', createdAt: now, updatedAt: now,
    releaseTag: BATCH19_RELEASE_TAG, services: [...BATCH19_SERVICES], images, imageIds,
    migratorImage: BATCH19_MIGRATOR_IMAGE, migratorImageId,
    beforeImages, beforeSnapshot: structuredClone(before), beforeProxy: proxy,
    officialSite: { image: officialImage, imageId: b18.imageIds['official-site'] },
    beforeSharedFingerprint: structuredClone(state.sharedBefore),
    stateFingerprint: stateFingerprint(state, v17, b18),
    backupSha256: backup.dump.sha256, backupReceiptSha256: sha256(JSON.stringify(backup)),
    preMigrationTargets: observed,
    migrationSourceSha256: Object.fromEntries(Object.keys(BATCH19_MIGRATIONS)
      .map((service) => [service,batch19MigrationSourceSha256(service)])),
    quiescedServices: [], drainedServices: [...BATCH19_DRAIN_SERVICES],
    restoredMigratorServices: [], promotedServices: []
  });
  console.log('Batch19 preflight passed: all owner schemas backed up, target identities matched, and exact images recorded.');
}

function main() {
  const command = process.argv[2];
  const stateFile = process.argv[3];
  const handlers = { 'dry-run': dryRun, preflight, quiesce,
    'begin-migrations': beginMigrations,
    'record-verified-migrations': recordVerifiedMigrations,
    'restore-migrator-dependencies': restoreMigratorDependencies,
    promote, 'refresh-proxy': refreshProxy, readiness, verify, rollback, status };
  assert(handlers[command], 'unknown Batch19 private promotion command');
  handlers[command](stateFile);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) {
    const detail = process.env.CLOUDSTUDY_UAT_DIAGNOSTIC === '1' && error?.name === 'AssertionError'
      ? ' ' + String(error.message || '').split('\n',1)[0].slice(0,180) : '';
    console.error('Batch19 private promotion failed closed; private outputs were suppressed.' + detail);
    process.exitCode = 1;
  }
}
