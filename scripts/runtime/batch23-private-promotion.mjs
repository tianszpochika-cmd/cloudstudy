#!/usr/bin/env node
// Private, resumable Batch23 promotion. No database writes or shared-project commands.
import assert from 'node:assert/strict';
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
  batch18CandidateImages, batch18OverrideText
} from './batch18-private-site-promotion.mjs';
import {
  BATCH19_RECEIPT, BATCH19_OVERRIDE, BATCH19_RELEASE_TAG,
  batch19ReadinessTargets
} from './batch19-private-promotion.mjs';
import {
  BATCH20_IMAGE_IDS, BATCH20_OVERRIDE, BATCH20_RECEIPT, BATCH20_RELEASE_TAG,
  BATCH20_SERVICES, batch20CandidateImages, batch20OverrideText
} from './batch20-private-promotion.mjs';
import {
  BATCH21_IMAGE_IDS, BATCH21_OVERRIDE, BATCH21_RECEIPT, BATCH21_RELEASE_TAG,
  BATCH21_SERVICES, assertBatch21ImageIdsReady, batch21CandidateImages, batch21OverrideText
} from './batch21-private-promotion.mjs';
import {
  BATCH22_IMAGE_IDS, BATCH22_OVERRIDE, BATCH22_RECEIPT, BATCH22_RELEASE_TAG,
  BATCH22_SERVICES, assertBatch22ImageIdsReady, assertBatch22Progress,
  batch22CandidateImages, batch22OverrideText
} from './batch22-private-promotion.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BATCH23_PROJECT = BATCH18_PROJECT;
export const BATCH23_RELEASE_TAG = '583ab627-uat-batch23-20260925';
export const BATCH23_SERVICES = Object.freeze(['learner-web', 'mobile-h5']);
export const BATCH23_ORDER = Object.freeze(['learner-web', 'mobile-h5']);
export const BATCH23_RECEIPT = 'batch23-private-promotion.json';
export const BATCH23_OVERRIDE = 'docker-compose.batch23-promotion.yml';
export const BATCH23_ROLLBACK_OVERRIDE = 'docker-compose.batch23-rollback.yml';
export const BATCH23_IMAGE_IDS = Object.freeze({
  'learner-web': 'sha256:81eb110756edf6cdba48d517ae5de90c7a13952114836be087ceecf7770e0369',
  'mobile-h5': 'sha256:5205ac29584eec33fbeee69430472c6dba2320913de41d6202238477fadb30d9'
});
const phases = Object.freeze(['preflighted', 'promoting', 'promoted', 'verified', 'rolling-back', 'rolled-back']);

function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function samePath(a, b) {
  const left = fs.existsSync(a) ? fs.realpathSync(a) : path.resolve(a);
  const right = fs.existsSync(b) ? fs.realpathSync(b) : path.resolve(b);
  return process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
}
function within(base, target) {
  const canonicalBase = fs.realpathSync(base); const canonicalTarget = fs.realpathSync(target);
  const relative = path.relative(canonicalBase, canonicalTarget);
  assert(relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative),
    'Batch23 state escaped its private temporary directory');
  return canonicalTarget;
}
function pathsFor(state) {
  const tempDir = path.resolve(state.tempDir || '');
  return {
    tempDir, stateFile: path.join(tempDir, 'state.json'), envFile: path.join(tempDir, 'uat.env'),
    keyFile: path.join(tempDir, 'iam-rsa-private.pem'), base: path.join(tempDir, 'docker-compose.isolated.yml'),
    v17: path.join(tempDir, BATCH18_V17_RECEIPT), b18: path.join(tempDir, BATCH18_RECEIPT),
    b18Override: path.join(tempDir, BATCH18_OVERRIDE), b19: path.join(tempDir, BATCH19_RECEIPT),
    b19Override: path.join(tempDir, BATCH19_OVERRIDE), b20: path.join(tempDir, BATCH20_RECEIPT),
    b20Override: path.join(tempDir, BATCH20_OVERRIDE), b21: path.join(tempDir, BATCH21_RECEIPT),
    b21Override: path.join(tempDir, BATCH21_OVERRIDE), b22: path.join(tempDir, BATCH22_RECEIPT),
    b22Override: path.join(tempDir, BATCH22_OVERRIDE), receipt: path.join(tempDir, BATCH23_RECEIPT),
    override: path.join(tempDir, BATCH23_OVERRIDE), rollback: path.join(tempDir, BATCH23_ROLLBACK_OVERRIDE)
  };
}
function readJson(file, label) {
  const info = fs.lstatSync(file);
  assert(info.isFile() && !info.isSymbolicLink(), label + ' must be a private regular file');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJson(file, value) {
  const temporary = file + '.' + process.pid + '.tmp';
  const fd = fs.openSync(temporary, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(temporary, file);
}
function ensureFile(file, text) {
  if (fs.existsSync(file)) {
    const info = fs.lstatSync(file);
    assert(info.isFile() && !info.isSymbolicLink());
    assert.equal(fs.readFileSync(file, 'utf8'), text, path.basename(file) + ' differs from approved content');
    return;
  }
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, text); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

export function batch23CandidateImages(tag = BATCH23_RELEASE_TAG) {
  assert.equal(tag, BATCH23_RELEASE_TAG, 'Batch23 release tag differs from approved tag');
  return Object.fromEntries(BATCH23_SERVICES.map((service) =>
    [service, `cloudstudy-clyunedev/${service}:${tag}`]));
}
export function assertBatch23ImageIdsReady(imageIds = BATCH23_IMAGE_IDS) {
  assert.deepEqual(Object.keys(imageIds || {}).sort(), [...BATCH23_SERVICES].sort(),
    'Batch23 image IDs must cover exactly learner-web and mobile-h5');
  for (const service of BATCH23_SERVICES) {
    assert.match(imageIds[service] || '', /^sha256:[a-f0-9]{64}$/u,
      `Batch23 ${service} image ID is not filled from the built candidate image`);
  }
  return imageIds;
}
export function batch23OverrideText(images = batch23CandidateImages()) {
  assert.deepEqual(Object.keys(images).sort(), [...BATCH23_SERVICES].sort(),
    'Batch23 overlay must contain exactly its two approved services');
  const approved = batch23CandidateImages();
  for (const service of BATCH23_SERVICES) assert.equal(images[service], approved[service]);
  return 'services:\n' + BATCH23_SERVICES.map((service) =>
    `  ${service}:\n    image: ${images[service]}\n`).join('');
}
export function batch23RollbackOverrideText(baselineImages) {
  assert.deepEqual(Object.keys(baselineImages || {}).sort(), [...BATCH23_SERVICES].sort(),
    'rollback overlay must contain exactly the two recorded baseline images');
  for (const service of BATCH23_SERVICES) assert.match(baselineImages[service] || '',
    new RegExp(`^cloudstudy-clyunedev/${service}:[A-Za-z0-9._-]+$`, 'u'));
  return 'services:\n' + BATCH23_SERVICES.map((service) =>
    `  ${service}:\n    image: ${baselineImages[service]}\n`).join('');
}
export function batch23ComposeArgs(service) {
  assert(BATCH23_SERVICES.includes(service), 'Batch23 may replace only learner-web and mobile-h5');
  return ['up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--force-recreate', service];
}
export function assertBatch23Baseline(current, batch22) {
  assert.equal(batch22?.project, BATCH23_PROJECT);
  assert.equal(batch22?.phase, 'verified', 'Batch22 must be verified before Batch23');
  assert.equal(batch22.releaseTag, BATCH22_RELEASE_TAG);
  assert.deepEqual(batch22.services, [...BATCH22_SERVICES]);
  assert.deepEqual(batch22.images, batch22CandidateImages());
  assert.deepEqual(batch22.imageIds, BATCH22_IMAGE_IDS);
  assertBatch22ImageIdsReady(batch22.imageIds);
  assert(batch22.baselineSnapshot, 'Batch22 baseline container snapshot is missing');
  assert(batch22.verifiedSnapshot, 'Batch22 verified container snapshot is missing');
  assert.deepEqual(batch22.baselineImageIds, Object.fromEntries(BATCH22_SERVICES.map((service) =>
    [service, batch22.baselineSnapshot[service].imageId])));
  for (const service of BATCH22_SERVICES) {
    assert.equal(batch22.verifiedSnapshot[service].imageId, BATCH22_IMAGE_IDS[service],
      service + ' verified Batch22 image ID differs');
    assert.notEqual(batch22.verifiedSnapshot[service].containerId,
      batch22.baselineSnapshot[service].containerId, service + ' verified Batch22 container was not recreated');
    assert.equal(batch22.verifiedSnapshot[service].status, 'running', service + ' verified Batch22 service is not running');
  }
  assert.equal(batch22.readinessPassed, 19, 'Batch22 must record 19/19 readiness');
  assert.equal((batch22.readinessResults || []).length, 19);
  assert((batch22.readinessResults || []).every((item) => item.status === 200));
  assert.equal(batch22.proxyRefreshedForPhase, 'promoted', 'Batch22 private proxy must be refreshed');
  assertBatch22Progress(batch22.verifiedSnapshot, batch22);
  assertBatch17PrivateSnapshot(current, BATCH23_PROJECT);
  assert.deepEqual(current, batch22.verifiedSnapshot,
    'Batch23 source container/image IDs must exactly match the Batch22 verified snapshot');
  return current;
}
export function assertBatch23Plan(baseline, candidate, rollback, images, baselineImages) {
  const services = [...BATCH17_PRIVATE_SERVICES].sort();
  assert.deepEqual(Object.keys(baseline.services || {}).sort(), services);
  assert.deepEqual(Object.keys(candidate.services || {}).sort(), services);
  assert.deepEqual(Object.keys(rollback.services || {}).sort(), services);
  assert.deepEqual(Object.keys(images || {}).sort(), [...BATCH23_SERVICES].sort());
  assert.deepEqual(Object.keys(baselineImages || {}).sort(), [...BATCH23_SERVICES].sort());
  for (const service of services) {
    if (BATCH23_SERVICES.includes(service)) {
      assert.equal(candidate.services[service].image, images[service], service + ' candidate image differs');
      assert.equal(rollback.services[service].image, baselineImages[service], service + ' rollback image differs');
    } else {
      assert.equal(candidate.services[service].image, baseline.services[service].image,
        service + ' changed outside Batch23');
      assert.equal(rollback.services[service].image, baseline.services[service].image,
        service + ' rollback changed outside Batch23');
    }
  }
  return true;
}
export function assertBatch23Progress(current, receipt, { allowUnhealthyCandidate = false } = {}) {
  assertBatch17PrivateSnapshot(current, BATCH23_PROJECT);
  assertBatch17PrivateSnapshot(receipt.baselineSnapshot, BATCH23_PROJECT);
  for (const service of BATCH17_PRIVATE_SERVICES) {
    const actual = current[service]; const before = receipt.baselineSnapshot[service];
    if (!BATCH23_SERVICES.includes(service)) {
      assert.deepEqual(actual, before, service + ' changed outside Batch23');
      continue;
    }
    if (actual.imageId === before.imageId) {
      if (receipt.phase === 'rolling-back' || receipt.phase === 'rolled-back') {
        assert.equal(actual.imageId, receipt.baselineImageIds[service]);
        assert.equal(actual.status, 'running', service + ' restored baseline image is not running');
        if (actual.containerId !== before.containerId) {
          const recorded = (receipt.rolledBackServices || []).includes(service);
          if (recorded) {
            const recordedRollback = receipt.rolledBackSnapshot?.[service];
            assert(recordedRollback, service + ' rollback snapshot is missing');
            assert.equal(actual.containerId, recordedRollback.containerId,
              service + ' rollback container differs from receipt');
          } else {
            assert.equal(receipt.phase, 'rolling-back', service + ' unrecorded rollback container is not resumable');
            assert((receipt.rollbackInFlightServices || []).includes(service),
              service + ' rollback container is not recorded or covered by a durable rollback intent');
          }
        } else assert.deepEqual(actual, before, service + ' baseline container changed unexpectedly');
      } else assert.deepEqual(actual, before, service + ' baseline container changed unexpectedly');
    } else {
      assert.equal(actual.imageId, receipt.imageIds[service], service + ' runs an unapproved image');
      assert.notEqual(actual.containerId, before.containerId, service + ' candidate container was not recreated');
      assert(allowUnhealthyCandidate || actual.status === 'running', service + ' candidate is not running');
      const recorded = receipt.serviceSnapshots?.[service];
      if (recorded) assert.equal(actual.containerId, recorded.containerId, service + ' container differs from receipt');
    }
  }
  return current;
}
export function assertBatch23RollbackComplete(current, receipt) {
  assertBatch23Progress(current, receipt, { allowUnhealthyCandidate: true });
  assert.deepEqual(receipt.rollbackInFlightServices || [], [], 'rollback still has uncommitted service intents');
  for (const service of BATCH23_SERVICES) {
    assert.equal(current[service].imageId, receipt.baselineSnapshot[service].imageId,
      service + ' baseline image was not restored');
    assert.equal(current[service].status, 'running', service + ' baseline image is not running');
  }
  return current;
}

function validateContext(stateFile) {
  assert(stateFile, 'usage: node batch23-private-promotion.mjs <command> <private state.json>');
  const resolved = path.resolve(stateFile); const state = readJson(resolved, 'state.json');
  const paths = pathsFor(state);
  assert.equal(state.project, BATCH23_PROJECT, 'only the approved private UAT project is allowed');
  assert.equal(state.tag, '583ab627-uat-batch9-202609231740');
  assert.equal(state.batch17ReleaseTag, '583ab627-uat-batch17-202609250206');
  within(os.tmpdir(), paths.tempDir);
  assert(path.basename(paths.tempDir).startsWith(BATCH23_PROJECT + '-'));
  assert(samePath(resolved, paths.stateFile));
  for (const [key, target] of Object.entries({ stateFile: paths.stateFile, envFile: paths.envFile,
    keyFile: paths.keyFile, overrideFile: paths.base })) assert(samePath(state[key], target));
  for (const file of [paths.tempDir, paths.stateFile, paths.envFile, paths.keyFile, paths.base,
    paths.v17, paths.b18, paths.b18Override, paths.b19, paths.b19Override,
    paths.b20, paths.b20Override, paths.b21, paths.b21Override, paths.b22, paths.b22Override]) {
    const info = fs.lstatSync(file);
    assert(file === paths.tempDir ? info.isDirectory() && !info.isSymbolicLink()
      : info.isFile() && !info.isSymbolicLink(), 'private prerequisite path is invalid');
  }
  assertPrivateTempPermissions(state);
  const v17 = readJson(paths.v17, 'IAM V17 receipt'); const b18 = readJson(paths.b18, 'Batch18 receipt');
  const b19 = readJson(paths.b19, 'Batch19 receipt'); const b20 = readJson(paths.b20, 'Batch20 receipt');
  const b21 = readJson(paths.b21, 'Batch21 receipt'); const b22 = readJson(paths.b22, 'Batch22 receipt');
  assert.equal(v17.project, BATCH23_PROJECT); assert.equal(v17.phase, 'complete');
  assert.equal(v17.candidateImage, BATCH18_IAM_IMAGE);
  assert.equal(b18.project, BATCH23_PROJECT); assert.equal(b18.phase, 'verified');
  assert.equal(b18.releaseTag, BATCH18_RELEASE_TAG);
  assert.deepEqual(b18.images, batch18CandidateImages());
  assert.deepEqual(b18.beforeSharedFingerprint, state.sharedBefore);
  assert.equal(b19.project, BATCH23_PROJECT); assert(samePath(b19.stateFile, paths.stateFile));
  assert.equal(b19.releaseTag, BATCH19_RELEASE_TAG);
  assert.deepEqual(b19.beforeSharedFingerprint, state.sharedBefore);
  assert.equal(b20.project, BATCH23_PROJECT); assert(samePath(b20.stateFile, paths.stateFile));
  assert.equal(b20.phase, 'verified', 'Batch20 must be verified before Batch23');
  assert.equal(b20.releaseTag, BATCH20_RELEASE_TAG);
  assert.deepEqual(b20.services, [...BATCH20_SERVICES]);
  assert.deepEqual(b20.images, batch20CandidateImages());
  assert.deepEqual(b20.imageIds, BATCH20_IMAGE_IDS);
  assert.deepEqual(b20.beforeSharedFingerprint, state.sharedBefore);
  assert.deepEqual(b20.baselineSnapshot, b19.verifiedSnapshot,
    'Batch20 baseline must be the exact verified Batch19 snapshot');
  assertBatch17PrivateSnapshot(b20.verifiedSnapshot, BATCH23_PROJECT);
  assert.equal(b20.readinessPassed, 19);
  assert.equal((b20.readinessResults || []).length, 19);
  assert((b20.readinessResults || []).every((item) => item.status === 200));
  assert.equal(fs.readFileSync(paths.b20Override, 'utf8'), batch20OverrideText(b20.images));
  assert.equal(b20.officialSiteImage?.image, b18.images['official-site']);
  assert.equal(b20.officialSiteImage?.imageId, b18.imageIds['official-site']);
  assert.equal(b21.project, BATCH23_PROJECT); assert(samePath(b21.stateFile, paths.stateFile));
  assert.equal(b21.phase, 'verified', 'Batch21 must be verified before Batch23');
  assert.equal(b21.releaseTag, BATCH21_RELEASE_TAG);
  assert.deepEqual(b21.services, [...BATCH21_SERVICES]);
  assert.deepEqual(b21.images, batch21CandidateImages());
  assert.deepEqual(b21.imageIds, BATCH21_IMAGE_IDS);
  assertBatch21ImageIdsReady(b21.imageIds);
  assert.deepEqual(b21.beforeSharedFingerprint, state.sharedBefore);
  assert.deepEqual(b21.baselineSnapshot, b20.verifiedSnapshot,
    'Batch21 baseline must be the exact verified Batch20 snapshot');
  assert.deepEqual(b21.officialSiteImage, b20.officialSiteImage);
  assertBatch17PrivateSnapshot(b21.verifiedSnapshot, BATCH23_PROJECT);
  assert.equal(b21.baselineReadinessPassed, 19);
  assert.equal((b21.baselineReadinessResults || []).length, 19);
  assert((b21.baselineReadinessResults || []).every((item) => item.status === 200));
  assert.equal(fs.readFileSync(paths.b21Override, 'utf8'), batch21OverrideText(b21.images));
  assert.equal(b22.project, BATCH23_PROJECT); assert(samePath(b22.stateFile, paths.stateFile));
  assert.equal(b22.phase, 'verified', 'Batch22 must be verified before Batch23');
  assert.equal(b22.releaseTag, BATCH22_RELEASE_TAG);
  assert.deepEqual(b22.services, [...BATCH22_SERVICES]);
  assert.deepEqual(b22.images, batch22CandidateImages());
  assert.deepEqual(b22.imageIds, BATCH22_IMAGE_IDS);
  assertBatch22ImageIdsReady(b22.imageIds);
  assert.deepEqual(b22.beforeSharedFingerprint, state.sharedBefore);
  assert.deepEqual(b22.baselineSnapshot, b21.verifiedSnapshot,
    'Batch22 baseline must be the exact verified Batch21 snapshot');
  assert.deepEqual(b22.officialSiteImage, b21.officialSiteImage);
  assert.equal(b22.baselineReadinessPassed, 19);
  assert.equal((b22.baselineReadinessResults || []).length, 19);
  assert((b22.baselineReadinessResults || []).every((item) => item.status === 200));
  assert.equal(b22.readinessPassed, 19);
  assert.equal((b22.readinessResults || []).length, 19);
  assert((b22.readinessResults || []).every((item) => item.status === 200));
  assert.equal(b22.proxyRefreshedForPhase, 'promoted');
  assertBatch23Baseline(b22.verifiedSnapshot, b22);
  assert.equal(fs.readFileSync(paths.b22Override, 'utf8'), batch22OverrideText(b22.images));
  const batch23 = fs.existsSync(paths.receipt) ? readJson(paths.receipt, 'Batch23 receipt') : null;
  if (batch23) {
    validateReceipt(batch23, paths);
    assert.deepEqual(batch23.baselineSnapshot, b22.verifiedSnapshot,
      'Batch23 receipt must remain anchored to the Batch22 verified snapshot');
    assert.deepEqual(batch23.beforeSharedFingerprint, state.sharedBefore);
  }
  return { state, paths, v17, b18, b19, b20, b21, b22, receipt: batch23 };
}
function validateReceipt(receipt, paths) {
  assert.equal(receipt.format, 1); assert.equal(receipt.project, BATCH23_PROJECT);
  assert(samePath(receipt.stateFile, paths.stateFile));
  assert.equal(receipt.releaseTag, BATCH23_RELEASE_TAG);
  assert.deepEqual(receipt.services, [...BATCH23_SERVICES]);
  assert.deepEqual(receipt.images, batch23CandidateImages());
  assert.deepEqual(Object.keys(receipt.imageIds || {}).sort(), [...BATCH23_SERVICES].sort());
  for (const service of BATCH23_SERVICES) assert.equal(receipt.imageIds[service], BATCH23_IMAGE_IDS[service]);
  assertBatch23ImageIdsReady(receipt.imageIds);
  assert.deepEqual(Object.keys(receipt.baselineImages || {}).sort(), [...BATCH23_SERVICES].sort());
  assert.deepEqual(Object.keys(receipt.baselineImageIds || {}).sort(), [...BATCH23_SERVICES].sort());
  assert(phases.includes(receipt.phase));
  const rollbackInFlightServices = receipt.rollbackInFlightServices || [];
  assert(Array.isArray(rollbackInFlightServices), 'rollbackInFlightServices must be an array');
  assert(rollbackInFlightServices.every((service) => BATCH23_SERVICES.includes(service)),
    'rollbackInFlightServices contains an unapproved service');
  assert.equal(new Set(rollbackInFlightServices).size, rollbackInFlightServices.length,
    'rollbackInFlightServices contains duplicates');
  for (const file of [paths.override, paths.rollback]) {
    const info = fs.lstatSync(file);
    assert(info.isFile() && !info.isSymbolicLink(), 'Batch23 Compose overlays must be private regular files');
  }
  assert.equal(receipt.officialSiteImage?.image, batch18CandidateImages()['official-site']);
  assert.match(receipt.officialSiteImage?.imageId || '', /^sha256:[a-f0-9]{64}$/u);
  assert.equal(receipt.baselineReadinessPassed, 19);
  assert.equal((receipt.baselineReadinessResults || []).length, 19);
  assert((receipt.baselineReadinessResults || []).every((item) => item.status === 200));
  assertBatch17PrivateSnapshot(receipt.baselineSnapshot, BATCH23_PROJECT);
  for (const service of BATCH23_SERVICES) {
    assert.equal(receipt.baselineSnapshot[service].imageId, receipt.baselineImageIds[service]);
  }
  assert.equal(fs.readFileSync(paths.override, 'utf8'), batch23OverrideText(receipt.images));
  assert.equal(fs.readFileSync(paths.rollback, 'utf8'), batch23RollbackOverrideText(receipt.baselineImages));
  return receipt;
}

function docker(args, { output = false, timeout = 120000, input } = {}) {
  const result = spawnSync('docker', args, { cwd: root, env: safeEnv(), encoding: 'utf8', timeout,
    maxBuffer: 32 * 1024 * 1024, input, windowsHide: true });
  assert(!result.error && result.status === 0, 'private Batch23 Docker operation failed; output was suppressed');
  return output ? result.stdout.trim() : '';
}
function composeArgs(state, paths, overlays, args) {
  const files = ['compose', '-p', state.project, '--env-file', paths.envFile,
    '-f', path.join(root, 'infra/docker/clyunedev/docker-compose.core.yml'),
    '-f', path.join(root, 'infra/docker/clyunedev/docker-compose.full.yml'),
    '-f', paths.base, '-f', paths.b18Override, '-f', paths.b19Override,
    '-f', paths.b20Override, '-f', paths.b21Override, '-f', paths.b22Override];
  for (const overlay of overlays) files.push('-f', overlay);
  return [...files, ...args];
}
function compose(state, paths, overlays, args, options = {}) {
  return docker(composeArgs(state, paths, overlays, args), options);
}
function composeConfig(state, paths, overlayText = null, overlayFiles = []) {
  const args = composeArgs(state, paths, overlayFiles, []);
  if (overlayText !== null) args.push('-f', '-');
  args.push('config', '--format', 'json');
  return JSON.parse(docker(args, { output: true, input: overlayText ?? undefined }));
}
function imageId(image) {
  const items = JSON.parse(docker(['image', 'inspect', image], { output: true }));
  assert.equal(items.length, 1); assert((items[0].RepoTags || []).includes(image));
  assert.match(items[0].Id || '', /^sha256:[a-f0-9]{64}$/u);
  return items[0].Id;
}
function snapshot(state) {
  const ids = docker(['ps', '-a', '--filter', 'label=com.docker.compose.project=' + state.project,
    '--format', '{{.ID}}'], { output: true }).split(/\r?\n/u).filter(Boolean);
  assert.equal(ids.length, BATCH17_PRIVATE_SERVICES.length, 'private project must contain exactly 26 containers');
  const result = {};
  for (const item of JSON.parse(docker(['inspect', ...ids], { output: true }))) {
    assert.equal(item.Config.Labels['com.docker.compose.project'], BATCH23_PROJECT);
    const service = item.Config.Labels['com.docker.compose.service'];
    assert(service && !Object.hasOwn(result, service));
    result[service] = { containerId: item.Id, imageId: item.Image, status: item.State.Status,
      project: BATCH23_PROJECT, networks: Object.keys(item.NetworkSettings.Networks || {}).sort(),
      portBindings: item.HostConfig.PortBindings || {} };
  }
  return assertBatch17PrivateSnapshot(result, BATCH23_PROJECT);
}
function sharedFingerprint() {
  const containers = docker(['ps', '-a', '--filter', 'name=^/yuxuexing-local-',
    '--format', '{{.ID}}|{{.Names}}'], { output: true }).split(/\r?\n/u).filter(Boolean).sort();
  const network = docker(['network', 'inspect', 'yuxuexing-local_yuxuexing-local', '--format', '{{.Id}}'],
    { output: true });
  return { containers, network };
}
function guardShared(state, receipt = null) {
  assert.deepEqual(sharedFingerprint(), receipt?.beforeSharedFingerprint || state.sharedBefore,
    'shared yuxuexing-local fingerprint changed; Batch23 stopped');
}
function proxySnapshot(state) {
  const name = state.project + '-https-proxy'; const items = JSON.parse(docker(['inspect', name], { output: true }));
  assert.equal(items.length, 1); const item = items[0];
  const proxy = { name, containerId: item.Id, imageId: item.Image, status: item.State.Status,
    project: item.Config.Labels['com.cloudstudy.uat.project'],
    networks: Object.keys(item.NetworkSettings.Networks || {}).sort(),
    portBindings: item.HostConfig.PortBindings || {} };
  assert.equal(proxy.project, state.project); assert.equal(proxy.status, 'running');
  assert.deepEqual(proxy.networks, [state.project]); assert.deepEqual(proxy.portBindings, {});
  return proxy;
}
function validateCompose(state, paths, images, baselineImages, inline = false) {
  const base = composeConfig(state, paths);
  const target = inline
    ? composeConfig(state, paths, batch23OverrideText(images))
    : composeConfig(state, paths, null, [paths.override]);
  const rolledBack = inline
    ? composeConfig(state, paths, batch23RollbackOverrideText(baselineImages))
    : composeConfig(state, paths, null, [paths.override, paths.rollback]);
  assertPrivateComposeIsolation(state, base); assertPrivateComposeIsolation(state, target);
  assertPrivateComposeIsolation(state, rolledBack);
  assertBatch23Plan(base, target, rolledBack, images, baselineImages);
  return { base, target, rolledBack };
}
function validateBatch22Baseline(current, { state, b22 }) {
  assertBatch23Baseline(current, b22);
  assert.deepEqual(current, b22.verifiedSnapshot);
  guardShared(state);
}
function dryRun(stateFile) {
  assertBatch23ImageIdsReady();
  const context = validateContext(stateFile); const { state, paths, b22, receipt } = context;
  const current = snapshot(state);
  if (!receipt) validateBatch22Baseline(current, context);
  else {
    validateReceipt(receipt, paths);
    assert.deepEqual(receipt.baselineSnapshot, b22.verifiedSnapshot);
    assertBatch23Baseline(receipt.baselineSnapshot, b22);
    assertBatch23Progress(current, receipt, { allowUnhealthyCandidate: receipt.phase === 'rolling-back' });
    guardShared(state, receipt);
  }
  const images = batch23CandidateImages();
  const candidateIds = Object.fromEntries(BATCH23_SERVICES.map((service) => [service, imageId(images[service])]));
  assert.deepEqual(candidateIds, BATCH23_IMAGE_IDS, 'Batch23 tag now points to a different image build');
  const base = composeConfig(state, paths);
  const baselineImages = Object.fromEntries(BATCH23_SERVICES.map((service) => [service, base.services[service].image]));
  for (const service of BATCH23_SERVICES) {
    const baselineId = receipt?.baselineSnapshot[service].imageId || current[service].imageId;
    assert.equal(imageId(baselineImages[service]), baselineId,
      service + ' baseline tag does not match the verified source image ID');
    assert.notEqual(candidateIds[service], baselineId, service + ' candidate equals baseline');
  }
  validateCompose(state, paths, images, baselineImages, true);
  if (receipt) {
    assert.deepEqual(receipt.baselineImages, baselineImages);
    assert.deepEqual(receipt.baselineImageIds, Object.fromEntries(BATCH23_SERVICES.map((service) =>
      [service, receipt.baselineSnapshot[service].imageId])));
  }
  guardShared(state, receipt);
  console.log(JSON.stringify({ project: state.project, releaseTag: BATCH23_RELEASE_TAG,
    services: BATCH23_SERVICES, phase: receipt?.phase || 'not-started', images: candidateIds }));
}
function preflight(stateFile) {
  assertBatch23ImageIdsReady();
  const context = validateContext(stateFile); const { state, paths, b22, receipt } = context;
  assert(!receipt, 'Batch23 receipt already exists; resume its phase');
  const before = snapshot(state); validateBatch22Baseline(before, context);
  const images = batch23CandidateImages();
  const imageIds = Object.fromEntries(BATCH23_SERVICES.map((service) => [service, imageId(images[service])]));
  assert.deepEqual(imageIds, BATCH23_IMAGE_IDS, 'Batch23 tag now points to a different image build');
  const base = composeConfig(state, paths);
  const baselineImages = Object.fromEntries(BATCH23_SERVICES.map((service) => [service, base.services[service].image]));
  const baselineImageIds = Object.fromEntries(BATCH23_SERVICES.map((service) => [service, imageId(baselineImages[service])]));
  for (const service of BATCH23_SERVICES) {
    assert.equal(before[service].imageId, baselineImageIds[service], service + ' source image differs from Batch22');
    assert.notEqual(imageIds[service], baselineImageIds[service]);
  }
  const overrideText = batch23OverrideText(images); const rollbackText = batch23RollbackOverrideText(baselineImages);
  const priorOverride = paths.override; const priorRollback = paths.rollback;
  ensureFile(priorOverride, overrideText); ensureFile(priorRollback, rollbackText);
  validateCompose(state, paths, images, baselineImages);
  const readinessResults = runReadiness(state, b22);
  assert.deepEqual(snapshot(state), before, 'readiness probe changed the Batch22 baseline');
  guardShared(state);
  const now = new Date().toISOString();
  writeJson(paths.receipt, { format: 1, project: state.project, stateFile: paths.stateFile,
    phase: 'preflighted', createdAt: now, updatedAt: now, releaseTag: BATCH23_RELEASE_TAG,
    services: [...BATCH23_SERVICES], images, imageIds, baselineImages, baselineImageIds,
    baselineSnapshot: structuredClone(before), beforeProxy: proxySnapshot(state),
    officialSiteImage: structuredClone(b22.officialSiteImage),
    baselineReadinessResults: readinessResults, baselineReadinessPassed: readinessResults.length,
    beforeSharedFingerprint: structuredClone(state.sharedBefore), promotedServices: [],
    serviceSnapshots: {}, rolledBackServices: [], rollbackInFlightServices: [] });
  console.log('Batch23 preflight passed: two exact image IDs, exact Batch22 source snapshot, 19/19 readiness, private Compose and shared fingerprint verified.');
}
function validateRuntime(context, { requireReceipt = true } = {}) {
  const { state, paths, b22 } = context; const receipt = context.receipt;
  assert(!requireReceipt || receipt, 'Batch23 preflight receipt is required');
  const current = snapshot(state);
  if (!receipt) validateBatch22Baseline(current, context);
  else {
    validateReceipt(receipt, paths);
    assert.deepEqual(receipt.beforeSharedFingerprint, state.sharedBefore);
    assert.deepEqual(receipt.baselineSnapshot, b22.verifiedSnapshot);
    assertBatch23Baseline(receipt.baselineSnapshot, b22);
    assertBatch23Progress(current, receipt, { allowUnhealthyCandidate: receipt.phase === 'rolling-back' });
    guardShared(state, receipt);
  }
  return current;
}
function updateReceipt(paths, receipt) {
  receipt.updatedAt = new Date().toISOString(); writeJson(paths.receipt, receipt);
}
function markPromoted(receipt, current, service) {
  receipt.serviceSnapshots[service] = structuredClone(current[service]);
  receipt.promotedServices = [...new Set([...receipt.promotedServices, service])].sort();
  receipt.lastVerifiedSnapshot = structuredClone(current);
  receipt.lastVerifiedService = service;
  receipt.updatedAt = new Date().toISOString();
}
function promote(stateFile) {
  assertBatch23ImageIdsReady();
  const context = validateContext(stateFile); const { state, paths, receipt } = context;
  assert(receipt && ['preflighted', 'promoting', 'promoted', 'verified'].includes(receipt.phase));
  let current = validateRuntime(context);
  validateCompose(state, paths, receipt.images, receipt.baselineImages);
  for (const service of BATCH23_SERVICES) assert.equal(imageId(receipt.images[service]), receipt.imageIds[service]);
  if (receipt.phase === 'promoted' || receipt.phase === 'verified') return;
  receipt.phase = 'promoting'; updateReceipt(paths, receipt);
  try {
    for (const service of BATCH23_ORDER) {
      current = assertBatch23Progress(snapshot(state), receipt);
      if (current[service].imageId !== receipt.imageIds[service]) {
        assert.equal(current[service].imageId, receipt.baselineImageIds[service]);
        compose(state, paths, [paths.override], batch23ComposeArgs(service), { timeout: 600000 });
        current = assertBatch23Progress(snapshot(state), receipt);
      }
      assert.equal(current[service].imageId, receipt.imageIds[service]);
      assert.equal(current[service].status, 'running');
      markPromoted(receipt, current, service); updateReceipt(paths, receipt);
      guardShared(state, receipt);
    }
    current = assertBatch23Progress(snapshot(state), receipt);
    assert(BATCH23_SERVICES.every((service) => current[service].status === 'running'));
    receipt.phase = 'promoted'; receipt.promotedSnapshot = structuredClone(current);
    updateReceipt(paths, receipt); guardShared(state, receipt);
    console.log('Two exact Batch23 images are running; refresh the private proxy and run readiness checks.');
  } catch {
    receipt.failureAt = new Date().toISOString(); receipt.failure = 'promotion failed; private rollback started';
    receipt.phase = 'rolling-back'; updateReceipt(paths, receipt);
    try { rollbackInternal(context, receipt); }
    catch { throw new Error('Batch23 promotion failed; private rollback is resumable with the rollback command'); }
    throw new Error('Batch23 promotion failed; recorded baseline images were restored in the private project');
  }
}
function rollbackInternal(context, receipt) {
  const { state, paths } = context;
  validateReceipt(receipt, paths);
  assert.deepEqual(receipt.baselineSnapshot, context.b22.verifiedSnapshot);
  guardShared(state, receipt);
  const baselineConfig = composeConfig(state, paths);
  const baseImages = Object.fromEntries(BATCH23_SERVICES.map((service) => [service, baselineConfig.services[service].image]));
  assert.deepEqual(baseImages, receipt.baselineImages);
  for (const service of BATCH23_SERVICES) assert.equal(imageId(baseImages[service]), receipt.baselineImageIds[service]);
  validateCompose(state, paths, receipt.images, receipt.baselineImages);
  receipt.phase = 'rolling-back'; updateReceipt(paths, receipt);
  for (const service of [...BATCH23_ORDER].reverse()) {
    let current = assertBatch23Progress(snapshot(state), receipt, { allowUnhealthyCandidate: true });
    if (current[service].imageId !== receipt.baselineImageIds[service]) {
      assert.equal(current[service].imageId, receipt.imageIds[service]);
      guardShared(state, receipt);
      receipt.rollbackInFlightServices = [...new Set([
        ...(receipt.rollbackInFlightServices || []), service
      ])].sort();
      updateReceipt(paths, receipt);
      compose(state, paths, [paths.override, paths.rollback], batch23ComposeArgs(service), { timeout: 600000 });
      current = snapshot(state);
      receipt.rolledBackServices = [...new Set([...receipt.rolledBackServices, service])].sort();
      receipt.rolledBackSnapshot = structuredClone(current);
      current = assertBatch23Progress(current, receipt, { allowUnhealthyCandidate: true });
    }
    assert.equal(current[service].imageId, receipt.baselineImageIds[service]);
    assert.equal(current[service].status, 'running');
    receipt.rolledBackServices = [...new Set([...receipt.rolledBackServices, service])].sort();
    receipt.rolledBackSnapshot = structuredClone(current);
    receipt.rollbackInFlightServices = (receipt.rollbackInFlightServices || []).filter((item) => item !== service);
    updateReceipt(paths, receipt);
    guardShared(state, receipt);
  }
  const after = assertBatch23RollbackComplete(snapshot(state), receipt);
  receipt.phase = 'rolled-back'; receipt.rolledBackSnapshot = structuredClone(after);
  updateReceipt(paths, receipt); guardShared(state, receipt);
}
function rollback(stateFile) {
  const context = validateContext(stateFile); const receipt = context.receipt;
  assert(receipt && ['promoting', 'promoted', 'verified', 'rolling-back', 'rolled-back'].includes(receipt.phase),
    'Batch23 rollback requires a preflighted promotion attempt');
  if (receipt.phase === 'rolled-back') {
    validateRuntime(context);
    assertBatch23RollbackComplete(snapshot(context.state), receipt);
    guardShared(context.state, receipt);
    return;
  }
  rollbackInternal(context, receipt);
  console.log('Batch23 rollback restored both recorded baseline image IDs; other 24 service identities stayed unchanged.');
}
function proxy(state) {
  const before = proxySnapshot(state); docker(['restart', before.name], { timeout: 120000 });
  const after = proxySnapshot(state); assert.equal(after.containerId, before.containerId);
  assert.equal(after.imageId, before.imageId); return after;
}
function refreshProxy(stateFile) {
  const context = validateContext(stateFile); const { state, paths, receipt } = context;
  assert(receipt && ['promoted', 'verified', 'rolled-back'].includes(receipt.phase));
  validateRuntime(context);
  const before = proxySnapshot(state); assert.deepEqual(before, receipt.beforeProxy);
  guardShared(state, receipt); proxy(state);
  receipt.proxyRefreshedForPhase = receipt.phase; receipt.proxyRefreshedAt = new Date().toISOString();
  updateReceipt(paths, receipt); guardShared(state, receipt);
}
function runReadiness(state, receipt) {
  const targets = batch19ReadinessTargets();
  const script = `const targets=${JSON.stringify(targets)};\n` +
    'const results=await Promise.all(targets.map(async ([name,port,route])=>{let status=0;for(let attempt=0;attempt<15&&status!==200;attempt++){try{status=(await fetch("http://"+name+":"+port+route,{signal:AbortSignal.timeout(5000)})).status}catch{}if(status!==200)await new Promise(r=>setTimeout(r,1000));}return{name,status}}));\n' +
    'for(const result of results)console.log(JSON.stringify(result));if(results.some(result=>result.status!==200))process.exit(1);';
  const official = receipt.officialSiteImage;
  assert.equal(imageId(official.image), official.imageId);
  const out = docker(['run', '--pull=never', '--rm', '--network', state.project, '--label',
    'com.cloudstudy.uat.project=' + state.project, '--entrypoint', 'node', official.image,
    '--input-type=module', '-e', script], { output: true, timeout: 180000 });
  const results = out.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(results.length, 19); assert(results.every((result) => result.status === 200));
  return results;
}
function readiness(stateFile) {
  const context = validateContext(stateFile); const { state, receipt } = context;
  assert(receipt && ['promoted', 'verified', 'rolled-back'].includes(receipt.phase));
  assert.equal(receipt.proxyRefreshedForPhase, receipt.phase);
  const before = snapshot(state); validateRuntime(context);
  const results = runReadiness(state, receipt);
  assert.deepEqual(snapshot(state), before); guardShared(state, receipt);
  console.log(JSON.stringify({ project: state.project, phase: receipt.phase, checked: 19, passed: 19, results }));
}
function verify(stateFile) {
  const context = validateContext(stateFile); const { state, paths, receipt } = context;
  assert(receipt && ['promoted', 'verified'].includes(receipt.phase));
  assert.equal(receipt.proxyRefreshedForPhase, 'promoted');
  const before = validateRuntime(context);
  guardShared(state, receipt);
  for (const service of BATCH23_SERVICES) {
    assert.equal(before[service].imageId, receipt.imageIds[service]);
    assert.notEqual(before[service].containerId, receipt.baselineSnapshot[service].containerId);
    assert.equal(before[service].status, 'running');
  }
  const results = runReadiness(state, receipt);
  assert.deepEqual(snapshot(state), before); guardShared(state, receipt);
  receipt.phase = 'verified'; receipt.verifiedSnapshot = structuredClone(before);
  receipt.readinessResults = results; receipt.readinessPassed = 19;
  receipt.verifiedAt = new Date().toISOString(); updateReceipt(paths, receipt);
  console.log('Batch23 verified: two exact candidate image IDs, unchanged 24 service identities and 19/19 readiness.');
}
function status(stateFile) {
  const { state, receipt } = validateContext(stateFile);
  console.log(JSON.stringify({ project: state.project, phase: receipt?.phase || 'not-started',
    releaseTag: BATCH23_RELEASE_TAG, services: BATCH23_SERVICES,
    promotedServices: receipt?.promotedServices || [], rolledBackServices: receipt?.rolledBackServices || [],
    readinessPassed: receipt?.readinessPassed || 0, verified: receipt?.phase === 'verified' }));
}
function main() {
  const [command, stateFile] = process.argv.slice(2);
  const handlers = { 'dry-run': dryRun, preflight, promote, 'refresh-proxy': refreshProxy,
    readiness, verify, rollback, status };
  assert(handlers[command], 'unknown Batch23 private promotion command'); handlers[command](stateFile);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) {
    const detail = process.env.CLOUDSTUDY_UAT_DIAGNOSTIC === '1' && error?.name === 'AssertionError'
      ? ' ' + String(error.message || '').split('\n', 1)[0].slice(0, 160) : '';
    console.error('Batch23 private promotion failed closed; private outputs were suppressed.' + detail);
    process.exitCode = 1;
  }
}
