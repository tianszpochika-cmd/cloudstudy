import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, rmSync, realpathSync, symlinkSync, lstatSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID, createPrivateKey, sign } from 'node:crypto';
import { parseArgs, registeredPorts, assessDynamicGate, sourceSnapshot, verifyStagedRun, dispatch, repositoryRoot,
  sanitizeEvidence } from './lifecycle.mjs';
import { validateHarnessConfig, validatePublicEnvelope, launchHarness, probeHarness, TLS_CASES } from './tls-harness.mjs';
import { canonicalize, createReceiptKey, createSignedReceipt, hashArtifact, guardRunPath,
  RECEIPT_SCHEMA_VERSION, RECEIPT_INTENT } from './receipt.mjs';

const hash = data => createHash('sha256').update(data).digest('hex');
const registered = registeredPorts();
const configFixture = () => ({ bindHost: '127.0.0.1', gatewayPort: 18070, publisherPort: 18087,
  jwksUri: 'https://127.0.0.1:18087/api/v1/auth/jwks', routeCertificate: '/fixture/public-ca',
  independentTrustStore: '/fixture/truststore', insecureTrustManager: false, hostnameVerification: true, httpFallback: false });
const noMaterialRead = { registered, repositoryRoot, inspectMaterial: () => true };
const freeFixture = [{ port: 18070, state: 'FREE' }, { port: 18087, state: 'FREE' }];

test('default mode is read-only preflight; arbitrary command/adopt/kill and approval bool rejected', () => {
  assert.equal(parseArgs([]).mode, 'preflight');
  for (const args of [['--exec', 'sh'], ['--mode', 'kill-port'], ['--mode', 'adopt-existing'],
    ['--approved-window', 'true'], ['--authority-key', '/fixture/self-signed'], ['--mode', 'stage', '--mode', 'probe']]) {
    assert.throws(() => parseArgs(args));
  }
});

test('unknown or traversing run id rejected before filesystem access', () => {
  for (const run of ['../r1-002-other', 'r1-002-a/../../other', 'existing-runner', '/absolute']) {
    assert.throws(() => parseArgs(['--run-id', run]), /UNKNOWN_RUN/);
  }
});

test('registered ports are fixed and configuration bytes hashed', () => {
  assert.equal(registered.gatewayPort, 18070); assert.equal(registered.publisherPort, 18087);
  assert.equal(registered.bindHost, '127.0.0.1');
  assert.equal(registered.sha256, hash(readFileSync(path.join(repositoryRoot, 'config/local-ports.json'))));
});

test('fixture occupied/unknown ports refuse with zero signal/listener/DB', () => {
  for (const states of [[{ port: 18070, state: 'OCCUPIED' }, freeFixture[1]],
    [{ port: 18070, state: 'UNVERIFIED' }, freeFixture[1]], []]) {
    const result = assessDynamicGate({ portStates: states });
    assert.equal(result.allowed, false); assert.ok(result.blockers.includes('FIXED_PORTS_NOT_FREE'));
    assert.deepEqual([result.signals, result.listeners, result.dbOperations], [0, 0, 0]);
  }
});

test('missing/self-signed/expired fixture windows never authorize D2', () => {
  for (const window of [null, { independentlyTrusted: false, notBefore: 0, expiresAt: 5000 },
    { independentlyTrusted: true, notBefore: 0, expiresAt: 10 }]) {
    const result = assessDynamicGate({ portStates: freeFixture, window, now: 100 });
    assert.equal(result.allowed, false); assert.ok(result.blockers.includes('D2_AUTHORITY_NOT_CONFIGURED'));
  }
  assert.ok(assessDynamicGate({ portStates: freeFixture, window: { independentlyTrusted: true, notBefore: 0, expiresAt: 10 }, now: 100 })
    .blockers.includes('WINDOW_NOT_ACTIVE'));
});

test('fixture source provenance/material/binding deficiencies are independent blockers', () => {
  const result = assessDynamicGate({ portStates: freeFixture, bindingValid: false, materialsValid: false });
  for (const blocker of ['SOURCE_ARTIFACT_BINDING_MISSING', 'SOURCE_TO_JAR_UNPROVEN', 'MATERIAL_PERMISSIONS_UNVERIFIED']) {
    assert.ok(result.blockers.includes(blocker));
  }
});

test('all seemingly green test fixture values still fail without real D2 authority', () => {
  const result = assessDynamicGate({ portStates: freeFixture, bindingValid: true, sourceProvenance: 'REVIEWED_BUILD_RECEIPT',
    materialsValid: true, window: { independentlyTrusted: true, notBefore: 1, expiresAt: 1000 }, now: 100 });
  assert.deepEqual(result.blockers, ['D2_AUTHORITY_NOT_CONFIGURED']); assert.equal(result.allowed, false);
});

test('TLS config rejects insecure/hostname bypass/fallback and unknown overrides', () => {
  for (const update of [{ insecureTrustManager: true }, { hostnameVerification: false }, { httpFallback: true },
    { environment: { NODE_TLS_REJECT_UNAUTHORIZED: '0' } }, { arbitraryCommand: 'curl' }]) {
    assert.throws(() => validateHarnessConfig({ ...configFixture(), ...update }, noMaterialRead));
  }
});

test('TLS config locks endpoint, host and both registered ports', () => {
  for (const update of [{ bindHost: '0.0.0.0' }, { gatewayPort: 18071 }, { publisherPort: 18088 },
    { jwksUri: 'http://127.0.0.1:18087/api/v1/auth/jwks' }, { jwksUri: 'https://remote.invalid/jwks' }]) {
    assert.throws(() => validateHarnessConfig({ ...configFixture(), ...update }, noMaterialRead), /FIXED_LOOPBACK_HTTPS_REQUIRED/);
  }
  assert.equal(validateHarnessConfig(configFixture(), noMaterialRead).insecureTrustManager, false);
});

test('independent materials cannot be aliases by identical path', () => {
  assert.throws(() => validateHarnessConfig({ ...configFixture(), independentTrustStore: '/fixture/public-ca' }, noMaterialRead), /INDEPENDENT_CLIENT_MATERIALS/);
});

test('public publisher validation rejects private fields without disguising production behavior', () => {
  const document = { data: { keys: [{ kty: 'RSA', kid: 'fixture', n: 'AQ', e: 'AQAB' }] } };
  assert.equal(validatePublicEnvelope(document), document);
  for (const privateField of ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth']) {
    assert.throws(() => validatePublicEnvelope({ data: { keys: [{ ...document.data.keys[0], [privateField]: 'fixture-not-secret' }] } }), /PUBLIC_RSA_ONLY/);
  }
  assert.throws(() => validatePublicEnvelope({ keys: [] }), /PUBLIC_ENVELOPE_REQUIRED/);
});

test('all TLS cases remain NOT_EXECUTED; dynamic helpers refuse synchronously', () => {
  assert.equal(TLS_CASES.length, 8); assert.ok(TLS_CASES.every(item => item.status === 'NOT_EXECUTED'));
  assert.throws(launchHarness, /D2_NOT_AUTHORIZED/); assert.throws(probeHarness, /D2_NOT_AUTHORIZED/);
  assert.throws(() => dispatch({ mode: 'launch-harness', approvedWindow: true }), /D2_NOT_AUTHORIZED/);
  assert.throws(() => dispatch({ mode: 'probe' }), /D2_NOT_AUTHORIZED/);
  assert.throws(() => dispatch({ mode: 'restore-verify' }), /D2_RESTORE_BUNDLE_NOT_APPROVED/);
});

test('public archive sanitizer redacts run/key/material paths without mutating input', () => {
  const input = { runDirectory: '/external/task/run', keyDirectory: '/external/key', material: '/external/material/test-ca.pem',
    source: 'services/api-gateway/pom.xml', javaClassSource: 'file:///external/task/run/artifact/BOOT-INF/classes/' };
  const before = JSON.stringify(input);
  const result = sanitizeEvidence(input, { runRoot: '/external/task', keyDirectory: '/external/key', materialDirectory: '/external/material' });
  assert.equal(JSON.stringify(input), before); assert.ok(!JSON.stringify(result).includes('/external'));
  assert.equal(result.source, input.source);
});

function fixture() {
  const parent = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'r1-002-d1-test-'))); chmodSync(parent, 0o700);
  const run = path.join(parent, `r1-002-${randomUUID()}`); mkdirSync(run, { mode: 0o700 });
  const keyDirectory = path.join(parent, 'receipt-key'); mkdirSync(keyDirectory, { mode: 0o700 });
  const key = createReceiptKey({ keyDirectory, repositoryRoot });
  const source = sourceSnapshot();
  const entry = 'artifact.bin'; writeFileSync(path.join(run, entry), 'public fixture artifact', { mode: 0o600 });
  const binding = { kind: 'R1_002_D1_ARTIFACT_BINDING', runId: path.basename(run).slice('r1-002-'.length), source,
    portsConfigSha256: registered.sha256, iamBusinessRuntime: false, entries: [hashArtifact({ runDirectory: run, relativePath: entry, repositoryRoot })], tools: [] };
  writeFileSync(path.join(run, 'binding.json'), canonicalize(binding) + '\n', { mode: 0o600 });
  const artifact = hashArtifact({ runDirectory: run, relativePath: 'binding.json', repositoryRoot });
  const body = { schemaVersion: RECEIPT_SCHEMA_VERSION, runId: path.basename(run).slice('r1-002-'.length), intent: RECEIPT_INTENT,
    event: 'staged', createdAt: new Date().toISOString(), platform: process.platform, source,
    portsConfigSha256: registered.sha256, artifact, bindHost: '127.0.0.1', ports: [18070, 18087],
    process: null, ownerKind: 'harness', iamBusinessRuntime: false };
  const signed = createSignedReceipt(body, { ...key, keyDirectory, repositoryRoot, runDirectory: run });
  writeFileSync(path.join(run, 'receipt.json'), canonicalize(signed) + '\n', { mode: 0o600 });
  const trustedPublicKey = readFileSync(key.publicKeyPath, 'utf8');
  return { parent, run, keyDirectory, trustedPublicKey, body, binding, signed,
    sign: changed => createSignedReceipt(changed, { ...key, keyDirectory, repositoryRoot, runDirectory: run }),
    // Negative fixture only: independently sign an allowed schema from the other OS, without claiming actual OS execution.
    signOtherPlatformFixture: () => {
      const changed = { ...body, platform: process.platform === 'darwin' ? 'linux' : 'darwin' };
      return { ...signed, body: changed, signature: sign(null, Buffer.from(canonicalize(changed)),
        createPrivateKey(readFileSync(key.privateKeyPath))).toString('base64') };
    },
    verify: () => verifyStagedRun({ runDirectory: run, trustedPublicKey }), cleanup: () => rmSync(parent, { recursive: true, force: true }) };
}

test('signed offline fixture validates manifest/context; this is not source-to-JAR proof', () => {
  const f = fixture(); try { const result = f.verify(); assert.equal(result.signature, 'PASS'); assert.equal(result.sourceToJarVerified, false); }
  finally { f.cleanup(); }
});

test('artifact byte drift is refused using signed manifest', () => {
  const f = fixture(); try { writeFileSync(path.join(f.run, 'artifact.bin'), 'changed fixture'); assert.throws(f.verify, /ARTIFACT_DRIFT/); }
  finally { f.cleanup(); }
});

test('manifest byte drift is refused without recomputing trust from edited body', () => {
  const f = fixture(); try { writeFileSync(path.join(f.run, 'binding.json'), JSON.stringify({ ...f.binding, iamBusinessRuntime: true })); assert.throws(f.verify); }
  finally { f.cleanup(); }
});

test('receipt signature tampering is refused', () => {
  const f = fixture(); try { f.signed.signature = 'A'.repeat(f.signed.signature.length); writeFileSync(path.join(f.run, 'receipt.json'), JSON.stringify(f.signed)); assert.throws(f.verify); }
  finally { f.cleanup(); }
});

test('receipt for another source/port or staged metadata context cannot be trusted', () => {
  const f = fixture(); try { f.signed.body.portsConfigSha256 = '0'.repeat(64); writeFileSync(path.join(f.run, 'receipt.json'), JSON.stringify(f.signed)); assert.throws(f.verify); }
  finally { f.cleanup(); }
  for (const change of [{ ports: [] }, { ownerKind: 'toy-child' }]) {
    const other = fixture(); try {
      const resigned = other.sign({ ...other.body, ...change });
      writeFileSync(path.join(other.run, 'receipt.json'), JSON.stringify(resigned));
      assert.throws(other.verify, /receipt binding mismatch|STAGED_RECEIPT_METADATA_MISMATCH/i);
    } finally { other.cleanup(); }
  }
  const otherOs = fixture(); try {
    writeFileSync(path.join(otherOs.run, 'receipt.json'), JSON.stringify(otherOs.signOtherPlatformFixture()));
    assert.throws(otherOs.verify, /receipt binding mismatch|STAGED_RECEIPT_METADATA_MISMATCH/i);
  } finally { otherOs.cleanup(); }
});

test('artifact symlink and traversal rejected by shared guard', () => {
  const f = fixture(); try {
    rmSync(path.join(f.run, 'artifact.bin')); symlinkSync(path.join(f.run, 'binding.json'), path.join(f.run, 'artifact.bin'));
    assert.throws(f.verify);
    assert.throws(() => guardRunPath({ runDirectory: f.run, relativePath: '../other/artifact.bin', repositoryRoot }));
  } finally { f.cleanup(); }
});

test('actual material chmod downgrade triggers protected-path refusal', () => {
  const f = fixture(); try {
    const ca = path.join(f.parent, 'ca.pem'), store = path.join(f.parent, 'truststore.p12');
    writeFileSync(ca, 'public fixture', { mode: 0o600 }); writeFileSync(store, 'public fixture', { mode: 0o600 });
    const config = { ...configFixture(), routeCertificate: ca, independentTrustStore: store };
    validateHarnessConfig(config, { registered, repositoryRoot });
    chmodSync(ca, 0o640);
    assert.throws(() => validateHarnessConfig(config, { registered, repositoryRoot }));
  } finally { f.cleanup(); }
});

test('unknown run and detached stop cannot reach a signal', () => {
  const f = fixture(); try {
    assert.throws(() => dispatch({ mode: 'stop-owned', runRoot: f.parent, runId: 'r1-002-missing' }));
    assert.throws(() => dispatch({ mode: 'stop-owned', runRoot: f.parent, runId: path.basename(f.run) }));
  } finally { f.cleanup(); }
});
