#!/usr/bin/env node
// Private, resumable Batch24 frontend promotion. Never builds images or touches shared services.
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
import { BATCH18_PROJECT, BATCH18_OVERRIDE } from './batch18-private-site-promotion.mjs';
import { BATCH19_OVERRIDE, batch19ReadinessTargets } from './batch19-private-promotion.mjs';
import { BATCH20_OVERRIDE } from './batch20-private-promotion.mjs';
import { BATCH21_OVERRIDE } from './batch21-private-promotion.mjs';
import { BATCH22_OVERRIDE } from './batch22-private-promotion.mjs';
import {
  BATCH23_IMAGE_IDS, BATCH23_ORDER, BATCH23_OVERRIDE, BATCH23_PROJECT,
  BATCH23_RECEIPT, BATCH23_RELEASE_TAG, BATCH23_SERVICES,
  assertBatch23ImageIdsReady, assertBatch23Progress, batch23CandidateImages
} from './batch23-private-promotion.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BATCH24_PROJECT = BATCH23_PROJECT;
export const BATCH24_RELEASE_TAG = '583ab627-uat-batch24-20260925';
export const BATCH24_SERVICES = Object.freeze(['official-site', 'learner-web', 'admin-web', 'mobile-h5']);
export const BATCH24_ORDER = Object.freeze(['official-site', 'learner-web', 'admin-web', 'mobile-h5']);
export const BATCH24_RECEIPT = 'batch24-private-promotion.json';
export const BATCH24_OVERRIDE = 'docker-compose.batch24-promotion.yml';
export const BATCH24_ROLLBACK_OVERRIDE = 'docker-compose.batch24-rollback.yml';

// Exact IDs inspected after the four final frontend images were each built once.
// Commands that can change or certify runtime state fail closed if a tag drifts.
export const BATCH24_IMAGE_IDS = Object.freeze({
  'official-site': 'sha256:6b4d3f131dee4f1dffd754a874c54ca2b2dd260c823ca0d68be99245efd4c350',
  'learner-web': 'sha256:65604b139b39b342903ffef24e0c97db234bc62ee158a62722a65a8a697c2e62',
  'admin-web': 'sha256:0b1476bc48285a819999f57766899981f6fd5d39b6f7f0f2cf5369e293c5d8aa',
  'mobile-h5': 'sha256:2e5bf1468649d95c990aa5e95e666605fe1be18d24e110bd886c24b28d57473c'
});

const phases = Object.freeze(['preflighted', 'promoting', 'promoted', 'verified', 'rolling-back', 'rolled-back']);
const b23Script = path.join(root, 'scripts/runtime/batch23-private-promotion.mjs');

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
    'Batch24 state escaped its private temporary directory');
  return canonicalTarget;
}
function pathsFor(state) {
  const tempDir = path.resolve(state.tempDir || '');
  return {
    tempDir,
    stateFile: path.join(tempDir, 'state.json'),
    envFile: path.join(tempDir, 'uat.env'),
    keyFile: path.join(tempDir, 'iam-rsa-private.pem'),
    base: path.join(tempDir, 'docker-compose.isolated.yml'),
    b18Override: path.join(tempDir, BATCH18_OVERRIDE),
    b19Override: path.join(tempDir, BATCH19_OVERRIDE),
    b20Override: path.join(tempDir, BATCH20_OVERRIDE),
    b21Override: path.join(tempDir, BATCH21_OVERRIDE),
    b22Override: path.join(tempDir, BATCH22_OVERRIDE),
    b23: path.join(tempDir, BATCH23_RECEIPT),
    b23Override: path.join(tempDir, BATCH23_OVERRIDE),
    receipt: path.join(tempDir, BATCH24_RECEIPT),
    override: path.join(tempDir, BATCH24_OVERRIDE),
    rollback: path.join(tempDir, BATCH24_ROLLBACK_OVERRIDE)
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

export function batch24CandidateImages(tag = BATCH24_RELEASE_TAG) {
  assert.equal(tag, BATCH24_RELEASE_TAG, 'Batch24 release tag differs from approved tag');
  return Object.fromEntries(BATCH24_SERVICES.map((service) =>
    [service, `cloudstudy-clyunedev/${service}:${tag}`]));
}
export function assertBatch24ImageIdsReady(imageIds = BATCH24_IMAGE_IDS) {
  assert.deepEqual(Object.keys(imageIds || {}).sort(), [...BATCH24_SERVICES].sort(),
    'Batch24 image IDs must cover exactly official-site, learner-web, admin-web, and mobile-h5');
  for (const service of BATCH24_SERVICES) {
    assert.match(imageIds[service] || '', /^sha256:[a-f0-9]{64}$/u,
      `Batch24 ${service} image ID is not filled from the built candidate image`);
  }
  return imageIds;
}
export function batch24OverrideText(images = batch24CandidateImages()) {
  assert.deepEqual(Object.keys(images || {}).sort(), [...BATCH24_SERVICES].sort(),
    'Batch24 overlay must contain exactly the four approved frontend services');
  const approved = batch24CandidateImages();
  for (const service of BATCH24_SERVICES) assert.equal(images[service], approved[service],
    service + ' image differs from the approved Batch24 tag');
  return 'services:\n' + BATCH24_SERVICES.map((service) =>
    `  ${service}:\n    image: ${images[service]}\n`).join('');
}
export function batch24RollbackOverrideText(baselineImages) {
  assert.deepEqual(Object.keys(baselineImages || {}).sort(), [...BATCH24_SERVICES].sort(),
    'rollback overlay must contain exactly the four recorded baseline images');
  for (const service of BATCH24_SERVICES) assert.match(baselineImages[service] || '',
    new RegExp(`^cloudstudy-clyunedev/${service}:[A-Za-z0-9._-]{1,128}$`, 'u'),
    service + ' rollback image must use its exact service repository and recorded tag');
  return 'services:\n' + BATCH24_SERVICES.map((service) =>
    `  ${service}:\n    image: ${baselineImages[service]}\n`).join('');
}
export function batch24ComposeArgs(service) {
  assert(BATCH24_SERVICES.includes(service), 'Batch24 may replace only the four approved frontend services');
  return ['up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--force-recreate', service];
}

export function assertBatch24Baseline(current, batch23, state) {
  assert.equal(BATCH24_PROJECT, BATCH18_PROJECT);
  assert.equal(batch23?.project, BATCH24_PROJECT, 'Batch23 receipt belongs to another project');
  assert.equal(batch23.phase, 'verified', 'Batch23 must be verified before Batch24');
  assert.equal(batch23.releaseTag, BATCH23_RELEASE_TAG);
  assert.deepEqual(batch23.services, [...BATCH23_SERVICES]);
  assert.deepEqual(batch23.images, batch23CandidateImages());
  assert.deepEqual(batch23.imageIds, BATCH23_IMAGE_IDS);
  assertBatch23ImageIdsReady(batch23.imageIds);
  assert(batch23.baselineSnapshot && batch23.verifiedSnapshot, 'Batch23 snapshots are required');
  assert.deepEqual(batch23.beforeSharedFingerprint, state.sharedBefore,
    'Batch23 shared-project fingerprint differs from the private UAT state');
  assert.deepEqual(batch23.baselineImageIds, Object.fromEntries(BATCH23_SERVICES.map((service) =>
    [service, batch23.baselineSnapshot[service].imageId])));
  for (const service of BATCH23_SERVICES) {
    assert.equal(batch23.verifiedSnapshot[service].imageId, BATCH23_IMAGE_IDS[service],
      service + ' verified Batch23 image ID differs');
    assert.notEqual(batch23.verifiedSnapshot[service].containerId,
      batch23.baselineSnapshot[service].containerId, service + ' verified Batch23 container was not recreated');
    assert.equal(batch23.verifiedSnapshot[service].status, 'running',
      service + ' verified Batch23 service is not running');
  }
  assert.equal(batch23.readinessPassed, 19, 'Batch23 must record 19/19 readiness');
  assert.equal((batch23.readinessResults || []).length, 19);
  assert((batch23.readinessResults || []).every((item) => item.status === 200));
  assert.equal(batch23.proxyRefreshedForPhase, 'promoted', 'Batch23 private proxy must be refreshed');
  assertBatch23Progress(batch23.verifiedSnapshot, batch23);
  assertBatch17PrivateSnapshot(current, BATCH24_PROJECT);
  assert.deepEqual(current, batch23.verifiedSnapshot,
    'Batch24 source container and image IDs must exactly match the Batch23 verified snapshot');
  return current;
}

export function assertBatch24Plan(baseline, candidate, rollback, images, baselineImages) {
  const services = [...BATCH17_PRIVATE_SERVICES].sort();
  assert.deepEqual(Object.keys(baseline.services || {}).sort(), services);
  assert.deepEqual(Object.keys(candidate.services || {}).sort(), services);
  assert.deepEqual(Object.keys(rollback.services || {}).sort(), services);
  assert.deepEqual(Object.keys(images || {}).sort(), [...BATCH24_SERVICES].sort());
  assert.deepEqual(Object.keys(baselineImages || {}).sort(), [...BATCH24_SERVICES].sort());
  for (const service of services) {
    if (BATCH24_SERVICES.includes(service)) {
      assert.equal(candidate.services[service].image, images[service], service + ' candidate image differs');
      assert.equal(rollback.services[service].image, baselineImages[service], service + ' rollback image differs');
    } else {
      assert.equal(candidate.services[service].image, baseline.services[service].image,
        service + ' changed outside Batch24');
      assert.equal(rollback.services[service].image, baseline.services[service].image,
        service + ' rollback changed outside Batch24');
    }
  }
  return true;
}

export function assertBatch24Progress(current, receipt, { allowUnhealthyCandidate = false } = {}) {
  assertBatch17PrivateSnapshot(current, BATCH24_PROJECT);
  assertBatch17PrivateSnapshot(receipt.baselineSnapshot, BATCH24_PROJECT);
  assertBatch24ImageIdsReady(receipt.imageIds);
  for (const service of BATCH17_PRIVATE_SERVICES) {
    const actual = current[service]; const before = receipt.baselineSnapshot[service];
    if (!BATCH24_SERVICES.includes(service)) {
      assert.deepEqual(actual, before, service + ' changed outside Batch24');
      continue;
    }
    if (actual.imageId === before.imageId) {
      if (receipt.phase === 'rolling-back' || receipt.phase === 'rolled-back') {
        assert.equal(actual.imageId, receipt.baselineImageIds[service]);
        assert.equal(actual.status, 'running', service + ' restored baseline image is not running');
        if (actual.containerId !== before.containerId) {
          const recorded = (receipt.rolledBackServices || []).includes(service);
          if (recorded) {
            const restored = receipt.rolledBackSnapshot?.[service];
            assert(restored, service + ' rollback snapshot is missing');
            assert.equal(actual.containerId, restored.containerId, service + ' rollback container differs from receipt');
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

/**
 * Observe an interrupted transaction without weakening its identity checks.
 * Candidate containers may be between create/start only while promotion or
 * rollback is actively in progress; ordinary verified phases stay strict.
 */
export function assertBatch24ObservedProgress(current, receipt) {
  const allowUnhealthyCandidate = ['promoting', 'rolling-back'].includes(receipt?.phase);
  return assertBatch24Progress(current, receipt, { allowUnhealthyCandidate });
}

export function assertBatch24Promoted(current, receipt) {
  assertBatch24Progress(current, receipt);
  for (const service of BATCH24_SERVICES) {
    assert.equal(current[service].imageId, receipt.imageIds[service], service + ' candidate image is not running');
    assert.notEqual(current[service].containerId, receipt.baselineSnapshot[service].containerId,
      service + ' candidate container was not recreated');
    assert.equal(current[service].status, 'running', service + ' candidate service is not running');
  }
  return current;
}
export function assertBatch24RollbackComplete(current, receipt) {
  assertBatch24Progress(current, receipt, { allowUnhealthyCandidate: true });
  assert.deepEqual(receipt.rollbackInFlightServices || [], [], 'rollback still has uncommitted service intents');
  for (const service of BATCH24_SERVICES) {
    assert.equal(current[service].imageId, receipt.baselineSnapshot[service].imageId,
      service + ' baseline image was not restored');
    assert.equal(current[service].status, 'running', service + ' baseline image is not running');
  }
  return current;
}

/** The readiness probe is always the official-site image for the active release phase. */
export function batch24ReadinessProbe(receipt) {
  assert(receipt && phases.includes(receipt.phase), 'Batch24 receipt phase is invalid');
  const rollingBack = receipt.phase === 'rolling-back' || receipt.phase === 'rolled-back';
  const image = rollingBack ? receipt.baselineImages?.['official-site'] : receipt.images?.['official-site'];
  const imageId = rollingBack ? receipt.baselineImageIds?.['official-site'] : receipt.imageIds?.['official-site'];
  assert(image && /^sha256:[a-f0-9]{64}$/u.test(imageId || ''), 'official-site readiness image and exact ID are required');
  return { service: 'official-site', image, imageId, source: rollingBack ? 'recorded-baseline' : 'batch24-candidate' };
}

function validateReceipt(receipt, paths, state, batch23) {
  assert.equal(receipt.format, 1); assert.equal(receipt.project, BATCH24_PROJECT);
  assert(samePath(receipt.stateFile, paths.stateFile));
  assert.equal(receipt.releaseTag, BATCH24_RELEASE_TAG);
  assert.deepEqual(receipt.services, [...BATCH24_SERVICES]);
  const approvedImages = batch24CandidateImages();
  assert.deepEqual(receipt.images, approvedImages);
  assertBatch24ImageIdsReady();
  assert.deepEqual(receipt.imageIds, BATCH24_IMAGE_IDS);
  assert.deepEqual(Object.keys(receipt.baselineImages || {}).sort(), [...BATCH24_SERVICES].sort());
  assert.deepEqual(Object.keys(receipt.baselineImageIds || {}).sort(), [...BATCH24_SERVICES].sort());
  assert(phases.includes(receipt.phase));
  assert.deepEqual(receipt.baselineSnapshot, batch23.verifiedSnapshot,
    'Batch24 receipt must remain anchored to the exact Batch23 verified snapshot');
  assert.deepEqual(receipt.beforeSharedFingerprint, state.sharedBefore);
  assertBatch17PrivateSnapshot(receipt.baselineSnapshot, BATCH24_PROJECT);
  assert.deepEqual(receipt.baselineImageIds, Object.fromEntries(BATCH24_SERVICES.map((service) =>
    [service, receipt.baselineSnapshot[service].imageId])));
  for (const service of BATCH24_SERVICES) {
    assert(receipt.baselineImages[service], service + ' recorded baseline Compose image is missing');
    assert.match(receipt.baselineImages[service], new RegExp(`^cloudstudy-clyunedev/${service}:[A-Za-z0-9._-]{1,128}$`, 'u'));
  }
  for (const field of ['promotedServices', 'rolledBackServices', 'rollbackInFlightServices']) {
    const items = receipt[field] || [];
    assert(Array.isArray(items), field + ' must be an array');
    assert(items.every((service) => BATCH24_SERVICES.includes(service)), field + ' contains an unapproved service');
    assert.equal(new Set(items).size, items.length, field + ' contains duplicate services');
  }
  assertBatch24Progress(receipt.baselineSnapshot, { ...receipt, phase: 'preflighted', serviceSnapshots: {} });
  for (const file of [paths.override, paths.rollback]) {
    const info = fs.lstatSync(file);
    assert(info.isFile() && !info.isSymbolicLink(), 'Batch24 Compose overlays must be private regular files');
  }
  assert.equal(fs.readFileSync(paths.override, 'utf8'), batch24OverrideText(receipt.images));
  assert.equal(fs.readFileSync(paths.rollback, 'utf8'), batch24RollbackOverrideText(receipt.baselineImages));
  if (receipt.phase === 'promoted' || receipt.phase === 'verified') {
    assert.deepEqual(receipt.promotedServices, [...BATCH24_SERVICES].sort());
  }
  if (receipt.phase === 'verified') {
    assert.equal(receipt.readinessPassed, 19);
    assert.equal((receipt.readinessResults || []).length, 19);
    assert((receipt.readinessResults || []).every((item) => item.status === 200));
    assert.deepEqual(receipt.readinessProbe,
      { service: 'official-site', image: receipt.images['official-site'],
        imageId: receipt.imageIds['official-site'], source: 'batch24-candidate' });
    assert(['promoted', 'verified'].includes(receipt.proxyRefreshedForPhase),
      'verified Batch24 receipt must record its private proxy refresh');
  }
  return receipt;
}

function validateBatch23Context(stateFile) {
  assert(stateFile, 'usage: node batch24-private-promotion.mjs <command> <private state.json>');
  const resolved = path.resolve(stateFile); const state = readJson(resolved, 'state.json');
  const paths = pathsFor(state);
  assert.equal(state.project, BATCH24_PROJECT, 'only the fixed Batch23 private UAT project is allowed');
  assert.equal(path.basename(paths.tempDir).startsWith(BATCH24_PROJECT + '-'), true);
  within(os.tmpdir(), paths.tempDir);
  assert(samePath(resolved, paths.stateFile));
  for (const [key, target] of Object.entries({ stateFile: paths.stateFile, envFile: paths.envFile,
    keyFile: paths.keyFile, overrideFile: paths.base })) assert(samePath(state[key], target));
  assertPrivateTempPermissions(state);

  // Reuse Batch23's complete path/ACL/receipt-chain validation without changing its private state.
  const check = spawnSync(process.execPath, [b23Script, 'status', resolved], {
    cwd: root, env: safeEnv(), encoding: 'utf8', timeout: 60000,
    maxBuffer: 1024 * 1024, windowsHide: true
  });
  assert(!check.error && check.status === 0, 'Batch23 verified context validation failed; output was suppressed');
  const b23Status = JSON.parse(check.stdout.trim());
  assert.equal(b23Status.project, BATCH24_PROJECT);
  assert.equal(b23Status.phase, 'verified', 'Batch23 must remain verified before Batch24');
  const batch23 = readJson(paths.b23, 'Batch23 receipt');
  assert.deepEqual(batch23.services, [...BATCH23_SERVICES]);
  assert.equal(batch23.releaseTag, BATCH23_RELEASE_TAG);
  assert(samePath(batch23.stateFile, paths.stateFile));
  assertBatch24Baseline(batch23.verifiedSnapshot, batch23, state);
  const receipt = fs.existsSync(paths.receipt) ? readJson(paths.receipt, 'Batch24 receipt') : null;
  if (receipt) validateReceipt(receipt, paths, state, batch23);
  return { state, paths, batch23, receipt };
}

function docker(args, { output = false, timeout = 120000, input } = {}) {
  const result = spawnSync('docker', args, { cwd: root, env: safeEnv(), encoding: 'utf8', timeout,
    maxBuffer: 32 * 1024 * 1024, input, windowsHide: true });
  assert(!result.error && result.status === 0, 'private Batch24 Docker operation failed; output was suppressed');
  return output ? result.stdout.trim() : '';
}
function composeArgs(state, paths, overlays, args) {
  const files = ['compose', '-p', state.project, '--env-file', paths.envFile,
    '-f', path.join(root, 'infra/docker/clyunedev/docker-compose.core.yml'),
    '-f', path.join(root, 'infra/docker/clyunedev/docker-compose.full.yml'),
    '-f', paths.base, '-f', paths.b18Override, '-f', paths.b19Override,
    '-f', paths.b20Override, '-f', paths.b21Override, '-f', paths.b22Override,
    '-f', paths.b23Override];
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
    assert.equal(item.Config.Labels['com.docker.compose.project'], BATCH24_PROJECT);
    const service = item.Config.Labels['com.docker.compose.service'];
    assert(service && !Object.hasOwn(result, service));
    result[service] = { containerId: item.Id, imageId: item.Image, status: item.State.Status,
      project: BATCH24_PROJECT, networks: Object.keys(item.NetworkSettings.Networks || {}).sort(),
      portBindings: item.HostConfig.PortBindings || {} };
  }
  return assertBatch17PrivateSnapshot(result, BATCH24_PROJECT);
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
    'shared yuxuexing-local fingerprint changed; Batch24 stopped');
}
function proxySnapshot(state) {
  const name = state.project + '-https-proxy';
  const items = JSON.parse(docker(['inspect', name], { output: true }));
  assert.equal(items.length, 1); const item = items[0];
  const proxy = { name, containerId: item.Id, imageId: item.Image, status: item.State.Status,
    project: item.Config.Labels['com.cloudstudy.uat.project'],
    networks: Object.keys(item.NetworkSettings.Networks || {}).sort(),
    portBindings: item.HostConfig.PortBindings || {} };
  assert.equal(proxy.project, state.project); assert.equal(proxy.status, 'running');
  assert.deepEqual(proxy.networks, [state.project]); assert.deepEqual(proxy.portBindings, {});
  return proxy;
}
function validateCompose(state, paths, images, baselineImages, { inline = false } = {}) {
  const base = composeConfig(state, paths);
  const candidate = inline
    ? composeConfig(state, paths, batch24OverrideText(images))
    : composeConfig(state, paths, null, [paths.override]);
  const rolledBack = inline
    ? composeConfig(state, paths, batch24RollbackOverrideText(baselineImages))
    : composeConfig(state, paths, null, [paths.rollback]);
  assertPrivateComposeIsolation(state, base); assertPrivateComposeIsolation(state, candidate);
  assertPrivateComposeIsolation(state, rolledBack);
  assertBatch24Plan(base, candidate, rolledBack, images, baselineImages);
  return { base, candidate, rolledBack };
}

function validateRuntime(context) {
  const { state, paths, batch23, receipt } = context;
  assert(receipt, 'Batch24 preflight receipt is required');
  validateReceipt(receipt, paths, state, batch23);
  const current = snapshot(state);
  assertBatch24ObservedProgress(current, receipt);
  if (receipt.phase === 'promoted' || receipt.phase === 'verified') assertBatch24Promoted(current, receipt);
  if (receipt.phase === 'rolled-back') assertBatch24RollbackComplete(current, receipt);
  guardShared(state, receipt);
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
function imageIdsFor(images) {
  return Object.fromEntries(BATCH24_SERVICES.map((service) => [service, imageId(images[service])]));
}
function assertCandidateImagesLocked(images, expectedIds) {
  const actual = imageIdsFor(images);
  assert.deepEqual(actual, expectedIds, 'Batch24 candidate tags now resolve to different image IDs');
  return actual;
}
function baselineImagesFrom(config) {
  return Object.fromEntries(BATCH24_SERVICES.map((service) => [service, config.services[service].image]));
}
function assertBaselineImagesLocked(images, baselineSnapshot) {
  for (const service of BATCH24_SERVICES) assert.equal(imageId(images[service]), baselineSnapshot[service].imageId,
    service + ' baseline Compose image does not match the Batch23 verified image ID');
}

function dryRun(stateFile) {
  assertBatch24ImageIdsReady();
  const context = validateBatch23Context(stateFile); const { state, paths, batch23, receipt } = context;
  const current = snapshot(state);
  let baselineImages; let images = batch24CandidateImages();
  if (!receipt) {
    assertBatch24Baseline(current, batch23, state);
    baselineImages = baselineImagesFrom(composeConfig(state, paths));
    assertBaselineImagesLocked(baselineImages, current);
  } else {
    validateRuntime(context);
    baselineImages = receipt.baselineImages;
    assert.deepEqual(receipt.baselineSnapshot, batch23.verifiedSnapshot);
  }
  const candidateIds = assertCandidateImagesLocked(images, BATCH24_IMAGE_IDS);
  for (const service of BATCH24_SERVICES) assert.notEqual(candidateIds[service],
    receipt?.baselineImageIds[service] || current[service].imageId, service + ' candidate equals the Batch23 baseline');
  validateCompose(state, paths, images, baselineImages, { inline: !receipt });
  guardShared(state, receipt);
  console.log(JSON.stringify({ project: state.project, baseline: 'Batch23 verified',
    releaseTag: BATCH24_RELEASE_TAG, services: BATCH24_SERVICES,
    phase: receipt?.phase || 'not-started', imageIds: candidateIds }));
}
function preflight(stateFile) {
  assertBatch24ImageIdsReady();
  const context = validateBatch23Context(stateFile); const { state, paths, batch23, receipt } = context;
  assert(!receipt, 'Batch24 receipt already exists; resume its phase');
  const before = snapshot(state); assertBatch24Baseline(before, batch23, state); guardShared(state);
  const images = batch24CandidateImages(); const imageIds = assertCandidateImagesLocked(images, BATCH24_IMAGE_IDS);
  const base = composeConfig(state, paths); const baselineImages = baselineImagesFrom(base);
  const baselineImageIds = Object.fromEntries(BATCH24_SERVICES.map((service) =>
    [service, before[service].imageId]));
  assertBaselineImagesLocked(baselineImages, before);
  for (const service of BATCH24_SERVICES) assert.notEqual(imageIds[service], baselineImageIds[service],
    service + ' candidate equals its Batch23 baseline');
  const overrideText = batch24OverrideText(images); const rollbackText = batch24RollbackOverrideText(baselineImages);
  ensureFile(paths.override, overrideText); ensureFile(paths.rollback, rollbackText);
  validateCompose(state, paths, images, baselineImages);

  // Probe all 19 routes with the new official-site image before any service replacement.
  const preflightReceipt = { phase: 'preflighted', images, imageIds, baselineImages, baselineImageIds };
  const prePromotionReadiness = runReadiness(state, preflightReceipt);
  assert.deepEqual(snapshot(state), before, 'Batch24 preflight readiness changed the Batch23 baseline');
  guardShared(state);
  const now = new Date().toISOString();
  writeJson(paths.receipt, {
    format: 1, project: state.project, stateFile: paths.stateFile,
    phase: 'preflighted', createdAt: now, updatedAt: now, releaseTag: BATCH24_RELEASE_TAG,
    baselineReleaseTag: BATCH23_RELEASE_TAG, services: [...BATCH24_SERVICES], images, imageIds,
    baselineImages, baselineImageIds, baselineSnapshot: structuredClone(before),
    beforeProxy: proxySnapshot(state), beforeSharedFingerprint: structuredClone(state.sharedBefore),
    prePromotionReadinessProbe: prePromotionReadiness.probe,
    prePromotionReadinessResults: prePromotionReadiness.results, prePromotionReadinessPassed: 19,
    promotedServices: [], serviceSnapshots: {}, lastVerifiedSnapshot: null,
    rolledBackServices: [], rollbackInFlightServices: [], rolledBackSnapshot: null,
    proxyRefreshedForPhase: null, proxyRefreshedAt: null,
    readinessProbe: null, readinessResults: [], readinessPassed: 0
  });
  console.log('Batch24 preflight passed: exact Batch23 baseline, four locked image IDs, candidate-site 19/19 readiness, private Compose and shared fingerprint verified.');
}
function promote(stateFile) {
  assertBatch24ImageIdsReady();
  const context = validateBatch23Context(stateFile); const { state, paths, receipt } = context;
  assert(receipt && ['preflighted', 'promoting', 'promoted', 'verified'].includes(receipt.phase),
    'Batch24 requires a completed preflight');
  let current = validateRuntime(context);
  validateCompose(state, paths, receipt.images, receipt.baselineImages);
  assertCandidateImagesLocked(receipt.images, receipt.imageIds);
  assertBaselineImagesLocked(receipt.baselineImages, receipt.baselineSnapshot);
  if (receipt.phase === 'promoted' || receipt.phase === 'verified') return;
  receipt.phase = 'promoting'; updateReceipt(paths, receipt);
  try {
    for (const service of BATCH24_ORDER) {
      current = assertBatch24Progress(snapshot(state), receipt);
      if (current[service].imageId !== receipt.imageIds[service]) {
        assert.equal(current[service].imageId, receipt.baselineImageIds[service],
          service + ' is neither the exact Batch23 baseline nor approved Batch24 image');
        compose(state, paths, [paths.override], batch24ComposeArgs(service), { timeout: 600000 });
        current = assertBatch24Progress(snapshot(state), receipt);
      }
      assert.equal(current[service].imageId, receipt.imageIds[service]);
      assert.equal(current[service].status, 'running');
      markPromoted(receipt, current, service); updateReceipt(paths, receipt);
      guardShared(state, receipt);
    }
    current = assertBatch24Promoted(snapshot(state), receipt);
    receipt.phase = 'promoted'; receipt.promotedSnapshot = structuredClone(current);
    receipt.proxyRefreshedForPhase = null; receipt.readinessProbe = null;
    receipt.readinessResults = []; receipt.readinessPassed = 0;
    updateReceipt(paths, receipt); guardShared(state, receipt);
    console.log('Four exact Batch24 frontend images are running. Refresh the private proxy and run 19-route readiness before verification.');
  } catch {
    receipt.failureAt = new Date().toISOString(); receipt.failure = 'promotion failed; private rollback started';
    receipt.phase = 'rolling-back'; receipt.proxyRefreshedForPhase = null;
    receipt.readinessProbe = null; receipt.readinessResults = []; receipt.readinessPassed = 0;
    updateReceipt(paths, receipt);
    try { rollbackInternal(context, receipt); }
    catch { throw new Error('Batch24 promotion failed; private rollback is resumable with the rollback command'); }
    throw new Error('Batch24 promotion failed; recorded Batch23 baseline images were restored in the private project');
  }
}
function rollbackInternal(context, receipt) {
  const { state, paths, batch23 } = context;
  validateReceipt(receipt, paths, state, batch23);
  assert.deepEqual(receipt.baselineSnapshot, batch23.verifiedSnapshot);
  guardShared(state, receipt); assertBaselineImagesLocked(receipt.baselineImages, receipt.baselineSnapshot);
  validateCompose(state, paths, receipt.images, receipt.baselineImages);
  receipt.phase = 'rolling-back'; receipt.proxyRefreshedForPhase = null;
  receipt.readinessProbe = null; receipt.readinessResults = []; receipt.readinessPassed = 0;
  updateReceipt(paths, receipt);
  for (const service of [...BATCH24_ORDER].reverse()) {
    let current = assertBatch24Progress(snapshot(state), receipt, { allowUnhealthyCandidate: true });
    if (current[service].imageId !== receipt.baselineImageIds[service]) {
      assert.equal(current[service].imageId, receipt.imageIds[service]);
      guardShared(state, receipt);
      receipt.rollbackInFlightServices = [...new Set([...(receipt.rollbackInFlightServices || []), service])].sort();
      updateReceipt(paths, receipt);
      compose(state, paths, [paths.override, paths.rollback], batch24ComposeArgs(service), { timeout: 600000 });
      current = snapshot(state);
      receipt.rolledBackServices = [...new Set([...receipt.rolledBackServices, service])].sort();
      receipt.rolledBackSnapshot = structuredClone(current);
      current = assertBatch24Progress(current, receipt, { allowUnhealthyCandidate: true });
    }
    assert.equal(current[service].imageId, receipt.baselineImageIds[service]);
    assert.equal(current[service].status, 'running');
    receipt.rolledBackServices = [...new Set([...receipt.rolledBackServices, service])].sort();
    receipt.rolledBackSnapshot = structuredClone(current);
    receipt.rollbackInFlightServices = (receipt.rollbackInFlightServices || []).filter((item) => item !== service);
    updateReceipt(paths, receipt); guardShared(state, receipt);
  }
  const after = assertBatch24RollbackComplete(snapshot(state), receipt);
  receipt.phase = 'rolled-back'; receipt.rolledBackSnapshot = structuredClone(after);
  updateReceipt(paths, receipt); guardShared(state, receipt);
}
function rollback(stateFile) {
  assertBatch24ImageIdsReady();
  const context = validateBatch23Context(stateFile); const { state, receipt } = context;
  assert(receipt && ['promoting', 'promoted', 'verified', 'rolling-back', 'rolled-back'].includes(receipt.phase),
    'Batch24 rollback requires a preflighted promotion attempt');
  if (receipt.phase === 'rolled-back') {
    const current = validateRuntime(context); assertBatch24RollbackComplete(current, receipt);
    guardShared(state, receipt); return;
  }
  rollbackInternal(context, receipt);
  console.log('Batch24 rollback restored all four recorded Batch23 baseline image IDs; the other 22 service identities stayed unchanged. Refresh the private proxy and run readiness with the recorded baseline official-site image.');
}
function proxy(state) {
  const before = proxySnapshot(state);
  docker(['restart', before.name], { timeout: 120000 });
  const after = proxySnapshot(state);
  assert.equal(after.containerId, before.containerId, 'private proxy container identity changed');
  assert.equal(after.imageId, before.imageId, 'private proxy image changed');
  return after;
}
function refreshProxy(stateFile) {
  assertBatch24ImageIdsReady();
  const context = validateBatch23Context(stateFile); const { state, paths, receipt } = context;
  assert(receipt && ['promoted', 'verified', 'rolled-back'].includes(receipt.phase));
  const current = validateRuntime(context);
  if (receipt.phase === 'rolled-back') assertBatch24RollbackComplete(current, receipt);
  else assertBatch24Promoted(current, receipt);
  const before = proxySnapshot(state); assert.deepEqual(before, receipt.beforeProxy);
  guardShared(state, receipt); proxy(state);
  receipt.proxyRefreshedForPhase = receipt.phase; receipt.proxyRefreshedAt = new Date().toISOString();
  updateReceipt(paths, receipt); guardShared(state, receipt);
}

function runReadiness(state, receipt) {
  const probe = batch24ReadinessProbe(receipt);
  assert.equal(imageId(probe.image), probe.imageId,
    'official-site readiness image tag no longer resolves to the phase-pinned image ID');
  const targets = batch19ReadinessTargets();
  const script = `const targets=${JSON.stringify(targets)};\n` +
    'const results=await Promise.all(targets.map(async ([name,port,route])=>{let status=0;for(let attempt=0;attempt<15&&status!==200;attempt++){try{status=(await fetch("http://"+name+":"+port+route,{signal:AbortSignal.timeout(5000)})).status}catch{}if(status!==200)await new Promise(r=>setTimeout(r,1000));}return{name,status}}));\n' +
    'for(const result of results)console.log(JSON.stringify(result));if(results.some(result=>result.status!==200))process.exit(1);';
  const out = docker(['run', '--pull=never', '--rm', '--network', state.project, '--label',
    'com.cloudstudy.uat.project=' + state.project, '--entrypoint', 'node', probe.image,
    '--input-type=module', '-e', script], { output: true, timeout: 180000 });
  const results = out.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(results.length, 19); assert(results.every((result) => result.status === 200));
  return { probe, results };
}
function readiness(stateFile) {
  assertBatch24ImageIdsReady();
  const context = validateBatch23Context(stateFile); const { state, paths, receipt } = context;
  assert(receipt && ['promoted', 'verified', 'rolled-back'].includes(receipt.phase));
  assert.equal(receipt.proxyRefreshedForPhase, receipt.phase);
  const before = validateRuntime(context);
  if (receipt.phase === 'rolled-back') assertBatch24RollbackComplete(before, receipt);
  else assertBatch24Promoted(before, receipt);
  guardShared(state, receipt);
  const outcome = runReadiness(state, receipt);
  assert.deepEqual(snapshot(state), before, 'readiness probe changed the private service snapshot');
  guardShared(state, receipt);
  receipt.readinessProbe = outcome.probe; receipt.readinessResults = outcome.results;
  receipt.readinessPassed = outcome.results.length; receipt.readinessAt = new Date().toISOString();
  updateReceipt(paths, receipt);
  console.log(JSON.stringify({ project: state.project, phase: receipt.phase, probe: outcome.probe,
    checked: 19, passed: 19, results: outcome.results }));
}
function verify(stateFile) {
  assertBatch24ImageIdsReady();
  const context = validateBatch23Context(stateFile); const { state, paths, receipt } = context;
  assert(receipt && ['promoted', 'verified'].includes(receipt.phase));
  assert(receipt.phase === 'promoted'
    ? receipt.proxyRefreshedForPhase === 'promoted'
    : ['promoted', 'verified'].includes(receipt.proxyRefreshedForPhase));
  const before = assertBatch24Promoted(validateRuntime(context), receipt);
  assertCandidateImagesLocked(receipt.images, receipt.imageIds);
  assertBaselineImagesLocked(receipt.baselineImages, receipt.baselineSnapshot);
  guardShared(state, receipt);
  const outcome = runReadiness(state, receipt);
  assert.equal(outcome.probe.source, 'batch24-candidate');
  assert.equal(outcome.probe.image, receipt.images['official-site']);
  assert.equal(outcome.probe.imageId, receipt.imageIds['official-site']);
  assert.deepEqual(snapshot(state), before); guardShared(state, receipt);
  receipt.phase = 'verified'; receipt.verifiedSnapshot = structuredClone(before);
  receipt.readinessProbe = outcome.probe; receipt.readinessResults = outcome.results;
  receipt.readinessPassed = 19; receipt.verifiedAt = new Date().toISOString();
  updateReceipt(paths, receipt);
  console.log('Batch24 verified: four exact candidate image IDs, unchanged 22 service identities, private proxy refreshed, and 19/19 readiness checked with the candidate official-site image.');
}
function status(stateFile) {
  const context = validateBatch23Context(stateFile); const { state, receipt } = context;
  let current = null;
  if (receipt) {
    current = validateRuntime(context);
    if (receipt.phase === 'promoted' || receipt.phase === 'verified') assertBatch24Promoted(current, receipt);
    if (receipt.phase === 'rolled-back') assertBatch24RollbackComplete(current, receipt);
  }
  console.log(JSON.stringify({ project: state.project, baseline: 'Batch23 verified',
    phase: receipt?.phase || 'not-started', releaseTag: BATCH24_RELEASE_TAG,
    services: BATCH24_SERVICES, promotedServices: receipt?.promotedServices || [],
    rolledBackServices: receipt?.rolledBackServices || [], readinessPassed: receipt?.readinessPassed || 0,
    targetServices: receipt ? BATCH24_SERVICES.map((service) => ({
      service,
      image: current[service].imageId === receipt.baselineImageIds[service] ? 'baseline' : 'candidate',
      status: current[service].status,
      containerId: current[service].containerId,
      imageId: current[service].imageId
    })) : [],
    readinessProbe: receipt?.readinessProbe || null, verified: receipt?.phase === 'verified' }));
}

function main() {
  const [command, stateFile] = process.argv.slice(2);
  const handlers = { 'dry-run': dryRun, preflight, promote, 'refresh-proxy': refreshProxy,
    readiness, verify, rollback, status };
  assert(handlers[command], 'unknown Batch24 private promotion command');
  handlers[command](stateFile);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) {
    const detail = process.env.CLOUDSTUDY_UAT_DIAGNOSTIC === '1' && error?.name === 'AssertionError'
      ? ' ' + String(error.message || '').split('\n', 1)[0].slice(0, 160) : '';
    console.error('Batch24 private promotion failed closed; private outputs were suppressed.' + detail);
    process.exitCode = 1;
  }
}
