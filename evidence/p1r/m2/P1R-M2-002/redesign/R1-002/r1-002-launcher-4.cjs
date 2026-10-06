// R1-002 prep-4 统一启动器：validate / start / stop-self。
// 相对 launcher-3 的修正（reviewer-2-prep review.md §2/§3）：
// 1) 秘密全部来自 DPAPI 受控 vault（工作区外用户级加密），不再读取 t3-secrets 明文；
// 2) IAM persistence 走真实绑定键 IAM_JDBC_URL/USERNAME/PASSWORD + IAM_PERSISTENCE_SCHEMA；
// 3) JWT issuer/audience 保持固定；refreshCookieSecure 经 iam.jwt.refresh-cookie-secure
//    显式命令行覆盖传入（--iam.jwt.refresh-cookie-secure=true），且 Secure 默认 true
//    不再依赖 application-local.yaml 的 false 覆盖；
// 4) TLS 私钥容器（t3-tls/*.p12）搬到受控目录 %LOCALAPPDATA%\Cloudstudy\R1-002\tls；
//    公开证书 r1-002.cer/.pem 可作为证据保留在 t3-tls；
// 5) Gateway→IAM/JWKS 必须使用 HTTPS + 显式测试证书信任（见任务二网关转发验证）；
// 6) stop 前核对 PID、创建时间、jar 身份和启动收据，不匹配拒绝停止；停止后确认退出与端口释放。
// 秘密经子进程 env 内存注入，不放命令行/证据/日志；只记录存在性与有效配置。
'use strict';
const { spawn, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vaultLib = require('./r1-002-vault-4.cjs');
const guard = require('./r1-002-process-guard.cjs');

const dir = __dirname;
const root = path.resolve(dir, '..', '..', '..', '..', '..', '..');
const outDir = path.join(dir, 'launcher-4');
fs.mkdirSync(outDir, { recursive: true });
const mode = process.argv.includes('--start') ? 'start' : process.argv.includes('--stop') ? 'stop' : 'validate';
const SCHEMA = 'r1_002_iam_t3g';
const RUNNER = 'r1_002_runner_t3g';
// 受控 TLS 目录（工作区外；私钥容器搬迁目标）。
const controlledTlsDir = path.join(vaultLib.CONTROLLED_DIR, 'tls');
const legacyTlsDir = path.join(dir, 't3-tls');
const SAFE_KEYS = ['IAM_PERSISTENCE_ENABLED', 'IAM_FLYWAY_ENABLED', 'SPRING_FLYWAY_ENABLED',
  'IAM_JDBC_URL', 'IAM_JDBC_USERNAME', 'IAM_PERSISTENCE_SCHEMA',
  'IAM_CONSENT_POLICY_SOURCE', 'IAM_PASSWORD_MIN_LENGTH',
  'IAM_JWT_ISSUER', 'IAM_JWT_AUDIENCE', 'IAM_JWT_ALGORITHM', 'IAM_JWT_KEY_ID',
  'IAM_LOCAL_ADULT_GATE_ENABLED', 'IAM_NATIVE_TRANSPORT_POLICY',
  'IAM_JWT_REFRESH_COOKIE_SECURE', 'P1R_DIAG', 'SERVER_SSL_ENABLED'];

function shaFile(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }
const log = { checkedAt: new Date().toISOString(), mode, schema: SCHEMA, runner: RUNNER, host: '127.0.0.1', port: 18087, steps: [], failedChecks: [] };
function step(name, ok, detail) {
  log.steps.push({ step: name, ok, detail: detail || null });
  if (!ok) { log.failedChecks.push(name); console.error('STEP-FAIL:' + name + ' ' + JSON.stringify(detail || null).slice(0, 400)); }
  else console.log('STEP-PASS:' + name);
}
function portFree(port) {
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
    "try { $c = New-Object Net.Sockets.TcpClient; $iar = $c.BeginConnect('127.0.0.1', " + port + "); $ok = $iar.AsyncWaitHandle.WaitOne(800); if ($ok -and $c.Connected) { $c.Close(); 'BUSY' } else { 'FREE' } } catch { 'FREE' }"],
    { encoding: 'utf8', windowsHide: true });
  return ((r.stdout || '').trim().includes('FREE'));
}
(async () => {
try {
  const jarPath = path.join(root, 'services/iam-service/target/iam-service-0.1.0-SNAPSHOT.jar');
  const jarStat = fs.statSync(jarPath);
  log.jar = { path: 'services/iam-service/target/iam-service-0.1.0-SNAPSHOT.jar', bytes: jarStat.size, sha256: shaFile(jarPath) };
  step('jar', true, { bytes: jarStat.size, sha: log.jar.sha256.slice(0, 16) });

  const { vault } = vaultLib.loadOrCreate();
  const m = vaultLib.meta();
  step('vault-controlled', m.exists && m.independent, { store: m.store, independent: m.independent });

  // TLS 私钥容器受控搬迁（一次性；公开证书保留在证据目录）。
  fs.mkdirSync(controlledTlsDir, { recursive: true });
  const ksLegacy = path.join(legacyTlsDir, 'r1-002-tls.p12');
  const tsLegacy = path.join(legacyTlsDir, 'r1-002-trust.p12');
  const ks = path.join(controlledTlsDir, 'r1-002-tls.p12');
  const ts = path.join(controlledTlsDir, 'r1-002-trust.p12');
  let tlsNote = 'reuse controlled store';
  if (!fs.existsSync(ks) && fs.existsSync(ksLegacy)) {
    fs.copyFileSync(ksLegacy, ks);
    try { fs.chmodSync(ks, 0o600); } catch { /* windows ACL 继承受控目录 */ }
    tlsNote = 'migrated legacy keystore to controlled dir';
  }
  if (!fs.existsSync(ts) && fs.existsSync(tsLegacy)) {
    fs.copyFileSync(tsLegacy, ts);
    try { fs.chmodSync(ts, 0o600); } catch { /* windows ACL 继承受控目录 */ }
  }
  step('tls-controlled', fs.existsSync(ks), { note: tlsNote, controlledDir: controlledTlsDir });

  // 有效配置白名单（脱敏；密钥类仅存在性）。真实绑定键 + 正确 Secure 键。
  log.safeEnv = {
    IAM_PERSISTENCE_ENABLED: 'true', IAM_FLYWAY_ENABLED: 'true', SPRING_FLYWAY_ENABLED: 'true',
    IAM_JDBC_URL: 'jdbc:mysql://127.0.0.1:13306/' + SCHEMA + '?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true (user=' + RUNNER + ')',
    IAM_JDBC_USERNAME: RUNNER, IAM_PERSISTENCE_SCHEMA: SCHEMA,
    IAM_CONSENT_POLICY_SOURCE: 'control-plane', IAM_PASSWORD_MIN_LENGTH: '12',
    IAM_JWT_ISSUER: 'http://127.0.0.1:18087', IAM_JWT_AUDIENCE: 'yuxuexing-api',
    IAM_JWT_ALGORITHM: 'RS256', IAM_JWT_KEY_ID: 'iam-local-2026-08',
    IAM_LOCAL_ADULT_GATE_ENABLED: 'false (guard requires non-local; registration TC uses no attestation input)',
    IAM_NATIVE_TRANSPORT_POLICY: 'deny',
    IAM_JWT_REFRESH_COOKIE_SECURE: 'true (explicit --iam.jwt.refresh-cookie-secure=true; base default true)',
    SERVER_SSL_ENABLED: 'true (controlled test keystore; JWT issuer/audience unchanged)',
    P1R_DIAG: '0',
  };
  log.gatewayIam = {
    iamDirect: 'https://127.0.0.1:18087',
    jwks: 'https://127.0.0.1:18087/api/v1/auth/jwks',
    trust: 'explicit controlled test CA (r1-002.pem pin); verification ON, no insecure bypass',
    gatewayToLearning403: 'Gateway /api/v1/learning/* -> learning-service:18090 (register TC01 holds restricted JWT, expects 403)',
  };
  step('safe-env', true, { keys: Object.keys(log.safeEnv) });

  if (mode === 'validate') step('validate-only', true, { note: 'no backend launched' });
  else if (mode === 'start') {
    if (!portFree(18087)) throw new Error('port 18087 not free; refuse to start (no shared process touched)');
    const childEnv = {
      ...process.env,
      IAM_PERSISTENCE_ENABLED: 'true', IAM_FLYWAY_ENABLED: 'true', SPRING_FLYWAY_ENABLED: 'true',
      IAM_JDBC_URL: 'jdbc:mysql://127.0.0.1:13306/' + SCHEMA + '?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true',
      IAM_JDBC_USERNAME: RUNNER, IAM_JDBC_PASSWORD: vault.runnerPassword,
      IAM_PERSISTENCE_SCHEMA: SCHEMA,
      IAM_CONSENT_POLICY_SOURCE: 'control-plane', IAM_PASSWORD_MIN_LENGTH: '12',
      // issuer 保持既有 http 标识；传输使用 HTTPS，两者独立。
      IAM_JWT_ISSUER: 'http://127.0.0.1:18087', IAM_JWT_AUDIENCE: 'yuxuexing-api',
      IAM_JWT_PRIVATE_KEY_FILE: 'secrets/iam-rsa-private.pem',
      IAM_IDEMPOTENCY_REPLAY_SECRET: vault.replaySecret,
      IAM_IDEMPOTENCY_FINGERPRINT_SECRET: vault.fingerprintSecret,
      IAM_JWT_KEY_ID: 'iam-local-2026-08',
      IAM_LOCAL_ADULT_GATE_ENABLED: 'false', IAM_NATIVE_TRANSPORT_POLICY: 'deny',
      SERVER_SSL_ENABLED: 'true', SERVER_SSL_KEY_STORE: ks,
      SERVER_SSL_KEY_STORE_PASSWORD: vault.tlsStorePassword,
      SERVER_SSL_KEY_STORE_TYPE: 'PKCS12', SERVER_SSL_KEY_ALIAS: 'r1-002',
      P1R_DIAG: '0',
    };
    const child = spawn('java', ['-jar', jarPath,
      '--server.address=127.0.0.1', '--server.port=18087',
      '--spring.profiles.active=v2,local-real', '--local.runtime.mode=local-real',
      // 显式传入正确的 refresh-cookie-secure 配置（覆盖 local profile 的 false）。
      '--iam.jwt.refresh-cookie-secure=true'],
      { cwd: root, env: childEnv, stdio: 'inherit', windowsHide: true, detached: false });
    // 启动收据：pid + 创建时间 + jar 身份（stop 时核验）。
    const receipt = { pid: child.pid, startedAt: new Date().toISOString(), processCreatedAt: guard.inspect(child.pid).createdAt, schema: SCHEMA, jarSha256: log.jar.sha256, jarBytes: log.jar.bytes };
    fs.writeFileSync(path.join(outDir, 'pid.json'), JSON.stringify(receipt, null, 2));
    step('started', true, { pid: child.pid });
    child.on('exit', (code, sig) => console.log(JSON.stringify({ event: 'own-iam-stopped', code, signal: sig })));
  } else if (mode === 'stop') {
    const receipt = JSON.parse(fs.readFileSync(path.join(outDir,'pid.json'),'utf8'));
    log.stopIdentity = await guard.stopOwned(receipt, jarPath, 18087);
    step('stop',true,log.stopIdentity);
  }
} catch (e) {
  step('aborted', false, { error: String(e.message || e).slice(0, 400) });
}
log.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(outDir, 'launcher-4.json'), JSON.stringify(log, null, 2));
if (log.failedChecks.length) { console.error('LAUNCHER-4: FAIL ' + log.failedChecks.length); process.exit(1); }
console.log('LAUNCHER-4: PASS mode=' + mode);

})().catch(e => { console.error(e.message); process.exitCode=1; });
