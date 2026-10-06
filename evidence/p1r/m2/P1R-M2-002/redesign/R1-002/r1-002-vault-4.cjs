// R1-002 prep-4 受控秘密库（DPAPI user-scope 加密存储，工作区外）。
// 位置：%LOCALAPPDATA%\Cloudstudy\R1-002\r1-002-vault-4.dat（用户级目录，继承 ACL；
//   仅当前 Windows 用户可解密，Git/证据/日志永不收录明文）。
// 用途：统一存放本卡 t3g 专用身份的 migrator/runner 口令、replay/fingerprint 秘密、
//   TLS keystore 口令。脚本经本模块注入子进程 env/内存，不出现在 argv/日志。
// 记录口径：只记录存在性、长度、独立性、存储方式与验证结果，不输出值。
'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const CARD = 'R1-002';
const CONTROLLED_DIR = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
  'Cloudstudy',
  CARD,
);
const VAULT_FILE = path.join(CONTROLLED_DIR, 'r1-002-vault-4.dat');
const PS = 'powershell -NoProfile -NonInteractive -Command';

function ensureDir() {
  fs.mkdirSync(CONTROLLED_DIR, { recursive: true });
  const script = "$root=[Console]::In.ReadToEnd().Trim(); $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User; $items=@(Get-Item -LiteralPath $root)+@(Get-ChildItem -LiteralPath $root -Recurse -Force); foreach($item in $items){ if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Reparse point rejected'}; $acl=if($item.PSIsContainer){New-Object Security.AccessControl.DirectorySecurity}else{New-Object Security.AccessControl.FileSecurity}; $acl.SetOwner($sid); $acl.SetAccessRuleProtection($true,$false); foreach($id in @($sid.Value,'S-1-5-18','S-1-5-32-544')){ $who=New-Object Security.Principal.SecurityIdentifier($id); $rule=if($item.PSIsContainer){New-Object Security.AccessControl.FileSystemAccessRule($who,'FullControl','ContainerInherit,ObjectInherit','None','Allow')}else{New-Object Security.AccessControl.FileSystemAccessRule($who,'FullControl','Allow')}; $acl.AddAccessRule($rule) }; if($item.PSIsContainer){[IO.Directory]::SetAccessControl($item.FullName,$acl);$read=[IO.Directory]::GetAccessControl($item.FullName)}else{[IO.File]::SetAccessControl($item.FullName,$acl);$read=[IO.File]::GetAccessControl($item.FullName)}; if(-not $read.AreAccessRulesProtected){throw 'DACL protection failed'}; foreach($r in $read.Access){$id=$r.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value; if($id -notin @($sid.Value,'S-1-5-18','S-1-5-32-544')){throw 'Unexpected DACL identity'}} }; 'DACL-VERIFIED'";
  const result = execFileSync('powershell', ['-NoProfile','-NonInteractive','-Command',script], { input: CONTROLLED_DIR, encoding:'utf8', windowsHide:true });
  if (!result.includes('DACL-VERIFIED')) throw new Error('controlled DACL not verified');
  return CONTROLLED_DIR;
}

// DPAPI user-scope 加解密经 PowerShell ProtectedData（当前用户上下文）。
// base64 明文只在父子 powershell 进程的 stdin/stdout 内存中流转一次，不落盘。
function dpapiProtect(plainText) {
  const script =
    "Add-Type -AssemblyName System.Security;" +
    "$raw = [Console]::In.ReadToEnd();" +
    "$bytes = [Text.Encoding]::UTF8.GetBytes($raw);" +
    "$enc = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser);" +
    "[Convert]::ToBase64String($enc)";
  return execFileSync(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { input: plainText, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
  ).trim();
}

function dpapiUnprotect(b64) {
  const script =
    "Add-Type -AssemblyName System.Security;" +
    "$raw = [Console]::In.ReadToEnd();" +
    "$enc = [Convert]::FromBase64String($raw.Trim());" +
    "$dec = [Security.Cryptography.ProtectedData]::Unprotect($enc, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser);" +
    "[Text.Encoding]::UTF8.GetString($dec)";
  return execFileSync(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { input: b64, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
  );
}

function randomSecrets() {
  return {
    // 口令满足 MySQL 复杂度习惯：前缀字母 + base64url 随机 + 数字/符号尾。
    migratorPassword: 'Mi' + crypto.randomBytes(18).toString('base64url') + '1!',
    runnerPassword: 'Ru' + crypto.randomBytes(18).toString('base64url') + '1!',
    replaySecret: crypto.randomBytes(24).toString('base64url') + crypto.randomBytes(8).toString('base64url'),
    fingerprintSecret: crypto.randomBytes(24).toString('base64url') + crypto.randomBytes(8).toString('base64url'),
    tlsStorePassword: 'T' + crypto.randomBytes(12).toString('base64url') + '1!',
    version: 4,
    rotatedAt: new Date().toISOString(),
  };
}

function validateShape(v) {
  if (!v || typeof v !== 'object') throw new Error('vault shape invalid');
  for (const k of ['migratorPassword', 'runnerPassword', 'replaySecret', 'fingerprintSecret', 'tlsStorePassword']) {
    if (typeof v[k] !== 'string' || v[k].length === 0) throw new Error('vault field missing: ' + k);
  }
  if (v.migratorPassword.length < 16 || v.runnerPassword.length < 16) throw new Error('db password too short');
  if (v.replaySecret.length < 32 || v.fingerprintSecret.length < 32) throw new Error('hmac secret too short');
  if (v.replaySecret === v.fingerprintSecret) throw new Error('hmac secrets not independent');
  if (v.migratorPassword === v.runnerPassword) throw new Error('db passwords not independent');
}

function load() {
  ensureDir();
  if (!fs.existsSync(VAULT_FILE)) return null;
  const b64 = fs.readFileSync(VAULT_FILE, 'utf8');
  const plain = dpapiUnprotect(b64);
  const v = JSON.parse(plain);
  validateShape(v);
  return v;
}

function loadOrCreate() {
  const existing = load();
  if (existing) return { vault: existing, created: false };
  ensureDir();
  const v = randomSecrets();
  validateShape(v);
  const b64 = dpapiProtect(JSON.stringify(v));
  fs.writeFileSync(VAULT_FILE, b64, { encoding: 'utf8', mode: 0o600 });
  return { vault: v, created: true };
}

// 仅供证据记录：存在性/长度/独立性/存储方式，不含任何秘密值。
function meta() {
  const v = load();
  if (!v) return { exists: false, store: 'dpapi-current-user', path: VAULT_FILE };
  return {
    exists: true,
    store: 'dpapi-current-user',
    path: VAULT_FILE,
    migratorLen: v.migratorPassword.length,
    runnerLen: v.runnerPassword.length,
    replayLen: v.replaySecret.length,
    fingerprintLen: v.fingerprintSecret.length,
    tlsStoreLen: v.tlsStorePassword.length,
    independent: v.replaySecret !== v.fingerprintSecret && v.migratorPassword !== v.runnerPassword,
    version: v.version || null,
  };
}

module.exports = { CARD, CONTROLLED_DIR, VAULT_FILE, load, loadOrCreate, meta, validateShape, PS };
