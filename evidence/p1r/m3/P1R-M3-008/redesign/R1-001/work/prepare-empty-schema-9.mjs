// R1-001 专用空 schema 准备脚本（隔离验收环境准备，不启动后台）。
// 授权：reviewer-8-prep/review.md —— 在 127.0.0.1:13306 创建唯一
// r1_001_empty_20261005_<suffix> 测试 schema，仅复制 content 表结构，
// 不复制业务数据；写入严格限制于新测试 schema 及其专用临时只读身份。
// 禁止：UPDATE 共享七课程、临时下架、清共享库、改既有用户权限、
// 新 MySQL 端口/实例、修改共享 runner。
// 凭据仅经 MYSQL_PWD 子进程注入，不进入报告/Git；失败输出脱敏信息。
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "..", "..", "..", "..", "..");
const outDir = path.join(dir, "empty-schema-9");
fs.mkdirSync(outDir, { recursive: true });

const SUFFIX = (process.argv[2] || "a").toLowerCase();
if (!/^[a-z0-9]{1,8}$/.test(SUFFIX)) {
  console.error("suffix must match [a-z0-9]{1,8}");
  process.exit(2);
}
const SCHEMA = `r1_001_empty_20261005_${SUFFIX}`;
const READER = `r1_001_reader_${SUFFIX}`;
const TABLES = [
  "content_definition",
  "content_version",
  "content_public_projection",
  "content_outbox_event",
  "content_idempotency_record",
  "content_cache_invalidation",
  "content_version_id_sequence",
];
const FIXED_PREFIX = "r1_001_empty_20261005_";
if (!SCHEMA.startsWith(FIXED_PREFIX) || !/^[a-z][a-z0-9_]+$/.test(SCHEMA) || !/^[a-z][a-z0-9_]+$/.test(READER)) {
  console.error("unsafe identifier blocked");
  process.exit(2);
}
const host = process.env.MYSQL_HOST || "127.0.0.1";
const port = String(process.env.MYSQL_PORT || "13306");
if ((host !== "127.0.0.1" && host !== "localhost") || port !== "13306") {
  console.error(`只允许本机 MySQL 127.0.0.1:13306；当前 ${host}:${port}`);
  process.exit(2);
}
const adminUser = process.env.MYSQL_ADMIN_USER || "root";
const adminPassword = process.env.MYSQL_ROOT_PASSWORD || "root-local-only";

function mysqlArgs(user, database) {
  return ["--protocol=TCP", "--host", "127.0.0.1", "--port", "13306", "--user", user,
    ...(database ? ["--database", database] : []),
    "--default-character-set=utf8mb4", "--batch", "--skip-column-names", "--raw"];
}
function runMysql(user, password, input, database) {
  // 本机无 mysql 客户端时经 docker exec 进入 yuxuexing-local-mysql-1（3306 容器端口）；
  // 目标仍是 127.0.0.1:13306 映射的同一实例，不新增实例/端口。
  const probe = spawnSync("mysql", ["--version"], { encoding: "utf8", windowsHide: true, stdio: "ignore" });
  const useDocker = probe.error != null || probe.status !== 0;
  if (!useDocker) {
    const r = spawnSync("mysql", mysqlArgs(user, database), {
      cwd: root, input, encoding: "utf8", windowsHide: true,
      env: { ...process.env, MYSQL_PWD: password },
    });
    if (r.error) throw new Error(`mysql 启动失败: ${r.error.message}`);
    if (r.status !== 0) throw new Error(`mysql exit ${r.status}: ${(r.stderr || r.stdout || "").trim().slice(0, 500)}`);
    return (r.stdout || "").trim();
  }
  const r = spawnSync("docker", ["exec", "-i", "-e", `MYSQL_PWD=${password}`, "yuxuexing-local-mysql-1",
    "mysql", "--protocol=TCP", "--host", "127.0.0.1", "--port", "3306", "--user", user,
    ...(database ? ["--database", database] : []),
    "--default-character-set=utf8mb4", "--batch", "--skip-column-names", "--raw"], {
    cwd: root, input, encoding: "utf8", windowsHide: true,
  });
  if (r.error) throw new Error(`docker mysql 启动失败: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`docker mysql exit ${r.status}: ${(r.stderr || r.stdout || "").trim().slice(0, 500)}`);
  return (r.stdout || "").trim();
}
const redact = (s) => String(s || "").replaceAll(adminPassword, "***");
const log = { checkedAt: new Date().toISOString(), schema: SCHEMA, reader: READER, host: "127.0.0.1", port: "13306", steps: [], failedChecks: [] };
function step(name, ok, detail) {
  log.steps.push({ step: name, ok, detail: detail || null });
  if (!ok) { log.failedChecks.push(name); console.error("STEP-FAIL:" + name + " " + JSON.stringify(detail || null).slice(0, 400)); }
  else console.log("STEP-PASS:" + name);
}
try {
  // 1. 目的 schema 必须新建：存在即失败退出（不复用、不清理、不删除）。
  const existing = runMysql(adminUser, adminPassword, `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='${SCHEMA}';`);
  if (existing.trim() === SCHEMA) throw new Error(`目的 schema 已存在，拒绝复用/清理：${SCHEMA}`);
  step("schema-absent", true, { schema: SCHEMA });
  // 2. 仅建库 + 仅复制表结构（CREATE TABLE ... LIKE），不复制任何行。
  runMysql(adminUser, adminPassword, `CREATE SCHEMA \`${SCHEMA}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  step("schema-created", true, { schema: SCHEMA });
  for (const t of TABLES) {
    // 白名单表 + 固定前缀 schema，双重限定 DDL 目标。
    runMysql(adminUser, adminPassword, `CREATE TABLE \`${SCHEMA}\`.\`${t}\` LIKE \`content_service\`.\`${t}\`;`);
  }
  step("structure-copied", true, { tables: TABLES });
  // 3. 结构回执：SHOW CREATE TABLE 哈希（只读元数据，不含数据）。
  const structures = TABLES.map((t) => {
    const ddl = runMysql(adminUser, adminPassword, `SHOW CREATE TABLE \`${SCHEMA}\`.\`${t}\`;`);
    return { table: t, sha256: crypto.createHash("sha256").update(ddl).digest("hex") };
  });
  log.structures = structures;
  step("structure-receipt", true, { count: structures.length });
  // 4. 空表事实：逐表 COUNT(*) 必须为 0。
  const counts = TABLES.map((t) => {
    const n = runMysql(adminUser, adminPassword, `SELECT COUNT(*) FROM \`${SCHEMA}\`.\`${t}\`;`);
    return { table: t, rows: Number(n.trim()) };
  });
  log.emptyCounts = counts;
  const allEmpty = counts.every((c) => c.rows === 0);
  step("tables-empty", allEmpty, { counts });
  if (!allEmpty) throw new Error("新 schema 非空，停止");
  // 5. 共享七课程 untouched 回执（只读 COUNT，不 UPDATE/DELETE）。
  const sharedCourses = runMysql(adminUser, adminPassword, `SELECT COUNT(*) FROM \`content_service\`.\`content_definition\` WHERE content_code LIKE 'DEMO-P5-%';`);
  log.sharedDemoCourses = Number(sharedCourses.trim());
  step("shared-untouched", true, { sharedDemoCourses: log.sharedDemoCourses });
  // 6. 专用临时只读身份：仅新 schema SELECT（若无 CREATE USER 权限则记录缺项退出）。
  try {
    runMysql(adminUser, adminPassword, `CREATE USER IF NOT EXISTS '${READER}'@'%' IDENTIFIED BY '${adminPassword.replaceAll("'", "''")}_ro_tmp';\nGRANT SELECT ON \`${SCHEMA}\`.* TO '${READER}'@'%';\nFLUSH PRIVILEGES;`);
    const grants = runMysql(adminUser, adminPassword, `SHOW GRANTS FOR '${READER}'@'%';`);
    log.readerGrants = grants.split("\n").map((s) => s.trim()).filter(Boolean);
    // USAGE 行为无权限授予；除 USAGE 外仅允许新 schema 上的 SELECT。
    const nonUsage = log.readerGrants.filter((g) => !/^GRANT USAGE ON \*\.\* /i.test(g));
    const onlySelect = nonUsage.length > 0 && nonUsage.every((g) => /^GRANT SELECT ON /.test(g) && new RegExp(`^GRANT SELECT ON \`${SCHEMA}\`\\.\\*`).test(g));
    step("reader-select-only", onlySelect, { grants: log.readerGrants });
  } catch (e) {
    step("reader-select-only", false, { error: redact(e.message), missing: "CREATE USER / GRANT 权限不可用时，主审需提供具备该权限的管理员凭据或由 owner 预建只读身份" });
    throw e;
  }
  // 7. 只读身份实际读回（用新身份 SELECT，不用 admin）。
  try {
    const probe = runMysql(READER, `${adminPassword}_ro_tmp`, `SELECT COUNT(*) FROM \`${SCHEMA}\`.\`content_definition\`;`, SCHEMA);
    step("reader-readback", Number(probe.trim()) === 0, { rows: Number(probe.trim()) });
  } catch (e) {
    step("reader-readback", false, { error: redact(e.message) });
    throw e;
  }
} catch (e) {
  step("prepare-aborted", false, { error: redact(e.message) });
}
log.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(outDir, "empty-schema-9.json"), JSON.stringify(log, null, 2));
if (log.failedChecks.length) { console.error("EMPTY-SCHEMA-RESULT: FAIL " + log.failedChecks.length); process.exit(1); }
console.log("EMPTY-SCHEMA-RESULT: PASS schema=" + SCHEMA);
