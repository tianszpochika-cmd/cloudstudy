#!/usr/bin/env node
/**
 * 文档体系健康检查（只读）
 *
 * 检查项：
 *  1. 内部链接死链
 *  2. 孤儿文档（无任何文档引用，且排除通过 manifest / 台账 ID 索引的目录）
 *  3. 缺少 README.md 索引的目录
 *
 * 用法：
 *   node scripts/audit/doc-audit.mjs            # 全部检查
 *   node scripts/audit/doc-audit.mjs --json     # 输出 JSON
 *
 * 说明：本脚本是只读检查器，不修改任何文件。
 * 参照 requirements/backlog/v2-phase1-rebaseline/execution/asset-preflight-report-2026-09-10.md
 * 与 docs/00-vision/document-audit-2026-09-10.md 的审计口径。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const JSON_MODE = process.argv.includes('--json');
const SKIP_DIRS = new Set(['node_modules', 'target', '.git', 'dist', '.turbo', '.workbuddy']);

// 通过非 Markdown 链接索引的目录：其中的 .md 不算孤儿
const INDEXED_BY_OTHER_MEANS = [
  /^evidence[\\/]/,                                  // 由 manifest.json 索引
  /requirements[\\/]backlog[\\/]v2-phase1-rebaseline[\\/]execution[\\/]/ // 由台账 ID 引用
];

const files = [];
(function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(path.join(dir, e.name));
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
      files.push(path.join(dir, e.name));
    }
  }
})(ROOT);

const linkRe = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const dead = [];
const referenced = new Set();
let linkCount = 0;

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const dir = path.dirname(f);
  let m;
  while ((m = linkRe.exec(content)) !== null) {
    const raw = m[1].trim();
    if (/^(https?:|mailto:|tel:|data:)/i.test(raw)) continue;
    if (raw.startsWith('#')) continue;
    let clean = raw.split('#')[0];
    if (!clean) continue;
    try { clean = decodeURIComponent(clean); } catch { /* keep */ }
    linkCount++;
    const resolved = path.resolve(dir, clean);
    if (!fs.existsSync(resolved)) {
      dead.push({ file: path.relative(ROOT, f), target: raw });
    } else if (fs.statSync(resolved).isFile()) {
      referenced.add(resolved);
    }
  }
}

const ROOT_ENTRY = new Set(
  ['README.md', 'AGENTS.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md'].map((n) => path.join(ROOT, n))
);
const rel = (p) => path.relative(ROOT, p);

// 文档体系范围：仅对 docs/ requirements/ evidence/ 要求索引与入链。
// 代码目录（apps/ services/ packages/ 等）不要求 README，也不参与孤儿判定。
const SCOPE_RE = /^(docs|requirements|evidence)[\\/]/;
const inScope = (p) => SCOPE_RE.test(rel(p));

const orphans = files.filter(
  (f) =>
    inScope(f) &&
    !referenced.has(f) &&
    !ROOT_ENTRY.has(f) &&
    !INDEXED_BY_OTHER_MEANS.some((re) => re.test(rel(f)))
);

const dirsMissingReadme = [];
(function scanDirs(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  const subdirs = entries.filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name));
  const hasMd = entries.some((e) => e.isFile() && e.name.toLowerCase().endsWith('.md'));
  // 只对「含文档且处在文档范围内」的目录要求 README。
  // evidence/** 由所在目录的 manifest.json 索引，豁免 README 要求。
  const r = rel(dir);
  const exempt = /^evidence[\\/]/.test(r);
  if (hasMd && inScope(dir) && !exempt && !fs.existsSync(path.join(dir, 'README.md'))) {
    dirsMissingReadme.push(r);
  }
  for (const d of subdirs) scanDirs(path.join(dir, d.name));
})(ROOT);

const result = {
  schemaVersion: 1,
  scannedFiles: files.length,
  internalLinks: linkCount,
  deadLinks: dead.length,
  orphanDocs: orphans.length,
  dirsMissingReadme: dirsMissingReadme.length,
  ok: dead.length === 0 && dirsMissingReadme.length === 0,
  details: { dead, orphans: orphans.map(rel), dirsMissingReadme }
};

if (JSON_MODE) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('=== 文档体系健康检查 ===');
  console.log(`扫描文档: ${result.scannedFiles} 个 | 内部链接: ${result.internalLinks} 条`);
  console.log('');
  console.log(`死链: ${result.deadLinks}`);
  for (const d of dead.slice(0, 20)) console.log(`  ${d.file}  ->  ${d.target}`);
  console.log(`孤儿文档: ${result.orphanDocs}`);
  for (const o of orphans.slice(0, 15).map(rel)) console.log(`  ${o}`);
  console.log(`缺 README 的目录: ${result.dirsMissingReadme}`);
  for (const d of dirsMissingReadme) console.log(`  ${d}`);
  console.log('');
  console.log('结果:', result.ok ? 'PASS' : 'FAIL');
}

process.exit(result.ok ? 0 : 1);
