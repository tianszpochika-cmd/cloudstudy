// 同一实际校验模块的受控负例（MOCKED）：直接调用版本6采集器的
// checkHrefStrict/expectedEntry，覆盖合法入口、非200、缺CTA、错误域名、
// 错误路径、错误设备。受控输入仅内存 URL，不启动新端口，不改正式页面。
const assert = require("node:assert/strict");
const { checkHrefStrict, expectedEntry } = require("./r1-001-sweep-6.cjs");
const cases = [
  ["valid-web", "1440x900", "http://127.0.0.1:18180/register?returnTo=%2Fhome&uiLocale=zh-CN&theme=system", true],
  ["wrong-web-path", "1440x900", "http://127.0.0.1:18180/register-incorrect?returnTo=%2Fhome&uiLocale=zh-CN&theme=system", false],
  ["path-only-in-query", "1440x900", "http://127.0.0.1:18180/incorrect?extra=/register&returnTo=%2Fhome&uiLocale=zh-CN&theme=system", false],
  ["missing-cta", "1440x900", null, false],
  ["non-200-status", "1440x900", "http://127.0.0.1:18180/register?returnTo=%2Fhome&uiLocale=zh-CN&theme=system", false, { httpStatus: 503 }],
  ["valid-mobile", "375x812", "http://127.0.0.1:18183/#/pages/register/register?returnTo=%2Fpages%2Fhome%2Fhome&uiLocale=zh-CN&theme=system", true],
  ["wrong-mobile-path", "375x812", "http://127.0.0.1:18183/#/pages/register/register-incorrect?returnTo=%2Fpages%2Fhome%2Fhome&uiLocale=zh-CN&theme=system", false],
  ["mobile-hash-suffix", "375x812", "http://127.0.0.1:18183/#/pages/register/register?returnTo=%2Fpages%2Fhome%2Fhome&uiLocale=zh-CN&theme=system&extra=x", true, { note: "多余query允许；路径仍严格" }],
  ["wrong-origin", "1440x900", "https://evil.invalid/register?returnTo=%2Fhome&uiLocale=zh-CN&theme=system", false],
  ["wrong-device", "375x812", "http://127.0.0.1:18180/register?returnTo=%2Fhome&uiLocale=zh-CN&theme=system", false],
];
const log = { checkedAt: new Date().toISOString(), mocked: true, scope: "same checkHrefStrict module; synthetic URLs only; proves collector, not product", rows: [], failedChecks: [] };
for (const [name, viewport, href, expectedAccepted, extra] of cases) {
  let accepted = true, error = null;
  try {
    if (href === null) throw new Error(viewport + " missing CTA: no data-learning-entry href");
    if (extra && extra.httpStatus && extra.httpStatus !== 200) throw new Error(viewport + " http=" + extra.httpStatus);
    checkHrefStrict(href, expectedEntry(viewport), name);
  } catch (e) { accepted = false; error = e.message; }
  const ok = accepted === expectedAccepted;
  log.rows.push({ name, href, expectedAccepted, accepted, matchesExpectation: ok, error });
  if (ok) console.log("NEG-PASS:" + name);
  else { log.failedChecks.push(name); console.error("NEG-FAIL:" + name + " " + JSON.stringify({ accepted, expectedAccepted, error }).slice(0, 300)); }
}
const fs = require("node:fs");
const path = require("node:path");
const outDir = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/negative-6";
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "negative-6.json"), JSON.stringify(log, null, 2));
if (log.failedChecks.length) { console.error("NEGATIVE-RESULT: FAIL " + log.failedChecks.length); process.exit(1); }
console.log("NEGATIVE-RESULT: PASS (MOCKED collector proof only)");
