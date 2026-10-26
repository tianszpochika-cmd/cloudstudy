import { writeFileSync } from "node:fs";
const { buildPublicLearningEntry } = await import("file:///C:/Users/Administrator/Desktop/my/cloudstudy/apps/official-site/utils/public-links.mjs");
const web = buildPublicLearningEntry({ base: "http://127.0.0.1:18180/", mobile: false, login: false, locale: "zh-CN", theme: "dark", campaign: { utm_source: "official" } });
const mobile = buildPublicLearningEntry({ base: "http://127.0.0.1:18183/", mobile: true, login: false, locale: "zh-CN", theme: "dark", campaign: { utm_source: "official" } });
const report = {
  checkedAt: new Date().toISOString(),
  web: { href: web, hostOk: web.startsWith("http://127.0.0.1:18180/register"), returnToOk: web.includes("returnTo=%2Fhome"), localeOk: web.includes("uiLocale=zh-CN"), themeOk: web.includes("theme=dark") },
  mobile: { href: mobile, hostOk: mobile.startsWith("http://127.0.0.1:18183/"), pageOk: mobile.includes("#/pages/register/register"), returnToOk: mobile.includes("returnTo=%2Fpages%2Fhome%2Fhome"), localeOk: mobile.includes("uiLocale=zh-CN"), themeOk: mobile.includes("theme=dark") },
};
writeFileSync(process.argv[2] ?? "mobile-entry.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
