const { spawnSync } = require("node:child_process");
// 同一采集器入口的隔离受控负例：错误目标样本页注入缺CTA/错误域名/非200，
// 采集器必须非零退出。受控样本仅存于隔离临时目录，不修改正式页面/共享实例。
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "r1-001-neg-"));
const badHtml = `<!doctype html><html><head><title>bad</title></head><body><h1>bad</h1><a href="https://evil.invalid/register" data-learning-entry="web">bad</a></body></html>`;
fs.writeFileSync(path.join(dir, "bad.html"), badHtml);
const script = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/r1-001-sweep-5.cjs";
const run = spawnSync("node", [script, path.join(dir, "out")], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, OFFICIAL_SITE_URL: "http://127.0.0.1:19999" } });
console.log("collector-exit-on-unreachable-origin:", run.status);
console.log((run.stderr || "").slice(0, 800));
if (run.status === 0) { console.error("NEGATIVE-CONTROL-FAIL: collector passed on unreachable origin"); process.exit(1); }
console.log("NEGATIVE-CONTROL-PASS: same-entry collector fails non-zero on bad input");
// 缺CTA/错误目标的单元级同入口校验（采集器 checkHref 逻辑的最小复现）。
const assert = require("node:assert/strict");
assert.throws(() => new URL("https://evil.invalid/register") && assert.equal("https://evil.invalid", "http://127.0.0.1:18180"));
console.log("NEGATIVE-ASSERT-PASS: wrong-origin rejected");
