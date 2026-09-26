#!/usr/bin/env node
// Private, resumable Batch20 promotion. No database writes or shared-project commands.
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
  BATCH19_SERVICES, assertBatch19DryRunSnapshot, batch19CandidateImages,
  batch19OverrideText, batch19ReadinessTargets
} from './batch19-private-promotion.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BATCH20_PROJECT = BATCH18_PROJECT;
export const BATCH20_RELEASE_TAG = '583ab627-uat-batch20-20260925';
export const BATCH20_SERVICES = Object.freeze(['api-gateway', 'admin-web', 'mobile-h5']);
export const BATCH20_ORDER = Object.freeze(['admin-web', 'mobile-h5', 'api-gateway']);
export const BATCH20_RECEIPT = 'batch20-private-promotion.json';
export const BATCH20_OVERRIDE = 'docker-compose.batch20-promotion.yml';
export const BATCH20_ROLLBACK_OVERRIDE = 'docker-compose.batch20-rollback.yml';
export const BATCH20_IMAGE_IDS = Object.freeze({
  'api-gateway': 'sha256:22f6c2761ed0ed17b1b2f882105e21f24d72ba6f05edab536aae2d5643468072',
  'admin-web': 'sha256:69f8618a1a5bc6bd95bea289625f1448130a01039bb956652c4e7928e27f288c',
  'mobile-h5': 'sha256:89a09c93ad95b4f668ac23babb1e41e703ba39325d7b0ee1d46638128ead3304'
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
    'Batch20 state escaped its private temporary directory');
  return canonicalTarget;
}
function pathsFor(state) {
  const tempDir = path.resolve(state.tempDir || '');
  return {
    tempDir, stateFile: path.join(tempDir, 'state.json'), envFile: path.join(tempDir, 'uat.env'),
    keyFile: path.join(tempDir, 'iam-rsa-private.pem'), base: path.join(tempDir, 'docker-compose.isolated.yml'),
    v17: path.join(tempDir, BATCH18_V17_RECEIPT), b18: path.join(tempDir, BATCH18_RECEIPT),
    b18Override: path.join(tempDir, BATCH18_OVERRIDE), b19: path.join(tempDir, BATCH19_RECEIPT),
    b19Override: path.join(tempDir, BATCH19_OVERRIDE), receipt: path.join(tempDir, BATCH20_RECEIPT),
    override: path.join(tempDir, BATCH20_OVERRIDE), rollback: path.join(tempDir, BATCH20_ROLLBACK_OVERRIDE)
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

export function batch20CandidateImages(tag = BATCH20_RELEASE_TAG) {
  assert.equal(tag, BATCH20_RELEASE_TAG, 'Batch20 release tag differs from approved tag');
  return Object.fromEntries(BATCH20_SERVICES.map((service) =>
    [service, `cloudstudy-clyunedev/${service}:${tag}`]));
}
export function batch20OverrideText(images = batch20CandidateImages()) {
  assert.deepEqual(Object.keys(images).sort(), [...BATCH20_SERVICES].sort(),
    'Batch20 overlay must contain exactly its three approved services');
  const approved = batch20CandidateImages();
  for (const service of BATCH20_SERVICES) assert.equal(images[service], approved[service]);
  return 'services:\n' + BATCH20_SERVICES.map((service) =>
    `  ${service}:\n    image: ${images[service]}\n`).join('');
}
export function batch20RollbackOverrideText(baselineImages) {
  assert.deepEqual(Object.keys(baselineImages || {}).sort(), [...BATCH20_SERVICES].sort(),
    'rollback overlay must contain exactly the three recorded baseline images');
  for (const service of BATCH20_SERVICES) assert.match(baselineImages[service] || '',
    new RegExp(`^cloudstudy-clyunedev/${service}:[A-Za-z0-9._-]+$`, 'u'));
  return 'services:\n' + BATCH20_SERVICES.map((service) =>
    `  ${service}:\n    image: ${baselineImages[service]}\n`).join('');
}
export function batch20ComposeArgs(service) {
  assert(BATCH20_SERVICES.includes(service), 'Batch20 may replace only its three approved services');
  return ['up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--force-recreate', service];
}
export function assertBatch20Baseline(current, batch19) {
  assert.equal(batch19?.project, BATCH20_PROJECT);
  assert.equal(batch19?.phase, 'verified', 'Batch19 must be verified before Batch20');
  assert.deepEqual(batch19.services, [...BATCH19_SERVICES]);
  assert.deepEqual(batch19.images, batch19CandidateImages());
  assert.deepEqual(batch19.quiescedServices, []);
  assert(batch19.verifiedSnapshot, 'Batch19 verified container snapshot is missing');
  assertBatch17PrivateSnapshot(current, BATCH20_PROJECT);
  assert.deepEqual(current, batch19.verifiedSnapshot,
    'Batch20 source container/image IDs must exactly match the Batch19 verified snapshot');
  return current;
}
export function assertBatch20Plan(baseline, candidate, rollback, images, baselineImages) {
  const services = [...BATCH17_PRIVATE_SERVICES].sort();
  assert.deepEqual(Object.keys(baseline.services || {}).sort(), services);
  assert.deepEqual(Object.keys(candidate.services || {}).sort(), services);
  assert.deepEqual(Object.keys(rollback.services || {}).sort(), services);
  assert.deepEqual(Object.keys(images || {}).sort(), [...BATCH20_SERVICES].sort());
  assert.deepEqual(Object.keys(baselineImages || {}).sort(), [...BATCH20_SERVICES].sort());
  for (const service of services) {
    if (BATCH20_SERVICES.includes(service)) {
      assert.equal(candidate.services[service].image, images[service], service + ' candidate image differs');
      assert.equal(rollback.services[service].image, baselineImages[service], service + ' rollback image differs');
    } else {
      assert.equal(candidate.services[service].image, baseline.services[service].image,
        service + ' changed outside Batch20');
      assert.equal(rollback.services[service].image, baseline.services[service].image,
        service + ' rollback changed outside Batch20');
    }
  }
  return true;
}
export function assertBatch20Progress(current, receipt, { allowUnhealthyCandidate = false } = {}) {
  assertBatch17PrivateSnapshot(current, BATCH20_PROJECT);
  assertBatch17PrivateSnapshot(receipt.baselineSnapshot, BATCH20_PROJECT);
  for (const service of BATCH17_PRIVATE_SERVICES) {
    const actual = current[service]; const before = receipt.baselineSnapshot[service];
    if (!BATCH20_SERVICES.includes(service)) {
      assert.deepEqual(actual, before, service + ' changed outside Batch20');
      continue;
    }
    if (actual.imageId === before.imageId) {
      if (receipt.phase === 'rolling-back' || receipt.phase === 'rolled-back') {
        assert.equal(actual.imageId, receipt.baselineImageIds[service]);
        assert.equal(actual.status, 'running', service + ' restored baseline image is not running');
        if (actual.containerId !== before.containerId) {
          assert((receipt.rolledBackServices || []).includes(service), service + ' rollback container is not recorded');
          const recordedRollback = receipt.rolledBackSnapshot?.[service];
          assert(recordedRollback, service + ' rollback snapshot is missing');
          assert.equal(actual.containerId, recordedRollback.containerId,
            service + ' rollback container differs from receipt');
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
export function assertBatch20RollbackComplete(current, receipt) {
  assertBatch20Progress(current, receipt, { allowUnhealthyCandidate: true });
  for (const service of BATCH20_SERVICES) {
    assert.equal(current[service].imageId, receipt.baselineSnapshot[service].imageId,
      service + ' baseline image was not restored');
    assert.equal(current[service].status, 'running', service + ' baseline image is not running');
  }
  return current;
}

function validateContext(stateFile) {
  assert(stateFile, 'usage: node batch20-private-promotion.mjs <command> <private state.json>');
  const resolved = path.resolve(stateFile); const state = readJson(resolved, 'state.json');
  const paths = pathsFor(state);
  assert.equal(state.project, BATCH20_PROJECT, 'only the approved private UAT project is allowed');
  assert.equal(state.tag, '583ab627-uat-batch9-202609231740');
  assert.equal(state.batch17ReleaseTag, '583ab627-uat-batch17-202609250206');
  within(os.tmpdir(), paths.tempDir);
  assert(path.basename(paths.tempDir).startsWith(BATCH20_PROJECT + '-'));
  assert(samePath(resolved, paths.stateFile));
  for (const [key, target] of Object.entries({ stateFile: paths.stateFile, envFile: paths.envFile,
    keyFile: paths.keyFile, overrideFile: paths.base })) assert(samePath(state[key], target));
  for (const file of [paths.tempDir, paths.stateFile, paths.envFile, paths.keyFile, paths.base,
    paths.v17, paths.b18, paths.b18Override, paths.b19, paths.b19Override]) {
    const info = fs.lstatSync(file);
    assert(file === paths.tempDir ? info.isDirectory() && !info.isSymbolicLink()
      : info.isFile() && !info.isSymbolicLink(), 'private prerequisite path is invalid');
  }
  assertPrivateTempPermissions(state);
  const v17 = readJson(paths.v17, 'IAM V17 receipt'); const b18 = readJson(paths.b18, 'Batch18 receipt');
  const b19 = readJson(paths.b19, 'Batch19 receipt');
  assert.equal(v17.project, BATCH20_PROJECT); assert.equal(v17.phase, 'complete');
  assert.equal(v17.candidateImage, BATCH18_IAM_IMAGE);
  assert.equal(b18.project, BATCH20_PROJECT); assert.equal(b18.phase, 'verified');
  assert.equal(b18.releaseTag, BATCH18_RELEASE_TAG);
  assert.deepEqual(b18.images, batch18CandidateImages());
  assert.deepEqual(b18.beforeSharedFingerprint, state.sharedBefore);
  assert.equal(b19.project, BATCH20_PROJECT); assert(samePath(b19.stateFile, paths.stateFile));
  assert.equal(b19.releaseTag, BATCH19_RELEASE_TAG);
  assert.deepEqual(b19.beforeSharedFingerprint, state.sharedBefore);
  const batch20 = fs.existsSync(paths.receipt) ? readJson(paths.receipt, 'Batch20 receipt') : null;
  if (batch20) validateReceipt(batch20, paths);
  return { state, paths, v17, b18, b19, receipt: batch20 };
}
function validateReceipt(receipt, paths) {
  assert.equal(receipt.format, 1); assert.equal(receipt.project, BATCH20_PROJECT);
  assert(samePath(receipt.stateFile, paths.stateFile));
  assert.equal(receipt.releaseTag, BATCH20_RELEASE_TAG);
  assert.deepEqual(receipt.services, [...BATCH20_SERVICES]);
  assert.deepEqual(receipt.images, batch20CandidateImages());
  assert.deepEqual(Object.keys(receipt.imageIds || {}).sort(), [...BATCH20_SERVICES].sort());
  for (const service of BATCH20_SERVICES) assert.equal(receipt.imageIds[service], BATCH20_IMAGE_IDS[service]);
  assert.deepEqual(Object.keys(receipt.baselineImages || {}).sort(), [...BATCH20_SERVICES].sort());
  assert.deepEqual(Object.keys(receipt.baselineImageIds || {}).sort(), [...BATCH20_SERVICES].sort());
  assert(phases.includes(receipt.phase));
  for (const file of [paths.override, paths.rollback]) {
    const info = fs.lstatSync(file);
    assert(info.isFile() && !info.isSymbolicLink(), 'Batch20 Compose overlays must be private regular files');
  }
  assert.equal(receipt.officialSiteImage?.image, batch18CandidateImages()['official-site']);
  assert.match(receipt.officialSiteImage?.imageId || '', /^sha256:[a-f0-9]{64}$/u);
  assertBatch17PrivateSnapshot(receipt.baselineSnapshot, BATCH20_PROJECT);
  for (const service of BATCH20_SERVICES) {
    assert.equal(receipt.baselineSnapshot[service].imageId, receipt.baselineImageIds[service]);
  }
  assert.equal(fs.readFileSync(paths.override, 'utf8'), batch20OverrideText(receipt.images));
  assert.equal(fs.readFileSync(paths.rollback, 'utf8'), batch20RollbackOverrideText(receipt.baselineImages));
  return receipt;
}

function docker(args, { output = false, timeout = 120000, input } = {}) {
  const result = spawnSync('docker', args, { cwd: root, env: safeEnv(), encoding: 'utf8', timeout,
    maxBuffer: 32 * 1024 * 1024, input, windowsHide: true });
  assert(!result.error && result.status === 0, 'private Batch20 Docker operation failed; output was suppressed');
  return output ? result.stdout.trim() : '';
}
function composeArgs(state, paths, overlays, args) {
  const files = ['compose', '-p', state.project, '--env-file', paths.envFile,
    '-f', path.join(root, 'infra/docker/clyunedev/docker-compose.core.yml'),
    '-f', path.join(root, 'infra/docker/clyunedev/docker-compose.full.yml'),
    '-f', paths.base, '-f', paths.b18Override, '-f', paths.b19Override];
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
    assert.equal(item.Config.Labels['com.docker.compose.project'], BATCH20_PROJECT);
    const service = item.Config.Labels['com.docker.compose.service'];
    assert(service && !Object.hasOwn(result, service));
    result[service] = { containerId: item.Id, imageId: item.Image, status: item.State.Status,
      project: BATCH20_PROJECT, networks: Object.keys(item.NetworkSettings.Networks || {}).sort(),
      portBindings: item.HostConfig.PortBindings || {} };
  }
  return assertBatch17PrivateSnapshot(result, BATCH20_PROJECT);
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
    'shared yuxuexing-local fingerprint changed; Batch20 stopped');
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
    ? composeConfig(state, paths, batch20OverrideText(images))
    : composeConfig(state, paths, null, [paths.override]);
  const rolledBack = inline
    ? composeConfig(state, paths, batch20RollbackOverrideText(baselineImages))
    : composeConfig(state, paths, null, [paths.override, paths.rollback]);
  assertPrivateComposeIsolation(state, base); assertPrivateComposeIsolation(state, target);
  assertPrivateComposeIsolation(state, rolledBack);
  assertBatch20Plan(base, target, rolledBack, images, baselineImages);
  return { base, target, rolledBack };
}
function validateBatch19Baseline(current, { state, paths, b18, b19, v17 }) {
  assertBatch20Baseline(current, b19);
  assert.deepEqual(current, b19.verifiedSnapshot);
  assertBatch19DryRunSnapshot(current, { receipt: b19, b18, v17 });
  assert.equal(b19.readinessPassed, 19);
  assert.equal((b19.readinessResults || []).length, 19);
  assert((b19.readinessResults || []).every((item) => item.status === 200));
  guardShared(state);
}
function dryRun(stateFile) {
  const context = validateContext(stateFile); const { state, paths, b18, b19, v17, receipt } = context;
  const current = snapshot(state);
  if (!receipt) validateBatch19Baseline(current, context);
  else {
    validateReceipt(receipt, paths);
    assert.deepEqual(receipt.baselineSnapshot, b19.verifiedSnapshot);
    assertBatch19DryRunSnapshot(receipt.baselineSnapshot, { receipt: b19, b18, v17 });
    assertBatch20Progress(current, receipt, { allowUnhealthyCandidate: receipt.phase === 'rolling-back' });
    guardShared(state, receipt);
  }
  const images = batch20CandidateImages();
  const candidateIds = Object.fromEntries(BATCH20_SERVICES.map((service) => [service, imageId(images[service])]));
  assert.deepEqual(candidateIds, BATCH20_IMAGE_IDS, 'Batch20 tag now points to a different image build');
  const base = composeConfig(state, paths);
  const baselineImages = Object.fromEntries(BATCH20_SERVICES.map((service) => [service, base.services[service].image]));
  for (const service of BATCH20_SERVICES) {
    const baselineId = receipt?.baselineSnapshot[service].imageId || current[service].imageId;
    assert.equal(imageId(baselineImages[service]), baselineId,
      service + ' baseline tag does not match the verified source image ID');
    assert.notEqual(candidateIds[service], baselineId, service + ' candidate equals baseline');
  }
  validateCompose(state, paths, images, baselineImages, true);
  if (receipt) {
    assert.deepEqual(receipt.baselineImages, baselineImages);
    assert.deepEqual(receipt.baselineImageIds, Object.fromEntries(BATCH20_SERVICES.map((service) =>
      [service, receipt.baselineSnapshot[service].imageId])));
  }
  guardShared(state, receipt);
  console.log(JSON.stringify({ project: state.project, releaseTag: BATCH20_RELEASE_TAG,
    services: BATCH20_SERVICES, phase: receipt?.phase || 'not-started', images: candidateIds }));
}
function preflight(stateFile) {
  const context = validateContext(stateFile); const { state, paths, b18, b19, v17, receipt } = context;
  assert(!receipt, 'Batch20 receipt already exists; resume its phase');
  const before = snapshot(state); validateBatch19Baseline(before, context);
  const images = batch20CandidateImages();
  const imageIds = Object.fromEntries(BATCH20_SERVICES.map((service) => [service, imageId(images[service])]));
  assert.deepEqual(imageIds, BATCH20_IMAGE_IDS, 'Batch20 tag now points to a different image build');
  const base = composeConfig(state, paths);
  const baselineImages = Object.fromEntries(BATCH20_SERVICES.map((service) => [service, base.services[service].image]));
  const baselineImageIds = Object.fromEntries(BATCH20_SERVICES.map((service) => [service, imageId(baselineImages[service])]));
  for (const service of BATCH20_SERVICES) {
    assert.equal(before[service].imageId, baselineImageIds[service], service + ' source image differs from Batch19');
    assert.notEqual(imageIds[service], baselineImageIds[service]);
  }
  const overrideText = batch20OverrideText(images); const rollbackText = batch20RollbackOverrideText(baselineImages);
  const priorOverride = paths.override; const priorRollback = paths.rollback;
  ensureFile(priorOverride, overrideText); ensureFile(priorRollback, rollbackText);
  validateCompose(state, paths, images, baselineImages);
  guardShared(state);
  const now = new Date().toISOString();
  writeJson(paths.receipt, { format: 1, project: state.project, stateFile: paths.stateFile,
    phase: 'preflighted', createdAt: now, updatedAt: now, releaseTag: BATCH20_RELEASE_TAG,
    services: [...BATCH20_SERVICES], images, imageIds, baselineImages, baselineImageIds,
    baselineSnapshot: structuredClone(before), beforeProxy: proxySnapshot(state),
    officialSiteImage: { image: b18.images['official-site'], imageId: b18.imageIds['official-site'] },
    beforeSharedFingerprint: structuredClone(state.sharedBefore), promotedServices: [],
    serviceSnapshots: {}, rolledBackServices: [] });
  console.log('Batch20 preflight passed: three exact image IDs, exact Batch19 source snapshot, private Compose and shared fingerprint verified.');
}
function validateRuntime(context, { requireReceipt = true } = {}) {
  const { state, paths, b18, b19, v17 } = context; const receipt = context.receipt;
  assert(!requireReceipt || receipt, 'Batch20 preflight receipt is required');
  const current = snapshot(state);
  if (!receipt) validateBatch19Baseline(current, context);
  else {
    validateReceipt(receipt, paths);
    assert.deepEqual(receipt.beforeSharedFingerprint, state.sharedBefore);
    assert.deepEqual(receipt.baselineSnapshot, b19.verifiedSnapshot);
    assertBatch19DryRunSnapshot(receipt.baselineSnapshot, { receipt: b19, b18, v17 });
    assertBatch20Progress(current, receipt, { allowUnhealthyCandidate: receipt.phase === 'rolling-back' });
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
  const context = validateContext(stateFile); const { state, paths, receipt } = context;
  assert(receipt && ['preflighted', 'promoting', 'promoted', 'verified'].includes(receipt.phase));
  let current = validateRuntime(context);
  validateCompose(state, paths, receipt.images, receipt.baselineImages);
  for (const service of BATCH20_SERVICES) assert.equal(imageId(receipt.images[service]), receipt.imageIds[service]);
  if (receipt.phase === 'promoted' || receipt.phase === 'verified') return;
  receipt.phase = 'promoting'; updateReceipt(paths, receipt);
  try {
    for (const service of BATCH20_ORDER) {
      current = assertBatch20Progress(snapshot(state), receipt);
      if (current[service].imageId !== receipt.imageIds[service]) {
        assert.equal(current[service].imageId, receipt.baselineImageIds[service]);
        compose(state, paths, [paths.override], batch20ComposeArgs(service), { timeout: 600000 });
        current = assertBatch20Progress(snapshot(state), receipt);
      }
      assert.equal(current[service].imageId, receipt.imageIds[service]);
      assert.equal(current[service].status, 'running');
      markPromoted(receipt, current, service); updateReceipt(paths, receipt);
      guardShared(state, receipt);
    }
    current = assertBatch20Progress(snapshot(state), receipt);
    assert(BATCH20_SERVICES.every((service) => current[service].status === 'running'));
    receipt.phase = 'promoted'; receipt.promotedSnapshot = structuredClone(current);
    updateReceipt(paths, receipt); guardShared(state, receipt);
    console.log('Three exact Batch20 images are running; refresh the private proxy and run readiness checks.');
  } catch {
    receipt.failureAt = new Date().toISOString(); receipt.failure = 'promotion failed; private rollback started';
    receipt.phase = 'rolling-back'; updateReceipt(paths, receipt);
    try { rollbackInternal(context, receipt); }
    catch { throw new Error('Batch20 promotion failed; private rollback is resumable with the rollback command'); }
    throw new Error('Batch20 promotion failed; recorded baseline images were restored in the private project');
  }
}
function rollbackInternal(context, receipt) {
  const { state, paths } = context;
  validateReceipt(receipt, paths);
  assert.deepEqual(receipt.baselineSnapshot, context.b19.verifiedSnapshot);
  guardShared(state, receipt);
  const baselineConfig = composeConfig(state, paths);
  const baseImages = Object.fromEntries(BATCH20_SERVICES.map((service) => [service, baselineConfig.services[service].image]));
  assert.deepEqual(baseImages, receipt.baselineImages);
  for (const service of BATCH20_SERVICES) assert.equal(imageId(baseImages[service]), receipt.baselineImageIds[service]);
  validateCompose(state, paths, receipt.images, receipt.baselineImages);
  receipt.phase = 'rolling-back'; updateReceipt(paths, receipt);
  for (const service of [...BATCH20_ORDER].reverse()) {
    let current = assertBatch20Progress(snapshot(state), receipt, { allowUnhealthyCandidate: true });
    if (current[service].imageId !== receipt.baselineImageIds[service]) {
      assert.equal(current[service].imageId, receipt.imageIds[service]);
      guardShared(state, receipt);
      compose(state, paths, [paths.override, paths.rollback], batch20ComposeArgs(service), { timeout: 600000 });
      current = snapshot(state);
      receipt.rolledBackServices = [...new Set([...receipt.rolledBackServices, service])].sort();
      receipt.rolledBackSnapshot = structuredClone(current);
      current = assertBatch20Progress(current, receipt, { allowUnhealthyCandidate: true });
    }
    assert.equal(current[service].imageId, receipt.baselineImageIds[service]);
    assert.equal(current[service].status, 'running');
    receipt.rolledBackServices = [...new Set([...receipt.rolledBackServices, service])].sort();
    receipt.rolledBackSnapshot = structuredClone(current); updateReceipt(paths, receipt);
    guardShared(state, receipt);
  }
  const after = assertBatch20RollbackComplete(snapshot(state), receipt);
  receipt.phase = 'rolled-back'; receipt.rolledBackSnapshot = structuredClone(after);
  updateReceipt(paths, receipt); guardShared(state, receipt);
}
function rollback(stateFile) {
  const context = validateContext(stateFile); const receipt = context.receipt;
  assert(receipt && ['promoting', 'promoted', 'verified', 'rolling-back', 'rolled-back'].includes(receipt.phase),
    'Batch20 rollback requires a preflighted promotion attempt');
  if (receipt.phase === 'rolled-back') {
    validateRuntime(context);
    assertBatch20RollbackComplete(snapshot(context.state), receipt);
    guardShared(context.state, receipt);
    return;
  }
  rollbackInternal(context, receipt);
  console.log('Batch20 rollback restored all three recorded baseline image IDs; other private services stayed unchanged.');
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
  for (const service of BATCH20_SERVICES) {
    assert.equal(before[service].imageId, receipt.imageIds[service]);
    assert.notEqual(before[service].containerId, receipt.baselineSnapshot[service].containerId);
    assert.equal(before[service].status, 'running');
  }
  const results = runReadiness(state, receipt);
  assert.deepEqual(snapshot(state), before); guardShared(state, receipt);
  receipt.phase = 'verified'; receipt.verifiedSnapshot = structuredClone(before);
  receipt.readinessResults = results; receipt.readinessPassed = 19;
  receipt.verifiedAt = new Date().toISOString(); updateReceipt(paths, receipt);
  console.log('Batch20 verified: three exact candidate image IDs, unchanged 23 service identities and 19/19 readiness.');
}
function status(stateFile) {
  const { state, receipt } = validateContext(stateFile);
  console.log(JSON.stringify({ project: state.project, phase: receipt?.phase || 'not-started',
    releaseTag: BATCH20_RELEASE_TAG, services: BATCH20_SERVICES,
    promotedServices: receipt?.promotedServices || [], rolledBackServices: receipt?.rolledBackServices || [],
    readinessPassed: receipt?.readinessPassed || 0, verified: receipt?.phase === 'verified' }));
}
function main() {
  const [command, stateFile] = process.argv.slice(2);
  const handlers = { 'dry-run': dryRun, preflight, promote, 'refresh-proxy': refreshProxy,
    readiness, verify, rollback, status };
  assert(handlers[command], 'unknown Batch20 private promotion command'); handlers[command](stateFile);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) {
    const detail = process.env.CLOUDSTUDY_UAT_DIAGNOSTIC === '1' && error?.name === 'AssertionError'
      ? ' ' + String(error.message || '').split('\n', 1)[0].slice(0, 160) : '';
    console.error('Batch20 private promotion failed closed; private outputs were suppressed.' + detail);
    process.exitCode = 1;
  }
}
