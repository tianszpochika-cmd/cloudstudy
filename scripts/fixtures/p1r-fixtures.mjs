import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..', '..');
const configRelativePath = 'config/p1r-fixtures.v1.json';
const evidenceRoot = path.join(repositoryRoot, 'evidence', 'p1r', 'm0', 'repo-fixtures');
const forbiddenKey = /^(password|passwordHash|token|accessToken|refreshToken|apiKey|secret|privateKey|authorization|cookie|cardNumber|cvv|bankAccount|audioBytes|rawAudio|recordingBytes|base64)$/i;
const forbiddenValuePatterns = [
  { name: 'private-key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i },
  { name: 'bearer-token', pattern: /\bBearer\s+[A-Za-z0-9._~-]+/i },
  { name: 'provider-secret', pattern: /\b(?:sk|rk|pk_live)-[A-Za-z0-9_-]{12,}\b/i },
  { name: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/ },
  { name: 'mainland-phone', pattern: /(?:^|\D)1[3-9]\d{9}(?:$|\D)/ },
  { name: 'audio-data-uri', pattern: /data:audio\//i }
];
const audioPayloadKey = /^(file|filePath|path|objectKey|url|uri|blob|bytes|base64|checksum|recording|transcript)$/i;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function stableJson(value) {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`;
}

function relativeFromRoot(absolutePath) {
  return path.relative(repositoryRoot, absolutePath).split(path.sep).join('/');
}

function assertWithin(child, parent, label) {
  const relation = path.relative(parent, child);
  if (relation === '' || (!relation.startsWith(`..${path.sep}`) && relation !== '..' && !path.isAbsolute(relation))) return;
  throw new Error(`${label} escapes its allowed root: ${child}`);
}

function resolveRepositoryPath(relativePath, label) {
  if (path.isAbsolute(relativePath)) throw new Error(`${label} must be repository-relative: ${relativePath}`);
  const resolved = path.resolve(repositoryRoot, relativePath);
  assertWithin(resolved, repositoryRoot, label);
  return resolved;
}

async function readJson(relativePath, label = relativePath) {
  const absolutePath = resolveRepositoryPath(relativePath, label);
  const raw = await readFile(absolutePath, 'utf8');
  try {
    return { absolutePath, raw, value: JSON.parse(raw) };
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function gitRevision() {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    windowsHide: true
  }).trim();
}

function gitFiles() {
  const output = execFileSync('git', ['ls-files'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    windowsHide: true
  });
  return output.split(/\r?\n/).filter(Boolean);
}

function inspectValue(value, location, errors) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectValue(item, `${location}[${index}]`, errors));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (forbiddenKey.test(key)) errors.push(`${location}.${key} uses a forbidden sensitive-data key`);
      inspectValue(item, `${location}.${key}`, errors);
    }
    return;
  }
  if (typeof value !== 'string') return;
  for (const forbidden of forbiddenValuePatterns) {
    if (forbidden.pattern.test(value)) errors.push(`${location} matches forbidden ${forbidden.name} data`);
  }
  const emails = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  for (const email of emails) {
    if (!email.toLowerCase().endsWith('@example.test')) errors.push(`${location} contains a non-reserved email domain`);
  }
}

function inspectAudioPayload(value, location, errors) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectAudioPayload(item, `${location}[${index}]`, errors));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (audioPayloadKey.test(key)) errors.push(`${location}.${key} is forbidden in metadata-only audio fixtures`);
    inspectAudioPayload(item, `${location}.${key}`, errors);
  }
}

async function loadAndValidate() {
  const errors = [];
  const configDocument = await readJson(configRelativePath, 'P1R fixture config');
  const config = configDocument.value;
  if (config.schemaVersion !== 'p1r.fixtures.config.v1') errors.push('config.schemaVersion must be p1r.fixtures.config.v1');
  if (config.fixtureSetId !== 'p1r-m0-synthetic-v1') errors.push('config.fixtureSetId is not the reserved P1R fixture set');
  if (config.fixtureVersion !== '1.0.0') errors.push('config.fixtureVersion must be 1.0.0');
  if (config.policy?.syntheticOnly !== true) errors.push('config.policy.syntheticOnly must be true');
  if (config.policy?.externalCallsEnabled !== false) errors.push('external calls must remain disabled');
  if (config.policy?.productionWritesEnabled !== false) errors.push('production writes must remain disabled');
  if (!Array.isArray(config.files) || config.files.length !== 6) errors.push('config.files must define exactly six required fixture categories');

  const expectedCategories = new Set(['accounts', 'content', 'questions', 'audioMetadata', 'orders', 'privacy']);
  const documents = [];
  const globalRecordIds = new Set();
  for (const descriptor of config.files ?? []) {
    if (!expectedCategories.delete(descriptor.category)) errors.push(`unexpected or duplicate category: ${descriptor.category}`);
    if (!descriptor.path?.startsWith('fixtures/p1r/')) errors.push(`${descriptor.category} must live under fixtures/p1r`);
    let document;
    try {
      document = await readJson(descriptor.path, `${descriptor.category} fixture`);
    } catch (error) {
      errors.push(error.message);
      continue;
    }
    const fixture = document.value;
    if (fixture.fixtureSetId !== config.fixtureSetId) errors.push(`${descriptor.path} fixtureSetId mismatch`);
    if (fixture.fixtureVersion !== config.fixtureVersion) errors.push(`${descriptor.path} fixtureVersion mismatch`);
    if (fixture.synthetic !== true) errors.push(`${descriptor.path} must declare synthetic=true`);
    if (fixture.category !== descriptor.category) errors.push(`${descriptor.path} category mismatch`);
    if (fixture.ownerService !== descriptor.ownerService) errors.push(`${descriptor.path} ownerService mismatch`);
    if (!Array.isArray(fixture.records) || fixture.records.length < descriptor.minimumRecords) {
      errors.push(`${descriptor.path} has fewer than ${descriptor.minimumRecords} records`);
    }
    inspectValue(fixture, `$:${descriptor.path}`, errors);
    for (const [index, record] of (fixture.records ?? []).entries()) {
      if (typeof record.id !== 'string' || record.id.length === 0) errors.push(`${descriptor.path} records[${index}] has no id`);
      else if (globalRecordIds.has(record.id)) errors.push(`duplicate record id: ${record.id}`);
      else globalRecordIds.add(record.id);
    }
    documents.push({ descriptor, document });
  }
  if (expectedCategories.size > 0) errors.push(`missing categories: ${[...expectedCategories].join(', ')}`);

  const byCategory = Object.fromEntries(documents.map(({ descriptor, document }) => [descriptor.category, document.value.records]));
  const contentIds = new Set((byCategory.content ?? []).map((record) => record.id));
  const subjectRefs = new Set((byCategory.accounts ?? []).map((record) => record.principalRef));

  for (const account of byCategory.accounts ?? []) {
    if (account.ageBand !== 'adult-18-plus') errors.push(`${account.id} is outside the Phase 1 adult boundary`);
    if (!account.principalRef?.startsWith('principal-ref://synthetic/p1r/')) errors.push(`${account.id} has a non-synthetic principalRef`);
    if (account.credentialMaterialStored !== false) errors.push(`${account.id} must not persist credential material`);
  }
  for (const record of [...(byCategory.content ?? []), ...(byCategory.questions ?? [])]) {
    if (record.rights?.origin !== 'SYNTHETIC_ORIGINAL' || record.rights?.copiedFromExternalSource !== false) {
      errors.push(`${record.id} lacks a synthetic-original rights declaration`);
    }
  }
  for (const question of byCategory.questions ?? []) {
    if (!contentIds.has(question.contentRef)) errors.push(`${question.id} references unknown content ${question.contentRef}`);
    if (question.phase !== 'phase-1') errors.push(`${question.id} must stay in phase-1`);
  }
  for (const audio of byCategory.audioMetadata ?? []) {
    inspectAudioPayload(audio, `$:${audio.id}`, errors);
    if (!contentIds.has(audio.contentRef)) errors.push(`${audio.id} references unknown content ${audio.contentRef}`);
    if (audio.payloadMode !== 'METADATA_ONLY' || audio.binaryIncluded !== false) errors.push(`${audio.id} must contain metadata only`);
    if (audio.rights?.origin !== 'SYNTHETIC_ORIGINAL') errors.push(`${audio.id} lacks synthetic rights metadata`);
  }
  for (const order of byCategory.orders ?? []) {
    if (!subjectRefs.has(order.subjectRef)) errors.push(`${order.id} references unknown synthetic subject`);
    if (order.environment !== 'SANDBOX' || order.externalProviderCallsEnabled !== false) errors.push(`${order.id} is not sandbox-only`);
    if (order.paymentInstrumentStored !== false) errors.push(`${order.id} must not persist payment instruments`);
  }
  for (const privacy of byCategory.privacy ?? []) {
    if (!subjectRefs.has(privacy.subjectRef)) errors.push(`${privacy.id} references unknown synthetic subject`);
    if ('personalPayloadStored' in privacy && privacy.personalPayloadStored !== false) errors.push(`${privacy.id} must not persist a personal payload`);
  }

  const sources = [
    { path: configRelativePath, raw: configDocument.raw },
    ...documents.map(({ descriptor, document }) => ({ path: descriptor.path, raw: document.raw }))
  ].map((source) => ({ path: source.path, sha256: sha256(source.raw) }));
  const recordCounts = Object.fromEntries(documents.map(({ descriptor, document }) => [descriptor.category, document.value.records.length]));
  return { config, documents, sources, recordCounts, errors };
}

function flagValue(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`${flag} requires a value`);
  return args[index + 1];
}

async function writeEvidenceReport(relativeOrAbsolute, report) {
  const absolute = path.isAbsolute(relativeOrAbsolute)
    ? path.resolve(relativeOrAbsolute)
    : path.resolve(repositoryRoot, relativeOrAbsolute);
  assertWithin(absolute, evidenceRoot, 'evidence report');
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, stableJson(report), 'utf8');
  return relativeFromRoot(absolute);
}

async function validateCommand(args) {
  const validation = await loadAndValidate();
  const report = {
    schemaVersion: 'p1r.fixture-validation.v1',
    fixtureSetId: validation.config.fixtureSetId,
    fixtureVersion: validation.config.fixtureVersion,
    gitRevision: gitRevision(),
    sourceFiles: validation.sources,
    recordCounts: validation.recordCounts,
    checks: {
      deterministicSourceDigests: true,
      syntheticOnly: validation.errors.length === 0,
      adultPhase1Boundary: validation.errors.length === 0,
      noSensitiveMaterial: validation.errors.length === 0,
      noAudioBinary: validation.errors.length === 0,
      sandboxOrdersOnly: validation.errors.length === 0
    },
    result: validation.errors.length === 0 ? 'PASS' : 'FAIL',
    errors: validation.errors
  };
  const reportPath = flagValue(args, '--report');
  if (reportPath) console.log(`Wrote ${await writeEvidenceReport(reportPath, report)}`);
  if (validation.errors.length > 0) {
    validation.errors.forEach((error) => console.error(`ERROR ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log(`P1R fixture validation passed: ${Object.values(validation.recordCounts).reduce((sum, count) => sum + count, 0)} records in 6 categories.`);
}

function runtimeRoot(config, args) {
  const configured = resolveRepositoryPath(config.seed.runtimeRoot, 'configured runtime root');
  assertWithin(configured, evidenceRoot, 'configured runtime root');
  const override = flagValue(args, '--output');
  if (!override) return configured;
  const resolved = path.isAbsolute(override) ? path.resolve(override) : path.resolve(repositoryRoot, override);
  assertWithin(resolved, configured, 'seed output');
  return resolved;
}

async function existingNames(directory) {
  try {
    return await readdir(directory);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function seedCommand(args) {
  const validation = await loadAndValidate();
  if (validation.errors.length > 0) throw new Error(`seed refused because validation failed: ${validation.errors.join('; ')}`);
  const { config } = validation;
  const outputRoot = runtimeRoot(config, args);
  const allowedNames = new Set([config.seed.bundleFile, config.seed.manifestFile]);
  const names = await existingNames(outputRoot);
  const unknownNames = names.filter((name) => !allowedNames.has(name));
  if (unknownNames.length > 0) throw new Error(`seed output contains unowned files: ${unknownNames.join(', ')}`);
  const ownedNames = names.filter((name) => allowedNames.has(name));
  if (ownedNames.length > 0) {
    if (ownedNames.length !== allowedNames.size || !ownedNames.includes(config.seed.manifestFile)) {
      throw new Error('seed refused because an incomplete prior output has no safe ownership proof');
    }
    const priorManifest = JSON.parse(await readFile(path.join(outputRoot, config.seed.manifestFile), 'utf8'));
    if (priorManifest.cleanupMarker !== config.seed.cleanupMarker || priorManifest.fixtureSetId !== config.fixtureSetId) {
      throw new Error('seed refused because the prior output ownership marker does not match');
    }
  }

  const revision = gitRevision();
  const categories = Object.fromEntries(validation.documents.map(({ descriptor, document }) => [descriptor.category, document.value.records]));
  const bundle = {
    schemaVersion: 'p1r.seed-bundle.v1',
    fixtureSetId: config.fixtureSetId,
    fixtureVersion: config.fixtureVersion,
    seedRunId: config.seedRunId,
    authoredAgainstRevision: config.authoredAgainstRevision,
    gitRevision: revision,
    policy: config.policy,
    owners: Object.fromEntries(config.files.map((descriptor) => [descriptor.category, descriptor.ownerService])),
    categories
  };
  const bundleText = stableJson(bundle);
  const manifest = {
    schemaVersion: 'p1r.seed-manifest.v1',
    cleanupMarker: config.seed.cleanupMarker,
    fixtureSetId: config.fixtureSetId,
    fixtureVersion: config.fixtureVersion,
    seedRunId: config.seedRunId,
    gitRevision: revision,
    sourceFiles: validation.sources,
    recordCounts: validation.recordCounts,
    outputs: [{ file: config.seed.bundleFile, sha256: sha256(bundleText) }],
    cleanup: { scope: relativeFromRoot(outputRoot), files: [config.seed.bundleFile, config.seed.manifestFile] }
  };
  const manifestText = stableJson(manifest);
  await mkdir(outputRoot, { recursive: true });
  const bundleTemp = path.join(outputRoot, `.${config.seed.bundleFile}.lock.tmp`);
  const manifestTemp = path.join(outputRoot, `.${config.seed.manifestFile}.lock.tmp`);
  await writeFile(bundleTemp, bundleText, 'utf8');
  await writeFile(manifestTemp, manifestText, 'utf8');
  await rename(bundleTemp, path.join(outputRoot, config.seed.bundleFile));
  await rename(manifestTemp, path.join(outputRoot, config.seed.manifestFile));
  console.log(`Seeded ${Object.values(validation.recordCounts).reduce((sum, count) => sum + count, 0)} deterministic records at ${relativeFromRoot(outputRoot)}.`);
}

async function cleanupCommand(args) {
  const { value: config } = await readJson(configRelativePath, 'P1R fixture config');
  const outputRoot = runtimeRoot(config, args);
  const manifestPath = path.join(outputRoot, config.seed.manifestFile);
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' && (await existingNames(outputRoot)).length === 0) {
      console.log(`Cleanup no-op: ${relativeFromRoot(outputRoot)} has no generated fixture files.`);
      return;
    }
    throw new Error(`cleanup requires a readable seed manifest: ${error.message}`);
  }
  if (manifest.cleanupMarker !== config.seed.cleanupMarker || manifest.fixtureSetId !== config.fixtureSetId) {
    throw new Error('cleanup refused because the manifest ownership marker does not match');
  }
  const expectedFiles = [config.seed.bundleFile, config.seed.manifestFile];
  if (JSON.stringify(manifest.cleanup?.files) !== JSON.stringify(expectedFiles)) {
    throw new Error('cleanup refused because the manifest file scope is unexpected');
  }
  for (const name of expectedFiles) {
    const target = path.resolve(outputRoot, name);
    assertWithin(target, outputRoot, 'cleanup target');
    await rm(target, { force: true });
  }
  try {
    await rmdir(outputRoot);
  } catch (error) {
    if (error.code !== 'ENOTEMPTY' && error.code !== 'ENOENT') throw error;
  }
  console.log(`Cleaned owned P1R fixture output from ${relativeFromRoot(outputRoot)}.`);
}

async function walkFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walkFiles(absolute));
    else if (entry.isFile()) result.push(absolute);
  }
  return result;
}

async function auditCommand(args) {
  const tracked = gitFiles();
  const artifactPattern = /(?:^|\/)(?:node_modules|\.pnpm-store|\.yarn|\.turbo|\.cache|\.vite|\.pytest_cache|__pycache__|target|dist|build|coverage|\.nuxt|\.output|\.tmp-[^/]*compile|\.compile-[^/]*)(?:\/|$)|\.(?:class|pyc|pyo|tsbuildinfo|log|tmp)$/i;
  const trackedArtifacts = tracked.filter((file) => artifactPattern.test(file));
  const miniappRoot = path.join(repositoryRoot, 'apps', 'miniapp-wechat');
  const miniappFiles = (await walkFiles(miniappRoot)).map((file) => path.relative(miniappRoot, file).split(path.sep).join('/')).sort();
  const boundary = (await readJson('apps/miniapp-wechat/archive-boundary.json', 'miniapp archive boundary')).value;
  const expectedMiniapp = [...boundary.allowedRepositoryFiles].sort();
  const miniappMatches = JSON.stringify(miniappFiles) === JSON.stringify(expectedMiniapp);
  const errors = [];
  if (trackedArtifacts.length > 0) errors.push(`tracked generated artifacts remain: ${trackedArtifacts.join(', ')}`);
  if (!miniappMatches) errors.push(`miniapp archive contains unexpected files: ${miniappFiles.join(', ')}`);
  if (boundary.businessProject !== false || boundary.sourceOfTruth !== 'apps/mobile') errors.push('miniapp archive boundary does not point to apps/mobile');
  const report = {
    schemaVersion: 'p1r.repo-fixture-audit.v1',
    gitRevision: gitRevision(),
    trackedGeneratedArtifactCount: trackedArtifacts.length,
    trackedGeneratedArtifacts: trackedArtifacts,
    miniappArchive: {
      status: boundary.status,
      sourceOfTruth: boundary.sourceOfTruth,
      files: miniappFiles,
      matchesAllowlist: miniappMatches
    },
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    errors
  };
  const reportPath = flagValue(args, '--report');
  if (reportPath) console.log(`Wrote ${await writeEvidenceReport(reportPath, report)}`);
  if (errors.length > 0) {
    errors.forEach((error) => console.error(`ERROR ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log('P1R repository audit passed: zero tracked generated artifacts and miniapp archive boundary intact.');
}

async function main() {
  const [command = 'validate', ...args] = process.argv.slice(2);
  if (command === 'validate') return validateCommand(args);
  if (command === 'seed') return seedCommand(args);
  if (command === 'cleanup') return cleanupCommand(args);
  if (command === 'audit') return auditCommand(args);
  throw new Error('Usage: node scripts/fixtures/p1r-fixtures.mjs <validate|seed|cleanup|audit> [--report <evidence-path>] [--output <runtime-path>]');
}

main().catch((error) => {
  console.error(`ERROR ${error.message}`);
  process.exitCode = 1;
});
