#!/usr/bin/env node
// Private, resumable Batch22 promotion. No database writes or shared-project commands.
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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BATCH22_PROJECT = BATCH18_PROJECT;
export const BATCH22_RELEASE_TAG = '583ab627-uat-batch22-20260925';
export const BATCH22_SERVICES = Object.freeze(['social-service', 'learner-web', 'mobile-h5']);
export const BATCH22_ORDER = Object.freeze(['social-service', 'learner-web', 'mobile-h5']);
export const BATCH22_RECEIPT = 'batch22-private-promotion.json';
export const BATCH22_OVERRIDE = 'docker-compose.batch22-promotion.yml';
export const BATCH22_ROLLBACK_OVERRIDE = 'docker-compose.batch22-rollback.yml';
export const BATCH22_IMAGE_IDS = Object.freeze({
  'social-service': 'sha256:dccc91fa27b458677dcaa01894c97e619e44e927b5a076a4ae6c928f3fa83e75',
  'learner-web': 'sha256:8e273afae78940b389333effb8175bc5b0a6ef7fda8d3c5a506c0b5c0d7c9780',
  'mobile-h5': 'sha256:b8319bd93823a07e6a8ed74e4564191205f5198001a46e2da8ff05cf1552d480'
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
    'Batch22 state escaped its private temporary directory');
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
    b21Override: path.join(tempDir, BATCH21_OVERRIDE), receipt: path.join(tempDir, BATCH22_RECEIPT),
    override: path.join(tempDir, BATCH22_OVERRIDE), rollback: path.join(tempDir, BATCH22_ROLLBACK_OVERRIDE)
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

export function batch22CandidateImages(tag = BATCH22_RELEASE_TAG) {
  assert.equal(tag, BATCH22_RELEASE_TAG, 'Batch22 release tag differs from approved tag');
  return Object.fromEntries(BATCH22_SERVICES.map((service) =>
    [service, `cloudstudy-clyunedev/${service}:${tag}`]));
}
export function assertBatch22ImageIdsReady(imageIds = BATCH22_IMAGE_IDS) {
  assert.deepEqual(Object.keys(imageIds || {}).sort(), [...BATCH22_SERVICES].sort(),
    'Batch22 image IDs must cover exactly social-service, learner-web, and mobile-h5');
  for (const service of BATCH22_SERVICES) {
    assert.match(imageIds[service] || '', /^sha256:[a-f0-9]{64}$/u,
      `Batch22 ${service} image ID is not filled from the built candidate image`);
  }
  return imageIds;
}
export function batch22OverrideText(images = batch22CandidateImages()) {
  assert.deepEqual(Object.keys(images).sort(), [...BATCH22_SERVICES].sort(),
    'Batch22 overlay must contain exactly its three approved services');
  const approved = batch22CandidateImages();
  for (const service of BATCH22_SERVICES) assert.equal(images[service], approved[service]);
  return 'services:\n' + BATCH22_SERVICES.map((service) =>
    `  ${service}:\n    image: ${images[service]}\n`).join('');
}
export function batch22RollbackOverrideText(baselineImages) {
  assert.deepEqual(Object.keys(baselineImages || {}).sort(), [...BATCH22_SERVICES].sort(),
    'rollback overlay must contain exactly the three recorded baseline images');
  for (const service of BATCH22_SERVICES) assert.match(baselineImages[service] || '',
    new RegExp(`^cloudstudy-clyunedev/${service}:[A-Za-z0-9._-]+$`, 'u'));
  return 'services:\n' + BATCH22_SERVICES.map((service) =>
    `  ${service}:\n    image: ${baselineImages[service]}\n`).join('');
}
export function batch22ComposeArgs(service) {
  assert(BATCH22_SERVICES.includes(service), 'Batch22 may replace only its three approved services');
  return ['up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--force-recreate', service];
}
export function assertBatch22Baseline(current, batch21) {
  assert.equal(batch21?.project, BATCH22_PROJECT);
  assert.equal(batch21?.phase, 'verified', 'Batch21 must be verified before Batch22');
  assert.equal(batch21.releaseTag, BATCH21_RELEASE_TAG);
  assert.deepEqual(batch21.services, [...BATCH21_SERVICES]);
  assert.deepEqual(batch21.images, batch21CandidateImages());
  assert.deepEqual(batch21.imageIds, BATCH21_IMAGE_IDS);
  assertBatch21ImageIdsReady(batch21.imageIds);
  assert(batch21.verifiedSnapshot, 'Batch21 verified container snapshot is missing');
  assert.equal(batch21.readinessPassed, 19, 'Batch21 must record 19/19 readiness');
  assert.equal((batch21.readinessResults || []).length, 19);
  assert((batch21.readinessResults || []).every((item) => item.status === 200));
  assertBatch17PrivateSnapshot(current, BATCH22_PROJECT);
  assert.deepEqual(current, batch21.verifiedSnapshot,
    'Batch22 source container/image IDs must exactly match the Batch21 verified snapshot');
  return current;
}
export function assertBatch22Plan(baseline, candidate, rollback, images, baselineImages) {
  const services = [...BATCH17_PRIVATE_SERVICES].sort();
  assert.deepEqual(Object.keys(baseline.services || {}).sort(), services);
  assert.deepEqual(Object.keys(candidate.services || {}).sort(), services);
  assert.deepEqual(Object.keys(rollback.services || {}).sort(), services);
  assert.deepEqual(Object.keys(images || {}).sort(), [...BATCH22_SERVICES].sort());
  assert.deepEqual(Object.keys(baselineImages || {}).sort(), [...BATCH22_SERVICES].sort());
  for (const service of services) {
    if (BATCH22_SERVICES.includes(service)) {
      assert.equal(candidate.services[service].image, images[service], service + ' candidate image differs');
      assert.equal(rollback.services[service].image, baselineImages[service], service + ' rollback image differs');
    } else {
      assert.equal(candidate.services[service].image, baseline.services[service].image,
        service + ' changed outside Batch22');
      assert.equal(rollback.services[service].image, baseline.services[service].image,
        service + ' rollback changed outside Batch22');
    }
  }
  return true;
}
export function assertBatch22Progress(current, receipt, { allowUnhealthyCandidate = false } = {}) {
  assertBatch17PrivateSnapshot(current, BATCH22_PROJECT);
  assertBatch17PrivateSnapshot(receipt.baselineSnapshot, BATCH22_PROJECT);
  for (const service of BATCH17_PRIVATE_SERVICES) {
    const actual = current[service]; const before = receipt.baselineSnapshot[service];
    if (!BATCH22_SERVICES.includes(service)) {
      assert.deepEqual(actual, before, service + ' changed outside Batch22');
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
export function assertBatch22RollbackComplete(current, receipt) {
  assertBatch22Progress(current, receipt, { allowUnhealthyCandidate: true });
  assert.deepEqual(receipt.rollbackInFlightServices || [], [], 'rollback still has uncommitted service intents');
  for (const service of BATCH22_SERVICES) {
    assert.equal(current[service].imageId, receipt.baselineSnapshot[service].imageId,
      service + ' baseline image was not restored');
    assert.equal(current[service].status, 'running', service + ' baseline image is not running');
  }
  return current;
}

function validateContext(stateFile) {
  assert(stateFile, 'usage: node batch22-private-promotion.mjs <command> <private state.json>');
  const resolved = path.resolve(stateFile); const state = readJson(resolved, 'state.json');
  const paths = pathsFor(state);
  assert.equal(state.project, BATCH22_PROJECT, 'only the approved private UAT project is allowed');
  assert.equal(state.tag, '583ab627-uat-batch9-202609231740');
  assert.equal(state.batch17ReleaseTag, '583ab627-uat-batch17-202609250206');
  within(os.tmpdir(), paths.tempDir);
  assert(path.basename(paths.tempDir).startsWith(BATCH22_PROJECT + '-'));
  assert(samePath(resolved, paths.stateFile));
  for (const [key, target] of Object.entries({ stateFile: paths.stateFile, envFile: paths.envFile,
    keyFile: paths.keyFile, overrideFile: paths.base })) assert(samePath(state[key], target));
  for (const file of [paths.tempDir, paths.stateFile, paths.envFile, paths.keyFile, paths.base,
    paths.v17, paths.b18, paths.b18Override, paths.b19, paths.b19Override,
    paths.b20, paths.b20Override, paths.b21, paths.b21Override]) {
    const info = fs.lstatSync(file);
    assert(file === paths.tempDir ? info.isDirectory() && !info.isSymbolicLink()
      : info.isFile() && !info.isSymbolicLink(), 'private prerequisite path is invalid');
  }
  assertPrivateTempPermissions(state);
  const v17 = readJson(paths.v17, 'IAM V17 receipt'); const b18 = readJson(paths.b18, 'Batch18 receipt');
  const b19 = readJson(paths.b19, 'Batch19 receipt'); const b20 = readJson(paths.b20, 'Batch20 receipt');
  const b21 = readJson(paths.b21, 'Batch21 receipt');
  assert.equal(v17.project, BATCH22_PROJECT); assert.equal(v17.phase, 'complete');
  assert.equal(v17.candidateImage, BATCH18_IAM_IMAGE);
  assert.equal(b18.project, BATCH22_PROJECT); assert.equal(b18.phase, 'verified');
  assert.equal(b18.releaseTag, BATCH18_RELEASE_TAG);
  assert.deepEqual(b18.images, batch18CandidateImages());
  assert.deepEqual(b18.beforeSharedFingerprint, state.sharedBefore);
  assert.equal(b19.project, BATCH22_PROJECT); assert(samePath(b19.stateFile, paths.stateFile));
  assert.equal(b19.releaseTag, BATCH19_RELEASE_TAG);
  assert.deepEqual(b19.beforeSharedFingerprint, state.sharedBefore);
  assert.equal(b20.project, BATCH22_PROJECT); assert(samePath(b20.stateFile, paths.stateFile));
  assert.equal(b20.phase, 'verified', 'Batch20 must be verified before Batch22');
  assert.equal(b20.releaseTag, BATCH20_RELEASE_TAG);
  assert.deepEqual(b20.services, [...BATCH20_SERVICES]);
  assert.deepEqual(b20.images, batch20CandidateImages());
  assert.deepEqual(b20.imageIds, BATCH20_IMAGE_IDS);
  assert.deepEqual(b20.beforeSharedFingerprint, state.sharedBefore);
  assert.deepEqual(b20.baselineSnapshot, b19.verifiedSnapshot,
    'Batch20 baseline must be the exact verified Batch19 snapshot');
  assertBatch17PrivateSnapshot(b20.verifiedSnapshot, BATCH22_PROJECT);
  assert.equal(b20.readinessPassed, 19);
  assert.equal((b20.readinessResults || []).length, 19);
  assert((b20.readinessResults || []).every((item) => item.status === 200));
  assert.equal(fs.readFileSync(paths.b20Override, 'utf8'), batch20OverrideText(b20.images));
  assert.equal(b20.officialSiteImage?.image, b18.images['official-site']);
  assert.equal(b20.officialSiteImage?.imageId, b18.imageIds['official-site']);
  assert.equal(b21.project, BATCH22_PROJECT); assert(samePath(b21.stateFile, paths.stateFile));
  assert.equal(b21.phase, 'verified', 'Batch21 must be verified before Batch22');
  assert.equal(b21.releaseTag, BATCH21_RELEASE_TAG);
  assert.deepEqual(b21.services, [...BATCH21_SERVICES]);
  assert.deepEqual(b21.images, batch21CandidateImages());
  assert.deepEqual(b21.imageIds, BATCH21_IMAGE_IDS);
  assertBatch21ImageIdsReady(b21.imageIds);
  assert.deepEqual(b21.beforeSharedFingerprint, state.sharedBefore);
  assert.deepEqual(b21.baselineSnapshot, b20.verifiedSnapshot,
    'Batch21 baseline must be the exact verified Batch20 snapshot');
  assert.deepEqual(b21.officialSiteImage, b20.officialSiteImage);
  assertBatch22Baseline(b21.verifiedSnapshot, b21);
  assert.equal(b21.baselineReadinessPassed, 19);
  assert.equal((b21.baselineReadinessResults || []).length, 19);
  assert((b21.baselineReadinessResults || []).every((item) => item.status === 200));
  assert.equal(fs.readFileSync(paths.b21Override, 'utf8'), batch21OverrideText(b21.images));
  const batch22 = fs.existsSync(paths.receipt) ? readJson(paths.receipt, 'Batch22 receipt') : null;
  if (batch22) {
    validateReceipt(batch22, paths);
    assert.deepEqual(batch22.baselineSnapshot, b21.verifiedSnapshot,
      'Batch22 receipt must remain anchored to the Batch21 verified snapshot');
    assert.deepEqual(batch22.beforeSharedFingerprint, state.sharedBefore);
  }
  return { state, paths, v17, b18, b19, b20, b21, receipt: batch22 };
}
function validateReceipt(receipt, paths) {
  assert.equal(receipt.format, 1); assert.equal(receipt.project, BATCH22_PROJECT);
  assert(samePath(receipt.stateFile, paths.stateFile));
  assert.equal(receipt.releaseTag, BATCH22_RELEASE_TAG);
  assert.deepEqual(receipt.services, [...BATCH22_SERVICES]);
  assert.deepEqual(receipt.images, batch22CandidateImages());
  assert.deepEqual(Object.keys(receipt.imageIds || {}).sort(), [...BATCH22_SERVICES].sort());
  for (const service of BATCH22_SERVICES) assert.equal(receipt.imageIds[service], BATCH22_IMAGE_IDS[service]);
  assertBatch22ImageIdsReady(receipt.imageIds);
  assert.deepEqual(Object.keys(receipt.baselineImages || {}).sort(), [...BATCH22_SERVICES].sort());
  assert.deepEqual(Object.keys(receipt.baselineImageIds || {}).sort(), [...BATCH22_SERVICES].sort());
  assert(phases.includes(receipt.phase));
  const rollbackInFlightServices = receipt.rollbackInFlightServices || [];
  assert(Array.isArray(rollbackInFlightServices), 'rollbackInFlightServices must be an array');
  assert(rollbackInFlightServices.every((service) => BATCH22_SERVICES.includes(service)),
    'rollbackInFlightServices contains an unapproved service');
  assert.equal(new Set(rollbackInFlightServices).size, rollbackInFlightServices.length,
    'rollbackInFlightServices contains duplicates');
  for (const file of [paths.override, paths.rollback]) {
    const info = fs.lstatSync(file);
    assert(info.isFile() && !info.isSymbolicLink(), 'Batch22 Compose overlays must be private regular files');
  }
  assert.equal(receipt.officialSiteImage?.image, batch18CandidateImages()['official-site']);
  assert.match(receipt.officialSiteImage?.imageId || '', /^sha256:[a-f0-9]{64}$/u);
  assert.equal(receipt.baselineReadinessPassed, 19);
  assert.equal((receipt.baselineReadinessResults || []).length, 19);
  assert((receipt.baselineReadinessResults || []).every((item) => item.status === 200));
  assertBatch17PrivateSnapshot(receipt.baselineSnapshot, BATCH22_PROJECT);
  for (const service of BATCH22_SERVICES) {
    assert.equal(receipt.baselineSnapshot[service].imageId, receipt.baselineImageIds[service]);
  }
  assert.equal(fs.readFileSync(paths.override, 'utf8'), batch22OverrideText(receipt.images));
  assert.equal(fs.readFileSync(paths.rollback, 'utf8'), batch22RollbackOverrideText(receipt.baselineImages));
  return receipt;
}

function docker(args, { output = false, timeout = 120000, input } = {}) {
  const result = spawnSync('docker', args, { cwd: root, env: safeEnv(), encoding: 'utf8', timeout,
    maxBuffer: 32 * 1024 * 1024, input, windowsHide: true });
  assert(!result.error && result.status === 0, 'private Batch22 Docker operation failed; output was suppressed');
  return output ? result.stdout.trim() : '';
}
function composeArgs(state, paths, overlays, args) {
  const files = ['compose', '-p', state.project, '--env-file', paths.envFile,
    '-f', path.join(root, 'infra/docker/clyunedev/docker-compose.core.yml'),
    '-f', path.join(root, 'infra/docker/clyunedev/docker-compose.full.yml'),
    '-f', paths.base, '-f', paths.b18Override, '-f', paths.b19Override,
    '-f', paths.b20Override, '-f', paths.b21Override];
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
    assert.equal(item.Config.Labels['com.docker.compose.project'], BATCH22_PROJECT);
    const service = item.Config.Labels['com.docker.compose.service'];
    assert(service && !Object.hasOwn(result, service));
    result[service] = { containerId: item.Id, imageId: item.Image, status: item.State.Status,
      project: BATCH22_PROJECT, networks: Object.keys(item.NetworkSettings.Networks || {}).sort(),
      portBindings: item.HostConfig.PortBindings || {} };
  }
  return assertBatch17PrivateSnapshot(result, BATCH22_PROJECT);
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
    'shared yuxuexing-local fingerprint changed; Batch22 stopped');
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
    ? composeConfig(state, paths, batch22OverrideText(images))
    : composeConfig(state, paths, null, [paths.override]);
  const rolledBack = inline
    ? composeConfig(state, paths, batch22RollbackOverrideText(baselineImages))
    : composeConfig(state, paths, null, [paths.override, paths.rollback]);
  assertPrivateComposeIsolation(state, base); assertPrivateComposeIsolation(state, target);
  assertPrivateComposeIsolation(state, rolledBack);
  assertBatch22Plan(base, target, rolledBack, images, baselineImages);
  return { base, target, rolledBack };
}
function validateBatch21Baseline(current, { state, b21 }) {
  assertBatch22Baseline(current, b21);
  assert.deepEqual(current, b21.verifiedSnapshot);
  guardShared(state);
}
function dryRun(stateFile) {
  assertBatch22ImageIdsReady();
  const context = validateContext(stateFile); const { state, paths, b21, receipt } = context;
  const current = snapshot(state);
  if (!receipt) validateBatch21Baseline(current, context);
  else {
    validateReceipt(receipt, paths);
    assert.deepEqual(receipt.baselineSnapshot, b21.verifiedSnapshot);
    assertBatch22Baseline(receipt.baselineSnapshot, b21);
    assertBatch22Progress(current, receipt, { allowUnhealthyCandidate: receipt.phase === 'rolling-back' });
    guardShared(state, receipt);
  }
  const images = batch22CandidateImages();
  const candidateIds = Object.fromEntries(BATCH22_SERVICES.map((service) => [service, imageId(images[service])]));
  assert.deepEqual(candidateIds, BATCH22_IMAGE_IDS, 'Batch22 tag now points to a different image build');
  const base = composeConfig(state, paths);
  const baselineImages = Object.fromEntries(BATCH22_SERVICES.map((service) => [service, base.services[service].image]));
  for (const service of BATCH22_SERVICES) {
    const baselineId = receipt?.baselineSnapshot[service].imageId || current[service].imageId;
    assert.equal(imageId(baselineImages[service]), baselineId,
      service + ' baseline tag does not match the verified source image ID');
    assert.notEqual(candidateIds[service], baselineId, service + ' candidate equals baseline');
  }
  validateCompose(state, paths, images, baselineImages, true);
  if (receipt) {
    assert.deepEqual(receipt.baselineImages, baselineImages);
    assert.deepEqual(receipt.baselineImageIds, Object.fromEntries(BATCH22_SERVICES.map((service) =>
      [service, receipt.baselineSnapshot[service].imageId])));
  }
  guardShared(state, receipt);
  console.log(JSON.stringify({ project: state.project, releaseTag: BATCH22_RELEASE_TAG,
    services: BATCH22_SERVICES, phase: receipt?.phase || 'not-started', images: candidateIds }));
}
function preflight(stateFile) {
  assertBatch22ImageIdsReady();
  const context = validateContext(stateFile); const { state, paths, b21, receipt } = context;
  assert(!receipt, 'Batch22 receipt already exists; resume its phase');
  const before = snapshot(state); validateBatch21Baseline(before, context);
  const images = batch22CandidateImages();
  const imageIds = Object.fromEntries(BATCH22_SERVICES.map((service) => [service, imageId(images[service])]));
  assert.deepEqual(imageIds, BATCH22_IMAGE_IDS, 'Batch22 tag now points to a different image build');
  const base = composeConfig(state, paths);
  const baselineImages = Object.fromEntries(BATCH22_SERVICES.map((service) => [service, base.services[service].image]));
  const baselineImageIds = Object.fromEntries(BATCH22_SERVICES.map((service) => [service, imageId(baselineImages[service])]));
  for (const service of BATCH22_SERVICES) {
    assert.equal(before[service].imageId, baselineImageIds[service], service + ' source image differs from Batch21');
    assert.notEqual(imageIds[service], baselineImageIds[service]);
  }
  const overrideText = batch22OverrideText(images); const rollbackText = batch22RollbackOverrideText(baselineImages);
  const priorOverride = paths.override; const priorRollback = paths.rollback;
  ensureFile(priorOverride, overrideText); ensureFile(priorRollback, rollbackText);
  validateCompose(state, paths, images, baselineImages);
  const readinessResults = runReadiness(state, b21);
  assert.deepEqual(snapshot(state), before, 'readiness probe changed the Batch21 baseline');
  guardShared(state);
  const now = new Date().toISOString();
  writeJson(paths.receipt, { format: 1, project: state.project, stateFile: paths.stateFile,
    phase: 'preflighted', createdAt: now, updatedAt: now, releaseTag: BATCH22_RELEASE_TAG,
    services: [...BATCH22_SERVICES], images, imageIds, baselineImages, baselineImageIds,
    baselineSnapshot: structuredClone(before), beforeProxy: proxySnapshot(state),
    officialSiteImage: structuredClone(b21.officialSiteImage),
    baselineReadinessResults: readinessResults, baselineReadinessPassed: readinessResults.length,
    beforeSharedFingerprint: structuredClone(state.sharedBefore), promotedServices: [],
    serviceSnapshots: {}, rolledBackServices: [], rollbackInFlightServices: [] });
  console.log('Batch22 preflight passed: three exact image IDs, exact Batch21 source snapshot, 19/19 readiness, private Compose and shared fingerprint verified.');
}
function validateRuntime(context, { requireReceipt = true } = {}) {
  const { state, paths, b21 } = context; const receipt = context.receipt;
  assert(!requireReceipt || receipt, 'Batch22 preflight receipt is required');
  const current = snapshot(state);
  if (!receipt) validateBatch21Baseline(current, context);
  else {
    validateReceipt(receipt, paths);
    assert.deepEqual(receipt.beforeSharedFingerprint, state.sharedBefore);
    assert.deepEqual(receipt.baselineSnapshot, b21.verifiedSnapshot);
    assertBatch22Baseline(receipt.baselineSnapshot, b21);
    assertBatch22Progress(current, receipt, { allowUnhealthyCandidate: receipt.phase === 'rolling-back' });
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
  assertBatch22ImageIdsReady();
  const context = validateContext(stateFile); const { state, paths, receipt } = context;
  assert(receipt && ['preflighted', 'promoting', 'promoted', 'verified'].includes(receipt.phase));
  let current = validateRuntime(context);
  validateCompose(state, paths, receipt.images, receipt.baselineImages);
  for (const service of BATCH22_SERVICES) assert.equal(imageId(receipt.images[service]), receipt.imageIds[service]);
  if (receipt.phase === 'promoted' || receipt.phase === 'verified') return;
  receipt.phase = 'promoting'; updateReceipt(paths, receipt);
  try {
    for (const service of BATCH22_ORDER) {
      current = assertBatch22Progress(snapshot(state), receipt);
      if (current[service].imageId !== receipt.imageIds[service]) {
        assert.equal(current[service].imageId, receipt.baselineImageIds[service]);
        compose(state, paths, [paths.override], batch22ComposeArgs(service), { timeout: 600000 });
        current = assertBatch22Progress(snapshot(state), receipt);
      }
      assert.equal(current[service].imageId, receipt.imageIds[service]);
      assert.equal(current[service].status, 'running');
      markPromoted(receipt, current, service); updateReceipt(paths, receipt);
      guardShared(state, receipt);
    }
    current = assertBatch22Progress(snapshot(state), receipt);
    assert(BATCH22_SERVICES.every((service) => current[service].status === 'running'));
    receipt.phase = 'promoted'; receipt.promotedSnapshot = structuredClone(current);
    updateReceipt(paths, receipt); guardShared(state, receipt);
    console.log('Three exact Batch22 images are running; refresh the private proxy and run readiness checks.');
  } catch {
    receipt.failureAt = new Date().toISOString(); receipt.failure = 'promotion failed; private rollback started';
    receipt.phase = 'rolling-back'; updateReceipt(paths, receipt);
    try { rollbackInternal(context, receipt); }
    catch { throw new Error('Batch22 promotion failed; private rollback is resumable with the rollback command'); }
    throw new Error('Batch22 promotion failed; recorded baseline images were restored in the private project');
  }
}
function rollbackInternal(context, receipt) {
  const { state, paths } = context;
  validateReceipt(receipt, paths);
  assert.deepEqual(receipt.baselineSnapshot, context.b21.verifiedSnapshot);
  guardShared(state, receipt);
  const baselineConfig = composeConfig(state, paths);
  const baseImages = Object.fromEntries(BATCH22_SERVICES.map((service) => [service, baselineConfig.services[service].image]));
  assert.deepEqual(baseImages, receipt.baselineImages);
  for (const service of BATCH22_SERVICES) assert.equal(imageId(baseImages[service]), receipt.baselineImageIds[service]);
  validateCompose(state, paths, receipt.images, receipt.baselineImages);
  receipt.phase = 'rolling-back'; updateReceipt(paths, receipt);
  for (const service of [...BATCH22_ORDER].reverse()) {
    let current = assertBatch22Progress(snapshot(state), receipt, { allowUnhealthyCandidate: true });
    if (current[service].imageId !== receipt.baselineImageIds[service]) {
      assert.equal(current[service].imageId, receipt.imageIds[service]);
      guardShared(state, receipt);
      receipt.rollbackInFlightServices = [...new Set([
        ...(receipt.rollbackInFlightServices || []), service
      ])].sort();
      updateReceipt(paths, receipt);
      compose(state, paths, [paths.override, paths.rollback], batch22ComposeArgs(service), { timeout: 600000 });
      current = snapshot(state);
      receipt.rolledBackServices = [...new Set([...receipt.rolledBackServices, service])].sort();
      receipt.rolledBackSnapshot = structuredClone(current);
      current = assertBatch22Progress(current, receipt, { allowUnhealthyCandidate: true });
    }
    assert.equal(current[service].imageId, receipt.baselineImageIds[service]);
    assert.equal(current[service].status, 'running');
    receipt.rolledBackServices = [...new Set([...receipt.rolledBackServices, service])].sort();
    receipt.rolledBackSnapshot = structuredClone(current);
    receipt.rollbackInFlightServices = (receipt.rollbackInFlightServices || []).filter((item) => item !== service);
    updateReceipt(paths, receipt);
    guardShared(state, receipt);
  }
  const after = assertBatch22RollbackComplete(snapshot(state), receipt);
  receipt.phase = 'rolled-back'; receipt.rolledBackSnapshot = structuredClone(after);
  updateReceipt(paths, receipt); guardShared(state, receipt);
}
function rollback(stateFile) {
  const context = validateContext(stateFile); const receipt = context.receipt;
  assert(receipt && ['promoting', 'promoted', 'verified', 'rolling-back', 'rolled-back'].includes(receipt.phase),
    'Batch22 rollback requires a preflighted promotion attempt');
  if (receipt.phase === 'rolled-back') {
    validateRuntime(context);
    assertBatch22RollbackComplete(snapshot(context.state), receipt);
    guardShared(context.state, receipt);
    return;
  }
  rollbackInternal(context, receipt);
  console.log('Batch22 rollback restored both recorded baseline image IDs; other private services stayed unchanged.');
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
  for (const service of BATCH22_SERVICES) {
    assert.equal(before[service].imageId, receipt.imageIds[service]);
    assert.notEqual(before[service].containerId, receipt.baselineSnapshot[service].containerId);
    assert.equal(before[service].status, 'running');
  }
  const results = runReadiness(state, receipt);
  assert.deepEqual(snapshot(state), before); guardShared(state, receipt);
  receipt.phase = 'verified'; receipt.verifiedSnapshot = structuredClone(before);
  receipt.readinessResults = results; receipt.readinessPassed = 19;
  receipt.verifiedAt = new Date().toISOString(); updateReceipt(paths, receipt);
  console.log('Batch22 verified: three exact candidate image IDs, unchanged 23 service identities and 19/19 readiness.');
}
function status(stateFile) {
  const { state, receipt } = validateContext(stateFile);
  console.log(JSON.stringify({ project: state.project, phase: receipt?.phase || 'not-started',
    releaseTag: BATCH22_RELEASE_TAG, services: BATCH22_SERVICES,
    promotedServices: receipt?.promotedServices || [], rolledBackServices: receipt?.rolledBackServices || [],
    readinessPassed: receipt?.readinessPassed || 0, verified: receipt?.phase === 'verified' }));
}
function main() {
  const [command, stateFile] = process.argv.slice(2);
  const handlers = { 'dry-run': dryRun, preflight, promote, 'refresh-proxy': refreshProxy,
    readiness, verify, rollback, status };
  assert(handlers[command], 'unknown Batch22 private promotion command'); handlers[command](stateFile);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) {
    const detail = process.env.CLOUDSTUDY_UAT_DIAGNOSTIC === '1' && error?.name === 'AssertionError'
      ? ' ' + String(error.message || '').split('\n', 1)[0].slice(0, 160) : '';
    console.error('Batch22 private promotion failed closed; private outputs were suppressed.' + detail);
    process.exitCode = 1;
  }
}
