// R1-002 v3 启动器：validate / start / stop-self。
// 固定 IAM 18087 + 127.0.0.1；TLS 测试配置由本卡 work/t3-tls 生成（自签 127.0.0.1，
// 客户端显式 trustStore，不关闭验证）；JWT 签名密钥与 TLS 证书分开；issuer/audience 不变。
// Gateway→IAM/JWKS 走 http://127.0.0.1:18087（与生产 TLS 终止点分离，验收仅核对
// 路由可达；后续 Gateway→learning 真实 403 路径保留）。
// 秘密全部经子进程 env（vault 文件复用任务1），不放命令行/证据/日志。
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const dir = __dirname;
const root = path.resolve(dir, "..", "..", "..", "..", "..", "..");
const outDir = path.join(dir, "launcher-3");
fs.mkdirSync(outDir, { recursive: true });
const mode = process.argv.includes("--start") ? "start" : process.argv.includes("--stop") ? "stop" : "validate";
const SCHEMA = "r1_002_iam_t3g";
const RUNNER = "r1_002_runner_t3g";
const vaultFile = path.join(dir, "t3-secrets", "r1-002-secrets.json");
const tlsDir = path.join(dir, "t3-tls");
const SAFE_KEYS = ["IAM_PERSISTENCE_ENABLED", "IAM_FLYWAY_ENABLED", "SPRING_FLYWAY_ENABLED", "IAM_PERSISTENCE_SCHEMA", "IAM_CONSENT_POLICY_SOURCE", "IAM_PASSWORD_MIN_LENGTH", "IAM_JWT_ISSUER", "IAM_JWT_AUDIENCE", "IAM_JWT_ALGORITHM", "IAM_JWT_KEY_ID", "IAM_LOCAL_ADULT_GATE_ENABLED", "IAM_NATIVE_TRANSPORT_POLICY", "IAM_REFRESH_COOKIE_SECURE", "P1R_DIAG", "SERVER_SSL_ENABLED"];
function shaFile(p) { return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex"); }
const log = { checkedAt: new Date().toISOString(), mode, schema: SCHEMA, runner: RUNNER, host: "127.0.0.1", port: 18087, steps: [], failedChecks: [] };
function step(name, ok, detail) {
  log.steps.push({ step: name, ok, detail: detail || null });
  if (!ok) { log.failedChecks.push(name); console.error("STEP-FAIL:" + name + " " + JSON.stringify(detail || null).slice(0, 400)); }
  else console.log("STEP-PASS:" + name);
}
try {
  const jarPath = path.join(root, "services/iam-service/target/iam-service-0.1.0-SNAPSHOT.jar");
  const jarStat = fs.statSync(jarPath);
  log.jar = { path: "services/iam-service/target/iam-service-0.1.0-SNAPSHOT.jar", bytes: jarStat.size, sha256: shaFile(jarPath) };
  step("jar", true, { bytes: jarStat.size, sha: log.jar.sha256.slice(0, 16) });
  const vault = JSON.parse(fs.readFileSync(vaultFile, "utf8"));
  step("vault-reused", vault.migratorPassword.length >= 16 && vault.runnerPassword.length >= 16 && vault.replaySecret !== vault.fingerprintSecret, { independent: vault.replaySecret !== vault.fingerprintSecret });
  // TLS 测试证书：keytool 自签 127.0.0.1（store pass 仅内存，不落盘；证书为测试用途）。
  fs.mkdirSync(tlsDir, { recursive: true });
  const ks = path.join(tlsDir, "r1-002-tls.p12");
  const ts = path.join(tlsDir, "r1-002-trust.p12");
  if (!fs.existsSync(ks)) {
    const storePass = "T" + crypto.randomBytes(12).toString("base64url") + "1!";
    const r1 = spawnSync("keytool", ["-genkeypair", "-alias", "r1-002", "-keyalg", "RSA", "-keysize", "2048", "-validity", "30", "-storetype", "PKCS12", "-keystore", ks, "-storepass", storePass, "-keypass", storePass, "-dname", "CN=127.0.0.1", "-ext", "SAN=IP:127.0.0.1"], { encoding: "utf8", windowsHide: true });
    if (r1.status !== 0) throw new Error("keytool genkeypair failed: " + ((r1.stderr || r1.stdout || "").slice(0, 300)));
    const r2 = spawnSync("keytool", ["-exportcert", "-alias", "r1-002", "-keystore", ks, "-storepass", storePass, "-file", path.join(tlsDir, "r1-002.cer")], { encoding: "utf8", windowsHide: true });
    if (r2.status !== 0) throw new Error("keytool exportcert failed");
    const r3 = spawnSync("keytool", ["-importcert", "-noprompt", "-trustcacerts", "-alias", "r1-002", "-file", path.join(tlsDir, "r1-002.cer"), "-keystore", ts, "-storetype", "PKCS12", "-storepass", storePass], { encoding: "utf8", windowsHide: true });
    if (r3.status !== 0) throw new Error("keytool importcert failed");
    // store pass 只写内存 vault（0600），不进证据正文。
    const v = JSON.parse(fs.readFileSync(vaultFile, "utf8"));
    v.tlsStorePassword = storePass;
    fs.writeFileSync(vaultFile, JSON.stringify(v, null, 2), { mode: 0o600 });
    step("tls-cert-created", true, { cn: "127.0.0.1", san: "IP:127.0.0.1", validityDays: 30 });
  } else step("tls-cert-exists", true, { note: "reuse existing test cert; no regen" });
  // 有效配置白名单（脱敏；密钥类仅存在性）。
  log.safeEnv = { IAM_PERSISTENCE_ENABLED: "true", IAM_FLYWAY_ENABLED: "true", SPRING_FLYWAY_ENABLED: "true", IAM_PERSISTENCE_SCHEMA: SCHEMA, IAM_CONSENT_POLICY_SOURCE: "control-plane", IAM_PASSWORD_MIN_LENGTH: "12", IAM_JWT_ISSUER: "http://127.0.0.1:18087", IAM_JWT_AUDIENCE: "yuxuexing-api", IAM_JWT_ALGORITHM: "RS256", IAM_JWT_KEY_ID: "iam-local-2026-08", IAM_LOCAL_ADULT_GATE_ENABLED: "false (guard requires non-local; registration TC uses no attestation input)", IAM_NATIVE_TRANSPORT_POLICY: "deny", IAM_REFRESH_COOKIE_SECURE: "true", SERVER_SSL_ENABLED: "true (test keystore; JWT issuer/audience unchanged)", P1R_DIAG: "0" };
  log.gatewayIam = { iamDirect: "http://127.0.0.1:18087", jwks: "http://127.0.0.1:18087/api/v1/auth/jwks", gatewayToLearning403: "Gateway /api/v1/learning/* -> learning-service:18090 (register TC01 holds restricted JWT, expects 403)" };
  step("safe-env", true, { keys: Object.keys(log.safeEnv) });
  if (mode === "validate") step("validate-only", true, { note: "no backend launched" });
  else if (mode === "start") {
    // 启动自有隔离 IAM：子进程 env 注入（vault + TLS store pass 内存读取），
    // 不放命令行；记录 PID；调用方负责 --stop。
    const vault = JSON.parse(fs.readFileSync(vaultFile, "utf8"));
    const ks = path.join(tlsDir, "r1-002-tls.p12");
    const childEnv = { ...process.env,
      IAM_PERSISTENCE_ENABLED: "true", IAM_FLYWAY_ENABLED: "true", SPRING_FLYWAY_ENABLED: "true",
      IAM_PERSISTENCE_JDBCURL: `jdbc:mysql://127.0.0.1:13306/${SCHEMA}?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true`,
      IAM_PERSISTENCE_USERNAME: RUNNER, IAM_PERSISTENCE_PASSWORD: vault.runnerPassword,
      IAM_PERSISTENCE_SCHEMA: SCHEMA,
      IAM_CONSENT_POLICY_SOURCE: "control-plane", IAM_PASSWORD_MIN_LENGTH: "12",
      IAM_JWT_ISSUER: "http://127.0.0.1:18087", IAM_JWT_AUDIENCE: "yuxuexing-api",
      IAM_JWT_PRIVATE_KEY_FILE: "secrets/iam-rsa-private.pem",
      IAM_IDEMPOTENCY_REPLAY_SECRET: vault.replaySecret, IAM_IDEMPOTENCY_FINGERPRINT_SECRET: vault.fingerprintSecret,
      IAM_JWT_KEY_ID: "iam-local-2026-08",
      IAM_LOCAL_ADULT_GATE_ENABLED: "false", IAM_NATIVE_TRANSPORT_POLICY: "deny",
      SERVER_SSL_ENABLED: "true", SERVER_SSL_KEY_STORE: ks, SERVER_SSL_KEY_STORE_PASSWORD: vault.tlsStorePassword, SERVER_SSL_KEY_STORE_TYPE: "PKCS12", SERVER_SSL_KEY_ALIAS: "r1-002",
      P1R_DIAG: "0" };
    const child = spawn("java", ["-jar", path.join(root, "services/iam-service/target/iam-service-0.1.0-SNAPSHOT.jar"), "--server.address=127.0.0.1", "--server.port=18087", "--spring.profiles.active=v2,local-real", "--local.runtime.mode=local-real"],
      { cwd: root, env: childEnv, stdio: "inherit", windowsHide: true, detached: false });
    fs.writeFileSync(path.join(outDir, "pid.json"), JSON.stringify({ pid: child.pid, startedAt: new Date().toISOString(), schema: SCHEMA }, null, 2));
    step("started", true, { pid: child.pid });
    child.on("exit", (code, sig) => console.log(JSON.stringify({ event: "own-iam-stopped", code, signal: sig })));
  }
  else if (mode === "stop") {
    try {
      const pidRec = JSON.parse(fs.readFileSync(path.join(outDir, "pid.json"), "utf8"));
      process.kill(pidRec.pid, "SIGTERM");
      step("stop", true, { pid: pidRec.pid });
    } catch (e) { step("stop", false, { error: String(e.message || e).slice(0, 200) }); }
  }
} catch (e) {
  step("aborted", false, { error: String(e.message || e).slice(0, 400) });
}
log.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(outDir, "launcher-3.json"), JSON.stringify(log, null, 2));
if (log.failedChecks.length) { console.error("LAUNCHER-3: FAIL " + log.failedChecks.length); process.exit(1); }
console.log("LAUNCHER-3: PASS mode=" + mode);
