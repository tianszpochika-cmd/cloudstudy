// 版本11同模块负例（MOCKED）：直接调用真实采集器同一 collectFromPage。
// 全隐藏/全禁用/错设备/错路径必须失败；visibleCount=0 不得 PASS。
// 菜单路径负例：菜单打开后仍无可操作入口必须失败（菜单替身）。
const { collectFromPage, expectedForViewport } = require("./r1-001-sweep-11.cjs");
function fakePage(entries, status = 200, menuEntries = null) {
  let menuOpen = false;
  const normalized = entries.map((e) => ({ visible: true, actionable: true, ...e }));
  const normalizedMenu = menuEntries === null ? null : menuEntries.map((e) => ({ visible: true, actionable: true, ...e }));
  return {
    __r1Status: status,
    locator: (selector) => {
      if (selector === "h1") return { first: () => ({ waitFor: async () => {}, innerText: async () => "Test fixture" }) };
      if (selector === "header button.menu-toggle") {
        return { first: () => ({ click: async () => { menuOpen = true; } }), count: async () => 1 };
      }
      if (selector === "dialog[open]") return { count: async () => (menuOpen ? 1 : 0) };
      return {
        first: () => ({ waitFor: async () => {}, click: async () => { menuOpen = true; } }),
        evaluateAll: async () => (menuOpen && normalizedMenu !== null ? normalizedMenu : normalized),
      };
    },
    evaluate: async () => false,
    waitForTimeout: async () => {},
  };
}
let currentLabel = "1440x900";
async function runCollect(entries, label, status = 200, menuEntries = null) {
  currentLabel = label;
  void expectedForViewport;
  return collectFromPage(fakePage(entries, status, menuEntries), label, "/courses");
}
const web = (visible = true, actionable = true) => ({ href: "http://127.0.0.1:18180/register?returnTo=%2Fhome&uiLocale=zh-CN&theme=system", target: "web", visible, actionable });
const mobile = (visible = true, actionable = true) => ({ href: "http://127.0.0.1:18183/#/pages/register/register?returnTo=%2Fpages%2Fhome%2Fhome&uiLocale=zh-CN&theme=system", target: "mobile", visible, actionable });
const cases = [
  ["valid-web", "1440x900", [web()], true, 200, null],
  ["valid-mobile", "375x812", [mobile()], true, 200, null],
  ["non-200-status", "1440x900", [web()], false, 503, null],
  ["missing-cta", "1440x900", [], false, 200, null],
  ["wrong-origin", "1440x900", [{ href: "https://evil.invalid/register?returnTo=%2Fhome&uiLocale=zh-CN&theme=system", target: "web", visible: true, actionable: true }], false, 200, null],
  ["wrong-web-path", "1440x900", [{ href: "http://127.0.0.1:18180/register-incorrect?returnTo=%2Fhome&uiLocale=zh-CN&theme=system", target: "web", visible: true, actionable: true }], false, 200, null],
  ["path-only-in-query", "1440x900", [{ href: "http://127.0.0.1:18180/incorrect?extra=/register&returnTo=%2Fhome&uiLocale=zh-CN&theme=system", target: "web", visible: true, actionable: true }], false, 200, null],
  ["wrong-mobile-path", "375x812", [{ href: "http://127.0.0.1:18183/#/pages/register/register-incorrect?returnTo=%2Fpages%2Fhome%2Fhome&uiLocale=zh-CN&theme=system", target: "mobile", visible: true, actionable: true }], false, 200, null],
  ["wrong-device-mobile-viewport", "375x812", [web()], false, 200, null],
  ["wrong-device-desktop-viewport", "1440x900", [mobile()], false, 200, null],
  ["all-hidden-no-menu-entry", "375x812", [mobile(false, true)], false, 200, [mobile(false, true)]],
  ["all-disabled-no-menu-entry", "375x812", [mobile(true, false)], false, 200, [mobile(true, false)]],
  ["menu-opens-operable-pass", "375x812", [mobile(false, true)], true, 200, [mobile(true, true)]],
];
(async () => {
  const log = { checkedAt: new Date().toISOString(), mocked: true, scope: "same collectFromPage v11 incl. operable gate + menu path; synthetic DOM facts only", rows: [], failedChecks: [] };
  for (const [name, label, entries, expectedAccepted, status, menuEntries] of cases) {
    let accepted = true, error = null;
    try { await runCollect(entries, label, status, menuEntries); }
    catch (e) { accepted = false; error = String(e.message || e).slice(0, 300); }
    const ok = accepted === expectedAccepted;
    log.rows.push({ name, label, entries, expectedAccepted, accepted, matchesExpectation: ok, error });
    if (ok) console.log("NEG-PASS:" + name);
    else { log.failedChecks.push(name); console.error("NEG-FAIL:" + name + " " + JSON.stringify({ accepted, expectedAccepted, error }).slice(0, 300)); }
  }
  const fs = require("node:fs");
  const path = require("node:path");
  const outDir = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/negative-11";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "negative-11.json"), JSON.stringify(log, null, 2));
  if (log.failedChecks.length) { console.error("NEGATIVE-RESULT: FAIL " + log.failedChecks.length); process.exit(1); }
  console.log("NEGATIVE-RESULT: PASS (MOCKED collector proof only)");
})().catch((e) => { console.error("NEG-FAIL:" + (e.stack || e.message)); process.exit(1); });
