// R1-002 prep-4 TLS 预检（修正版）：
// 相对 tls-preflight-3 的修正（reviewer-2-prep review.md §2/§3）：
// 1) 不再检查 cookie-secure YAML 默认值（那不是有效配置证明）；Secure 的有效配置由
//    启动器显式 --iam.jwt.refresh-cookie-secure=true + 运行中 /actuator 有效配置核验；
// 2) 本脚本只做 TLS 连接 + 健康 + JWKS GET（HTTPS + 显式测试证书 pin，验证 ON）；
// 3) 输出到 tls-preflight-4.json（独立文件，不覆盖旧证据）。
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const tls = require('node:tls');
const https = require('node:https');

const dir = __dirname;
const outDir = path.join(dir, 'tls-4');
fs.mkdirSync(outDir, { recursive: true });
// 公开证书（证据保留的 .pem）作为显式信任；私钥容器已在受控目录，不在这里读取。
const pem = fs.readFileSync(path.join(dir, 't3-tls', 'r1-002.pem'), 'utf8');
const out = { checkedAt: new Date().toISOString(), scope: 'own-isolated-iam-18087', checks: [], failed: [] };
function check(name, fn) {
  try { const d = fn(); out.checks.push({ name, result: 'PASS', detail: d || null }); console.log('CHECK-PASS:' + name); }
  catch (e) { out.checks.push({ name, result: 'FAIL', error: String(e.message || e).slice(0, 300) }); out.failed.push(name); console.error('CHECK-FAIL:' + name + ' ' + String(e.message || e).slice(0, 300)); }
}
function httpsGet(pathname) {
  return new Promise((resolve, reject) => {
    const req = https.request({ host: '127.0.0.1', port: 18087, path: pathname, method: 'GET', ca: [pem], timeout: 15000 }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}
(async () => {
  const assert = require('node:assert/strict');
  const expectedSha256 = '8A:D2:F6:24:00:0C:B3:9F:FB:DE:C2:FF:D4:BE:8D:C0:9C:04:2C:F3:A5:06:B4:00:00:6F:F7:14:CA:FF:A1:37';
  const pinSock = tls.connect({ host: '127.0.0.1', port: 18087, ca: [pem], timeout: 15000 });
  const peer = await new Promise((resolve, reject) => {
    pinSock.on('secureConnect', () => { const c = pinSock.getPeerCertificate(true); pinSock.end(); resolve(c); });
    pinSock.on('error', reject);
  });
  check('tls-cert-pin', () => {
    assert.equal(String(peer.fingerprint256 || ''), expectedSha256, 'pin mismatch');
    assert.ok(String(peer.subjectaltname || '').includes('127.0.0.1'), 'SAN mismatch');
    return { fp256: peer.fingerprint256, san: peer.subjectaltname };
  });
  const sock = tls.connect({
    host: '127.0.0.1', port: 18087, ca: [pem], timeout: 15000,
    checkServerIdentity: (host, cert) => {
      if (String(cert.fingerprint256 || '') !== expectedSha256) return new Error('cert pin mismatch');
      return undefined;
    },
  });
  const hs = await new Promise((resolve, reject) => {
    sock.on('secureConnect', () => resolve({ authorized: sock.authorized, authError: sock.authorizationError, protocol: sock.getProtocol(), cipher: sock.getCipher()?.name, pinnedFp: expectedSha256 }));
    sock.on('error', reject);
    sock.on('timeout', () => reject(new Error('tls-timeout')));
  });
  check('tls-handshake-verified', () => { assert.equal(hs.authorized, true, 'unauthorized: ' + hs.authError); return hs; });
  sock.end();
  const h = await httpsGet('/actuator/health/readiness');
  check('health-status', () => { assert.equal(h.status, 200, 'health=' + h.status); return { status: h.status }; });
  const jwks = await httpsGet('/api/v1/auth/jwks');
  const jb = JSON.parse(jwks.body);
  const jwksKeys = jb.keys || jb.data?.keys || [];
  check('jwks-get', () => { assert.equal(jwks.status, 200); assert.ok(Array.isArray(jwksKeys) && jwksKeys.length > 0, 'no keys'); return { keys: jwksKeys.length }; });
  out.jwksKids = jwksKeys.map((k) => k.kid);
  fs.writeFileSync(path.join(outDir, 'tls-preflight-4.json'), JSON.stringify({ ...out, jwksKids: out.jwksKids }, null, 2));
  // 有效 Secure 配置核验放到运行中 /actuator 核验脚本（config-check-4），不在本文件读 YAML 默认值。
  if (out.failed.length) { console.error('TLS-PREFLIGHT-4: FAIL'); process.exit(1); }
  console.log('TLS-PREFLIGHT-4: PASS kids=' + JSON.stringify(out.jwksKids));
})().catch((e) => { console.error('FAIL:' + (e.stack || e.message)); process.exit(1); });
