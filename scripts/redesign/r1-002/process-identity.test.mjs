import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { hashArtifact } from './receipt.mjs';
import { readProcessIdentity, compareProcessIdentity, registerOwnedChild, verifyOwnedChild, stopOwnedChild, rejectDetachedStop } from './process-identity.mjs';
const repositoryRoot = fs.realpathSync(process.cwd());
const mac = process.platform === 'darwin';
async function toy(t, stubborn = false) {
  const runDirectory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'r1-002-toy-')); fs.chmodSync(runDirectory, 0o700);
  fs.writeFileSync(path.join(runDirectory, 'binding.json'), '{"kind":"toy-no-listener-no-db"}', { mode: 0o600 });
  const child = spawn(process.execPath, ['-e', `process.on('SIGTERM',()=>{${stubborn ? '' : 'process.exit(0)'}}); process.on('message',m=>{if(m==='exit')process.exit(0)}); process.send('ready'); setInterval(()=>{},1000)`], { cwd: runDirectory, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const timeout = setTimeout(() => { if (child.connected) child.send('exit'); }, 5000);
  t.after(async () => {
    clearTimeout(timeout);
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit'); if (child.connected) child.send('exit'); await exited;
    }
    fs.rmSync(runDirectory, { recursive: true, force: true });
  });
  const [message] = await once(child, 'message'); assert.equal(message, 'ready');
  const artifact = hashArtifact({ runDirectory, relativePath: 'binding.json', repositoryRoot });
  const options = { runId: randomUUID(), artifact, runDirectory, repositoryRoot };
  return { child, options, identity: readProcessIdentity(child.pid) };
}

test('actual macOS PID/PPID/executable/cwd/kernel microsecond birth read, no argv/env', { skip: !mac }, () => {
  const identity = readProcessIdentity(process.pid);
  assert.equal(identity.pid, process.pid); assert.equal(identity.ppid, process.ppid); assert.equal(identity.cwd, fs.realpathSync(process.cwd())); assert.equal(fs.realpathSync(identity.executable), fs.realpathSync(process.execPath));
  assert.equal(identity.birthTimeKind, 'darwin-kernel-microseconds'); assert.match(identity.birthTime, /^\d+\.\d{6}$/);
  assert.ok(!('argv' in identity)); assert.ok(!('env' in identity));
});

test('synthetic fixture: PID reuse birth/cwd/executable/PPID changes reject', () => {
  const fixture = { platform: 'darwin', pid: 100, ppid: 99, executable: '/fixture/node', cwd: '/fixture/run', birthTime: '1000.123456', birthTimeKind: 'darwin-kernel-microseconds' };
  assert.equal(compareProcessIdentity(fixture, { ...fixture }).matches, true);
  for (const [field, value] of [['birthTime', '1000.123457'], ['ppid', 98], ['executable', '/fixture/other'], ['cwd', '/fixture/other'], ['pid', 101]]) assert.ok(compareProcessIdentity(fixture, { ...fixture, [field]: value }).mismatches.includes(field));
  assert.equal(compareProcessIdentity({}, {}).matches, false);
});

test('detached CLI/numeric PID/shaped handles and platform spoofing reject before signal', () => {
  assert.throws(() => rejectDetachedStop(), /Detached CLI/);
  assert.throws(() => registerOwnedChild({ pid: process.pid }), /handle/);
  assert.throws(() => registerOwnedChild(new ChildProcess()), /handle/);
  assert.throws(() => verifyOwnedChild(Object.freeze({ kind: 'same-supervisor-owned-child' }), { expectedIdentity: {} }), /detached/);
  assert.throws(() => readProcessIdentity(process.pid, { platform: 'win32' }), /platform|unsupported/);
  assert.throws(() => readProcessIdentity(-1), /PID/);
});

test('real retained direct toy child: identity/artifact verified, bounded SIGTERM exits', { skip: !mac }, async t => {
  const f = await toy(t);
  const token = registerOwnedChild(f.child, f.options);
  assert.deepEqual(verifyOwnedChild(token, { expectedIdentity: f.identity }), f.identity);
  assert.throws(() => verifyOwnedChild(token, { expectedIdentity: { ...f.identity, birthTime: '1.000001' } }), /birth/);
  const result = await stopOwnedChild(token, { expectedIdentity: f.identity, timeoutMs: 1000 });
  assert.equal(result.status, 'EXITED'); assert.equal(result.signal, 'SIGTERM'); assert.equal(result.exitCode, 0);
  assert.throws(() => verifyOwnedChild(token, { expectedIdentity: f.identity }), /no longer live/);
});

test('real artifact replacement rejects stop; original toy still alive without signal', { skip: !mac }, async t => {
  const f = await toy(t); const token = registerOwnedChild(f.child, f.options);
  fs.writeFileSync(path.join(f.options.runDirectory, 'binding.json'), '{"kind":"changed-fixture"}');
  await assert.rejects(stopOwnedChild(token, { expectedIdentity: f.identity }), /artifact changed/);
  assert.equal(f.child.killed, false); assert.equal(f.child.exitCode, null);
});

test('real stubborn toy SIGTERM times out; no escalation, owned IPC cleanup only', { skip: !mac }, async t => {
  const f = await toy(t, true); const token = registerOwnedChild(f.child, f.options);
  await assert.rejects(stopOwnedChild(token, { expectedIdentity: f.identity, timeoutMs: 5001 }), /Bounded/);
  const result = await stopOwnedChild(token, { expectedIdentity: f.identity, timeoutMs: 60 });
  assert.equal(result.status, 'TIMEOUT'); assert.equal(result.exitCode, null); assert.equal(result.exitSignal, null);
  assert.deepEqual(verifyOwnedChild(token, { expectedIdentity: f.identity }), f.identity);
  const exited = once(f.child, 'exit'); f.child.send('exit'); await exited;
});
