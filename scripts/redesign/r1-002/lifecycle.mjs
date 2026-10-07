import { readFileSync, writeFileSync, existsSync, readdirSync, lstatSync, realpathSync, mkdirSync,
  mkdtempSync, copyFileSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { canonicalize, RECEIPT_SCHEMA_VERSION, RECEIPT_INTENT, assertProtectedPath, guardRunPath,
  hashArtifact, createReceiptKey, createSignedReceipt, verifySignedReceipt, toPublicReceiptEvidence } from './receipt.mjs';
import { rejectDetachedStop } from './process-identity.mjs';
import { validateHarnessConfig, TLS_CASES, launchHarness, probeHarness } from './tls-harness.mjs';

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const MODES = Object.freeze(['preflight', 'stage', 'launch-harness', 'probe', 'stop-owned', 'restore-verify']);
// Prior scoped review binds these disk bytes, not a source-to-JAR build attestation.
const REVIEWED_GATEWAY_JAR_SHA256 = '34f13139294dead9f80cf0a4d41d43485d9cb95e0895c319ed4504b1fad66380';
const allowedDirty = new Set(['README.md', 'lifecycle.mjs', 'lifecycle.test.mjs', 'tls-harness.mjs',
  'GatewayTlsProbe.java', 'receipt.mjs', 'receipt.test.mjs', 'process-identity.mjs', 'process-identity.test.mjs']
  .map(name => `scripts/redesign/r1-002/${name}`));
const sha = value => createHash('sha256').update(value).digest('hex');
const safeRelative = name => typeof name === 'string' && name && !path.isAbsolute(name)
  && !name.split(/[\\/]/).some(part => !part || part === '.' || part === '..');

export function parseArgs(args) {
  const options = { mode: 'preflight' };
  const names = new Map([['--mode', 'mode'], ['--run-root', 'runRoot'], ['--run-id', 'runId'],
    ['--key-dir', 'keyDirectory'], ['--material-dir', 'materialDirectory'], ['--out', 'out']]);
  for (let i = 0; i < args.length; i += 2) {
    const name = names.get(args[i]);
    if (!name || !args[i + 1] || args[i + 1].startsWith('--') || Object.hasOwn(options, name) && name !== 'mode') {
      throw new Error('UNKNOWN_OR_DUPLICATE_ARGUMENT');
    }
    if (name === 'mode' && i !== 0) throw new Error('MODE_MUST_BE_FIRST');
    options[name] = args[i + 1];
  }
  if (!MODES.includes(options.mode)) throw new Error('UNKNOWN_MODE');
  if (options.runId && !/^r1-002-[a-z0-9][a-z0-9-]{0,63}$/.test(options.runId)) throw new Error('UNKNOWN_RUN');
  return options;
}

function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, { encoding: 'utf8', timeout: 60000,
    maxBuffer: 8 * 1024 * 1024, ...options });
  if (result.status !== 0) throw new Error(`OFFLINE_COMMAND_FAILED:${path.basename(executable)}:${result.status ?? 'unknown'}; output withheld`);
  return result.stdout;
}

function executable(name) {
  for (const entry of (process.env.PATH ?? '').split(path.delimiter)) {
    const candidate = path.join(entry, process.platform === 'win32' ? `${name}.exe` : name);
    if (existsSync(candidate) && lstatSync(realpathSync(candidate)).isFile()) return realpathSync(candidate);
  }
  throw new Error(`TOOL_NOT_FOUND:${name}`);
}

function fileList(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (lstatSync(absolute).isSymbolicLink()) throw new Error('SOURCE_OR_ARTIFACT_SYMLINK');
    if (entry.isDirectory()) return fileList(absolute, name);
    if (!entry.isFile()) throw new Error('NON_REGULAR_ARTIFACT');
    return [name];
  }).sort();
}

export function registeredPorts(root = repositoryRoot) {
  const bytes = readFileSync(path.join(root, 'config/local-ports.json'));
  const value = JSON.parse(bytes);
  const result = { bindHost: value.host, gatewayPort: value.services['api-gateway'].port,
    publisherPort: value.services['iam-service'].port, sha256: sha(bytes) };
  if (result.bindHost !== '127.0.0.1' || result.gatewayPort !== 18070 || result.publisherPort !== 18087
      || value.policy.autoIncrement !== false || value.policy.bindOnlyToLoopback !== true) {
    throw new Error('REGISTERED_PORT_POLICY_DRIFT');
  }
  return result;
}

export function inspectFixedPorts(ports) {
  // A read-only OS listing, not a socket-connect probe and never a bind attempt.
  return [ports.gatewayPort, ports.publisherPort].map(port => {
    const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fp'], { encoding: 'utf8', timeout: 5000 });
    if (result.error || ![0, 1].includes(result.status)) return { port, state: 'UNVERIFIED', pids: [] };
    const pids = result.stdout.split('\n').filter(line => /^p\d+$/.test(line)).map(line => Number(line.slice(1)));
    return { port, state: pids.length ? 'OCCUPIED' : 'FREE', pids: [...new Set(pids)] };
  });
}

export function sourceSnapshot(root = repositoryRoot) {
  const names = ['pom.xml', 'services/api-gateway/pom.xml', 'config/local-ports.json',
    ...fileList(path.join(root, 'services/api-gateway/src/main')).map(name => `services/api-gateway/src/main/${name}`),
    ...fileList(path.join(root, 'scripts/redesign/r1-002')).filter(name => /\.(mjs|java)$/.test(name))
      .map(name => `scripts/redesign/r1-002/${name}`)].sort();
  const files = names.map(name => {
    if (!safeRelative(name)) throw new Error('UNSAFE_SOURCE_PATH');
    return { path: name, sha256: sha(readFileSync(path.join(root, name))) };
  });
  const gitHead = command('git', ['rev-parse', 'HEAD'], { cwd: root }).trim();
  const dirtyNames = new Set(command('git', ['diff', 'HEAD', '--name-only', '-z'], { cwd: root }).split('\0').filter(Boolean));
  for (const name of command('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root }).split('\0').filter(Boolean)) dirtyNames.add(name);
  const dirty = files.filter(item => dirtyNames.has(item.path));
  if (dirty.some(item => !allowedDirty.has(item.path))) throw new Error('SOURCE_DIRTY_OUTSIDE_REVIEWED_ALLOWLIST');
  return { gitHead, dirtySha256: sha(canonicalize(files)), files };
}

export function assessDynamicGate({ portStates, bindingValid = false, sourceProvenance = 'UNPROVEN',
  materialsValid = false, window = null, now = Date.now() } = {}) {
  const blockers = ['D2_AUTHORITY_NOT_CONFIGURED'];
  if (!window) blockers.push('MISSING_SIGNED_MAINTENANCE_WINDOW');
  else {
    if (window.independentlyTrusted !== true) blockers.push('UNTRUSTED_WINDOW');
    if (!Number.isFinite(window.notBefore) || !Number.isFinite(window.expiresAt)
        || now < window.notBefore || now >= window.expiresAt) blockers.push('WINDOW_NOT_ACTIVE');
  }
  if (!bindingValid) blockers.push('SOURCE_ARTIFACT_BINDING_MISSING');
  if (sourceProvenance !== 'REVIEWED_BUILD_RECEIPT') blockers.push('SOURCE_TO_JAR_UNPROVEN');
  if (!materialsValid) blockers.push('MATERIAL_PERMISSIONS_UNVERIFIED');
  if (!Array.isArray(portStates) || portStates.length !== 2 || portStates.some(item => item.state !== 'FREE')) blockers.push('FIXED_PORTS_NOT_FREE');
  return { allowed: false, blockers, signals: 0, listeners: 0, dbOperations: 0, tlsCases: TLS_CASES };
}

export function preflight() {
  const ports = registeredPorts();
  const portStates = inspectFixedPorts(ports);
  return { kind: 'R1_002_D1_PREFLIGHT', platform: process.platform, platformVerification: 'NOT_ATTESTED_BY_PREFLIGHT',
    source: sourceSnapshot(), ports, portStates, gate: assessDynamicGate({ portStates }),
    sourceJarProvenance: 'UNPROVEN', tlsCases: TLS_CASES, iamBusinessRuntime: false };
}

function materialConfig(directory, ports) {
  assertProtectedPath(directory, { directory: true, repositoryRoot });
  return validateHarnessConfig({ bindHost: ports.bindHost, gatewayPort: ports.gatewayPort,
    publisherPort: ports.publisherPort, jwksUri: `https://127.0.0.1:${ports.publisherPort}/api/v1/auth/jwks`,
    routeCertificate: path.join(directory, 'test-ca.pem'), independentTrustStore: path.join(directory, 'gateway-trust.p12'),
    insecureTrustManager: false, hostnameVerification: true, httpFallback: false }, { registered: ports, repositoryRoot });
}

function readonlyTree(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const name = path.join(directory, entry.name);
    if (lstatSync(name).isSymbolicLink()) throw new Error('ARTIFACT_SYMLINK');
    if (entry.isDirectory()) readonlyTree(name); else chmodSync(name, 0o400);
  }
  chmodSync(directory, 0o500);
}

export function stage({ runRoot, keyDirectory, materialDirectory }) {
  if (process.platform === 'win32') throw new Error('WINDOWS_STAGE_UNVERIFIED');
  if (!runRoot || !keyDirectory || !materialDirectory) throw new Error('STAGE_REQUIRES_PROTECTED_RUN_KEY_MATERIAL_DIRECTORIES');
  assertProtectedPath(runRoot, { directory: true, repositoryRoot });
  const ports = registeredPorts(); const source = sourceSnapshot();
  const config = materialConfig(materialDirectory, ports);
  const key = createReceiptKey({ keyDirectory, repositoryRoot });
  const runDirectory = path.join(realpathSync(runRoot), `r1-002-${randomUUID()}`);
  mkdirSync(runDirectory, { mode: 0o700 });
  chmodSync(runDirectory, 0o700);
  const runId = path.basename(runDirectory).slice('r1-002-'.length);
  const artifactDirectory = path.join(runDirectory, 'artifact'); mkdirSync(artifactDirectory, { mode: 0o700 });
  const originalJar = path.join(repositoryRoot, 'services/api-gateway/target/api-gateway-0.1.0-SNAPSHOT.jar');
  if (!lstatSync(originalJar).isFile() || lstatSync(originalJar).isSymbolicLink()) throw new Error('UNSAFE_INPUT_JAR');
  const jarHash = sha(readFileSync(originalJar));
  if (jarHash !== REVIEWED_GATEWAY_JAR_SHA256) throw new Error('REVIEWED_JAR_DRIFT');
  copyFileSync(originalJar, path.join(artifactDirectory, 'api-gateway.jar'));
  const java = executable('java'), javac = executable('javac'), jar = executable('jar');
  const entries = command(jar, ['--list', '--file', path.join(artifactDirectory, 'api-gateway.jar')]).trim().split('\n');
  if (entries.some(name => name.startsWith('/') || name.includes('\\') || name.split('/').includes('..'))) throw new Error('UNSAFE_JAR_ENTRY');
  command(jar, ['--extract', '--file', path.join(artifactDirectory, 'api-gateway.jar'), 'BOOT-INF/lib', 'BOOT-INF/classes'], { cwd: artifactDirectory });
  const classes = path.join(artifactDirectory, 'probe-classes'); mkdirSync(classes, { mode: 0o700 });
  const cp = [path.join(artifactDirectory, 'BOOT-INF/classes'), path.join(artifactDirectory, 'BOOT-INF/lib/*')].join(path.delimiter);
  command(javac, ['-cp', cp, '-d', classes, path.join(repositoryRoot, 'scripts/redesign/r1-002/GatewayTlsProbe.java')]);
  const probeOutput = command(java, ['-cp', [classes, cp].join(path.delimiter), 'com.englishflow.gateway.config.GatewayTlsProbe',
    '--offline', config.routeCertificate, String(ports.gatewayPort), String(ports.publisherPort)]);
  const probe = JSON.parse(probeOutput.trim().split('\n').at(-1));
  const entriesBinding = fileList(artifactDirectory).map(name => ({ path: `artifact/${name}`, bytes: lstatSync(path.join(artifactDirectory, name)).size,
    sha256: sha(readFileSync(path.join(artifactDirectory, name))) }));
  const binding = { kind: 'R1_002_D1_ARTIFACT_BINDING', schemaVersion: 1, runId, source, portsConfigSha256: ports.sha256,
    sourceJarProvenance: 'UNATTESTED_CURRENT_TARGET', sourceToJarVerified: false,
    toolchainBaselineSha256: sha(readFileSync(path.join(repositoryRoot, 'config/toolchain-baseline.json'))),
    originalJar: { path: 'services/api-gateway/target/api-gateway-0.1.0-SNAPSHOT.jar', sha256: jarHash },
    tools: [java, javac, jar].map(tool => ({ executable: tool, sha256: sha(readFileSync(tool)) })),
    javaVersion: command(java, ['--version']).trim(), javacVersion: command(javac, ['--version']).trim(),
    entries: entriesBinding, probe, iamBusinessRuntime: false, tlsCases: TLS_CASES,
    publicCertificateSha256: sha(readFileSync(config.routeCertificate)),
    materialReadbacks: ['routeCertificate', 'independentTrustStore'].map(name => ({ kind: name,
      metadata: assertProtectedPath(config[name], { directory: false, repositoryRoot }) })) };
  if (jarHash !== sha(readFileSync(originalJar)) || canonicalize(source) !== canonicalize(sourceSnapshot())) throw new Error('SOURCE_OR_JAR_CHANGED_DURING_STAGE');
  readonlyTree(artifactDirectory);
  writeFileSync(path.join(runDirectory, 'binding.json'), JSON.stringify(binding, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  const artifact = hashArtifact({ runDirectory, relativePath: 'binding.json', repositoryRoot });
  const body = { schemaVersion: RECEIPT_SCHEMA_VERSION, runId, intent: RECEIPT_INTENT, event: 'staged',
    createdAt: new Date().toISOString(), platform: process.platform, source, portsConfigSha256: ports.sha256,
    artifact, bindHost: ports.bindHost, ports: [ports.gatewayPort, ports.publisherPort], process: null,
    ownerKind: 'harness', iamBusinessRuntime: false };
  const envelope = createSignedReceipt(body, { ...key, keyDirectory, repositoryRoot, runDirectory });
  writeFileSync(path.join(runDirectory, 'receipt.json'), canonicalize(envelope) + '\n', { mode: 0o600, flag: 'wx' });
  const verified = verifyStagedRun({ runDirectory, trustedPublicKey: readFileSync(key.publicKeyPath, 'utf8') });
  return { kind: 'R1_002_D1_STAGE', runId, runDirectory, keyDirectory, materialDirectory, binding,
    receipt: toPublicReceiptEvidence(envelope), verified, signals: 0, listeners: 0, dbOperations: 0 };
}

export function verifyStagedRun({ runDirectory, trustedPublicKey }) {
  assertProtectedPath(runDirectory, { directory: true, repositoryRoot });
  const bindingPath = guardRunPath({ runDirectory, relativePath: 'binding.json', repositoryRoot });
  const receiptPath = guardRunPath({ runDirectory, relativePath: 'receipt.json', repositoryRoot });
  const binding = JSON.parse(readFileSync(bindingPath, 'utf8'));
  const source = sourceSnapshot(); const ports = registeredPorts();
  const artifact = hashArtifact({ runDirectory, relativePath: 'binding.json', repositoryRoot });
  const envelope = JSON.parse(readFileSync(receiptPath, 'utf8'));
  const body = verifySignedReceipt(envelope, { trustedPublicKey, expected: { runId: path.basename(runDirectory).slice('r1-002-'.length), intent: RECEIPT_INTENT,
    source, portsConfigSha256: ports.sha256, artifact, process: null, event: 'staged',
    platform: process.platform, bindHost: ports.bindHost, ports: [ports.gatewayPort, ports.publisherPort],
    ownerKind: 'harness', iamBusinessRuntime: false } });
  // The shared receipt admits offline toy events too; this consumer only accepts this staged harness shape.
  if (body.platform !== process.platform || body.bindHost !== '127.0.0.1' || body.ownerKind !== 'harness'
      || body.iamBusinessRuntime !== false || canonicalize(body.ports) !== canonicalize([ports.gatewayPort, ports.publisherPort])) {
    throw new Error('STAGED_RECEIPT_METADATA_MISMATCH');
  }
  // createdAt has the shared signed format check, not an approval/expiry policy; it can never authorize D2.
  if (binding.runId !== path.basename(runDirectory).slice('r1-002-'.length) || canonicalize(binding.source) !== canonicalize(source)
      || binding.portsConfigSha256 !== ports.sha256 || binding.iamBusinessRuntime !== false
      || !Array.isArray(binding.entries) || !binding.entries.length) throw new Error('BINDING_CONTEXT_MISMATCH');
  for (const entry of binding.entries) {
    const actual = hashArtifact({ runDirectory, relativePath: entry.path, repositoryRoot });
    if (actual.sha256 !== entry.sha256 || actual.bytes !== entry.bytes) throw new Error('ARTIFACT_DRIFT');
  }
  for (const tool of binding.tools) if (sha(readFileSync(tool.executable)) !== tool.sha256) throw new Error('JAVA_TOOL_DRIFT');
  return { signature: 'PASS', source: 'PASS', artifacts: binding.entries.length, artifactHashes: 'PASS',
    sourceToJarVerified: false, dynamic: 'NOT_EXECUTED' };
}

function lookupRun(runRoot, runId) {
  if (!runRoot || !runId) throw new Error('UNKNOWN_RUN');
  if (!/^r1-002-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(runId)) throw new Error('UNKNOWN_RUN');
  assertProtectedPath(runRoot, { directory: true, repositoryRoot });
  const directory = path.join(realpathSync(runRoot), runId);
  assertProtectedPath(directory, { directory: true, repositoryRoot });
  return directory;
}

export function sanitizeEvidence(result, options = {}) {
  let text = JSON.stringify(result);
  const replacements = [[options.runRoot, '<RUN_ROOT>'], [result.runDirectory, '<RUN_DIR>'],
    [options.materialDirectory, '<PRIVATE_MATERIAL_DIR>'], [options.keyDirectory, '<RECEIPT_KEY_DIR>']]
    .filter(([value]) => value).sort((a, b) => b[0].length - a[0].length);
  for (const [value, replacement] of replacements) text = text.split(value).join(replacement).split(pathToUrl(value)).join(replacement);
  return JSON.parse(text);
}

function pathToUrl(value) { return 'file://' + value; }

export function dispatch(options) {
  if (options.mode === 'preflight') return preflight();
  if (options.mode === 'stage') return stage(options);
  if (options.mode === 'stop-owned') { lookupRun(options.runRoot, options.runId); return rejectDetachedStop(); }
  if (options.mode === 'restore-verify') throw new Error('D2_RESTORE_BUNDLE_NOT_APPROVED: read-only entry; no runner start or DB operations');
  if (options.mode === 'launch-harness') return launchHarness();
  if (options.mode === 'probe') return probeHarness();
  throw new Error('UNKNOWN_MODE');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = sanitizeEvidence(dispatch(options), options);
    if (options.out) {
      const evidenceRoot = path.join(repositoryRoot, 'evidence/redesign/2026-10-07/R1-002-D1/lifecycle-harness');
      const output = path.resolve(options.out);
      if (path.dirname(output) !== evidenceRoot || lstatSync(evidenceRoot).isSymbolicLink() || existsSync(output)) throw new Error('EVIDENCE_OUTPUT_SCOPE_OR_OVERWRITE');
      writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    }
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (error) {
    // Never echo supplied private paths, arbitrary argv/env, or subprocess output.
    process.stderr.write(`R1-002 D1 refused: ${String(error.message).split(':')[0]}; signals=0 listeners=0 db=0\n`);
    process.exitCode = 1;
  }
}
