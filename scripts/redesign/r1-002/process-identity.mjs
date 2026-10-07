import fs from 'node:fs';
import path from 'node:path';
import { ChildProcess, execFileSync } from 'node:child_process';
import { canonicalize, hashArtifact } from './receipt.mjs';

const fail = message => { throw new Error(message); };
const owned = new WeakMap();
// Fixed libproc ABI from the local macOS SDK proc_info.h. No command line or environment is requested.
const darwinReader = `import ctypes, json, sys
class BSD(ctypes.Structure):
 _fields_ = [(n,ctypes.c_uint32) for n in ['flags','status','xstatus','pid','ppid','uid','gid','ruid','rgid','svuid','svgid','reserved']] + [('comm',ctypes.c_char*16),('name',ctypes.c_char*32)] + [(n,ctypes.c_uint32) for n in ['nfiles','pgid','pjobc','tdev','tpgid']] + [('nice',ctypes.c_int32),('seconds',ctypes.c_uint64),('micros',ctypes.c_uint64)]
pid=int(sys.argv[1]); lib=ctypes.CDLL('/usr/lib/libproc.dylib'); info=BSD()
lib.proc_pidinfo.argtypes=[ctypes.c_int,ctypes.c_int,ctypes.c_uint64,ctypes.c_void_p,ctypes.c_int]
lib.proc_pidpath.argtypes=[ctypes.c_int,ctypes.c_void_p,ctypes.c_uint32]
if lib.proc_pidinfo(pid,3,0,ctypes.byref(info),ctypes.sizeof(info)) != ctypes.sizeof(info) or info.pid != pid: raise RuntimeError('Kernel identity unavailable')
buf=ctypes.create_string_buffer(4096)
if lib.proc_pidpath(pid,buf,4096) <= 0: raise RuntimeError('Executable identity unavailable')
print(json.dumps({'pid':info.pid,'ppid':info.ppid,'executable':buf.value.decode(),'birthTime':str(info.seconds)+'.'+str(info.micros).zfill(6)}))`;

export function readProcessIdentity(pid, { platform = process.platform } = {}) {
  if (!Number.isSafeInteger(pid) || pid <= 0 || platform !== process.platform) fail('Actual local process PID/platform required');
  if (platform === 'darwin') {
    const value = JSON.parse(execFileSync('/usr/bin/python3', ['-c', darwinReader, String(pid)], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'pipe'] }));
    const cwdLines = execFileSync('/usr/sbin/lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'pipe'] }).split('\n').filter(v => v.startsWith('n'));
    if (cwdLines.length !== 1 || !path.isAbsolute(cwdLines[0].slice(1))) fail('Process cwd unavailable/ambiguous');
    // Re-read kernel birth to reject process replacement during metadata collection.
    const after = JSON.parse(execFileSync('/usr/bin/python3', ['-c', darwinReader, String(pid)], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'pipe'] }));
    if (canonicalize(value) !== canonicalize(after)) fail('Process identity changed during read');
    return { platform, ...value, cwd: cwdLines[0].slice(1), birthTimeKind: 'darwin-kernel-microseconds' };
  }
  if (platform === 'linux') {
    const readStat = () => {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
      // comm may contain spaces/parentheses; fields after final ')' begin at field 3.
      const fields = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/);
      return { pid: Number(stat.slice(0, stat.indexOf(' '))), ppid: Number(fields[1]), birthTime: fields[19] };
    };
    const before = readStat();
    const value = { platform, ...before, executable: fs.readlinkSync(`/proc/${pid}/exe`), cwd: fs.readlinkSync(`/proc/${pid}/cwd`), birthTimeKind: 'linux-start-ticks', bootId: fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim() };
    if (canonicalize(before) !== canonicalize(readStat())) fail('Process identity changed during read');
    return value;
  }
  fail('Windows/other OS identity unsupported: effective CIM/DACL unavailable');
}

export function compareProcessIdentity(expected, actual) {
  const fields = ['platform', 'pid', 'ppid', 'executable', 'cwd', 'birthTime', 'birthTimeKind', 'bootId'];
  const mismatches = fields.filter(field => expected?.[field] !== actual?.[field]);
  if (!expected || !actual || !expected.birthTime || !actual.birthTime) mismatches.push('missingIdentity');
  return { matches: mismatches.length === 0, mismatches };
}

export function registerOwnedChild(child, { runId, artifact, runDirectory, repositoryRoot } = {}) {
  // A live native handle, not an arbitrary PID or a ChildProcess-shaped object, is retained.
  if (!(child instanceof ChildProcess) || !child._handle || typeof child._handle.kill !== 'function' || child._handle.pid !== child.pid || !child.pid || child.exitCode !== null || child.signalCode !== null || child.killed) fail('Live retained ChildProcess handle required; adoption forbidden');
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(runId)) fail('Owned runId invalid');
  if (!repositoryRoot) fail('Owned child repository root required');
  const identity = readProcessIdentity(child.pid);
  if (identity.ppid !== process.pid || identity.cwd !== fs.realpathSync(runDirectory)) fail('Owned direct-child/cwd mismatch');
  if (canonicalize(hashArtifact({ runDirectory, relativePath: artifact.path, repositoryRoot })) !== canonicalize(artifact)) fail('Owned artifact mismatch');
  const token = Object.freeze({ kind: 'same-supervisor-owned-child' });
  const record = { child, nativeHandle: child._handle, supervisorPid: process.pid, identity, runId, artifact: JSON.parse(canonicalize(artifact)), runDirectory, repositoryRoot, exited: false };
  child.once('exit', () => { record.exited = true; });
  owned.set(token, record);
  return token;
}

export function verifyOwnedChild(token, { expectedIdentity } = {}) {
  const record = owned.get(token);
  if (!record || record.supervisorPid !== process.pid || record.exited || record.child.exitCode !== null || record.child.signalCode !== null || record.child._handle !== record.nativeHandle) fail('Retained owned child no longer live; detached stop forbidden');
  if (!compareProcessIdentity(record.identity, expectedIdentity).matches) fail('Expected owned birth identity mismatch');
  const actual = readProcessIdentity(record.child.pid);
  if (!compareProcessIdentity(record.identity, actual).matches || actual.ppid !== process.pid) fail('Current owned process identity mismatch');
  if (canonicalize(hashArtifact({ runDirectory: record.runDirectory, relativePath: record.artifact.path, repositoryRoot: record.repositoryRoot })) !== canonicalize(record.artifact)) fail('Owned artifact changed');
  return actual;
}

export async function stopOwnedChild(token, { expectedIdentity, timeoutMs = 1000 } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 5000) fail('Bounded stop timeout required');
  // Linux needs a proven pidfd implementation; this module deliberately refuses it.
  if (process.platform !== 'darwin') fail('Owned stop implemented only on actual macOS; Linux/Windows unverified');
  const identity = verifyOwnedChild(token, { expectedIdentity });
  const record = owned.get(token);
  const child = record.child;
  return new Promise((resolve, reject) => {
    let timer;
    const finish = status => {
      clearTimeout(timer);
      child.removeListener('exit', onExit);
      resolve({ status, identity, signal: 'SIGTERM', exitCode: child.exitCode, exitSignal: child.signalCode });
    };
    const onExit = () => finish('EXITED');
    child.once('exit', onExit);
    timer = setTimeout(() => finish('TIMEOUT'), timeoutMs);
    // Native handle captured before verification and still identical, never a fresh PID lookup.
    if (child._handle !== record.nativeHandle || record.exited) {
      clearTimeout(timer); child.removeListener('exit', onExit); reject(new Error('Owned child exited before signal')); return;
    }
    const error = record.nativeHandle.kill(15);
    if (error !== 0) { clearTimeout(timer); child.removeListener('exit', onExit); reject(new Error('Owned native SIGTERM rejected')); }
  });
}

export function rejectDetachedStop() { fail('Detached CLI stop rejected: no retained ChildProcess handle, PID birth TOCTOU cannot be closed'); }
