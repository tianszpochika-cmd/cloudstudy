#!/usr/bin/env node
// Disposable, private Docker full-stack UAT. Never points at yuxuexing-local.
// Secrets and the empty-instance backup live in a new OS temp directory.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const core = path.join(root, 'infra/docker/clyunedev/docker-compose.core.yml');
const full = path.join(root, 'infra/docker/clyunedev/docker-compose.full.yml');
const tag = '583ab627-uat-batch9-202609231740';
const ownerNames = [
  'IAM', 'LEARNER', 'CONTENT', 'LEARNING', 'ASSESSMENT', 'MEDIA',
  'NOTIFICATION', 'GAMIFICATION', 'SOCIAL', 'COMMERCE', 'ADMIN_OPS',
  'ANALYTICS', 'AUDIT', 'WORKFLOW'
];
const appNames = [
  'owner-migrator', 'iam-service', 'api-gateway', 'official-site',
  'learner-web', 'admin-web', 'mobile-h5', 'audit-service',
  'workflow-service', 'learner-service', 'content-service',
  'learning-service', 'assessment-service', 'media-service',
  'notification-service', 'gamification-service', 'social-service',
  'commerce-service', 'admin-ops-service', 'analytics-service'
];
const ownerServices = [
  'iam-service', 'audit-service', 'workflow-service', 'learner-service',
  'content-service', 'learning-service', 'assessment-service',
  'media-service', 'notification-service', 'gamification-service',
  'social-service', 'commerce-service', 'admin-ops-service',
  'analytics-service'
];
export const BATCH16_CANDIDATE_SERVICES = Object.freeze([
  'official-site', 'learner-web', 'admin-web', 'mobile-h5',
  'admin-ops-service', 'mysql-migrate'
]);
export const BATCH16_APPLY_SERVICES = Object.freeze([
  'official-site', 'learner-web', 'admin-web', 'mobile-h5', 'admin-ops-service'
]);
export const BATCH17_CANDIDATE_SERVICES = Object.freeze([
  'official-site', 'content-service', 'learner-web', 'mobile-h5'
]);
const batch17Project = 'cloudstudy-uat-isolated-3c94b27160';
export const BATCH17_PRIVATE_SERVICES = Object.freeze([
  'mysql', 'redis', 'minio', 'kafka', 'mysql-init', 'minio-init',
  ...appNames.map(serviceForImageRepository)
]);
const batch16BackupName = 'batch16-before-owner-migration.sql';
const batch16OwnerReadinessPorts = Object.freeze({
  'iam-service': 18087, 'audit-service': 18099, 'workflow-service': 18071,
  'learner-service': 18088, 'content-service': 18089, 'learning-service': 18090,
  'assessment-service': 18091, 'media-service': 18092, 'notification-service': 18093,
  'gamification-service': 18094, 'social-service': 18095, 'commerce-service': 18096,
  'admin-ops-service': 18097, 'analytics-service': 18098
});
const replacementImageCore = ['api-gateway', 'iam-service', 'learner-web', 'mobile-h5'];
const allowedReplacementServices = new Set([
  ...replacementImageCore, 'content-service', 'admin-web', 'gamification-service',
  'social-service', 'official-site', 'admin-ops-service', 'mysql-migrate'
]);
const volumeKeys = ['clyunedev-mysql', 'clyunedev-redis', 'clyunedev-minio', 'clyunedev-kafka'];
const command = process.argv[2];
const stateFile = process.argv[3];

export function imageRepositoryForService(service) {
  return service === 'mysql-migrate' ? 'owner-migrator' : service;
}

export function serviceForImageRepository(repository) {
  return repository === 'owner-migrator' ? 'mysql-migrate' : repository;
}

export function imageForService(service, state = {}) {
  return state.replacementImages?.[service]
    ?? (service === 'iam-service' && state.iamCandidateImage
      ? state.iamCandidateImage
      : `cloudstudy-clyunedev/${imageRepositoryForService(service)}:${tag}`);
}

export function imageForRepository(repository, state = {}) {
  return imageForService(serviceForImageRepository(repository), state);
}

export function validateReplacementImages(replacementImages) {
  if (replacementImages === undefined) return;
  assert(replacementImages && typeof replacementImages === 'object' && !Array.isArray(replacementImages),
    'replacementImages must be an object');
  assert(replacementImageCore.every((name) => Object.hasOwn(replacementImages, name)),
    'required replacement images are missing');
  assert(Object.keys(replacementImages).every((name) => allowedReplacementServices.has(name)),
    'replacement image service is not allowlisted');
  for (const [service, image] of Object.entries(replacementImages)) {
    const repository = imageRepositoryForService(service);
    assert.match(image, new RegExp(`^cloudstudy-clyunedev/${repository}:[A-Za-z0-9_.-]{1,128}$`, 'u'),
      `${service} image repository does not match its Compose service`);
  }
}

export function batchEvidenceSuffix(replacementImages = {}) {
  const officialTag = replacementImages['official-site']?.split(':').at(-1) ?? '';
  const match = officialTag.match(/(?:^|-)uat-(batch\d+)-/u);
  return match ? `-${match[1]}` : '';
}

export function evidenceDate(replacementImages = {}) {
  const officialTag = replacementImages['official-site']?.split(':').at(-1) ?? '';
  const match = officialTag.match(/(?:^|-)uat-batch\d+-(\d{4})(\d{2})(\d{2})\d{4}$/u);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '2026-09-23';
}

export function batchEvidenceFilePath(state, fileName, baseDir = root) {
  const extension = path.extname(fileName);
  const name = path.basename(fileName, extension);
  return path.join(baseDir, 'artifacts', `uat-${evidenceDate(state.replacementImages)}`,
    `${name}${batchEvidenceSuffix(state.replacementImages)}${extension}`);
}

export function browserEvidenceDirectory(state, baseDir = root) {
  return path.join(baseDir, 'artifacts', `uat-${evidenceDate(state.replacementImages)}`,
    `docker-isolated-browser${batchEvidenceSuffix(state.replacementImages)}`);
}

export function batch16CandidateImages(releaseTag) {
  assert.match(releaseTag, /^583ab627-uat-batch16-20[0-9]{10}$/u,
    'Batch16 release tag must include its build date and time');
  return Object.fromEntries(BATCH16_CANDIDATE_SERVICES.map((service) => [
    service,
    `cloudstudy-clyunedev/${imageRepositoryForService(service)}:${releaseTag}`
  ]));
}

export function batch17CandidateImages(releaseTag) {
  assert.match(releaseTag, /^583ab627-uat-batch17-20260925[0-9]{4}$/u,
    'Batch17 release tag must include the 2026-09-25 build date and time');
  return Object.fromEntries(BATCH17_CANDIDATE_SERVICES.map((service) => [
    service, `cloudstudy-clyunedev/${service}:${releaseTag}`
  ]));
}

export function batch17ComposeArgs(services = BATCH17_CANDIDATE_SERVICES) {
  assert.deepEqual(services, BATCH17_CANDIDATE_SERVICES,
    'Batch17 Compose scope must match the exact approved service set');
  return ['up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--force-recreate',
    ...BATCH17_CANDIDATE_SERVICES];
}

export function contentV22Checksum(migrationFile = path.join(root,
  'services/content-service/src/main/resources/db/migration/V22__content_aggregate_revision_and_version_ids.sql')) {
  const sql = fs.readFileSync(migrationFile, 'utf8');
  assert(sql.trim(), 'content-service V22 migration must not be empty');
  return crypto.createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex');
}

export function assertBatch17ContentV22Evidence({ flywayEnabled, rows, expectedChecksum = contentV22Checksum() }) {
  assert.equal(flywayEnabled, 'false',
    'content-service Flyway must stay disabled during no-schema Batch17 promotion');
  assert.match(expectedChecksum, /^[a-f0-9]{64}$/u, 'content-service V22 checksum is invalid');
  const applied = (rows || []).filter((row) => Number(row.version) === 22);
  assert.equal(applied.length, 1, 'private content schema must contain exactly one V22 history row');
  assert.equal(String(applied[0].checksum).trim(), expectedChecksum,
    'private content-service V22 checksum differs from the current repository migration');
  return { version: 22, checksum: expectedChecksum, flywayEnabled: 'false' };
}

export function ensurePrivateCursorSecretsInEnvContent(content, generateSecret = () =>
  crypto.randomBytes(32).toString('hex')) {
  const keys = ['SOCIAL_MODERATION_CURSOR_KEY', 'ADMIN_OPS_AUDIT_CURSOR_KEY'];
  const lines = content.split(/\r?\n/u);
  const additions = [];
  for (const key of keys) {
    const matches = lines.filter((line) => line.startsWith(`${key}=`));
    assert(matches.length <= 1, `${key} appears more than once in the private env file`);
    if (matches.length === 1) {
      const value = matches[0].slice(key.length + 1);
      assert(Buffer.byteLength(value, 'utf8') >= 32, `${key} exists but is shorter than 32 bytes`);
      continue;
    }
    const value = generateSecret();
    assert.match(value, /^[a-f0-9]{64}$/u, 'generated private cursor keys must be 32 random bytes in hex');
    additions.push(`${key}=${value}`);
  }
  if (additions.length === 0) return { content, addedKeys: [] };
  const separator = content.length === 0 || /(?:\r?\n)$/u.test(content) ? '' : '\n';
  return {
    content: `${content}${separator}${additions.join('\n')}\n`,
    addedKeys: keys.filter((key) => additions.some((line) => line.startsWith(`${key}=`)))
  };
}

export function createPrivateEnvironment(id, keyFile) {
  const secret = () => crypto.randomBytes(24).toString('hex');
  const auditSecret = secret();
  const variables = {
    RELEASE_TAG: tag,
    MYSQL_ROOT_PASSWORD: secret(),
    REDIS_PASSWORD: secret(),
    MINIO_ROOT_USER: `uatroot${id}`,
    MINIO_ROOT_PASSWORD: secret(),
    OBJECT_STORAGE_BUCKET: `uat-media-${id}`,
    KAFKA_CLUSTER_ID: crypto.randomBytes(16).toString('base64url'),
    IAM_JWT_PRIVATE_KEY_HOST_PATH: keyFile.replaceAll('\\', '/'),
    IAM_IDEMPOTENCY_REPLAY_SECRET: secret(),
    IAM_IDEMPOTENCY_FINGERPRINT_SECRET: secret(),
    GATEWAY_AUDIT_SERVICE_CLIENT_SECRET: auditSecret,
    IAM_SERVICE_CLIENT_GATEWAY_SECRET_DIGEST: crypto.createHash('sha256').update(auditSecret).digest('hex'),
    SOCIAL_MODERATION_CURSOR_KEY: crypto.randomBytes(32).toString('hex'),
    ADMIN_OPS_AUDIT_CURSOR_KEY: crypto.randomBytes(32).toString('hex'),
    CORS_ALLOWED_ORIGIN_LEARNER_WEB: 'https://learn.clyunedev.com',
    CORS_ALLOWED_ORIGIN_ADMIN_WEB: 'https://admin.clyunedev.com',
    CORS_ALLOWED_ORIGIN_OFFICIAL_SITE: 'https://clyunedev.com',
    CORS_ALLOWED_ORIGIN_MOBILE_H5: 'https://mobile.clyunedev.com',
    P1R_EXTERNAL_MIGRATION_WRITERS_DRAINED: 'false',
    P1R_EXTERNAL_MIGRATION_BACKUP_READY: 'false'
  };
  for (const name of ownerNames) variables[`${name}_DB_PASSWORD`] = secret();
  return variables;
}

export function assertPrivateComposeIsolation(state, config) {
  assert.equal(config.name, state.project);
  assert.equal(config.networks.clyunedev.name, state.project);
  assert.equal(config.networks.clyunedev.internal, true);
  assert(!config.networks.clyunedev.external);
  for (const [name, service] of Object.entries(config.services)) {
    assert.equal((service.ports || []).length, 0, `${name} publishes a host port`);
    assert.deepEqual(Object.keys(service.networks || {}), ['clyunedev']);
    for (const mount of service.volumes || []) {
      if (mount.type === 'volume') {
        assert(volumeKeys.includes(mount.source), `${name} uses unknown volume`);
        assert(config.volumes[mount.source].name.startsWith(`${state.project}-`), `${name} uses shared volume`);
      }
      if (mount.type === 'bind') {
        const source = path.resolve(mount.source);
        assert(source === path.resolve(state.keyFile) || source === path.resolve(root, 'infra/docker/clyunedev/bootstrap-owner-schemas.sh'));
        assert.equal(mount.read_only, true);
      }
    }
  }
  for (const [key, suffix] of volumeKeys.map((name) => [name, name.replace('clyunedev-', '')])) {
    assert.equal(config.volumes[key].name, `${state.project}-${suffix}`);
    assert(!config.volumes[key].external);
  }
}

export function assertPrivateAuditCursorSecret(config, privateEnv) {
  for (const [service, key] of [
    ['social-service', 'SOCIAL_MODERATION_CURSOR_KEY'],
    ['admin-ops-service', 'ADMIN_OPS_AUDIT_CURSOR_KEY']
  ]) {
    assert(Buffer.byteLength(privateEnv[key] || '', 'utf8') >= 32,
      `private ${key} must contain at least 32 bytes`);
    assert.equal(config.services[service].environment[key], privateEnv[key]);
  }
}

function writeState(state) {
  fs.writeFileSync(state.stateFile, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

export function assertPrivateStatePaths(state) {
  assert.match(state.project, /^cloudstudy-uat-isolated-[a-f0-9]{10}$/u,
    'private UAT project name is invalid');
  const tempDir = path.resolve(state.tempDir);
  const relative = path.relative(path.resolve(os.tmpdir()), tempDir);
  assert(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative),
    'private UAT directory must be below the operating-system temp directory');
  assert(path.basename(tempDir).startsWith(`${state.project}-`),
    'private UAT directory must match its project name');
  const expected = {
    stateFile: path.join(tempDir, 'state.json'),
    envFile: path.join(tempDir, 'uat.env'),
    keyFile: path.join(tempDir, 'iam-rsa-private.pem'),
    overrideFile: path.join(tempDir, 'docker-compose.isolated.yml')
  };
  for (const [field, target] of Object.entries(expected)) {
    assert.equal(path.resolve(state[field]), target, `${field} must stay inside the private UAT directory`);
  }
  const directoryInfo = fs.lstatSync(tempDir);
  assert(directoryInfo.isDirectory() && !directoryInfo.isSymbolicLink(),
    'private UAT directory must be a real directory');
  for (const [field, target] of Object.entries(expected)) {
    const fileInfo = fs.lstatSync(target);
    assert(fileInfo.isFile() && !fileInfo.isSymbolicLink(), `${field} must be a regular private file`);
  }
  const backupFile = path.join(tempDir, batch16BackupName);
  if (state.batch16Migration?.backup) {
    assert.equal(path.resolve(state.batch16Migration.backup.path), backupFile,
      'Batch16 backup must stay inside the private UAT directory');
    const backupInfo = fs.lstatSync(backupFile);
    assert(backupInfo.isFile() && !backupInfo.isSymbolicLink(), 'Batch16 backup must be a regular private file');
  }
  return { tempDir, ...expected, backupFile };
}

function readState() {
  assert(stateFile, 'usage: node uat-isolated-compose.mjs <validate|run|probe|cleanup> <state.json>');
  const inputStateFile = path.resolve(stateFile);
  const inputInfo = fs.lstatSync(inputStateFile);
  assert(inputInfo.isFile() && !inputInfo.isSymbolicLink(), 'state.json must be a regular private file');
  const state = JSON.parse(fs.readFileSync(inputStateFile, 'utf8'));
  assert.equal(path.resolve(state.stateFile), path.resolve(stateFile));
  assert.match(state.project, /^cloudstudy-uat-isolated-[a-f0-9]{10}$/u);
  assert.equal(state.tag, tag);
  if (state.iamCandidateImage) {
    assert.match(state.iamCandidateImage,
      /^cloudstudy-clyunedev\/iam-service:iam-atomic-[a-z0-9-]+$/u);
  }
  if (state.replacementImages) {
    validateReplacementImages(state.replacementImages);
  }
  assertPrivateStatePaths(state);
  return state;
}

export function safeEnv(sourceEnv = process.env) {
  const env = { ...sourceEnv };
  for (const key of Object.keys(env)) {
    if (/^(?:MYSQL_|REDIS_|MINIO_|IAM_|KAFKA_|OBJECT_STORAGE_|CORS_|GATEWAY_AUDIT_|P1R_EXTERNAL_|RELEASE_TAG$|SOCIAL_MODERATION_CURSOR_KEY$|ADMIN_OPS_AUDIT_CURSOR_KEY$|NUXT_GATEWAY_INTERNAL_BASE_URL$)/u.test(key)
      || ownerNames.some((name) => key === `${name}_DB_PASSWORD`)) {
      delete env[key];
    }
  }
  return env;
}

function safePowerShellEnv(sourceEnv = process.env) {
  const env = safeEnv(sourceEnv);
  const windowsRoot = env.SystemRoot || env.WINDIR;
  assert(windowsRoot, 'Windows system root is unavailable for private ACL verification');
  env.PSModulePath = path.win32.join(windowsRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'Modules');
  return env;
}

export function assertPrivateTempPermissions(state) {
  const paths = assertPrivateStatePaths(state);
  const targets = [paths.tempDir, paths.stateFile, paths.envFile, paths.keyFile, paths.overrideFile];
  if (state.batch16Migration?.backup) targets.push(paths.backupFile);
  if (process.platform !== 'win32') {
    for (const target of targets) {
      const stat = fs.lstatSync(target);
      const mode = stat.mode & 0o777;
      assert.equal(mode & 0o077, 0, `${path.basename(target)} grants access to group or other users`);
      if (typeof process.getuid === 'function') assert.equal(stat.uid, process.getuid(), `${path.basename(target)} has an unexpected owner`);
    }
    return;
  }
  for (const target of targets) {
    const encodedPath = Buffer.from(target, 'utf8').toString('base64');
    const script = [
      "$ErrorActionPreference='Stop'",
      `$target=[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodedPath}'))`,
      '$acl=Get-Acl -LiteralPath $target',
      '$currentSid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value',
      'try{$ownerSid=([System.Security.Principal.NTAccount]::new($acl.Owner)).Translate([System.Security.Principal.SecurityIdentifier]).Value}catch{$ownerSid=$acl.Owner}',
      "$allowed=@($currentSid,'S-1-5-18','S-1-5-32-544','S-1-3-0')",
      '$unsafe=@();foreach($ace in $acl.Access){if($ace.AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow){continue};try{$sid=$ace.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value}catch{$sid=$ace.IdentityReference.Value};if($allowed -notcontains $sid){$unsafe+=@($sid)}}',
      '[pscustomobject]@{ownerSid=$ownerSid;currentSid=$currentSid;unsafeSids=$unsafe}|ConvertTo-Json -Compress'
    ].join(';');
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      cwd: root, env: safePowerShellEnv(), encoding: 'utf8', timeout: 30000, windowsHide: true
    });
    assert(!result.error && result.status === 0, 'could not verify private UAT file permissions');
    const acl = JSON.parse(result.stdout.trim());
    assert.equal(acl.ownerSid, acl.currentSid, `${path.basename(target)} has an unexpected owner`);
    assert.deepEqual(acl.unsafeSids, [], `${path.basename(target)} grants access to an unapproved principal`);
  }
}

function runPrivateWindowsAclNormalization(targets, runPowerShell = spawnSync, expectedProject) {
  const encodedTargets = Buffer.from(JSON.stringify(targets), 'utf8').toString('base64');
  const encodedProject = Buffer.from(expectedProject || '', 'utf8').toString('base64');
  const script = [
    "$ErrorActionPreference='Stop'",
    "Import-Module Microsoft.PowerShell.Security -ErrorAction Stop",
    `$targetJson=[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodedTargets}'))`,
    '$targets=ConvertFrom-Json -InputObject $targetJson;if($targets -isnot [array]){$targets=@($targets)}',
    `$expectedProject=[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodedProject}'))`,
    '$currentSid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value',
    "$approved=@($currentSid,'S-1-5-18','S-1-5-32-544')",
    `$basePath=[System.IO.Path]::GetFullPath([string]$targets[0].path);$tempPath=[System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd([char]92);if($expectedProject -notmatch '^cloudstudy-uat-isolated-[a-f0-9]{10}$' -or !$basePath.StartsWith($tempPath+'\',[System.StringComparison]::OrdinalIgnoreCase) -or !([System.IO.Path]::GetFileName($basePath)).StartsWith($expectedProject+'-',[System.StringComparison]::OrdinalIgnoreCase)){throw "private UAT project or temp path verification failed"}`,
    `$expectedNames=@();if($targets.Count -eq 1){$expectedNames=@()}elseif($targets.Count -eq 5){$expectedNames=@('state.json','uat.env','iam-rsa-private.pem','docker-compose.isolated.yml')}elseif($targets.Count -eq 6){$expectedNames=@('state.json','uat.env','iam-rsa-private.pem','docker-compose.isolated.yml','batch16-before-owner-migration.sql')}else{throw "private UAT ACL target count is invalid"}`,
    'if([bool]$targets[0].directory -ne $true){throw "private UAT ACL directory target is invalid"};$baseItem=Get-Item -LiteralPath $basePath -Force;if(!$baseItem.PSIsContainer -or (($baseItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)){throw "private UAT directory is not a real directory"};$baseAcl=Get-Acl -LiteralPath $basePath;try{$baseOwner=([System.Security.Principal.NTAccount]::new($baseAcl.Owner)).Translate([System.Security.Principal.SecurityIdentifier]).Value}catch{$baseOwner=$baseAcl.Owner};if($baseOwner -ne $currentSid){throw "private UAT directory owner is not the current user"}',
    'for($index=1;$index -lt $targets.Count;$index++){$target=$targets[$index];$targetPath=[System.IO.Path]::GetFullPath([string]$target.path);$expectedPath=[System.IO.Path]::GetFullPath([System.IO.Path]::Combine($basePath,$expectedNames[$index-1]));if(!$targetPath.Equals($expectedPath,[System.StringComparison]::OrdinalIgnoreCase) -or [bool]$target.directory){throw "private UAT ACL target escaped its directory"};$item=Get-Item -LiteralPath $targetPath -Force;if($item.PSIsContainer -or (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)){throw "private UAT ACL file target is invalid"};$acl=Get-Acl -LiteralPath $targetPath;try{$owner=([System.Security.Principal.NTAccount]::new($acl.Owner)).Translate([System.Security.Principal.SecurityIdentifier]).Value}catch{$owner=$acl.Owner};if($owner -ne $currentSid){throw "private UAT file owner is not the current user"}}',
    'foreach($target in $targets){$targetPath=[string]$target.path;& icacls.exe $targetPath "/inheritance:r"|Out-Null;if($LASTEXITCODE -ne 0){throw "could not disable ACL inheritance"};$aclAfterInheritance=Get-Acl -LiteralPath $targetPath;$removeSids=@($aclAfterInheritance.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])|ForEach-Object{$_.IdentityReference.Value}|Sort-Object -Unique);if($removeSids.Count -gt 0){$sids=@($removeSids|ForEach-Object{"*$_"});$removeGrantArgs=@($targetPath,"/remove:g")+$sids;& icacls.exe @removeGrantArgs|Out-Null;if($LASTEXITCODE -ne 0){throw "could not remove existing private ACL grants"};$removeDenyArgs=@($targetPath,"/remove:d")+$sids;& icacls.exe @removeDenyArgs|Out-Null;if($LASTEXITCODE -ne 0){throw "could not remove existing private ACL denies"}};$grantSuffix="(F)";$expectedFlags=[System.Security.AccessControl.InheritanceFlags]::None;if([bool]$target.directory){$grantSuffix="(OI)(CI)(F)";$expectedFlags=[System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit};$grantArgs=@($targetPath,"/grant:r","*$currentSid`:$grantSuffix","*S-1-5-18`:$grantSuffix","*S-1-5-32-544`:$grantSuffix");& icacls.exe @grantArgs|Out-Null;if($LASTEXITCODE -ne 0){throw "could not set private ACL entries"}}',
    '$verified=@();foreach($target in $targets){$targetPath=[string]$target.path;$acl=Get-Acl -LiteralPath $targetPath;try{$ownerSid=([System.Security.Principal.NTAccount]::new($acl.Owner)).Translate([System.Security.Principal.SecurityIdentifier]).Value}catch{$ownerSid=$acl.Owner};$rules=@($acl.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]));$aces=@();$expectedFlags=[System.Security.AccessControl.InheritanceFlags]::None;if([bool]$target.directory){$expectedFlags=[System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit};foreach($ace in $rules){$sid=$ace.IdentityReference.Value;if($ace.AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow -or $approved -notcontains $sid -or [int]$ace.FileSystemRights -ne [int][System.Security.AccessControl.FileSystemRights]::FullControl -or [int]$ace.InheritanceFlags -ne [int]$expectedFlags -or $ace.IsInherited){throw "private target ACL verification failed"};$aces+=@($sid)};if($ownerSid -ne $currentSid -or $aces.Count -ne $approved.Count -or @($aces|Sort-Object -Unique).Count -ne $approved.Count){throw "private target ACL verification failed"};$verified+=@([pscustomobject]@{path=$targetPath;ownerSid=$ownerSid;aceSids=@($aces|Sort-Object)})}',
    '[pscustomobject]@{currentSid=$currentSid;targets=$verified}|ConvertTo-Json -Depth 5 -Compress'
  ].join(';');
  const result = runPowerShell('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    cwd: root, env: safePowerShellEnv(), encoding: 'utf8', timeout: 30000, windowsHide: true
  });
  assert(!result.error && result.status === 0, 'private UAT ACL normalization failed; env and migration were not changed');
  const report = JSON.parse(result.stdout.trim());
  assert(report.currentSid);
  const verifiedTargets = Array.isArray(report.targets) ? report.targets : [report.targets];
  assert.equal(verifiedTargets.length, targets.length);
  assert.deepEqual(verifiedTargets.map((target) => path.resolve(target.path)).sort(),
    targets.map((target) => path.resolve(target.path)).sort());
  for (const target of verifiedTargets) {
    assert.equal(target.ownerSid, report.currentSid);
    assert.deepEqual(target.aceSids, [report.currentSid, 'S-1-5-18', 'S-1-5-32-544'].sort());
  }
  return report;
}

function securePrivateDirectory(tempDir, project, { platform = process.platform, runPowerShell = spawnSync } = {}) {
  assert.match(project, /^cloudstudy-uat-isolated-[a-f0-9]{10}$/u);
  const resolved = path.resolve(tempDir);
  const relative = path.relative(path.resolve(os.tmpdir()), resolved);
  assert(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  assert(path.basename(resolved).startsWith(`${project}-`));
  const info = fs.lstatSync(resolved);
  assert(info.isDirectory() && !info.isSymbolicLink());
  if (platform === 'win32') runPrivateWindowsAclNormalization([{ path: resolved, directory: true }], runPowerShell, project);
}

export function securePrivateTempPermissions(state, { platform = process.platform, runPowerShell = spawnSync } = {}) {
  const paths = assertPrivateStatePaths(state);
  if (platform !== 'win32') return null;
  const targets = [
    { path: paths.tempDir, directory: true },
    { path: paths.stateFile, directory: false },
    { path: paths.envFile, directory: false },
    { path: paths.keyFile, directory: false },
    { path: paths.overrideFile, directory: false }
  ];
  if (state.batch16Migration?.backup) targets.push({ path: paths.backupFile, directory: false });
  return runPrivateWindowsAclNormalization(targets, runPowerShell, state.project);
}

function editPrivateEnv(state, update, {
  securePermissions = securePrivateTempPermissions,
  checkPermissions = assertPrivateTempPermissions
} = {}) {
  const paths = assertPrivateStatePaths(state);
  securePermissions(state);
  checkPermissions(state);
  const lockFile = path.join(paths.tempDir, 'uat.env.lock');
  const lockFd = fs.openSync(lockFile, 'wx', 0o600);
  try {
    const envFd = fs.openSync(paths.envFile, 'r+');
    try {
      const openedInfo = fs.fstatSync(envFd);
      const pathInfo = fs.lstatSync(paths.envFile);
      assert(pathInfo.isFile() && !pathInfo.isSymbolicLink());
      assert.equal(openedInfo.dev, pathInfo.dev);
      assert.equal(openedInfo.ino, pathInfo.ino);
      const current = fs.readFileSync(envFd, 'utf8');
      const result = update(current);
      if (result.content !== current) {
        assert.equal(openedInfo.size, Buffer.byteLength(current, 'utf8'), 'private env file changed during update');
        if (result.content.startsWith(current)) {
          const append = result.content.slice(current.length);
          fs.writeSync(envFd, append, openedInfo.size, 'utf8');
        } else {
          fs.ftruncateSync(envFd, 0);
          fs.writeSync(envFd, result.content, 0, 'utf8');
        }
        fs.fsyncSync(envFd);
        const verifyInfo = fs.lstatSync(paths.envFile);
        assert(verifyInfo.isFile() && !verifyInfo.isSymbolicLink());
        assert.equal(verifyInfo.dev, openedInfo.dev);
        assert.equal(verifyInfo.ino, openedInfo.ino);
        const after = fs.readFileSync(paths.envFile, 'utf8');
        assert.equal(after, result.content, 'private env update did not persist');
      }
      return result;
    } finally {
      fs.closeSync(envFd);
    }
  } finally {
    fs.closeSync(lockFd);
    fs.unlinkSync(lockFile);
  }
}

export function upgradePrivateCursorSecrets(state, {
  securePermissions = securePrivateTempPermissions,
  checkPermissions = assertPrivateTempPermissions,
  recordEvent = record
} = {}) {
  const upgrade = editPrivateEnv(state, (content) => ensurePrivateCursorSecretsInEnvContent(content), {
    securePermissions, checkPermissions
  });
  recordEvent(state, 'private-cursor-secrets-ready', { addedKeys: upgrade.addedKeys });
  return upgrade.addedKeys;
}

export function updateBatch16MigrationGateContent(content, values) {
  let updated = content;
  for (const key of ['P1R_EXTERNAL_MIGRATION_WRITERS_DRAINED', 'P1R_EXTERNAL_MIGRATION_BACKUP_READY']) {
    assert(values[key] === 'true' || values[key] === 'false', `${key} must be true or false`);
    const expression = new RegExp(`^${key}=(true|false)$`, 'gmu');
    const matches = updated.match(expression) || [];
    assert.equal(matches.length, 1, `${key} must appear exactly once in the private env file`);
    updated = updated.replace(expression, `${key}=${values[key]}`);
  }
  return updated;
}

function setBatch16MigrationGates(state, enabled) {
  const value = enabled ? 'true' : 'false';
  editPrivateEnv(state, (content) => ({
    content: updateBatch16MigrationGateContent(content, {
      P1R_EXTERNAL_MIGRATION_WRITERS_DRAINED: value,
      P1R_EXTERNAL_MIGRATION_BACKUP_READY: value
    })
  }));
}

function run(program, args, { timeout = 600000, output = false, stdoutFile } = {}) {
  const fd = stdoutFile ? fs.openSync(stdoutFile, 'w', 0o600) : null;
  try {
    const result = spawnSync(program, args, {
      cwd: root,
      env: safeEnv(),
      encoding: stdoutFile ? undefined : 'utf8',
      stdio: stdoutFile ? ['ignore', fd, 'pipe'] : 'pipe',
      timeout,
      maxBuffer: 32 * 1024 * 1024,
      windowsHide: true
    });
    if (result.error || result.status !== 0) {
      // Docker/Compose error text can contain resolved environment values.
      throw new Error(`${program} command failed (exit ${result.status ?? 'unknown'}); inspect private temp logs manually`);
    }
    return output ? (result.stdout || '').toString().trim() : '';
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
}

function docker(args, options) { return run('docker', args, options); }
function compose(state, args, options) {
  return docker([
    'compose', '-p', state.project, '--env-file', state.envFile,
    '-f', core, '-f', full, '-f', state.overrideFile, ...args
  ], options);
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function baseline() {
  const containers = docker(['ps', '-a', '--filter', 'name=^/yuxuexing-local-', '--format', '{{.ID}}|{{.Names}}'], { output: true });
  const network = docker(['network', 'inspect', 'yuxuexing-local_yuxuexing-local', '--format', '{{.Id}}'], { output: true });
  return { containers: containers.split(/\r?\n/u).filter(Boolean).sort(), network };
}

function record(state, phase, detail = {}) {
  state.phase = phase;
  state.events.push({ at: new Date().toISOString(), phase, ...detail });
  writeState(state);
  console.log(`${state.project}: ${phase}`);
}

function prepare() {
  const id = crypto.randomBytes(5).toString('hex');
  const project = `cloudstudy-uat-isolated-${id}`;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `${project}-`));
  securePrivateDirectory(tempDir, project);
  const envFile = path.join(tempDir, 'uat.env');
  const keyFile = path.join(tempDir, 'iam-rsa-private.pem');
  const overrideFile = path.join(tempDir, 'docker-compose.isolated.yml');
  const ownVolume = (suffix) => `${project}-${suffix}`;
  const privateKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
  fs.writeFileSync(keyFile, privateKey, { mode: 0o600 });
  const variables = createPrivateEnvironment(id, keyFile);
  fs.writeFileSync(envFile, Object.entries(variables).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 });
  const override = `name: ${project}\nservices:\n` +
    ['iam-service', 'api-gateway', 'official-site', 'learner-web', 'admin-web', 'mobile-h5']
      .map((name) => `  ${name}:\n    ports: !reset []\n`).join('') +
    `networks:\n  clyunedev:\n    name: ${project}\n    driver: bridge\n    internal: true\nvolumes:\n` +
    volumeKeys.map((name) => `  ${name}:\n    name: ${ownVolume(name.replace('clyunedev-', ''))}\n`).join('');
  fs.writeFileSync(overrideFile, override, { mode: 0o600 });
  const state = {
    project, tag, tempDir, stateFile: path.join(tempDir, 'state.json'),
    envFile, keyFile, overrideFile, phase: 'prepared', events: [],
    sharedBefore: baseline()
  };
  writeState(state);
  assertPrivateTempPermissions(state);
  console.log(`Prepared ${project}; state: ${state.stateFile}`);
  return state;
}

function validate(state, { fresh = false } = {}) {
  assert(fs.existsSync(state.envFile) && fs.existsSync(state.keyFile) && fs.existsSync(state.overrideFile));
  const config = JSON.parse(compose(state, ['config', '--format', 'json'], { output: true }));
  assert.equal(Object.keys(config.services).length, 26);
  assertPrivateComposeIsolation(state, config);
  for (const [name, service] of Object.entries(config.services)) {
    if (service.image?.startsWith('cloudstudy-clyunedev/')) {
      assert.equal(service.image, imageForService(name, state));
    }
  }
  const images = appNames.map((repository) => imageForRepository(repository, state));
  const inspected = JSON.parse(docker(['image', 'inspect', ...images], { output: true }));
  assert.equal(inspected.length, 20);
  const env = config.services['iam-service'].environment;
  const privateEnv = Object.fromEntries(fs.readFileSync(state.envFile, 'utf8').trim().split(/\r?\n/u)
    .map((line) => {
      const separator = line.indexOf('=');
      assert(separator > 0);
      return [line.slice(0, separator), line.slice(separator + 1)];
    }));
  assert.equal(env.IAM_JWT_PRIVATE_KEY_FILE, '/run/secrets/iam-rsa-private.pem');
  assert.equal(env.IAM_JWT_EPHEMERAL_KEYS_ALLOWED, 'false');
  assert.equal(config.services.mysql.environment.MYSQL_ROOT_PASSWORD, privateEnv.MYSQL_ROOT_PASSWORD);
  assert.equal(config.services['mysql-migrate'].environment.MYSQL_ROOT_PASSWORD, privateEnv.MYSQL_ROOT_PASSWORD);
  for (const name of ownerNames) {
    const key = `${name}_DB_PASSWORD`;
    assert.equal(config.services['mysql-init'].environment[key], privateEnv[key], `${key} differs from private env`);
    assert.equal(config.services['mysql-migrate'].environment[key], privateEnv[key], `${key} differs from private env`);
  }
  assert.equal(config.services.redis.environment.REDIS_PASSWORD, privateEnv.REDIS_PASSWORD);
  assert.equal(config.services.minio.environment.MINIO_ROOT_PASSWORD, privateEnv.MINIO_ROOT_PASSWORD);
  assert.equal(config.services.kafka.environment.CLUSTER_ID, privateEnv.KAFKA_CLUSTER_ID);
  assert(privateEnv.SOCIAL_MODERATION_CURSOR_KEY, 'private social moderation cursor key is missing');
  assert.equal(config.services['social-service'].environment.SOCIAL_MODERATION_CURSOR_KEY,
    privateEnv.SOCIAL_MODERATION_CURSOR_KEY);
  assertPrivateAuditCursorSecret(config, privateEnv);
  assert.equal(config.services['official-site'].environment.NUXT_GATEWAY_INTERNAL_BASE_URL,
    'http://api-gateway:18070/api/v1');
  if (fresh) {
    const projectContainers = docker(['ps', '-a', '--filter', `label=com.docker.compose.project=${state.project}`, '--format', '{{.ID}}'], { output: true });
    assert.equal(projectContainers, '', 'project already has containers');
    const networks = docker(['network', 'ls', '--format', '{{.Name}}'], { output: true }).split(/\r?\n/u);
    const volumes = docker(['volume', 'ls', '--format', '{{.Name}}'], { output: true }).split(/\r?\n/u);
    assert(!networks.includes(state.project), 'network already exists');
    for (const suffix of ['mysql', 'redis', 'minio', 'kafka']) assert(!volumes.includes(`${state.project}-${suffix}`), `volume ${suffix} already exists`);
  }
  assert.deepEqual(baseline(), state.sharedBefore, 'shared yuxuexing-local container or network changed');
  console.log(`${state.project}: validated 26 services, 20 images, 0 host ports, private network and volumes`);
  return config;
}

function waitService(state, name) {
  const id = compose(state, ['ps', '-a', '-q', name], { output: true }).split(/\r?\n/u).filter(Boolean).at(-1);
  assert(id, `${name} container missing`);
  const code = docker(['wait', id], { output: true, timeout: 1800000 });
  assert.equal(code, '0', `${name} exited ${code}`);
  record(state, `${name}-completed`, { containerId: id });
}

function runStack(state) {
  assert(['prepared', 'private-infrastructure-started'].includes(state.phase),
    'use a fresh prepared project; never blindly rerun a partial migration');
  if (state.phase === 'prepared') {
    validate(state, { fresh: true });
    for (const image of ['mysql:8.4', 'redis:7.4-alpine']) docker(['image', 'inspect', image]);
    compose(state, ['up', '-d', '--wait', 'mysql', 'redis', 'minio', 'kafka'], { timeout: 1200000 });
    record(state, 'private-infrastructure-started');
  }
  validate(state);
  const backup = path.join(state.tempDir, 'before-owner-migration.sql');
  compose(state, ['exec', '-T', 'mysql', 'sh', '-ec', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump --user=root --single-transaction --no-tablespaces --routines --events --all-databases'], { stdoutFile: backup, timeout: 600000 });
  assert(fs.statSync(backup).size > 1024, 'empty database backup');
  state.backup = { path: backup, bytes: fs.statSync(backup).size, sha256: sha256(backup) };
  const env = fs.readFileSync(state.envFile, 'utf8')
    .replace('P1R_EXTERNAL_MIGRATION_WRITERS_DRAINED=false', 'P1R_EXTERNAL_MIGRATION_WRITERS_DRAINED=true')
    .replace('P1R_EXTERNAL_MIGRATION_BACKUP_READY=false', 'P1R_EXTERNAL_MIGRATION_BACKUP_READY=true');
  fs.writeFileSync(state.envFile, env, { mode: 0o600 });
  record(state, 'empty-instance-backup-verified', { backupBytes: state.backup.bytes, backupSha256: state.backup.sha256 });
  validate(state);
  compose(state, ['run', '--rm', '--no-deps', 'mysql-migrate', '--preflight'], { timeout: 600000 });
  record(state, 'external-owner-preflight-passed');
  compose(state, ['up', '-d', 'mysql-init'], { timeout: 300000 });
  waitService(state, 'mysql-init');
  compose(state, ['up', '-d', '--no-deps', 'mysql-migrate'], { timeout: 300000 });
  waitService(state, 'mysql-migrate');
  compose(state, ['run', '--rm', '--no-deps', 'mysql-migrate', '--verify'], { timeout: 1200000 });
  record(state, 'owner-history-and-grants-verified');
  compose(state, ['up', '-d', '--no-deps', 'minio-init'], { timeout: 300000 });
  waitService(state, 'minio-init');
  compose(state, ['up', '-d', '--no-deps', ...ownerServices], { timeout: 900000 });
  record(state, 'owner-processes-started');
  compose(state, ['up', '-d', '--no-deps', 'api-gateway', 'official-site', 'learner-web', 'admin-web', 'mobile-h5'], { timeout: 600000 });
  record(state, 'full-stack-started');
  validate(state);
}

function probe(state) {
  validate(state);
  const targets = [
    ['official-site', 18182, '/'], ['learner-web', 8080, '/'],
    ['admin-web', 8080, '/'], ['mobile-h5', 8080, '/'],
    ['iam-service', 18087, '/actuator/health/readiness'],
    ['api-gateway', 18070, '/actuator/health/readiness'],
    ...[
      ['audit-service', 18099], ['workflow-service', 18071], ['learner-service', 18088],
      ['content-service', 18089], ['learning-service', 18090], ['assessment-service', 18091],
      ['media-service', 18092], ['notification-service', 18093], ['gamification-service', 18094],
      ['social-service', 18095], ['commerce-service', 18096], ['admin-ops-service', 18097],
      ['analytics-service', 18098]
    ].map(([name, port]) => [name, port, '/actuator/health/readiness'])
  ];
  const js = `const targets=${JSON.stringify(targets)};for(const [name,port,route] of targets){let status=0;let error='';try{const r=await fetch('http://'+name+':'+port+route,{signal:AbortSignal.timeout(5000)});status=r.status;}catch(e){error=e.name;}console.log(JSON.stringify({name,port,route,status,error}));}`;
  const output = docker(['run', '--rm', '--network', state.project, '--entrypoint', 'node', `cloudstudy-clyunedev/owner-migrator:${tag}`, '--input-type=module', '-e', js], { output: true, timeout: 180000 });
  const result = output.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(result.length, targets.length);
  const evidenceFile = batchEvidenceFilePath(state, 'docker-isolated-stack-probe.json');
  fs.writeFileSync(evidenceFile, `${JSON.stringify({ at: new Date().toISOString(), project: state.project,
    baseTag: tag, replacementImages: state.replacementImages ?? null, result }, null, 2)}\n`);
  record(state, 'private-network-probed', { ok: result.filter((entry) => entry.status === 200).length, total: result.length });
  console.log(`Probe evidence: ${evidenceFile}`);
  for (const item of result) console.log(`${item.name}: ${item.status || item.error}`);
}

function probeApi(state) {
  validate(state);
  const js = `
    import crypto from 'node:crypto';
    const base='http://api-gateway:18070';
    const run=crypto.randomBytes(6).toString('hex');
    const device={deviceType:'WEB',clientVersion:'isolated-docker-uat',deviceName:'isolated-docker-probe'};
    let account={identifier:'uat-docker-'+run+'@local.invalid',password:'Uat!'+crypto.randomBytes(20).toString('base64url')+'a9'};
    const checks=[];
    let token;
    async function call(root,method,url,body,auth){
      const headers={accept:'application/json','x-client-platform':'web'};
      if(body!==undefined){headers['content-type']='application/json';headers['idempotency-key']='uat-docker-'+run+'-'+checks.length;}
      if(auth)headers.authorization='Bearer '+auth;
      const response=await fetch(root+url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(10000)});
      const json=await response.json().catch(()=>null);
      return {status:response.status,data:json?.data??json,code:json?.error?.code??json?.code??null,
        shape:{contentType:response.headers.get('content-type'),keys:json&&typeof json==='object'?Object.keys(json):[],
          errorType:typeof json?.error,errorKeys:json?.error&&typeof json.error==='object'?Object.keys(json.error):[],
          errorMessage:typeof json?.error?.message==='string'?json.error.message.slice(0,160):null}};
    }
    function add(name,result,extra={}){checks.push({name,status:result.status,code:result.code,...(result.status>=400?{shape:result.shape}:{}),...extra});}
    const jwks=await call(base,'GET','/api/v1/auth/jwks');
    add('gateway-iam-jwks',jwks,{keys:Array.isArray(jwks.data?.keys)?jwks.data.keys.length:0});
    add('anonymous-social-read',await call(base,'GET','/api/v1/social/rooms?limit=20'));
    const registration=await call(base,'POST','/api/v1/auth/register',{...account,device});
    token=registration.data?.accessToken;
    add('adult-register',registration,{hasAccessToken:Boolean(token)});
    if(!token){
      account={identifier:'uat-docker-direct-'+run+'@local.invalid',password:'Uat!'+crypto.randomBytes(20).toString('base64url')+'a9'};
      const direct=await call('http://iam-service:18087','POST','/api/v1/auth/register',{...account,device});
      token=direct.data?.accessToken;
      add('direct-iam-register',direct,{hasAccessToken:Boolean(token)});
    }
    if(token){
      add('adult-gate',await call(base,'POST','/api/v1/iam/adult-gate',{confirmed:true,birthYear:1995,policyVersion:'b30-adult-v1'},token));
      for(const type of ['TERMS','PRIVACY','ADULT_LEARNING']) add('consent-'+type,await call(base,'PUT','/api/v1/iam/consents',{type,version:'b30-consent-v1',decision:'ACCEPTED'},token));
      const login=await call(base,'POST','/api/v1/auth/login',{...account,device});
      token=login.data?.accessToken;
      add('fresh-login',login,{hasAccessToken:Boolean(token)});
      if(token){
        const rooms=await call(base,'GET','/api/v1/social/rooms?limit=20',undefined,token);
        add('gateway-owner-social-rooms',rooms,{itemCount:Array.isArray(rooms.data?.items)?rooms.data.items.length:null});
        const direct=await call('http://social-service:18095','GET','/api/v1/social/rooms?limit=20',undefined,token);
        add('direct-owner-social-rooms',direct,{itemCount:Array.isArray(direct.data?.items)?direct.data.items.length:null});
        add('gateway-learner-profile',await call(base,'GET','/api/v1/learner/profile',undefined,token));
      }
    }
    console.log(JSON.stringify({at:new Date().toISOString(),checks}));
  `;
  const output = docker(['run', '--rm', '--network', state.project, '--entrypoint', 'node', `cloudstudy-clyunedev/owner-migrator:${tag}`, '--input-type=module', '-e', js], { output: true, timeout: 180000 });
  const result = JSON.parse(output);
  const evidenceFile = batchEvidenceFilePath(state, 'docker-isolated-api-probe.json');
  fs.writeFileSync(evidenceFile, `${JSON.stringify({ project: state.project, tag, ...result }, null, 2)}\n`);
  record(state, 'gateway-owner-probed', { checks: result.checks.length });
  console.log(`API evidence: ${evidenceFile}`);
  for (const item of result.checks) console.log(`${item.name}: ${item.status} ${item.code || ''}`);
}

function probeBrowser(state) {
  validate(state);
  const certFile = path.join(state.tempDir, 'uat-https-cert.pem');
  const tlsKeyFile = path.join(state.tempDir, 'uat-https-key.pem');
  const openssl = process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl';
  if (!fs.existsSync(certFile) || !fs.existsSync(tlsKeyFile)) {
    run(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes',
      '-keyout', tlsKeyFile, '-out', certFile, '-days', '1', '-subj', '/CN=clyunedev.com',
      '-addext', 'subjectAltName=DNS:clyunedev.com,DNS:*.clyunedev.com']);
  }
  const proxyConfig = path.join(state.tempDir, 'uat-https-proxy.conf');
  const routes = [
    ['clyunedev.com', 'official-site:18182'],
    ['learn.clyunedev.com', 'learner-web:8080'],
    ['admin.clyunedev.com', 'admin-web:8080'],
    ['mobile.clyunedev.com', 'mobile-h5:8080'],
    ['api.clyunedev.com', 'api-gateway:18070']
  ];
  const config = routes.map(([hostname, upstream]) => `server {
    listen 443 ssl;
    server_name ${hostname};
    ssl_certificate /etc/nginx/uat-cert.pem;
    ssl_certificate_key /etc/nginx/uat-key.pem;
    location / {
      proxy_pass http://${upstream};
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-Proto https;
      proxy_set_header X-Forwarded-Host $host;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
  }`).join('\n');
  fs.writeFileSync(proxyConfig, config, { mode: 0o600 });
  const proxyName = `${state.project}-https-proxy`;
  const existing = docker(['ps', '-a', '--filter', `name=^/${proxyName}$`, '--format', '{{.Names}}'], { output: true });
  if (!existing) {
    docker(['run', '-d', '--name', proxyName, '--label', `com.cloudstudy.uat.project=${state.project}`,
      '--network', state.project,
      ...routes.flatMap(([hostname]) => ['--network-alias', hostname]),
      '--read-only', '--tmpfs', '/var/cache/nginx', '--tmpfs', '/var/run', '--tmpfs', '/tmp',
      '--mount', `type=bind,source=${proxyConfig},target=/etc/nginx/conf.d/default.conf,readonly`,
      '--mount', `type=bind,source=${certFile},target=/etc/nginx/uat-cert.pem,readonly`,
      '--mount', `type=bind,source=${tlsKeyFile},target=/etc/nginx/uat-key.pem,readonly`,
      'nginx:1.27-alpine']);
  } else if (state.replacementImages) {
    const current = JSON.parse(docker(['inspect', proxyName], { output: true }))[0];
    assert.equal(current.Config.Labels['com.cloudstudy.uat.project'], state.project);
    assert.deepEqual(Object.keys(current.NetworkSettings.Networks), [state.project]);
    assert.deepEqual(current.HostConfig.PortBindings || {}, {});
    // Nginx resolves Compose upstream names at startup; four replaced containers have new IPs.
    docker(['restart', proxyName]);
  }
  const proxy = JSON.parse(docker(['inspect', proxyName], { output: true }))[0];
  assert.equal(proxy.Config.Labels['com.cloudstudy.uat.project'], state.project);
  assert.equal(proxy.State.Running, true);
  assert.deepEqual(Object.keys(proxy.NetworkSettings.Networks), [state.project]);
  assert.deepEqual(proxy.HostConfig.PortBindings || {}, {});
  record(state, 'private-https-proxy-started');

  const buildDir = path.join(state.tempDir, 'browser-build');
  fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(path.join(buildDir, 'Dockerfile'),
    'FROM mcr.microsoft.com/playwright:v1.63.0-noble\nRUN npm install --prefix /opt/uat playwright@1.63.0 --no-audit --no-fund\n');
  const browserImage = `cloudstudy-uat-isolated/browser:${state.project.slice(-10)}`;
  const cachedBrowser = docker(['image', 'ls', browserImage, '--format', '{{.Repository}}:{{.Tag}}'],
    { output: true });
  if (cachedBrowser !== browserImage) {
    docker(['build', '-t', browserImage, buildDir], { timeout: 1200000 });
  }
  const outputDir = browserEvidenceDirectory(state);
  fs.mkdirSync(outputDir, { recursive: true });
  const browserScript = path.join(root, 'scripts/runtime/uat-isolated-browser.cjs');
  const result = docker(['run', '--rm', '--network', state.project,
    '--label', `com.cloudstudy.uat.project=${state.project}`,
    '--mount', `type=bind,source=${browserScript},target=/probe.cjs,readonly`,
    '--mount', `type=bind,source=${outputDir},target=/out`,
    '-e', 'NODE_PATH=/opt/uat/node_modules', '--entrypoint', 'node', browserImage, '/probe.cjs'],
  { output: true, timeout: 600000 });
  const summary = JSON.parse(result.split(/\r?\n/u).filter(Boolean).at(-1));
  record(state, 'private-https-browser-probed', summary);
  console.log(`Browser evidence: ${path.join(outputDir, 'evidence.json')}`);
  console.log(JSON.stringify(summary));
}

function probeDatabase(state) {
  validate(state);
  const schemas = ownerNames.filter((name) => name !== 'IAM').map((name) => `${name.toLowerCase()}_service`);
  const lines = [
    "SELECT 'active_consent_documents', COUNT(*) FROM iam_service.iam_consent_document_version WHERE lifecycle_status='ACTIVE'",
    "SELECT 'iam_accounts', COUNT(*) FROM iam_service.iam_account",
    "SELECT 'uat_docker_accounts', COUNT(*) FROM iam_service.iam_account WHERE identifier LIKE 'uat-docker-%@local.invalid'",
    "SELECT 'active_iam_accounts', COUNT(*) FROM iam_service.iam_account WHERE status='ACTIVE'",
    "SELECT 'iam_sessions', COUNT(*) FROM iam_service.iam_session",
    "SELECT 'iam_flyway_success', COUNT(*) FROM iam_service.flyway_schema_history WHERE success=1",
    ...schemas.map((schema) => `SELECT '${schema}', COUNT(*) FROM ${schema}.p1r_schema_history`)
  ];
  const sql = `${lines.join(';\n')};`;
  const mysqlName = `${state.project}-mysql-1`;
  const inspected = JSON.parse(docker(['inspect', mysqlName], { output: true }))[0];
  assert.equal(inspected.Config.Labels['com.docker.compose.project'], state.project);
  assert.deepEqual(Object.keys(inspected.NetworkSettings.Networks), [state.project]);
  const output = docker(['exec', mysqlName, 'sh', '-ec',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --user=root --batch --skip-column-names -e "$1"', '--', sql],
  { output: true, timeout: 30000 });
  const counts = Object.fromEntries(output.split(/\r?\n/u).filter(Boolean).map((line) => {
    const [name, count] = line.split('\t');
    assert(name && /^\d+$/u.test(count));
    return [name, Number(count)];
  }));
  assert.equal(Object.keys(counts).length, 19);
  const evidenceFile = batchEvidenceFilePath(state, 'docker-isolated-db-probe.json');
  fs.writeFileSync(evidenceFile, `${JSON.stringify({ at: new Date().toISOString(), project: state.project, counts }, null, 2)}\n`);
  record(state, 'owner-database-verified', { consentActive: counts.active_consent_documents, externalHistories: schemas.length });
  console.log(`Database evidence: ${evidenceFile}`);
  console.log(`ACTIVE consent documents: ${counts.active_consent_documents}; owner migration ledgers: ${schemas.length}`);
}

function probeRegistrationBoundary(state) {
  validate(state);
  const mysqlName = `${state.project}-mysql-1`;
  const counts = () => {
    const sql = "SELECT (SELECT COUNT(*) FROM iam_service.iam_account WHERE identifier LIKE 'uat-docker-%@local.invalid'), (SELECT COUNT(*) FROM iam_service.iam_session)";
    const output = docker(['exec', mysqlName, 'sh', '-ec',
      'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --user=root --batch --skip-column-names -e "$1"', '--', sql], { output: true });
    const values = output.split('\t').map(Number);
    assert.equal(values.length, 2);
    return { syntheticAccounts: values[0], sessions: values[1] };
  };
  const before = counts();
  const js = `
    import crypto from 'node:crypto';
    const run=crypto.randomBytes(6).toString('hex');
    const body={identifier:'uat-docker-retry-'+run+'@local.invalid',
      password:'Uat!'+crypto.randomBytes(20).toString('base64url')+'a9',
      device:{deviceType:'WEB',clientVersion:'isolated-docker-uat',deviceName:'isolated-boundary-probe'}};
    async function call(path,label){
      const response=await fetch('http://iam-service:18087'+path,{method:'POST',
        headers:{'content-type':'application/json','idempotency-key':'uat-docker-'+run+'-'+label},
        body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
      const json=await response.json().catch(()=>null);
      return {status:response.status,errorCode:json?.error?.errorCode??null,
        errorMessage:json?.error?.message??null,hasAccessToken:Boolean(json?.data?.accessToken)};
    }
    const first=await call('/api/v1/auth/register','first');
    const retry=await call('/api/v1/auth/register','retry');
    const login=await call('/api/v1/auth/login','login');
    console.log(JSON.stringify({first,retry,login}));
  `;
  const output = docker(['run', '--rm', '--network', state.project, '--entrypoint', 'node',
    `cloudstudy-clyunedev/owner-migrator:${tag}`, '--input-type=module', '-e', js], { output: true, timeout: 60000 });
  const api = JSON.parse(output);
  const after = counts();
  const evidenceFile = batchEvidenceFilePath(state, 'docker-isolated-registration-boundary.json');
  fs.writeFileSync(evidenceFile, `${JSON.stringify({ at: new Date().toISOString(), project: state.project, before, api, after }, null, 2)}\n`);
  record(state, 'registration-failclosed-probed', { before, after, firstStatus: api.first.status, retryStatus: api.retry.status });
  console.log(`Registration evidence: ${evidenceFile}`);
  console.log(`first=${api.first.status}, retry=${api.retry.status}, login=${api.login.status}; accounts ${before.syntheticAccounts}->${after.syntheticAccounts}, sessions ${before.sessions}->${after.sessions}`);
}

function prepareLoginFixture(state) {
  validate(state);
  assert(!state.iamCandidateImage, 'create the known-account fixture before replacing isolated IAM');
  const fixtureFile = path.join(state.tempDir, 'login-fixture.json');
  assert(!fs.existsSync(fixtureFile), 'login fixture already exists');
  const js = `
    import crypto from 'node:crypto';
    import fs from 'node:fs';
    const id=crypto.randomBytes(8).toString('hex');
    const body={identifier:'uat-atomic-fixture-'+id+'@local.invalid',
      password:'Uat!'+crypto.randomBytes(24).toString('base64url')+'a9',
      device:{deviceType:'WEB',clientVersion:'isolated-docker-uat',deviceName:'atomic-fixture'}};
    const response=await fetch('http://iam-service:18087/api/v1/auth/register',{
      method:'POST',headers:{'content-type':'application/json','idempotency-key':'uat-atomic-fixture-'+id},
      body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
    const result=await response.json();
    if(response.status!==503 || result?.error?.message!=='iam.consent.version_unavailable')
      throw new Error('expected pre-fix consent outage');
    fs.writeFileSync('/test-secrets/login-fixture.json',JSON.stringify(body),{mode:0o600});
    console.log(JSON.stringify({status:response.status,code:result.error?.errorCode}));
  `;
  const output = docker(['run', '--rm', '--network', state.project,
    '--label', `com.cloudstudy.uat.project=${state.project}`,
    '--mount', `type=bind,source=${state.tempDir},target=/test-secrets`,
    '--entrypoint', 'node', `cloudstudy-clyunedev/owner-migrator:${tag}`,
    '--input-type=module', '-e', js], { output: true, timeout: 60000 });
  const result = JSON.parse(output);
  assert.equal(result.status, 503);
  assert(fs.existsSync(fixtureFile));
  record(state, 'pre-fix-login-fixture-created', { status: result.status, code: result.code });
}

function useIamCandidate(state, image) {
  assert(!state.iamCandidateImage, 'IAM candidate already selected');
  assert.match(image, /^cloudstudy-clyunedev\/iam-service:iam-atomic-[a-z0-9-]+$/u);
  validate(state);
  assert(fs.existsSync(path.join(state.tempDir, 'login-fixture.json')),
    'known-account login fixture missing');
  const inspected = JSON.parse(docker(['image', 'inspect', image], { output: true }));
  assert.equal(inspected.length, 1);
  const before = JSON.parse(docker(['inspect', `${state.project}-iam-service-1`], { output: true }))[0];
  assert.equal(before.Config.Labels['com.docker.compose.project'], state.project);
  const oldOverride = fs.readFileSync(state.overrideFile, 'utf8');
  assert(oldOverride.includes('  iam-service:\n    ports: !reset []\n'));
  fs.writeFileSync(state.overrideFile, oldOverride.replace(
    '  iam-service:\n    ports: !reset []\n',
    `  iam-service:\n    image: ${image}\n    ports: !reset []\n`), { mode: 0o600 });
  state.iamCandidateImage = image;
  writeState(state);
  validate(state);
  compose(state, ['up', '-d', '--no-deps', '--force-recreate', 'iam-service'], { timeout: 600000 });
  const after = JSON.parse(docker(['inspect', `${state.project}-iam-service-1`], { output: true }))[0];
  assert.equal(after.Config.Labels['com.docker.compose.project'], state.project);
  assert.equal(after.Image, inspected[0].Id);
  assert.notEqual(after.Id, before.Id);
  assert.deepEqual(baseline(), state.sharedBefore);
  record(state, 'isolated-iam-candidate-started', {
    image, imageId: after.Image, oldContainerId: before.Id, newContainerId: after.Id
  });
}

function useReleaseCandidates(state, releaseTag) {
  assert.match(releaseTag, /^[A-Za-z0-9_.-]{1,128}$/u);
  assert(!state.replacementImages, 'release candidates already selected');
  validate(state);
  const services = ['api-gateway', 'iam-service', 'learner-web', 'mobile-h5'];
  const images = Object.fromEntries(services.map((service) =>
    [service, `cloudstudy-clyunedev/${service}:${releaseTag}`]));
  const imageInfo = JSON.parse(docker(['image', 'inspect', ...Object.values(images)], { output: true }));
  assert.equal(imageInfo.length, services.length);
  const before = Object.fromEntries(services.map((service) => {
    const container = JSON.parse(docker(['inspect', `${state.project}-${service}-1`], { output: true }))[0];
    assert.equal(container.Config.Labels['com.docker.compose.project'], state.project);
    return [service, container.Id];
  }));
  let override = fs.readFileSync(state.overrideFile, 'utf8');
  for (const service of services) {
    const pattern = new RegExp(`(  ${service}:\\n)(?:    image: [^\\n]+\\n)?(    ports: !reset \\[\\]\\n)`, 'u');
    assert(pattern.test(override), `override missing ${service}`);
    override = override.replace(pattern, `$1    image: ${images[service]}\n$2`);
  }
  fs.writeFileSync(state.overrideFile, override, { mode: 0o600 });
  state.replacementImages = images;
  writeState(state);
  validate(state);
  compose(state, ['up', '-d', '--no-deps', '--force-recreate', ...services], { timeout: 600000 });
  for (const [index, service] of services.entries()) {
    const container = JSON.parse(docker(['inspect', `${state.project}-${service}-1`], { output: true }))[0];
    assert.equal(container.Config.Labels['com.docker.compose.project'], state.project);
    assert.deepEqual(Object.keys(container.NetworkSettings.Networks), [state.project]);
    assert.deepEqual(container.HostConfig.PortBindings || {}, {});
    assert.equal(container.Image, imageInfo[index].Id);
    assert.notEqual(container.Id, before[service]);
  }
  assert.deepEqual(baseline(), state.sharedBefore);
  record(state, 'isolated-four-service-release-started', {
    releaseTag, imageIds: Object.fromEntries(services.map((service, index) =>
      [service, imageInfo[index].Id]))
  });
}

function useMobileCandidate(state, image) {
  assert(state.replacementImages, 'four-service release must be installed first');
  assert.match(image, /^cloudstudy-clyunedev\/mobile-h5:[A-Za-z0-9_.-]{1,128}$/u);
  validate(state);
  const imageInfo = JSON.parse(docker(['image', 'inspect', image], { output: true }))[0];
  const name = `${state.project}-mobile-h5-1`;
  const before = JSON.parse(docker(['inspect', name], { output: true }))[0];
  assert.equal(before.Config.Labels['com.docker.compose.project'], state.project);
  assert.deepEqual(Object.keys(before.NetworkSettings.Networks), [state.project]);
  assert.deepEqual(before.HostConfig.PortBindings || {}, {});
  const override = fs.readFileSync(state.overrideFile, 'utf8');
  const pattern = /(  mobile-h5:\n)    image: [^\n]+\n(    ports: !reset \[\]\n)/u;
  assert(pattern.test(override));
  fs.writeFileSync(state.overrideFile,
    override.replace(pattern, `$1    image: ${image}\n$2`), { mode: 0o600 });
  state.replacementImages['mobile-h5'] = image;
  writeState(state);
  validate(state);
  compose(state, ['up', '-d', '--no-deps', '--force-recreate', 'mobile-h5'], { timeout: 600000 });
  const after = JSON.parse(docker(['inspect', name], { output: true }))[0];
  assert.equal(after.Config.Labels['com.docker.compose.project'], state.project);
  assert.deepEqual(Object.keys(after.NetworkSettings.Networks), [state.project]);
  assert.deepEqual(after.HostConfig.PortBindings || {}, {});
  assert.equal(after.Image, imageInfo.Id);
  assert.notEqual(after.Id, before.Id);
  assert.deepEqual(baseline(), state.sharedBefore);
  record(state, 'isolated-mobile-candidate-started', {
    image, imageId: after.Image, oldContainerId: before.Id, newContainerId: after.Id
  });
}

function useLearnerMobileCandidates(state, releaseTag) {
  assert(state.replacementImages, 'four-service release must be installed first');
  assert.match(releaseTag, /^[A-Za-z0-9_.-]{1,128}$/u);
  validate(state);
  const services = ['learner-web', 'mobile-h5'];
  const images = Object.fromEntries(services.map((service) =>
    [service, `cloudstudy-clyunedev/${service}:${releaseTag}`]));
  const imageInfo = JSON.parse(docker(['image', 'inspect', ...Object.values(images)], { output: true }));
  assert.equal(imageInfo.length, services.length);
  const before = Object.fromEntries(['api-gateway', 'iam-service', ...services].map((service) => {
    const item = JSON.parse(docker(['inspect', `${state.project}-${service}-1`], { output: true }))[0];
    assert.equal(item.Config.Labels['com.docker.compose.project'], state.project);
    assert.deepEqual(Object.keys(item.NetworkSettings.Networks), [state.project]);
    assert.deepEqual(item.HostConfig.PortBindings || {}, {});
    return [service, item.Id];
  }));
  let override = fs.readFileSync(state.overrideFile, 'utf8');
  for (const service of services) {
    const pattern = new RegExp(`(  ${service}:\\n)    image: [^\\n]+\\n(    ports: !reset \\[\\]\\n)`, 'u');
    assert(pattern.test(override), `override missing ${service}`);
    override = override.replace(pattern, `$1    image: ${images[service]}\n$2`);
    state.replacementImages[service] = images[service];
  }
  fs.writeFileSync(state.overrideFile, override, { mode: 0o600 });
  writeState(state);
  validate(state);
  compose(state, ['up', '-d', '--no-deps', '--force-recreate', ...services], { timeout: 600000 });
  for (const [index, service] of services.entries()) {
    const item = JSON.parse(docker(['inspect', `${state.project}-${service}-1`], { output: true }))[0];
    assert.equal(item.Config.Labels['com.docker.compose.project'], state.project);
    assert.deepEqual(Object.keys(item.NetworkSettings.Networks), [state.project]);
    assert.deepEqual(item.HostConfig.PortBindings || {}, {});
    assert.equal(item.Image, imageInfo[index].Id);
    assert.notEqual(item.Id, before[service]);
  }
  for (const service of ['api-gateway', 'iam-service']) {
    const item = JSON.parse(docker(['inspect', `${state.project}-${service}-1`], { output: true }))[0];
    assert.equal(item.Id, before[service]);
  }
  assert.deepEqual(baseline(), state.sharedBefore);
  record(state, 'isolated-learner-mobile-release-started', {
    releaseTag, imageIds: Object.fromEntries(services.map((service, index) =>
      [service, imageInfo[index].Id]))
  });
}

function useContentAdminMobileCandidates(state, releaseTag) {
  assert(state.replacementImages, 'four-service release must be installed first');
  assert.match(releaseTag, /^[A-Za-z0-9_.-]{1,128}$/u);
  validate(state);
  const services = ['content-service', 'admin-web', 'mobile-h5'];
  const images = Object.fromEntries(services.map((service) =>
    [service, `cloudstudy-clyunedev/${service}:${releaseTag}`]));
  const imageInfo = JSON.parse(docker(['image', 'inspect', ...Object.values(images)], { output: true }));
  assert.equal(imageInfo.length, services.length);
  const containerIds = () => {
    const ids = docker(['ps', '-a', '--filter', `label=com.docker.compose.project=${state.project}`,
      '--format', '{{.ID}}'], { output: true }).split(/\r?\n/u).filter(Boolean);
    assert.equal(ids.length, 26);
    const inspected = JSON.parse(docker(['inspect', ...ids], { output: true }));
    return Object.fromEntries(inspected.map((item) => {
      assert.equal(item.Config.Labels['com.docker.compose.project'], state.project);
      const service = item.Config.Labels['com.docker.compose.service'];
      assert(service);
      return [service, item.Id];
    }));
  };
  const before = containerIds();
  assert.equal(Object.keys(before).length, 26);
  let override = fs.readFileSync(state.overrideFile, 'utf8');
  for (const service of services) {
    const pattern = new RegExp(`(  ${service}:\\n)(?:    image: [^\\n]+\\n)?(    ports: !reset \\[\\]\\n)`, 'u');
    if (pattern.test(override)) {
      override = override.replace(pattern, `$1    image: ${images[service]}\n$2`);
    } else {
      assert(!new RegExp(`^  ${service}:`, 'mu').test(override), `unexpected override shape for ${service}`);
      assert(override.includes('services:\n'));
      override = override.replace('services:\n',
        `services:\n  ${service}:\n    image: ${images[service]}\n    ports: !reset []\n`);
    }
    state.replacementImages[service] = images[service];
  }
  fs.writeFileSync(state.overrideFile, override, { mode: 0o600 });
  writeState(state);
  validate(state);
  compose(state, ['up', '-d', '--no-deps', '--force-recreate', ...services], { timeout: 600000 });
  const after = containerIds();
  for (const [index, service] of services.entries()) {
    const item = JSON.parse(docker(['inspect', `${state.project}-${service}-1`], { output: true }))[0];
    assert.deepEqual(Object.keys(item.NetworkSettings.Networks), [state.project]);
    assert.deepEqual(item.HostConfig.PortBindings || {}, {});
    assert.equal(item.Image, imageInfo[index].Id);
    assert.notEqual(after[service], before[service]);
  }
  for (const service of Object.keys(before).filter((name) => !services.includes(name))) {
    assert.equal(after[service], before[service], `${service} changed outside scoped replacement`);
  }
  assert.deepEqual(baseline(), state.sharedBefore);
  record(state, 'isolated-content-admin-mobile-release-started', {
    releaseTag, imageIds: Object.fromEntries(services.map((service, index) =>
      [service, imageInfo[index].Id]))
  });
}

function useBatch14Candidates(state, releaseTag) {
  assert(state.replacementImages, 'prior release candidates must be installed first');
  assert.match(releaseTag, /^[A-Za-z0-9_.-]{1,128}$/u);
  validate(state);
  const services = ['gamification-service', 'learner-web', 'admin-web', 'mobile-h5'];
  const images = Object.fromEntries(services.map((service) =>
    [service, `cloudstudy-clyunedev/${service}:${releaseTag}`]));
  const imageInfo = JSON.parse(docker(['image', 'inspect', ...Object.values(images)], { output: true }));
  assert.equal(imageInfo.length, services.length);
  const containerIds = () => {
    const ids = docker(['ps', '-a', '--filter', `label=com.docker.compose.project=${state.project}`,
      '--format', '{{.ID}}'], { output: true }).split(/\r?\n/u).filter(Boolean);
    assert.equal(ids.length, 26);
    const inspected = JSON.parse(docker(['inspect', ...ids], { output: true }));
    return Object.fromEntries(inspected.map((item) => {
      assert.equal(item.Config.Labels['com.docker.compose.project'], state.project);
      const service = item.Config.Labels['com.docker.compose.service'];
      assert(service);
      return [service, item.Id];
    }));
  };
  const before = containerIds();
  assert.equal(Object.keys(before).length, 26);
  let override = fs.readFileSync(state.overrideFile, 'utf8');
  for (const service of services) {
    const pattern = new RegExp(`(  ${service}:\\n)(?:    image: [^\\n]+\\n)?(    ports: !reset \\[\\]\\n)`, 'u');
    if (pattern.test(override)) {
      override = override.replace(pattern, `$1    image: ${images[service]}\n$2`);
    } else {
      assert(!new RegExp(`^  ${service}:`, 'mu').test(override), `unexpected override shape for ${service}`);
      assert(override.includes('services:\n'));
      override = override.replace('services:\n',
        `services:\n  ${service}:\n    image: ${images[service]}\n    ports: !reset []\n`);
    }
    state.replacementImages[service] = images[service];
  }
  fs.writeFileSync(state.overrideFile, override, { mode: 0o600 });
  writeState(state);
  validate(state);
  compose(state, ['up', '-d', '--no-deps', '--force-recreate', ...services], { timeout: 600000 });
  const after = containerIds();
  for (const [index, service] of services.entries()) {
    const item = JSON.parse(docker(['inspect', `${state.project}-${service}-1`], { output: true }))[0];
    assert.deepEqual(Object.keys(item.NetworkSettings.Networks), [state.project]);
    assert.deepEqual(item.HostConfig.PortBindings || {}, {});
    assert.equal(item.Image, imageInfo[index].Id);
    assert.notEqual(after[service], before[service]);
  }
  for (const service of Object.keys(before).filter((name) => !services.includes(name))) {
    assert.equal(after[service], before[service], `${service} changed outside scoped replacement`);
  }
  assert.deepEqual(baseline(), state.sharedBefore);
  record(state, 'isolated-batch14-release-started', {
    releaseTag, imageIds: Object.fromEntries(services.map((service, index) =>
      [service, imageInfo[index].Id]))
  });
}

function useBatch15Candidates(state, releaseTag) {
  assert.equal(state.project, 'cloudstudy-uat-isolated-3c94b27160');
  assert(state.replacementImages, 'prior release candidates must be installed first');
  assert.match(releaseTag, /^583ab627-uat-batch15-20260923[0-9]{4}$/u);
  validate(state);
  const services = ['api-gateway', 'social-service', 'admin-web', 'official-site'];
  const images = Object.fromEntries(services.map((service) =>
    [service, `cloudstudy-clyunedev/${service}:${releaseTag}`]));
  const imageInfo = JSON.parse(docker(['image', 'inspect', ...Object.values(images)], { output: true }));
  assert.equal(imageInfo.length, services.length);
  const containerIds = () => {
    const ids = docker(['ps', '-a', '--filter', `label=com.docker.compose.project=${state.project}`,
      '--format', '{{.ID}}'], { output: true }).split(/\r?\n/u).filter(Boolean);
    assert.equal(ids.length, 26);
    const inspected = JSON.parse(docker(['inspect', ...ids], { output: true }));
    return Object.fromEntries(inspected.map((item) => {
      assert.equal(item.Config.Labels['com.docker.compose.project'], state.project);
      assert.deepEqual(Object.keys(item.NetworkSettings.Networks), [state.project]);
      assert.deepEqual(item.HostConfig.PortBindings || {}, {});
      const service = item.Config.Labels['com.docker.compose.service'];
      assert(service);
      return [service, { containerId: item.Id, imageId: item.Image }];
    }));
  };
  const before = containerIds();
  assert.equal(Object.keys(before).length, 26);
  for (const [index, service] of services.entries()) {
    assert.notEqual(imageInfo[index].Id, before[service].imageId,
      `${service} does not contain a newly built image`);
  }
  let override = fs.readFileSync(state.overrideFile, 'utf8');
  for (const service of services) {
    const pattern = new RegExp(`(  ${service}:\\n)(?:    image: [^\\n]+\\n)?(    ports: !reset \\[\\]\\n)`, 'u');
    if (pattern.test(override)) {
      override = override.replace(pattern, `$1    image: ${images[service]}\n$2`);
    } else {
      assert(!new RegExp(`^  ${service}:`, 'mu').test(override), `unexpected override shape for ${service}`);
      assert(override.includes('services:\n'));
      override = override.replace('services:\n',
        `services:\n  ${service}:\n    image: ${images[service]}\n    ports: !reset []\n`);
    }
    state.replacementImages[service] = images[service];
  }
  fs.writeFileSync(state.overrideFile, override, { mode: 0o600 });
  writeState(state);
  validate(state);
  compose(state, ['up', '-d', '--no-deps', '--no-build', '--force-recreate', ...services],
    { timeout: 600000 });
  const after = containerIds();
  for (const [index, service] of services.entries()) {
    assert.equal(after[service].imageId, imageInfo[index].Id);
    assert.notEqual(after[service].containerId, before[service].containerId);
  }
  for (const service of Object.keys(before).filter((name) => !services.includes(name))) {
    assert.deepEqual(after[service], before[service], `${service} changed outside scoped replacement`);
  }
  assert.deepEqual(baseline(), state.sharedBefore);
  record(state, 'isolated-batch15-release-started', {
    releaseTag, imageIds: Object.fromEntries(services.map((service, index) =>
      [service, imageInfo[index].Id]))
  });
}

function addImageOverrides(overrideText, images) {
  let override = overrideText;
  for (const [service, image] of Object.entries(images)) {
    const pattern = new RegExp(`(  ${service}:\\n)(?:    image: [^\\n]+\\n)?(    ports: !reset \\[\\]\\n)`, 'u');
    if (pattern.test(override)) {
      override = override.replace(pattern, `$1    image: ${image}\n$2`);
    } else {
      assert(!new RegExp(`^  ${service}:`, 'mu').test(override), `unexpected override shape for ${service}`);
      assert(override.includes('services:\n'));
      override = override.replace('services:\n',
        `services:\n  ${service}:\n    image: ${image}\n    ports: !reset []\n`);
    }
  }
  return override;
}

export function prepareBatch16Candidates(state, releaseTag, {
  readOverride = (file) => fs.readFileSync(file, 'utf8'),
  writeOverride = (file, contents) => fs.writeFileSync(file, contents, { mode: 0o600 }),
  persistState = writeState,
  recordEvent = record
} = {}) {
  assert(state.replacementImages, 'prior release candidates must be installed first');
  assert(!state.batch16Migration, 'Batch16 candidates cannot change after the migration sequence starts');
  const images = batch16CandidateImages(releaseTag);
  const replacementImages = { ...state.replacementImages, ...images };
  validateReplacementImages(replacementImages);
  assert.deepEqual(Object.keys(images), BATCH16_CANDIDATE_SERVICES);
  const override = addImageOverrides(readOverride(state.overrideFile), images);
  state.replacementImages = replacementImages;
  state.batch16CandidateServices = [...BATCH16_CANDIDATE_SERVICES];
  state.batch16CandidateImages = images;
  writeOverride(state.overrideFile, override);
  persistState(state);
  recordEvent(state, 'batch16-candidates-prepared', {
    releaseTag, services: [...BATCH16_CANDIDATE_SERVICES]
  });
  return { images, override };
}

export function useBatch16Candidates(state, releaseTag, {
  upgradeSecrets = upgradePrivateCursorSecrets,
  prepareCandidates = prepareBatch16Candidates
} = {}) {
  upgradeSecrets(state);
  const prepared = prepareCandidates(state, releaseTag);
  assert.deepEqual(state.batch16CandidateServices, BATCH16_CANDIDATE_SERVICES);
  assert.deepEqual(Object.keys(state.batch16CandidateImages), BATCH16_CANDIDATE_SERVICES);
  return prepared;
}

function batch17MigrationFingerprint(migration) {
  return crypto.createHash('sha256').update(JSON.stringify(migration)).digest('hex');
}

export function assertBatch17PrivateSnapshot(snapshot, project = batch17Project) {
  assert.equal(project, batch17Project, 'Batch17 can only use the approved isolated UAT project');
  assert(snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot),
    'Batch17 private container snapshot is missing');
  assert.deepEqual(Object.keys(snapshot).sort(), [...BATCH17_PRIVATE_SERVICES].sort(),
    'Batch17 must see exactly the 26 approved private Compose services');
  for (const [service, item] of Object.entries(snapshot)) {
    assert(item && typeof item === 'object', `${service} snapshot is invalid`);
    assert(item.containerId && item.imageId && item.status, `${service} identity is incomplete`);
    assert.equal(item.project, project, `${service} is outside the private UAT project`);
    assert.deepEqual(item.networks, [project], `${service} is attached to an unexpected network`);
    assert.deepEqual(item.portBindings, {}, `${service} publishes a host port`);
  }
  return snapshot;
}

export function prepareBatch17CandidateMetadata(state, releaseTag, {
  images = batch17CandidateImages(releaseTag), imageIds, beforeSnapshot, contentV22Evidence,
  readOverride = (file) => fs.readFileSync(file, 'utf8'),
  writeOverride = (file, contents) => fs.writeFileSync(file, contents, { mode: 0o600 }),
  persistState = writeState
} = {}) {
  assert.equal(state.project, batch17Project,
    'Batch17 can only promote candidates in cloudstudy-uat-isolated-3c94b27160');
  assert(state.replacementImages, 'prior isolated release candidates must be installed first');
  assertBatch16StageFlags(state.batch16Migration, 'services');
  assert.deepEqual(Object.keys(images), BATCH17_CANDIDATE_SERVICES,
    'Batch17 image mapping must contain exactly the approved service set');
  assert.deepEqual(Object.keys(imageIds || {}), BATCH17_CANDIDATE_SERVICES,
    'Batch17 image IDs must contain exactly the approved service set');
  assert.deepEqual(contentV22Evidence, {
    version: 22, checksum: contentV22Checksum(), flywayEnabled: 'false'
  }, 'a matching private content-service V22 receipt is required');
  for (const service of BATCH17_CANDIDATE_SERVICES) {
    assert.equal(images[service], `cloudstudy-clyunedev/${service}:${releaseTag}`,
      `${service} image mapping does not match the requested release tag`);
    assert.match(imageIds[service], /^sha256:[a-f0-9]{64}$/u,
      `${service} candidate image ID is invalid`);
  }
  assertBatch17PrivateSnapshot(beforeSnapshot);
  for (const service of BATCH17_CANDIDATE_SERVICES) {
    assert.equal(beforeSnapshot[service].status, 'running',
      `${service} must be healthy as a running container before Batch17 promotion`);
    assert.notEqual(imageIds[service], beforeSnapshot[service].imageId,
      `${service} candidate image is not newly built`);
  }
  for (const key of ['batch17ReleaseTag', 'batch17CandidateServices', 'batch17CandidateImages',
    'batch17CandidateImageIds', 'batch17Before', 'batch17Batch16MigrationSha256',
    'batch17ContentV22Evidence']) {
    assert.equal(Object.hasOwn(state, key), false, `Batch17 candidate metadata already contains ${key}`);
  }

  const batch16Sha256 = batch17MigrationFingerprint(state.batch16Migration);
  const replacementImages = { ...state.replacementImages, ...images };
  validateReplacementImages(replacementImages);
  const override = addImageOverrides(readOverride(state.overrideFile), images);
  writeOverride(state.overrideFile, override);
  state.replacementImages = replacementImages;
  state.batch17ReleaseTag = releaseTag;
  state.batch17CandidateServices = [...BATCH17_CANDIDATE_SERVICES];
  state.batch17CandidateImages = { ...images };
  state.batch17CandidateImageIds = { ...imageIds };
  state.batch17Before = structuredClone(beforeSnapshot);
  state.batch17Batch16MigrationSha256 = batch16Sha256;
  state.batch17ContentV22Evidence = { ...contentV22Evidence };
  persistState(state);
  return { images: { ...images }, imageIds: { ...imageIds }, override, batch16Sha256 };
}

function inspectBatch17CandidateImages(images) {
  const inspected = JSON.parse(docker(['image', 'inspect', ...Object.values(images)], { output: true }));
  assert.equal(inspected.length, BATCH17_CANDIDATE_SERVICES.length,
    'all Batch17 candidate images must exist locally');
  return Object.fromEntries(BATCH17_CANDIDATE_SERVICES.map((service) => {
    const image = inspected.find((item) => (item.RepoTags || []).includes(images[service]));
    assert(image, `${service} candidate image tag does not match the requested mapping`);
    assert.match(image.Id || '', /^sha256:[a-f0-9]{64}$/u,
      `${service} candidate image ID is invalid`);
    return [service, image.Id];
  }));
}

function verifyBatch17ContentV22(state, config) {
  const flywayEnabled = config.services?.['content-service']?.environment?.CONTENT_FLYWAY_ENABLED;
  const sql = 'SELECT version, checksum FROM content_service.p1r_schema_history WHERE version = 22';
  const output = docker(['exec', `${state.project}-mysql-1`, 'sh', '-ec',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --user=root --batch --skip-column-names -e "$1"',
    '--', sql], { output: true });
  const rows = output.split(/\r?\n/u).filter(Boolean).map((line) => {
    const [version, checksum] = line.split('\t');
    return { version, checksum };
  });
  return assertBatch17ContentV22Evidence({ flywayEnabled, rows });
}

function batch17ContainerSnapshot(state) {
  const ids = docker(['ps', '-a', '--filter', `label=com.docker.compose.project=${state.project}`,
    '--format', '{{.ID}}'], { output: true }).split(/\r?\n/u).filter(Boolean);
  assert.equal(ids.length, BATCH17_PRIVATE_SERVICES.length,
    'private project must contain exactly its expected 26 containers');
  const inspected = JSON.parse(docker(['inspect', ...ids], { output: true }));
  assert.equal(inspected.length, BATCH17_PRIVATE_SERVICES.length);
  const snapshot = {};
  for (const item of inspected) {
    assert.equal(item.Config.Labels['com.docker.compose.project'], state.project);
    const service = item.Config.Labels['com.docker.compose.service'];
    assert(service && !Object.hasOwn(snapshot, service), 'private container service labels must be unique');
    snapshot[service] = {
      containerId: item.Id,
      imageId: item.Image,
      status: item.State.Status,
      exitCode: item.State.ExitCode,
      project: item.Config.Labels['com.docker.compose.project'],
      networks: Object.keys(item.NetworkSettings.Networks || {}).sort(),
      portBindings: item.HostConfig.PortBindings || {}
    };
  }
  return assertBatch17PrivateSnapshot(snapshot, state.project);
}

function assertBatch17Prepared(state, releaseTag, images, imageIds, contentV22Evidence) {
  assert.deepEqual(state.batch17CandidateServices, BATCH17_CANDIDATE_SERVICES,
    'Batch17 candidates must be prepared first');
  assert.equal(state.batch17ReleaseTag, releaseTag, 'Batch17 release tag changed after preparation');
  assert.deepEqual(state.batch17CandidateImages, images, 'Batch17 candidate image mapping changed');
  assert.deepEqual(state.batch17CandidateImageIds, imageIds, 'Batch17 candidate image IDs changed');
  assert.deepEqual(state.batch17ContentV22Evidence, contentV22Evidence,
    'private content-service V22 preflight receipt changed');
  assert.deepEqual(BATCH17_CANDIDATE_SERVICES.map((service) => state.replacementImages?.[service]),
    BATCH17_CANDIDATE_SERVICES.map((service) => images[service]),
    'Batch17 replacement mapping changed after preparation');
  assertBatch17PrivateSnapshot(state.batch17Before);
  assert.equal(state.batch17Batch16MigrationSha256,
    batch17MigrationFingerprint(state.batch16Migration), 'Batch16 migration state changed after Batch17 preparation');
  for (const service of BATCH17_CANDIDATE_SERVICES) {
    assert.notEqual(imageIds[service], state.batch17Before[service].imageId,
      `${service} candidate image is not newly built`);
  }
}

function assertBatch17PromotionState(current, before, imageIds, services) {
  assertBatch17PrivateSnapshot(current);
  const targets = new Set(services);
  for (const service of BATCH17_PRIVATE_SERVICES) {
    if (!targets.has(service)) {
      assert.deepEqual(current[service], before[service],
        `${service} changed outside the exact Batch17 candidate scope`);
      continue;
    }
    const item = current[service];
    const original = before[service];
    if (item.containerId === original.containerId) {
      assert.equal(item.imageId, original.imageId,
        `${service} changed image without replacing its original container`);
    } else {
      assert.equal(item.imageId, imageIds[service],
        `${service} was replaced by an image outside the Batch17 mapping`);
    }
  }
}

export function useBatch17Candidates(state, releaseTag, {
  checkPrivatePermissions = assertPrivateTempPermissions,
  validateState = validate,
  inspectImages = inspectBatch17CandidateImages,
  verifyContentV22 = verifyBatch17ContentV22,
  snapshot = batch17ContainerSnapshot,
  readSharedFingerprint = baseline,
  readOverride = (file) => fs.readFileSync(file, 'utf8'),
  writeOverride = (file, contents) => fs.writeFileSync(file, contents, { mode: 0o600 }),
  persistState = writeState,
  applyServices = (value, services) => compose(value,
    batch17ComposeArgs(services),
    { timeout: 900000 }),
  recordEvent = record
} = {}) {
  assert.equal(state.project, batch17Project,
    'Batch17 can only promote candidates in cloudstudy-uat-isolated-3c94b27160');
  assert.match(releaseTag, /^583ab627-uat-batch17-20260925[0-9]{4}$/u,
    'Batch17 release tag must include the 2026-09-25 build date and time');
  assert(state.replacementImages, 'prior isolated release candidates must be installed first');
  checkPrivatePermissions(state);
  assertBatch16StageFlags(state.batch16Migration, 'services');
  let config = validateState(state);
  assert.deepEqual(readSharedFingerprint(), state.sharedBefore,
    'shared Docker fingerprint changed before Batch17 promotion');

  const images = batch17CandidateImages(releaseTag);
  const imageIds = inspectImages(images);
  assert.deepEqual(Object.keys(imageIds), BATCH17_CANDIDATE_SERVICES,
    'Batch17 candidate image inspection is incomplete');
  for (const service of BATCH17_CANDIDATE_SERVICES) {
    assert.match(imageIds[service] || '', /^sha256:[a-f0-9]{64}$/u,
      `${service} candidate image ID is invalid`);
  }

  const hasMetadata = Object.hasOwn(state, 'batch17CandidateServices');
  const currentBeforePreflight = assertBatch17PrivateSnapshot(snapshot(state), state.project);
  const contentV22Evidence = verifyContentV22(state, config);
  assert.deepEqual(contentV22Evidence, {
    version: 22, checksum: contentV22Checksum(), flywayEnabled: 'false'
  }, 'matching private content-service V22 history and disabled Flyway are required');
  if (hasMetadata) {
    assertBatch17Prepared(state, releaseTag, images, imageIds, contentV22Evidence);
  } else {
    prepareBatch17CandidateMetadata(state, releaseTag, {
      images, imageIds, beforeSnapshot: currentBeforePreflight, contentV22Evidence,
      readOverride, writeOverride, persistState
    });
    config = validateState(state);
    assertBatch17ContentV22Evidence({
      flywayEnabled: config.services?.['content-service']?.environment?.CONTENT_FLYWAY_ENABLED,
      rows: [{ version: contentV22Evidence.version, checksum: contentV22Evidence.checksum }]
    });
  }

  const before = state.batch17Before;
  const currentBeforeApply = assertBatch17PrivateSnapshot(snapshot(state), state.project);
  assertBatch17PromotionState(currentBeforeApply, before, imageIds, BATCH17_CANDIDATE_SERVICES);
  const migrationBeforeApply = structuredClone(state.batch16Migration);
  assert.equal(batch17MigrationFingerprint(migrationBeforeApply), state.batch17Batch16MigrationSha256);

  applyServices(state, [...BATCH17_CANDIDATE_SERVICES]);

  const after = assertBatch17PrivateSnapshot(snapshot(state), state.project);
  for (const service of BATCH17_CANDIDATE_SERVICES) {
    assert.equal(after[service].imageId, imageIds[service],
      `${service} did not start the exact newly built candidate image`);
    assert.notEqual(after[service].containerId, before[service].containerId,
      `${service} container was not recreated`);
    assert.equal(after[service].status, 'running', `${service} candidate is not running`);
  }
  for (const service of BATCH17_PRIVATE_SERVICES.filter((name) => !BATCH17_CANDIDATE_SERVICES.includes(name))) {
    assert.deepEqual(after[service], before[service],
      `${service} changed outside the exact Batch17 candidate scope`);
  }
  assert.deepEqual(readSharedFingerprint(), state.sharedBefore,
    'shared Docker fingerprint changed during Batch17 promotion');
  assert.deepEqual(state.batch16Migration, migrationBeforeApply,
    'Batch17 promotion modified the existing Batch16 migration state');
  assert.equal(batch17MigrationFingerprint(state.batch16Migration), state.batch17Batch16MigrationSha256);
  recordEvent(state, 'isolated-batch17-services-applied', {
    releaseTag, services: [...BATCH17_CANDIDATE_SERVICES], imageIds
  });
  return { images, imageIds, before, after };
}

function assertBatch16CandidatesPrepared(state) {
  assert.deepEqual(state.batch16CandidateServices, BATCH16_CANDIDATE_SERVICES,
    'Batch16 candidates must be prepared first');
  assert.deepEqual(Object.keys(state.batch16CandidateImages || {}), BATCH16_CANDIDATE_SERVICES,
    'Batch16 candidate image set is incomplete');
  assert.deepEqual(BATCH16_CANDIDATE_SERVICES.map((service) => state.replacementImages?.[service]),
    BATCH16_CANDIDATE_SERVICES.map((service) => state.batch16CandidateImages[service]),
    'Batch16 candidate mapping changed after preparation');
  validateReplacementImages(state.replacementImages);
}

function batch16PrivateBackup(state) {
  const migration = state.batch16Migration;
  const backup = migration?.backup;
  assert(backup && /^[a-f0-9]{64}$/u.test(backup.sha256) && backup.bytes > 1024,
    'a verified private Batch16 backup is required');
  const paths = assertPrivateStatePaths(state);
  assert.equal(path.resolve(backup.path), paths.backupFile);
  const stat = fs.lstatSync(paths.backupFile);
  assert(stat.isFile() && !stat.isSymbolicLink());
  assert.equal(stat.size, backup.bytes, 'Batch16 backup size changed after capture');
  assert.equal(sha256(paths.backupFile), backup.sha256, 'Batch16 backup hash changed after capture');
  assertPrivateTempPermissions(state);
  return backup;
}

function batch16ContainerSnapshot(state) {
  const ids = docker(['ps', '-a', '--filter', `label=com.docker.compose.project=${state.project}`,
    '--format', '{{.ID}}'], { output: true }).split(/\r?\n/u).filter(Boolean);
  assert.equal(ids.length, 26, 'private project must contain its expected 26 containers');
  const inspected = JSON.parse(docker(['inspect', ...ids], { output: true }));
  assert.equal(inspected.length, 26);
  const snapshot = {};
  for (const item of inspected) {
    assert.equal(item.Config.Labels['com.docker.compose.project'], state.project);
    assert.deepEqual(Object.keys(item.NetworkSettings.Networks), [state.project]);
    assert.deepEqual(item.HostConfig.PortBindings || {}, {});
    const service = item.Config.Labels['com.docker.compose.service'];
    assert(service && !Object.hasOwn(snapshot, service), 'private container service labels must be unique');
    snapshot[service] = {
      containerId: item.Id,
      imageId: item.Image,
      status: item.State.Status,
      exitCode: item.State.ExitCode
    };
  }
  assert.equal(Object.keys(snapshot).length, 26);
  return snapshot;
}

function assertBatch16WritersDrained(state, snapshot = batch16ContainerSnapshot(state)) {
  const receipt = state.batch16Migration?.writers;
  assert.equal(state.batch16Migration?.writersDrained, true, 'Batch16 writers must be drained');
  assert.deepEqual(Object.keys(receipt?.containers || {}).sort(), [...ownerServices].sort(),
    'Batch16 writer drain receipt is incomplete');
  for (const service of ownerServices) {
    const expected = receipt.containers[service];
    const current = snapshot[service];
    assert(current, `${service} container is missing`);
    assert.equal(current.containerId, expected.containerId, `${service} container changed after drain`);
    assert.equal(current.imageId, expected.imageId, `${service} image changed after drain`);
    assert.notEqual(current.status, 'running', `${service} writer is still running`);
  }
  return snapshot;
}

function assertBatch16WritersRestored(state, snapshot = batch16ContainerSnapshot(state)) {
  const services = ownerServices.filter((service) => !BATCH16_APPLY_SERVICES.includes(service));
  const migration = state.batch16Migration;
  assert.equal(migration.writersRestored, true, 'non-target owner services must be restored');
  assert.deepEqual(Object.keys(migration.restoredContainers || {}).sort(), [...services].sort(),
    'Batch16 restore receipt is incomplete');
  for (const service of services) {
    const expected = migration.writers?.containers?.[service];
    const receipt = migration.restoredContainers[service];
    const current = snapshot[service];
    assert(current && expected, `${service} restore identity is missing`);
    assert.equal(current.containerId, expected.containerId, `${service} container was recreated during restore`);
    assert.equal(current.imageId, expected.imageId, `${service} image changed during restore`);
    assert.equal(receipt.containerId, expected.containerId);
    assert.equal(receipt.imageId, expected.imageId);
    assert.equal(receipt.status, 'running');
    assert.equal(current.status, 'running', `${service} did not return to running state`);
  }
  const adminOps = migration.writers?.containers?.['admin-ops-service'];
  assert.equal(snapshot['admin-ops-service']?.containerId, adminOps?.containerId);
  assert.notEqual(snapshot['admin-ops-service']?.status, 'running',
    'old admin-ops-service must remain stopped until the candidate replacement');
  return snapshot;
}

export function assertBatch16StageFlags(migration, stage) {
  if (['apply', 'verify', 'services'].includes(stage)) {
    assert.equal(migration.preflightPassed, true, 'Batch16 migration preflight must pass');
  }
  if (['verify', 'services'].includes(stage)) {
    assert.equal(migration.applyPassed, true, 'Batch16 migration apply must pass');
  }
  if (['restore', 'services'].includes(stage)) {
    assert.equal(migration.verifyPassed, true, 'Batch16 migration verify must pass');
    assert.equal(migration.adminOpsV5?.version, 5, 'admin-ops-service V5 must be verified');
  }
  if (stage === 'services') {
    assert.equal(migration.writersRestored, true, 'non-target owner services must be restored first');
  }
}

function assertBatch16MigrationStage(state, stage) {
  assertBatch16CandidatesPrepared(state);
  batch16PrivateBackup(state);
  const migration = state.batch16Migration;
  if (['preflight', 'apply', 'verify'].includes(stage)) assertBatch16WritersDrained(state);
  assertBatch16StageFlags(migration, stage);
  if (stage === 'services') assertBatch16WritersRestored(state);
}

function assertBatch16MigrationGatesEnabled(state) {
  const env = fs.readFileSync(state.envFile, 'utf8');
  for (const key of ['P1R_EXTERNAL_MIGRATION_WRITERS_DRAINED', 'P1R_EXTERNAL_MIGRATION_BACKUP_READY']) {
    assert.equal((env.match(new RegExp(`^${key}=true$`, 'gmu')) || []).length, 1,
      `${key} must be true in the private env file`);
  }
}

function backupBatch16BeforeMigration(state) {
  assertBatch16CandidatesPrepared(state);
  assert(!state.batch16Migration?.backup, 'a Batch16 backup already exists; inspect it before retrying');
  validate(state);
  const before = batch16ContainerSnapshot(state);
  assert.equal(before.mysql?.status, 'running', 'private MySQL must be running before the backup');
  const paths = assertPrivateStatePaths(state);
  const backupFd = fs.openSync(paths.backupFile, 'wx', 0o600);
  fs.closeSync(backupFd);
  compose(state, ['exec', '-T', 'mysql', 'sh', '-ec',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump --user=root --single-transaction --no-tablespaces --routines --events --all-databases'],
  { stdoutFile: paths.backupFile, timeout: 600000 });
  const stat = fs.lstatSync(paths.backupFile);
  assert(stat.isFile() && !stat.isSymbolicLink());
  assert(stat.size > 1024, 'empty Batch16 database backup');
  state.batch16Migration = {
    backup: { path: paths.backupFile, bytes: stat.size, sha256: sha256(paths.backupFile) },
    writersDrained: false,
    preflightPassed: false,
    applyPassed: false,
    verifyPassed: false
  };
  assertPrivateTempPermissions(state);
  record(state, 'batch16-private-backup-verified', {
    backupBytes: stat.size, backupSha256: state.batch16Migration.backup.sha256
  });
}

function drainBatch16Writers(state) {
  assertBatch16CandidatesPrepared(state);
  batch16PrivateBackup(state);
  if (state.batch16Migration.writersDrained) {
    assertBatch16WritersDrained(state);
    return;
  }
  validate(state);
  const before = batch16ContainerSnapshot(state);
  for (const service of ownerServices) {
    assert.equal(before[service]?.status, 'running', `${service} must be running before the drain`);
  }
  compose(state, ['stop', '--timeout', '30', ...ownerServices], { timeout: 180000 });
  const after = batch16ContainerSnapshot(state);
  const containers = {};
  for (const service of ownerServices) {
    assert.equal(after[service].containerId, before[service].containerId,
      `${service} container changed while draining writers`);
    assert.equal(after[service].imageId, before[service].imageId,
      `${service} image changed while draining writers`);
    assert.notEqual(after[service].status, 'running', `${service} writer did not stop`);
    containers[service] = { containerId: after[service].containerId, imageId: after[service].imageId };
  }
  state.batch16Migration.writers = { containers, stoppedAt: new Date().toISOString() };
  state.batch16Migration.writersDrained = true;
  setBatch16MigrationGates(state, true);
  assert.deepEqual(baseline(), state.sharedBefore);
  record(state, 'batch16-private-writers-drained', { services: [...ownerServices] });
}

function runBatch16MigrationStep(state, stage) {
  assertBatch16MigrationStage(state, stage);
  assertBatch16MigrationGatesEnabled(state);
  const modes = {
    preflight: { arg: '--preflight', summary: /Read-only preflight passed for 13 external owner schemas/u,
      event: 'batch16-owner-migration-preflight-passed' },
    apply: { arg: '--apply', summary: /All 13 external owner histories and runtime grants verified; IAM scoped DDL verified/u,
      event: 'batch16-owner-migration-applied' }
  };
  const action = modes[stage];
  assert(action, 'invalid Batch16 migration stage');
  if (stage === 'preflight') assert.equal(state.batch16Migration.preflightPassed, false);
  if (stage === 'apply') assert.equal(state.batch16Migration.applyPassed, false);
  const output = compose(state, ['run', '--rm', '--no-deps', '--pull', 'never',
    'mysql-migrate', action.arg], { output: true, timeout: 1200000 });
  assert.match(output, action.summary);
  state.batch16Migration[stage === 'preflight' ? 'preflightPassed' : 'applyPassed'] = true;
  state.batch16Migration[`${stage}At`] = new Date().toISOString();
  record(state, action.event);
}

function expectedAdminOpsV5Checksum() {
  const migration = path.join(root,
    'services/admin-ops-service/src/main/resources/db/migration/V5__index_admin_audit_tenant_sequence.sql');
  const sql = fs.readFileSync(migration, 'utf8');
  assert(sql.trim(), 'admin-ops-service V5 migration must not be empty');
  return crypto.createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex');
}

function verifyBatch16Migration(state) {
  assertBatch16MigrationStage(state, 'verify');
  const output = compose(state, ['run', '--rm', '--no-deps', '--pull', 'never',
    'mysql-migrate', '--verify'], { output: true, timeout: 1200000 });
  assert.match(output, /Read-only history and grant verification passed for 13 external owners/u);
  const expectedChecksum = expectedAdminOpsV5Checksum();
  const sql = 'SELECT checksum FROM admin_ops_service.p1r_schema_history WHERE version = 5';
  const actualChecksum = docker(['exec', `${state.project}-mysql-1`, 'sh', '-ec',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --user=root --batch --skip-column-names -e "$1"',
    '--', sql], { output: true });
  assert.equal(actualChecksum, expectedChecksum,
    'admin-ops-service V5 result is missing or differs from the repository checksum');
  const indexSql = "SELECT COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = 'admin_ops_service' AND TABLE_NAME = 'admin_audit_record' AND INDEX_NAME = 'idx_admin_audit_tenant_sequence' ORDER BY SEQ_IN_INDEX";
  const indexColumns = docker(['exec', `${state.project}-mysql-1`, 'sh', '-ec',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --user=root --batch --skip-column-names -e "$1"',
    '--', indexSql], { output: true }).split(/\r?\n/u);
  assert.deepEqual(indexColumns, ['tenant_ref', 'sequence_id'],
    'admin-ops-service V5 index columns are missing or ordered incorrectly');
  state.batch16Migration.adminOpsV5 = {
    version: 5, checksum: actualChecksum, result: 'applied-and-verified',
    indexName: 'idx_admin_audit_tenant_sequence', indexColumns
  };
  state.batch16Migration.verifyPassed = true;
  state.batch16Migration.verifiedAt = new Date().toISOString();
  record(state, 'batch16-owner-migration-verified', {
    externalOwners: 13, adminOpsV5Checksum: actualChecksum
  });
}

function probeBatch16RestoredOwners(state, services) {
  const targets = services.map((name) => ({
    name, port: batch16OwnerReadinessPorts[name], route: '/actuator/health/readiness'
  }));
  assert(targets.every((target) => target.port), 'owner readiness port is not allowlisted');
  const js = `const targets=${JSON.stringify(targets)};const result=[];const deadline=Date.now()+120000;for(const target of targets){let status=0;let error='';while(Date.now()<deadline&&status!==200){try{const response=await fetch('http://'+target.name+':'+target.port+target.route,{signal:AbortSignal.timeout(3000)});status=response.status;error='';}catch(e){error=e.name;}if(status!==200)await new Promise(resolve=>setTimeout(resolve,2000));}result.push({...target,status,error});}console.log(JSON.stringify(result));if(result.some(item=>item.status!==200))process.exitCode=1;`;
  const image = state.batch16CandidateImages['mysql-migrate'];
  const output = docker(['run', '--rm', '--network', state.project, '--entrypoint', 'node', image,
    '--input-type=module', '-e', js], { output: true, timeout: 180000 });
  const result = JSON.parse(output);
  assert.deepEqual(result.map((item) => item.name), services);
  assert(result.every((item) => item.status === 200), 'restored owner readiness did not pass');
  return result;
}

export function startBatch16OriginalContainers(state, services, runDocker = docker) {
  const ids = services.map((service) => {
    const id = state.batch16Migration?.writers?.containers?.[service]?.containerId;
    assert(id, `${service} original container ID is missing`);
    return id;
  });
  if (ids.length) runDocker(['start', ...ids], { timeout: 600000 });
}

export function restoreBatch16NonTargetOwners(state, {
  assertStage = (value) => assertBatch16MigrationStage(value, 'restore'),
  snapshot = batch16ContainerSnapshot,
  startServices = startBatch16OriginalContainers,
  probeOwners = probeBatch16RestoredOwners,
  readBaseline = baseline,
  recordEvent = record
} = {}) {
  assertStage(state);
  const migration = state.batch16Migration;
  assert.equal(migration.writersDrained, true, 'Batch16 writers must be drained before restore');
  const services = ownerServices.filter((service) => !BATCH16_APPLY_SERVICES.includes(service));
  assert.deepEqual(Object.keys(migration.writers?.containers || {}).sort(), [...ownerServices].sort(),
    'Batch16 writer identity receipt is incomplete');
  const assertOriginalOwnerContainers = (current) => {
    for (const service of ownerServices) {
      const expected = migration.writers.containers[service];
      assert(current[service] && expected, `${service} writer identity is missing`);
      assert.equal(current[service].containerId, expected.containerId,
        `${service} container changed during writer restore`);
      assert.equal(current[service].imageId, expected.imageId,
        `${service} image changed during writer restore`);
    }
    assert.notEqual(current['admin-ops-service'].status, 'running',
      'old admin-ops-service must remain stopped until its replacement');
  };
  const before = snapshot(state);
  assertOriginalOwnerContainers(before);
  const toStart = services.filter((service) => {
    const status = before[service].status;
    assert(['running', 'exited', 'created'].includes(status),
      `${service} has an unexpected state during writer restore`);
    return status !== 'running';
  });
  if (toStart.length) startServices(state, toStart);
  const after = snapshot(state);
  assertOriginalOwnerContainers(after);
  const restoredContainers = {};
  for (const service of services) {
    assert.equal(after[service].status, 'running');
    restoredContainers[service] = {
      containerId: after[service].containerId,
      imageId: after[service].imageId,
      status: after[service].status
    };
  }
  const readiness = probeOwners(state, services);
  assert(Array.isArray(readiness), 'restored non-target owner readiness evidence is missing');
  assert.deepEqual(readiness.map((item) => item.name).sort(), [...services].sort(),
    'restored non-target owner readiness evidence is incomplete');
  assert(readiness.every((item) => item.status === 200),
    'all restored non-target owners must pass readiness before recording the restore receipt');
  assert.deepEqual(readBaseline(), state.sharedBefore);
  migration.restoredContainers = restoredContainers;
  migration.writersRestored = true;
  migration.restoredAt = new Date().toISOString();
  assertBatch16WritersRestored(state, after);
  recordEvent(state, 'batch16-non-target-owners-restored', {
    services, containers: restoredContainers, readiness
  });
  return readiness;
}

function applyBatch16AfterMigration(state) {
  assertBatch16MigrationStage(state, 'services');
  const services = [...BATCH16_APPLY_SERVICES];
  validate(state);
  const images = Object.fromEntries(services.map((service) => [service, state.batch16CandidateImages[service]]));
  const imageInfo = JSON.parse(docker(['image', 'inspect', ...Object.values(images)], { output: true }));
  assert.equal(imageInfo.length, services.length);
  const before = batch16ContainerSnapshot(state);
  for (const [index, service] of services.entries()) {
    assert(before[service], `${service} container is missing from the isolated project`);
    assert.notEqual(imageInfo[index].Id, before[service].imageId,
      `${service} does not contain a newly built image`);
  }
  compose(state, ['up', '-d', '--no-deps', '--no-build', '--pull', 'never',
    '--force-recreate', ...services], { timeout: 900000 });
  const after = batch16ContainerSnapshot(state);
  for (const [index, service] of services.entries()) {
    assert.equal(after[service].imageId, imageInfo[index].Id);
    assert.notEqual(after[service].containerId, before[service].containerId);
  }
  for (const service of Object.keys(before).filter((name) => !services.includes(name))) {
    assert.deepEqual(after[service], before[service], `${service} changed outside scoped replacement`);
  }
  assert.deepEqual(baseline(), state.sharedBefore);
  record(state, 'isolated-batch16-services-applied', {
    services, migrationVerifiedAt: state.batch16Migration.verifiedAt,
    imageIds: Object.fromEntries(services.map((service, index) => [service, imageInfo[index].Id]))
  });
}

function probeAtomicity(state) {
  validate(state);
  const activeImage = state.replacementImages?.['iam-service'] ?? state.iamCandidateImage;
  assert(activeImage, 'IAM candidate not selected');
  const mysqlName = `${state.project}-mysql-1`;
  const counts = () => {
    const sql = "SELECT (SELECT COUNT(*) FROM iam_service.iam_account), (SELECT COUNT(*) FROM iam_service.iam_device), (SELECT COUNT(*) FROM iam_service.iam_session), (SELECT COUNT(*) FROM iam_service.iam_idempotency_record)";
    const output = docker(['exec', mysqlName, 'sh', '-ec',
      'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --user=root --batch --skip-column-names -e "$1"', '--', sql], { output: true });
    const values = output.split('\t').map(Number);
    assert.equal(values.length, 4);
    return { accounts: values[0], devices: values[1], sessions: values[2], idempotencyRecords: values[3] };
  };
  const before = counts();
  const js = `
    import crypto from 'node:crypto';
    import fs from 'node:fs';
    const run=crypto.randomBytes(6).toString('hex');
    const fixture=JSON.parse(fs.readFileSync('/test-secrets/login-fixture.json','utf8'));
    const body={identifier:'uat-atomic-new-'+run+'@local.invalid',
      password:'Uat!'+crypto.randomBytes(20).toString('base64url')+'a9',
      device:{deviceType:'WEB',clientVersion:'isolated-docker-uat',deviceName:'atomic-probe'}};
    async function call(base,path,request,key){
      const response=await fetch(base+path,{method:'POST',
        headers:{'content-type':'application/json','idempotency-key':key},
        body:JSON.stringify(request),signal:AbortSignal.timeout(10000)});
      const json=await response.json().catch(()=>null);
      return {status:response.status,errorCode:json?.error?.errorCode??null,
        message:json?.error?.message??null,hasAccessToken:Boolean(json?.data?.accessToken)};
    }
    const first=await call('http://iam-service:18087','/api/v1/auth/register',body,'uat-atomic-'+run+'-first');
    const sameKeyRetry=await call('http://iam-service:18087','/api/v1/auth/register',body,'uat-atomic-'+run+'-first');
    const newKeyRetry=await call('http://iam-service:18087','/api/v1/auth/register',body,'uat-atomic-'+run+'-retry');
    const login=await call('http://iam-service:18087','/api/v1/auth/login',fixture,'uat-atomic-'+run+'-login');
    const gateway=await call('http://api-gateway:18070','/api/v1/auth/register',body,'uat-atomic-'+run+'-gateway');
    console.log(JSON.stringify({first,sameKeyRetry,newKeyRetry,login,gateway}));
  `;
  const output = docker(['run', '--rm', '--network', state.project,
    '--label', `com.cloudstudy.uat.project=${state.project}`,
    '--mount', `type=bind,source=${state.tempDir},target=/test-secrets,readonly`,
    '--entrypoint', 'node', `cloudstudy-clyunedev/owner-migrator:${tag}`,
    '--input-type=module', '-e', js], { output: true, timeout: 90000 });
  const api = JSON.parse(output);
  const after = counts();
  const pass = Object.values(api).every((check) => check.status === 503
    && check.message === 'iam.consent.version_unavailable' && !check.hasAccessToken)
    && JSON.stringify(before) === JSON.stringify(after);
  const evidenceFile = batchEvidenceFilePath(state, 'docker-isolated-iam-atomicity.json');
  fs.writeFileSync(evidenceFile, `${JSON.stringify({ at: new Date().toISOString(), project: state.project,
    candidateImage: activeImage, before, api, after, pass }, null, 2)}\n`);
  record(state, 'iam-atomicity-probed', { pass, before, after });
  console.log(`IAM atomicity: ${pass ? 'PASS' : 'FAIL'}; evidence: ${evidenceFile}`);
  if (!pass) process.exitCode = 1;
}

function probeJdbcRefreshRollback(state) {
  validate(state);
  const phase = state.replacementImages ? 'batch10' : 'candidate';
  const workspace = path.join(state.tempDir, `iam-jdbc-regression-${phase}`);
  assert(!fs.existsSync(workspace), 'JDBC regression workspace already exists');
  fs.mkdirSync(path.join(workspace, 'services'), { recursive: true });
  fs.copyFileSync(path.join(root, 'pom.xml'), path.join(workspace, 'pom.xml'));
  fs.cpSync(path.join(root, 'services/iam-service'), path.join(workspace, 'services/iam-service'), {
    recursive: true,
    filter: (source) => !source.split(path.sep).includes('target')
  });
  const privateEnv = Object.fromEntries(fs.readFileSync(state.envFile, 'utf8').trim().split(/\r?\n/u)
    .map((line) => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator), line.slice(separator + 1)];
    }));
  const envFile = path.join(state.tempDir, 'iam-jdbc-regression.env');
  fs.writeFileSync(envFile, [
    'IAM_JDBC_URL=jdbc:mysql://mysql:3306/iam_service?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&useSSL=false',
    'IAM_JDBC_USERNAME=svc_iam',
    `IAM_JDBC_PASSWORD=${privateEnv.IAM_DB_PASSWORD}`
  ].join('\n') + '\n', { mode: 0o600 });
  const log = path.join(state.tempDir, 'iam-jdbc-regression.log');
  docker(['run', '--rm', '--network', state.project,
    '--label', `com.cloudstudy.uat.project=${state.project}`,
    '--env-file', envFile,
    '--mount', `type=bind,source=${workspace},target=/workspace`,
    '--mount', `type=bind,source=${path.join(os.homedir(), '.m2', 'repository')},target=/root/.m2/repository`,
    '--workdir', '/workspace', 'maven:3.9-eclipse-temurin-25',
    'mvn', '-o', '-q', '-f', 'services/iam-service/pom.xml',
    '-Dtest=IamJdbcPersistenceContextTest#consentOutageAfterRefreshRotationRollsBackTokenAndIdempotencyClaim',
    '-Diam.jdbc.integration=true', 'test'], { timeout: 600000, stdoutFile: log });
  const reportFile = path.join(workspace, 'services/iam-service/target/surefire-reports',
    'TEST-com.englishflow.iam.IamJdbcPersistenceContextTest.xml');
  const xml = fs.readFileSync(reportFile, 'utf8');
  const suite = xml.match(/<testsuite\b[^>]*>/u)?.[0];
  assert(suite, 'JDBC regression suite report missing');
  const count = (name) => Number(suite.match(new RegExp(`${name}="(\\d+)"`, 'u'))?.[1] ?? -1);
  const summary = { tests: count('tests'), failures: count('failures'),
    errors: count('errors'), skipped: count('skipped') };
  assert.deepEqual(summary, { tests: 1, failures: 0, errors: 0, skipped: 0 });
  const evidenceFile = batchEvidenceFilePath(state, 'docker-isolated-iam-refresh-rollback.json');
  fs.writeFileSync(evidenceFile, `${JSON.stringify({ at: new Date().toISOString(),
    project: state.project, test: 'consentOutageAfterRefreshRotationRollsBackTokenAndIdempotencyClaim',
    releaseImages: state.replacementImages ?? null,
    privateNetwork: true, hostPorts: 0, summary }, null, 2)}\n`);
  record(state, 'iam-jdbc-refresh-rollback-tested', summary);
  console.log(`IAM JDBC refresh rollback: PASS; evidence: ${evidenceFile}`);
}

function probeOfflineGateway(state) {
  validate(state);
  const js = `
    const route='/api/v1/sync/offline-packages?limit=20';
    const checks=[];
    async function check(name,base,path,method,headers={}){
      const response=await fetch(base+path,{method,headers,signal:AbortSignal.timeout(10000)});
      const json=await response.json().catch(()=>null);
      checks.push({name,status:response.status,errorCode:json?.error?.errorCode??null,
        message:json?.error?.message??null,
        allowOrigin:response.headers.get('access-control-allow-origin'),
        allowMethods:response.headers.get('access-control-allow-methods')});
    }
    await check('anonymous-gateway','http://api-gateway:18070',route,'GET');
    await check('anonymous-owner','http://notification-service:18093',
      '/internal/v1/sync/offline-packages?limit=20','GET');
    await check('mobile-get-preflight','http://api-gateway:18070',route,'OPTIONS',{
      Origin:'https://mobile.clyunedev.com',
      'Access-Control-Request-Method':'GET',
      'Access-Control-Request-Headers':'authorization,content-type'});
    console.log(JSON.stringify(checks));
  `;
  const output = docker(['run', '--rm', '--network', state.project,
    '--label', `com.cloudstudy.uat.project=${state.project}`,
    '--entrypoint', 'node', `cloudstudy-clyunedev/owner-migrator:${tag}`,
    '--input-type=module', '-e', js], { output: true, timeout: 60000 });
  const checks = JSON.parse(output);
  const phase = state.replacementImages ? 'after' : 'before';
  const evidenceFile = batchEvidenceFilePath(state, `docker-isolated-offline-gateway-${phase}.json`);
  fs.writeFileSync(evidenceFile, `${JSON.stringify({ at: new Date().toISOString(),
    project: state.project, releaseImages: state.replacementImages ?? null,
    authorizationState: 'BLOCKED_NO_ACTIVE_CONSENT_DOCUMENTS', checks }, null, 2)}\n`);
  record(state, `offline-gateway-${phase}-probed`, {
    anonymousGateway: checks[0].status, anonymousOwner: checks[1].status,
    mobilePreflight: checks[2].status
  });
  console.log(`Offline gateway ${phase}: ${checks.map((entry) => `${entry.name}=${entry.status}`).join(', ')}`);
}

function probeB3B9Anonymous(state) {
  validate(state);
  const js = `
    import crypto from 'node:crypto';
    const checks=[];
    async function check(name,base,path,method='GET',body){
      const headers={};
      if(body){headers['Content-Type']='application/json';headers['Idempotency-Key']=crypto.randomUUID()}
      const response=await fetch(base+path,{method,headers,body:body?JSON.stringify(body):undefined});
      let value=null;
      try{value=await response.json()}catch{}
      checks.push({name,method,path,status:response.status,
        code:value?.error?.code??value?.code??value?.errorCode??null,
        hasData:response.ok&&value?.data!=null});
    }
    const b3=[
      ['grammar','/grammar/points'],['listening','/listening/materials'],
      ['reading','/reading/articles'],['writing','/writing/prompts'],
      ['phonetics','/phonetics/catalog']
    ];
    for(const [name,path] of b3){
      await check('content-owner-b3-'+name,'http://content-service:18089','/internal/v1/content/learner'+path);
      await check('gateway-b3-'+name,'http://api-gateway:18070','/api/v1'+path);
    }
    await check('content-owner-b9-admin-list','http://content-service:18089','/internal/v1/content/admin-commands');
    await check('gateway-b9-admin-list','http://api-gateway:18070','/api/v1/admin/content-commands');
    const invalid={command:'SUBMIT_REVIEW',contentCode:'uat-anonymous-nonexistent',expectedStateVersion:1};
    await check('content-owner-b9-anonymous-submit','http://content-service:18089','/internal/v1/content/admin-commands','POST',invalid);
    await check('gateway-b9-anonymous-submit','http://api-gateway:18070','/api/v1/admin/content-commands','POST',invalid);
    console.log(JSON.stringify({at:new Date().toISOString(),checks}));
  `;
  const output = docker(['run', '--rm', '--network', state.project,
    '--label', `com.cloudstudy.uat.project=${state.project}`,
    '--entrypoint', 'node', `cloudstudy-clyunedev/owner-migrator:${tag}`,
    '--input-type=module', '-e', js], { output: true, timeout: 60000 });
  const result = JSON.parse(output);
  const evidenceFile = batchEvidenceFilePath(state, 'docker-isolated-b3-b9-anonymous-batch13.json');
  fs.writeFileSync(evidenceFile, `${JSON.stringify({ project: state.project,
    releaseImages: Object.fromEntries(['content-service', 'admin-web', 'mobile-h5'].map((name) =>
      [name, state.replacementImages[name]])),
    authorizationState: 'BLOCKED_NO_ACTIVE_CONSENT_DOCUMENTS',
    ...result }, null, 2)}\n`);
  record(state, 'b3-b9-anonymous-probed', { checks: result.checks.length });
  console.log(`B3/B9 anonymous evidence: ${evidenceFile}`);
  console.log(result.checks.map((entry) => `${entry.name}=${entry.status}`).join(', '));
}

function probeB4Anonymous(state) {
  validate(state);
  assert(state.replacementImages?.['gamification-service'], 'batch14 gamification image is not active');
  const js = `
    const checks=[];
    async function check(name,base,path,method='GET',body){
      const response=await fetch(base+path,{method,
        headers:body?{'Content-Type':'application/json','Idempotency-Key':'uat-anonymous-b4'}:{},
        body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
      const json=await response.json().catch(()=>null);
      checks.push({name,method,status:response.status,
        errorCode:json?.error?.errorCode??json?.error?.code??json?.code??null,
        exposedItems:Array.isArray(json?.items)&&json.items.length>0});
    }
    const endpoints=[
      ['quests','/gamification/quests'],
      ['achievements','/gamification/achievements'],
      ['collection','/gamification/collection'],
      ['avatar-items','/avatar/items'],
      ['avatar-profile','/avatar/profile']
    ];
    for(const [name,path] of endpoints){
      await check('owner-'+name,'http://gamification-service:18094',
        '/internal/v1/gamification'+path.replace('/gamification',''));
      await check('gateway-'+name,'http://api-gateway:18070','/api/v1'+path);
    }
    await check('owner-quest-claim','http://gamification-service:18094',
      '/internal/v1/gamification/quests/daily-practice/claim','POST',{});
    await check('gateway-quest-claim','http://api-gateway:18070',
      '/api/v1/gamification/quests/daily-practice/claim','POST',{});
    await check('owner-avatar-profile-write','http://gamification-service:18094',
      '/internal/v1/gamification/avatar/profile','PUT',{renderMode:'3D'});
    await check('gateway-avatar-profile-write','http://api-gateway:18070',
      '/api/v1/avatar/profile','PUT',{renderMode:'3D'});
    console.log(JSON.stringify({at:new Date().toISOString(),checks}));
  `;
  const output = docker(['run', '--rm', '--network', state.project,
    '--label', `com.cloudstudy.uat.project=${state.project}`,
    '--entrypoint', 'node', `cloudstudy-clyunedev/owner-migrator:${tag}`,
    '--input-type=module', '-e', js], { output: true, timeout: 90000 });
  const result = JSON.parse(output);
  assert.equal(result.checks.length, 14);
  for (const check of result.checks) {
    assert.equal(check.status, 401, `${check.name} did not reject anonymous access`);
    assert.equal(check.exposedItems, false, `${check.name} exposed item data`);
  }
  const evidenceFile = batchEvidenceFilePath(state, 'docker-isolated-b4-anonymous-batch14.json');
  fs.writeFileSync(evidenceFile, `${JSON.stringify({project:state.project,
    gamificationImage:state.replacementImages['gamification-service'],
    authorizationState:'BLOCKED_NO_ACTIVE_CONSENT_DOCUMENTS',...result},null,2)}\n`);
  record(state, 'b4-anonymous-probed', {checks: result.checks.length});
  console.log(`B4 anonymous evidence: ${evidenceFile}`);
  console.log(result.checks.map((check) => `${check.name}=${check.status}`).join(', '));
}

function probeMobileRuntime(state) {
  validate(state);
  const browserImage = `cloudstudy-uat-isolated/browser:${state.project.slice(-10)}`;
  const present = docker(['image', 'ls', browserImage, '--format', '{{.Repository}}:{{.Tag}}'],
    { output: true });
  assert.equal(present, browserImage);
  const outputDir = browserEvidenceDirectory(state);
  const script = path.join(root, 'scripts/runtime/uat-isolated-mobile-runtime.cjs');
  const batch = String(state.replacementImages?.['mobile-h5'] || '').match(/batch\d+/u)?.[0] ?? 'batch10';
  const output = docker(['run', '--rm', '--network', state.project,
    '--label', `com.cloudstudy.uat.project=${state.project}`,
    '--mount', `type=bind,source=${script},target=/probe.cjs,readonly`,
    '--mount', `type=bind,source=${outputDir},target=/out`,
    '-e', 'NODE_PATH=/opt/uat/node_modules',
    '-e', `UAT_MOBILE_BATCH=${batch}`,
    '--entrypoint', 'node', browserImage, '/probe.cjs'],
  { output: true, timeout: 120000 });
  const summary = JSON.parse(output);
  assert.equal(summary.length, 2);
  record(state, 'mobile-runtime-capabilities-probed', {
    rootErrors: summary[0].pageErrors, loginErrors: summary[1].pageErrors
  });
  console.log(`Mobile runtime capability evidence: ${path.join(outputDir, `mobile-runtime-types-${batch}.json`)}`);
  console.log(JSON.stringify(summary));
}

function probeMobileJourney(state) {
  validate(state);
  const browserImage = `cloudstudy-uat-isolated/browser:${state.project.slice(-10)}`;
  const present = docker(['image', 'ls', browserImage, '--format', '{{.Repository}}:{{.Tag}}'],
    { output: true });
  assert.equal(present, browserImage);
  const outputDir = browserEvidenceDirectory(state);
  const script = path.join(root, 'scripts/runtime/uat-isolated-mobile-journey.cjs');
  const batch = String(state.replacementImages?.['mobile-h5'] || '').match(/batch\d+/u)?.[0] ?? 'batch11';
  const output = docker(['run', '--rm', '--network', state.project,
    '--label', `com.cloudstudy.uat.project=${state.project}`,
    '--mount', `type=bind,source=${script},target=/probe.cjs,readonly`,
    '--mount', `type=bind,source=${outputDir},target=/out`,
    '-e', 'NODE_PATH=/opt/uat/node_modules', '-e', `UAT_MOBILE_BATCH=${batch}`,
    '--entrypoint', 'node', browserImage, '/probe.cjs'],
  { output: true, timeout: 120000 });
  const summary = JSON.parse(output);
  record(state, 'mobile-journey-probed', { steps: summary.steps,
    rootIssues: summary.rootIssues, pageErrors: summary.pageErrors,
    consoleErrors: summary.consoleErrors });
  console.log(`Mobile journey evidence: ${path.join(outputDir, `mobile-journey-${batch}.json`)}`);
  console.log(JSON.stringify(summary));
}

function probeLearnerB11Anonymous(state) {
  validate(state);
  const browserImage = `cloudstudy-uat-isolated/browser:${state.project.slice(-10)}`;
  const present = docker(['image', 'ls', browserImage, '--format', '{{.Repository}}:{{.Tag}}'],
    { output: true });
  assert.equal(present, browserImage);
  const outputDir = browserEvidenceDirectory(state);
  const script = path.join(root, 'scripts/runtime/uat-isolated-learner-b11-anonymous.cjs');
  const batch = String(state.replacementImages?.['learner-web'] || '').match(/batch\d+/u)?.[0] ?? 'batch12';
  const output = docker(['run', '--rm', '--network', state.project,
    '--label', `com.cloudstudy.uat.project=${state.project}`,
    '--mount', `type=bind,source=${script},target=/probe.cjs,readonly`,
    '--mount', `type=bind,source=${outputDir},target=/out`,
    '-e', 'NODE_PATH=/opt/uat/node_modules', '-e', `UAT_LEARNER_BATCH=${batch}`,
    '--entrypoint', 'node', browserImage, '/probe.cjs'],
  { output: true, timeout: 180000 });
  const summary = JSON.parse(output);
  record(state, 'learner-b11-anonymous-probed', summary);
  console.log(`Learner B11 anonymous evidence: ${path.join(outputDir, `learner-b11-anonymous-${batch}.json`)}`);
  console.log(JSON.stringify(summary));
}

function probeAdminContentAnonymous(state) {
  validate(state);
  const browserImage = `cloudstudy-uat-isolated/browser:${state.project.slice(-10)}`;
  const present = docker(['image', 'ls', browserImage, '--format', '{{.Repository}}:{{.Tag}}'],
    { output: true });
  assert.equal(present, browserImage);
  const outputDir = browserEvidenceDirectory(state);
  fs.mkdirSync(outputDir, { recursive: true });
  const script = path.join(root, 'scripts/runtime/uat-isolated-admin-content-anonymous.cjs');
  const batch = String(state.replacementImages?.['admin-web'] || '').match(/batch\d+/u)?.[0] ?? 'batch13';
  const output = docker(['run', '--rm', '--network', state.project,
    '--label', `com.cloudstudy.uat.project=${state.project}`,
    '--mount', `type=bind,source=${script},target=/probe.cjs,readonly`,
    '--mount', `type=bind,source=${outputDir},target=/out`,
    '-e', 'NODE_PATH=/opt/uat/node_modules', '-e', `UAT_ADMIN_BATCH=${batch}`,
    '--entrypoint', 'node', browserImage, '/probe.cjs'],
  { output: true, timeout: 120000 });
  const summary = JSON.parse(output);
  record(state, 'admin-content-anonymous-probed', summary);
  console.log(`Admin content anonymous evidence: ${path.join(outputDir, `admin-content-anonymous-${batch}.json`)}`);
  console.log(JSON.stringify(summary));
}

function probeAdminGovernancePermissionsAnonymous(state) {
  validate(state);
  const browserImage = `cloudstudy-uat-isolated/browser:${state.project.slice(-10)}`;
  const present = docker(['image', 'ls', browserImage, '--format', '{{.Repository}}:{{.Tag}}'],
    { output: true });
  assert.equal(present, browserImage);
  const outputDir = browserEvidenceDirectory(state);
  fs.mkdirSync(outputDir, { recursive: true });
  const script = path.join(root, 'scripts/runtime/uat-isolated-admin-governance-permissions-anonymous.cjs');
  const batch = batchEvidenceSuffix(state.replacementImages).replace(/^-/, '') || 'batch14';
  const output = docker(['run', '--rm', '--network', state.project,
    '--label', `com.cloudstudy.uat.project=${state.project}`,
    '--mount', `type=bind,source=${script},target=/probe.cjs,readonly`,
    '--mount', `type=bind,source=${outputDir},target=/out`,
    '-e', 'NODE_PATH=/opt/uat/node_modules', '-e', `UAT_ADMIN_BATCH=${batch}`,
    '--entrypoint', 'node', browserImage, '/probe.cjs'],
  { output: true, timeout: 120000 });
  const summary = JSON.parse(output);
  assert.deepEqual(summary, {checks:4,loginRedirects:4,protectedViews:0,
    protectedApiRequests:0,horizontalOverflows:0,pageErrors:0,consoleErrors:0});
  record(state, 'admin-governance-permissions-anonymous-probed', summary);
  console.log(`Admin protected route evidence: ${path.join(outputDir,
    `admin-governance-permissions-anonymous-${batch}.json`)}`);
  console.log(JSON.stringify(summary));
}

function probeBatch15PublicGovernance(state) {
  assert.equal(state.project, 'cloudstudy-uat-isolated-3c94b27160');
  assert(state.replacementImages?.['official-site']?.includes('uat-batch15-'));
  validate(state);
  const browserImage = `cloudstudy-uat-isolated/browser:${state.project.slice(-10)}`;
  const present = docker(['image', 'ls', browserImage, '--format', '{{.Repository}}:{{.Tag}}'],
    { output: true });
  assert.equal(present, browserImage);
  const outputDir = path.join(root, 'artifacts/uat-2026-09-23/docker-isolated-browser-batch15');
  fs.mkdirSync(outputDir, { recursive: true });
  const script = path.join(root, 'scripts/runtime/uat-isolated-batch15-public-governance.cjs');
  const output = docker(['run', '--rm', '--network', state.project,
    '--label', `com.cloudstudy.uat.project=${state.project}`,
    '--mount', `type=bind,source=${script},target=/probe.cjs,readonly`,
    '--mount', `type=bind,source=${outputDir},target=/out`,
    '-e', 'NODE_PATH=/opt/uat/node_modules', '--entrypoint', 'node', browserImage,
    '/probe.cjs'], { output: true, timeout: 180000 });
  const summary = JSON.parse(output);
  record(state, 'batch15-public-governance-probed', summary);
  console.log(`Batch15 public/governance evidence: ${path.join(outputDir,
    'batch15-public-governance.json')}`);
  console.log(JSON.stringify(summary));
}

function snapshotRuntime(state) {
  validate(state);
  const ids = docker(['ps', '-a', '--filter', `label=com.docker.compose.project=${state.project}`,
    '--format', '{{.ID}}'], { output: true }).split(/\r?\n/u).filter(Boolean);
  assert.equal(ids.length, 26);
  const inspected = JSON.parse(docker(['inspect', ...ids], { output: true }));
  const containers = inspected.map((item) => {
    assert.equal(item.Config.Labels['com.docker.compose.project'], state.project);
    assert.deepEqual(Object.keys(item.NetworkSettings.Networks), [state.project]);
    assert.deepEqual(item.HostConfig.PortBindings || {}, {});
    return {
      name: item.Name.slice(1), service: item.Config.Labels['com.docker.compose.service'],
      id: item.Id, imageId: item.Image,
      status: item.State.Status, exitCode: item.State.ExitCode,
      health: item.State.Health?.Status ?? null
    };
  }).sort((a, b) => a.service.localeCompare(b.service));
  const proxyName = `${state.project}-https-proxy`;
  const proxy = JSON.parse(docker(['inspect', proxyName], { output: true }))[0];
  assert.equal(proxy.Config.Labels['com.cloudstudy.uat.project'], state.project);
  assert.deepEqual(Object.keys(proxy.NetworkSettings.Networks), [state.project]);
  assert.deepEqual(proxy.HostConfig.PortBindings || {}, {});
  const sharedAfter = baseline();
  assert.deepEqual(sharedAfter, state.sharedBefore);
  const result = {
    at: new Date().toISOString(), project: state.project,
    privateNetwork: state.project, publishedHostPorts: 0,
    volumes: volumeKeys.map((key) => `${state.project}-${key.replace('clyunedev-', '')}`),
    sharedFingerprintSha256: crypto.createHash('sha256')
      .update(JSON.stringify(state.sharedBefore)).digest('hex'),
    containers, proxy: { name: proxyName, id: proxy.Id, imageId: proxy.Image,
      status: proxy.State.Status },
    sharedUnchanged: true
  };
  const evidenceFile = batchEvidenceFilePath(state, 'docker-isolated-runtime-state.json');
  fs.writeFileSync(evidenceFile, `${JSON.stringify(result, null, 2)}\n`);
  record(state, 'isolated-runtime-state-recorded', {
    running: containers.filter((item) => item.status === 'running').length,
    exitedZero: containers.filter((item) => item.status === 'exited' && item.exitCode === 0).length,
    sharedUnchanged: true
  });
  console.log(`Runtime state: ${evidenceFile}`);
}

function cleanup(state) {
  validate(state);
  assert(state.project.startsWith('cloudstudy-uat-isolated-'));
  const proxyName = `${state.project}-https-proxy`;
  const proxy = docker(['ps', '-a', '--filter', `name=^/${proxyName}$`, '--format', '{{.Names}}'], { output: true });
  if (proxy) {
    const inspected = JSON.parse(docker(['inspect', proxyName], { output: true }))[0];
    assert.equal(inspected.Config.Labels['com.cloudstudy.uat.project'], state.project);
    assert.deepEqual(Object.keys(inspected.NetworkSettings.Networks), [state.project]);
    docker(['rm', '-f', proxyName]);
  }
  compose(state, ['down', '--volumes'], { timeout: 600000 });
  const networks = docker(['network', 'ls', '--format', '{{.Name}}'], { output: true }).split(/\r?\n/u);
  const volumes = docker(['volume', 'ls', '--format', '{{.Name}}'], { output: true }).split(/\r?\n/u);
  assert(!networks.includes(state.project));
  for (const suffix of ['mysql', 'redis', 'minio', 'kafka']) assert(!volumes.includes(`${state.project}-${suffix}`));
  assert.deepEqual(baseline(), state.sharedBefore);
  const browserImage = `cloudstudy-uat-isolated/browser:${state.project.slice(-10)}`;
  const present = docker(['image', 'ls', browserImage, '--format', '{{.Repository}}:{{.Tag}}'], { output: true });
  if (present === browserImage) docker(['image', 'rm', browserImage]);
  record(state, 'isolated-containers-network-volumes-removed');
}

export function main() {
  try {
    if (command === 'prepare') prepare();
    else if (command === 'validate') validate(readState(), { fresh: process.argv[4] === '--fresh' });
    else if (command === 'run') runStack(readState());
    else if (command === 'probe') probe(readState());
    else if (command === 'probe-api') probeApi(readState());
    else if (command === 'probe-browser') probeBrowser(readState());
    else if (command === 'probe-db') probeDatabase(readState());
    else if (command === 'probe-registration') probeRegistrationBoundary(readState());
    else if (command === 'prepare-login-fixture') prepareLoginFixture(readState());
    else if (command === 'use-iam-candidate') useIamCandidate(readState(), process.argv[4]);
    else if (command === 'use-release-candidates') useReleaseCandidates(readState(), process.argv[4]);
    else if (command === 'use-mobile-candidate') useMobileCandidate(readState(), process.argv[4]);
    else if (command === 'use-learner-mobile-candidates') useLearnerMobileCandidates(readState(), process.argv[4]);
    else if (command === 'use-content-admin-mobile-candidates') useContentAdminMobileCandidates(readState(), process.argv[4]);
    else if (command === 'use-batch14-candidates') useBatch14Candidates(readState(), process.argv[4]);
    else if (command === 'use-batch15-candidates') useBatch15Candidates(readState(), process.argv[4]);
    else if (command === 'use-batch16-candidates') useBatch16Candidates(readState(), process.argv[4]);
    else if (command === 'use-batch17-candidates') useBatch17Candidates(readState(), process.argv[4]);
    else if (command === 'backup-batch16-before-migration') backupBatch16BeforeMigration(readState());
    else if (command === 'drain-batch16-writers') drainBatch16Writers(readState());
    else if (command === 'preflight-batch16-migration') runBatch16MigrationStep(readState(), 'preflight');
    else if (command === 'apply-batch16-migration') runBatch16MigrationStep(readState(), 'apply');
    else if (command === 'verify-batch16-migration') verifyBatch16Migration(readState());
    else if (command === 'restore-batch16-non-target-owners') restoreBatch16NonTargetOwners(readState());
    else if (command === 'apply-batch16-after-migration') applyBatch16AfterMigration(readState());
    else if (command === 'probe-iam-atomicity') probeAtomicity(readState());
    else if (command === 'probe-iam-jdbc-refresh-rollback') probeJdbcRefreshRollback(readState());
    else if (command === 'probe-offline-gateway') probeOfflineGateway(readState());
    else if (command === 'probe-b3-b9-anonymous') probeB3B9Anonymous(readState());
    else if (command === 'probe-b4-anonymous') probeB4Anonymous(readState());
    else if (command === 'probe-mobile-runtime') probeMobileRuntime(readState());
    else if (command === 'probe-mobile-journey') probeMobileJourney(readState());
    else if (command === 'probe-learner-b11-anonymous') probeLearnerB11Anonymous(readState());
    else if (command === 'probe-admin-content-anonymous') probeAdminContentAnonymous(readState());
    else if (command === 'probe-admin-governance-permissions-anonymous') probeAdminGovernancePermissionsAnonymous(readState());
    else if (command === 'probe-batch15-public-governance') probeBatch15PublicGovernance(readState());
    else if (command === 'snapshot') snapshotRuntime(readState());
    else if (command === 'cleanup') cleanup(readState());
    else throw new Error('usage: node uat-isolated-compose.mjs <prepare|validate|run|use-batch16-candidates|use-batch17-candidates|backup-batch16-before-migration|drain-batch16-writers|preflight-batch16-migration|apply-batch16-migration|verify-batch16-migration|restore-batch16-non-target-owners|apply-batch16-after-migration|probe|probe-api|probe-browser|probe-db|probe-registration|cleanup> [state.json]');
  } catch (error) {
    console.error(`Isolated UAT stopped: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
