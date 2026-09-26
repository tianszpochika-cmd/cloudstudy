#!/usr/bin/env node
// Private, resumable IAM V17 promotion for the frozen Batch17 isolated stack.
// This lane deliberately does not modify the shared Compose helper or Batch16 state.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const projectName = 'cloudstudy-uat-isolated-3c94b27160';
const releaseTag = '583ab627-uat-batch17-202609250206';
const candidateImage = `cloudstudy-clyunedev/iam-service:${releaseTag}`;
const promotionReceiptName = 'iam-v17-private-promotion.json';
const promotionBackupName = 'iam-v17-before-migration.sql';
const promotionOverrideName = 'docker-compose.iam-v17-promotion.yml';
const batch16BackupName = 'batch16-before-owner-migration.sql';
const ownerServices = Object.freeze([
  'iam-service', 'audit-service', 'workflow-service', 'learner-service',
  'content-service', 'learning-service', 'assessment-service', 'media-service',
  'notification-service', 'gamification-service', 'social-service', 'commerce-service',
  'admin-ops-service', 'analytics-service'
]);
const drainServices = Object.freeze([...ownerServices, 'api-gateway']);
const targetServices = Object.freeze([
  'mysql', 'redis', 'minio', 'kafka', 'mysql-init', 'minio-init', 'mysql-migrate',
  'iam-service', 'api-gateway', 'official-site', 'learner-web', 'admin-web', 'mobile-h5',
  'audit-service', 'workflow-service', 'learner-service', 'content-service', 'learning-service',
  'assessment-service', 'media-service', 'notification-service', 'gamification-service',
  'social-service', 'commerce-service', 'admin-ops-service', 'analytics-service'
]);
export const learnerScopes = Object.freeze([
  'gamification.read.self',
  'gamification.ledger.read.self',
  'gamification.reward.read.self',
  'gamification.reward.claim.self',
  'social.room.write.self',
  'social.focus.write.self',
  'social.interaction.write.self',
  'social.leaderboard.read',
  'social.visibility.write.self',
  'social.report.create.self',
  'social.report.read.self',
  'gamification.game.read.self',
  'gamification.game.play.self',
  'social.room.read'
]);
const learnerScopeSet = new Set(learnerScopes);
const forbiddenTrustedEventScopes = Object.freeze([
  'gamification.trusted-event.write', 'social.trusted-event.write'
]);
export const activeReadinessTargets = Object.freeze([
  ['official-site', 18182, '/'], ['learner-web', 8080, '/'], ['admin-web', 8080, '/'], ['mobile-h5', 8080, '/'],
  ['api-gateway', 18070, '/actuator/health/readiness'], ['iam-service', 18087, '/actuator/health/readiness'],
  ['audit-service', 18099, '/actuator/health/readiness'], ['workflow-service', 18071, '/actuator/health/readiness'],
  ['learner-service', 18088, '/actuator/health/readiness'], ['content-service', 18089, '/actuator/health/readiness'],
  ['learning-service', 18090, '/actuator/health/readiness'], ['assessment-service', 18091, '/actuator/health/readiness'],
  ['media-service', 18092, '/actuator/health/readiness'], ['notification-service', 18093, '/actuator/health/readiness'],
  ['gamification-service', 18094, '/actuator/health/readiness'], ['social-service', 18095, '/actuator/health/readiness'],
  ['commerce-service', 18096, '/actuator/health/readiness'], ['admin-ops-service', 18097, '/actuator/health/readiness'],
  ['analytics-service', 18098, '/actuator/health/readiness']
]);
export const iamReadinessTargets = Object.freeze([
  ['iam-service', 18087, '/actuator/health/readiness']
]);
const phaseOrder = Object.freeze([
  'preflighted', 'writers-stopped', 'backup-started', 'backup-verified',
  'promotion-started', 'iam-promoted', 'verified', 'restore-started', 'complete'
]);
const command = process.argv[2];
const stateFileArg = process.argv[3];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function jsonHash(value) {
  return sha256(JSON.stringify(value));
}

function hashFile(file) {
  const fd = fs.openSync(file, 'r');
  const digest = crypto.createHash('sha256');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead > 0) digest.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(fd);
  }
  return digest.digest('hex');
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function normalizeCsv(value) {
  return sortedUnique(String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean));
}

function privatePaths(state) {
  const tempDir = path.resolve(state.tempDir);
  return {
    tempDir,
    stateFile: path.join(tempDir, 'state.json'),
    envFile: path.join(tempDir, 'uat.env'),
    keyFile: path.join(tempDir, 'iam-rsa-private.pem'),
    overrideFile: path.join(tempDir, 'docker-compose.isolated.yml'),
    batch16Backup: path.join(tempDir, batch16BackupName),
    receipt: path.join(tempDir, promotionReceiptName),
    backup: path.join(tempDir, promotionBackupName),
    promotionOverride: path.join(tempDir, promotionOverrideName)
  };
}

function assertPrivateStateShape(state, stateFile) {
  assert.equal(state.project, projectName, 'only the approved private Batch17 project is allowed');
  const paths = privatePaths(state);
  const relative = path.relative(path.resolve(os.tmpdir()), paths.tempDir);
  assert(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative),
    'private state must remain under the operating-system temp directory');
  assert(path.basename(paths.tempDir).startsWith(`${projectName}-`), 'private temp directory does not match the project');
  assert.equal(path.resolve(stateFile), paths.stateFile, 'state.json must be inside its private project directory');
  const directoryInfo = fs.lstatSync(paths.tempDir);
  assert(directoryInfo.isDirectory() && !directoryInfo.isSymbolicLink(), 'private temp directory must be a real directory');
  for (const [name, target] of Object.entries({
    stateFile: paths.stateFile, envFile: paths.envFile, keyFile: paths.keyFile, overrideFile: paths.overrideFile
  })) {
    assert.equal(path.resolve(state[name]), target, `${name} escaped the private project directory`);
    const info = fs.lstatSync(target);
    assert(info.isFile() && !info.isSymbolicLink(), `${name} must be a regular private file`);
  }
  assert.equal(state.tag, '583ab627-uat-batch9-202609231740', 'unexpected private base image tag');
  assert(state.batch16Migration?.backup, 'completed Batch16 migration receipt is missing');
  assert.equal(path.resolve(state.batch16Migration.backup.path), paths.batch16Backup,
    'the frozen Batch16 backup path changed');
  assert.equal(state.batch16Migration.writersRestored, true, 'Batch16 writer restore is not complete');
  assert.equal(state.batch16Migration.preflightPassed, true);
  assert.equal(state.batch16Migration.applyPassed, true);
  assert.equal(state.batch16Migration.verifyPassed, true);
  assert.equal(state.batch17ReleaseTag, releaseTag, 'private Batch17 release tag differs from this promotion');
  assert.deepEqual(state.batch17CandidateServices, ['official-site', 'content-service', 'learner-web', 'mobile-h5'],
    'Batch17 candidate service set changed');
  assert.equal(state.batch17ContentV22Evidence?.version, 22, 'applied Content V22 receipt is missing');
  assert.equal(state.batch17ContentV22Evidence?.flywayEnabled, 'false', 'Content Flyway must remain disabled at runtime');
  const expectedV22Checksum = contentV22Checksum();
  assert.equal(state.batch17ContentV22Evidence.checksum, expectedV22Checksum,
    'the Batch17 Content V22 receipt differs from the current repository migration');
  const batch16Fingerprint = jsonHash(state.batch16Migration);
  assert.equal(state.batch17Batch16MigrationSha256, batch16Fingerprint,
    'the Batch16 migration state changed after the Batch17 release');
  for (const key of ['sharedBefore', 'replacementImages', 'batch17CandidateImages', 'batch17CandidateImageIds']) {
    assert(state[key] && typeof state[key] === 'object', `${key} is missing from private Batch17 state`);
  }
  assert.equal(state.replacementImages['iam-service'], 'cloudstudy-clyunedev/iam-service:583ab627-uat-batch10-202609231841',
    'the active IAM image differs from the known pre-V17 image');
  assert.equal(state.replacementImages['content-service'],
    `cloudstudy-clyunedev/content-service:${releaseTag}`, 'Content V22 candidate is not the active Batch17 image');
  assert(fs.existsSync(paths.batch16Backup), 'Batch16 backup is missing; refusing to reuse its migration lane');
  const backupInfo = fs.lstatSync(paths.batch16Backup);
  assert(backupInfo.isFile() && !backupInfo.isSymbolicLink(), 'Batch16 backup must be a regular file');
  assert.equal(backupInfo.size, state.batch16Migration.backup.bytes,
    'Batch16 backup size changed; refusing to use the private stack');
  assert.equal(hashFile(paths.batch16Backup), state.batch16Migration.backup.sha256,
    'Batch16 backup checksum changed; refusing to use the private stack');
  return { ...paths, batch16Fingerprint, expectedV22Checksum };
}

export function assertPreMigrationHistory(rows) {
  assert(Array.isArray(rows), 'IAM Flyway history is unavailable');
  const v16 = rows.filter((row) => String(row.version) === '16');
  const v17 = rows.filter((row) => String(row.version) === '17');
  assert.equal(v16.length, 1, 'exactly one IAM V16 history row is required');
  assert.equal(v17.length, 0, 'IAM V17 is already recorded; refusing a second promotion');
  assert.equal(String(v16[0].success), '1', 'IAM V16 must be successful');
  assert(rows.every((row) => String(row.success) === '1'), 'IAM Flyway history contains a failed migration');
  assert(rows.length > 0 && String(rows.at(-1).version) === '16', 'IAM V16 must be the latest applied migration');
  return { currentVersion: 16, pendingVersion: 17 };
}

export function assertPostMigrationHistory(rows) {
  assert(Array.isArray(rows), 'IAM Flyway history is unavailable');
  const v16 = rows.filter((row) => String(row.version) === '16');
  const v17 = rows.filter((row) => String(row.version) === '17');
  assert.equal(v16.length, 1, 'IAM V16 history row changed during promotion');
  assert.equal(v17.length, 1, 'exactly one IAM V17 history row is required');
  assert.equal(String(v17[0].description), 'grant canonical b12 learner permissions');
  assert.equal(String(v17[0].script), 'V17__grant_canonical_b12_learner_permissions.sql');
  assert.equal(String(v17[0].success), '1', 'IAM V17 did not complete successfully');
  assert.equal(String(v16[0].success), '1', 'IAM V16 is no longer successful');
  assert(rows.every((row) => String(row.success) === '1'), 'IAM Flyway history contains a failed migration');
  assert(rows.length > 0 && String(rows.at(-1).version) === '17', 'IAM V17 must be the latest applied migration');
  return { currentVersion: 17, successful: true };
}

export function accountPermissionEvidence(rows) {
  assert(Array.isArray(rows), 'IAM account permission snapshot is unavailable');
  const accountIds = new Set();
  const normalized = rows.map((row) => {
    assert(Array.isArray(row) && row.length === 4, 'IAM account snapshot row is malformed');
    const [principalId, statusValue, rolesValue, permissionsValue] = row;
    const id = String(principalId ?? '');
    assert(id, 'IAM account row has no principal identifier');
    const idHash = sha256(id);
    assert(!accountIds.has(idHash), 'IAM account principal identifiers are not unique');
    accountIds.add(idHash);
    const status = String(statusValue ?? '');
    const roles = String(rolesValue ?? '');
    const roleSet = new Set(normalizeCsv(roles));
    const permissions = normalizeCsv(permissionsValue);
    const eligibleLearner = status === 'ACTIVE' && roleSet.has('learner');
    const unaffectedPermissions = permissions.filter((permission) => !learnerScopeSet.has(permission));
    return { idHash, status, roles, permissions, eligibleLearner, unaffectedPermissions };
  }).sort((left, right) => left.idHash.localeCompare(right.idHash));
  const activeLearners = normalized.filter((account) => account.eligibleLearner);
  const ineligible = normalized.filter((account) => !account.eligibleLearner);
  return {
    accountCount: normalized.length,
    activeLearnerCount: activeLearners.length,
    // Removing only the 14 approved keys proves that every other account fact and permission stays fixed.
    unaffectedAccountStateSha256: jsonHash(normalized.map(({ idHash, status, roles, unaffectedPermissions }) =>
      [idHash, status, roles, unaffectedPermissions])),
    ineligiblePermissionsSha256: jsonHash(ineligible.map(({ idHash, status, roles, permissions }) =>
      [idHash, status, roles, permissions])),
    missingActiveLearnerScopes: activeLearners.reduce((count, account) =>
      count + learnerScopes.filter((scope) => !account.permissions.includes(scope)).length, 0)
  };
}

function encodeRoleBinding(row) {
  assert(Array.isArray(row) && row.length === 3, 'IAM role permission row is malformed');
  return JSON.stringify([String(row[0]), String(row[1]), row[2] == null ? null : String(row[2])]);
}

export function assertPostPermissionEvidence({
  beforeCatalogKeys, afterCatalogRows, beforeRoleBindings, afterRoleBindings,
  roleRows, beforeAccountEvidence, afterAccountRows
}) {
  const beforeCatalog = new Set(beforeCatalogKeys);
  const afterCatalog = new Set(afterCatalogRows.map((row) => String(row[0])));
  assert.equal(afterCatalogRows.length, afterCatalog.size, 'IAM permission catalog contains duplicate keys');
  for (const key of beforeCatalog) assert(afterCatalog.has(key), 'IAM permission catalog lost an existing key');
  const addedCatalogKeys = [...afterCatalog].filter((key) => !beforeCatalog.has(key)).sort();
  assert(addedCatalogKeys.every((key) => learnerScopeSet.has(key)),
    'migration added a non-learner, trusted-event, admin, or moderation catalog permission');
  const activeCatalogKeys = new Set(afterCatalogRows
    .filter((row) => String(row[1]) === 'ACTIVE')
    .map((row) => String(row[0])));
  assert.deepEqual(learnerScopes.filter((key) => activeCatalogKeys.has(key)).sort(), [...learnerScopes].sort(),
    'the exact 14 canonical learner scopes are not active in the catalog');
  assert(forbiddenTrustedEventScopes.every((key) => !addedCatalogKeys.includes(key)),
    'trusted-event permissions must not be added by this migration');
  assert(roleRows.length === 1 && String(roleRows[0][0]) === 'learner'
    && String(roleRows[0][1]) === 'ACTIVE', 'active learner role is required');

  const beforeBindings = new Set(beforeRoleBindings.map(encodeRoleBinding));
  const afterBindings = new Set(afterRoleBindings.map(encodeRoleBinding));
  for (const row of beforeBindings) assert(afterBindings.has(row), 'migration removed or revoked an existing role binding');
  const addedBindings = [...afterBindings].filter((row) => !beforeBindings.has(row)).map((row) => JSON.parse(row));
  assert(addedBindings.every(([role, key, revokedAt]) => role === 'role-learner'
    && learnerScopeSet.has(key) && revokedAt === null),
  'migration added an admin, moderation, trusted-event, or non-learner role binding');
  const activeLearnerBindings = new Set(afterRoleBindings
    .filter((row) => String(row[0]) === 'role-learner' && row[2] == null)
    .map((row) => String(row[1])));
  assert.deepEqual([...activeLearnerBindings].filter((key) => learnerScopeSet.has(key)).sort(),
    [...learnerScopes].sort(), 'role-learner must have exactly the 14 canonical B12 bindings active');

  const afterAccountEvidence = accountPermissionEvidence(afterAccountRows);
  assert.equal(afterAccountEvidence.accountCount, beforeAccountEvidence.accountCount,
    'account rows changed during the isolated migration');
  assert.equal(afterAccountEvidence.activeLearnerCount, beforeAccountEvidence.activeLearnerCount,
    'active learner eligibility changed during the isolated migration');
  assert.equal(afterAccountEvidence.unaffectedAccountStateSha256,
    beforeAccountEvidence.unaffectedAccountStateSha256,
    'a non-canonical account fact or coarse permission changed');
  assert.equal(afterAccountEvidence.ineligiblePermissionsSha256,
    beforeAccountEvidence.ineligiblePermissionsSha256,
    'an inactive or non-learner account permission changed');
  assert.equal(afterAccountEvidence.missingActiveLearnerScopes, 0,
    'an active learner account is missing one or more canonical B12 scopes');
  return {
    catalogKeysAdded: addedCatalogKeys,
    learnerRoleBindingsAdded: addedBindings.length,
    activeLearnerCount: afterAccountEvidence.activeLearnerCount,
    activeLearnerScopesMissing: afterAccountEvidence.missingActiveLearnerScopes,
    excludedTrustedEventScopes: [...forbiddenTrustedEventScopes]
  };
}

export function promotionComposeArgs() {
  return ['up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--force-recreate', 'iam-service'];
}

export function parseMysqlJsonRows(output) {
  if (!String(output).trim()) return [];
  return String(output).split(/\r?\n/u).filter(Boolean).map((line) => {
    const row = JSON.parse(line);
    assert(Array.isArray(row), 'MySQL JSON_ARRAY result is malformed');
    return row;
  });
}

export function assertPrivateSnapshot(snapshot) {
  assert(snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot), 'private container snapshot is missing');
  assert.deepEqual(Object.keys(snapshot).sort(), [...targetServices].sort(),
    'private project must contain exactly its 26 expected services');
  for (const [service, item] of Object.entries(snapshot)) {
    assert(item && typeof item === 'object', `${service} container snapshot is malformed`);
    assert(item.containerId && item.imageId && item.status, `${service} container identity is incomplete`);
    assert.equal(item.project, projectName, `${service} is outside the approved private project`);
    assert.deepEqual(item.networks, [projectName], `${service} is attached to an unexpected network`);
    assert.deepEqual(item.portBindings, {}, `${service} publishes a host port`);
  }
}

export function assertDrainSnapshot(before, after) {
  assertPrivateSnapshot(before);
  assertPrivateSnapshot(after);
  for (const service of targetServices) {
    if (!drainServices.includes(service)) {
      assert.deepEqual(after[service], before[service], `${service} changed outside the writer drain`);
      continue;
    }
    assert.equal(after[service].containerId, before[service].containerId, `${service} container changed while draining`);
    assert.equal(after[service].imageId, before[service].imageId, `${service} image changed while draining`);
    assert.notEqual(after[service].status, 'running', `${service} writer is still running`);
  }
}

export function assertRestoredSnapshot(before, after, candidateId) {
  assertPrivateSnapshot(before);
  assertPrivateSnapshot(after);
  for (const service of targetServices) {
    if (service === 'iam-service') {
      assert.equal(after[service].imageId, candidateId, 'IAM is not running the exact V17 candidate image');
      assert.equal(after[service].status, 'running', 'V17 IAM candidate is not running');
      assert.notEqual(after[service].containerId, before[service].containerId,
        'IAM candidate promotion did not replace the original container');
      continue;
    }
    if (drainServices.includes(service)) {
      assert.equal(after[service].containerId, before[service].containerId,
        `${service} original container ID was not restored`);
      assert.equal(after[service].imageId, before[service].imageId,
        `${service} original image changed during promotion`);
      assert.equal(after[service].status, 'running', `${service} original writer did not resume`);
    }
  }
  for (const service of targetServices.filter((name) => !drainServices.includes(name) && name !== 'iam-service')) {
    assert.deepEqual(after[service], before[service], `${service} changed outside the IAM promotion scope`);
  }
}

export function assertRestoreProgressSnapshot(before, current, candidateId) {
  assertPrivateSnapshot(before);
  assertPrivateSnapshot(current);
  for (const service of targetServices) {
    if (service === 'iam-service') {
      assert.equal(current[service].imageId, candidateId, 'IAM candidate image changed during restore');
      assert.notEqual(current[service].containerId, before[service].containerId,
        'original IAM container unexpectedly returned during restore');
      assert.equal(current[service].status, 'running', 'IAM candidate stopped during writer restore');
    } else if (drainServices.includes(service)) {
      assert.equal(current[service].containerId, before[service].containerId,
        `${service} original container changed during restore`);
      assert.equal(current[service].imageId, before[service].imageId,
        `${service} original image changed during restore`);
      assert(['running', 'exited', 'created'].includes(current[service].status),
        `${service} has an unexpected status during restore resume`);
    } else {
      assert.deepEqual(current[service], before[service], `${service} changed outside the IAM promotion`);
    }
  }
}

export function restoreContainerIdsToStart(before, current, candidateId) {
  assertRestoreProgressSnapshot(before, current, candidateId);
  return drainServices.filter((service) => service !== 'iam-service'
    && current[service].status !== 'running').map((service) => before[service].containerId);
}

function contentV22Checksum() {
  const migrationPath = path.join(root, 'services/content-service/src/main/resources/db/migration/V22__content_aggregate_revision_and_version_ids.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8').replaceAll('\r\n', '\n');
  assert(sql.trim(), 'Content V22 migration source is empty');
  return sha256(sql);
}

function privateEnv(source = process.env) {
  const env = { ...source };
  for (const key of Object.keys(env)) {
    if (/^(?:MYSQL_|REDIS_|MINIO_|IAM_|KAFKA_|OBJECT_STORAGE_|CORS_|GATEWAY_AUDIT_|P1R_EXTERNAL_|RELEASE_TAG$|SOCIAL_MODERATION_CURSOR_KEY$|ADMIN_OPS_AUDIT_CURSOR_KEY$)/u.test(key)
      || ['IAM', 'LEARNER', 'CONTENT', 'LEARNING', 'ASSESSMENT', 'MEDIA', 'NOTIFICATION',
        'GAMIFICATION', 'SOCIAL', 'COMMERCE', 'ADMIN_OPS', 'ANALYTICS', 'AUDIT', 'WORKFLOW']
        .some((name) => key === `${name}_DB_PASSWORD`)) delete env[key];
  }
  return env;
}

function run(program, args, { output = false, stdoutFile = null, timeout = 120000 } = {}) {
  let fd = null;
  try {
    if (stdoutFile) fd = fs.openSync(stdoutFile, 'wx', 0o600);
    const result = spawnSync(program, args, {
      cwd: root,
      env: privateEnv(),
      encoding: stdoutFile ? undefined : 'utf8',
      stdio: stdoutFile ? ['ignore', fd, 'pipe'] : 'pipe',
      timeout,
      maxBuffer: 32 * 1024 * 1024,
      windowsHide: true
    });
    if (result.error || result.status !== 0) {
      throw new Error('private IAM V17 command failed; output was suppressed');
    }
    return output ? String(result.stdout || '').trim() : '';
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
}

function docker(args, options) {
  return run('docker', args, options);
}

function compose(state, args, promotionOverride = null, options = {}) {
  const argsWithFiles = [
    'compose', '-p', state.project, '--env-file', state.envFile,
    '-f', path.join(root, 'infra/docker/clyunedev/docker-compose.core.yml'),
    '-f', path.join(root, 'infra/docker/clyunedev/docker-compose.full.yml'),
    '-f', state.overrideFile
  ];
  if (promotionOverride) argsWithFiles.push('-f', promotionOverride);
  return docker([...argsWithFiles, ...args], options);
}

function assertComposeIsolation(state, config, currentIamImage = null) {
  assert.equal(config.name, projectName, 'Compose project name changed');
  assert.equal(Object.keys(config.services || {}).length, targetServices.length,
    'Compose service count differs from the private project');
  assert.equal(config.networks?.clyunedev?.name, projectName, 'Compose network is not project-local');
  assert.equal(config.networks?.clyunedev?.internal, true, 'private Compose network must remain internal');
  assert(!config.networks?.clyunedev?.external, 'private network must not be external');
  assert.equal(config.services['iam-service']?.environment?.IAM_FLYWAY_ENABLED, 'true',
    'IAM Flyway must remain enabled for V17');
  assert.equal(config.services['content-service']?.environment?.CONTENT_FLYWAY_ENABLED, 'false',
    'Content Flyway must stay disabled; V22 is already applied');
  if (currentIamImage) assert.equal(config.services['iam-service'].image, currentIamImage,
    'active IAM image differs from private Batch17 state');
  for (const [name, service] of Object.entries(config.services)) {
    assert.equal((service.ports || []).length, 0, `${name} publishes a host port`);
    assert.deepEqual(Object.keys(service.networks || {}), ['clyunedev'], `${name} uses an unexpected network`);
    for (const mount of service.volumes || []) {
      if (mount.type === 'volume') {
        assert(['clyunedev-mysql', 'clyunedev-redis', 'clyunedev-minio', 'clyunedev-kafka'].includes(mount.source));
        assert(String(config.volumes?.[mount.source]?.name || '').startsWith(`${projectName}-`),
          `${name} references a non-private volume`);
      }
      if (mount.type === 'bind') {
        const allowedSources = [state.keyFile, ...(name === 'mysql-init'
          ? [path.join(root, 'infra/docker/clyunedev/bootstrap-owner-schemas.sh')] : [])]
          .map((source) => path.resolve(source));
        assert(allowedSources.includes(path.resolve(mount.source)), `${name} has an unexpected bind mount`);
        assert.equal(mount.read_only, true, `${name} bind mount must be read-only`);
      }
    }
  }
  for (const [volume, suffix] of [
    ['clyunedev-mysql', 'mysql'], ['clyunedev-redis', 'redis'],
    ['clyunedev-minio', 'minio'], ['clyunedev-kafka', 'kafka']
  ]) {
    assert.equal(config.volumes?.[volume]?.name, `${projectName}-${suffix}`);
    assert(!config.volumes?.[volume]?.external, `${volume} must not be external`);
  }
}

function privatePermissionTargets(paths) {
  return [paths.tempDir, paths.stateFile, paths.envFile, paths.keyFile, paths.overrideFile,
    paths.batch16Backup, paths.receipt, paths.backup, paths.promotionOverride].filter((target) => fs.existsSync(target));
}

function assertPrivatePermissions(paths) {
  const targets = privatePermissionTargets(paths);
  for (const target of targets) {
    const info = fs.lstatSync(target);
    assert(!info.isSymbolicLink(), 'private promotion path contains a symbolic link');
    assert(info.isDirectory() || info.isFile(), 'private promotion path has an unsupported file type');
  }
  if (process.platform !== 'win32') {
    for (const target of targets) {
      const info = fs.lstatSync(target);
      assert.equal(info.mode & 0o077, 0, `${path.basename(target)} grants group or other access`);
      if (typeof process.getuid === 'function') assert.equal(info.uid, process.getuid());
    }
    return;
  }
  const encodedTargets = Buffer.from(JSON.stringify(targets), 'utf8').toString('base64');
  const script = [
    "$ErrorActionPreference='Stop'",
    `$targets=[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodedTargets}'))|ConvertFrom-Json`,
    '$current=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value',
    "$allowed=@($current,'S-1-5-18','S-1-5-32-544','S-1-3-0')",
    '$bad=@();foreach($target in $targets){$acl=Get-Acl -LiteralPath ([string]$target);try{$owner=([System.Security.Principal.NTAccount]::new($acl.Owner)).Translate([System.Security.Principal.SecurityIdentifier]).Value}catch{$owner=$acl.Owner};if($owner -ne $current){$bad+=@([string]$target)};foreach($ace in $acl.Access){if($ace.AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow){continue};try{$sid=$ace.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value}catch{$sid=$ace.IdentityReference.Value};if($allowed -notcontains $sid){$bad+=@([string]$target)}}}',
    '[pscustomobject]@{bad=$bad}|ConvertTo-Json -Compress'
  ].join(';');
  const windowsRoot = process.env.SystemRoot || process.env.WINDIR;
  assert(windowsRoot, 'Windows system root is unavailable for ACL verification');
  const env = privateEnv();
  env.PSModulePath = path.win32.join(windowsRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'Modules');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    cwd: root, env, encoding: 'utf8', timeout: 30000, windowsHide: true
  });
  assert(!result.error && result.status === 0, 'private ACL verification failed; operation was not advanced');
  const report = JSON.parse(result.stdout.trim());
  assert.deepEqual(Array.isArray(report.bad) ? report.bad : [], [], 'private ACL includes an unapproved identity');
}

function containerSnapshot(state) {
  const ids = docker(['ps', '-a', '--filter', `label=com.docker.compose.project=${state.project}`,
    '--format', '{{.ID}}'], { output: true }).split(/\r?\n/u).filter(Boolean);
  assert.equal(ids.length, targetServices.length, 'private Compose project no longer has exactly 26 containers');
  const inspected = JSON.parse(docker(['inspect', ...ids], { output: true }));
  assert.equal(inspected.length, targetServices.length);
  const snapshot = {};
  for (const item of inspected) {
    assert.equal(item.Config.Labels['com.docker.compose.project'], projectName);
    const service = item.Config.Labels['com.docker.compose.service'];
    assert(service && !Object.hasOwn(snapshot, service), 'private container service labels are not unique');
    snapshot[service] = {
      containerId: item.Id,
      imageId: item.Image,
      status: item.State.Status,
      project: item.Config.Labels['com.docker.compose.project'],
      networks: Object.keys(item.NetworkSettings.Networks || {}).sort(),
      portBindings: item.HostConfig.PortBindings || {}
    };
  }
  assertPrivateSnapshot(snapshot);
  return snapshot;
}

function sharedFingerprint() {
  const containers = docker(['ps', '-a', '--filter', 'name=^/yuxuexing-local-',
    '--format', '{{.ID}}|{{.Names}}'], { output: true }).split(/\r?\n/u).filter(Boolean).sort();
  const network = docker(['network', 'inspect', 'yuxuexing-local_yuxuexing-local', '--format', '{{.Id}}'],
    { output: true });
  return { containers, network };
}

function assertSharedFingerprint(state) {
  assert.deepEqual(sharedFingerprint(), state.sharedBefore,
    'shared Docker fingerprint changed; private promotion stopped');
}

function imageIdForTag(image) {
  const inspected = JSON.parse(docker(['image', 'inspect', image], { output: true }));
  assert.equal(inspected.length, 1, 'candidate IAM image is missing or ambiguous');
  assert((inspected[0].RepoTags || []).includes(image), 'candidate IAM tag does not resolve exactly');
  assert.match(inspected[0].Id || '', /^sha256:[a-f0-9]{64}$/u, 'candidate IAM image ID is invalid');
  return inspected[0].Id;
}

function mysqlRows(state, sql) {
  const output = docker(['exec', `${state.project}-mysql-1`, 'sh', '-ec',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --user=root --batch --skip-column-names --raw -e "$1"', '--', sql],
  { output: true, timeout: 60000 });
  return parseMysqlJsonRows(output);
}

function readDatabaseEvidence(state) {
  const migrationRows = mysqlRows(state,
    'SELECT JSON_ARRAY(version, description, script, success) FROM iam_service.flyway_schema_history ORDER BY installed_rank')
    .map(([version, description, script, success]) => ({ version, description, script, success }));
  const contentRows = mysqlRows(state,
    'SELECT JSON_ARRAY(version, checksum) FROM content_service.p1r_schema_history WHERE version = 22')
    .map(([version, checksum]) => ({ version, checksum }));
  const catalogRows = mysqlRows(state,
    'SELECT JSON_ARRAY(permission_key, status) FROM iam_service.iam_permission ORDER BY permission_key');
  const roleRows = mysqlRows(state,
    "SELECT JSON_ARRAY(role_key, status) FROM iam_service.iam_role WHERE role_id = 'role-learner'");
  const roleBindings = mysqlRows(state,
    'SELECT JSON_ARRAY(r.role_id, p.permission_key, r.revoked_at) FROM iam_service.iam_role_permission r JOIN iam_service.iam_permission p ON p.permission_id = r.permission_id ORDER BY r.role_id, p.permission_key');
  const accounts = mysqlRows(state,
    'SELECT JSON_ARRAY(principal_id, status, roles, permissions) FROM iam_service.iam_account ORDER BY principal_id');
  return { migrationRows, contentRows, catalogRows, roleRows, roleBindings, accounts };
}

function assertDatabasePreflight(evidence, expectedV22Checksum) {
  assertPreMigrationHistory(evidence.migrationRows);
  assert.equal(evidence.contentRows.length, 1, 'exactly one applied content V22 history row is required');
  assert.equal(String(evidence.contentRows[0].version), '22');
  assert.equal(String(evidence.contentRows[0].checksum), expectedV22Checksum,
    'Content V22 checksum differs from the current repository migration');
  assert(Array.isArray(evidence.catalogRows) && Array.isArray(evidence.roleBindings)
    && Array.isArray(evidence.roleRows) && Array.isArray(evidence.accounts),
  'IAM permission pre-migration evidence is incomplete');
}

function accountEvidenceForReceipt(rows) {
  const evidence = accountPermissionEvidence(rows);
  return {
    accountCount: evidence.accountCount,
    activeLearnerCount: evidence.activeLearnerCount,
    unaffectedAccountStateSha256: evidence.unaffectedAccountStateSha256,
    ineligiblePermissionsSha256: evidence.ineligiblePermissionsSha256
  };
}

function contextFingerprint(state, batch16Fingerprint) {
  return jsonHash({
    project: state.project,
    batch16Fingerprint,
    releaseTag: state.batch17ReleaseTag,
    candidateServices: state.batch17CandidateServices,
    candidateImages: state.batch17CandidateImages,
    candidateImageIds: state.batch17CandidateImageIds,
    contentV22Evidence: state.batch17ContentV22Evidence,
    activeIamImage: state.replacementImages['iam-service'],
    contentImage: state.replacementImages['content-service'],
    sharedBefore: state.sharedBefore
  });
}

function assertReceiptContext(state, paths, receipt) {
  assert.equal(receipt.project, projectName, 'promotion receipt belongs to another project');
  assert.equal(receipt.stateFile, paths.stateFile, 'promotion receipt belongs to another private state');
  assert.equal(receipt.contextFingerprint, contextFingerprint(state, paths.batch16Fingerprint),
    'private Batch16/Batch17 release state changed; resume is blocked');
  assert.equal(receipt.batch16Fingerprint, paths.batch16Fingerprint,
    'Batch16 migration state changed after the private backup');
  assert.equal(receipt.candidateImage, candidateImage, 'promotion receipt uses another candidate tag');
  assert.match(receipt.candidateImageId || '', /^sha256:[a-f0-9]{64}$/u,
    'promotion receipt candidate image ID is invalid');
  assert(phaseOrder.includes(receipt.phase), 'promotion receipt phase is unknown');
}

function readReceipt(paths) {
  if (!fs.existsSync(paths.receipt)) return null;
  const info = fs.lstatSync(paths.receipt);
  assert(info.isFile() && !info.isSymbolicLink(), 'promotion receipt must be a regular private file');
  assertPrivatePermissions(paths);
  return JSON.parse(fs.readFileSync(paths.receipt, 'utf8'));
}

function writeReceipt(paths, receipt) {
  const temporary = `${paths.receipt}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const fd = fs.openSync(temporary, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, `${JSON.stringify(receipt, null, 2)}\n`);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    assertPrivatePermissions({ ...paths, receipt: temporary });
    fs.renameSync(temporary, paths.receipt);
    assertPrivatePermissions(paths);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch {}
    throw error;
  }
}

function updateReceipt(paths, receipt, phase, additions = {}) {
  const currentIndex = phaseOrder.indexOf(receipt.phase);
  const nextIndex = phaseOrder.indexOf(phase);
  assert(currentIndex >= 0 && nextIndex >= currentIndex, 'promotion receipt cannot move backward');
  receipt.phase = phase;
  Object.assign(receipt, additions);
  receipt.updatedAt = new Date().toISOString();
  writeReceipt(paths, receipt);
}

function readPrivateState(stateFile) {
  assert(stateFile, 'usage: node iam-v17-private-promotion.mjs <preflight|drain-backup|promote|verify|restore|status> <private state.json>');
  const resolved = path.resolve(stateFile);
  const stateInfo = fs.lstatSync(resolved);
  assert(stateInfo.isFile() && !stateInfo.isSymbolicLink(), 'state.json must be a regular private file');
  const state = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const paths = assertPrivateStateShape(state, resolved);
  assertPrivatePermissions(paths);
  return { state, paths };
}

function baselineImageForService(state, service) {
  return state.replacementImages?.[service]
    ?? `cloudstudy-clyunedev/${service}:${state.tag}`;
}

function assertCurrentSnapshot(state, snapshot, reference, { candidateStarted = false, allowDrain = false } = {}) {
  assertPrivateSnapshot(snapshot);
  assertPrivateSnapshot(reference);
  for (const service of targetServices) {
    if (service === 'iam-service' && candidateStarted) {
      assert.equal(snapshot[service].imageId, candidateImageIdFromState(state), 'IAM candidate image changed');
      assert.notEqual(snapshot[service].containerId, reference[service].containerId,
        'IAM service still uses the pre-promotion container');
      continue;
    }
    const prior = reference[service];
    const actual = snapshot[service];
    assert.equal(actual.containerId, prior.containerId, `${service} container identity changed unexpectedly`);
    assert.equal(actual.imageId, prior.imageId, `${service} image changed unexpectedly`);
    if (allowDrain && drainServices.includes(service)) {
      assert.notEqual(actual.status, 'running', `${service} writer is still running`);
    } else if (!allowDrain && drainServices.includes(service) && !candidateStarted) {
      assert.equal(actual.status, prior.status, `${service} status changed unexpectedly`);
    } else if (candidateStarted && service !== 'iam-service' && drainServices.includes(service)) {
      assert.notEqual(actual.status, 'running', `${service} writer restarted before verification`);
    } else {
      assert.deepEqual(actual, prior, `${service} changed outside the IAM promotion scope`);
    }
  }
}

function candidateImageIdFromState(state) {
  const receipt = readReceipt(privatePaths(state));
  assert(receipt?.candidateImageId, 'candidate image ID is absent from the private promotion receipt');
  return receipt.candidateImageId;
}

function accountRolesPermissions(rows) {
  return accountPermissionEvidence(rows);
}

function assertReceiptBackup(paths, receipt) {
  assert.equal(path.resolve(receipt.backup?.path || ''), paths.backup,
    'fresh V17 backup path differs from its private receipt');
  const info = fs.lstatSync(paths.backup);
  assert(info.isFile() && !info.isSymbolicLink(), 'V17 backup must be a regular private file');
  assert.equal(info.size, receipt.backup.bytes, 'V17 backup size changed after its receipt');
  assert.equal(hashFile(paths.backup), receipt.backup.sha256,
    'V17 backup SHA-256 differs from its private receipt');
  assert.notEqual(paths.backup, paths.batch16Backup, 'V17 backup must never overwrite Batch16 backup');
  assertPrivatePermissions(paths);
}

function readinessProbe(state, targets = activeReadinessTargets) {
  const image = state.replacementImages['mysql-migrate'];
  assert.match(image || '', /^cloudstudy-clyunedev\/owner-migrator:[A-Za-z0-9_.-]{1,128}$/u,
    'private owner-migrator readiness image is missing');
  const requestedTargets = targets.map(([name, port, route]) => ({ name, port, route }));
  const js = `const targets=${JSON.stringify(requestedTargets)};const result=await Promise.all(targets.map(async target=>{const deadline=Date.now()+180000;let status=0;let error='';while(Date.now()<deadline&&status!==200){try{const response=await fetch('http://'+target.name+':'+target.port+target.route,{signal:AbortSignal.timeout(4000)});status=response.status;error='';}catch(e){error=e.name;}if(status!==200)await new Promise(resolve=>setTimeout(resolve,2000));}return {...target,status,error};}));console.log(JSON.stringify(result));if(result.some(item=>item.status!==200))process.exitCode=1;`;
  const output = docker(['run', '--rm', '--pull=never', '--network', state.project,
    '--label', `com.cloudstudy.uat.project=${state.project}`, '--entrypoint', 'node', image,
    '--input-type=module', '-e', js], { output: true, timeout: 240000 });
  const results = JSON.parse(output);
  assert.deepEqual(results.map((item) => item.name), requestedTargets.map(({ name }) => name));
  assert(results.every((item) => item.status === 200), 'private readiness check did not pass for every service');
  return results.map(({ name, status }) => ({ name, status }));
}

function v17OverrideText() {
  return `services:\n  iam-service:\n    image: ${candidateImage}\n`;
}

function writePromotionOverride(paths) {
  const text = v17OverrideText();
  if (fs.existsSync(paths.promotionOverride)) {
    const info = fs.lstatSync(paths.promotionOverride);
    assert(info.isFile() && !info.isSymbolicLink(), 'promotion override must be a regular private file');
    assert.equal(fs.readFileSync(paths.promotionOverride, 'utf8'), text,
      'an unexpected V17 override exists; refusing to replace it');
    return;
  }
  const fd = fs.openSync(paths.promotionOverride, 'wx', 0o600);
  try { fs.writeFileSync(fd, text); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  assertPrivatePermissions(paths);
}

function currentImageForCompose(state, config) {
  return config.services['iam-service']?.image || baselineImageForService(state, 'iam-service');
}

function loadPromotionContext(stateFile) {
  const { state, paths } = readPrivateState(stateFile);
  const receipt = readReceipt(paths);
  if (receipt) assertReceiptContext(state, paths, receipt);
  return { state, paths, receipt };
}

function preflight(stateFile, { createReceipt = true } = {}) {
  const { state, paths } = readPrivateState(stateFile);
  assert(!fs.existsSync(paths.receipt), 'V17 promotion receipt already exists; resume with its recorded stage');
  for (const target of [paths.backup, paths.promotionOverride]) {
    assert(!fs.existsSync(target), 'orphan V17 backup or override exists without a receipt; inspect privately');
  }
  assert(!Object.hasOwn(state.batch17CandidateImages, 'iam-service')
    && !Object.hasOwn(state.batch17CandidateImageIds, 'iam-service'),
    'IAM candidate must not be smuggled into the Batch17 no-schema candidate state');
  const config = JSON.parse(compose(state, ['config', '--format', 'json'], null, { output: true }));
  const activeImage = currentImageForCompose(state, config);
  assert.equal(activeImage, baselineImageForService(state, 'iam-service'),
    'current IAM Compose image differs from the recorded Batch17 baseline');
  assertComposeIsolation(state, config, activeImage);
  const before = containerSnapshot(state);
  assert(before['iam-service'].status === 'running', 'current IAM service must be running before drain');
  for (const service of drainServices) assert.equal(before[service].status, 'running', `${service} is not running before drain`);
  assertSharedFingerprint(state);
  const candidateId = imageIdForTag(candidateImage);
  assert.notEqual(candidateId, before['iam-service'].imageId,
    'V17 IAM candidate image must be new relative to the running IAM container');
  assert.deepEqual(before['iam-service'].imageId,
    JSON.parse(docker(['image', 'inspect', activeImage], { output: true }))[0].Id,
    'running IAM container differs from the active Compose image');
  const db = readDatabaseEvidence(state);
  assertDatabasePreflight(db, paths.expectedV22Checksum);
  const beforeSnapshot = structuredClone(before);
  const beforeAccount = accountRolesPermissions(db.accounts);
  const receipt = {
    format: 1,
    project: projectName,
    stateFile: paths.stateFile,
    phase: 'preflighted',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    contextFingerprint: contextFingerprint(state, paths.batch16Fingerprint),
    batch16Fingerprint: paths.batch16Fingerprint,
    candidateImage,
    candidateImageId: candidateId,
    currentIamImage: activeImage,
    contentV22Checksum: paths.expectedV22Checksum,
    migrationBefore: assertPreMigrationHistory(db.migrationRows),
    beforeSnapshot,
    beforeSharedFingerprint: structuredClone(state.sharedBefore),
    beforeAccountEvidence: accountEvidenceForReceipt(db.accounts),
    beforeCatalogKeys: db.catalogRows.map((row) => String(row[0])).sort(),
    beforeRoleBindings: db.roleBindings,
    beforeRoleBindingSet: db.roleBindings.map(encodeRoleBinding).sort()
  };
  assert.equal(beforeAccount.accountCount, receipt.beforeAccountEvidence.accountCount);
  if (createReceipt) {
    writeReceipt(paths, receipt);
    console.log('IAM V17 private preflight passed; only a private local receipt was written.');
  } else {
    console.log('IAM V17 read-only dry-run passed; no receipt or service/database changes were made.');
  }
}

function drainAndBackup(stateFile) {
  const { state, paths, receipt } = loadPromotionContext(stateFile);
  assert(receipt, 'V17 preflight receipt is required before writer drain');
  if (receipt.phase === 'preflighted') {
    const current = containerSnapshot(state);
    assert.deepEqual(current, receipt.beforeSnapshot, 'private containers changed after V17 preflight');
    assertSharedFingerprint(state);
    compose(state, ['stop', '--timeout', '30', ...drainServices]);
    const stopped = containerSnapshot(state);
    assertDrainSnapshot(receipt.beforeSnapshot, stopped);
    updateReceipt(paths, receipt, 'writers-stopped', {
      stoppedSnapshot: stopped,
      writersStoppedAt: new Date().toISOString()
    });
  } else if (['writers-stopped', 'backup-started', 'backup-verified'].includes(receipt.phase)) {
    const current = containerSnapshot(state);
    assertDrainSnapshot(receipt.beforeSnapshot, current);
  } else {
    assert(receipt.phase === 'backup-verified', 'writer drain/backup stage cannot resume after IAM promotion started');
  }
  if (receipt.phase === 'backup-verified') {
    assertReceiptBackup(paths, receipt);
    console.log('IAM V17 private writer drain and backup are already complete.');
    return;
  }
  if (receipt.phase === 'writers-stopped') {
    assert(!fs.existsSync(paths.backup), 'unreceipted V17 dump exists; refusing to overwrite or adopt it');
    updateReceipt(paths, receipt, 'backup-started', { backupStartedAt: new Date().toISOString() });
  }
  assert.equal(receipt.phase, 'backup-started', 'V17 backup stage is not resumable');
  assert(!fs.existsSync(paths.backup),
    'unreceipted V17 dump exists after an interrupted backup; inspect privately and do not overwrite');
  const mysql = containerSnapshot(state).mysql;
  assert.equal(mysql.status, 'running', 'private MySQL must remain up during the V17 backup');
  compose(state, ['exec', '-T', 'mysql', 'sh', '-ec',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump --user=root --single-transaction --no-tablespaces --routines --events --all-databases'],
  null, { stdoutFile: paths.backup, timeout: 600000 });
  const stat = fs.lstatSync(paths.backup);
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.size > 1024, 'private V17 database dump is empty or invalid');
  assertPrivatePermissions(paths);
  const backup = { path: paths.backup, bytes: stat.size, sha256: hashFile(paths.backup) };
  updateReceipt(paths, receipt, 'backup-verified', { backup, backupVerifiedAt: new Date().toISOString() });
  assertReceiptBackup(paths, receipt);
  assertSharedFingerprint(state);
  console.log('IAM V17 private writer drain and fresh backup verified.');
}

function verifyMigrationHistory(state) {
  const rows = mysqlRows(state,
    'SELECT JSON_ARRAY(version, description, script, success) FROM iam_service.flyway_schema_history ORDER BY installed_rank')
    .map(([version, description, script, success]) => ({ version, description, script, success }));
  return { rows, evidence: assertPostMigrationHistory(rows) };
}

function startCandidate(state, paths, receipt) {
  assertReceiptBackup(paths, receipt);
  const current = containerSnapshot(state);
  if (receipt.phase === 'promotion-started') {
    // A rerun after an unknown exit never reissues Flyway blindly.
    assertCurrentSnapshot(state, current, receipt.beforeSnapshot, { candidateStarted: true, allowDrain: true });
    const currentHistory = mysqlRows(state,
      'SELECT JSON_ARRAY(version, description, script, success) FROM iam_service.flyway_schema_history ORDER BY installed_rank')
      .map(([version, description, script, success]) => ({ version, description, script, success }));
    assertPostMigrationHistory(currentHistory);
    assert.equal(current['iam-service'].imageId, receipt.candidateImageId,
      'V17 is recorded but IAM is not running the recorded candidate image');
    assert.equal(current['iam-service'].status, 'running', 'V17 candidate is not running after interruption');
    return current;
  }
  assert.equal(receipt.phase, 'backup-verified', 'fresh verified backup is required before IAM startup');
  assertDrainSnapshot(receipt.beforeSnapshot, current);
  assertSharedFingerprint(state);
  assert.equal(imageIdForTag(candidateImage), receipt.candidateImageId,
    'candidate image tag resolved to a different image after preflight');
  writePromotionOverride(paths);
  const candidateConfig = JSON.parse(compose(state, ['config', '--format', 'json'], paths.promotionOverride,
    { output: true }));
  assertComposeIsolation(state, candidateConfig, candidateImage);
  updateReceipt(paths, receipt, 'promotion-started', { promotionStartedAt: new Date().toISOString() });
  compose(state, promotionComposeArgs(), paths.promotionOverride, { timeout: 900000 });
  const after = containerSnapshot(state);
  assertCurrentSnapshot(state, after, receipt.beforeSnapshot, { candidateStarted: true, allowDrain: true });
  assert.equal(after['iam-service'].imageId, receipt.candidateImageId);
  assert.notEqual(after['iam-service'].containerId, receipt.beforeSnapshot['iam-service'].containerId);
  assertSharedFingerprint(state);
  readinessProbe(state, iamReadinessTargets);
  verifyMigrationHistory(state);
  updateReceipt(paths, receipt, 'iam-promoted', {
    promotedSnapshot: after,
    iamContainerId: after['iam-service'].containerId,
    iamPromotedAt: new Date().toISOString()
  });
  return after;
}

function promote(stateFile) {
  const { state, paths, receipt } = loadPromotionContext(stateFile);
  assert(receipt, 'V17 preflight receipt is required before promotion');
  if (['iam-promoted', 'verified', 'restore-started', 'complete'].includes(receipt.phase)) {
    const current = containerSnapshot(state);
    assert.equal(current['iam-service'].imageId, receipt.candidateImageId);
    assert.equal(current['iam-service'].status, 'running');
    assertPostMigrationHistory(readDatabaseEvidence(state).migrationRows);
    console.log('IAM V17 candidate promotion is already recorded.');
    return;
  }
  if (receipt.phase === 'promotion-started') {
    startCandidate(state, paths, receipt);
    readinessProbe(state, iamReadinessTargets);
    updateReceipt(paths, receipt, 'iam-promoted', {
      promotedSnapshot: containerSnapshot(state),
      iamContainerId: containerSnapshot(state)['iam-service'].containerId,
      iamPromotedAt: new Date().toISOString(),
      resumedAfterInterruption: true
    });
    console.log('IAM V17 promotion resumed from verified database and candidate state.');
    return;
  }
  assert.equal(receipt.phase, 'backup-verified', 'verified V17 backup is required before promotion');
  startCandidate(state, paths, receipt);
  console.log('IAM V17 candidate started; Flyway V17 is recorded successfully.');
}

function verify(stateFile) {
  const { state, paths, receipt } = loadPromotionContext(stateFile);
  assert(receipt, 'V17 promotion receipt is required before verification');
  assert(['iam-promoted', 'verified', 'restore-started', 'complete'].includes(receipt.phase),
    'IAM candidate must start and report successful V17 before verification');
  assertReceiptBackup(paths, receipt);
  const current = containerSnapshot(state);
  if (receipt.phase === 'restore-started') {
    assertRestoreProgressSnapshot(receipt.beforeSnapshot, current, receipt.candidateImageId);
  } else if (receipt.phase === 'complete') {
    assertRestoredSnapshot(receipt.beforeSnapshot, current, receipt.candidateImageId);
    assert.equal(current['iam-service'].containerId, receipt.iamContainerId,
      'IAM candidate container changed after completed restore');
  } else {
    assertCurrentSnapshot(state, current, receipt.beforeSnapshot, { candidateStarted: true, allowDrain: true });
  }
  assert.equal(current['iam-service'].status, 'running', 'promoted IAM candidate is not running');
  const migration = verifyMigrationHistory(state);
  const db = readDatabaseEvidence(state);
  assertPostMigrationHistory(db.migrationRows);
  assert.equal(db.contentRows.length, 1, 'content V22 history row changed during IAM promotion');
  assert.equal(String(db.contentRows[0].checksum), receipt.contentV22Checksum,
    'content V22 history checksum changed during IAM promotion');
  const permissionSummary = assertPostPermissionEvidence({
    beforeCatalogKeys: receipt.beforeCatalogKeys,
    afterCatalogRows: db.catalogRows,
    beforeRoleBindings: receipt.beforeRoleBindings,
    afterRoleBindings: db.roleBindings,
    roleRows: db.roleRows,
    beforeAccountEvidence: receipt.beforeAccountEvidence,
    afterAccountRows: db.accounts
  });
  assertSharedFingerprint(state);
  if (receipt.phase === 'iam-promoted') {
    updateReceipt(paths, receipt, 'verified', {
      v17History: migration.evidence,
      permissionSummary,
      verifiedAt: new Date().toISOString()
    });
  } else {
    assert(['verified', 'restore-started', 'complete'].includes(receipt.phase),
      'verification receipt phase is inconsistent');
    assert.deepEqual(receipt.permissionSummary, permissionSummary,
      'verified permission summary changed after restore');
  }
  console.log('IAM V17 history, learner grants, negative scope boundaries, and private isolation verified.');
}

function restore(stateFile) {
  const { state, paths, receipt } = loadPromotionContext(stateFile);
  assert(receipt, 'V17 promotion receipt is required before restoring writers');
  if (receipt.phase === 'complete') {
    const finalSnapshot = containerSnapshot(state);
    assertRestoredSnapshot(receipt.beforeSnapshot, finalSnapshot, receipt.candidateImageId);
    assertSharedFingerprint(state);
    console.log('IAM V17 private promotion is already complete.');
    return;
  }
  assert(receipt.phase === 'verified' || receipt.phase === 'restore-started',
    'V17 SQL and learner-scope verification must pass before writers are restored');
  assertReceiptBackup(paths, receipt);
  const current = containerSnapshot(state);
  if (receipt.phase === 'verified') {
    assertCurrentSnapshot(state, current, receipt.beforeSnapshot, { candidateStarted: true, allowDrain: true });
  } else {
    assertRestoreProgressSnapshot(receipt.beforeSnapshot, current, receipt.candidateImageId);
  }
  const ids = drainServices.filter((service) => service !== 'iam-service')
    .map((service) => receipt.beforeSnapshot[service].containerId);
  assert.equal(ids.length, drainServices.length - 1, 'restore list must include all original non-IAM writers and Gateway');
  if (receipt.phase === 'verified') {
    updateReceipt(paths, receipt, 'restore-started', { restoreStartedAt: new Date().toISOString() });
  }
  const present = containerSnapshot(state);
  const startIds = restoreContainerIdsToStart(receipt.beforeSnapshot, present, receipt.candidateImageId);
  if (startIds.length) docker(['start', ...startIds], { timeout: 600000 });
  const after = containerSnapshot(state);
  for (const service of drainServices.filter((name) => name !== 'iam-service')) {
    assert.equal(after[service].containerId, receipt.beforeSnapshot[service].containerId,
      `${service} original container was not restored`);
    assert.equal(after[service].imageId, receipt.beforeSnapshot[service].imageId,
      `${service} original image changed during restore`);
    assert.equal(after[service].status, 'running', `${service} did not resume`);
  }
  assert.equal(after['iam-service'].containerId, receipt.iamContainerId,
    'IAM container changed after V17 verification');
  assert.equal(after['iam-service'].imageId, receipt.candidateImageId);
  assert.equal(after['iam-service'].status, 'running');
  for (const service of targetServices.filter((name) => !drainServices.includes(name))) {
    assert.deepEqual(after[service], receipt.beforeSnapshot[service],
      `${service} changed outside the V17 private promotion`);
  }
  assertSharedFingerprint(state);
  const readiness = readinessProbe(state);
  assert.equal(readiness.length, activeReadinessTargets.length);
  const db = readDatabaseEvidence(state);
  assertPostMigrationHistory(db.migrationRows);
  const permissionSummary = assertPostPermissionEvidence({
    beforeCatalogKeys: receipt.beforeCatalogKeys,
    afterCatalogRows: db.catalogRows,
    beforeRoleBindings: receipt.beforeRoleBindings,
    afterRoleBindings: db.roleBindings,
    roleRows: db.roleRows,
    beforeAccountEvidence: receipt.beforeAccountEvidence,
    afterAccountRows: db.accounts
  });
  assert.deepEqual(permissionSummary, receipt.permissionSummary,
    'learner scope verification changed while restoring the private writers');
  assertSharedFingerprint(state);
  updateReceipt(paths, receipt, 'complete', {
    restoredSnapshot: after,
    restoredServices: drainServices.filter((service) => service !== 'iam-service'),
    readiness: readiness.map(({ name, status }) => ({ name, status })),
    completedAt: new Date().toISOString()
  });
  console.log('IAM V17 private promotion completed; original non-IAM writer IDs and Gateway were restored.');
}

function status(stateFile) {
  const { state, paths, receipt } = loadPromotionContext(stateFile);
  if (!receipt) {
    console.log(JSON.stringify({ project: state.project, phase: 'not-started' }));
    return;
  }
  if (receipt.backup?.path && fs.existsSync(paths.backup)) assertReceiptBackup(paths, receipt);
  console.log(JSON.stringify({
    project: receipt.project,
    phase: receipt.phase,
    candidateImage: receipt.candidateImage,
    backupBytes: receipt.backup?.bytes ?? null,
    backupSha256: receipt.backup?.sha256 ?? null,
    v17Verified: ['verified', 'restore-started', 'complete'].includes(receipt.phase),
    complete: receipt.phase === 'complete'
  }));
}

function main() {
  const handlers = {
    preflight,
    'dry-run': (stateFile) => preflight(stateFile, { createReceipt: false }),
    'drain-backup': drainAndBackup,
    promote,
    verify,
    restore,
    status
  };
  assert(handlers[command], 'unknown IAM V17 private promotion command');
  handlers[command](stateFileArg);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    const reason = process.env.CLOUDSTUDY_UAT_DIAGNOSTIC === '1' && error?.name === 'AssertionError'
      ? String(error?.message || '').split('\n', 1)[0].slice(0, 180)
      : '';
    console.error(`IAM V17 private promotion failed closed; private outputs were suppressed.${reason ? ` ${reason}` : ''}`);
    process.exitCode = 1;
  }
}
