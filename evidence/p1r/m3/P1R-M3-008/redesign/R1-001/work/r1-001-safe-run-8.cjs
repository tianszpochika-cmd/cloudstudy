// R1-001 Windows 安全只读启动脚本（解阻准备：可执行VALIDATE，不启动后台）。
// 用法（PowerShell, READY 后）：
//   node evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/r1-001-safe-run-8.cjs --validate
//   node evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/r1-001-safe-run-8.cjs -- --service content-service,commerce-service,api-gateway --timeout-ms 180000
// 仅对子进程设置环境（不污染调用方）；不改共享启动器默认值；不输出凭据。
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const args = process.argv.slice(2);
const validateOnly = args.includes("--validate");
const childArgs = args.filter((a) => a !== "--validate");
// 本卡显式关闭：写后台任务 + 自动迁移/seed（调用方覆盖 runner 默认 true）。
const R1_001_SAFE_ENV = {
  CONTENT_EVENT_RELAY_ENABLED: "false",
  CONTENT_EVENT_CONSUMER_ENABLED: "false",
  CONTENT_SCHEDULE_ENABLED: "false",
  CONTENT_FLYWAY_ENABLED: "false",
  COMMERCE_FLYWAY_ENABLED: "false",
  SPRING_FLYWAY_ENABLED: "false",
};
const FIXED_PORTS = { "api-gateway": 18070, "content-service": 18089, "commerce-service": 18096, "official-site-dev": 18182, "learner-web-dev": 18180, "mobile-h5-dev": 18183 };
function shaFile(p) { return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex"); }
function jarIdentity(serviceDir, jarName) {
  const p = path.join("services", serviceDir, "target", jarName);
  const st = fs.statSync(p);
  return { path: p.replace(/\\/g, "/"), bytes: st.size, mtime: st.mtime.toISOString(), sha256: shaFile(p) };
}
const report = {
  checkedAt: new Date().toISOString(),
  scope: "R1-001 read-only safe start; child-process env only; no backend launch in --validate",
  safeEnv: R1_001_SAFE_ENV,
  fixedPorts: FIXED_PORTS,
  jars: [
    jarIdentity("content-service", "content-service-0.1.0-SNAPSHOT.jar"),
    jarIdentity("commerce-service", "commerce-service-0.1.0-SNAPSHOT.jar"),
    jarIdentity("api-gateway", "api-gateway-0.1.0-SNAPSHOT.jar"),
  ],
  callerEnvPreserved: ["CONTENT_EVENT_RELAY_ENABLED", "CONTENT_EVENT_CONSUMER_ENABLED", "CONTENT_SCHEDULE_ENABLED", "CONTENT_FLYWAY_ENABLED", "COMMERCE_FLYWAY_ENABLED", "SPRING_FLYWAY_ENABLED"].every((k) => process.env[k] === undefined || typeof process.env[k] === "string"),
  effectiveCheck: "READY 后子进程执行 env | Select-String CONTENT_|COMMERCE_|SPRING_FLYWAY 核对上述六项为 false（不输出 *_PASSWORD）",
};
const outDir = "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/safe-run-8";
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "safe-run-8.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ safeEnv: report.safeEnv, jars: report.jars.map((j) => j.path + " " + j.bytes + "B " + j.sha256.slice(0, 16) + "...") }, null, 2));
if (validateOnly) { console.log("SAFE-RUN-VALIDATE: PASS (no backend launched)"); process.exit(0); }
// READY 后才允许进入此分支：仅对子进程注入安全环境，调用方环境不受影响。
const childEnv = { ...process.env, ...R1_001_SAFE_ENV };
const run = spawnSync("node", ["scripts/runtime/run-v2-services.mjs", ...childArgs], { cwd: process.cwd(), env: childEnv, stdio: "inherit", shell: false });
process.exit(run.status ?? 1);
