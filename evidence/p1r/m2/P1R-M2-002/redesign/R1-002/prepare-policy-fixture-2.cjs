const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const dir = __dirname;
const root = path.resolve(dir, "..", "..", "..", "..", "..", "..");
const outDir = path.join(dir, "policy-fixture-2");
fs.mkdirSync(outDir, { recursive: true });
// 合成政策文书（本地测试用途）：与 localCandidate 同源固定值，转为控制表行。
// 来源：ConsentPolicyDescriptor.localCandidate（源码哈希见 receipt）。
const DOCS = [
  { type: "TERMS_OF_SERVICE", document_version: "b30-consent-v1", document_digest: "eb74b7254589589f61f5f3747d83379bc6f1e950ab7d8fd52f64f3ab50fb39fb", policy_version: "b30-consent-policy-v1", policy_digest: "718e235dab2c1854fe9c650eeade24d4f67666db8e5fa1bff08036dc2ebf1358", requirement: "BASE_REQUIRED", capabilities: ["ACCOUNT", "LEARNING"], withdrawal_effect: "RESTRICT_ALL_LEARNING_ACCESS", revoke_sessions: true, policy_ref: "iam://consent/ACCOUNT_TERMS" },
  { type: "PRIVACY_NOTICE", document_version: "b30-consent-v1", document_digest: "4ab15e31c11c9ef99b267ae620910420fdb8a9b6f720b988afeb59d5262ddd84", policy_version: "b30-consent-policy-v1", policy_digest: "718e235dab2c1854fe9c650eeade24d4f67666db8e5fa1bff08036dc2ebf1358", requirement: "BASE_REQUIRED", capabilities: ["ACCOUNT", "LEARNING"], withdrawal_effect: "RESTRICT_ALL_LEARNING_ACCESS", revoke_sessions: true, policy_ref: "iam://consent/PRIVACY_NOTICE" },
  { type: "ADULT_LEARNING", document_version: "b30-consent-v1", document_digest: "9702cd4fe3e50613f84030998f65c0c8e7961f058176b24f8a9e82006abea189", policy_version: "b30-consent-policy-v1", policy_digest: "718e235dab2c1854fe9c650eeade24d4f67666db8e5fa1bff08036dc2ebf1358", requirement: "LEARNING_REQUIRED", capabilities: ["LEARNING"], withdrawal_effect: "RESTRICT_ALL_LEARNING_ACCESS", revoke_sessions: true, policy_ref: "iam://consent/ADULT_LEARNING_ELIGIBILITY" },
];
const SCHEMA = "r1_002_iam_t2e";
const PUBLISHED_AT = "2026-08-30 00:00:00.000000";
function mysql(user, password, input) {
  const r = spawnSync("docker", ["exec", "-i", "yuxuexing-local-mysql-1", "sh", "-c",
    "IFS= read -r MYSQL_PWD; export MYSQL_PWD; exec mysql --protocol=TCP --host 127.0.0.1 --port 3306 --user " + user + " --default-character-set=utf8mb4 --batch --skip-column-names --raw"],
    { cwd: root, input: password + "\n" + input + "\n", encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error("mysql 启动失败: " + r.error.message);
  if (r.status !== 0) throw new Error("mysql exit " + r.status + ": " + (r.stderr || r.stdout || "").trim().slice(0, 500));
  return (r.stdout || "").trim();
}
const adminPassword = process.env.MYSQL_ROOT_PASSWORD || "root-local-only";
const log = { checkedAt: new Date().toISOString(), schema: SCHEMA, policySource: "control-plane", purpose: "本地合成测试用途，不冒充正式法务签收", docs: DOCS.map((d) => ({ type: d.type, document_version: d.document_version, policy_version: d.policy_version, requirement: d.requirement, capabilities: d.capabilities, published_at: PUBLISHED_AT, policy_ref: d.policy_ref, document_digest: d.document_digest.slice(0, 16) + "...", policy_digest: d.policy_digest.slice(0, 16) + "..." })), steps: [], failedChecks: [] };
function step(name, ok, detail) {
  log.steps.push({ step: name, ok, detail: detail || null });
  if (!ok) { log.failedChecks.push(name); console.error("STEP-FAIL:" + name + " " + JSON.stringify(detail || null).slice(0, 400)); }
  else console.log("STEP-PASS:" + name);
}
try {
  const stmts = DOCS.map((d, i) => `INSERT INTO \`${SCHEMA}\`.iam_consent_document_version (consent_document_id, tenant_id, consent_type, document_version, document_digest, published_at, policy_version, policy_digest, requirement, capabilities, withdrawal_effect, revoke_sessions, policy_ref, runtime_status, lifecycle_status, revoked_at, created_at) VALUES ('r1-002-doc-${i + 1}', 'platform', '${d.type}', '${d.document_version}', '${d.document_digest}', '${PUBLISHED_AT}', '${d.policy_version}', '${d.policy_digest}', '${d.requirement}', '${JSON.stringify(d.capabilities).replaceAll("'", "''")}', '${d.withdrawal_effect}', ${d.revoke_sessions ? 1 : 0}, '${d.policy_ref}', 'NOT_RUNTIME_VERIFIED', 'ACTIVE', NULL, UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE lifecycle_status='ACTIVE', revoked_at=NULL;`).join("\n");
  mysql("root", adminPassword, stmts);
  step("fixture-inserted", true, { count: DOCS.length });
  const rows = mysql("root", adminPassword, `SELECT consent_type, document_version, lifecycle_status FROM \`${SCHEMA}\`.iam_consent_document_version WHERE tenant_id='platform' ORDER BY consent_type;`);
  step("fixture-readback", rows.split("\n").length === 3, { rows });
  log.readback = rows.split("\n");
  const users = mysql("root", adminPassword, `SELECT COUNT(*) FROM \`${SCHEMA}\`.iam_account; SELECT COUNT(*) FROM \`${SCHEMA}\`.iam_consent; SELECT COUNT(*) FROM \`${SCHEMA}\`.iam_session;`);
  log.userBaseline = users.split("\n").map(Number);
  step("user-baseline-zero", log.userBaseline.every((n) => n === 0), { counts: log.userBaseline });
} catch (e) {
  step("aborted", false, { error: String(e.message || e).replaceAll(adminPassword, "***").slice(0, 400) });
}
log.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(outDir, "policy-fixture-2.json"), JSON.stringify(log, null, 2));
if (log.failedChecks.length) { console.error("POLICY-FIXTURE-RESULT: FAIL " + log.failedChecks.length); process.exit(1); }
console.log("POLICY-FIXTURE-RESULT: PASS docs=3 users-zero=true");
