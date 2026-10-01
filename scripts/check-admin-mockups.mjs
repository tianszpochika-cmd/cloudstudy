import fs from 'node:fs';
const s = fs.readFileSync('docs/06-design/v2-980plus/redesign/mockups/admin/app.js', 'utf8');
const shell = fs.readFileSync('docs/06-design/v2-980plus/redesign/mockups/admin/index.html', 'utf8');
const fail = [];
const screens = new Set([...s.matchAll(/^AV\.(\w+)\s*=/gm)].map((m) => m[1]));
for (const t of [...s.matchAll(/anav\('#\/(\w+)'\)/g)].map((m) => m[1])) {
  if (!screens.has(t)) fail.push('ROUTE-MISSING:' + t);
}
const fns = new Set([...s.matchAll(/^function (\w+)\(/gm)].map((m) => m[1]));
for (const h of [...s.matchAll(/onclick="([A-Za-z_]\w*)\(/g)].map((m) => m[1])) {
  if (!fns.has(h) && !['atoast', 'anav', 'agoBack', 'aarm'].includes(h)) fail.push('HANDLER-MISSING:' + h);
}
const titles = [...s.matchAll(/^\s*(\w+): "/gm)].map((m) => m[1]);
for (const k of screens) if (!s.includes(k + ': "')) fail.push('TITLE-MISSING:' + k);
const ids = [...s.matchAll(/getElementById\("([\w-]+)"\)/g)].map((m) => m[1]);
for (const id of new Set(ids)) {
  const inTemplate = s.includes('id="' + id + '"') || shell.includes('id="' + id + '"');
  if (!inTemplate) fail.push('ID-NEVER-RENDERED:' + id);
}
console.log('screens=' + screens.size + ' fails=' + fail.length);
for (const f of [...new Set(fail)]) console.log(' ' + f);
process.exit(fail.length ? 1 : 0);
