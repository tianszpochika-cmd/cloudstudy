import { writeFileSync } from "node:fs";
const base = "http://127.0.0.1:18182";
// TC03: malicious returnTo inputs must never become a CTA target; the fixed
// registration href keeps returnTo=/home. Double-click must not mint sessions.
const cases = [
  { name: "external-https", returnTo: "https://evil.invalid" },
  { name: "protocol-relative", returnTo: "//evil" },
  { name: "encoded-slash", returnTo: "%2Fhome%2F..%2Fevil" },
  { name: "backslash", returnTo: "\\evil" },
];
const { safePublicReturnTo, buildPublicLearningEntry } = await import("file:///C:/Users/Administrator/Desktop/my/cloudstudy/apps/official-site/utils/public-links.mjs");
const rows = cases.map((c) => ({ ...c, sanitized: safePublicReturnTo(c.returnTo, "/home") }));
const hrefs = [];
for (let i = 0; i < 2; i++) {
  hrefs.push(buildPublicLearningEntry({ base: "http://127.0.0.1:18180/", mobile: false, login: false, locale: "zh-CN", theme: "system", campaign: {} }));
}
const repeatedClickSame = hrefs[0] === hrefs[1];
const res = await fetch(base + "/");
const html = await res.text();
const tokens = ["yuxuexing_refresh", "accessToken", "refreshToken", "Authorization:"];
const tokenHits = tokens.filter((t) => html.includes(t));
const storageHits = ["localStorage.setItem(\"yx.auth", "sessionStorage.setItem(\"yx.auth", "yx.official.token"].filter((t) => html.includes(t));
const report = { base, checkedAt: new Date().toISOString(), sanitizedReturnTos: rows, repeatedClickSameHref: repeatedClickSame, officialHtmlHasBusinessToken: tokenHits, officialHtmlHasAuthStorage: storageHits, allSanitizedToHome: rows.every((r) => r.sanitized === "/home") };
writeFileSync(process.argv[2] ?? "tc03.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
