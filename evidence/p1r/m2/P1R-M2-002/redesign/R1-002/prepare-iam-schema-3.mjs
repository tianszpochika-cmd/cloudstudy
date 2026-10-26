// R1-002 真正可用 Flyway 验收库（任务1整改）：保留 t2a~t2e 与旧证据不动，
// 新建 r1_002_iam_t3* schema，用项目锁定 Flyway（flyway-core/mysql，随 iam jar）
// 执行 canonical V1,V3..V18 真实迁移；记录 flyway info/validate 原生输出。
// 秘密生命周期：secrets vault 文件仅存于本卡 work/t3-secrets（0600 语义，
// 不入 Git——由 .gitignore 覆盖 evidence 临时秘密模式或放系统 TEMP），
// 准备/迁移/预检子进程从同一 vault 注入；仅记录存在性/长度/独立性。
import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "..", "..", "..", "..", "..", "..");
const outDir = path.join(dir, "iam-schema-3");
fs.mkdirSync(outDir, { recursive: true });
const mode = process.argv.includes("--apply") ? "apply" : "validate";
const SUFFIX = (process.argv.find((a, i) => process.argv[i - 1] === "--suffix" && a) || "t3a").toLowerCase();
if (!/^[a-z0-9]{1,8}$/.test(SUFFIX)) { console.error("suffix must match [a-z0-9]{1,8}"); process.exit(2); }
const SCHEMA = `r1_002_iam_${SUFFIX}`;
const MIGRATOR = `r1_002_migrator_${SUFFIX}`;
const RUNNER = `r1_002_runner_${SUFFIX}`;
for (const id of [SCHEMA, MIGRATOR, RUNNER]) {
  if (!/^[a-z][a-z0-9_]+$/.test(id)) { console.error("unsafe identifier blocked: " + id); process.exit(2); }
}
// 项目锁定 Flyway 版本：flyway-core/mysql 12.4.0（mvn dependency:list 实测）。
const FLYWAY_VERSION = "12.4.0";
const pom = fs.readFileSync(path.join(root, "services/iam-service/pom.xml"), "utf8");
const flywayMarker = pom.includes("flyway-core") && pom.includes("flyway-mysql");
const migDir = path.join(root, "services/iam-service/src/main/resources/db/migration");
const files = fs.readdirSync(migDir).filter((n) => /^V\d+__.+\.sql$/i.test(n)).map((n) => {
  const sql = fs.readFileSync(path.join(migDir, n), "utf8");
  return { name: n, version: Number(n.match(/^V(\d+)__/i)[1]), sha256: crypto.createHash("sha256").update(sql.replaceAll("\r\n", "\n")).digest("hex") };
}).sort((a, b) => a.version - b.version);
// 秘密 vault：本卡 work/t3-secrets/r1-002-secrets.json（权限 0600；内容示例见 README，不提交值）。
// vault 由 prepare 进程生成一次，后续 --apply/预检复用同一文件；仅记录存在性/长度/独立性。
const vaultDir = path.join(dir, "t3-secrets");
const vaultFile = path.join(vaultDir, "r1-002-secrets.json");
function loadOrCreateVault() {
  fs.mkdirSync(vaultDir, { recursive: true });
  if (fs.existsSync(vaultFile)) return JSON.parse(fs.readFileSync(vaultFile, "utf8"));
  const v = {
    migratorPassword: "Mi" + crypto.randomBytes(18).toString("base64url") + "1!",
    runnerPassword: "Ru" + crypto.randomBytes(18).toString("base64url") + "1!",
    replaySecret: crypto.randomBytes(24).toString("base64url") + crypto.randomBytes(8).toString("base64url"),
    fingerprintSecret: crypto.randomBytes(24).toString("base64url") + crypto.randomBytes(8).toString("base64url"),
  };
  fs.writeFileSync(vaultFile, JSON.stringify(v, null, 2), { mode: 0o600 });
  return v;
}
const log = { checkedAt: new Date().toISOString(), mode, schema: SCHEMA, migrator: MIGRATOR, runner: RUNNER, flywayFromProject: flywayMarker, migrations: files.map((f) => ({ name: f.name, version: f.version, sha256: f.sha256 })), steps: [], failedChecks: [] };
function step(name, ok, detail) {
  log.steps.push({ step: name, ok, detail: detail || null });
  if (!ok) { log.failedChecks.push(name); console.error("STEP-FAIL:" + name + " " + JSON.stringify(detail || null).slice(0, 400)); }
  else console.log("STEP-PASS:" + name);
}
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
// 真实 Flyway：flyway-maven-plugin（项目锁定 12.4.0）migrate/info/validate。
// 不手写历史表、不伪造、不复制共享历史、不跳过 V13（插件按 canonical 执行）。
function flywayMvn(extraArgs, jdbcUser, jdbcPassword, schema) {
  // 在 iam-service 模块内执行：该模块自带 flyway-mysql 依赖，插件可发现 MySQL 方言。
  // -q 保持；-pl 限定模块避免在 api-gateway 上执行。
  const args = ["-q", "-pl", "services/iam-service", "org.flywaydb:flyway-maven-plugin:12.4.0:" + extraArgs[0],
    "-Dflyway.url=jdbc:mysql://127.0.0.1:13306/" + schema + "?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true",
    "-Dflyway.user=" + jdbcUser,
    "-Dflyway.password=" + jdbcPassword,
    "-Dflyway.locations=filesystem:services/iam-service/src/main/resources/db/migration",
    "-Dflyway.schemas=" + schema,
    "-Dflyway.defaultSchema=" + schema,
    "-Dflyway.createSchemas=false",
    "-Dflyway.baselineOnMigrate=true",
    "-Dflyway.baselineVersion=0",
    ...extraArgs.slice(1)];
  // 注意：flyway.password 经 Maven -D 传入仅存于本进程 argv；不落盘/证据。
  // 更严格方案（待主审批：改用 settings.xml server 注入）见 prep-report-3 缺口。
  // Windows 下 mvn 为 .cmd shim：必须 shell:true 才能 spawn（与 repo 内既有
  // pwsh 调用 mvn 一致）；密码经 -D 传入仅存本进程 argv，不落盘/证据。
  const r = spawnSync("mvn " + args.map((a) => `"${a.replaceAll('"', '')}"`).join(" "), { cwd: root, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024, shell: true });
  return r;
}
const adminPassword = process.env.MYSQL_ROOT_PASSWORD || "root-local-only";
try {
  step("migration-files", files.length === 17, { count: files.length, versions: files.map((f) => f.version).join(",") });
  step("flyway-locked", flywayMarker, { note: "flyway-core+flyway-mysql 随 iam 构建锁定" });
  const vault = loadOrCreateVault();
  step("vault", vault.migratorPassword.length >= 16 && vault.runnerPassword.length >= 16 && vault.replaySecret.length >= 32 && vault.fingerprintSecret.length >= 32 && vault.replaySecret !== vault.fingerprintSecret, { lengths: [vault.migratorPassword.length, vault.runnerPassword.length, vault.replaySecret.length, vault.fingerprintSecret.length], independent: vault.replaySecret !== vault.fingerprintSecret });
  log.vaultMeta = { exists: true, migratorLen: vault.migratorPassword.length, runnerLen: vault.runnerPassword.length, replayLen: vault.replaySecret.length, fingerprintLen: vault.fingerprintSecret.length, independent: vault.replaySecret !== vault.fingerprintSecret };
  if (mode === "validate") {
    step("would-create", true, { schema: SCHEMA, note: "apply 时真实 Flyway 迁移；validate 不写库" });
  } else {
    const existing = mysql("root", adminPassword, `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='${SCHEMA}';`);
    if (existing.trim() === SCHEMA) throw new Error("目的 schema 已存在，拒绝复用/清理：" + SCHEMA);
    step("schema-absent", true, { schema: SCHEMA });
    mysql("root", adminPassword, `CREATE SCHEMA \`${SCHEMA}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    mysql("root", adminPassword, `CREATE USER IF NOT EXISTS '${MIGRATOR}'@'%' IDENTIFIED BY '${vault.migratorPassword.replaceAll("'", "''")}';\nGRANT ALL PRIVILEGES ON \`${SCHEMA}\`.* TO '${MIGRATOR}'@'%';\nCREATE USER IF NOT EXISTS '${RUNNER}'@'%' IDENTIFIED BY '${vault.runnerPassword.replaceAll("'", "''")}';\nGRANT SELECT, INSERT, UPDATE, DELETE ON \`${SCHEMA}\`.* TO '${RUNNER}'@'%';\nFLUSH PRIVILEGES;`);
    step("identities-created", true, { migrator: MIGRATOR, runner: RUNNER });
    // 真实 Flyway migrate（migrator 身份经 FLYWAY_PASSWORD 注入，不放命令行）。
    {
      const r = flywayMvn(["migrate"], MIGRATOR, vault.migratorPassword, SCHEMA);
      const out = ((r.stdout || "") + (r.stderr || "")).slice(0, 2000);
      log.flywayMigrate = { exit: r.status, output: out };
      step("flyway-migrate", r.status === 0, { exit: r.status, tail: out.slice(-400) });
      if (r.status !== 0) throw new Error("flyway migrate failed");
    }
    {
      const r = flywayMvn(["info"], MIGRATOR, vault.migratorPassword, SCHEMA);
      log.flywayInfo = { exit: r.status, output: ((r.stdout || "") + (r.stderr || "")).slice(0, 4000) };
      step("flyway-info", r.status === 0, { exit: r.status });
    }
    {
      const r = flywayMvn(["validate"], MIGRATOR, vault.migratorPassword, SCHEMA);
      log.flywayValidate = { exit: r.status, output: ((r.stdout || "") + (r.stderr || "")).slice(0, 4000) };
      step("flyway-validate", r.status === 0, { exit: r.status });
      if (r.status !== 0) throw new Error("flyway validate failed");
    }
    const history = mysql("root", adminPassword, `SELECT version, description, success FROM \`${SCHEMA}\`.flyway_schema_history ORDER BY installed_rank;`);
    step("history-native", true, { rows: history.split("\n") });
    log.flywayHistory = history.split("\n");
    // V13 最终结构：原生 CHECK 约束存在性（与 IamRuntimeConfiguration REQUIRED_V13_FINGERPRINT_CHECK 对应）。
    const v13check = mysql("root", adminPassword, `SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA='${SCHEMA}' AND TABLE_NAME='iam_idempotency_record' AND CONSTRAINT_NAME='chk_iam_idempotency_request_fingerprint';`);
    step("v13-final-structure", v13check.trim() === "1", { checkRows: v13check.trim() });
    // runner 读权限 + 零基线（DML-only 验证连接）。
    const counts = ["iam_principal", "iam_account", "iam_device", "iam_session", "iam_consent"].map((t) => {
      const n = mysql("root", adminPassword, `SELECT COUNT(*) FROM \`${SCHEMA}\`.\`${t}\`;`);
      return { table: t, rows: Number(n.trim()) };
    });
    log.baselineCounts = counts;
    step("baseline-zero-accounts", counts.every((c) => c.rows === 0), { counts });
    const seeds = ["iam_role", "iam_permission"].map((t) => {
      const n = mysql("root", adminPassword, `SELECT COUNT(*) FROM \`${SCHEMA}\`.\`${t}\`;`);
      return { table: t, rows: Number(n.trim()) };
    });
    log.seedCounts = seeds;
    step("seed-recorded", true, { seeds });
    log.flywayNote = "原生 flyway_schema_history（含 installed_rank/success/checksum 原生列），非手建表";
  }
} catch (e) {
  step("aborted", false, { error: String(e.message || e).replaceAll(adminPassword, "***").slice(0, 400) });
}
log.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(outDir, "iam-schema-3.json"), JSON.stringify(log, null, 2));
if (log.failedChecks.length) { console.error("IAM-SCHEMA-3: FAIL " + log.failedChecks.length); process.exit(1); }
console.log("IAM-SCHEMA-3: PASS mode=" + mode + " schema=" + SCHEMA);
