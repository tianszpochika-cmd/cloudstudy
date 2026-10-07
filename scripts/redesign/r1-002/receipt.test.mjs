import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto';
import { RECEIPT_SCHEMA_VERSION, RECEIPT_INTENT, canonicalize, validateReceipt, createReceiptKey, assertProtectedPath, guardRunPath, hashArtifact, createSignedReceipt, verifySignedReceipt, toPublicReceiptEvidence } from './receipt.mjs';
import { readProcessIdentity } from './process-identity.mjs';
const repositoryRoot = fs.realpathSync(process.cwd());
const sha = value => createHash('sha256').update(value).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
function fixture(t) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'r1-002-receipt-test-'));
  fs.chmodSync(root, 0o700);
  const keyDirectory = path.join(root, 'keys'); fs.mkdirSync(keyDirectory, { mode: 0o700 });
  const runDirectory = path.join(root, 'run'); fs.mkdirSync(runDirectory, { mode: 0o700 });
  fs.writeFileSync(path.join(runDirectory, 'binding.json'), '{"kind":"offline-fixture"}', { mode: 0o600 });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const keys = createReceiptKey({ keyDirectory, repositoryRoot });
  const file = 'scripts/redesign/r1-002/receipt.mjs';
  const files = [{ path: file, sha256: sha(fs.readFileSync(path.join(repositoryRoot, file))) }];
  const body = { schemaVersion: RECEIPT_SCHEMA_VERSION, runId: randomUUID(), intent: RECEIPT_INTENT, event: 'staged', createdAt: new Date().toISOString(), platform: process.platform, source: { gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), dirtySha256: sha(canonicalize(files)), files }, portsConfigSha256: sha(fs.readFileSync('config/local-ports.json')), artifact: hashArtifact({ runDirectory, relativePath: 'binding.json', repositoryRoot }), bindHost: '127.0.0.1', ports: [18070, 18087], process: null, ownerKind: 'harness', iamBusinessRuntime: false };
  const options = { ...keys, keyDirectory, repositoryRoot, runDirectory };
  const expected = Object.fromEntries(['runId', 'intent', 'event', 'source', 'portsConfigSha256', 'artifact', 'process', 'platform', 'bindHost', 'ports', 'ownerKind', 'iamBusinessRuntime'].map(k => [k, body[k]]));
  return { root, keyDirectory, runDirectory, keys, body, options, expected, trustedPublicKey: fs.readFileSync(keys.publicKeyPath) };
}

test('canonical sorted JSON, strict primitives, dense arrays and no accessors', () => {
  assert.equal(canonicalize({ z: [2, 1], a: { y: true, b: null } }), '{"a":{"b":null,"y":true},"z":[2,1]}');
  for (const v of [undefined, NaN, 1.1, -0, BigInt(1), new Date(), [, 2], { get x() { throw Error('accessed'); } }]) assert.throws(() => canonicalize(v));
  const cycle = {}; cycle.a = cycle; assert.throws(() => canonicalize(cycle));
});

test('real Ed25519 signature requires external anchor and precise expected context', t => {
  const f = fixture(t); const envelope = createSignedReceipt(f.body, f.options);
  assert.deepEqual(verifySignedReceipt(envelope, f), f.body);
  assert.throws(() => verifySignedReceipt(envelope, { expected: f.expected }), /External/);
  assert.throws(() => verifySignedReceipt(envelope, { trustedPublicKey: f.trustedPublicKey }), /schema/);
  assert.throws(() => verifySignedReceipt({ ...envelope, publicKey: f.trustedPublicKey.toString() }, f), /schema/);
  assert.throws(() => verifySignedReceipt(envelope, { ...f, trustedPublicKey: generateKeyPairSync('ed25519').publicKey }), /anchor/);
  for (const field of ['runId', 'event', 'source', 'artifact', 'portsConfigSha256', 'process', 'platform', 'bindHost', 'ports', 'ownerKind', 'iamBusinessRuntime']) {
    const expected = clone(f.expected);
    expected[field] = field === 'platform' ? 'linux' : field === 'bindHost' ? '127.0.0.2' : field === 'ports' ? [] : field === 'ownerKind' ? 'toy-child' : field === 'iamBusinessRuntime' ? true : field === 'runId' ? randomUUID() : field === 'event' ? 'stop-timeout' : field === 'source' ? { ...expected.source, gitHead: 'a'.repeat(40) } : field === 'artifact' ? { ...expected.artifact, sha256: 'b'.repeat(64) } : field === 'process' ? { pid: 1 } : 'c'.repeat(64);
    assert.throws(() => verifySignedReceipt(envelope, { ...f, expected }), /binding mismatch/);
  }
  for (const mutation of [{ ports: [] }, { ownerKind: 'toy-child' }]) {
    const sameKeySignedWrongContext = createSignedReceipt({ ...f.body, ...mutation }, f.options);
    assert.throws(() => verifySignedReceipt(sameKeySignedWrongContext, f), /Expected receipt binding mismatch/);
  }
  const incomplete = { ...f.expected }; delete incomplete.ownerKind;
  assert.throws(() => verifySignedReceipt(envelope, { ...f, expected: incomplete }), /schema/);
});

test('signature covers time, artifact/source, event and OS birth identity', t => {
  const f = fixture(t); f.body.event = 'owned-child-started'; f.body.process = readProcessIdentity(process.pid); f.expected.event = f.body.event; f.expected.process = f.body.process;
  const e = createSignedReceipt(f.body, f.options);
  assert.deepEqual(verifySignedReceipt(e, f), f.body);
  for (const mutate of [b => b.createdAt = '2026-10-07T00:00:00.000Z', b => b.artifact.sha256 = 'a'.repeat(64), b => b.process.birthTime = '1.000001', b => b.source.gitHead = 'c'.repeat(40)]) {
    const tampered = clone(e); mutate(tampered.body); assert.throws(() => verifySignedReceipt(tampered, f), /signature/);
  }
  const wrong = clone(f.body); wrong.process.birthTime = '1.000001'; assert.throws(() => createSignedReceipt(wrong, f.options), /birth binding/);
});

test('closed schema rejects secret/argv/env fields and unsafe/unsorted source paths', t => {
  const f = fixture(t);
  for (const field of ['argv', 'env', 'privateKey', 'password', 'passwordHash', 'token']) assert.throws(() => validateReceipt({ ...f.body, [field]: 'not-a-secret-fixture' }), /schema/);
  for (const sourcePath of ['../escape.java', '/tmp/x.java', '.env', 'services/iam-service/private-key.json', 'docs/secret.txt', 'services/iam-service/.env.json']) {
    const body = clone(f.body); body.source.files[0].path = sourcePath; body.source.dirtySha256 = sha(canonicalize(body.source.files)); assert.throws(() => validateReceipt(body), /source path/);
  }
  const body = clone(f.body); body.source.files.push(body.source.files[0]); assert.throws(() => validateReceipt(body), /order/);
  assert.throws(() => validateReceipt({ ...f.body, iamBusinessRuntime: true }), /boundary/);
  assert.throws(() => validateReceipt({ ...f.body, ports: [18071] }), /ports/);
  assert.throws(() => validateReceipt({ ...f.body, platform: 'win32' }), /unsupported/);
});

test('signer rejects mismatched actual source, ports and artifact; no source-to-JAR claim', t => {
  const f = fixture(t);
  for (const mutate of [b => { b.source.files[0].sha256 = 'a'.repeat(64); b.source.dirtySha256 = sha(canonicalize(b.source.files)); }, b => b.source.gitHead = 'a'.repeat(40), b => b.portsConfigSha256 = 'b'.repeat(64), b => b.artifact.sha256 = 'c'.repeat(64)]) {
    const body = clone(f.body); mutate(body); assert.throws(() => createSignedReceipt(body, f.options), /mismatch/);
  }
});

test('real chmod/lstat, symlink and traversal boundaries; keys remain outside Git', t => {
  const f = fixture(t);
  assert.equal(assertProtectedPath(f.keyDirectory, { directory: true, repositoryRoot }).mode, 0o700);
  assert.equal(assertProtectedPath(f.keys.privateKeyPath, { repositoryRoot }).mode, 0o600);
  fs.chmodSync(f.keys.privateKeyPath, 0o640); assert.throws(() => createSignedReceipt(f.body, f.options), /permission/); fs.chmodSync(f.keys.privateKeyPath, 0o600);
  fs.chmodSync(f.keyDirectory, 0o750); assert.throws(() => createSignedReceipt(f.body, f.options), /permission/); fs.chmodSync(f.keyDirectory, 0o700);
  for (const relativePath of ['../keys/receipt-ed25519-private.pem', '/tmp/file', 'a/../../file', './binding.json', 'receipt-ed25519-private.pem', 'password.txt']) assert.throws(() => guardRunPath({ ...f, repositoryRoot, relativePath }), /relative/);
  fs.symlinkSync(path.join(f.runDirectory, 'binding.json'), path.join(f.runDirectory, 'alias.json'));
  assert.throws(() => guardRunPath({ ...f, repositoryRoot, relativePath: 'alias.json' }), /Symlink/);
  fs.symlinkSync(path.join(f.root, 'absent'), path.join(f.runDirectory, 'dangling.json'));
  assert.throws(() => guardRunPath({ ...f, repositoryRoot, relativePath: 'dangling.json', mustExist: false }));
  assert.throws(() => assertProtectedPath(repositoryRoot, { directory: true, repositoryRoot }), /outside Git/);
  assert.throws(() => createReceiptKey({ keyDirectory: f.keyDirectory, repositoryRoot }), /exists/);
  const nested = path.join(f.runDirectory, 'classes'); fs.mkdirSync(nested, { mode: 0o700 });
  fs.writeFileSync(path.join(nested, 'Reader' + String.fromCharCode(36) + 'Inner.class'), 'public-class-fixture', { mode: 0o400 });
  fs.chmodSync(nested, 0o500);
  assert.equal(hashArtifact({ ...f, repositoryRoot, relativePath: 'classes/Reader' + String.fromCharCode(36) + 'Inner.class' }).bytes, 20);
  fs.chmodSync(nested, 0o700);
  fs.chmodSync(path.join(f.runDirectory, 'binding.json'), 0o400);
  assert.deepEqual(hashArtifact({ ...f, repositoryRoot, relativePath: 'binding.json' }), f.body.artifact);
  fs.chmodSync(path.join(f.runDirectory, 'binding.json'), 0o444); assert.throws(() => hashArtifact({ ...f, repositoryRoot, relativePath: 'binding.json' }), /permission/); fs.chmodSync(path.join(f.runDirectory, 'binding.json'), 0o600);
});

test('public evidence redacts full process paths; summary cannot be used as signed original', t => {
  const f = fixture(t); f.body.event = 'owned-child-started'; f.body.process = readProcessIdentity(process.pid);
  const summary = toPublicReceiptEvidence(createSignedReceipt(f.body, f.options));
  const text = JSON.stringify(summary);
  assert.equal(summary.kind, 'redacted-summary-not-signed-original');
  assert.ok(!text.includes(f.body.process.cwd)); assert.ok(!text.includes(f.body.process.executable)); assert.ok(!text.includes(f.root));
  assert.throws(() => verifySignedReceipt(summary, f), /schema/);
});

test('unsupported signed exit event rejects before any current PID read; retained exit is local only', t => {
  const f = fixture(t);
  const body = { ...f.body, event: 'owned-child-exited', process: readProcessIdentity(process.pid) };
  assert.throws(() => validateReceipt(body), /event\/platform unsupported/);
  assert.throws(() => createSignedReceipt(body, f.options), /event\/platform unsupported/);
});
