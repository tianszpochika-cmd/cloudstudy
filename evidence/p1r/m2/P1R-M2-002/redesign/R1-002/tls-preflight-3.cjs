const fs = require("node:fs");
const path = require("node:path");
const tls = require("node:tls");
const https = require("node:https");
const tlsDir = path.join(__dirname, "t3-tls");
// r1-002.pem：DER cer 的 PEM 转制（Node ca 要求 PEM；DER Buffer 会导致 ca 静默无效）。
// pin 仍以 keytool 实测指纹为准；https 不再设 rejectUnauthorized:false。
const pem = fs.readFileSync(path.join(tlsDir, "r1-002.pem"), "utf8");
const out = { checkedAt: new Date().toISOString(), checks: [], failed: [] };
function check(name, fn) {
  try { const d = fn(); out.checks.push({ name, result: "PASS", detail: d || null }); console.log("CHECK-PASS:" + name); }
  catch (e) { out.checks.push({ name, result: "FAIL", error: String(e.message || e).slice(0, 300) }); out.failed.push(name); console.error("CHECK-FAIL:" + name + " " + String(e.message || e).slice(0, 300)); }
}
function httpsGet(pathname, pinFp) {
  return new Promise((resolve, reject) => {
    // 真实验证：ca=[PEM] + 默认 rejectUnauthorized:true；pin 为第二道核对。
    const req = https.request({ host: "127.0.0.1", port: 18087, path: pathname, method: "GET",
      ca: [pem], timeout: 15000 }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    req.end();
  });
}
(async () => {
  const assert = require("node:assert/strict");
  // 证书 pin：peer 指纹/SAN 与 keytool 一致即信任（自签单证书场景；ca=[PEM]
  // 已做真实链验证，不再需要 rejectUnauthorized:false）。
  const expectedSha256 = "EC:EA:72:D9:2F:D5:AE:79:F8:54:66:CA:D9:D1:36:DD:2F:5F:CF:CA:88:22:11:CD:04:71:AA:DF:EE:54:BD:45";
  const pinSock = tls.connect({ host: "127.0.0.1", port: 18087, ca: [pem], timeout: 15000 });
  const peer = await new Promise((resolve, reject) => {
    pinSock.on("secureConnect", () => { const c = pinSock.getPeerCertificate(true); pinSock.end(); resolve(c); });
    pinSock.on("error", reject);
  });
  check("tls-cert-pin", () => {
    assert.equal(String(peer.fingerprint256 || ""), expectedSha256, "pin mismatch");
    assert.ok(String(peer.subjectaltname || "").includes("127.0.0.1"), "SAN mismatch");
    return { fp256: peer.fingerprint256, san: peer.subjectaltname };
  });
  // 真实握手验证：ca=[PEM] 生效时自签单证书应 authorized=true；如仍报
  // self-signed 则如实 FAIL（不再用 verified-by-pin 掩盖）。
  const sock = tls.connect({ host: "127.0.0.1", port: 18087, ca: [pem], timeout: 15000,
    checkServerIdentity: (host, cert) => {
      if (String(cert.fingerprint256 || "") !== expectedSha256) return new Error("cert pin mismatch");
      return undefined;
    } });
  const hs = await new Promise((resolve, reject) => {
    sock.on("secureConnect", () => resolve({ authorized: sock.authorized, authError: sock.authorizationError, protocol: sock.getProtocol(), cipher: sock.getCipher()?.name, pinnedFp: expectedSha256 }));
    sock.on("error", reject);
    sock.on("timeout", () => reject(new Error("tls-timeout")));
  });
  check("tls-handshake-verified", () => { assert.equal(hs.authorized, true, "unauthorized: " + hs.authError); return hs; });
  sock.end();
  const h = await httpsGet("/actuator/health/readiness", expectedSha256);
  check("health-status", () => { assert.equal(h.status, 200, "health=" + h.status); return { status: h.status }; });
  const jwks = await httpsGet("/api/v1/auth/jwks", expectedSha256);
  const jb = JSON.parse(jwks.body);
  const jwksKeys = jb.keys || jb.data?.keys || [];
  check("jwks-get", () => { assert.equal(jwks.status, 200); assert.ok(Array.isArray(jwksKeys) && jwksKeys.length > 0, "no keys"); return { keys: jwksKeys.length }; });
  out.jwksKids = jwksKeys.map((k) => k.kid);
  const appYaml = fs.readFileSync("services/iam-service/src/main/resources/application.yaml", "utf8");
  check("cookie-secure-default", () => { assert.ok(/refresh-cookie-secure:\s*true/.test(appYaml), "default not true"); return { def: true }; });
  fs.writeFileSync(path.join(__dirname, "tls-preflight-3.json"), JSON.stringify({ ...out, jwksKids: out.jwksKids }, null, 2));
  if (out.failed.length) { console.error("TLS-PREFLIGHT: FAIL"); process.exit(1); }
  console.log("TLS-PREFLIGHT: PASS kids=" + JSON.stringify(out.jwksKids));
})().catch((e) => { console.error("FAIL:" + (e.stack || e.message)); process.exit(1); });
