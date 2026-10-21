// Read-only local HTTP probe: which mobile-experience module does the running
// 18183 dev server actually serve? Follows the exact import URL found in
// /src/platform/experience.ts. Local JS modules only; no real API, no cookies,
// no headers, no request bodies, no service restart.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '../../../../../..');
const BASE = 'http://127.0.0.1:18183';
const OUT = path.resolve(__dirname, '..', 'runs', 'c3-root-review');
fs.mkdirSync(OUT, { recursive: true });

const FACTS = {
  completedCount: 'completedCount',
  newZhCompletedCount: '已完成 {count} 题',
  oldZhReceived: '已接收 {count} 题',
  newZhProgress: '答题进度',
  oldZhProgress: '已接收答案进度',
  newEnCompleted: 'Completed {count}',
  oldEnReceived: '{count} of {total} answers received',
};

function factsOf(text) {
  return Object.fromEntries(Object.entries(FACTS).map(([k, v]) => [k, text.includes(v)]));
}

async function get(url) {
  const res = await fetch(url, { redirect: 'follow' });
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    url: res.url,
    status: res.status,
    contentType: res.headers.get('content-type'),
    bytes: buf.length,
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    text: buf.toString('utf8'),
  };
}

(async () => {
  const out = { at: new Date().toISOString(), scope: 'MB006_C3_SERVED_MOBILE_EXPERIENCE_MODULE_READ_ONLY', base: BASE, steps: [] };
  try {
    const experience = await get(`${BASE}/src/platform/experience.ts`);
    out.steps.push({ name: 'experience-ts', url: experience.url, status: experience.status, contentType: experience.contentType, bytes: experience.bytes, sha256: experience.sha256 });

    const matches = [...experience.text.matchAll(/["']([^"']*mobile-experience[^"']*)["']/g)].map((m) => m[1]);
    out.importSpecifiers = [...new Set(matches)];
    if (!out.importSpecifiers.length) {
      out.verdict = 'UNVERIFIED_NO_IMPORT_SPECIFIER';
    } else {
      const spec = out.importSpecifiers[0];
      const moduleUrl = new URL(spec, `${BASE}/src/platform/experience.ts`).toString();
      out.followedImportUrl = moduleUrl;
      const mod = await get(moduleUrl);
      out.steps.push({ name: 'mobile-experience-module', url: mod.url, status: mod.status, contentType: mod.contentType, bytes: mod.bytes, sha256: mod.sha256 });

      const servedFacts = factsOf(mod.text);
      const localPath = path.join(ROOT, 'packages/i18n/src/mobile-experience.ts');
      const localBuf = fs.readFileSync(localPath);
      const localText = localBuf.toString('utf8');
      const localFacts = factsOf(localText);
      out.served = { facts: servedFacts };
      out.local = {
        path: 'packages/i18n/src/mobile-experience.ts',
        bytes: localBuf.length,
        sha256: crypto.createHash('sha256').update(localBuf).digest('hex'),
        facts: localFacts,
      };
      const fileNew = localFacts.completedCount && localFacts.newZhCompletedCount && localFacts.newZhProgress && !localFacts.oldZhReceived && !localFacts.oldZhProgress;
      const servedNew = servedFacts.completedCount && servedFacts.newZhCompletedCount && servedFacts.newZhProgress && !servedFacts.oldZhReceived && !servedFacts.oldZhProgress;
      out.verdict = !fileNew ? 'FILE_UNEXPECTED' : servedNew ? 'FILE_AND_SERVED_NEW' : (servedFacts.oldZhReceived && servedFacts.oldZhProgress && !servedFacts.completedCount) ? 'FILE_NEW_SERVED_OLD' : 'MIXED_OR_UNVERIFIED';
    }
  } catch (error) {
    out.error = { message: error.message };
    out.verdict = 'UNVERIFIED_HTTP_ERROR';
  }
  fs.writeFileSync(path.join(OUT, 'served-module-probe.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify({ verdict: out.verdict, importSpecifiers: out.importSpecifiers, followedImportUrl: out.followedImportUrl, served: out.served, local: out.local }, null, 2));
  if (!out.verdict || out.verdict.startsWith('UNVERIFIED')) process.exitCode = 1;
})();
