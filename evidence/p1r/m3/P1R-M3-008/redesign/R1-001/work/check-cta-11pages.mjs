import { writeFileSync } from "node:fs";
const base = "http://127.0.0.1:18182";
const pages = ["/", "/courses", "/pricing", "/download", "/announcements", "/about", "/compliance", "/status", "/privacy", "/terms", "/minors"];
const rows = [];
for (const page of pages) {
  const startedAt = new Date().toISOString();
  const res = await fetch(base + page);
  const html = await res.text();
  const tags = [...html.matchAll(/<a[^>]*data-learning-entry[^>]*>/g)];
  const hrefs = [...html.matchAll(/href="([^"]+)"[^>]*data-learning-entry|data-learning-entry[^>]*href="([^"]+)"/g)].map((m) => (m[1] ?? m[2] ?? "").replaceAll("&amp;", "&").slice(0, 240));
  const hasStartFallback = html.includes('href="/start"');
  rows.push({ page, status: res.status, bytes: html.length, ctaTags: tags.length, hrefs: hrefs.slice(0, 4), hasStartFallback, checkedAt: startedAt });
  console.log(page, res.status, "cta=" + tags.length, hrefs[0] ?? "(none)");
}
writeFileSync(process.argv[2] ?? "cta-11pages.json", JSON.stringify({ base, checkedAt: new Date().toISOString(), rows }, null, 2));
