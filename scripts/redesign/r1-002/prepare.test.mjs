import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, chmodSync, symlinkSync, readFileSync, realpathSync, writeFileSync, lstatSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertExternalDirectory, transportPlan, validateTransportPlan, parseArguments, javaArgument, root, tlsPrefix,
  checkPrivateMetadata, verifyPrivateMaterialPermissions } from './prepare.mjs';
import { sanitizeEvidence } from './sanitize-evidence.mjs';

const ports = JSON.parse(readFileSync(path.join(root, 'config/local-ports.json')));
test('rejects unknown, duplicate, missing, and unsupported mode arguments', () => {
  for (const args of [['--stop'], ['--mode', 'start'], ['--mode'], ['--mode', 'inspect', '--mode', 'inspect'], ['--insecure', 'true']]) {
    assert.throws(() => parseArguments(args));
  }
});
test('creation requires a caller-selected protected external parent', () => {
  assert.throws(() => parseArguments(['--mode', 'create-tls']));
  assert.throws(() => parseArguments(['--mode', 'inspect', '--private-parent', '/tmp']));
  assert.equal(parseArguments(['--mode', 'create-tls', '--private-parent', '/private'])["--private-parent"], '/private');
});
test('resolves directory symlinks before repository exclusion', () => {
  if (process.platform === 'win32') return;
  const temporary = mkdtempSync(path.join(os.tmpdir(), 'r1-002-test-'));
  try {
    symlinkSync(root, path.join(temporary, 'repo'));
    assert.throws(() => assertExternalDirectory(root), /outside/);
    assert.throws(() => assertExternalDirectory(path.join(temporary, 'repo')), /outside/);
  } finally { rmSync(temporary, { recursive: true }); }
});
test('refuses group/world accessible private directory', () => {
  if (process.platform === 'win32') return;
  const temporary = mkdtempSync(path.join(os.tmpdir(), 'r1-002-test-'));
  try {
    chmodSync(temporary, 0o755);
    assert.throws(() => assertExternalDirectory(temporary), /0700/);
    chmodSync(temporary, 0o700);
    assert.equal(assertExternalDirectory(temporary), realpathSync(temporary));
  } finally { rmSync(temporary, { recursive: true }); }
});
test('fixed IAM and Gateway ports reject drift without opening a listener', () => {
  const drift = structuredClone(ports); drift.services['iam-service'].port++;
  assert.throws(() => transportPlan('/private', drift));
  assert.throws(() => transportPlan('/private', { ...ports, host: '0.0.0.0' }));
});
test('preserves issuer identity while both IAM transports use HTTPS', () => {
  const plan = transportPlan('/protected directory', ports);
  assert.equal(validateTransportPlan(plan), true);
  assert.equal(plan.issuer, 'http://127.0.0.1:18087');
  assert.match(plan.gatewayArguments[0], /protected%20directory/);
});
test('rejects old prefix, insecure trust manager, transport downgrade, and acceptance claims', () => {
  for (const mutate of [
    plan => { plan.gatewayArguments[0] = plan.gatewayArguments[0].replace('.server.webflux', ''); },
    plan => { plan.gatewayArguments[1] = `--${tlsPrefix}.use-insecure-trust-manager=true`; },
    plan => { plan.iamTransport = 'http://127.0.0.1:18087'; },
    plan => { plan.jwksTransport += '?token=unexpected'; },
    plan => { plan.issuer = plan.iamTransport; },
    plan => { plan.runtimeVerified = true; },
  ]) { const plan = transportPlan('/private', ports); mutate(plan); assert.throws(() => validateTransportPlan(plan)); }
});
test('Java argfile quoting preserves spaces and Windows path separators; rejects injected lines', () => {
  assert.equal(javaArgument('-Dpath=C:\\Private Dir\\trust.p12'), '"-Dpath=C:\\\\Private Dir\\\\trust.p12"');
  assert.equal(javaArgument('-Dpath=/private dir/trust.p12'), '"-Dpath=/private dir/trust.p12"');
  for (const value of ['bad\n-Dunsafe=true', 'bad\rvalue', 'bad\0value']) assert.throws(() => javaArgument(value));
});
test('private readback records actual owner/mode and refuses a changed file permission', () => {
  if (process.platform === 'win32') return;
  const directory = mkdtempSync(path.join(os.tmpdir(), 'r1-002-readback-'));
  try {
    const file = path.join(directory, 'test-private.args');
    writeFileSync(file, 'synthetic-non-secret\n', { mode: 0o600 });
    const report = verifyPrivateMaterialPermissions(directory, ['test-private.args']);
    assert.equal(report.method, 'filesystem-lstat-owner-and-mode');
    assert.equal(report.checks[1].ownerUid, lstatSync(file).uid);
    assert.equal(report.checks[1].ownerUid, process.getuid());
    assert.equal(report.checks[1].mode, '0600');
    chmodSync(file, 0o640);
    assert.throws(() => verifyPrivateMaterialPermissions(directory, ['test-private.args']), /readback rejected/);
    assert.throws(() => checkPrivateMetadata(lstatSync(file), process.getuid() + 1, 'file', 'test-private.args'), /ownerMatches/);
  } finally { rmSync(directory, { recursive: true }); }
});
test('private readback refuses symlink, wrong file type, path escape, and non-0700 directory', () => {
  if (process.platform === 'win32') return;
  const directory = mkdtempSync(path.join(os.tmpdir(), 'r1-002-readback-'));
  try {
    const file = path.join(directory, 'test-private.args');
    writeFileSync(file, 'synthetic-non-secret\n', { mode: 0o600 });
    symlinkSync(file, path.join(directory, 'alias.args'));
    assert.throws(() => verifyPrivateMaterialPermissions(directory, ['alias.args']), /readback rejected/);
    assert.throws(() => checkPrivateMetadata(lstatSync(directory), process.getuid(), 'file', 'wrong-type'), /readback rejected/);
    assert.throws(() => verifyPrivateMaterialPermissions(directory, ['../escape']), /local filename/);
    chmodSync(directory, 0o500);
    assert.throws(() => verifyPrivateMaterialPermissions(directory, ['test-private.args']), /0700/);
  } finally { chmodSync(directory, 0o700); rmSync(directory, { recursive: true }); }
});
test('archive sanitization redacts material paths without changing executable input or source provenance', () => {
  const directory = path.join(os.tmpdir(), 'r1-002-private-parent', 'material');
  const original = { directory, plan: transportPlan(directory, ports), sourcePath: path.join(root, 'services/api-gateway'), ownerUid: 502,
    commands: [['--private-parent', path.dirname(directory)]], privateFiles: [`${directory}/gateway-jvm.args`] };
  const archived = sanitizeEvidence(original, [directory], root);
  assert.equal(archived.directory, '<PRIVATE_MATERIAL_DIR>');
  assert.equal(archived.privateFiles[0], '<PRIVATE_MATERIAL_DIR>/gateway-jvm.args');
  assert.equal(archived.commands[0][1], '<PRIVATE_MATERIAL_PARENT>');
  assert.equal(archived.sourcePath, original.sourcePath);
  assert.equal(archived.ownerUid, 502);
  assert.equal(validateTransportPlan(original.plan), true);
  assert.equal(original.directory, directory);
  assert.ok(!JSON.stringify(archived).includes(directory));
  assert.throws(() => sanitizeEvidence(original, [root], root));
});
