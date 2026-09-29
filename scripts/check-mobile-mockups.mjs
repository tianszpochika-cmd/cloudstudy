import fs from 'node:fs';
const s = fs.readFileSync('docs/06-design/v2-980plus/redesign/mockups/mobile/app.js', 'utf8');
const shell = fs.readFileSync('docs/06-design/v2-980plus/redesign/mockups/mobile/index.html', 'utf8');
const fail = [];
const screens = new Set([...s.matchAll(/^V\.(\w+)\s*=/gm)].map((m) => m[1]));
for (const t of [...s.matchAll(/nav\('#\/(\w+)'\)/g)].map((m) => m[1])) {
  if (!screens.has(t)) fail.push('ROUTE-MISSING:' + t);
}
const fns = new Set([...s.matchAll(/^function (\w+)\(/gm)].map((m) => m[1]));
for (const h of [...s.matchAll(/onclick="([A-Za-z_]\w*)\(/g)].map((m) => m[1])) {
  if (!fns.has(h) && !['toast', 'nav', 'goBack'].includes(h)) fail.push('HANDLER-MISSING:' + h);
}
const titles = s.match(/const TITLES = \{([^}]*)\}/s)[1].split(',').map((x) => x.trim().split(':')[0]);
for (const k of screens) if (!titles.includes(k)) fail.push('TITLE-MISSING:' + k);
const ids = [...s.matchAll(/getElementById\("([\w-]+)"\)/g)].map((m) => m[1]);
const defined = new Set([...s.matchAll(/id="([\w-]+)"/g)].map((m) => m[1]));
for (const id of new Set(ids)) {
  const inTemplate = s.includes('id="' + id + '"') || s.includes("id='" + id + "'") || shell.includes('id="' + id + '"');
  if (!inTemplate) fail.push('ID-NEVER-RENDERED:' + id);
}
console.log('screens=' + screens.size + ' fails=' + fail.length);
for (const f of [...new Set(fail)]) console.log(' ' + f);
process.exit(fail.length ? 1 : 0);
