// 版本7同入口负例（MOCKED）：与真实采集共用 HTTP/设备/入口集合/可见性断言。
// 合法基准 + 非200/缺CTA/错origin/错path/错设备/全隐藏，仅内存输入，不起新端口。
const assert = require("node:assert/strict");
const { checkHrefStrict, expectedForViewport } = require("./r1-001-sweep-7.cjs");
// 与采集器同一 collectFromPage 语义的最小 DOM 替身（h1 可见 + 条目集合；
// 设备正确性由 target 判定，可见性如实记录不作通过门——与采集器一致）。
function fakePage(entries, status = 200) {
  const normalized = entries.map((e) => ({ visible: true, actionable: true, ...e }));
  return {
    __r1Status: status,
    locator: (selector) => {
      if (selector === "h1") return { first: () => ({ waitFor: async () => {}, innerText: async () => "Test fixture" }) };
      return {
        first: () => ({ waitFor: async () => {} }),
        evaluateAll: async () => normalized,
      };
    },
    evaluate: async () => false,
    waitForTimeout: async () => {},
  };
}
let currentLabel = "1440x900";
async function runCollect(entries, label, status = 200) {
  currentLabel = label;
  const { collectFromPage } = require("./r1-001-sweep-7.cjs");
  return collectFromPage(fakePage(entries, status), label, "/courses");
}
const web = (visible = true) => ({ href: "http://127.0.0.1:18180/register?returnTo=%2Fhome&uiLocale=zh-CN&theme=system", target: "web", visible });
const mobile = (visible = true) => ({ href: "http://127.0.0.1:18183/#/pages/register/register?returnTo=%2Fpages%2Fhome%2Fhome&uiLocale=zh-CN&theme=system", target: "mobile", visible });
const cases = [
  ["valid-web", "1440x900", [web()], true, 200],
  ["valid-mobile", "375x812", [mobile()], true, 200],
  ["non-200-status", "1440x900", [web()], false, 503],
  ["missing-cta", "1440x900", [], false, 200],
  ["wrong-origin", "1440x900", [{ href: "https://evil.invalid/register?returnTo=%2Fhome&uiLocale=zh-CN&theme=system", target: "web", visible: true }], false, 200],
  ["wrong-web-path", "1440x900", [{ href: "http://127.0.0.1:18180/register-incorrect?returnTo=%2Fhome&uiLocale=zh-CN&theme=system", target: "web", visible: true }], false, 200],
  ["path-only-in-query", "1440x900", [{ href: "http://127.0.0.1:18180/incorrect?extra=/register&returnTo=%2Fhome&uiLocale=zh-CN&theme=system", target: "web", visible: true }], false, 200],
  ["wrong-mobile-path", "375x812", [{ href: "http://127.0.0.1:18183/#/pages/register/register-incorrect?returnTo=%2Fpages%2Fhome%2Fhome&uiLocale=zh-CN&theme=system", target: "mobile", visible: true }], false, 200],
  ["wrong-device-mobile-viewport", "375x812", [web()], false, 200],
  ["wrong-device-desktop-viewport", "1440x900", [mobile()], false, 200],
  ["hidden-mobile-recorded", "375x812", [mobile(false)], true, 200],
];
(async () => {
  const log = { checkedAt: new Date().toISOString(), mocked: true, scope: "same collectFromPage + checkHrefStrict + HTTP/device/visibility assertions; synthetic DOM facts only", rows: [], failedChecks: [] };
  for (const [name, label, entries, expectedAccepted, status] of cases) {
    let accepted = true, error = null;
    try { await runCollect(entries, label, status); }
    catch (e) { accepted = false; error = String(e.message || e).slice(0, 300); }
    const ok = accepted === expectedAccepted;
    log.rows.push({ name, label, entries, expectedAccepted, accepted, matchesExpectation: ok, error });
    if (ok) console.log("NEG-PASS:" + name);
    else { log.failedChecks.push(name); console.error("NEG-FAIL:" + name + " " + JSON.stringify({ accepted, expectedAccepted, error }).slice(0, 300)); }
  }
  const fs = require("node:fs");
  const path = require("node:path");
  const outDir = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/negative-7";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "negative-7.json"), JSON.stringify(log, null, 2));
  if (log.failedChecks.length) { console.error("NEGATIVE-RESULT: FAIL " + log.failedChecks.length); process.exit(1); }
  console.log("NEGATIVE-RESULT: PASS (MOCKED collector proof only)");
})().catch((e) => { console.error("NEG-FAIL:" + (e.stack || e.message)); process.exit(1); });
