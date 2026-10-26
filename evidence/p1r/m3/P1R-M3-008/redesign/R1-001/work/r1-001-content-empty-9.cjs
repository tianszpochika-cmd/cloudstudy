// R1-001 自有 content 启动器（专用空 schema 阶段）：直接启动现有 content jar，
// 绕开 runner 的 content_service owner 绑定分支。不改共享 runner/端口。
// 用法（PowerShell, READY 后）：
//   node evidence/.../work/r1-001-content-empty-9.cjs --validate   # 静态预检，不启动
//   node evidence/.../work/r1-001-content-empty-9.cjs --start      # 启动 18089（前台，随 Ctrl+C 停止）
// 密码仅对子进程安全注入，不放命令行；P1R_DIAG 显式关闭。
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const mode = process.argv.includes("--start") ? "start" : "validate";
const SCHEMA = "r1_001_empty_20261005_t9b";
const FIXED_PORT = 18089;
const FIXED_HOST = "127.0.0.1";
// 白名单安全开关（仅输出这六项；禁止泛扫环境）。
const SAFE_KEYS = ["CONTENT_EVENT_RELAY_ENABLED", "CONTENT_EVENT_CONSUMER_ENABLED", "CONTENT_SCHEDULE_ENABLED", "CONTENT_FLYWAY_ENABLED", "SPRING_FLYWAY_ENABLED", "P1R_DIAG"];
const childEnv = {
  CONTENT_PERSISTENCE_MODE: "jdbc",
  CONTENT_JDBC_URL: `jdbc:mysql://127.0.0.1:13306/${SCHEMA}?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true`,
  CONTENT_JDBC_USERNAME: "svc_content",
  CONTENT_SERVICE_SCHEMA: SCHEMA,
  CONTENT_SERVICE_SERVER_ADDRESS: FIXED_HOST,
  CONTENT_SERVICE_PORT: String(FIXED_PORT),
  CONTENT_EVENT_RELAY_ENABLED: "false",
  CONTENT_EVENT_CONSUMER_ENABLED: "false",
  CONTENT_SCHEDULE_ENABLED: "false",
  CONTENT_FLYWAY_ENABLED: "false",
  SPRING_FLYWAY_ENABLED: "false",
  P1R_DIAG: "0",
};
function shaFile(p) { return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex"); }
const jarPath = path.join("services", "content-service", "target", "content-service-0.1.0-SNAPSHOT.jar");
const jarStat = fs.statSync(jarPath);
const report = {
  checkedAt: new Date().toISOString(),
  scope: "own content launcher for isolated empty schema; child-process env only",
  schema: SCHEMA,
  host: FIXED_HOST,
  port: FIXED_PORT,
  jar: { path: jarPath.replace(/\\/g, "/"), bytes: jarStat.size, mtime: jarStat.mtime.toISOString(), sha256: shaFile(jarPath) },
  safeEnv: Object.fromEntries(SAFE_KEYS.filter((k) => k !== "P1R_DIAG").map((k) => [k, childEnv[k]])),
  passwordPolicy: "CONTENT_JDBC_PASSWORD injected into child env only (from MYSQL_OWNER_PASSWORD at start time); never on command line, never in reports",
  desensitizedJdbc: `jdbc:mysql://127.0.0.1:13306/${SCHEMA}?... (user=svc_content)`,
};
const outDir = "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/content-empty-9";
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "content-empty-9.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ schema: SCHEMA, port: FIXED_PORT, jar: `${report.jar.bytes}B ${report.jar.sha256.slice(0, 16)}...`, safeEnv: report.safeEnv }, null, 2));
if (mode === "validate") { console.log("CONTENT-EMPTY-VALIDATE: PASS (no backend launched)"); process.exit(0); }
// --start：READY 后才允许。密码此时才从调用方环境读入，仅进子进程 env。
const jdbcPassword = process.env.MYSQL_OWNER_PASSWORD;
if (!jdbcPassword) { console.error("CONTENT-EMPTY-START-FAIL: missing MYSQL_OWNER_PASSWORD in caller env (not stored)"); process.exit(2); }
const run = spawnSync("java", ["-jar", jarPath, `--server.address=${FIXED_HOST}`, `--server.port=${FIXED_PORT}`, "--spring.profiles.active=v2,local-real", "--local.runtime.mode=local-real"],
  { cwd: process.cwd(), env: { ...process.env, ...childEnv, CONTENT_JDBC_PASSWORD: jdbcPassword }, stdio: "inherit", shell: false });
process.exit(run.status ?? 1);
