import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
function sh(cmd) {
  return execSync(cmd, { encoding: "utf8", cwd: "C:/Users/Administrator/Desktop/my/cloudstudy", windowsHide: true, timeout: 120000 });
}
const startedAt = new Date().toISOString();
const unit = sh("node --test apps/official-site/tests/public-projection-bff.test.mjs apps/official-site/tests/b13-official-site.test.mjs apps/official-site/tests/b14-fe-005.test.mjs apps/official-site/tests/website-entry.test.mjs");
const unitTail = unit.trim().split("\n").slice(-8).join("\n");
const build = sh("pnpm --dir apps/official-site build");
const buildDone = build.includes("Build complete!");
const report = {
  checkedAt: startedAt,
  finishedAt: new Date().toISOString(),
  unitTests: { command: "node --test <4 official files>", tail: unitTail },
  build: { command: "pnpm --dir apps/official-site build", buildComplete: buildDone },
};
writeFileSync(process.argv[2] ?? "selftest.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
