import { writeFileSync } from "node:fs";
const base = "http://127.0.0.1:18182";
const pages = ["/", "/courses", "/pricing", "/download", "/announcements", "/about", "/compliance", "/status", "/privacy", "/terms", "/minors"];
const rows = [];
for (const page of pages) {
  const startedAt = new Date().toISOString();
  const res = await fetch(base + page, { headers: { "user-agent": "R1-001-rework-probe" } });
  const html = await res.text();
  const web = [...html.matchAll(/data-learning-entry="web"/g)].length;
  const mobile = [...html.matchAll(/data-learning-entry="mobile"/g)].length;
  const legacy = [...html.matchAll(/data-learning-entry(?!=")/g)].length;
  const facets = (html.match(/facet-recovery|facet-updated/g) || []).length;
  rows.push({ page, status: res.status, bytes: html.length, dataLearningEntryWeb: web, dataLearningEntryMobile: mobile, dataLearningEntryLegacy: legacy, facetMarks: facets, checkedAt: startedAt });
  console.log(page, res.status, "web=" + web, "mobile=" + mobile, "legacy=" + legacy);
}
writeFileSync(process.argv[2] ?? "cta-rework.json", JSON.stringify({ base, checkedAt: new Date().toISOString(), note: "SSR desktop UA: web entries expected; mobile verified via useLearningDevice unit path and registerLink(mobile) builder output", rows }, null, 2));
