#!/usr/bin/env node
// Private, resumable Batch25 IAM promotion. Never builds images or writes SQL.
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
  BATCH18_PROJECT, BATCH18_OVERRIDE, BATCH18_RECEIPT, BATCH18_V17_RECEIPT
} from './batch18-private-site-promotion.mjs';
import { BATCH19_OVERRIDE, BATCH19_RECEIPT } from './batch19-private-promotion.mjs';
import { BATCH20_OVERRIDE, BATCH20_RECEIPT } from './batch20-private-promotion.mjs';
import { BATCH21_OVERRIDE, BATCH21_RECEIPT } from './batch21-private-promotion.mjs';
import { BATCH22_OVERRIDE, BATCH22_RECEIPT } from './batch22-private-promotion.mjs';
import {
  BATCH23_PROJECT, BATCH23_OVERRIDE, BATCH23_RECEIPT
} from './batch23-private-promotion.mjs';
import {
  BATCH24_IMAGE_IDS, BATCH24_OVERRIDE, BATCH24_PROJECT, BATCH24_RECEIPT,
  BATCH24_RELEASE_TAG, BATCH24_SERVICES, BATCH24_ROLLBACK_OVERRIDE,
  assertBatch24Baseline, assertBatch24Promoted, batch24CandidateImages,
  batch24OverrideText, batch24RollbackOverrideText
} from './batch24-private-promotion.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BATCH25_PROJECT = BATCH24_PROJECT;
export const BATCH25_RELEASE_TAG = '583ab627-uat-batch25-20260925';
export const BATCH25_SERVICES = Object.freeze(['iam-service']);
export const BATCH25_ORDER = Object.freeze(['iam-service']);
export const BATCH25_RECEIPT = 'batch25-iam-private-promotion.json';
export const BATCH25_OVERRIDE = 'docker-compose.batch25-iam-promotion.yml';
export const BATCH25_ROLLBACK_OVERRIDE = 'docker-compose.batch25-iam-rollback.yml';

// Fill only with the exact Docker image ID inspected after the approved build.
// Until then every command that could certify or change runtime state fails closed.
export const BATCH25_IMAGE_IDS = Object.freeze({
  'iam-service': 'sha256:4af1f94df3987615ecf4d8a3e8191f923936dde299f3cca1b89405674d46ba48'
});

const phases = Object.freeze(['preflighted', 'promoting', 'promoted', 'verified', 'rolling-back', 'rolled-back']);
const batch23Script = path.join(root, 'scripts/runtime/batch23-private-promotion.mjs');

function samePath(a, b) {
  const left = fs.existsSync(a) ? fs.realpathSync(a) : path.resolve(a);
  const right = fs.existsSync(b) ? fs.realpathSync(b) : path.resolve(b);
  return process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
}
function within(base, target) {
  const canonicalBase = fs.realpathSync(base); const canonicalTarget = fs.realpathSync(target);
  const relative = path.relative(canonicalBase, canonicalTarget);
  assert(relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative),
    'Batch25 state escaped its private temporary directory');
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
    b22Override: path.join(tempDir, BATCH22_OVERRIDE), b23: path.join(tempDir, BATCH23_RECEIPT),
    b23Override: path.join(tempDir, BATCH23_OVERRIDE), b24: path.join(tempDir, BATCH24_RECEIPT),
    b24Override: path.join(tempDir, BATCH24_OVERRIDE), b24Rollback: path.join(tempDir, BATCH24_ROLLBACK_OVERRIDE),
    receipt: path.join(tempDir, BATCH25_RECEIPT), override: path.join(tempDir, BATCH25_OVERRIDE),
    rollback: path.join(tempDir, BATCH25_ROLLBACK_OVERRIDE)
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
function ensureFile(file, contents) {
  if (fs.existsSync(file)) {
    const info = fs.lstatSync(file);
    assert(info.isFile() && !info.isSymbolicLink(), path.basename(file) + ' must be a private regular file');
    assert.equal(fs.readFileSync(file, 'utf8'), contents, path.basename(file) + ' differs from approved content');
    return;
  }
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, contents); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

export function batch25CandidateImages(tag = BATCH25_RELEASE_TAG) {
  assert.equal(tag, BATCH25_RELEASE_TAG, 'Batch25 release tag differs from approved tag');
  return { 'iam-service': `cloudstudy-clyunedev/iam-service:${tag}` };
}
export function assertBatch25ImageIdsReady(imageIds = BATCH25_IMAGE_IDS) {
  assert.deepEqual(Object.keys(imageIds || {}).sort(), [...BATCH25_SERVICES],
    'Batch25 image IDs must cover exactly iam-service');
  assert.match(imageIds['iam-service'] || '', /^sha256:[a-f0-9]{64}$/u,
    'Batch25 iam-service image ID is not filled from the built candidate image');
  return imageIds;
}
export function batch25OverrideText(images = batch25CandidateImages()) {
  assert.deepEqual(Object.keys(images || {}).sort(), [...BATCH25_SERVICES],
    'Batch25 overlay must contain exactly iam-service');
  assert.deepEqual(images, batch25CandidateImages(), 'iam-service image differs from the approved Batch25 tag');
  return `services:\n  iam-service:\n    image: ${images['iam-service']}\n`;
}
export function batch25RollbackOverrideText(baselineImages) {
  assert.deepEqual(Object.keys(baselineImages || {}).sort(), [...BATCH25_SERVICES],
    'Batch25 rollback overlay must contain exactly iam-service');
  assert.match(baselineImages['iam-service'] || '',
    /^cloudstudy-clyunedev\/iam-service:[A-Za-z0-9._-]{1,128}$/u,
    'iam-service rollback image must use its exact service repository and recorded tag');
  return `services:\n  iam-service:\n    image: ${baselineImages['iam-service']}\n`;
}
export function batch25ComposeArgs(service) {
  assert(BATCH25_SERVICES.includes(service), 'Batch25 may replace only iam-service');
  return ['up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--force-recreate', service];
}
export function batch25ReadinessTarget() {
  return ['iam-service', 18087, '/actuator/health/readiness'];
}

export function assertBatch25PrivateProxySnapshot(proxy, project = BATCH25_PROJECT) {
  assert(proxy && typeof proxy === 'object' && !Array.isArray(proxy), 'private proxy snapshot is missing');
  assert.equal(proxy.name, project + '-https-proxy');
  assert.match(proxy.containerId || '', /^[a-f0-9]{64}$/u);
  assert.match(proxy.imageId || '', /^sha256:[a-f0-9]{64}$/u);
  assert.equal(proxy.status, 'running');
  assert.equal(proxy.project, project);
  assert.deepEqual(proxy.networks, [project]);
  assert.deepEqual(proxy.portBindings, {});
  return proxy;
}

export function assertBatch25Baseline(current, batch24, batch23, state) {
  assert.equal(BATCH25_PROJECT, BATCH18_PROJECT);
  assert.equal(BATCH25_PROJECT, BATCH23_PROJECT);
  assert.equal(batch24?.project, BATCH25_PROJECT, 'Batch24 receipt belongs to another project');
  assert.equal(batch24.phase, 'verified', 'Batch24 must be verified before Batch25');
  assert.equal(batch24.releaseTag, BATCH24_RELEASE_TAG);
  assert.deepEqual(batch24.services, [...BATCH24_SERVICES]);
  assert.deepEqual(batch24.images, batch24CandidateImages());
  assert.deepEqual(batch24.imageIds, BATCH24_IMAGE_IDS);
  assert(batch24.baselineSnapshot && batch24.verifiedSnapshot, 'Batch24 snapshots are required');
  assert.deepEqual(batch24.beforeSharedFingerprint, state.sharedBefore,
    'Batch24 shared-project fingerprint differs from the private UAT state');
  assert.deepEqual(batch24.baselineSnapshot, batch23.verifiedSnapshot,
    'Batch24 baseline must be the exact verified Batch23 snapshot');
  assertBatch24Baseline(batch24.baselineSnapshot, batch23, state);
  assertBatch17PrivateSnapshot(current, BATCH25_PROJECT);
  assert.deepEqual(current, batch24.verifiedSnapshot,
    'Batch25 source snapshot must exactly match the Batch24 verified snapshot');
  assert.deepEqual(batch24.baselineImageIds, Object.fromEntries(BATCH24_SERVICES.map((service) =>
    [service, batch24.baselineSnapshot[service].imageId])));
  for (const service of BATCH24_SERVICES) {
    assert.equal(batch24.verifiedSnapshot[service].imageId, BATCH24_IMAGE_IDS[service],
      service + ' verified Batch24 image ID differs');
    assert.notEqual(batch24.verifiedSnapshot[service].containerId,
      batch24.baselineSnapshot[service].containerId, service + ' verified Batch24 container was not recreated');
    assert.equal(batch24.verifiedSnapshot[service].status, 'running',
      service + ' verified Batch24 service is not running');
  }
  assertBatch24Promoted(batch24.verifiedSnapshot, batch24);
  assert.equal(batch24.readinessPassed, 19, 'Batch24 must record 19/19 readiness');
  assert.equal((batch24.readinessResults || []).length, 19);
  assert((batch24.readinessResults || []).every((item) => item.status === 200));
  assert(['promoted', 'verified'].includes(batch24.proxyRefreshedForPhase),
    'Batch24 private proxy refresh is required');
  assertBatch25PrivateProxySnapshot(batch24.beforeProxy, BATCH25_PROJECT);
  return current;
}

export function assertBatch25Plan(baseline, candidate, rollback, images, baselineImages) {
  const services = [...BATCH17_PRIVATE_SERVICES].sort();
  assert.deepEqual(Object.keys(baseline.services || {}).sort(), services);
  assert.deepEqual(Object.keys(candidate.services || {}).sort(), services);
  assert.deepEqual(Object.keys(rollback.services || {}).sort(), services);
  assert.deepEqual(Object.keys(images || {}).sort(), [...BATCH25_SERVICES]);
  assert.deepEqual(Object.keys(baselineImages || {}).sort(), [...BATCH25_SERVICES]);
  for (const service of services) {
    if (service === 'iam-service') {
      assert.equal(candidate.services[service].image, images[service], 'IAM candidate image differs');
      assert.equal(rollback.services[service].image, baselineImages[service], 'IAM rollback image differs');
    } else {
      assert.equal(candidate.services[service].image, baseline.services[service].image,
        service + ' changed outside Batch25');
      assert.equal(rollback.services[service].image, baseline.services[service].image,
        service + ' rollback changed outside Batch25');
    }
  }
  return true;
}

export function assertBatch25Progress(current, receipt, { allowUnhealthyCandidate = false } = {}) {
  assertBatch17PrivateSnapshot(current, BATCH25_PROJECT);
  assertBatch17PrivateSnapshot(receipt.baselineSnapshot, BATCH25_PROJECT);
  assertBatch25ImageIdsReady(receipt.imageIds);
  for (const service of BATCH17_PRIVATE_SERVICES) {
    const actual = current[service]; const before = receipt.baselineSnapshot[service];
    if (service !== 'iam-service') {
      assert.deepEqual(actual, before, service + ' changed outside Batch25');
      continue;
    }
    if (actual.imageId === before.imageId) {
      if (receipt.phase === 'rolling-back' || receipt.phase === 'rolled-back') {
        assert.equal(actual.imageId, receipt.baselineImageIds[service]);
        assert.equal(actual.status, 'running', 'restored IAM baseline is not running');
        if (actual.containerId !== before.containerId) {
          if ((receipt.rolledBackServices || []).includes(service)) {
            assert.equal(actual.containerId, receipt.rolledBackSnapshot?.[service]?.containerId,
              'IAM rollback container differs from receipt');
          } else {
            assert.equal(receipt.phase, 'rolling-back', 'unrecorded IAM rollback container is not resumable');
            assert((receipt.rollbackInFlightServices || []).includes(service),
              'IAM rollback container has no durable intent');
          }
        } else assert.deepEqual(actual, before, 'IAM baseline container changed unexpectedly');
      } else assert.deepEqual(actual, before, 'IAM baseline container changed unexpectedly');
    } else {
      assert.equal(actual.imageId, receipt.imageIds[service], 'IAM runs an unapproved image');
      assert.notEqual(actual.containerId, before.containerId, 'IAM candidate container was not recreated');
      assert(allowUnhealthyCandidate || actual.status === 'running', 'IAM candidate is not running');
      const recorded = receipt.serviceSnapshots?.[service];
      if (recorded) assert.equal(actual.containerId, recorded.containerId, 'IAM container differs from receipt');
    }
  }
  return current;
}
export function assertBatch25ObservedProgress(current, receipt) {
  return assertBatch25Progress(current, receipt,
    { allowUnhealthyCandidate: ['promoting', 'rolling-back'].includes(receipt?.phase) });
}
export function assertBatch25Promoted(current, receipt) {
  assertBatch25Progress(current, receipt);
  assert.equal(current['iam-service'].imageId, receipt.imageIds['iam-service'], 'candidate IAM image is not running');
  assert.notEqual(current['iam-service'].containerId, receipt.baselineSnapshot['iam-service'].containerId,
    'candidate IAM container was not recreated');
  assert.equal(current['iam-service'].status, 'running', 'candidate IAM service is not running');
  assert.deepEqual(receipt.promotedServices, ['iam-service']);
  return current;
}
export function assertBatch25RollbackComplete(current, receipt) {
  assertBatch25Progress(current, receipt, { allowUnhealthyCandidate: true });
  assert.deepEqual(receipt.rollbackInFlightServices || [], [], 'rollback still has uncommitted IAM intent');
  assert(receipt.rolledBackServices.includes('iam-service'), 'IAM rollback has not been recorded');
  assert.equal(current['iam-service'].imageId, receipt.baselineImageIds['iam-service'],
    'Batch24 IAM baseline image was not restored');
  assert.equal(current['iam-service'].status, 'running', 'Batch24 IAM baseline is not running');
  return current;
}

function pathsInOrder(paths) {
  return [paths.b18Override, paths.b19Override, paths.b20Override, paths.b21Override,
    paths.b22Override, paths.b23Override, paths.b24Override];
}
function batch24ReceiptText(receipt) {
  assert.deepEqual(receipt.images, batch24CandidateImages());
  return batch24OverrideText(receipt.images);
}
function validateBatch24Receipt(batch24, batch23, paths, state) {
  assert.equal(batch24.format, 1); assert.equal(batch24.project, BATCH25_PROJECT);
  assert(samePath(batch24.stateFile, paths.stateFile));
  assert.equal(batch24.releaseTag, BATCH24_RELEASE_TAG);
  assert.equal(batch24.phase, 'verified', 'Batch24 must remain verified before Batch25');
  assert.deepEqual(batch24.services, [...BATCH24_SERVICES]);
  assert.deepEqual(batch24.images, batch24CandidateImages());
  assert.deepEqual(batch24.imageIds, BATCH24_IMAGE_IDS);
  assert.deepEqual(batch24.beforeSharedFingerprint, state.sharedBefore);
  assert.deepEqual(batch24.baselineSnapshot, batch23.verifiedSnapshot);
  assert.deepEqual(batch24.baselineImageIds, Object.fromEntries(BATCH24_SERVICES.map((service) =>
    [service, batch24.baselineSnapshot[service].imageId])));
  assert.deepEqual(batch24.promotedServices, [...BATCH24_SERVICES].sort());
  assertBatch17PrivateSnapshot(batch24.baselineSnapshot, BATCH25_PROJECT);
  assertBatch17PrivateSnapshot(batch24.verifiedSnapshot, BATCH25_PROJECT);
  assertBatch24Promoted(batch24.verifiedSnapshot, batch24);
  assert.equal(batch24.readinessPassed, 19);
  assert.equal((batch24.readinessResults || []).length, 19);
  assert((batch24.readinessResults || []).every((item) => item.status === 200));
  assert.deepEqual(batch24.readinessProbe, {
    service: 'official-site', image: batch24.images['official-site'],
    imageId: batch24.imageIds['official-site'], source: 'batch24-candidate'
  });
  assert(['promoted', 'verified'].includes(batch24.proxyRefreshedForPhase));
  assertBatch25PrivateProxySnapshot(batch24.beforeProxy, BATCH25_PROJECT);
  assert.equal(fs.readFileSync(paths.b24Override, 'utf8'), batch24ReceiptText(batch24));
  assert.equal(fs.readFileSync(paths.b24Rollback, 'utf8'),
    batch24RollbackOverrideText(batch24.baselineImages));
  return batch24;
}

function validateBatch24Context(stateFile) {
  assert(stateFile, 'usage: node batch25-iam-private-promotion.mjs <command> <private state.json>');
  const resolved = path.resolve(stateFile); const state = readJson(resolved, 'state.json');
  const paths = pathsFor(state);
  assert.equal(state.project, BATCH25_PROJECT, 'only the fixed private UAT project is allowed');
  assert(path.basename(paths.tempDir).startsWith(BATCH25_PROJECT + '-'));
  within(os.tmpdir(), paths.tempDir);
  assert(samePath(resolved, paths.stateFile));
  for (const [key, target] of Object.entries({ stateFile: paths.stateFile, envFile: paths.envFile,
    keyFile: paths.keyFile, overrideFile: paths.base })) assert(samePath(state[key], target));
  const prerequisites = [paths.tempDir, paths.stateFile, paths.envFile, paths.keyFile, paths.base,
    paths.v17, paths.b18, paths.b18Override, paths.b19, paths.b19Override, paths.b20,
    paths.b20Override, paths.b21, paths.b21Override, paths.b22, paths.b22Override,
    paths.b23, paths.b23Override, paths.b24, paths.b24Override, paths.b24Rollback];
  for (const file of prerequisites) {
    const info = fs.lstatSync(file);
    assert(file === paths.tempDir ? info.isDirectory() && !info.isSymbolicLink()
      : info.isFile() && !info.isSymbolicLink(), 'private Batch24 prerequisite path is invalid');
  }
  assertPrivateTempPermissions(state);

  // Batch23 status validates the earlier receipt chain without comparing live containers,
  // which Batch24 and this promotion intentionally replace in later batches.
  const check = spawnSync(process.execPath, [batch23Script, 'status', resolved], {
    cwd: root, env: safeEnv(), encoding: 'utf8', timeout: 60000,
    maxBuffer: 1024 * 1024, windowsHide: true
  });
  assert(!check.error && check.status === 0, 'Batch23 verified context validation failed; output was suppressed');
  const b23Status = JSON.parse(check.stdout.trim());
  assert.equal(b23Status.project, BATCH25_PROJECT);
  assert.equal(b23Status.phase, 'verified', 'Batch23 must remain verified before Batch25');
  const batch23 = readJson(paths.b23, 'Batch23 receipt');
  assert.equal(batch23.phase, 'verified');
  assert(samePath(batch23.stateFile, paths.stateFile));
  const batch24 = readJson(paths.b24, 'Batch24 receipt');
  validateBatch24Receipt(batch24, batch23, paths, state);
  const receipt = fs.existsSync(paths.receipt) ? readJson(paths.receipt, 'Batch25 receipt') : null;
  if (receipt) validateReceipt(receipt, paths, state, batch24);
  return { state, paths, batch23, batch24, receipt };
}

function docker(args, { output = false, timeout = 120000, input } = {}) {
  const result = spawnSync('docker', args, { cwd: root, env: safeEnv(), encoding: 'utf8', timeout,
    maxBuffer: 32 * 1024 * 1024, input, windowsHide: true });
  assert(!result.error && result.status === 0, 'private Batch25 Docker operation failed; output was suppressed');
  return output ? result.stdout.trim() : '';
}
function composeArgs(state, paths, overlays, args) {
  const files = ['compose', '-p', state.project, '--env-file', paths.envFile,
    '-f', path.join(root, 'infra/docker/clyunedev/docker-compose.core.yml'),
    '-f', path.join(root, 'infra/docker/clyunedev/docker-compose.full.yml'), '-f', paths.base,
    '-f', paths.b18Override, '-f', paths.b19Override, '-f', paths.b20Override,
    '-f', paths.b21Override, '-f', paths.b22Override, '-f', paths.b23Override, '-f', paths.b24Override];
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
    assert.equal(item.Config.Labels['com.docker.compose.project'], BATCH25_PROJECT);
    const service = item.Config.Labels['com.docker.compose.service'];
    assert(service && !Object.hasOwn(result, service), 'private service labels must be unique');
    result[service] = { containerId: item.Id, imageId: item.Image, status: item.State.Status,
      project: BATCH25_PROJECT, networks: Object.keys(item.NetworkSettings.Networks || {}).sort(),
      portBindings: item.HostConfig.PortBindings || {} };
  }
  return assertBatch17PrivateSnapshot(result, BATCH25_PROJECT);
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
    'shared yuxuexing-local fingerprint changed; Batch25 stopped');
}
function proxySnapshot(state) {
  const name = state.project + '-https-proxy';
  const items = JSON.parse(docker(['inspect', name], { output: true }));
  assert.equal(items.length, 1); const item = items[0];
  const result = { name, containerId: item.Id, imageId: item.Image, status: item.State.Status,
    project: item.Config.Labels['com.cloudstudy.uat.project'],
    networks: Object.keys(item.NetworkSettings.Networks || {}).sort(),
    portBindings: item.HostConfig.PortBindings || {} };
  assert.equal(result.project, state.project); assert.equal(result.status, 'running');
  assert.deepEqual(result.networks, [state.project]); assert.deepEqual(result.portBindings, {});
  return result;
}
function guardProxy(state, receipt = null) {
  assert.deepEqual(proxySnapshot(state), receipt?.beforeProxy || receipt?.baselineProxy,
    'private HTTPS proxy identity or boundary changed; Batch25 stopped');
}
function validateCompose(state, paths, images, baselineImages, { inline = false } = {}) {
  const baseline = composeConfig(state, paths);
  const candidate = inline
    ? composeConfig(state, paths, batch25OverrideText(images))
    : composeConfig(state, paths, null, [paths.override]);
  const rolledBack = inline
    ? composeConfig(state, paths, batch25RollbackOverrideText(baselineImages))
    : composeConfig(state, paths, null, [paths.rollback]);
  assertPrivateComposeIsolation(state, baseline); assertPrivateComposeIsolation(state, candidate);
  assertPrivateComposeIsolation(state, rolledBack);
  assertBatch25Plan(baseline, candidate, rolledBack, images, baselineImages);
  return { baseline, candidate, rolledBack };
}
function baselineImagesFrom(config) {
  return { 'iam-service': config.services['iam-service'].image };
}
function assertCandidateImagesLocked(images, expectedIds) {
  const actual = { 'iam-service': imageId(images['iam-service']) };
  assert.deepEqual(actual, expectedIds, 'Batch25 candidate tag now resolves to a different image ID');
  return actual;
}
function assertBaselineImagesLocked(images, baselineSnapshot) {
  assert.equal(imageId(images['iam-service']), baselineSnapshot['iam-service'].imageId,
    'Batch24 verified IAM baseline Compose image does not match its recorded image ID');
}
function validateReceipt(receipt, paths, state, batch24) {
  assert.equal(receipt.format, 1); assert.equal(receipt.project, BATCH25_PROJECT);
  assert(samePath(receipt.stateFile, paths.stateFile));
  assert.equal(receipt.releaseTag, BATCH25_RELEASE_TAG);
  assert.deepEqual(receipt.services, [...BATCH25_SERVICES]);
  assert.deepEqual(receipt.images, batch25CandidateImages());
  assertBatch25ImageIdsReady(); assert.deepEqual(receipt.imageIds, BATCH25_IMAGE_IDS);
  assert(phases.includes(receipt.phase));
  assert.deepEqual(receipt.baselineSnapshot, batch24.verifiedSnapshot,
    'Batch25 must remain anchored to the exact Batch24 verified snapshot');
  assert.deepEqual(receipt.beforeSharedFingerprint, state.sharedBefore);
  assert.deepEqual(receipt.baselineImageIds, { 'iam-service': receipt.baselineSnapshot['iam-service'].imageId });
  assert.deepEqual(Object.keys(receipt.baselineImages || {}), [...BATCH25_SERVICES]);
  assert.match(receipt.baselineImages['iam-service'] || '',
    /^cloudstudy-clyunedev\/iam-service:[A-Za-z0-9._-]{1,128}$/u);
  for (const field of ['promotedServices', 'rolledBackServices', 'rollbackInFlightServices']) {
    const items = receipt[field] || [];
    assert(Array.isArray(items), field + ' must be an array');
    assert(items.every((service) => BATCH25_SERVICES.includes(service)), field + ' contains an unapproved service');
    assert.equal(new Set(items).size, items.length, field + ' contains duplicates');
  }
  assert.deepEqual(receipt.probe, {
    image: batch24.images['official-site'], imageId: batch24.imageIds['official-site'],
    source: 'batch24-verified-official-site'
  });
  assert.deepEqual(receipt.baselineProxy, batch24.beforeProxy);
  assertBatch25PrivateProxySnapshot(receipt.baselineProxy, BATCH25_PROJECT);
  assertBatch17PrivateSnapshot(receipt.baselineSnapshot, BATCH25_PROJECT);
  assertBatch25Progress(receipt.baselineSnapshot, { ...receipt, phase: 'preflighted', serviceSnapshots: {} });
  for (const file of [paths.override, paths.rollback]) {
    const info = fs.lstatSync(file);
    assert(info.isFile() && !info.isSymbolicLink(), 'Batch25 Compose overlays must be private regular files');
  }
  assert.equal(fs.readFileSync(paths.override, 'utf8'), batch25OverrideText(receipt.images));
  assert.equal(fs.readFileSync(paths.rollback, 'utf8'), batch25RollbackOverrideText(receipt.baselineImages));
  if (receipt.phase === 'promoted' || receipt.phase === 'verified') assert.deepEqual(receipt.promotedServices, ['iam-service']);
  if (receipt.phase === 'verified') {
    assert.equal(receipt.readinessForPhase, 'promoted');
    assert.equal(receipt.readinessPassed, 1);
    assert.deepEqual(receipt.readinessResults, [{ name: 'iam-service', status: 200 }]);
    assert.equal(receipt.verifiedSnapshot?.['iam-service']?.imageId, receipt.imageIds['iam-service']);
  }
  if (receipt.phase === 'rolled-back') assertBatch25RollbackComplete(receipt.rolledBackSnapshot, receipt);
  return receipt;
}

function validateRuntime(context) {
  const { state, paths, batch24, receipt } = context;
  assert(receipt, 'Batch25 preflight receipt is required');
  validateReceipt(receipt, paths, state, batch24);
  const current = snapshot(state);
  assertBatch25ObservedProgress(current, receipt);
  if (receipt.phase === 'promoted' || receipt.phase === 'verified') assertBatch25Promoted(current, receipt);
  if (receipt.phase === 'rolled-back') assertBatch25RollbackComplete(current, receipt);
  guardShared(state, receipt); guardProxy(state, receipt);
  return current;
}
function updateReceipt(paths, receipt) {
  receipt.updatedAt = new Date().toISOString(); writeJson(paths.receipt, receipt);
}
function markPromoted(receipt, current) {
  receipt.serviceSnapshots['iam-service'] = structuredClone(current['iam-service']);
  receipt.promotedServices = ['iam-service'];
  receipt.lastVerifiedSnapshot = structuredClone(current);
  receipt.updatedAt = new Date().toISOString();
}

function dryRun(stateFile) {
  assertBatch25ImageIdsReady();
  const context = validateBatch24Context(stateFile); const { state, paths, batch24, receipt } = context;
  const current = snapshot(state); let baselineImages;
  const images = batch25CandidateImages();
  if (!receipt) {
    assertBatch25Baseline(current, batch24, context.batch23, state);
    baselineImages = baselineImagesFrom(composeConfig(state, paths));
    assertBaselineImagesLocked(baselineImages, current);
    assert.deepEqual(proxySnapshot(state), batch24.beforeProxy,
      'private proxy identity differs from the Batch24 verified baseline');
  } else {
    validateRuntime(context); baselineImages = receipt.baselineImages;
  }
  const ids = assertCandidateImagesLocked(images, BATCH25_IMAGE_IDS);
  assert.notEqual(ids['iam-service'], receipt?.baselineImageIds['iam-service'] || current['iam-service'].imageId,
    'Batch25 IAM candidate equals its Batch24 baseline');
  validateCompose(state, paths, images, baselineImages, { inline: !receipt });
  guardShared(state, receipt); guardProxy(state, receipt);
  console.log(JSON.stringify({ project: state.project, baseline: 'Batch24 verified',
    releaseTag: BATCH25_RELEASE_TAG, services: BATCH25_SERVICES,
    phase: receipt?.phase || 'not-started', imageIds: ids }));
}
function preflight(stateFile) {
  assertBatch25ImageIdsReady();
  const context = validateBatch24Context(stateFile); const { state, paths, batch24, receipt } = context;
  assert(!receipt, 'Batch25 receipt already exists; resume its phase');
  const before = snapshot(state); assertBatch25Baseline(before, batch24, context.batch23, state);
  guardShared(state); const beforeProxy = assertBatch25PrivateProxySnapshot(proxySnapshot(state));
  assert.deepEqual(beforeProxy, batch24.beforeProxy,
    'private proxy identity differs from the Batch24 verified baseline');
  const images = batch25CandidateImages(); const imageIds = assertCandidateImagesLocked(images, BATCH25_IMAGE_IDS);
  const baseline = composeConfig(state, paths); const baselineImages = baselineImagesFrom(baseline);
  const baselineImageIds = { 'iam-service': before['iam-service'].imageId };
  assertBaselineImagesLocked(baselineImages, before);
  assert.notEqual(imageIds['iam-service'], baselineImageIds['iam-service'],
    'Batch25 IAM candidate equals its Batch24 baseline');
  ensureFile(paths.override, batch25OverrideText(images));
  ensureFile(paths.rollback, batch25RollbackOverrideText(baselineImages));
  validateCompose(state, paths, images, baselineImages);
  const now = new Date().toISOString();
  writeJson(paths.receipt, {
    format: 1, project: state.project, stateFile: paths.stateFile,
    phase: 'preflighted', createdAt: now, updatedAt: now, releaseTag: BATCH25_RELEASE_TAG,
    baselineReleaseTag: BATCH24_RELEASE_TAG, services: [...BATCH25_SERVICES], images, imageIds,
    baselineImages, baselineImageIds, baselineSnapshot: structuredClone(before),
    beforeSharedFingerprint: structuredClone(state.sharedBefore), baselineProxy: structuredClone(beforeProxy),
    probe: { image: batch24.images['official-site'], imageId: batch24.imageIds['official-site'],
      source: 'batch24-verified-official-site' },
    promotedServices: [], serviceSnapshots: {}, lastVerifiedSnapshot: null,
    rolledBackServices: [], rollbackInFlightServices: [], rolledBackSnapshot: null,
    readinessForPhase: null, readinessResults: [], readinessPassed: 0
  });
  console.log('Batch25 preflight passed: exact Batch24 baseline, one locked IAM image ID, private Compose isolation, shared fingerprint and proxy identity verified.');
}
function promote(stateFile) {
  assertBatch25ImageIdsReady();
  const context = validateBatch24Context(stateFile); const { state, paths, receipt } = context;
  assert(receipt && ['preflighted', 'promoting', 'promoted', 'verified'].includes(receipt.phase),
    'Batch25 requires a completed preflight');
  let current = validateRuntime(context);
  validateCompose(state, paths, receipt.images, receipt.baselineImages);
  assertCandidateImagesLocked(receipt.images, receipt.imageIds);
  assertBaselineImagesLocked(receipt.baselineImages, receipt.baselineSnapshot);
  if (receipt.phase === 'promoted' || receipt.phase === 'verified') return;
  receipt.phase = 'promoting'; updateReceipt(paths, receipt);
  try {
    current = assertBatch25ObservedProgress(snapshot(state), receipt);
    if (current['iam-service'].imageId !== receipt.imageIds['iam-service']) {
      assert.equal(current['iam-service'].imageId, receipt.baselineImageIds['iam-service'],
        'IAM is neither the exact Batch24 baseline nor approved Batch25 candidate');
      compose(state, paths, [paths.override], batch25ComposeArgs('iam-service'), { timeout: 600000 });
      current = assertBatch25ObservedProgress(snapshot(state), receipt);
    }
    assert.equal(current['iam-service'].imageId, receipt.imageIds['iam-service']);
    assert.equal(current['iam-service'].status, 'running');
    markPromoted(receipt, current); updateReceipt(paths, receipt);
    guardShared(state, receipt); guardProxy(state, receipt);
    receipt.phase = 'promoted'; receipt.promotedSnapshot = structuredClone(current);
    receipt.readinessForPhase = null; receipt.readinessResults = []; receipt.readinessPassed = 0;
    updateReceipt(paths, receipt);
    console.log('The exact Batch25 IAM image is running; check its readiness before verification.');
  } catch {
    receipt.failureAt = new Date().toISOString(); receipt.failure = 'promotion failed; private rollback started';
    receipt.phase = 'rolling-back'; receipt.readinessForPhase = null;
    receipt.readinessResults = []; receipt.readinessPassed = 0; updateReceipt(paths, receipt);
    try { rollbackInternal(context, receipt); }
    catch { throw new Error('Batch25 promotion failed; private rollback is resumable with the rollback command'); }
    throw new Error('Batch25 promotion failed; the recorded Batch24 IAM baseline was restored in the private project');
  }
}
function rollbackInternal(context, receipt) {
  const { state, paths, batch24 } = context;
  validateReceipt(receipt, paths, state, batch24);
  assert.deepEqual(receipt.baselineSnapshot, batch24.verifiedSnapshot);
  guardShared(state, receipt); guardProxy(state, receipt);
  assertBaselineImagesLocked(receipt.baselineImages, receipt.baselineSnapshot);
  validateCompose(state, paths, receipt.images, receipt.baselineImages);
  receipt.phase = 'rolling-back'; receipt.readinessForPhase = null;
  receipt.readinessResults = []; receipt.readinessPassed = 0; updateReceipt(paths, receipt);
  let current = assertBatch25ObservedProgress(snapshot(state), receipt);
  if (current['iam-service'].imageId !== receipt.baselineImageIds['iam-service']) {
    assert.equal(current['iam-service'].imageId, receipt.imageIds['iam-service']);
    guardShared(state, receipt); guardProxy(state, receipt);
    receipt.rollbackInFlightServices = ['iam-service']; updateReceipt(paths, receipt);
    compose(state, paths, [paths.override, paths.rollback], batch25ComposeArgs('iam-service'), { timeout: 600000 });
    current = snapshot(state);
    receipt.rolledBackServices = ['iam-service']; receipt.rolledBackSnapshot = structuredClone(current);
    current = assertBatch25ObservedProgress(current, receipt);
  }
  assert.equal(current['iam-service'].imageId, receipt.baselineImageIds['iam-service']);
  assert.equal(current['iam-service'].status, 'running');
  receipt.rolledBackServices = ['iam-service'];
  receipt.rolledBackSnapshot = structuredClone(current); receipt.rollbackInFlightServices = [];
  updateReceipt(paths, receipt); guardShared(state, receipt); guardProxy(state, receipt);
  const after = assertBatch25RollbackComplete(snapshot(state), receipt);
  receipt.phase = 'rolled-back'; receipt.rolledBackSnapshot = structuredClone(after);
  updateReceipt(paths, receipt); guardShared(state, receipt); guardProxy(state, receipt);
}
function rollback(stateFile) {
  assertBatch25ImageIdsReady();
  const context = validateBatch24Context(stateFile); const { state, receipt } = context;
  assert(receipt && ['promoting', 'promoted', 'verified', 'rolling-back', 'rolled-back'].includes(receipt.phase),
    'Batch25 rollback requires a preflighted promotion attempt');
  if (receipt.phase === 'rolled-back') {
    const current = validateRuntime(context); assertBatch25RollbackComplete(current, receipt); return;
  }
  rollbackInternal(context, receipt);
  console.log('Batch25 rollback restored the exact Batch24 IAM image ID; the other 25 private service identities and shared fingerprint stayed unchanged.');
}

function runReadiness(state, receipt) {
  const [name, port, route] = batch25ReadinessTarget();
  assert.equal(imageId(receipt.probe.image), receipt.probe.imageId,
    'Batch24 verified official-site probe image tag no longer resolves to its recorded image ID');
  const script = `const target=${JSON.stringify([name, port, route])};\n` +
    'let status=0;for(let attempt=0;attempt<15&&status!==200;attempt++){try{status=(await fetch("http://"+target[0]+":"+target[1]+target[2],{signal:AbortSignal.timeout(5000)})).status}catch{}if(status!==200)await new Promise(r=>setTimeout(r,1000));}\n' +
    'console.log(JSON.stringify({name:target[0],status}));if(status!==200)process.exit(1);';
  const out = docker(['run', '--pull=never', '--rm', '--network', state.project, '--label',
    'com.cloudstudy.uat.project=' + state.project, '--entrypoint', 'node', receipt.probe.image,
    '--input-type=module', '-e', script], { output: true, timeout: 120000 });
  const results = out.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
  assert.deepEqual(results, [{ name, status: 200 }]);
  return results;
}
function readiness(stateFile) {
  assertBatch25ImageIdsReady();
  const context = validateBatch24Context(stateFile); const { state, paths, receipt } = context;
  assert(receipt && ['promoted', 'verified', 'rolled-back'].includes(receipt.phase));
  const before = validateRuntime(context);
  if (receipt.phase === 'rolled-back') assertBatch25RollbackComplete(before, receipt);
  else assertBatch25Promoted(before, receipt);
  guardShared(state, receipt); guardProxy(state, receipt);
  const results = runReadiness(state, receipt);
  assert.deepEqual(snapshot(state), before, 'IAM readiness probe changed the private service snapshot');
  guardShared(state, receipt); guardProxy(state, receipt);
  receipt.readinessForPhase = receipt.phase; receipt.readinessResults = results;
  receipt.readinessPassed = 1; receipt.readinessAt = new Date().toISOString(); updateReceipt(paths, receipt);
  console.log(JSON.stringify({ project: state.project, phase: receipt.phase,
    checked: 1, passed: 1, results }));
}
function verify(stateFile) {
  assertBatch25ImageIdsReady();
  const context = validateBatch24Context(stateFile); const { state, paths, receipt } = context;
  assert(receipt && ['promoted', 'verified'].includes(receipt.phase));
  const before = assertBatch25Promoted(validateRuntime(context), receipt);
  assertCandidateImagesLocked(receipt.images, receipt.imageIds);
  assertBaselineImagesLocked(receipt.baselineImages, receipt.baselineSnapshot);
  assert.equal(receipt.readinessForPhase, 'promoted', 'IAM readiness must pass after promotion before verify');
  assert.equal(receipt.readinessPassed, 1);
  guardShared(state, receipt); guardProxy(state, receipt);
  const results = runReadiness(state, receipt);
  assert.deepEqual(snapshot(state), before); guardShared(state, receipt); guardProxy(state, receipt);
  receipt.phase = 'verified'; receipt.verifiedSnapshot = structuredClone(before);
  receipt.readinessForPhase = 'promoted'; receipt.readinessResults = results;
  receipt.readinessPassed = 1; receipt.verifiedAt = new Date().toISOString(); updateReceipt(paths, receipt);
  console.log('Batch25 verified: one exact candidate IAM image ID, unchanged 25 service identities, unchanged shared fingerprint and proxy identity, and IAM readiness returned 200.');
}
function status(stateFile) {
  const context = validateBatch24Context(stateFile); const { state, receipt } = context;
  const current = snapshot(state);
  if (receipt) validateRuntime(context);
  else {
    assertBatch25Baseline(current, context.batch24, context.batch23, state);
    guardShared(state);
    assert.deepEqual(proxySnapshot(state), context.batch24.beforeProxy,
      'private proxy identity differs from the Batch24 verified baseline');
  }
  console.log(JSON.stringify({ project: state.project, baseline: 'Batch24 verified',
    phase: receipt?.phase || 'not-started', releaseTag: BATCH25_RELEASE_TAG,
    services: BATCH25_SERVICES, imageIdConfigured: /^sha256:[a-f0-9]{64}$/u.test(BATCH25_IMAGE_IDS['iam-service']),
    promotedServices: receipt?.promotedServices || [], rolledBackServices: receipt?.rolledBackServices || [],
    readinessPassed: receipt?.readinessPassed || 0,
    iam: { imageId: current['iam-service'].imageId, status: current['iam-service'].status,
      containerId: current['iam-service'].containerId }, verified: receipt?.phase === 'verified' }));
}

function main() {
  const [command, stateFile] = process.argv.slice(2);
  const handlers = { 'dry-run': dryRun, preflight, promote, readiness, verify, rollback, status };
  assert(handlers[command], 'unknown Batch25 private IAM promotion command');
  handlers[command](stateFile);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) {
    const detail = process.env.CLOUDSTUDY_UAT_DIAGNOSTIC === '1' && error?.name === 'AssertionError'
      ? ' ' + String(error.message || '').split('\n', 1)[0].slice(0, 160) : '';
    console.error('Batch25 private IAM promotion failed closed; private outputs were suppressed.' + detail);
    process.exitCode = 1;
  }
}
