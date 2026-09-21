/**
 * Hardcoded-CJK inventory for the i18n migration (B4-09 follow-up).
 * Scans Vue/TS sources for CJK literals outside comments and reports a
 * per-file inventory plus per-app totals as JSON. It never rewrites files:
 * extraction itself stays a reviewed, per-file batch.
 *
 * Usage: node scripts/i18n/extract-hardcoded.mjs [--app admin-web] [--json out.json]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..', '..')
const args = process.argv.slice(2)
const appFlag = args.indexOf('--app')
const onlyApp = appFlag >= 0 ? args[appFlag + 1] : null
const jsonFlag = args.indexOf('--json')
const outJson = jsonFlag >= 0 ? args[jsonFlag + 1] : null

const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/
const EXCLUDE_DIRS = new Set(['node_modules', 'dist', '.nuxt', '.output', 'coverage'])

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (EXCLUDE_DIRS.has(entry)) continue
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full, files)
    else if (/\.(vue|ts)$/.test(entry) && !/\.test\./.test(entry) && !/\.d\.ts$/.test(entry)) files.push(full)
  }
  return files
}

function stripComments(source, isVue) {
  // Crude but sufficient for inventory: drop line comments and template comments.
  return source
    .split('\n')
    .map((line) => {
      const noLineComment = line.replace(/\/\*.*?\*\//g, '')
      const cut = noLineComment.search(/(^|[^:])\/\//)
      return cut >= 0 ? noLineComment.slice(0, cut + (noLineComment[cut] === '/' ? 0 : 1)) : noLineComment
    })
    .join('\n')
    .replace(/<!--[\s\S]*?-->/g, '')
}

const apps = ['admin-web', 'learner-web', 'official-site', 'mobile']
const report = { at: new Date().toISOString(), apps: {} }
for (const app of apps) {
  if (onlyApp && app !== onlyApp) continue
  const srcDir = join(root, 'apps', app)
  let stat
  try {
    stat = statSync(srcDir)
  } catch {
    continue
  }
  if (!stat.isDirectory()) continue
  const files = walk(srcDir)
  const hits = []
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    const lines = stripComments(source, file.endsWith('.vue')).split('\n')
    lines.forEach((line, index) => {
      if (CJK.test(line)) {
        hits.push({ file: relative(root, file).replaceAll('\\', '/'), line: index + 1, text: line.trim().slice(0, 160) })
      }
    })
  }
  const byFile = {}
  for (const hit of hits) {
    byFile[hit.file] = (byFile[hit.file] ?? 0) + 1
  }
  report.apps[app] = {
    files: files.length,
    hitFiles: Object.keys(byFile).length,
    hitLines: hits.length,
    byFile: Object.fromEntries(Object.entries(byFile).sort((a, b) => b[1] - a[1])),
    hits,
  }
}

const json = JSON.stringify(report, null, 2)
if (outJson) writeFileSync(resolve(root, outJson), json)
else console.log(json)
const totals = Object.entries(report.apps).map(([app, info]) => `${app}: ${info.hitLines} lines in ${info.hitFiles}/${info.files} files`)
console.error(totals.join(' | '))
