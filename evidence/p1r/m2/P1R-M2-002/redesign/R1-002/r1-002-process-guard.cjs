'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const net = require('node:net');
const normalize = p => p.replace(/\\/g, '/').toLowerCase();
function inspect(pid) {
  assert.ok(Number.isSafeInteger(pid) && pid > 0, 'invalid PID');
  const code = "$p=Get-CimInstance Win32_Process -Filter 'ProcessId=" + pid + "'; if($null -eq $p){'null'}else{@{pid=[int]$p.ProcessId;createdAt=$p.CreationDate.ToUniversalTime().ToString('o');executable=$p.ExecutablePath;commandLine=$p.CommandLine}|ConvertTo-Json -Compress}";
  return JSON.parse(execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', code], { encoding: 'utf8', windowsHide: true }));
}
function assertOwned(receipt, current, jarPath, port, allowLegacy = false) {
  assert.ok(current && receipt.pid === current.pid, 'PID missing/mismatch');
  assert.match(current.executable, /[\\/]java\.exe$/i, 'not Java');
  const args = Array.from(current.commandLine.matchAll(/"([^"]*)"|(\S+)/g), m => m[1] ?? m[2]);
  const jarIndex = args.indexOf('-jar');
  assert.ok(jarIndex >= 0 && normalize(args[jarIndex + 1]) === normalize(jarPath), 'jar path mismatch');
  assert.ok(args.includes('--server.port=' + port), 'port identity mismatch');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(jarPath)).digest('hex'), receipt.jarSha256, 'jar hash mismatch');
  if (receipt.processCreatedAt) assert.equal(Date.parse(current.createdAt), Date.parse(receipt.processCreatedAt), 'creation time mismatch');
  else {
    assert.ok(allowLegacy, 'receipt requires OS creation time');
    assert.ok(Math.abs(Date.parse(current.createdAt) - Date.parse(receipt.startedAt)) <= 10000, 'legacy creation time mismatch');
  }
  return { pid: current.pid, processCreatedAt: current.createdAt, executable: current.executable, jarPath, port };
}
function listening(port) {
  return new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.setTimeout(1000);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
    socket.once('timeout', () => { socket.destroy(); resolve(true); });
  });
}
async function stopOwned(receipt, jarPath, port, allowLegacy = false) {
  const identity = assertOwned(receipt, inspect(receipt.pid), jarPath, port, allowLegacy);
  // Recheck immediately before signalling; never report command lines.
  assertOwned({ ...receipt, processCreatedAt: identity.processCreatedAt }, inspect(receipt.pid), jarPath, port);
  process.kill(receipt.pid, 'SIGTERM');
  const until = Date.now() + 45000;
  while (Date.now() < until) {
    const current = inspect(receipt.pid);
    if (!current || current.createdAt !== identity.processCreatedAt) {
      assert.equal(await listening(port), false, 'port still occupied; no other process stopped');
      return { ...identity, exited: true, portFree: true };
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('owned process did not exit; no escalation performed');
}
module.exports = { inspect, assertOwned, listening, stopOwned };
