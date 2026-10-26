// R1-002 t3g 政策 fixture + runner 预检（任务1收尾，独立结果文件，不覆盖旧证据）。
// - fixture 来源：ConsentPolicyDescriptor.localCandidate 三类固定值（完整 digest）。
// - 用 runner 身份写入（验证 DML），migrator 不参与业务行写入。
// - 记录完整 digest/requirement/capabilities/published_at/ACTIVE 读回 + 用户零基线。
// - runner 连接 + 读权限验证（SELECT 全部业务表）。
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const dir = __dirname;
const root = path.resolve(dir, "..", "..", "..", "..", "..", "..");
const outDir = path.join(dir, "policy-fixture-3");
fs.mkdirSync(outDir, { recursive: true });
const SCHEMA = "r1_002_iam_t3g";
const RUNNER = "r1_002_runner_t3g";
const vaultFile = path.join(dir, "t3-secrets", "r1-002-secrets.json");
const DOCS = [
  { type: "TERMS_OF_SERVICE", document_version: "b30-consent-v1", document_digest: "eb74b7254589589f61f5f3747d83379bc6f1e950ab7d8fd52f64f3ab50fb39fb", published_at: "2026-08-30 00:00:00.000000", policy_version: "b30-consent-policy-v1", policy_digest: "718e235dab2c1854fe9c650eeade24d4f67666db8e5fa1bff08036dc2ebf1358", requirement: "BASE_REQUIRED", capabilities: ["ACCOUNT", "LEARNING"], withdrawal_effect: "RESTRICT_ALL_LEARNING_ACCESS", revoke_sessions: 1, policy_ref: "iam://consent/ACCOUNT_TERMS" },
  { type: "PRIVACY_NOTICE", document_version: "b30-consent-v1", document_digest: "4ab15e31c11c9ef99b267ae620910420fdb8a9b6f720b988afeb59d5262ddd84", published_at: "2026-08-30 00:00:00.000000", policy_version: "b30-consent-policy-v1", policy_digest: "718e235dab2c1854fe9c650eeade24d4f67666db8e5fa1bff08036dc2ebf1358", requirement: "BASE_REQUIRED", capabilities: ["ACCOUNT", "LEARNING"], withdrawal_effect: "RESTRICT_ALL_LEARNING_ACCESS", revoke_sessions: 1, policy_ref: "iam://consent/PRIVACY_NOTICE" },
  { type: "ADULT_LEARNING", document_version: "b30-consent-v1", document_digest: "9702cd4fe3e50613f84030998f65c0c8e7961f058176b24f8a9e82006abea189", published_at: "2026-08-30 00:00:00.000000", policy_version: "b30-consent-policy-v1", policy_digest: "718e235dab2c1854fe9c650eeade24d4f67666db8e5fa1bff08036dc2ebf1358", requirement: "LEARNING_REQUIRED", capabilities: ["LEARNING"], withdrawal_effect: "RESTRICT_ALL_LEARNING_ACCESS", revoke_sessions: 1, policy_ref: "iam://consent/ADULT_LEARNING_ELIGIBILITY" },
];
function mysql(user, password, input, database) {
  const r = spawnSync("docker", ["exec", "-i", "yuxuexing-local-mysql-1", "sh", "-c",
    "IFS= read -r MYSQL_PWD; export MYSQL_PWD; exec mysql \"$@\"", "sh",
    "--protocol=TCP", "--host", "127.0.0.1", "--port", "3306", "--user", user,
    ...(database ? ["--database", database] : []),
    "--default-character-set=utf8mb4", "--batch", "--skip-column-names", "--raw"],
    { cwd: root, input: password + "\n" + input + "\n", encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error("mysql 启动失败: " + r.error.message);
  if (r.status !== 0) throw new Error("mysql exit " + r.status + ": " + (r.stderr || r.stdout || "").trim().slice(0, 500));
  return (r.stdout || "").trim();
}
const adminPassword = process.env.MYSQL_ROOT_PASSWORD || "root-local-only";
const log = { checkedAt: new Date().toISOString(), schema: SCHEMA, runner: RUNNER, policySource: "control-plane", purpose: "本地合成测试用途，不冒充正式法务签收", steps: [], failedChecks: [] };
function step(name, ok, detail) {
  log.steps.push({ step: name, ok, detail: detail || null });
  if (!ok) { log.failedChecks.push(name); console.error("STEP-FAIL:" + name + " " + JSON.stringify(detail || null).slice(0, 400)); }
  else console.log("STEP-PASS:" + name);
}
try {
  const vault = JSON.parse(fs.readFileSync(vaultFile, "utf8"));
  // runner 连接 + 读权限：全部业务表 SELECT（DML-only 身份验证）。
  const readable = ["iam_principal", "iam_account", "iam_device", "iam_session", "iam_consent", "iam_consent_document_version", "iam_idempotency_record", "iam_decision_audit", "iam_role", "iam_permission"];
  for (const t of readable) {
    mysql(RUNNER, vault.runnerPassword, `SELECT COUNT(*) FROM \`${SCHEMA}\`.\`${t}\`;`, SCHEMA);
  }
  step("runner-select", true, { tables: readable.length });
  // runner 写入 fixture（INSERT；ON DUPLICATE 保证幂等可重跑）。
  const stmts = DOCS.map((d, i) => `INSERT INTO \`${SCHEMA}\`.iam_consent_document_version (consent_document_id, tenant_id, consent_type, document_version, document_digest, published_at, policy_version, policy_digest, requirement, capabilities, withdrawal_effect, revoke_sessions, policy_ref, runtime_status, lifecycle_status, revoked_at, created_at) VALUES ('r1-002-doc-${i + 1}', 'platform', '${d.type}', '${d.document_version}', '${d.document_digest}', '${d.published_at}', '${d.policy_version}', '${d.policy_digest}', '${d.requirement}', '${JSON.stringify(d.capabilities).replaceAll("'", "''")}', '${d.withdrawal_effect}', ${d.revoke_sessions}, '${d.policy_ref}', 'NOT_RUNTIME_VERIFIED', 'ACTIVE', NULL, UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE lifecycle_status='ACTIVE', revoked_at=NULL;`).join("\n");
  mysql(RUNNER, vault.runnerPassword, stmts, SCHEMA);
  step("fixture-inserted-by-runner", true, { count: DOCS.length });
  // 完整读回：digest 全值 + requirement/capabilities/published_at/ACTIVE。
  const rows = mysql(RUNNER, vault.runnerPassword, `SELECT consent_type, document_version, document_digest, DATE_FORMAT(published_at,'%Y-%m-%d %H:%i:%s'), policy_version, policy_digest, requirement, capabilities, policy_ref, lifecycle_status FROM \`${SCHEMA}\`.iam_consent_document_version WHERE tenant_id='platform' ORDER BY consent_type;`, SCHEMA);
  log.readback = rows.split("\n");
  step("fixture-readback-full", rows.split("\n").length === 3 && rows.split("\n").every((r) => r.endsWith("\tACTIVE")), { rows: log.readback.map((r) => r.slice(0, 60) + "...") });
  const users = mysql(RUNNER, vault.runnerPassword, `SELECT COUNT(*) FROM \`${SCHEMA}\`.iam_account; SELECT COUNT(*) FROM \`${SCHEMA}\`.iam_consent; SELECT COUNT(*) FROM \`${SCHEMA}\`.iam_session; SELECT COUNT(*) FROM \`${SCHEMA}\`.iam_device; SELECT COUNT(*) FROM \`${SCHEMA}\`.iam_principal;`, SCHEMA);
  log.userBaseline = users.split("\n").map(Number);
  step("user-baseline-zero", log.userBaseline.every((n) => n === 0), { counts: log.userBaseline });
} catch (e) {
  step("aborted", false, { error: String(e.message || e).slice(0, 400) });
}
log.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(outDir, "policy-fixture-3.json"), JSON.stringify(log, null, 2));
if (log.failedChecks.length) { console.error("POLICY-FIXTURE-3: FAIL " + log.failedChecks.length); process.exit(1); }
console.log("POLICY-FIXTURE-3: PASS docs=3 users-zero=true");
