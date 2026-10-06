// R1-002 prep-4 运行中有效配置核验（独立输出，不覆盖旧证据）。
// 核验自有隔离 IAM（18087 HTTPS）：
// 1) /actuator/health/readiness 200（显式测试证书信任，验证 ON）；
// 2) /api/v1/auth/jwks 200 且 kid 列表非空；
// 3) /actuator/env 或 /actuator/configprops 中 iam.jwt.refresh-cookie-secure 有效值为 true
//   （显式 --iam.jwt.refresh-cookie-secure=true 生效证明；不是读 YAML 默认值）；
//    若 env 端点未暴露，如实记录 NOT_EXPOSED，并以启动器 argv 收据 + 进程 env  presence 作为
//    次级证据（仍不等同 READY 后 Set-Cookie 验收；注册 Set-Cookie 留到 READY 后）。
// 4) 自有 Gateway（18070）公开 JWKS 转发 GET 可达（仅转发连通性；不提前注册）。
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const dir = __dirname;
const outDir = path.join(dir, 'config-check-4');
fs.mkdirSync(outDir, { recursive: true });
const pem = fs.readFileSync(path.join(dir, 't3-tls', 'r1-002.pem'), 'utf8');
const out = { checkedAt: new Date().toISOString(), scope: 'own-isolated-iam-18087+gateway-18070', checks: [], failed: [] };
function check(name, fn) {
  try { const d = fn(); out.checks.push({ name, result: 'PASS', detail: d || null }); console.log('CHECK-PASS:' + name); }
  catch (e) { out.checks.push({ name, result: 'FAIL', error: String(e.message || e).slice(0, 300) }); out.failed.push(name); console.error('CHECK-FAIL:' + name + ' ' + String(e.message || e).slice(0, 300)); }
}
function httpsGet(port, pathname) {
  return new Promise((resolve, reject) => {
    const opts = { host: '127.0.0.1', port, path: pathname, method: 'GET', timeout: 15000 };
    if (port === 18087) opts.ca = [pem];
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: body.slice(0, 8000) }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}
function httpGet(port, pathname) {
  return new Promise((resolve, reject) => {
    const http = require('node:http');
    const req = http.request({ host: '127.0.0.1', port, path: pathname, method: 'GET', timeout: 15000 }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: body.slice(0, 8000) }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}
(async () => {
  const assert = require('node:assert/strict');
  const h = await httpsGet(18087, '/actuator/health/readiness');
  check('iam-health-https', () => { assert.equal(h.status, 200, 'health=' + h.status); return { status: h.status }; });
  const j = await httpsGet(18087, '/api/v1/auth/jwks');
  const jb = JSON.parse(j.body);
  const keys = jb.keys || jb.data?.keys || [];
  check('iam-jwks-https', () => { assert.equal(j.status, 200); assert.ok(keys.length > 0, 'no keys'); return { keys: keys.length, kids: keys.map((k) => k.kid) }; });
  out.jwksKids = keys.map((k) => k.kid);
  // Secure 有效值核验：优先 /actuator/env（运行中生效值）。
  let secureEvidence = { source: null, value: null };
  try {
    const env = await httpsGet(18087, '/actuator/env/iam.jwt.refresh-cookie-secure');
    if (env.status === 200) {
      const ej = JSON.parse(env.body);
      const selected=ej.property?.value;
      secureEvidence={source:'/actuator/env selected property',value:selected === true || selected === 'true' ? true : selected === false || selected === 'false' ? false : 'UNKNOWN'};
    } else {
      secureEvidence = { source: '/actuator/env', value: 'NOT_EXPOSED', status: env.status };
    }
  } catch (e) {
    secureEvidence = { source: '/actuator/env', value: 'NOT_EXPOSED', error: String(e.message || e).slice(0, 120) };
  }
  // 次级：/actuator/configprops
  if (secureEvidence.value === 'NOT_EXPOSED') {
    try {
      const cp = await httpsGet(18087, '/actuator/configprops');
      if (cp.status === 200) {
        const contexts=JSON.parse(cp.body).contexts||{};
        const values=Object.values(contexts).flatMap(c=>Object.values(c.beans||{})).filter(b=>b.prefix==='iam').map(b=>b.properties?.jwt?.refreshCookieSecure).filter(v=>typeof v==='boolean');
        secureEvidence={source:'/actuator/configprops iam.jwt',value:values.length===1?values[0]:'UNKNOWN'};
      } else {
        secureEvidence = { source: '/actuator/configprops', value: 'NOT_EXPOSED', status: cp.status };
      }
    } catch (e) {
      secureEvidence = { source: '/actuator/configprops', value: 'NOT_EXPOSED', error: String(e.message || e).slice(0, 120) };
    }
  }
  out.secureEvidence = secureEvidence;
  check('refresh-cookie-secure-effective', () => {
    assert.equal(secureEvidence.value, true, 'secure not proven effective: ' + JSON.stringify(secureEvidence).slice(0, 200));
    return secureEvidence;
  });
  // 自有 Gateway 公开 JWKS 转发（Gateway 走 HTTPS 回源 IAM；验证 ON）。
  // Gateway 自身对外是 HTTP 18070（本地固定端口），回源 IAM 用 HTTPS + 显式信任。
  try {
    const g = await httpGet(18070, '/api/v1/auth/jwks');
    const gjb = JSON.parse(g.body);
    const gkeys = gjb.keys || gjb.data?.keys || [];
    check('gateway-jwks-forward', () => { assert.equal(g.status, 200); assert.ok(gkeys.length > 0, 'no keys'); return { status: g.status, keys: gkeys.length, kids: gkeys.map((k) => k.kid) }; });
  } catch (e) {
    check('gateway-jwks-forward', () => { throw new Error('gateway forward failed: ' + String(e.message || e).slice(0, 160)); });
  }
  fs.writeFileSync(path.join(outDir, 'config-check-4.json'), JSON.stringify(out, null, 2));
  if (out.failed.length) { console.error('CONFIG-CHECK-4: FAIL ' + JSON.stringify(out.failed)); process.exit(1); }
  console.log('CONFIG-CHECK-4: PASS');
})().catch((e) => { console.error('FAIL:' + (e.stack || e.message)); process.exit(1); });
