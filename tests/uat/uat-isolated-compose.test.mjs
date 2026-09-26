import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  BATCH16_APPLY_SERVICES,
  BATCH16_CANDIDATE_SERVICES,
  BATCH17_CANDIDATE_SERVICES,
  BATCH17_PRIVATE_SERVICES,
  assertBatch16StageFlags,
  assertBatch17ContentV22Evidence,
  assertBatch17PrivateSnapshot,
  assertPrivateAuditCursorSecret,
  assertPrivateComposeIsolation,
  assertPrivateTempPermissions,
  batch16CandidateImages,
  batch17CandidateImages,
  batch17ComposeArgs,
  contentV22Checksum,
  batchEvidenceFilePath,
  batchEvidenceSuffix,
  browserEvidenceDirectory,
  createPrivateEnvironment,
  ensurePrivateCursorSecretsInEnvContent,
  evidenceDate,
  imageForRepository,
  imageForService,
  prepareBatch16Candidates,
  prepareBatch17CandidateMetadata,
  restoreBatch16NonTargetOwners,
  safeEnv,
  securePrivateTempPermissions,
  startBatch16OriginalContainers,
  upgradePrivateCursorSecrets,
  useBatch16Candidates,
  useBatch17Candidates,
  updateBatch16MigrationGateContent,
  validateReplacementImages
} from '../../scripts/runtime/uat-isolated-compose.mjs';

const batch16Tag = '583ab627-uat-batch16-202609250002';
const batch17Tag = '583ab627-uat-batch17-202609251645';

function createPrivateStateFixture(t) {
  const project = 'cloudstudy-uat-isolated-a1b2c3d4e5';
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `${project}-test-`));
  const state = {
    project,
    tempDir,
    stateFile: path.join(tempDir, 'state.json'),
    envFile: path.join(tempDir, 'uat.env'),
    keyFile: path.join(tempDir, 'iam-rsa-private.pem'),
    overrideFile: path.join(tempDir, 'docker-compose.isolated.yml')
  };
  fs.writeFileSync(state.stateFile, '{}\n', { mode: 0o600 });
  fs.writeFileSync(state.envFile, '', { mode: 0o600 });
  fs.writeFileSync(state.keyFile, 'test-only-private-key', { mode: 0o600 });
  fs.writeFileSync(state.overrideFile, 'services:\n', { mode: 0o600 });
  t.after(() => {
    for (const file of [state.stateFile, state.envFile, state.keyFile, state.overrideFile]) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    fs.rmdirSync(tempDir);
  });
  return state;
}

function batch17MigrationFixture() {
  return { preflightPassed: true, applyPassed: true, verifyPassed: true,
    adminOpsV5: { version: 5, checksum: 'verified-checksum' }, writersRestored: true };
}

function batch17StateFixture() {
  return {
    project: 'cloudstudy-uat-isolated-3c94b27160',
    overrideFile: 'C:/private/docker-compose.isolated.yml',
    sharedBefore: { containers: ['shared-container|yuxuexing-local-core'], network: 'shared-network-id' },
    replacementImages: {
      'api-gateway': 'cloudstudy-clyunedev/api-gateway:prior',
      'iam-service': 'cloudstudy-clyunedev/iam-service:prior',
      'official-site': 'cloudstudy-clyunedev/official-site:batch16',
      'content-service': 'cloudstudy-clyunedev/content-service:prior',
      'learner-web': 'cloudstudy-clyunedev/learner-web:batch16',
      'mobile-h5': 'cloudstudy-clyunedev/mobile-h5:batch16'
    },
    batch16CandidateServices: ['official-site', 'learner-web', 'admin-web', 'mobile-h5',
      'admin-ops-service', 'mysql-migrate'],
    batch16CandidateImages: { 'admin-ops-service': 'cloudstudy-clyunedev/admin-ops-service:batch16' },
    batch16Migration: batch17MigrationFixture(),
    events: []
  };
}

function batch17SnapshotFixture() {
  const project = 'cloudstudy-uat-isolated-3c94b27160';
  return Object.fromEntries(BATCH17_PRIVATE_SERVICES.map((service, index) => [service, {
    containerId: `container-${service}-before`,
    imageId: `sha256:${String(index + 1).padStart(64, '0')}`,
    status: ['mysql-init', 'minio-init'].includes(service) ? 'exited' : 'running',
    exitCode: ['mysql-init', 'minio-init'].includes(service) ? 0 : 0,
    project,
    networks: [project],
    portBindings: {}
  }]));
}

function batch17TestDependencies(state, current, imageIds, overrides = {}) {
  const calls = { apply: [], events: [], writes: [], persists: 0, validations: 0, migrationChecks: 0 };
  const deps = {
    checkPrivatePermissions: () => {},
    validateState: () => {
      calls.validations += 1;
      return { services: { 'content-service': { environment: { CONTENT_FLYWAY_ENABLED: 'false' } } } };
    },
    inspectImages: () => ({ ...imageIds }),
    verifyContentV22: (_value, config) => {
      calls.migrationChecks += 1;
      return assertBatch17ContentV22Evidence({
        flywayEnabled: config.services['content-service'].environment.CONTENT_FLYWAY_ENABLED,
        rows: [{ version: 22, checksum: contentV22Checksum() }]
      });
    },
    snapshot: () => structuredClone(current),
    readSharedFingerprint: () => structuredClone(state.sharedBefore),
    readOverride: () => 'services:\n  official-site:\n    ports: !reset []\n',
    writeOverride: (_file, contents) => calls.writes.push(contents),
    persistState: (value) => {
      calls.persists += 1;
      assert.deepEqual(value.batch16Migration, batch17MigrationFixture());
    },
    applyServices: (_value, services) => {
      calls.apply.push([...services]);
      for (const service of services) {
        current[service] = {
          ...current[service], containerId: `container-${service}-batch17`, imageId: imageIds[service], status: 'running'
        };
      }
    },
    recordEvent: (_value, name, details) => calls.events.push({ name, details }),
    ...overrides
  };
  return { deps, calls };
}

test('image selection maps Compose services to their repository names', () => {
  const replacements = {
    'api-gateway': 'cloudstudy-clyunedev/api-gateway:release-1',
    'iam-service': 'cloudstudy-clyunedev/iam-service:release-1',
    'learner-web': 'cloudstudy-clyunedev/learner-web:release-1',
    'mobile-h5': 'cloudstudy-clyunedev/mobile-h5:release-1',
    'mysql-migrate': `cloudstudy-clyunedev/owner-migrator:${batch16Tag}`,
    'admin-ops-service': `cloudstudy-clyunedev/admin-ops-service:${batch16Tag}`
  };

  assert.equal(imageForService('mysql-migrate', { replacementImages: replacements }), replacements['mysql-migrate']);
  assert.equal(imageForRepository('owner-migrator', { replacementImages: replacements }), replacements['mysql-migrate']);
  assert.equal(imageForService('admin-ops-service', { replacementImages: replacements }), replacements['admin-ops-service']);
  assert.doesNotThrow(() => validateReplacementImages(replacements));
  assert.throws(() => validateReplacementImages({
    ...replacements,
    'mysql-migrate': `cloudstudy-clyunedev/mysql-migrate:${batch16Tag}`
  }), /repository does not match/u);
  assert.throws(() => validateReplacementImages({
    ...replacements,
    'owner-migrator': `cloudstudy-clyunedev/owner-migrator:${batch16Tag}`
  }), /not allowlisted/u);
});

test('Batch16 selects exactly the six requested candidate services', () => {
  assert.deepEqual(BATCH16_CANDIDATE_SERVICES, [
    'official-site', 'learner-web', 'admin-web', 'mobile-h5', 'admin-ops-service', 'mysql-migrate'
  ]);
  const images = batch16CandidateImages(batch16Tag);
  assert.deepEqual(Object.keys(images), BATCH16_CANDIDATE_SERVICES);
  assert.equal(images['mysql-migrate'], `cloudstudy-clyunedev/owner-migrator:${batch16Tag}`);
  assert.equal(images['admin-ops-service'], `cloudstudy-clyunedev/admin-ops-service:${batch16Tag}`);
  assert.throws(() => batch16CandidateImages('583ab627-uat-batch15-202609231430'), /Batch16 release tag/u);
  assert.deepEqual(BATCH16_APPLY_SERVICES, [
    'official-site', 'learner-web', 'admin-web', 'mobile-h5', 'admin-ops-service'
  ]);
  assert.equal(BATCH16_APPLY_SERVICES.includes('mysql-migrate'), false);
});

test('private audit cursor secret is generated once and filtered from child process environment', () => {
  const privateEnv = createPrivateEnvironment('0123456789', 'C:\\private\\iam.pem');
  assert.match(privateEnv.SOCIAL_MODERATION_CURSOR_KEY, /^[a-f0-9]{64}$/u);
  assert.equal(Buffer.from(privateEnv.SOCIAL_MODERATION_CURSOR_KEY, 'hex').length, 32);
  assert.match(privateEnv.ADMIN_OPS_AUDIT_CURSOR_KEY, /^[a-f0-9]{64}$/u);
  assert.equal(Buffer.from(privateEnv.ADMIN_OPS_AUDIT_CURSOR_KEY, 'hex').length, 32);
  assert.equal(privateEnv.IAM_JWT_PRIVATE_KEY_HOST_PATH, 'C:/private/iam.pem');

  const config = { services: {
    'social-service': { environment: {
      SOCIAL_MODERATION_CURSOR_KEY: privateEnv.SOCIAL_MODERATION_CURSOR_KEY
    } },
    'admin-ops-service': { environment: {
      ADMIN_OPS_AUDIT_CURSOR_KEY: privateEnv.ADMIN_OPS_AUDIT_CURSOR_KEY
    } }
  } };
  assert.doesNotThrow(() => assertPrivateAuditCursorSecret(config, privateEnv));
  assert.throws(() => assertPrivateAuditCursorSecret(config, {
    ...privateEnv, ADMIN_OPS_AUDIT_CURSOR_KEY: 'short'
  }), /at least 32 bytes/u);

  const filtered = safeEnv({
    ADMIN_OPS_AUDIT_CURSOR_KEY: 'inherited-sensitive-value',
    ADMIN_OPS_DB_PASSWORD: 'inherited-db-password',
    SOCIAL_MODERATION_CURSOR_KEY: 'inherited-social-secret',
    PATH: 'safe-path'
  });
  assert.equal(Object.hasOwn(filtered, 'ADMIN_OPS_AUDIT_CURSOR_KEY'), false);
  assert.equal(Object.hasOwn(filtered, 'ADMIN_OPS_DB_PASSWORD'), false);
  assert.equal(Object.hasOwn(filtered, 'SOCIAL_MODERATION_CURSOR_KEY'), false);
  assert.equal(filtered.PATH, 'safe-path');
});

test('legacy private env cursor-key upgrade appends only missing keys and is idempotent', () => {
  const existingAdminKey = 'a'.repeat(64);
  let generated = 0;
  const generateSecret = () => (++generated).toString(16).padStart(64, '0');
  const legacyEnv = `MYSQL_ROOT_PASSWORD=private-db-secret\nADMIN_OPS_AUDIT_CURSOR_KEY=${existingAdminKey}\n`;
  const first = ensurePrivateCursorSecretsInEnvContent(legacyEnv, generateSecret);
  assert.deepEqual(first.addedKeys, ['SOCIAL_MODERATION_CURSOR_KEY']);
  assert(first.content.includes(`ADMIN_OPS_AUDIT_CURSOR_KEY=${existingAdminKey}`));
  assert.equal(first.content.split('ADMIN_OPS_AUDIT_CURSOR_KEY=').length - 1, 1);
  assert.equal(generated, 1);

  const second = ensurePrivateCursorSecretsInEnvContent(first.content, generateSecret);
  assert.deepEqual(second.addedKeys, []);
  assert.equal(second.content, first.content);
  assert.equal(generated, 1);

  const blank = ensurePrivateCursorSecretsInEnvContent('', generateSecret);
  assert.deepEqual(blank.addedKeys, ['SOCIAL_MODERATION_CURSOR_KEY', 'ADMIN_OPS_AUDIT_CURSOR_KEY']);
  assert.equal((blank.content.match(/^[A-Z_]+_CURSOR_KEY=/gmu) || []).length, 2);
  assert.throws(() => ensurePrivateCursorSecretsInEnvContent(
    `SOCIAL_MODERATION_CURSOR_KEY=${'s'.repeat(32)}\nSOCIAL_MODERATION_CURSOR_KEY=${'t'.repeat(32)}\n`),
  /appears more than once/u);
});

test('legacy private env upgrade stops before writing on ACL failure and is idempotent', (t) => {
  const state = createPrivateStateFixture(t);
  const existingAdminKey = 'b'.repeat(64);
  const original = `ADMIN_OPS_AUDIT_CURSOR_KEY=${existingAdminKey}\n`;
  fs.writeFileSync(state.envFile, original, { mode: 0o600 });
  let events = 0;
  const noAclChange = () => {};
  const recordEvent = () => { events += 1; };

  assert.throws(() => upgradePrivateCursorSecrets(state, {
    securePermissions: () => { throw new Error('ACL normalization denied'); },
    checkPermissions: noAclChange,
    recordEvent
  }), /ACL normalization denied/u);
  assert.equal(fs.readFileSync(state.envFile, 'utf8'), original);
  assert.equal(events, 0);

  const first = upgradePrivateCursorSecrets(state, {
    securePermissions: noAclChange, checkPermissions: noAclChange, recordEvent
  });
  const once = fs.readFileSync(state.envFile, 'utf8');
  assert.deepEqual(first, ['SOCIAL_MODERATION_CURSOR_KEY']);
  assert(once.includes(`ADMIN_OPS_AUDIT_CURSOR_KEY=${existingAdminKey}`));
  assert.match(once, /^SOCIAL_MODERATION_CURSOR_KEY=[a-f0-9]{64}$/mu);
  assert.equal(events, 1);

  assert.deepEqual(upgradePrivateCursorSecrets(state, {
    securePermissions: noAclChange, checkPermissions: noAclChange, recordEvent
  }), []);
  assert.equal(fs.readFileSync(state.envFile, 'utf8'), once);
  assert.equal(events, 2);
});

test('Windows private ACL normalization scopes targets and is repeatable', (t) => {
  const state = createPrivateStateFixture(t);
  const currentSid = 'S-1-5-21-1664622630-3508898563-4267833488-500';
  const scripts = [];
  const runPowerShell = (_program, args) => {
    scripts.push(args.at(-1));
    const paths = [state.tempDir, state.stateFile, state.envFile, state.keyFile, state.overrideFile];
    const aceSids = [currentSid, 'S-1-5-18', 'S-1-5-32-544'].sort();
    return {
      status: 0,
      stdout: JSON.stringify({ currentSid, targets: paths.map((targetPath) => ({
        path: targetPath, ownerSid: currentSid, aceSids
      })) })
    };
  };
  assert.doesNotThrow(() => securePrivateTempPermissions(state, { platform: 'win32', runPowerShell }));
  assert.doesNotThrow(() => securePrivateTempPermissions(state, { platform: 'win32', runPowerShell }));
  assert.equal(scripts.length, 2);
  assert.equal(scripts[0], scripts[1]);
  assert.match(scripts[0], /icacls\.exe/u);
  assert.match(scripts[0], /\/inheritance:r/u);
  assert.match(scripts[0], /S-1-5-18/u);
  assert.match(scripts[0], /S-1-5-32-544/u);
  assert.doesNotMatch(scripts[0], /S-1-5-21-1664622630-3508898563-4267833488-1001/u);
});

test('Windows PowerShell ACL normalization writes exactly three private ACEs and is idempotent', (t) => {
  if (process.platform !== 'win32') {
    t.skip('requires Windows PowerShell and NTFS ACLs');
    return;
  }
  const state = createPrivateStateFixture(t);
  const first = securePrivateTempPermissions(state);
  const second = securePrivateTempPermissions(state);
  const expectedSids = [first.currentSid, 'S-1-5-18', 'S-1-5-32-544'].sort();
  assert.equal(first.targets.length, 5);
  assert.deepEqual(second, first);
  for (const target of first.targets) {
    assert.equal(target.ownerSid, first.currentSid);
    assert.deepEqual(target.aceSids, expectedSids);
  }
  assert.doesNotThrow(() => assertPrivateTempPermissions(state));
});

test('Batch16 candidate command prepares six mappings without invoking Docker or Compose', () => {
  const state = {
    overrideFile: 'C:/private/docker-compose.isolated.yml',
    replacementImages: {
      'api-gateway': 'cloudstudy-clyunedev/api-gateway:prior',
      'iam-service': 'cloudstudy-clyunedev/iam-service:prior',
      'learner-web': 'cloudstudy-clyunedev/learner-web:prior',
      'mobile-h5': 'cloudstudy-clyunedev/mobile-h5:prior'
    }
  };
  const calls = [];
  const result = useBatch16Candidates(state, batch16Tag, {
    upgradeSecrets: () => calls.push(['upgradeSecrets']),
    prepareCandidates: (value, releaseTag) => prepareBatch16Candidates(value, releaseTag, {
      readOverride: () => 'services:\n',
      writeOverride: (file, contents) => calls.push(['writeOverride', file, contents]),
      persistState: (next) => calls.push(['persistState', next.batch16CandidateServices]),
      recordEvent: (_next, name) => calls.push(['recordEvent', name])
    })
  });

  assert.deepEqual(Object.keys(result.images), BATCH16_CANDIDATE_SERVICES);
  assert.deepEqual(state.batch16CandidateServices, BATCH16_CANDIDATE_SERVICES);
  assert.deepEqual(BATCH16_CANDIDATE_SERVICES.map((service) => state.replacementImages[service]),
    BATCH16_CANDIDATE_SERVICES.map((service) => result.images[service]));
  assert.equal((result.override.match(/ports: !reset \[\]/gu) || []).length, 6);
  assert.deepEqual(calls.map(([name]) => name), [
    'upgradeSecrets', 'writeOverride', 'persistState', 'recordEvent'
  ]);
  assert.doesNotMatch(useBatch16Candidates.toString(), /\b(?:compose|docker)\s*\(/iu);
  assert.doesNotMatch(useBatch16Candidates.toString(), /\b(?:up|run)\s*['"`]/iu);
  assert.doesNotMatch(prepareBatch16Candidates.toString(), /\b(?:compose|docker)\s*\(/iu);
  assert.doesNotMatch(prepareBatch16Candidates.toString(), /\b(?:up|run)\s*['"`]/iu);
});

test('Batch17 tag maps the exact four candidate images with no migration service', () => {
  assert.deepEqual(BATCH17_CANDIDATE_SERVICES,
    ['official-site', 'content-service', 'learner-web', 'mobile-h5']);
  assert.equal(BATCH17_CANDIDATE_SERVICES.includes('mysql-migrate'), false);
  assert.equal(BATCH17_CANDIDATE_SERVICES.includes('content-service'), true,
    'content-service is included only behind the verified V22 and disabled-Flyway preflight');
  assert.deepEqual(batch17CandidateImages(batch17Tag), Object.fromEntries(
    BATCH17_CANDIDATE_SERVICES.map((service) => [service,
      `cloudstudy-clyunedev/${service}:${batch17Tag}`])));
  assert.deepEqual(batch17ComposeArgs(), [
    'up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--force-recreate',
    'official-site', 'content-service', 'learner-web', 'mobile-h5'
  ]);
  assert.throws(() => batch17ComposeArgs(['official-site', 'learner-web', 'mobile-h5']),
    /exact approved service set/u);
  assert.throws(() => batch17CandidateImages('583ab627-uat-batch16-202609250002'), /Batch17 release tag/u);
  assert.throws(() => batch17CandidateImages('583ab627-uat-batch17-202609241645'), /Batch17 release tag/u);
});

test('Batch17 content-service preflight requires Flyway off and the exact applied V22 SHA-256', () => {
  const expectedChecksum = contentV22Checksum();
  assert.match(expectedChecksum, /^[a-f0-9]{64}$/u);
  assert.deepEqual(assertBatch17ContentV22Evidence({
    flywayEnabled: 'false', rows: [{ version: 22, checksum: expectedChecksum }]
  }), { version: 22, checksum: expectedChecksum, flywayEnabled: 'false' });
  assert.throws(() => assertBatch17ContentV22Evidence({
    flywayEnabled: 'true', rows: [{ version: 22, checksum: expectedChecksum }]
  }), /Flyway must stay disabled/u);
  assert.throws(() => assertBatch17ContentV22Evidence({
    flywayEnabled: 'false', rows: []
  }), /exactly one V22 history row/u);
  assert.throws(() => assertBatch17ContentV22Evidence({
    flywayEnabled: 'false', rows: [{ version: 22, checksum: '0'.repeat(64) }]
  }), /differs from the current repository migration/u);
  assert.throws(() => assertBatch17ContentV22Evidence({
    flywayEnabled: 'false', rows: [
      { version: 22, checksum: expectedChecksum }, { version: 22, checksum: expectedChecksum }
    ]
  }), /exactly one V22 history row/u);
});

test('Batch17 metadata preparation updates only the exact private service mapping and preserves Batch16 migration state', () => {
  const state = batch17StateFixture();
  const migration = structuredClone(state.batch16Migration);
  const before = batch17SnapshotFixture();
  const images = batch17CandidateImages(batch17Tag);
  const imageIds = Object.fromEntries(BATCH17_CANDIDATE_SERVICES.map((service, index) => [service,
    `sha256:${String(100 + index).padStart(64, '0')}`]));
  const calls = [];
  const prepared = prepareBatch17CandidateMetadata(state, batch17Tag, {
    images, imageIds, beforeSnapshot: before,
    contentV22Evidence: { version: 22, checksum: contentV22Checksum(), flywayEnabled: 'false' },
    readOverride: () => 'services:\n  official-site:\n    ports: !reset []\n',
    writeOverride: (_file, text) => calls.push(['writeOverride', text]),
    persistState: (next) => calls.push(['persistState', next.batch17CandidateServices])
  });

  assert.deepEqual(Object.keys(prepared.images), BATCH17_CANDIDATE_SERVICES);
  assert.deepEqual(Object.keys(state.batch17CandidateImages), BATCH17_CANDIDATE_SERVICES);
  assert.deepEqual(state.batch16Migration, migration);
  assert.deepEqual(state.batch16CandidateServices, ['official-site', 'learner-web', 'admin-web', 'mobile-h5',
    'admin-ops-service', 'mysql-migrate']);
  assert.deepEqual(state.batch16CandidateImages, { 'admin-ops-service': 'cloudstudy-clyunedev/admin-ops-service:batch16' });
  assert.deepEqual(BATCH17_CANDIDATE_SERVICES.map((service) => state.replacementImages[service]),
    BATCH17_CANDIDATE_SERVICES.map((service) => images[service]));
  assert.equal((prepared.override.match(/ports: !reset \[\]/gu) || []).length, 4);
  for (const service of BATCH17_CANDIDATE_SERVICES) {
    assert.equal(prepared.override.split(`  ${service}:`).length - 1, 1);
    assert(prepared.override.includes(`    image: ${images[service]}`));
  }
  assert.deepEqual(calls.map(([kind]) => kind), ['writeOverride', 'persistState']);
  assert.throws(() => prepareBatch17CandidateMetadata({ ...state, project: 'yuxuexing-local' }, batch17Tag, {
    images, imageIds, beforeSnapshot: before,
    contentV22Evidence: { version: 22, checksum: contentV22Checksum(), flywayEnabled: 'false' }
  }), /can only promote candidates in cloudstudy-uat-isolated-3c94b27160/u);
  assert.throws(() => prepareBatch17CandidateMetadata(state, batch17Tag, {
    images: { ...images, 'admin-web': 'cloudstudy-clyunedev/admin-web:unexpected' },
    imageIds, beforeSnapshot: before,
    contentV22Evidence: { version: 22, checksum: contentV22Checksum(), flywayEnabled: 'false' }
  }), /exactly the approved service set/u);
  assert.throws(() => prepareBatch17CandidateMetadata(batch17StateFixture(), batch17Tag, {
    images, imageIds: { ...imageIds, 'official-site': before['official-site'].imageId }, beforeSnapshot: before,
    contentV22Evidence: { version: 22, checksum: contentV22Checksum(), flywayEnabled: 'false' }
  }), /not newly built/u);
});

test('Batch17 private snapshot requires exactly 26 project-local containers without host ports', () => {
  const snapshot = batch17SnapshotFixture();
  assert.equal(Object.keys(snapshot).length, 26);
  assert.doesNotThrow(() => assertBatch17PrivateSnapshot(snapshot));
  const published = structuredClone(snapshot);
  published['content-service'].portBindings = { '18089/tcp': [{ HostPort: '18089' }] };
  assert.throws(() => assertBatch17PrivateSnapshot(published), /publishes a host port/u);
  const sharedNetwork = structuredClone(snapshot);
  sharedNetwork['learner-web'].networks = ['yuxuexing-local'];
  assert.throws(() => assertBatch17PrivateSnapshot(sharedNetwork), /unexpected network/u);
  const extraService = { ...snapshot, 'unexpected-service': snapshot.mysql };
  assert.throws(() => assertBatch17PrivateSnapshot(extraService), /exactly the 26/u);
});

test('Batch17 promotes only four new images and preserves all non-target containers, shared fingerprint, and Batch16 state', () => {
  const state = batch17StateFixture();
  const migrationBefore = structuredClone(state.batch16Migration);
  const current = batch17SnapshotFixture();
  const imageIds = Object.fromEntries(BATCH17_CANDIDATE_SERVICES.map((service, index) => [service,
    `sha256:${String(200 + index).padStart(64, '0')}`]));
  const { deps, calls } = batch17TestDependencies(state, current, imageIds);
  const result = useBatch17Candidates(state, batch17Tag, deps);

  assert.deepEqual(calls.apply, [BATCH17_CANDIDATE_SERVICES]);
  assert.deepEqual(calls.events.map(({ name }) => name), ['isolated-batch17-services-applied']);
  assert.deepEqual(calls.events[0].details.services, BATCH17_CANDIDATE_SERVICES);
  assert.equal(calls.persists, 1);
  assert.equal(calls.validations, 2);
  assert.equal(calls.migrationChecks, 1);
  assert.equal(calls.writes.length, 1);
  assert.deepEqual(state.batch16Migration, migrationBefore);
  assert.deepEqual(state.batch16CandidateServices, ['official-site', 'learner-web', 'admin-web', 'mobile-h5',
    'admin-ops-service', 'mysql-migrate']);
  assert.deepEqual(Object.keys(result.images), BATCH17_CANDIDATE_SERVICES);
  assert.deepEqual(Object.keys(result.after), BATCH17_PRIVATE_SERVICES);
  assert.equal(useBatch17Candidates.toString().includes('mysql-migrate'), false);
});

test('Batch17 resumes a partial private Compose promotion using its saved image IDs and before snapshot', () => {
  const state = batch17StateFixture();
  const current = batch17SnapshotFixture();
  const migrationBefore = structuredClone(state.batch16Migration);
  const imageIds = Object.fromEntries(BATCH17_CANDIDATE_SERVICES.map((service, index) => [service,
    `sha256:${String(300 + index).padStart(64, '0')}`]));
  let attempts = 0;
  const { deps, calls } = batch17TestDependencies(state, current, imageIds, {
    applyServices: (_value, services) => {
      attempts += 1;
      const initial = attempts === 1 ? services.slice(0, 2) : services;
      for (const service of initial) {
        current[service] = { ...current[service], containerId: `container-${service}-batch17`,
          imageId: imageIds[service], status: 'running' };
      }
      if (attempts === 1) throw new Error('simulated private Compose interruption');
    }
  });

  assert.throws(() => useBatch17Candidates(state, batch17Tag, deps), /simulated private Compose interruption/u);
  assert.deepEqual(state.batch16Migration, migrationBefore);
  assert.equal(calls.persists, 1);
  const resumed = useBatch17Candidates(state, batch17Tag, deps);
  assert.equal(attempts, 2);
  assert.equal(calls.persists, 1, 'retry must reuse the original Batch17 baseline');
  assert.equal(calls.migrationChecks, 2, 'retry revalidates the private V22 history');
  assert.deepEqual(resumed.after['official-site'].imageId, imageIds['official-site']);
  assert.deepEqual(state.batch16Migration, migrationBefore);
});

test('Batch17 rejects a changed shared fingerprint or any non-target container replacement', () => {
  const make = () => {
    const state = batch17StateFixture();
    const current = batch17SnapshotFixture();
    const imageIds = Object.fromEntries(BATCH17_CANDIDATE_SERVICES.map((service, index) => [service,
      `sha256:${String(400 + index).padStart(64, '0')}`]));
    return { state, current, imageIds };
  };
  {
    const { state, current, imageIds } = make();
    const deps = batch17TestDependencies(state, current, imageIds, {
      readSharedFingerprint: () => ({ containers: ['changed-shared-container'], network: 'shared-network-id' })
    }).deps;
    assert.throws(() => useBatch17Candidates(state, batch17Tag, deps), /shared Docker fingerprint changed/u);
    assert.equal(Object.hasOwn(state, 'batch17CandidateServices'), false);
  }
  {
    const { state, current, imageIds } = make();
    const deps = batch17TestDependencies(state, current, imageIds, {
      applyServices: (_value, services) => {
        for (const service of services) current[service] = { ...current[service],
          containerId: `container-${service}-batch17`, imageId: imageIds[service], status: 'running' };
        current['admin-web'].containerId = 'unexpected-admin-container';
      }
    }).deps;
    assert.throws(() => useBatch17Candidates(state, batch17Tag, deps), /changed outside the exact Batch17/u);
    assert.deepEqual(state.batch16Migration, batch17MigrationFixture());
  }
});

test('Batch16 migration gate updates touch only their two explicit private env entries', () => {
  const secret = 'private-secret-must-survive';
  const content = `ADMIN_OPS_AUDIT_CURSOR_KEY=${secret}\nP1R_EXTERNAL_MIGRATION_WRITERS_DRAINED=false\nP1R_EXTERNAL_MIGRATION_BACKUP_READY=false\n`;
  const enabled = updateBatch16MigrationGateContent(content, {
    P1R_EXTERNAL_MIGRATION_WRITERS_DRAINED: 'true',
    P1R_EXTERNAL_MIGRATION_BACKUP_READY: 'true'
  });
  assert(enabled.includes(`ADMIN_OPS_AUDIT_CURSOR_KEY=${secret}`));
  assert(enabled.includes('P1R_EXTERNAL_MIGRATION_WRITERS_DRAINED=true'));
  assert(enabled.includes('P1R_EXTERNAL_MIGRATION_BACKUP_READY=true'));
  assert.equal(updateBatch16MigrationGateContent(enabled, {
    P1R_EXTERNAL_MIGRATION_WRITERS_DRAINED: 'false',
    P1R_EXTERNAL_MIGRATION_BACKUP_READY: 'false'
  }).includes(`ADMIN_OPS_AUDIT_CURSOR_KEY=${secret}`), true);
  assert.throws(() => updateBatch16MigrationGateContent(`${content}${content}`, {
    P1R_EXTERNAL_MIGRATION_WRITERS_DRAINED: 'true',
    P1R_EXTERNAL_MIGRATION_BACKUP_READY: 'true'
  }), /must appear exactly once/u);
});

test('Batch16 preflight needs only a backup and drained writers; later stages remain gated', () => {
  const migration = { preflightPassed: false, applyPassed: false, verifyPassed: false,
    writersRestored: false };
  assert.doesNotThrow(() => assertBatch16StageFlags(migration, 'preflight'));
  assert.throws(() => assertBatch16StageFlags(migration, 'apply'), /preflight must pass/u);
  migration.preflightPassed = true;
  assert.doesNotThrow(() => assertBatch16StageFlags(migration, 'apply'));
  assert.throws(() => assertBatch16StageFlags(migration, 'verify'), /apply must pass/u);
  migration.applyPassed = true;
  assert.doesNotThrow(() => assertBatch16StageFlags(migration, 'verify'));
  assert.throws(() => assertBatch16StageFlags(migration, 'restore'), /verify must pass/u);
  migration.verifyPassed = true;
  migration.adminOpsV5 = { version: 5 };
  assert.doesNotThrow(() => assertBatch16StageFlags(migration, 'restore'));
  assert.throws(() => assertBatch16StageFlags(migration, 'services'), /must be restored first/u);
});

test('Batch16 owner restore starts exact original IDs without Compose dependencies', () => {
  const state = { batch16Migration: { writers: { containers: {
    'learner-service': { containerId: 'original-learner' },
    'content-service': { containerId: 'original-content' }
  } } } };
  const calls = [];
  const runDocker = (...args) => calls.push(args);
  startBatch16OriginalContainers(state, ['learner-service', 'content-service'], runDocker);
  assert.deepEqual(calls, [[['start', 'original-learner', 'original-content'], { timeout: 600000 }]]);
  assert.throws(() => startBatch16OriginalContainers(state, ['admin-ops-service'], runDocker),
    /original container ID is missing/u);
  assert.equal(calls.length, 1);
});

test('Batch16 owner restore retries readiness with original running containers and records only healthy owners', () => {
  const ownerServices = [
    'iam-service', 'audit-service', 'workflow-service', 'learner-service',
    'content-service', 'learning-service', 'assessment-service', 'media-service',
    'notification-service', 'gamification-service', 'social-service', 'commerce-service',
    'admin-ops-service', 'analytics-service'
  ];
  const nonTargetServices = ownerServices.filter((service) => !BATCH16_APPLY_SERVICES.includes(service));
  const current = Object.fromEntries(ownerServices.map((service, index) => [service, {
    containerId: `container-${service}`,
    imageId: `image-${service}`,
    status: service === 'admin-ops-service' ? 'exited' : (index < 3 ? 'running' : 'exited')
  }]));
  const state = {
    sharedBefore: { containers: ['shared-container'], network: 'shared-network' },
    batch16Migration: {
      writersDrained: true,
      writers: { containers: Object.fromEntries(ownerServices.map((service) => [service, {
        containerId: current[service].containerId,
        imageId: current[service].imageId
      }])) },
      writersRestored: false
    }
  };
  const composeCalls = [];
  const records = [];
  let readinessAttempts = 0;
  const dependencies = {
    assertStage: () => {},
    snapshot: () => structuredClone(current),
    startServices: (_state, services) => {
      composeCalls.push([...services]);
      assert(!services.includes('admin-ops-service'));
      for (const service of services) current[service].status = 'running';
    },
    probeOwners: (_state, services) => {
      readinessAttempts += 1;
      if (readinessAttempts === 1) throw new Error('readiness not ready yet');
      return services.map((name) => ({ name, status: 200 }));
    },
    readBaseline: () => structuredClone(state.sharedBefore),
    recordEvent: (_state, name) => records.push(name)
  };

  assert.throws(() => restoreBatch16NonTargetOwners(state, dependencies), /readiness not ready yet/u);
  assert.equal(state.batch16Migration.writersRestored, false);
  assert.equal(Object.hasOwn(state.batch16Migration, 'restoredContainers'), false);
  assert.deepEqual(records, []);

  const readiness = restoreBatch16NonTargetOwners(state, dependencies);
  assert.deepEqual(composeCalls, [nonTargetServices.filter((service) => service !== ownerServices[0]
    && service !== ownerServices[1] && service !== ownerServices[2])]);
  assert.equal(readiness.length, nonTargetServices.length);
  assert.equal(state.batch16Migration.writersRestored, true);
  assert.deepEqual(Object.keys(state.batch16Migration.restoredContainers).sort(), [...nonTargetServices].sort());
  assert.deepEqual(records, ['batch16-non-target-owners-restored']);
  assert.equal(current['admin-ops-service'].status, 'exited');

  current['admin-ops-service'].status = 'running';
  assert.throws(() => restoreBatch16NonTargetOwners(state, dependencies), /old admin-ops-service must remain stopped/u);
  assert.equal(composeCalls.length, 1);
});

test('Batch16 evidence paths include its suffix and candidate date', () => {
  const state = { replacementImages: {
    'official-site': `cloudstudy-clyunedev/official-site:${batch16Tag}`
  } };
  const base = path.resolve('C:/workspace');
  assert.equal(batchEvidenceSuffix(state.replacementImages), '-batch16');
  assert.equal(evidenceDate(state.replacementImages), '2026-09-25');
  assert.equal(batchEvidenceFilePath(state, 'docker-isolated-stack-probe.json', base),
    path.join(base, 'artifacts', 'uat-2026-09-25', 'docker-isolated-stack-probe-batch16.json'));
  assert.equal(browserEvidenceDirectory(state, base),
    path.join(base, 'artifacts', 'uat-2026-09-25', 'docker-isolated-browser-batch16'));
  const batch15 = { replacementImages: {
    'official-site': 'cloudstudy-clyunedev/official-site:583ab627-uat-batch15-202609231430'
  } };
  assert.notEqual(batchEvidenceFilePath(state, 'docker-isolated-stack-probe.json', base),
    batchEvidenceFilePath(batch15, 'docker-isolated-stack-probe.json', base));
});

test('private Compose guard rejects host ports and shared volumes', () => {
  const project = 'cloudstudy-uat-isolated-0123456789';
  const state = { project, keyFile: 'C:/private/iam.pem' };
  const config = () => ({
    name: project,
    networks: { clyunedev: { name: project, internal: true } },
    volumes: {
      'clyunedev-mysql': { name: `${project}-mysql` },
      'clyunedev-redis': { name: `${project}-redis` },
      'clyunedev-minio': { name: `${project}-minio` },
      'clyunedev-kafka': { name: `${project}-kafka` }
    },
    services: {
      'admin-ops-service': { networks: { clyunedev: {} }, ports: [], volumes: [] },
      'mysql-migrate': { networks: { clyunedev: {} }, ports: [], volumes: [] }
    }
  });

  assert.doesNotThrow(() => assertPrivateComposeIsolation(state, config()));
  const published = config();
  published.services['admin-ops-service'].ports = [{ target: 18097, published: '18097' }];
  assert.throws(() => assertPrivateComposeIsolation(state, published), /publishes a host port/u);
  const sharedVolume = config();
  sharedVolume.volumes['clyunedev-mysql'].name = 'clyunedev-mysql';
  sharedVolume.services['mysql-migrate'].volumes = [{ type: 'volume', source: 'clyunedev-mysql' }];
  assert.throws(() => assertPrivateComposeIsolation(state, sharedVolume), /shared volume/u);
});
