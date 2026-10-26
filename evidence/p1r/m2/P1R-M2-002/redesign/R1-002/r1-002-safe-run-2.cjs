// R1-002 隔离启动配置（静态 --validate，不启动业务服务）。
// 输出可执行启动方式 + 脱敏配置白名单（禁止泛扫环境变量）。
// 用法：node evidence/.../R1-002/r1-002-safe-run-2.cjs --validate
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const dir = __dirname;
const root = path.resolve(dir, "..", "..", "..", "..", "..", "..");
const outDir = path.join(dir, "safe-run-2");
fs.mkdirSync(outDir, { recursive: true });
const SCHEMA = "r1_002_iam_t2e";
// 白名单：仅输出这些安全开关 + 脱敏身份（禁止 *_PASSWORD/*SECRET/*KEY* 值）。
const SAFE_KEYS = ["IAM_PERSISTENCE_ENABLED", "IAM_FLYWAY_ENABLED", "SPRING_FLYWAY_ENABLED", "IAM_CONSENT_POLICY_SOURCE", "IAM_PASSWORD_MIN_LENGTH", "IAM_JWT_ISSUER", "IAM_JWT_AUDIENCE", "IAM_JWT_ALGORITHM", "IAM_JWT_KEY_ID", "IAM_LOCAL_ADULT_GATE_ENABLED", "IAM_NATIVE_TRANSPORT_POLICY", "P1R_DIAG"];
const childEnv = {
  IAM_PERSISTENCE_ENABLED: "true",
  IAM_FLYWAY_ENABLED: "true",
  SPRING_FLYWAY_ENABLED: "true",
  IAM_PERSISTENCE_JDBCURL: `jdbc:mysql://127.0.0.1:13306/${SCHEMA}?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true`,
  IAM_PERSISTENCE_USERNAME: "r1_002_runner_t2e",
  IAM_PERSISTENCE_SCHEMA: SCHEMA,
  IAM_CONSENT_POLICY_SOURCE: "control-plane",
  IAM_PASSWORD_MIN_LENGTH: "12",
  IAM_JWT_ISSUER: "http://127.0.0.1:18087",
  IAM_JWT_AUDIENCE: "yuxuexing-api",
  IAM_JWT_ALGORITHM: "RS256",
  IAM_JWT_KEY_ID: "iam-local-2026-08",
  IAM_LOCAL_ADULT_GATE_ENABLED: "true",
  IAM_NATIVE_TRANSPORT_POLICY: "deny",
  P1R_DIAG: "0",
};
function shaFile(p) { return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, p))).digest("hex"); }
const jarPath = "services/iam-service/target/iam-service-0.1.0-SNAPSHOT.jar";
const jarStat = fs.statSync(path.join(root, jarPath));
const log = {
  checkedAt: new Date().toISOString(),
  scope: "R1-002 isolated IAM start config; static validate only, no backend launch",
  schema: SCHEMA,
  safeEnv: childEnv,
  ports: { "iam-service": 18087, "api-gateway": 18070, "learning-service": 18090 },
  jars: { "iam-service": { path: jarPath, bytes: jarStat.size, sha256: shaFile(jarPath) } },
  passwordPolicy: "IAM_PERSISTENCE_PASSWORD + replay/fingerprint secrets injected into child env only at start; never CLI/output/evidence",
  tls: { entry: "https://127.0.0.1:<TLS_PORT>/api/v1/auth/register (TLS_PORT pending owner input; default HTTP :18087 must NOT be used as TLS evidence)", secureCookie: "refresh-cookie-secure=true (application.yaml default; local profile false is NOT acceptance)", note: "JWT RSA signing key (IAM_JWT_PRIVATE_KEY_FILE) is not a TLS server certificate" },
  pep403: { route: "GET http://127.0.0.1:18090/api/v1/learning/today via Gateway /api/v1/learning/today", expect: "403 learning access is not granted (never 401/404/503 substitute)", reason: "restricted JWT lacks PASSED/GRANTED/learning.* (LearningHttpPrincipals:50-55)" },
  failedChecks: [],
};
if (childEnv.IAM_PERSISTENCE_JDBCURL.match(/\/([^/?]+)\?/)?.[1] !== SCHEMA) { log.failedChecks.push("jdbc-schema-mismatch"); }
if (childEnv.IAM_PERSISTENCE_SCHEMA !== SCHEMA) { log.failedChecks.push("persistence-schema-mismatch"); }
if (childEnv.IAM_CONSENT_POLICY_SOURCE !== "control-plane") { log.failedChecks.push("policy-source-not-control-plane"); }
if (childEnv.IAM_PASSWORD_MIN_LENGTH !== "12") { log.failedChecks.push("password-min-not-12"); }
log.effectiveCheck = "READY 后子进程 env 逐键核对上述白名单（密钥类仅核存在性，不输出值）+ /actuator/health/readiness + 公开 GET";
fs.writeFileSync(path.join(outDir, "safe-run-2.json"), JSON.stringify(log, null, 2));
console.log(JSON.stringify({ schema: SCHEMA, safeKeys: Object.keys(childEnv), ports: log.ports, jar: `${jarStat.size}B ${log.jars["iam-service"].sha256.slice(0, 16)}...` }, null, 1));
if (log.failedChecks.length) { console.error("SAFE-RUN-RESULT: FAIL"); process.exit(1); }
console.log("SAFE-RUN-RESULT: PASS (no backend launched)");
