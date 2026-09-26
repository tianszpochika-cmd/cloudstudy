#!/usr/bin/env node
// Resumable, private-only Batch18 promotion of the official site and mobile H5.
// This helper never touches the shared yuxuexing-local Compose project.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  BATCH17_PRIVATE_SERVICES,
  assertBatch17PrivateSnapshot,
  assertPrivateComposeIsolation,
  assertPrivateTempPermissions,
  safeEnv
} from './uat-isolated-compose.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BATCH18_PROJECT = 'cloudstudy-uat-isolated-3c94b27160';
export const BATCH18_RELEASE_TAG = '583ab627-uat-batch18-202609250315';
export const BATCH18_SERVICES = Object.freeze(['official-site', 'mobile-h5']);
export const BATCH18_IAM_IMAGE = 'cloudstudy-clyunedev/iam-service:583ab627-uat-batch17-202609250206';
export const BATCH18_V17_RECEIPT = 'iam-v17-private-promotion.json';
export const BATCH18_RECEIPT = 'batch18-private-promotion.json';
export const BATCH18_OVERRIDE = 'docker-compose.batch18-promotion.yml';
export const BATCH18_ROLLBACK_OVERRIDE = 'docker-compose.batch18-rollback.yml';
const expectedBatch17Tag = '583ab627-uat-batch17-202609250206';
const phases = Object.freeze(['preflighted', 'promoting', 'promoted', 'verified', 'rollback-started', 'rolled-back']);
const stateFileArg = process.argv[3];
const command = process.argv[2];

export function batch18CandidateImages(releaseTag = BATCH18_RELEASE_TAG) {
  assert.equal(releaseTag, BATCH18_RELEASE_TAG, 'Batch18 release tag differs from the approved build tag');
  return Object.fromEntries(BATCH18_SERVICES.map((service) => [
    service, `cloudstudy-clyunedev/${service}:${releaseTag}`
  ]));
}

export function batch18ComposeArgs(service) {
  assert(BATCH18_SERVICES.includes(service), 'Batch18 can replace only official-site or mobile-h5');
  return ['up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--force-recreate', service];
}

export function batch18OverrideText({ images, iamImage = BATCH18_IAM_IMAGE }) {
  assert.deepEqual(Object.keys(images || {}), BATCH18_SERVICES,
    'Batch18 override must contain exactly the official-site and mobile-h5 candidates');
  assert.equal(iamImage, BATCH18_IAM_IMAGE, 'Batch18 must retain the completed private IAM V17 image');
  for (const [service, image] of Object.entries(images)) {
    const allowed = [batch18CandidateImages()[service], `cloudstudy-clyunedev/${service}:${expectedBatch17Tag}`];
    assert(allowed.includes(image), `${service} image differs from the approved Batch17/Batch18 image`);
  }
  return `services:\n  iam-service:\n    image: ${iamImage}\n` + BATCH18_SERVICES
    .map((service) => `  ${service}:\n    image: ${images[service]}\n`).join('');
}

export function assertBatch18PrivateContext(state, stateFile, v17Receipt, expectedPaths = null) {
  assert.equal(state.project, BATCH18_PROJECT, 'only the approved private Batch17 Compose project is allowed');
  assert.equal(state.tag, '583ab627-uat-batch9-202609231740', 'private base image tag changed');
  assert.equal(state.batch17ReleaseTag, expectedBatch17Tag, 'Batch17 baseline release changed');
  const tempDir = path.resolve(state.tempDir || '');
  const tempRoot = path.resolve(os.tmpdir());
  const relative = path.relative(tempRoot, tempDir);
  assert(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative),
    'private state must remain under the operating-system temp directory');
  assert(path.basename(tempDir).startsWith(`${BATCH18_PROJECT}-`), 'private temp directory does not match the project');
  const paths = {
    tempDir,
    stateFile: path.join(tempDir, 'state.json'),
    envFile: path.join(tempDir, 'uat.env'),
    keyFile: path.join(tempDir, 'iam-rsa-private.pem'),
    baseOverride: path.join(tempDir, 'docker-compose.isolated.yml'),
    v17Receipt: path.join(tempDir, BATCH18_V17_RECEIPT),
    receipt: path.join(tempDir, BATCH18_RECEIPT),
    override: path.join(tempDir, BATCH18_OVERRIDE),
    rollbackOverride: path.join(tempDir, BATCH18_ROLLBACK_OVERRIDE)
  };
  const equalPath = (left, right) => process.platform === 'win32'
    ? path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase()
    : path.resolve(left) === path.resolve(right);
  assert(equalPath(stateFile, paths.stateFile), 'state.json must belong to the approved private project');
  for (const [name, target] of Object.entries({
    stateFile: paths.stateFile, envFile: paths.envFile, keyFile: paths.keyFile, overrideFile: paths.baseOverride
  })) {
    assert(equalPath(state[name], target), `${name} escaped the private project directory`);
  }
  if (expectedPaths) {
    for (const key of ['tempDir', 'stateFile', 'envFile', 'keyFile', 'baseOverride', 'v17Receipt', 'receipt', 'override', 'rollbackOverride']) {
      assert(equalPath(paths[key], expectedPaths[key]), `private ${key} path changed`);
    }
  }
  const directory = fs.lstatSync(paths.tempDir);
  assert(directory.isDirectory() && !directory.isSymbolicLink(), 'private temp directory must be a real directory');
  for (const file of [paths.stateFile, paths.envFile, paths.keyFile, paths.baseOverride, paths.v17Receipt]) {
    const info = fs.lstatSync(file);
    assert(info.isFile() && !info.isSymbolicLink(), 'private state files must be regular files');
  }
  assert.deepEqual(state.batch17CandidateServices, ['official-site', 'content-service', 'learner-web', 'mobile-h5'],
    'Batch17 candidate set changed');
  assert.equal(state.replacementImages?.['official-site'],
    `cloudstudy-clyunedev/official-site:${expectedBatch17Tag}`, 'official-site Batch17 baseline differs');
  assert.equal(state.replacementImages?.['mobile-h5'],
    `cloudstudy-clyunedev/mobile-h5:${expectedBatch17Tag}`, 'mobile-h5 Batch17 baseline differs');
  assert.equal(v17Receipt?.project, BATCH18_PROJECT, 'completed IAM V17 receipt belongs to another project');
  assert(equalPath(v17Receipt.stateFile, paths.stateFile), 'IAM V17 receipt belongs to another private state');
  assert.equal(v17Receipt.phase, 'complete', 'IAM V17 promotion must be complete before Batch18');
  assert.equal(v17Receipt.candidateImage, BATCH18_IAM_IMAGE, 'IAM V17 receipt uses a different image');
  assert.match(v17Receipt.candidateImageId || '', /^sha256:[a-f0-9]{64}$/u, 'IAM V17 image ID is invalid');
  assert.match(v17Receipt.iamContainerId || '', /^[a-f0-9]{64}$/u, 'IAM V17 container ID is invalid');
  assert.equal(v17Receipt.restoredSnapshot?.['iam-service']?.containerId, v17Receipt.iamContainerId,
    'IAM V17 completion receipt has inconsistent container identity');
  assert.equal(v17Receipt.restoredSnapshot?.['iam-service']?.imageId, v17Receipt.candidateImageId,
    'IAM V17 completion receipt has inconsistent image identity');
  assert.deepEqual(v17Receipt.beforeSharedFingerprint, state.sharedBefore,
    'IAM V17 receipt does not match the isolated project shared-service baseline');
  assert(state.batch17CandidateImageIds && typeof state.batch17CandidateImageIds === 'object',
    'Batch17 candidate image identities are required');
  return paths;
}

export function assertBatch18PromotionProgress(snapshot, before, candidateImageIds) {
  assertBatch17PrivateSnapshot(snapshot, BATCH18_PROJECT);
  assertBatch17PrivateSnapshot(before, BATCH18_PROJECT);
  assert.deepEqual(Object.keys(candidateImageIds || {}).sort(), [...BATCH18_SERVICES].sort(),
    'Batch18 image IDs must contain exactly the two approved services');
  for (const service of BATCH18_SERVICES) {
    assert.match(candidateImageIds[service] || '', /^sha256:[a-f0-9]{64}$/u,
      `${service} candidate image ID is invalid`);
    assert.notEqual(candidateImageIds[service], before[service].imageId,
      `${service} candidate image must differ from its recorded baseline`);
  }
  for (const service of BATCH17_PRIVATE_SERVICES) {
    const actual = snapshot[service];
    const original = before[service];
    if (!BATCH18_SERVICES.includes(service)) {
      assert.deepEqual(actual, original, `${service} changed outside the Batch18 candidate scope`);
    } else if (actual.containerId === original.containerId) {
      assert.deepEqual(actual, original, `${service} changed without replacing its original container`);
    } else {
      assert.equal(actual.imageId, candidateImageIds[service], `${service} runs an unapproved image`);
      assert.equal(actual.status, 'running', `${service} candidate is not running`);
    }
  }
  return snapshot;
}

export function assertBatch18RollbackProgress(snapshot, before, candidateImageIds) {
  assertBatch17PrivateSnapshot(snapshot, BATCH18_PROJECT);
  assertBatch17PrivateSnapshot(before, BATCH18_PROJECT);
  assert.deepEqual(Object.keys(candidateImageIds || {}).sort(), [...BATCH18_SERVICES].sort(),
    'Batch18 candidate image IDs must contain exactly the two approved services');
  for (const service of BATCH18_SERVICES) {
    assert.match(candidateImageIds[service] || '', /^sha256:[a-f0-9]{64}$/u,
      `${service} Batch18 image ID is invalid`);
  }
  for (const service of BATCH17_PRIVATE_SERVICES) {
    const actual = snapshot[service];
    const original = before[service];
    if (!BATCH18_SERVICES.includes(service)) {
      assert.deepEqual(actual, original, `${service} changed outside the Batch18 rollback scope`);
    } else if (actual.containerId === original.containerId) {
      assert.deepEqual(actual, original, `${service} changed without replacing its original container`);
    } else {
      assert([candidateImageIds[service], original.imageId].includes(actual.imageId),
        `${service} is running an image outside the recorded Batch17/Batch18 pair`);
      assert.equal(actual.status, 'running', `${service} rollback target is not running`);
    }
  }
  return snapshot;
}

// The loop is deliberately adapter-driven so tests can simulate interrupted promotion
// without invoking Docker or affecting any running service.
export function applyBatch18Services({ before, candidateImageIds, snapshot, applyService, recordProgress = () => {} }) {
  assert.deepEqual(Object.keys(candidateImageIds || {}).sort(), [...BATCH18_SERVICES].sort(),
    'Batch18 promotion is limited to the two approved services');
  for (const service of BATCH18_SERVICES) {
    let current = assertBatch18PromotionProgress(snapshot(), before, candidateImageIds);
    if (current[service].imageId !== candidateImageIds[service]) {
      assert.equal(current[service].containerId, before[service].containerId,
        `${service} is neither its recorded container nor its exact candidate`);
      applyService(service);
      current = assertBatch18PromotionProgress(snapshot(), before, candidateImageIds);
      assert.equal(current[service].imageId, candidateImageIds[service],
        `${service} did not start its exact candidate image`);
      assert.notEqual(current[service].containerId, before[service].containerId,
        `${service} container was not recreated`);
      assert.equal(current[service].status, 'running', `${service} candidate is not running`);
    }
    recordProgress(service, current);
  }
  return assertBatch18PromotionProgress(snapshot(), before, candidateImageIds);
}

export function applyBatch18RollbackServices({ before, candidateImageIds, snapshot, applyService, recordProgress = () => {} }) {
  for (const service of BATCH18_SERVICES) {
    let current = assertBatch18RollbackProgress(snapshot(), before, candidateImageIds);
    if (current[service].containerId !== before[service].containerId
      && current[service].imageId !== before[service].imageId) {
      applyService(service);
      current = assertBatch18RollbackProgress(snapshot(), before, candidateImageIds);
      assert.equal(current[service].imageId, before[service].imageId,
        `${service} did not return to its exact pre-Batch18 image`);
      assert.notEqual(current[service].containerId, before[service].containerId,
        `${service} rollback container was not recreated`);
      assert.equal(current[service].status, 'running', `${service} rollback image is not running`);
    }
    recordProgress(service, current);
  }
  return assertBatch18RollbackProgress(snapshot(), before, candidateImageIds);
}

export function batch18ReadinessProbeImage(receipt) {
  if (receipt?.phase === 'rolled-back') {
    return {
      image: receipt.beforeImages?.['official-site'],
      imageId: receipt.beforeSnapshot?.['official-site']?.imageId
    };
  }
  return {
    image: receipt?.images?.['official-site'],
    imageId: receipt?.imageIds?.['official-site']
  };
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stateFingerprint(state) {
  return sha256(JSON.stringify({
    project: state.project,
    tag: state.tag,
    batch17ReleaseTag: state.batch17ReleaseTag,
    batch17CandidateServices: state.batch17CandidateServices,
    batch17CandidateImages: state.batch17CandidateImages,
    batch17CandidateImageIds: state.batch17CandidateImageIds,
    batch17ContentV22Evidence: state.batch17ContentV22Evidence,
    replacementImages: {
      'iam-service': state.replacementImages?.['iam-service'],
      'official-site': state.replacementImages?.['official-site'],
      'mobile-h5': state.replacementImages?.['mobile-h5'],
      'content-service': state.replacementImages?.['content-service']
    },
    sharedBefore: state.sharedBefore
  }));
}

function assertReceiptContext(state, paths, v17Receipt, receipt) {
  assert.equal(receipt.project, BATCH18_PROJECT, 'Batch18 receipt belongs to another project');
  assert.equal(path.resolve(receipt.stateFile), paths.stateFile, 'Batch18 receipt belongs to another private state');
  assert.equal(receipt.stateFingerprint, stateFingerprint(state), 'private Batch17 state changed after preflight');
  assert.equal(receipt.v17ReceiptFingerprint, sha256(JSON.stringify({
    project: v17Receipt.project,
    stateFile: v17Receipt.stateFile,
    phase: v17Receipt.phase,
    candidateImage: v17Receipt.candidateImage,
    candidateImageId: v17Receipt.candidateImageId,
    iamContainerId: v17Receipt.iamContainerId,
    completedAt: v17Receipt.completedAt
  })), 'IAM V17 completion receipt changed after Batch18 preflight');
  assert.equal(receipt.releaseTag, BATCH18_RELEASE_TAG, 'Batch18 receipt uses another release tag');
  assert.deepEqual(receipt.services, [...BATCH18_SERVICES], 'Batch18 receipt service scope changed');
  assert.deepEqual(receipt.images, batch18CandidateImages(), 'Batch18 candidate images changed');
  assert.deepEqual(Object.keys(receipt.imageIds || {}).sort(), [...BATCH18_SERVICES].sort(),
    'Batch18 candidate image IDs are incomplete');
  for (const imageId of Object.values(receipt.imageIds)) {
    assert.match(imageId, /^sha256:[a-f0-9]{64}$/u, 'Batch18 image ID is invalid');
  }
  assert(phases.includes(receipt.phase), 'Batch18 receipt phase is unknown');
  assertBatch17PrivateSnapshot(receipt.beforeSnapshot, BATCH18_PROJECT);
  assert(receipt.beforeProxy && receipt.beforeProxy.project === BATCH18_PROJECT,
    'Batch18 private proxy baseline is missing');
  assert.deepEqual(receipt.beforeSharedFingerprint, state.sharedBefore,
    'Batch18 shared Docker baseline differs from private state');
  assert.equal(receipt.beforeSnapshot['iam-service'].imageId, v17Receipt.candidateImageId,
    'Batch18 baseline does not preserve the completed IAM V17 image');
  assert.equal(receipt.beforeSnapshot['iam-service'].containerId, v17Receipt.iamContainerId,
    'Batch18 baseline does not preserve the completed IAM V17 container');
  assert.deepEqual(receipt.beforeImages, {
    'official-site': state.replacementImages['official-site'],
    'mobile-h5': state.replacementImages['mobile-h5']
  }, 'Batch18 rollback tags differ from the recorded preflight images');
  assert.equal(receipt.beforeSnapshot['official-site'].imageId, state.batch17CandidateImageIds?.['official-site'],
    'Batch18 official-site snapshot differs from Batch17 baseline');
  assert.equal(receipt.beforeSnapshot['mobile-h5'].imageId, state.batch17CandidateImageIds?.['mobile-h5'],
    'Batch18 mobile-h5 snapshot differs from Batch17 baseline');
  assert.match(receipt.beforeProxy.containerId || '', /^[a-f0-9]{64}$/u, 'private proxy container ID is invalid');
  assert.match(receipt.beforeProxy.imageId || '', /^sha256:[a-f0-9]{64}$/u, 'private proxy image ID is invalid');
  assert.equal(receipt.beforeProxy.name, `${BATCH18_PROJECT}-https-proxy`, 'private proxy name is invalid');
  assert.deepEqual(receipt.beforeProxy.networks, [BATCH18_PROJECT], 'private proxy network is invalid');
  assert.deepEqual(receipt.beforeProxy.portBindings, {}, 'private proxy must not publish host ports');
}

function privatePaths(state) {
  const tempDir = path.resolve(state.tempDir);
  return {
    tempDir,
    stateFile: path.join(tempDir, 'state.json'),
    envFile: path.join(tempDir, 'uat.env'),
    keyFile: path.join(tempDir, 'iam-rsa-private.pem'),
    baseOverride: path.join(tempDir, 'docker-compose.isolated.yml'),
    v17Receipt: path.join(tempDir, BATCH18_V17_RECEIPT),
    receipt: path.join(tempDir, BATCH18_RECEIPT),
    override: path.join(tempDir, BATCH18_OVERRIDE),
    rollbackOverride: path.join(tempDir, BATCH18_ROLLBACK_OVERRIDE)
  };
}

function readJsonFile(file, message) {
  const info = fs.lstatSync(file);
  assert(info.isFile() && !info.isSymbolicLink(), message);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writePrivateJson(file, value) {
  const temporary = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const fd = fs.openSync(temporary, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.renameSync(temporary, file);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch {}
    throw error;
  }
}

function ensurePrivateOverride(paths, images, overridePath = paths.override) {
  const expected = batch18OverrideText({ images });
  if (fs.existsSync(overridePath)) {
    const info = fs.lstatSync(overridePath);
    assert(info.isFile() && !info.isSymbolicLink(), 'Batch18 Compose override must be a regular private file');
    assert.equal(fs.readFileSync(overridePath, 'utf8'), expected,
      'unexpected Batch18 Compose override exists; inspect privately before resuming');
    return;
  }
  const fd = fs.openSync(overridePath, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, expected);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function docker(args, { output = false, timeout = 120000, input } = {}) {
  const result = spawnSync('docker', args, {
    cwd: root,
    env: safeEnv(),
    encoding: 'utf8',
    timeout,
    maxBuffer: 32 * 1024 * 1024,
    input,
    windowsHide: true
  });
  assert(!result.error && result.status === 0, 'private Batch18 Docker operation failed; output was suppressed');
  return output ? result.stdout.trim() : '';
}

function composeArgs(state, paths, args, overrideFile = paths.override) {
  const files = [
    'compose', '-p', state.project, '--env-file', paths.envFile,
    '-f', path.join(root, 'infra/docker/clyunedev/docker-compose.core.yml'),
    '-f', path.join(root, 'infra/docker/clyunedev/docker-compose.full.yml'),
    '-f', paths.baseOverride
  ];
  if (overrideFile) files.push('-f', overrideFile);
  return [...files, ...args];
}

function compose(state, paths, args, options = {}) {
  const { overrideFile = paths.override, ...dockerOptions } = options;
  return docker(composeArgs(state, paths, args, overrideFile), dockerOptions);
}

function imageIdForTag(image) {
  const inspected = JSON.parse(docker(['image', 'inspect', image], { output: true }));
  assert.equal(inspected.length, 1, 'Batch18 candidate image is missing or ambiguous');
  assert((inspected[0].RepoTags || []).includes(image), 'Batch18 candidate tag is not attached to the inspected image');
  assert.match(inspected[0].Id || '', /^sha256:[a-f0-9]{64}$/u, 'Batch18 candidate image ID is invalid');
  return inspected[0].Id;
}

function containerSnapshot(state) {
  const ids = docker(['ps', '-a', '--filter', `label=com.docker.compose.project=${state.project}`,
    '--format', '{{.ID}}'], { output: true }).split(/\r?\n/u).filter(Boolean);
  assert.equal(ids.length, BATCH17_PRIVATE_SERVICES.length, 'private project no longer has exactly 26 containers');
  const inspected = JSON.parse(docker(['inspect', ...ids], { output: true }));
  assert.equal(inspected.length, BATCH17_PRIVATE_SERVICES.length);
  const snapshot = {};
  for (const item of inspected) {
    assert.equal(item.Config.Labels['com.docker.compose.project'], BATCH18_PROJECT);
    const service = item.Config.Labels['com.docker.compose.service'];
    assert(service && !Object.hasOwn(snapshot, service), 'private service labels are missing or duplicated');
    snapshot[service] = {
      containerId: item.Id,
      imageId: item.Image,
      status: item.State.Status,
      project: item.Config.Labels['com.docker.compose.project'],
      networks: Object.keys(item.NetworkSettings.Networks || {}).sort(),
      portBindings: item.HostConfig.PortBindings || {}
    };
  }
  return assertBatch17PrivateSnapshot(snapshot, BATCH18_PROJECT);
}

function sharedFingerprint() {
  const containers = docker(['ps', '-a', '--filter', 'name=^/yuxuexing-local-',
    '--format', '{{.ID}}|{{.Names}}'], { output: true }).split(/\r?\n/u).filter(Boolean).sort();
  const network = docker(['network', 'inspect', 'yuxuexing-local_yuxuexing-local', '--format', '{{.Id}}'],
    { output: true });
  return { containers, network };
}

function privateProxySnapshot(state) {
  const name = `${state.project}-https-proxy`;
  const inspected = JSON.parse(docker(['inspect', name], { output: true }));
  assert.equal(inspected.length, 1, 'private HTTPS proxy is missing or ambiguous');
  const item = inspected[0];
  assert.equal(item.Name, `/${name}`, 'HTTPS proxy name differs from this private project');
  assert.equal(item.Config.Labels['com.cloudstudy.uat.project'], state.project,
    'HTTPS proxy is not labelled for the private project');
  const snapshot = {
    name,
    containerId: item.Id,
    imageId: item.Image,
    status: item.State.Status,
    project: item.Config.Labels['com.cloudstudy.uat.project'],
    networks: Object.keys(item.NetworkSettings.Networks || {}).sort(),
    portBindings: item.HostConfig.PortBindings || {}
  };
  assert.equal(snapshot.status, 'running', 'private HTTPS proxy is not running');
  assert.deepEqual(snapshot.networks, [state.project], 'HTTPS proxy is attached to an unexpected network');
  assert.deepEqual(snapshot.portBindings, {}, 'HTTPS proxy publishes a host port');
  return snapshot;
}

function assertSharedFingerprint(state, expected = state.sharedBefore) {
  assert.deepEqual(sharedFingerprint(), expected, 'shared Docker fingerprint changed; Batch18 stopped');
}

function assertComposeConfig(state, config, v17Receipt, images) {
  assert.equal(config.name, BATCH18_PROJECT, 'Batch18 Compose project name changed');
  assert.deepEqual(Object.keys(config.services || {}).sort(), [...BATCH17_PRIVATE_SERVICES].sort(),
    'Batch18 Compose service set differs from the approved 26 services');
  assertPrivateComposeIsolation(state, config);
  assert.equal(config.services['iam-service']?.image, BATCH18_IAM_IMAGE,
    'Batch18 Compose overlay does not preserve IAM V17');
  assert.equal(config.services['iam-service']?.image, v17Receipt.candidateImage,
    'Batch18 Compose IAM image differs from the completed V17 receipt');
  for (const service of BATCH18_SERVICES) {
    assert.equal(config.services[service]?.image, images[service], `${service} Compose image differs from approved receipt`);
  }
}

function loadContext(stateFile, { requireReceipt = true } = {}) {
  assert(stateFile, 'usage: node batch18-private-site-promotion.mjs <dry-run|preflight|promote|refresh-proxy|readiness|verify|rollback|status> <private state.json>');
  const resolved = path.resolve(stateFile);
  const state = readJsonFile(resolved, 'state.json must be a regular private file');
  const paths = privatePaths(state);
  const v17Receipt = readJsonFile(paths.v17Receipt, 'IAM V17 receipt must be a regular private file');
  assertBatch18PrivateContext(state, resolved, v17Receipt, paths);
  assertPrivateTempPermissions(state);
  const receipt = fs.existsSync(paths.receipt)
    ? readJsonFile(paths.receipt, 'Batch18 receipt must be a regular private file')
    : null;
  if (requireReceipt) assert(receipt, 'Batch18 preflight receipt is required');
  if (receipt) assertReceiptContext(state, paths, v17Receipt, receipt);
  return { state, paths, v17Receipt, receipt };
}

function dryRun(stateFile) {
  const { state, paths, v17Receipt, receipt } = loadContext(stateFile, { requireReceipt: false });
  const images = batch18CandidateImages();
  const overlay = batch18OverrideText({ images });
  const configArgs = composeArgs(state, paths, ['-f', '-', 'config', '--format', 'json'], null);
  const config = JSON.parse(docker(configArgs, { output: true, input: overlay }));
  assertComposeConfig(state, config, v17Receipt, images);
  const candidateIds = Object.fromEntries(BATCH18_SERVICES.map((service) => [service, imageIdForTag(images[service])]));
  const current = containerSnapshot(state);
  assert.equal(current['iam-service'].containerId, v17Receipt.iamContainerId,
    'running private IAM container differs from the completed V17 receipt');
  assert.equal(current['iam-service'].imageId, v17Receipt.candidateImageId,
    'running private IAM image differs from the completed V17 receipt');
  if (receipt) {
    assert.deepEqual(receipt.imageIds, candidateIds, 'Batch18 candidate tag now resolves to a different image');
    if (['rollback-started', 'rolled-back'].includes(receipt.phase)) {
      assertBatch18RollbackProgress(current, receipt.beforeSnapshot, candidateIds);
    } else {
      assertBatch18PromotionProgress(current, receipt.beforeSnapshot, candidateIds);
    }
  } else {
    for (const service of BATCH18_SERVICES) {
      assert.equal(current[service].imageId, state.batch17CandidateImageIds[service],
        `${service} is not at its recorded Batch17 baseline`);
      assert.equal(imageIdForTag(state.replacementImages[service]), current[service].imageId,
        `${service} Batch17 tag differs from its running image`);
      assert.notEqual(candidateIds[service], current[service].imageId,
        `${service} Batch18 candidate is not a new image`);
    }
  }
  assertSharedFingerprint(state);
  console.log(JSON.stringify({ project: state.project, phase: receipt?.phase || 'not-started',
    releaseTag: BATCH18_RELEASE_TAG, services: BATCH18_SERVICES, imageIds: candidateIds, writes: false }));
}

function preflight(stateFile) {
  const { state, paths, v17Receipt, receipt } = loadContext(stateFile, { requireReceipt: false });
  assert(!receipt || phases.includes(receipt.phase), 'Batch18 receipt phase is invalid');
  const images = batch18CandidateImages();
  ensurePrivateOverride(paths, images);
  const config = JSON.parse(compose(state, paths, ['config', '--format', 'json'], { output: true }));
  assertComposeConfig(state, config, v17Receipt, images);
  const current = containerSnapshot(state);
  assert.equal(current['iam-service'].containerId, v17Receipt.iamContainerId,
    'running private IAM container differs from its V17 completion receipt');
  assert.equal(current['iam-service'].imageId, v17Receipt.candidateImageId,
    'running private IAM image differs from its V17 completion receipt');
  assert.equal(current['iam-service'].status, 'running', 'private IAM V17 candidate is not running');
  const imageIds = Object.fromEntries(BATCH18_SERVICES.map((service) => [service, imageIdForTag(images[service])]));
  assertSharedFingerprint(state);
  if (receipt) {
    assert.deepEqual(receipt.imageIds, imageIds, 'Batch18 image tag now resolves to a different image than preflight');
    const beforeProxy = privateProxySnapshot(state);
    assert.deepEqual(beforeProxy, receipt.beforeProxy,
      'private HTTPS proxy identity changed since Batch18 preflight');
    const progress = containerSnapshot(state);
    if (['rollback-started', 'rolled-back'].includes(receipt.phase)) {
      assertBatch18RollbackProgress(progress, receipt.beforeSnapshot, imageIds);
    } else {
      assertBatch18PromotionProgress(progress, receipt.beforeSnapshot, imageIds);
    }
    console.log(JSON.stringify({ project: state.project, phase: receipt.phase, services: BATCH18_SERVICES }));
    return;
  }
  for (const service of BATCH18_SERVICES) {
    assert.equal(current[service].imageId, state.batch17CandidateImageIds[service],
      `${service} does not match the Batch17 baseline`);
    assert.equal(imageIdForTag(state.replacementImages[service]), current[service].imageId,
      `${service} active tag no longer matches the private running image`);
    assert.notEqual(imageIds[service], current[service].imageId,
      `${service} Batch18 image is not new relative to the running container`);
  }
  const nextReceipt = {
    format: 1,
    project: BATCH18_PROJECT,
    stateFile: paths.stateFile,
    phase: 'preflighted',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    releaseTag: BATCH18_RELEASE_TAG,
    services: [...BATCH18_SERVICES],
    images,
    imageIds,
    beforeImages: {
      'official-site': state.replacementImages['official-site'],
      'mobile-h5': state.replacementImages['mobile-h5']
    },
    stateFingerprint: stateFingerprint(state),
    v17ReceiptFingerprint: sha256(JSON.stringify({
      project: v17Receipt.project,
      stateFile: v17Receipt.stateFile,
      phase: v17Receipt.phase,
      candidateImage: v17Receipt.candidateImage,
      candidateImageId: v17Receipt.candidateImageId,
      iamContainerId: v17Receipt.iamContainerId,
      completedAt: v17Receipt.completedAt
    })),
    beforeSnapshot: structuredClone(current),
    beforeProxy: privateProxySnapshot(state),
    beforeSharedFingerprint: structuredClone(state.sharedBefore),
    promotedServices: []
  };
  writePrivateJson(paths.receipt, nextReceipt);
  console.log('Batch18 private preflight passed; only a private receipt and Compose overlay were written.');
}

function promote(stateFile) {
  const { state, paths, v17Receipt, receipt } = loadContext(stateFile);
  assert(['preflighted', 'promoting', 'promoted', 'verified'].includes(receipt.phase),
    'Batch18 receipt is not at a resumable promotion phase');
  ensurePrivateOverride(paths, receipt.images);
  assertSharedFingerprint(state);
  const config = JSON.parse(compose(state, paths, ['config', '--format', 'json'], { output: true }));
  assertComposeConfig(state, config, v17Receipt, receipt.images);
  const current = containerSnapshot(state);
  assertBatch18PromotionProgress(current, receipt.beforeSnapshot, receipt.imageIds);
  if (receipt.phase === 'verified') {
    console.log('Batch18 private official-site and mobile-h5 promotion is already verified.');
    return;
  }
  if (receipt.phase === 'preflighted') {
    receipt.phase = 'promoting';
    receipt.updatedAt = new Date().toISOString();
    writePrivateJson(paths.receipt, receipt);
  }
  const after = applyBatch18Services({
    before: receipt.beforeSnapshot,
    candidateImageIds: receipt.imageIds,
    snapshot: () => containerSnapshot(state),
    applyService: (service) => {
      assert.equal(imageIdForTag(receipt.images[service]), receipt.imageIds[service],
        `${service} candidate tag changed after preflight`);
      return compose(state, paths, batch18ComposeArgs(service), { timeout: 600000 });
    },
    recordProgress: (service, snapshot) => {
      if (!receipt.promotedServices.includes(service)) receipt.promotedServices.push(service);
      receipt.promotedServices.sort();
      receipt.updatedAt = new Date().toISOString();
      receipt.lastVerifiedService = service;
      receipt.lastVerifiedSnapshot = snapshot;
      writePrivateJson(paths.receipt, receipt);
    }
  });
  assertSharedFingerprint(state);
  receipt.phase = 'promoted';
  receipt.promotedSnapshot = after;
  receipt.updatedAt = new Date().toISOString();
  writePrivateJson(paths.receipt, receipt);
  console.log('Batch18 private candidates are running; run verify after browser and page checks.');
}

function rollback(stateFile) {
  const { state, paths, v17Receipt, receipt } = loadContext(stateFile);
  assert(['promoting', 'promoted', 'verified', 'rollback-started', 'rolled-back'].includes(receipt.phase),
    'rollback requires a recorded Batch18 promotion attempt');
  assertSharedFingerprint(state);
  const rollbackImages = receipt.beforeImages;
  ensurePrivateOverride(paths, rollbackImages, paths.rollbackOverride);
  const config = JSON.parse(compose(state, paths, ['config', '--format', 'json'], {
    output: true, overrideFile: paths.rollbackOverride
  }));
  assertComposeConfig(state, config, v17Receipt, rollbackImages);
  let current = assertBatch18RollbackProgress(containerSnapshot(state), receipt.beforeSnapshot, receipt.imageIds);
  if (receipt.phase === 'rolled-back') {
    assertSharedFingerprint(state);
    console.log('Batch18 official-site and mobile-h5 are already rolled back to their recorded Batch17 images.');
    return;
  }
  if (receipt.phase !== 'rollback-started') {
    receipt.phase = 'rollback-started';
    receipt.updatedAt = new Date().toISOString();
    writePrivateJson(paths.receipt, receipt);
  }
  current = applyBatch18RollbackServices({
    before: receipt.beforeSnapshot,
    candidateImageIds: receipt.imageIds,
    snapshot: () => containerSnapshot(state),
    applyService: (service) => {
      assert.equal(imageIdForTag(rollbackImages[service]), receipt.beforeSnapshot[service].imageId,
        `${service} Batch17 rollback tag no longer resolves to its recorded image`);
      return compose(state, paths, batch18ComposeArgs(service), {
        timeout: 600000, overrideFile: paths.rollbackOverride
      });
    },
    recordProgress: (service, snapshot) => {
      if (!receipt.rolledBackServices) receipt.rolledBackServices = [];
      if (!receipt.rolledBackServices.includes(service)) receipt.rolledBackServices.push(service);
      receipt.rolledBackServices.sort();
      receipt.lastVerifiedService = service;
      receipt.lastVerifiedSnapshot = snapshot;
      receipt.updatedAt = new Date().toISOString();
      writePrivateJson(paths.receipt, receipt);
    }
  });
  assertSharedFingerprint(state);
  receipt.phase = 'rolled-back';
  receipt.rollbackSnapshot = current;
  receipt.rolledBackAt = new Date().toISOString();
  receipt.updatedAt = receipt.rolledBackAt;
  writePrivateJson(paths.receipt, receipt);
  console.log('Batch18 rollback restored both recorded Batch17 images; refresh the private HTTPS proxy before retesting.');
}

function refreshProxy(stateFile) {
  const { state, paths, receipt } = loadContext(stateFile);
  assert(['promoted', 'verified', 'rolled-back'].includes(receipt.phase),
    'refresh the HTTPS proxy only after Batch18 promotion or rollback is complete');
  const current = containerSnapshot(state);
  if (receipt.phase === 'rolled-back') {
    assertBatch18RollbackProgress(current, receipt.beforeSnapshot, receipt.imageIds);
  } else {
    assertBatch18PromotionProgress(current, receipt.beforeSnapshot, receipt.imageIds);
  }
  const beforeProxy = privateProxySnapshot(state);
  assert.deepEqual(beforeProxy, receipt.beforeProxy, 'private HTTPS proxy changed since preflight');
  assertSharedFingerprint(state);
  docker(['restart', beforeProxy.name], { timeout: 120000 });
  const afterProxy = privateProxySnapshot(state);
  assert.equal(afterProxy.containerId, beforeProxy.containerId, 'private HTTPS proxy container identity changed');
  assert.equal(afterProxy.imageId, beforeProxy.imageId, 'private HTTPS proxy image changed');
  receipt.proxyRefreshedForPhase = receipt.phase;
  receipt.proxyRefreshedAt = new Date().toISOString();
  receipt.proxySnapshotAfterRefresh = afterProxy;
  receipt.updatedAt = receipt.proxyRefreshedAt;
  writePrivateJson(paths.receipt, receipt);
  assertSharedFingerprint(state);
  console.log(`Private HTTPS proxy restarted for ${receipt.phase}; its upstream DNS cache is refreshed.`);
}

function readiness(stateFile) {
  const { state, receipt } = loadContext(stateFile);
  assert(['promoted', 'verified', 'rolled-back'].includes(receipt.phase),
    'readiness requires completed Batch18 promotion or rollback');
  assert.equal(receipt.proxyRefreshedForPhase, receipt.phase,
    'refresh the private HTTPS proxy before checking the current frontend containers');
  const validateSnapshot = (snapshot) => receipt.phase === 'rolled-back'
    ? assertBatch18RollbackProgress(snapshot, receipt.beforeSnapshot, receipt.imageIds)
    : assertBatch18PromotionProgress(snapshot, receipt.beforeSnapshot, receipt.imageIds);
  const before = validateSnapshot(containerSnapshot(state));
  for (const service of BATCH18_SERVICES) {
    assert.equal(before[service].status, 'running', `${service} is not running`);
  }
  const targets = [
    ['official-site', 18182, '/'], ['learner-web', 8080, '/'],
    ['admin-web', 8080, '/'], ['mobile-h5', 8080, '/'],
    ['iam-service', 18087, '/actuator/health/readiness'],
    ['api-gateway', 18070, '/actuator/health/readiness'],
    ...[
      ['audit-service', 18099], ['workflow-service', 18071], ['learner-service', 18088],
      ['content-service', 18089], ['learning-service', 18090], ['assessment-service', 18091],
      ['media-service', 18092], ['notification-service', 18093], ['gamification-service', 18094],
      ['social-service', 18095], ['commerce-service', 18096], ['admin-ops-service', 18097],
      ['analytics-service', 18098]
    ].map(([name, port]) => [name, port, '/actuator/health/readiness'])
  ];
  const probe = `const targets=${JSON.stringify(targets)};let failed=false;for(const [name,port,route] of targets){let status=0;let error='';try{const r=await fetch('http://'+name+':'+port+route,{signal:AbortSignal.timeout(5000)});status=r.status;}catch(e){error=e.name;}if(status!==200)failed=true;console.log(JSON.stringify({name,status,error}));}if(failed)process.exitCode=1;`;
  const utility = batch18ReadinessProbeImage(receipt);
  assert(utility.image, 'private frontend Node probe image is missing from Batch18 receipt');
  assert.equal(imageIdForTag(utility.image), utility.imageId,
    'private frontend Node probe tag differs from the recorded image identity');
  const output = docker(['run', '--rm', '--network', state.project,
    '--label', `com.cloudstudy.uat.project=${state.project}`,
    '--entrypoint', 'node', utility.image, '--input-type=module', '-e', probe],
  { output: true, timeout: 180000 });
  const results = output.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(results.length, targets.length, 'private readiness probe count is incomplete');
  assert(results.every((result) => result.status === 200), 'one or more private services failed readiness');
  const after = validateSnapshot(containerSnapshot(state));
  assert.deepEqual(after, before, 'private Compose snapshot changed during readiness checks');
  assertSharedFingerprint(state);
  console.log(JSON.stringify({ project: state.project, phase: receipt.phase,
    checked: results.length, passed: results.length, results }));
}

function verify(stateFile) {
  const { state, paths, v17Receipt, receipt } = loadContext(stateFile);
  assert(['promoted', 'verified'].includes(receipt.phase), 'both Batch18 candidates must be promoted before verification');
  assert(receipt.proxyRefreshedForPhase === 'promoted'
    || (receipt.phase === 'verified' && receipt.proxyRefreshedForPhase === 'verified'),
  'restart the private HTTPS proxy and run readiness/browser checks before final verification');
  const config = JSON.parse(compose(state, paths, ['config', '--format', 'json'], { output: true }));
  assertComposeConfig(state, config, v17Receipt, receipt.images);
  const current = assertBatch18PromotionProgress(containerSnapshot(state), receipt.beforeSnapshot, receipt.imageIds);
  for (const service of BATCH18_SERVICES) {
    assert.equal(current[service].imageId, receipt.imageIds[service], `${service} is not running its exact Batch18 image`);
    assert.notEqual(current[service].containerId, receipt.beforeSnapshot[service].containerId,
      `${service} still has its pre-Batch18 container`);
    assert.equal(current[service].status, 'running', `${service} is not running`);
  }
  assertSharedFingerprint(state);
  receipt.phase = 'verified';
  receipt.verifiedSnapshot = current;
  receipt.sharedFingerprintAfter = sharedFingerprint();
  receipt.verifiedAt = new Date().toISOString();
  receipt.updatedAt = receipt.verifiedAt;
  writePrivateJson(paths.receipt, receipt);
  console.log('Batch18 private image identities, exact service scope, zero host ports, and shared fingerprint verified.');
}

function status(stateFile) {
  const { state, receipt } = loadContext(stateFile, { requireReceipt: false });
  console.log(JSON.stringify({
    project: state.project,
    phase: receipt?.phase || 'not-started',
    releaseTag: receipt?.releaseTag || BATCH18_RELEASE_TAG,
    services: [...BATCH18_SERVICES],
    promotedServices: receipt?.promotedServices || [],
    rolledBackServices: receipt?.rolledBackServices || [],
    proxyRefreshedForPhase: receipt?.proxyRefreshedForPhase || null,
    verified: receipt?.phase === 'verified',
    rolledBack: receipt?.phase === 'rolled-back'
  }));
}

function main() {
  const handlers = { 'dry-run': dryRun, preflight, promote, 'refresh-proxy': refreshProxy, readiness, verify, rollback, status };
  assert(handlers[command], 'unknown Batch18 private promotion command');
  handlers[command](stateFileArg);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    const diagnostic = process.env.CLOUDSTUDY_UAT_DIAGNOSTIC === '1' && error?.name === 'AssertionError'
      ? String(error?.message || '').split('\n', 1)[0].slice(0, 180)
      : '';
    console.error(`Batch18 private promotion failed closed; private outputs were suppressed.${diagnostic ? ` ${diagnostic}` : ''}`);
    process.exitCode = 1;
  }
}
