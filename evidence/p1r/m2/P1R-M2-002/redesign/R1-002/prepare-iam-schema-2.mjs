// R1-002 专用 IAM 验收库准备脚本（限定授权：新建一个 r1_002_iam_* schema + 新身份）。
// 真实执行 V1,V3..V18 canonical 迁移（读文件、按版本顺序执行），记录版本/checksum/历史。
// 迁移身份与运行身份分离；运行身份仅 SELECT/INSERT/UPDATE/DELETE 于新库。
// 禁止：复制共享 history、伪造 SUCCESS、碰共享 iam_service/既有身份、清库。
// 凭据经 MYSQL_PWD 子进程注入，不落盘；本批默认 --validate 只做静态检查。
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "..", "..", "..", "..", "..", "..");
const outDir = path.join(dir, "iam-schema-2");
fs.mkdirSync(outDir, { recursive: true });
const mode = process.argv.includes("--apply") ? "apply" : "validate";
const SUFFIX = (process.argv.find((a, i) => process.argv[i - 1] === "--suffix" && a) || "t2a").toLowerCase();
if (!/^[a-z0-9]{1,8}$/.test(SUFFIX)) { console.error("suffix must match [a-z0-9]{1,8}"); process.exit(2); }
const SCHEMA = `r1_002_iam_${SUFFIX}`;
const MIGRATOR = `r1_002_migrator_${SUFFIX}`;
const RUNNER = `r1_002_runner_${SUFFIX}`;
for (const id of [SCHEMA, MIGRATOR, RUNNER]) {
  if (!/^[a-z][a-z0-9_]+$/.test(id)) { console.error("unsafe identifier blocked: " + id); process.exit(2); }
}
const migDir = path.join(root, "services/iam-service/src/main/resources/db/migration");
const files = fs.readdirSync(migDir).filter((n) => /^V\d+__.+\.sql$/i.test(n)).map((n) => {
  const sql = fs.readFileSync(path.join(migDir, n), "utf8");
  return { name: n, version: Number(n.match(/^V(\d+)__/i)[1]), checksum: crypto.createHash("sha256").update(sql.replaceAll("\r\n", "\n")).digest("hex"), sql };
}).sort((a, b) => a.version - b.version);
const log = { checkedAt: new Date().toISOString(), mode, schema: SCHEMA, migrator: MIGRATOR, runner: RUNNER, host: "127.0.0.1", port: "13306", migrations: files.map((f) => ({ name: f.name, version: f.version, checksum: f.checksum })), steps: [], failedChecks: [] };
function step(name, ok, detail) {
  log.steps.push({ step: name, ok, detail: detail || null });
  if (!ok) { log.failedChecks.push(name); console.error("STEP-FAIL:" + name + " " + JSON.stringify(detail || null).slice(0, 400)); }
  else console.log("STEP-PASS:" + name);
}
function mysql(user, password, input, database) {
  const args = ["exec", "-i", "yuxuexing-local-mysql-1", "sh", "-c",
    "IFS= read -r MYSQL_PWD; export MYSQL_PWD; exec mysql \"$@\"", "sh",
    "--protocol=TCP", "--host", "127.0.0.1", "--port", "3306", "--user", user,
    ...(database ? ["--database", database] : []),
    "--default-character-set=utf8mb4", "--batch", "--skip-column-names", "--raw"];
  const r = spawnSync("docker", args, { cwd: root, input: password + "\n" + input + "\n", encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error("mysql 启动失败: " + r.error.message);
  if (r.status !== 0) throw new Error("mysql exit " + r.status + ": " + (r.stderr || r.stdout || "").trim().slice(0, 500));
  return (r.stdout || "").trim();
}
const adminPassword = process.env.MYSQL_ROOT_PASSWORD || "root-local-only";
try {
  step("migration-files", files.length === 17 && files[0].version === 1 && files[files.length - 1].version === 18, { count: files.length, versions: files.map((f) => f.version).join(",") });
  step("v13-present", files.some((f) => f.version === 13), { note: "one-way cutover; new empty schema has no old writer" });
  if (mode === "validate") {
    step("identifiers", true, { schema: SCHEMA, migrator: MIGRATOR, runner: RUNNER });
    step("would-create", true, { note: "apply 时创建新库+双身份+真实迁移；本批 validate 不写库" });
  } else {
    const existing = mysql("root", adminPassword, `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='${SCHEMA}';`);
    if (existing.trim() === SCHEMA) throw new Error("目的 schema 已存在，拒绝复用/清理：" + SCHEMA);
    step("schema-absent", true, { schema: SCHEMA });
    mysql("root", adminPassword, `CREATE SCHEMA \`${SCHEMA}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    step("schema-created", true, { schema: SCHEMA });
    const migratorPwd = "Mi" + crypto.randomBytes(18).toString("base64url") + "1!";
    const runnerPwd = "Ru" + crypto.randomBytes(18).toString("base64url") + "1!";
    mysql("root", adminPassword, `CREATE USER IF NOT EXISTS '${MIGRATOR}'@'%' IDENTIFIED BY '${migratorPwd.replaceAll("'", "''")}';\nGRANT CREATE, ALTER, INDEX, REFERENCES, LOCK TABLES, SELECT, INSERT, UPDATE, DELETE, DROP, CREATE VIEW, SHOW VIEW, TRIGGER ON \`${SCHEMA}\`.* TO '${MIGRATOR}'@'%';\nCREATE USER IF NOT EXISTS '${RUNNER}'@'%' IDENTIFIED BY '${runnerPwd.replaceAll("'", "''")}';\nGRANT SELECT, INSERT, UPDATE, DELETE ON \`${SCHEMA}\`.* TO '${RUNNER}'@'%';\nFLUSH PRIVILEGES;`);
    step("identities-created", true, { migrator: MIGRATOR, runner: RUNNER, runnerGrants: "SELECT,INSERT,UPDATE,DELETE on new schema only" });
    // 真实迁移：migrator 身份按版本顺序执行 canonical SQL（经 flyway_schema_history 记录）。
    mysql(MIGRATOR, migratorPwd, `CREATE TABLE IF NOT EXISTS \`${SCHEMA}\`.flyway_schema_history (version INT NOT NULL, description VARCHAR(128) NOT NULL, checksum CHAR(64) NOT NULL, applied_at DATETIME(6) NOT NULL, PRIMARY KEY (version)) ENGINE=InnoDB;`, SCHEMA);
    for (const f of files) {
      mysql(MIGRATOR, migratorPwd, f.sql + `\nINSERT INTO flyway_schema_history (version, description, checksum, applied_at) VALUES (${f.version}, '${f.name.replaceAll("'", "''")}', '${f.checksum}', UTC_TIMESTAMP(6));`, SCHEMA);
      step("migrate-V" + f.version, true, { checksum: f.checksum.slice(0, 16) });
    }
    const history = mysql(MIGRATOR, migratorPwd, `SELECT version FROM flyway_schema_history ORDER BY version;`, SCHEMA);
    step("history-complete", history.split("\n").map(Number).join(",") === files.map((f) => f.version).join(","), { history });
    const counts = ["iam_principal", "iam_account", "iam_device", "iam_session", "iam_consent"].map((t) => {
      const n = mysql(RUNNER, runnerPwd, `SELECT COUNT(*) FROM \`${SCHEMA}\`.\`${t}\`;`, SCHEMA);
      return { table: t, rows: Number(n.trim()) };
    });
    log.baselineCounts = counts;
    step("baseline-zero-accounts", counts.every((c) => c.rows === 0), { counts });
    const seedCounts = ["iam_role", "iam_permission", "iam_consent_document_version"].map((t) => {
      try { const n = mysql(RUNNER, runnerPwd, `SELECT COUNT(*) FROM \`${SCHEMA}\`.\`${t}\`;`, SCHEMA); return { table: t, rows: Number(n.trim()) }; }
      catch (e) { return { table: t, rows: "missing:" + String(e.message).slice(0, 80) }; }
    });
    log.seedCounts = seedCounts;
    step("seed-recorded", true, { seedCounts });
    log.credentialNote = "migrator/runner 密码仅本次子进程内存，不落盘；runner 密码需主审签收后由启动脚本单独注入";
  }
} catch (e) {
  step("aborted", false, { error: String(e.message || e).replaceAll(adminPassword, "***").slice(0, 400) });
}
log.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(outDir, "iam-schema-2.json"), JSON.stringify(log, null, 2));
if (log.failedChecks.length) { console.error("IAM-SCHEMA-RESULT: FAIL " + log.failedChecks.length); process.exit(1); }
console.log("IAM-SCHEMA-RESULT: PASS mode=" + mode + " schema=" + SCHEMA);
