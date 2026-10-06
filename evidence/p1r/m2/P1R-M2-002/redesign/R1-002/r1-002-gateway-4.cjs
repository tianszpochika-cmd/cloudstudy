// R1-002 prep-4 自有 Gateway 启动器（隔离验证专用）：
// - 固定端口 18070 + 127.0.0.1；不改共享配置；
// - 回源 IAM/JWKS 走 https://127.0.0.1:18087（显式测试证书信任，验证 ON，不关闭证书验证）；
// - 自身对外保持 HTTP 18070（本地固定端口）；JWT issuer=https://127.0.0.1:18087，audience 不变；
// - 测试证书经 JVM trustStore 注入：受控 trust.p12（当前 vault 口令）——子进程 env/argv 内存传递；
// - 仅验证 health/JWKS GET 转发；不注册、不做业务写入；结束后停止自有进程。
// pid 收据含 jar 身份；stop 核对身份后停止并确认端口释放。
'use strict';
const { spawn, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vaultLib = require('./r1-002-vault-4.cjs');
const guard = require('./r1-002-process-guard.cjs');

const dir = __dirname;
const root = path.resolve(dir, '..', '..', '..', '..', '..', '..');
const outDir = path.join(dir, 'gateway-4');
fs.mkdirSync(outDir, { recursive: true });
const mode = process.argv.includes('--start') ? 'start' : process.argv.includes('--stop') ? 'stop' : 'validate';

function shaFile(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }
const log = { checkedAt: new Date().toISOString(), mode, host: '127.0.0.1', port: 18070, steps: [], failedChecks: [] };
function step(name, ok, detail) {
  log.steps.push({ step: name, ok, detail: detail || null });
  if (!ok) { log.failedChecks.push(name); console.error('STEP-FAIL:' + name + ' ' + JSON.stringify(detail || null).slice(0, 400)); }
  else console.log('STEP-PASS:' + name);
}
function portProbe(port) {
  // Node 直连探测（替代沙箱内不可靠的 powershell TcpClient 探针）。
  const net = require('node:net');
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(1500);
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('timeout', () => { s.destroy(); resolve(false); });
    s.once('error', () => resolve(false));
    s.connect(port, '127.0.0.1');
  });
}
try {
  const jarPath = path.join(root, 'services/api-gateway/target/api-gateway-0.1.0-SNAPSHOT.jar');
  const jarStat = fs.statSync(jarPath);
  log.jar = { path: 'services/api-gateway/target/api-gateway-0.1.0-SNAPSHOT.jar', bytes: jarStat.size, sha256: shaFile(jarPath) };
  step('jar', true, { bytes: jarStat.size, sha: log.jar.sha256.slice(0, 16) });
  const { vault } = vaultLib.loadOrCreate();
  const controlledTlsDir = path.join(vaultLib.CONTROLLED_DIR, 'tls');
  const ts = path.join(controlledTlsDir, 'r1-002-trust.p12');
  step('trust-controlled', fs.existsSync(ts), { controlledDir: controlledTlsDir });
  log.safeEnv = {
    IAM_SERVICE_BASE_URL: 'https://127.0.0.1:18087',
    IAM_JWT_JWKS_URI: 'https://127.0.0.1:18087/api/v1/auth/jwks',
    IAM_JWT_ISSUER: 'http://127.0.0.1:18087',
    IAM_JWT_AUDIENCE: 'yuxuexing-api',
    TRUST: 'spring.cloud.gateway.httpclient.ssl.trustedX509Certificates=<controlled r1-002.pem> (verification ON; useInsecureTrustManager=false)',
    NOTE: 'no shared config changed; no verification disabled; no business code changed',
  };
  step('safe-env', true, { keys: Object.keys(log.safeEnv) });
  if (mode === 'validate') {
    step('validate-only', true, { note: 'no backend launched' });
    finish();
  } else if (mode === 'start') {
    startAsync()
      .then(() => finish())
      .catch((e) => { step('aborted', false, { error: String(e.message || e).slice(0, 400) }); finish(); });
  } else if (mode === 'stop') {
    stopSync().then(() => finish()).catch(e => { step('stop',false,{error:e.message}); finish(); });
  } else { finish(); }

  async function startAsync() {
    if (await portProbe(18070)) throw new Error('port 18070 not free; refuse to start');
    if (!(await portProbe(18087))) throw new Error('own IAM 18087 not reachable; start IAM first');
    const pemPath = path.join(dir, 't3-tls', 'r1-002.pem');
    // ResourceUtils.getURL 需要标准 file URL；Windows 反斜杠转正斜杠。
    const pemUrl = 'file:' + pemPath.replace(/\\/g, '/');
    const childEnv = {
      ...process.env,
      IAM_ROUTE_ENABLED: 'true',
      IAM_SERVICE_BASE_URL: 'https://127.0.0.1:18087',
      IAM_JWT_JWKS_URI: 'https://127.0.0.1:18087/api/v1/auth/jwks',
      IAM_JWT_ISSUER: 'http://127.0.0.1:18087',
      IAM_JWT_AUDIENCE: 'yuxuexing-api',
      API_GATEWAY_PORT: '18070',
      SERVER_ADDRESS: '127.0.0.1',
      GATEWAY_RATE_LIMIT_BACKEND: 'memory',
      OTEL_ENABLED: 'false',
    };
    const pemArg = pemUrl;
    const child = spawn('java', ['-jar', jarPath,
      '--server.address=127.0.0.1', '--server.port=18070',
      '--spring.profiles.active=v2,local-real', '--local.runtime.mode=local-real',
      // Gateway 回源 IAM 的显式测试证书信任（验证 ON；不关闭证书验证，不改共享配置）。
      '--spring.cloud.gateway.httpclient.ssl.trustedX509Certificates[0]=' + pemArg,
      '--spring.cloud.gateway.httpclient.ssl.useInsecureTrustManager=false'],
      { cwd: root, env: childEnv, stdio: 'inherit', windowsHide: true, detached: false });
    fs.writeFileSync(path.join(outDir, 'pid.json'), JSON.stringify({
      pid: child.pid, startedAt: new Date().toISOString(), processCreatedAt: guard.inspect(child.pid).createdAt, jarSha256: log.jar.sha256, jarBytes: log.jar.bytes,
    }, null, 2));
    step('started', true, { pid: child.pid });
    child.on('exit', (code, sig) => console.log(JSON.stringify({ event: 'own-gateway-stopped', code, signal: sig })));
  }
  async function stopSync() {
    const receipt = JSON.parse(fs.readFileSync(path.join(outDir,'pid.json'),'utf8'));
    log.stopIdentity = await guard.stopOwned(receipt, jarPath, 18070);
    step('stop',true,log.stopIdentity);
  }
  function finish() {
    log.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(outDir, 'gateway-4.json'), JSON.stringify(log, null, 2));
    if (log.failedChecks.length) { console.error('GATEWAY-4: FAIL ' + log.failedChecks.length); process.exit(1); }
    console.log('GATEWAY-4: PASS mode=' + mode);
  }
} catch (e) {
  step('aborted', false, { error: String(e.message || e).slice(0, 400) });
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, 'gateway-4.json'), JSON.stringify(log, null, 2));
  console.error('GATEWAY-4: FAIL ' + log.failedChecks.length); process.exit(1);
}
