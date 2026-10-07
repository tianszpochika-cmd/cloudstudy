import fs from 'node:fs';
import { readProcessIdentity, compareProcessIdentity } from './process-identity.mjs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';

export const RECEIPT_SCHEMA_VERSION = 'r1-002-run-receipt/v1';
export const RECEIPT_INTENT = 'R1_002_PREPARATION_HARNESS';
const digest = value => createHash('sha256').update(value).digest('hex');
const fail = message => { throw new Error(message); };
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const exact = (value, fields) => {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).sort().join('|') !== [...fields].sort().join('|')) fail('Closed schema violation');
};
const string = (value, max = 256) => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\x00-\x1f\x7f]/.test(value);
const relative = value => string(value, 240) && !path.isAbsolute(value) && /^[a-zA-Z0-9_.$\/-]+$/.test(value) && value.split('/').every(part => part && part !== '.' && part !== '..');
const approvedUntrackedSources = new Set(['receipt.mjs', 'receipt.test.mjs', 'process-identity.mjs', 'process-identity.test.mjs', 'lifecycle.mjs', 'lifecycle.test.mjs', 'tls-harness.mjs', 'GatewayTlsProbe.java'].map(name => 'scripts/redesign/r1-002/' + name));
const secretPath = value => /(?:^|\/)(?:\.env(?:\.|$)|[^/]*(?:secret|credential|password|private[-_]key|access[-_]token|refresh[-_]token)[^/]*)|\.(?:pem|key|p12|pfx|jks|keystore)$/i.test(value);
const publicSource = value => relative(value) && !/(^|\/)(\.env(?:\.|$)|[^/]*(?:secret|credential|password|private[-_]key)[^/]*)/i.test(value) && (
  value === 'config/local-ports.json' || /^(services|packages|scripts|apps)\//.test(value) && /\.(?:java|mjs|js|ts|vue|json|xml|gradle|kts|yaml|yml)$/.test(value) || /^(pom\.xml|build\.gradle(?:\.kts)?|settings\.gradle(?:\.kts)?|gradle\.properties)$/.test(value));

export function canonicalize(value) {
  const seen = new Set();
  const walk = (item, depth) => {
    if (depth > 12) fail('Canonical JSON depth limit');
    if (item === null || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'string') {
      if (item.length > 16384 || /[\x00-\x1f\x7f]/.test(item)) fail('Canonical JSON string limit');
      return JSON.stringify(item);
    }
    if (typeof item === 'number') {
      if (!Number.isSafeInteger(item) || Object.is(item, -0)) fail('Canonical JSON integer required');
      return JSON.stringify(item);
    }
    if (typeof item !== 'object' || seen.has(item)) fail('Canonical JSON type/cycle violation');
    if (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype) fail('Plain JSON objects required');
    if (Object.getOwnPropertySymbols(item).length || Object.values(Object.getOwnPropertyDescriptors(item)).some(d => d.get || d.set)) fail('JSON accessors/symbols forbidden');
    seen.add(item);
    let encoded;
    if (Array.isArray(item)) {
      if (item.length > 128 || Object.keys(item).length !== item.length) fail('Dense JSON array required');
      encoded = '[' + item.map(v => walk(v, depth + 1)).join(',') + ']';
    } else {
      const keys = Object.keys(item).sort();
      if (keys.length > 32 || keys.some(k => !/^[A-Za-z][A-Za-z0-9]*$/.test(k))) fail('JSON key violation');
      encoded = '{' + keys.map(k => JSON.stringify(k) + ':' + walk(item[k], depth + 1)).join(',') + '}';
    }
    seen.delete(item);
    return encoded;
  };
  const output = walk(value, 0);
  if (Buffer.byteLength(output) > 65536) fail('Canonical JSON size limit');
  return output;
}

export function validateReceipt(body) {
  canonicalize(body);
  exact(body, ['schemaVersion', 'runId', 'intent', 'event', 'createdAt', 'platform', 'source', 'portsConfigSha256', 'artifact', 'bindHost', 'ports', 'process', 'ownerKind', 'iamBusinessRuntime']);
  if (body.schemaVersion !== RECEIPT_SCHEMA_VERSION || body.intent !== RECEIPT_INTENT || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(body.runId)) fail('Receipt version/intent/runId invalid');
  if (!['staged', 'owned-child-started', 'stop-timeout'].includes(body.event) || !['darwin', 'linux'].includes(body.platform)) fail('Receipt event/platform unsupported');
  if (!string(body.createdAt, 24) || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(body.createdAt) || new Date(body.createdAt).toISOString() !== body.createdAt) fail('Receipt time invalid');
  if (body.bindHost !== '127.0.0.1' || !sha(body.portsConfigSha256) || body.iamBusinessRuntime !== false || !['harness', 'toy-child'].includes(body.ownerKind)) fail('Receipt offline boundary invalid');
  if (!Array.isArray(body.ports) || ![canonicalize([]), canonicalize([18070, 18087])].includes(canonicalize(body.ports))) fail('Receipt fixed ports invalid');
  exact(body.source, ['gitHead', 'dirtySha256', 'files']);
  if (!/^[a-f0-9]{40}$/.test(body.source.gitHead) || !sha(body.source.dirtySha256) || !Array.isArray(body.source.files) || body.source.files.length < 1 || body.source.files.length > 128) fail('Source snapshot invalid');
  let previous = '';
  for (const file of body.source.files) {
    exact(file, ['path', 'sha256']);
    if (!publicSource(file.path) || !sha(file.sha256) || file.path <= previous) fail('Public source path/order/hash invalid');
    previous = file.path;
  }
  if (digest(canonicalize(body.source.files)) !== body.source.dirtySha256) fail('Source snapshot digest mismatch');
  exact(body.artifact, ['path', 'bytes', 'sha256']);
  if (body.artifact.path !== 'binding.json' || !Number.isSafeInteger(body.artifact.bytes) || body.artifact.bytes < 1 || body.artifact.bytes > 1024 * 1024 * 1024 || !sha(body.artifact.sha256)) fail('Artifact binding invalid');
  if (body.event === 'staged' ? body.process !== null : body.process === null) fail('Event process binding invalid');
  if (body.process !== null) {
    const fields = ['platform', 'pid', 'ppid', 'executable', 'cwd', 'birthTime', 'birthTimeKind'];
    if (body.process.platform === 'linux') fields.push('bootId');
    exact(body.process, fields);
    const p = body.process;
    if (p.platform !== body.platform || ![p.pid, p.ppid].every(n => Number.isSafeInteger(n) && n > 0) || ![p.executable, p.cwd].every(v => string(v, 4096) && path.isAbsolute(v))) fail('Process identity invalid');
    if (p.platform === 'darwin' && (p.birthTimeKind !== 'darwin-kernel-microseconds' || !/^\d{1,12}\.\d{6}$/.test(p.birthTime))) fail('Darwin birth identity invalid');
    if (p.platform === 'linux' && (p.birthTimeKind !== 'linux-start-ticks' || !/^\d{1,20}$/.test(p.birthTime) || !/^[a-f0-9-]{36}$/.test(p.bootId))) fail('Linux birth identity invalid');
  }
  return body;
}

function noSymlink(absolute) {
  if (!path.isAbsolute(absolute) || path.normalize(absolute) !== absolute) fail('Canonical absolute path required');
  let current = path.parse(absolute).root;
  for (const component of absolute.slice(current.length).split('/').filter(Boolean)) {
    current = path.join(current, component);
    if (fs.lstatSync(current).isSymbolicLink()) fail('Symlink path rejected');
  }
}

export function assertProtectedPath(target, { directory = false, repositoryRoot } = {}) {
  if (!repositoryRoot || !path.isAbsolute(repositoryRoot)) fail('Repository root required');
  noSymlink(target);
  const repo = fs.realpathSync(repositoryRoot);
  if (target === repo || target.startsWith(repo + path.sep)) fail('Protected material must be outside Git');
  const metadata = fs.lstatSync(target);
  if (process.platform === 'win32' || typeof process.getuid !== 'function') fail('POSIX ownership unavailable; Windows DACL unverified');
  if (metadata.uid !== process.getuid() || (directory ? !metadata.isDirectory() : !metadata.isFile()) || (!directory && metadata.nlink !== 1)) fail('Protected owner/type/link violation');
  const mode = metadata.mode & 0o777;
  if (!(directory ? [0o700, 0o500] : [0o600, 0o400]).includes(mode)) fail('Protected permission violation');
  return { uid: metadata.uid, mode, type: directory ? 'directory' : 'file' };
}

export function guardRunPath({ runDirectory, relativePath, repositoryRoot, mustExist = true }) {
  if (!relative(relativePath) || secretPath(relativePath)) fail('Run relative path rejected');
  assertProtectedPath(runDirectory, { directory: true, repositoryRoot });
  let target = runDirectory;
  const components = relativePath.split('/');
  for (let i = 0; i < components.length; i++) {
    target = path.join(target, components[i]);
    if (!fs.existsSync(target) && !mustExist && i === components.length - 1) {
      // lstat, unlike existsSync, detects a dangling symlink.
      try { fs.lstatSync(target); fail('Existing path rejected'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      return target;
    }
    assertProtectedPath(target, { directory: i !== components.length - 1, repositoryRoot });
  }
  return target;
}

export function hashArtifact(options) {
  const file = guardRunPath(options);
  const descriptor = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const before = fs.fstatSync(descriptor);
    if (!before.isFile() || before.uid !== process.getuid() || ![0o600, 0o400].includes(before.mode & 0o777) || before.nlink !== 1) fail('Artifact descriptor permission/type violation');
    const content = fs.readFileSync(descriptor);
    const after = fs.fstatSync(descriptor);
    if (before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.size !== content.length) fail('Artifact changed while reading');
    return { path: options.relativePath, bytes: content.length, sha256: digest(content) };
  } finally { fs.closeSync(descriptor); }
}

function protectedKey(privateKeyPath, keyDirectory, repositoryRoot) {
  assertProtectedPath(keyDirectory, { directory: true, repositoryRoot });
  if ((fs.lstatSync(keyDirectory).mode & 0o777) !== 0o700 || privateKeyPath !== path.join(keyDirectory, 'receipt-ed25519-private.pem')) fail('Dedicated receipt key required');
  assertProtectedPath(privateKeyPath, { repositoryRoot });
  if ((fs.lstatSync(privateKeyPath).mode & 0o777) !== 0o600) fail('Receipt private key mode must be 0600');
}

export function createReceiptKey({ keyDirectory, repositoryRoot }) {
  assertProtectedPath(keyDirectory, { directory: true, repositoryRoot });
  if ((fs.lstatSync(keyDirectory).mode & 0o777) !== 0o700) fail('Key directory must be 0700');
  const privateKeyPath = path.join(keyDirectory, 'receipt-ed25519-private.pem');
  const publicKeyPath = path.join(keyDirectory, 'receipt-ed25519-public.pem');
  if (fs.existsSync(privateKeyPath) || fs.existsSync(publicKeyPath)) fail('Receipt key already exists');
  const pair = generateKeyPairSync('ed25519');
  const pem = pair.publicKey.export({ type: 'spki', format: 'pem' });
  fs.writeFileSync(privateKeyPath, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { flag: 'wx', mode: 0o600 });
  fs.writeFileSync(publicKeyPath, pem, { flag: 'wx', mode: 0o600 });
  return { privateKeyPath, publicKeyPath, keyId: digest(pair.publicKey.export({ type: 'spki', format: 'der' })) };
}

export function createSignedReceipt(body, { privateKeyPath, keyDirectory, repositoryRoot, runDirectory }) {
  validateReceipt(body);
  if (body.platform !== process.platform) fail('Receipt platform differs from actual host');
  protectedKey(privateKeyPath, keyDirectory, repositoryRoot);
  const gitHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' }).trim();
  if (body.source.gitHead !== gitHead) fail('Source Git HEAD mismatch');
  for (const file of body.source.files) {
    if (!approvedUntrackedSources.has(file.path)) {
      try { execFileSync('git', ['ls-files', '--error-unmatch', '--', file.path], { cwd: repositoryRoot, stdio: ['ignore', 'ignore', 'ignore'] }); } catch { fail('Source is not tracked public code or approved D1 source'); }
    }
    const source = path.join(fs.realpathSync(repositoryRoot), file.path);
    noSymlink(source);
    if (!fs.lstatSync(source).isFile() || digest(fs.readFileSync(source)) !== file.sha256) fail('Actual public source digest mismatch');
  }
  noSymlink(path.join(fs.realpathSync(repositoryRoot), 'config/local-ports.json'));
  if (digest(fs.readFileSync(path.join(repositoryRoot, 'config/local-ports.json'))) !== body.portsConfigSha256) fail('Actual fixed ports digest mismatch');
  if (canonicalize(hashArtifact({ runDirectory, relativePath: body.artifact.path, repositoryRoot })) !== canonicalize(body.artifact)) fail('Actual artifact binding mismatch');
  if (body.process !== null && !compareProcessIdentity(body.process, readProcessIdentity(body.process.pid)).matches) fail('Actual process birth binding mismatch');
  const descriptor = fs.openSync(privateKeyPath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  let key;
  try {
    const meta = fs.fstatSync(descriptor);
    if (!meta.isFile() || meta.uid !== process.getuid() || (meta.mode & 0o777) !== 0o600 || meta.nlink !== 1) fail('Receipt key metadata changed');
    key = createPrivateKey(fs.readFileSync(descriptor));
  } finally { fs.closeSync(descriptor); }
  if (key.asymmetricKeyType !== 'ed25519') fail('Dedicated Ed25519 key required; IAM key forbidden');
  const publicKey = createPublicKey(key);
  return { schemaVersion: RECEIPT_SCHEMA_VERSION, algorithm: 'Ed25519', keyId: digest(publicKey.export({ type: 'spki', format: 'der' })), body: JSON.parse(canonicalize(body)), signature: sign(null, Buffer.from(canonicalize(body)), key).toString('base64') };
}

export function verifySignedReceipt(envelope, { trustedPublicKey, expected } = {}) {
  exact(envelope, ['schemaVersion', 'algorithm', 'keyId', 'body', 'signature']);
  validateReceipt(envelope.body);
  exact(expected, ['runId', 'intent', 'source', 'portsConfigSha256', 'artifact', 'process', 'event', 'platform', 'bindHost', 'ports', 'ownerKind', 'iamBusinessRuntime']);
  if (!trustedPublicKey) fail('External trusted public key required');
  const key = typeof trustedPublicKey === 'string' || Buffer.isBuffer(trustedPublicKey) ? createPublicKey(trustedPublicKey) : trustedPublicKey;
  if (key.type !== 'public' || key.asymmetricKeyType !== 'ed25519') fail('Trusted Ed25519 public key required');
  if (envelope.schemaVersion !== RECEIPT_SCHEMA_VERSION || envelope.algorithm !== 'Ed25519' || envelope.keyId !== digest(key.export({ type: 'spki', format: 'der' }))) fail('Trust anchor mismatch');
  if (!string(envelope.signature, 88) || !/^[A-Za-z0-9+/]{86}==$/.test(envelope.signature) || !verify(null, Buffer.from(canonicalize(envelope.body)), key, Buffer.from(envelope.signature, 'base64'))) fail('Receipt signature invalid');
  for (const field of Object.keys(expected)) if (canonicalize(expected[field]) !== canonicalize(envelope.body[field])) fail('Expected receipt binding mismatch: ' + field);
  return JSON.parse(canonicalize(envelope.body));
}

export function toPublicReceiptEvidence(envelope) {
  exact(envelope, ['schemaVersion', 'algorithm', 'keyId', 'body', 'signature']);
  validateReceipt(envelope.body);
  const body = envelope.body;
  return { kind: 'redacted-summary-not-signed-original', schemaVersion: body.schemaVersion, runId: body.runId, event: body.event, intent: body.intent, platform: body.platform, keyId: envelope.keyId, receiptSha256: digest(canonicalize(envelope)), source: body.source, portsConfigSha256: body.portsConfigSha256, artifact: body.artifact, ownerKind: body.ownerKind, iamBusinessRuntime: false, process: body.process === null ? null : { pid: body.process.pid, ppid: body.process.ppid, birthTime: body.process.birthTime, birthTimeKind: body.process.birthTimeKind, executable: '<PRIVATE_EXECUTABLE>', cwd: '<PRIVATE_RUN_DIRECTORY>' } };
}
