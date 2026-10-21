#!/usr/bin/env node
'use strict'

/*
 * MB007 mobile-home visual acceptance matrix (prepared, not executed by author).
 *
 * This script is deliberately evidence-oriented:
 *   - it never starts the 18183 service and never starts its own browser;
 *   - it loads the QA author's fixture lazily at Root runtime;
 *   - it refuses to run unless Root provides all three frozen source hashes;
 *   - it writes a new runs/<RUN_ID>/ directory and never overwrites/deletes old runs;
 *   - a green result is NOT a UI PASS and never author sign-off.
 *
 * Static author checks:
 *   node --check matrix.cjs
 *   node -e "require('./matrix.cjs'); console.log('import-only ok')"
 */

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const http = require('node:http')

const MATRIX_DIR = __dirname
const REPO_ROOT = path.resolve(MATRIX_DIR, '..', '..', '..', '..', '..')
const RUNS_DIR = path.join(MATRIX_DIR, 'runs')
const BASE_URL = 'http://127.0.0.1:18183'
const DEFAULT_FIXTURE = path.resolve(MATRIX_DIR, '..', 'dsh-20261021-qa', 'fixture.cjs')

const TARGETS = {
  home: {
    label: 'apps/mobile/src/pages/home/home.vue',
    file: path.join(REPO_ROOT, 'apps', 'mobile', 'src', 'pages', 'home', 'home.vue'),
    env: 'EXPECTED_HOME_SHA',
  },
  i18n: {
    label: 'packages/i18n/src/mobile-experience.ts',
    file: path.join(REPO_ROOT, 'packages', 'i18n', 'src', 'mobile-experience.ts'),
    env: 'EXPECTED_I18N_SHA',
  },
  store: {
    label: 'apps/mobile/src/stores/learner-content.ts',
    file: path.join(REPO_ROOT, 'apps', 'mobile', 'src', 'stores', 'learner-content.ts'),
    env: 'EXPECTED_STORE_SHA',
  },
  runtime: {
    label: 'apps/mobile/src/platform/uni-runtime.ts',
    file: path.join(REPO_ROOT, 'apps', 'mobile', 'src', 'platform', 'uni-runtime.ts'),
    env: 'EXPECTED_RUNTIME_SHA',
  },
}

/* Evidence-only source snapshots. Root must review changes; the script never
 * upgrades these expectations automatically. */
const EVIDENCE_FILES = [
  { label: 'apps/mobile/src/api/learner-content.ts', file: path.join(REPO_ROOT, 'apps', 'mobile', 'src', 'api', 'learner-content.ts') },
  { label: 'apps/mobile/src/stores/session.ts', file: path.join(REPO_ROOT, 'apps', 'mobile', 'src', 'stores', 'session.ts') },
  { label: 'apps/mobile/src/auth/navigation.ts', file: path.join(REPO_ROOT, 'apps', 'mobile', 'src', 'auth', 'navigation.ts') },
]

const DEP_FILES = [
  { label: 'apps/mobile/package.json', file: path.join(REPO_ROOT, 'apps', 'mobile', 'package.json') },
  { label: 'pnpm-lock.yaml', file: path.join(REPO_ROOT, 'pnpm-lock.yaml') },
]

const EXPECTED_H1 = {
  'zh-CN': '今日学习',
  'en-US': "Today's learning",
}

/* Visible copy transcribed from mobile-home/concept.png (zh only). */
const CONCEPT_ZH_COPY = [
  '语学星',
  '今日学习',
  '已学 5 分钟 · 目标 15 分钟',
  '今日任务',
  '日常表达',
  '继续上次的课程 · 5 分钟',
  '继续课程',
  '核心词汇',
  '5 分钟',
  '已完成',
  '听力练习',
  '内容暂不可用',
  '课程内容',
  '搜索课程',
  'Everyday English',
  '日常情景中的常用表达',
  'Core Vocabulary',
  '巩固常用词和短语',
  '错题本',
  '回顾做过的错题',
  '修改目标',
  '进入测评',
  '学习',
  '练习',
  '成长',
  '课程',
  '我的',
]

const WIDTH_SPECS = [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
]

const THEMES = ['light', 'dark', 'system', 'high-contrast']
const LOCALES = [
  { locale: 'zh-CN', tag: 'zh' },
  { locale: 'en-US', tag: 'en' },
]

const SMOKE_SCENARIOS = [
  { key: 'smoke-390-zh-light', width: 390, height: 844, locale: 'zh-CN', theme: 'light', textScale: 1 },
  { key: 'smoke-390-en-dark', width: 390, height: 844, locale: 'en-US', theme: 'dark', textScale: 1 },
  { key: 'smoke-320-en-text200', width: 320, height: 568, locale: 'en-US', theme: 'light', textScale: 2 },
  { key: 'smoke-1280-zh-light', width: 1280, height: 900, locale: 'zh-CN', theme: 'light', textScale: 1 },
]

const EXIT = {
  GREEN: 0,
  SETUP: 1,
  PRECONDITION: 2,
  UNKNOWN_API: 3,
  REDLINE: 4,
  INCOMPLETE: 5,
  PARTIAL: 6,
}

class Refusal extends Error {
  constructor(message, code = EXIT.PRECONDITION) {
    super(message)
    this.name = 'Refusal'
    this.code = code
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeText(value) {
  return String(value == null ? '' : value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function localeTag(locale) {
  return locale === 'en-US' ? 'en' : 'zh'
}

function themeShort(theme) {
  return theme === 'high-contrast' ? 'hc' : theme
}

function colorSchemeFor(theme) {
  return theme === 'dark' || theme === 'system' ? 'dark' : 'light'
}

function scenarioSlug(plan) {
  const cs = themeColorSuffix(plan)
  return `${plan.width}x${plan.height}-${plan.theme}-${localeTag(plan.locale)}${plan.textScale === 2 ? '-text200' : ''}${cs}`
}

function themeColorSuffix(plan) {
  return plan.theme === 'system' ? '-cs-dark' : ''
}

function scenarioId(prefix, plan) {
  return `${prefix}-${plan.width}-${themeShort(plan.theme)}-${localeTag(plan.locale)}${plan.textScale === 2 ? '-text200' : ''}`
}

function buildPlan(caseName, limit) {
  let base
  if (caseName === 'smoke') {
    base = SMOKE_SCENARIOS.slice()
  } else {
    base = []
    for (const size of WIDTH_SPECS) {
      for (const theme of THEMES) {
        for (const item of LOCALES) {
          base.push({
            width: size.width,
            height: size.height,
            locale: item.locale,
            theme,
            textScale: 1,
          })
        }
      }
    }
    base.push({ width: 320, height: 568, locale: 'zh-CN', theme: 'light', textScale: 2 })
    base.push({ width: 320, height: 568, locale: 'en-US', theme: 'dark', textScale: 2 })
    if (caseName === 'all-visual') {
      base.push({
        id: 'visual-empty-390-zh-light',
        kind: 'empty',
        mode: 'emptyNO_PLAN',
        width: 390,
        height: 844,
        locale: 'zh-CN',
        theme: 'light',
        textScale: 1,
      })
      base.push({
        id: 'visual-error-390-en-dark',
        kind: 'error',
        mode: 'home503',
        width: 390,
        height: 844,
        locale: 'en-US',
        theme: 'dark',
        textScale: 1,
      })
    }
  }

  base = base.map((item) => {
    const prefix = caseName === 'smoke' ? 'smoke' : 'full'
    return {
      ...item,
      colorScheme: colorSchemeFor(item.theme),
      id: item.id || scenarioId(prefix, item),
    }
  })

  const effectiveLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, base.length) : null
  const selected = effectiveLimit ? base.slice(0, effectiveLimit) : base
  return {
    planned: base,
    selected,
    partial: selected.length < base.length,
    limit: effectiveLimit,
    limitCapped: Number.isInteger(limit) && limit > base.length,
  }
}

function parseArgs(argv) {
  const parsed = {
    caseName: 'smoke',
    limit: null,
    cdp200Extra: false,
    help: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      parsed.help = true
      continue
    }
    if (arg === '--cdp200-extra') {
      parsed.cdp200Extra = true
      continue
    }
    if (arg === '--case') {
      const value = argv[i + 1]
      if (!value) throw new Refusal('--case requires smoke|full|all-visual', EXIT.PRECONDITION)
      parsed.caseName = value
      i += 1
      continue
    }
    if (arg.startsWith('--case=')) {
      parsed.caseName = arg.slice('--case='.length)
      continue
    }
    if (arg === '--limit') {
      const value = argv[i + 1]
      if (!value) throw new Refusal('--limit requires a positive integer', EXIT.PRECONDITION)
      parsed.limit = Number(value)
      i += 1
      continue
    }
    if (arg.startsWith('--limit=')) {
      parsed.limit = Number(arg.slice('--limit='.length))
      continue
    }
    throw new Refusal(`Unknown argument: ${arg}`, EXIT.PRECONDITION)
  }

  if (!['smoke', 'full', 'all-visual'].includes(parsed.caseName)) {
    throw new Refusal(`--case must be smoke|full|all-visual, got ${parsed.caseName}`, EXIT.PRECONDITION)
  }
  if (parsed.limit !== null && (!Number.isInteger(parsed.limit) || parsed.limit < 1)) {
    throw new Refusal('--limit must be a positive integer', EXIT.PRECONDITION)
  }
  return parsed
}

function usage() {
  return [
    'Usage:',
    '  node matrix.cjs --case smoke',
    '  node matrix.cjs --case full',
    '  node matrix.cjs --case all-visual',
    '  node matrix.cjs --case full --limit 8',
    '',
    'Required environment:',
    '  MB007_CONFIRM_BROWSER=1',
    '  EXPECTED_HOME_SHA=<64 hex>',
    '  EXPECTED_I18N_SHA=<64 hex>',
    '  EXPECTED_STORE_SHA=<64 hex>',
    '  EXPECTED_RUNTIME_SHA=<64 hex>',
    '',
    'Optional:',
    '  MB007_RUN_ID / RUN_ID=<new run directory name>',
    '  MB007_FIXTURE=<absolute fixture.cjs path>',
    '  --cdp200-extra (extra CDP page-scale record; never replaces CSS textscale)',
    '',
    'The script uses an existing http://127.0.0.1:18183 service. It never starts it.',
    'A green result is not a UI PASS and is not author sign-off.',
  ].join('\n')
}

function assertBrowserConfirmed(env) {
  if (String(env.MB007_CONFIRM_BROWSER || '') !== '1') {
    throw new Refusal('MB007_CONFIRM_BROWSER must be exactly 1; no automatic confirmation', EXIT.PRECONDITION)
  }
}

function readExpectedHashes(env) {
  const expected = {}
  for (const key of Object.keys(TARGETS)) {
    const target = TARGETS[key]
    const raw = String(env[target.env] || '').trim()
    if (!raw) {
      throw new Refusal(`${target.env} is required (expected raw SHA-256 of ${target.label}); no fallback value`, EXIT.PRECONDITION)
    }
    if (!/^[a-f0-9]{64}$/i.test(raw)) {
      throw new Refusal(`${target.env} must be a 64-character hex SHA-256`, EXIT.PRECONDITION)
    }
    expected[key] = raw.toLowerCase()
  }
  return expected
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function snapshotFile(file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    return { exists: false, sha256: null, bytes: null }
  }
  const stat = fs.statSync(file)
  return { exists: true, sha256: sha256File(file), bytes: stat.size }
}

function snapshotSources() {
  const out = {}
  for (const key of Object.keys(TARGETS)) {
    out[key] = { ...TARGETS[key], ...snapshotFile(TARGETS[key].file) }
  }
  return out
}

function snapshotDeps() {
  const files = {}
  const combined = crypto.createHash('sha256')
  for (const dep of DEP_FILES) {
    const snap = snapshotFile(dep.file)
    files[dep.label] = snap
    combined.update(dep.label)
    combined.update('\0')
    combined.update(snap.exists ? snap.sha256 : 'MISSING')
    combined.update('\0')
  }
  return { sha256: combined.digest('hex'), files }
}

function snapshotEvidence() {
  const files = {}
  const combined = crypto.createHash('sha256')
  for (const item of EVIDENCE_FILES) {
    const snap = snapshotFile(item.file)
    files[item.label] = snap
    combined.update(item.label)
    combined.update('\0')
    combined.update(snap.exists ? snap.sha256 : 'MISSING')
    combined.update('\0')
  }
  return { sha256: combined.digest('hex'), files }
}

function assertFrozenSources(expected) {
  const actual = snapshotSources()
  const mismatches = []
  for (const key of Object.keys(expected)) {
    const item = actual[key]
    if (!item.exists) {
      mismatches.push(`${item.label}: missing`)
    } else if (item.sha256 !== expected[key]) {
      mismatches.push(`${item.label}: expected ${expected[key]} got ${item.sha256}`)
    }
  }
  if (mismatches.length) {
    throw new Refusal(`Frozen source mismatch; refusing before browser launch:\n  ${mismatches.join('\n  ')}`, EXIT.PRECONDITION)
  }
  return actual
}

function safeRunId(raw) {
  const value = String(raw || '').trim()
  if (!value) return null
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value)) {
    throw new Refusal('RUN_ID must match /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/', EXIT.PRECONDITION)
  }
  return value
}

function defaultRunId() {
  return `mb007-matrix-${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}`
}

function relFromRepo(file) {
  return path.relative(REPO_ROOT, file).split(path.sep).join('/')
}

function ensureNewRunDir(runId) {
  fs.mkdirSync(RUNS_DIR, { recursive: true })
  const runDir = path.join(RUNS_DIR, runId)
  try {
    fs.mkdirSync(runDir, { recursive: false })
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      throw new Refusal(`Run directory already exists; refusing to overwrite/delete: ${runDir}`, EXIT.PRECONDITION)
    }
    throw error
  }
  return runDir
}

function preflightService() {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE_URL}/`, { timeout: 3500 }, (res) => {
      res.resume()
      resolve({ status: res.statusCode, ok: true })
    })
    req.on('timeout', () => {
      req.destroy(new Error('timeout'))
    })
    req.on('error', (error) => {
      reject(new Refusal(`Fixed service ${BASE_URL} is not reachable: ${error.message}. Start/keep the existing service outside this script.`, EXIT.PRECONDITION))
    })
  })
}

function parseCssColor(value) {
  if (value == null) return null
  if (typeof value === 'object' && Number.isFinite(value.r) && Number.isFinite(value.g) && Number.isFinite(value.b)) {
    const alpha = Number.isFinite(value.a) ? value.a : 1
    return {
      r: Math.max(0, Math.min(255, value.r)),
      g: Math.max(0, Math.min(255, value.g)),
      b: Math.max(0, Math.min(255, value.b)),
      a: Math.max(0, Math.min(1, alpha)),
    }
  }
  const text = String(value).trim().toLowerCase()
  if (!text || text === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
  if (text.startsWith('#')) {
    const hex = text.slice(1)
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16)
      const g = parseInt(hex[1] + hex[1], 16)
      const b = parseInt(hex[2] + hex[2], 16)
      const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1
      return { r, g, b, a }
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
      return { r, g, b, a }
    }
    return null
  }
  const match = text.match(/^rgba?\(([^)]+)\)$/)
  if (!match) return null
  const parts = match[1].split(/[,\s/]+/).filter(Boolean)
  if (parts.length < 3) return null
  const channel = (part) => {
    if (part.endsWith('%')) return Math.round((parseFloat(part) / 100) * 255)
    return Math.round(parseFloat(part))
  }
  const alpha = (part) => {
    if (part == null) return 1
    if (part.endsWith('%')) return parseFloat(part) / 100
    return parseFloat(part)
  }
  const color = { r: channel(parts[0]), g: channel(parts[1]), b: channel(parts[2]), a: alpha(parts[3]) }
  if (![color.r, color.g, color.b, color.a].every(Number.isFinite)) return null
  return {
    r: Math.max(0, Math.min(255, color.r)),
    g: Math.max(0, Math.min(255, color.g)),
    b: Math.max(0, Math.min(255, color.b)),
    a: Math.max(0, Math.min(1, color.a)),
  }
}

function blendColor(fg, bg) {
  const a = fg.a + bg.a * (1 - fg.a)
  if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 }
  return {
    r: Math.round((fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a),
    g: Math.round((fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a),
    b: Math.round((fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a),
    a,
  }
}

function relativeLuminance(color) {
  const channel = (v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b)
}

function contrastRatio(fg, bg) {
  const a = relativeLuminance(fg)
  const b = relativeLuminance(bg)
  const lighter = Math.max(a, b)
  const darker = Math.min(a, b)
  return (lighter + 0.05) / (darker + 0.05)
}

function cssColor(color) {
  if (!color) return null
  if (color.a >= 0.999) return `rgb(${color.r}, ${color.g}, ${color.b})`
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${Number(color.a.toFixed(3))})`
}

function colorText(color) {
  if (!color) return null
  return {
    css: cssColor(color),
    rgba: [color.r, color.g, color.b, Number(color.a.toFixed(3))],
    hex: `#${[color.r, color.g, color.b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`,
  }
}

function isLargeText(fontSize, fontWeight) {
  if (!Number.isFinite(fontSize)) return false
  return fontSize >= 24 || (fontSize >= 18.66 && Number(fontWeight) >= 700)
}

function safeString(value, max = 500) {
  const text = typeof value === 'string' ? value : String(value == null ? '' : value)
  return text.length > max ? `${text.slice(0, max)}…[truncated]` : text
}

function sanitizeValue(value, depth = 0, seen = new WeakSet()) {
  if (value == null) return value
  if (depth > 4) return '[depth-limit]'
  if (typeof value === 'string') return safeString(value, 1200)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'bigint') return String(value)
  if (typeof value !== 'object') return String(value)
  if (seen.has(value)) return '[circular]'
  seen.add(value)
  if (Array.isArray(value)) return value.slice(0, 80).map((item) => sanitizeValue(item, depth + 1, seen))
  const out = {}
  for (const key of Object.keys(value).slice(0, 80)) {
    if (/token|secret|password|credential|cookie|authorization|auth[_-]?header/i.test(key)) {
      out[key] = '[redacted]'
    } else {
      out[key] = sanitizeValue(value[key], depth + 1, seen)
    }
  }
  return out
}

function countArray(value) {
  return Array.isArray(value) ? value.length : (value && typeof value === 'object' ? Object.keys(value).length : 0)
}

function extractUnknown(report) {
  const parsed = { status: 'not-measured', count: 0, excerpt: [], source: null }
  if (!report || typeof report !== 'object') return parsed
  const candidates = [
    ['unknown'],
    ['unknownApi'],
    ['unknownApis'],
    ['report', 'unknown'],
    ['api', 'unknown'],
    ['api', 'unknownApi'],
    ['api', 'unknownPaths'],
    ['api', 'unknowns'],
  ]
  for (const keys of candidates) {
    let cursor = report
    for (const key of keys) {
      if (!cursor || typeof cursor !== 'object' || !(key in cursor)) {
        cursor = null
        break
      }
      cursor = cursor[key]
    }
    if (cursor == null) continue
    parsed.status = 'ok'
    parsed.source = keys.join('.')
    if (typeof cursor === 'number') {
      parsed.count += cursor
      parsed.excerpt.push(String(cursor))
    } else if (Array.isArray(cursor)) {
      parsed.count += cursor.length
      for (const item of cursor.slice(0, 30)) {
        parsed.excerpt.push(safeString(typeof item === 'string' ? item : JSON.stringify(sanitizeValue(item)), 300))
      }
    } else if (typeof cursor === 'object') {
      parsed.count += Object.keys(cursor).length
      for (const key of Object.keys(cursor).slice(0, 30)) {
        parsed.excerpt.push(`${safeString(key, 160)}=${safeString(JSON.stringify(sanitizeValue(cursor[key])), 300)}`)
      }
    } else {
      parsed.excerpt.push(safeString(cursor, 300))
    }
  }
  return parsed
}

function buildCopyDiff(dom, locale) {
  const ui = Array.isArray(dom.copy && dom.copy.uiCopy) ? dom.copy.uiCopy : []
  const texts = Array.from(new Set(ui.map((item) => normalizeText(item.text)).filter(Boolean)))
  const content = Array.isArray(dom.copy && dom.copy.content) ? dom.copy.content : []
  if (locale === 'en-US') {
    return {
      status: 'FOR_ROOT_REVIEW',
      baseline: 'none (concept.png is zh-only)',
      conceptOnly: [],
      actualOnly: texts.slice(0, 120),
      matched: [],
      uiCopy: ui.slice(0, 120),
      contentExcerpt: content.slice(0, 12),
      contentExcluded: content.length,
      note: 'No English concept baseline exists. Synthetic course/task copy is content, not UI translation.',
    }
  }
  const matched = []
  const conceptOnly = []
  for (const concept of CONCEPT_ZH_COPY) {
    if (texts.some((text) => text.includes(concept) || concept.includes(text))) matched.push(concept)
    else conceptOnly.push(concept)
  }
  const actualOnly = texts.filter((text) => {
    if (!text) return false
    return !CONCEPT_ZH_COPY.some((concept) => text.includes(concept) || concept.includes(text))
  })
  return {
    status: 'FOR_ROOT_REVIEW',
    baseline: 'mobile-home/concept.png (zh visible copy)',
    conceptOnly,
    actualOnly: actualOnly.slice(0, 120),
    matched,
    uiCopy: ui.slice(0, 120),
    contentExcerpt: content.slice(0, 12),
    contentExcluded: content.length,
    note: 'Substring comparison only, for Root copy review; tab bar is outside .home-page scope; dynamic counts/values differ; this is not a translation PASS.',
  }
}

function shortSelector(el) {
  if (!el || !el.tagName) return null
  const tag = el.tagName.toLowerCase()
  const id = el.id ? `#${el.id}` : ''
  const cls = typeof el.className === 'string' && el.className.trim()
    ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}`
    : ''
  return `${tag}${id}${cls}`.slice(0, 160)
}

/* ------------------------------------------------------------------------- */
/* In-page DOM measurement. Must stay self-contained: page.evaluate() passes  */
/* only JSON-serializable args and serializes this function.                  */
/* ------------------------------------------------------------------------- */

function collectPageData(args) {
  const scopeSelector = args.scopeSelector || '.home-page'
  const scope = document.querySelector(scopeSelector) || document.querySelector('#app') || document.body
  const norm = (value) => String(value == null ? '' : value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

  const selectorOf = (el) => {
    if (!el || !el.tagName) return null
    const tag = el.tagName.toLowerCase()
    const id = el.id ? `#${el.id}` : ''
    const className = typeof el.className === 'string' && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}`
      : ''
    return `${tag}${id}${className}`.slice(0, 160)
  }

  const parseColor = (value) => {
    if (value == null) return null
    const text = String(value).trim().toLowerCase()
    if (!text || text === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
    if (text.startsWith('#')) {
      const hex = text.slice(1)
      if (hex.length === 3 || hex.length === 4) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16),
          a: hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1,
        }
      }
      if (hex.length === 6 || hex.length === 8) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
          a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
        }
      }
      return null
    }
    const match = text.match(/^rgba?\(([^)]+)\)$/)
    if (!match) return null
    const parts = match[1].split(/[,\s/]+/).filter(Boolean)
    if (parts.length < 3) return null
    const channel = (part) => part.endsWith('%')
      ? Math.round((parseFloat(part) / 100) * 255)
      : Math.round(parseFloat(part))
    const alpha = (part) => part == null ? 1 : (part.endsWith('%') ? parseFloat(part) / 100 : parseFloat(part))
    const color = { r: channel(parts[0]), g: channel(parts[1]), b: channel(parts[2]), a: alpha(parts[3]) }
    if (![color.r, color.g, color.b, color.a].every(Number.isFinite)) return null
    return {
      r: Math.max(0, Math.min(255, color.r)),
      g: Math.max(0, Math.min(255, color.g)),
      b: Math.max(0, Math.min(255, color.b)),
      a: Math.max(0, Math.min(1, color.a)),
    }
  }

  const blend = (fg, bg) => {
    const a = fg.a + bg.a * (1 - fg.a)
    if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 }
    return {
      r: Math.round((fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a),
      g: Math.round((fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a),
      b: Math.round((fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a),
      a,
    }
  }

  const isVisible = (el) => {
    if (!el || !(el instanceof Element)) return false
    if (el.closest('[aria-hidden="true"], [hidden]')) return false
    let opacity = 1
    for (let node = el; node; node = node.parentElement) {
      const cs = getComputedStyle(node)
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false
      opacity *= Number.parseFloat(cs.opacity)
      if (Number.isFinite(opacity) && opacity <= 0.01) return false
      if (node === scope) break
    }
    const rect = el.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }

  const opacityChain = (el) => {
    let opacity = 1
    for (let node = el; node; node = node.parentElement) {
      opacity *= Number.parseFloat(getComputedStyle(node).opacity)
      if (node === scope) break
    }
    return Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1
  }

  const bgFor = (el) => {
    const chain = []
    for (let node = el; node; node = node.parentElement) chain.push(node)
    chain.reverse()
    let acc = { r: 255, g: 255, b: 255, a: 1 }
    let image = false
    let source = 'default-white'
    for (const node of chain) {
      const cs = getComputedStyle(node)
      if (cs.backgroundImage && cs.backgroundImage !== 'none') image = true
      const color = parseColor(cs.backgroundColor)
      if (color && color.a > 0) {
        acc = blend(color, acc)
        source = selectorOf(node)
      }
    }
    return { color: acc, image, source }
  }

  const rectOf = (el) => {
    const rect = el.getBoundingClientRect()
    return {
      x: Number(rect.x.toFixed(2)),
      y: Number(rect.y.toFixed(2)),
      width: Number(rect.width.toFixed(2)),
      height: Number(rect.height.toFixed(2)),
      right: Number(rect.right.toFixed(2)),
      bottom: Number(rect.bottom.toFixed(2)),
    }
  }

  const baseBg = bgFor(document.body)
  const pageBg = baseBg.color

  const h1Elements = Array.from(scope.querySelectorAll('h1, [role="heading"][aria-level="1"]')).filter(isVisible)
  const nativeH1 = Array.from(scope.querySelectorAll('h1')).filter(isVisible)

  const runs = []
  const seenRunKeys = new Set()
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT)
  let truncatedRuns = false
  while (walker.nextNode()) {
    if (runs.length >= 260) {
      truncatedRuns = true
      break
    }
    const text = norm(walker.currentNode.nodeValue)
    if (!text) continue
    const el = walker.currentNode.parentElement
    if (!el || !isVisible(el)) continue
    if (el.closest('script, style, noscript, template')) continue
    if (el.closest('svg')) continue
    const rect = rectOf(el)
    const key = `${el.tagName}|${typeof el.className === 'string' ? el.className : ''}|${text}|${rect.x}|${rect.y}`
    if (seenRunKeys.has(key)) continue
    seenRunKeys.add(key)

    const cs = getComputedStyle(el)
    const fontSize = Number.parseFloat(cs.fontSize)
    const lineHeight = cs.lineHeight === 'normal' ? null : Number.parseFloat(cs.lineHeight)
    const control = el.closest('button, [role="button"], a[href], input[type="submit"], select, textarea')
    const heading = el.closest('h1, h2, h3, h4, h5, h6, [role="heading"]')
    const tag = el.tagName.toLowerCase()
    let tier
    if (control && !heading) tier = 'control'
    else if (el.closest('.home-brand')) tier = 'brand'
    else if (heading || fontSize >= 20) tier = 'heading'
    else if (fontSize >= 16) tier = 'body'
    else if (fontSize >= 14) tier = 'auxiliary'
    else tier = 'small'

    const overflowX = cs.overflowX
    const overflowY = cs.overflowY
    const hides = /hidden|clip/.test(overflowX) || /hidden|clip/.test(overflowY)
    const blockish = !/^inline/.test(cs.display)
    const scrollWidth = blockish ? Math.max(0, el.scrollWidth - el.clientWidth) : 0
    const scrollHeight = blockish ? Math.max(0, el.scrollHeight - el.clientHeight) : 0
    const lineClampRaw = cs.webkitLineClamp && cs.webkitLineClamp !== 'none'
      ? cs.webkitLineClamp
      : (cs.lineClamp && cs.lineClamp !== 'none' ? cs.lineClamp : null)
    const ellipsis = cs.textOverflow === 'ellipsis'
    const clipped = Boolean(lineClampRaw) || (hides && (scrollWidth > 2 || scrollHeight > 2)) || (ellipsis && scrollWidth > 2)
    const bg = bgFor(el)
    const disabled = Boolean(control && (
      control.disabled === true
      || control.getAttribute('aria-disabled') === 'true'
      || (typeof control.matches === 'function' && control.matches(':disabled'))
    ))
    const isContent = Boolean(el.closest('.home-course, .home-task__copy'))
    const headingLevel = tag === 'h1' ? 1 : (heading ? Number.parseInt(heading.getAttribute('aria-level') || '0', 10) || null : null)

    runs.push({
      text: text.slice(0, 240),
      tag,
      selector: selectorOf(el),
      tier,
      role: el.getAttribute('role') || null,
      headingLevel,
      fontSize: Number.isFinite(fontSize) ? Number(fontSize.toFixed(2)) : null,
      lineHeight: Number.isFinite(lineHeight) ? Number(lineHeight.toFixed(2)) : null,
      lineHeightRatio: Number.isFinite(fontSize) && Number.isFinite(lineHeight) && fontSize > 0
        ? Number((lineHeight / fontSize).toFixed(3))
        : null,
      fontWeight: cs.fontWeight,
      fontFamily: cs.fontFamily,
      color: cs.color,
      bgColor: bg.color,
      bgImage: bg.image,
      bgSource: bg.source,
      opacity: Number(opacityChain(el).toFixed(3)),
      disabled,
      clipping: {
        overflowX,
        overflowY,
        hides,
        scrollWidth,
        scrollHeight,
        lineClamp: lineClampRaw,
        textOverflow: cs.textOverflow,
        whiteSpace: cs.whiteSpace,
        clipped,
        overflowVisibleInk: !hides && scrollWidth > 2,
      },
      rect,
      isContent,
    })
  }

  const controls = []
  const controlSelector = 'button, [role="button"], a[href], input[type="submit"], select, textarea'
  for (const el of Array.from(scope.querySelectorAll(controlSelector))) {
    if (controls.length >= 100) break
    if (!isVisible(el)) continue
    const rect = rectOf(el)
    const cs = getComputedStyle(el)
    const text = norm(el.innerText || el.value || el.getAttribute('aria-label') || '')
    const textLeaves = Array.from(el.querySelectorAll('*')).filter((child) => (
      isVisible(child)
      && norm(child.textContent)
      && !Array.from(child.children).some((grand) => isVisible(grand) && norm(grand.textContent))
    ))
    const childOverflow = textLeaves.some((child) => {
      const r = child.getBoundingClientRect()
      return r.right > rect.right + 2 || r.left < rect.left - 2 || r.bottom > rect.bottom + 2
    })
    const hides = /hidden|clip/.test(cs.overflowX) || /hidden|clip/.test(cs.overflowY)
    controls.push({
      selector: selectorOf(el),
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || null,
      ariaLabel: el.getAttribute('aria-label') || null,
      text: text.slice(0, 160),
      width: rect.width,
      height: rect.height,
      minSide: Math.min(rect.width, rect.height),
      primary: Boolean(el.matches('.home-primary, [data-variant="primary"], [data-primary="true"]')),
      disabled: Boolean(el.disabled === true || el.getAttribute('aria-disabled') === 'true' || el.matches(':disabled')),
      fontSize: Number.parseFloat(cs.fontSize) || null,
      lineHeight: cs.lineHeight === 'normal' ? null : Number.parseFloat(cs.lineHeight) || null,
      fontFamily: cs.fontFamily,
      color: cs.color,
      bgColor: bgFor(el).color,
      childOverflow,
      scrollWidth: Math.max(0, el.scrollWidth - el.clientWidth),
      scrollHeight: Math.max(0, el.scrollHeight - el.clientHeight),
      hidesOverflow: hides,
      rect,
    })
  }

  const inputs = []
  for (const el of Array.from(scope.querySelectorAll('input, textarea, select'))) {
    if (inputs.length >= 12) break
    if (!isVisible(el)) continue
    const rect = rectOf(el)
    const cs = getComputedStyle(el)
    const nativeWidth = Number.parseFloat(cs.borderTopWidth) || 0
    const nativeStyle = cs.borderTopStyle
    const nativeColor = cs.borderTopColor
    let boundaryEl = el.closest('.home-search')
    if (boundaryEl) {
      const wrapperCs = getComputedStyle(boundaryEl)
      const wrapperWidth = Number.parseFloat(wrapperCs.borderTopWidth) || 0
      if (wrapperWidth < 1 || wrapperCs.borderTopStyle === 'none' || wrapperCs.borderTopStyle === 'hidden') boundaryEl = null
    }
    if (!boundaryEl) {
      for (let node = el; node && node !== scope.parentElement; node = node.parentElement) {
        const nodeCs = getComputedStyle(node)
        const width = Number.parseFloat(nodeCs.borderTopWidth) || 0
        if (width > 0 && nodeCs.borderTopStyle !== 'none' && nodeCs.borderTopStyle !== 'hidden') {
          boundaryEl = node
          break
        }
      }
    }
    const boundaryCs = boundaryEl ? getComputedStyle(boundaryEl) : null
    const boundaryWidth = boundaryCs ? (Number.parseFloat(boundaryCs.borderTopWidth) || 0) : 0
    const boundaryColor = boundaryCs ? boundaryCs.borderTopColor : null
    let placeholder = null
    try {
      const ph = getComputedStyle(el, '::placeholder')
      placeholder = { color: ph.color, opacity: ph.opacity }
    } catch (error) {
      placeholder = null
    }
    inputs.push({
      selector: selectorOf(el),
      type: el.getAttribute('type') || el.tagName.toLowerCase(),
      width: rect.width,
      height: rect.height,
      fontFamily: cs.fontFamily,
      fontSize: Number.parseFloat(cs.fontSize) || null,
      lineHeight: cs.lineHeight === 'normal' ? null : Number.parseFloat(cs.lineHeight) || null,
      nativeBorder: {
        width: nativeWidth,
        style: nativeStyle,
        color: nativeColor,
      },
      effectiveBoundary: boundaryEl ? {
        selector: selectorOf(boundaryEl),
        width: boundaryWidth,
        style: boundaryCs.borderTopStyle,
        color: boundaryColor,
        outerBg: bgFor(boundaryEl.parentElement || boundaryEl).color,
      } : null,
      inputBg: bgFor(el).color,
      placeholder,
      placeholderText: el.getAttribute('placeholder') || '',
      hasValue: Boolean(el.value),
    })
  }

  const leafTextElements = Array.from(scope.querySelectorAll('*')).filter((el) => (
    isVisible(el)
    && norm(el.textContent)
    && !Array.from(el.children).some((child) => isVisible(child) && norm(child.textContent))
  )).slice(0, 180)

  const overlaps = []
  for (let i = 0; i < leafTextElements.length && overlaps.length < 20; i += 1) {
    const a = leafTextElements[i]
    const ra = a.getBoundingClientRect()
    for (let j = i + 1; j < leafTextElements.length && overlaps.length < 20; j += 1) {
      const b = leafTextElements[j]
      if (a.contains(b) || b.contains(a)) continue
      const rb = b.getBoundingClientRect()
      const horizontal = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left)
      const vertical = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top)
      if (horizontal <= 2 || vertical <= 2) continue
      const area = horizontal * vertical
      if (area <= 16) continue
      overlaps.push({
        a: { selector: selectorOf(a), text: norm(a.textContent).slice(0, 80), rect: { x: ra.x, y: ra.y, width: ra.width, height: ra.height } },
        b: { selector: selectorOf(b), text: norm(b.textContent).slice(0, 80), rect: { x: rb.x, y: rb.y, width: rb.width, height: rb.height } },
        overlapArea: Number(area.toFixed(2)),
      })
    }
  }

  const controlOverlaps = []
  for (let i = 0; i < controls.length && controlOverlaps.length < 12; i += 1) {
    const ra = controls[i].rect
    for (let j = i + 1; j < controls.length && controlOverlaps.length < 12; j += 1) {
      const rb = controls[j].rect
      const horizontal = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left)
      const vertical = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top)
      if (horizontal <= 2 || vertical <= 2) continue
      const area = horizontal * vertical
      if (area <= 16) continue
      controlOverlaps.push({
        a: controls[i].selector,
        b: controls[j].selector,
        overlapArea: Number(area.toFixed(2)),
      })
    }
  }

  const documentEl = document.documentElement
  const body = document.body
  const viewportWidth = documentEl.clientWidth
  const offenders = []
  for (const el of Array.from(scope.querySelectorAll('*'))) {
    if (offenders.length >= 20) break
    if (!isVisible(el)) continue
    const rect = el.getBoundingClientRect()
    if (rect.right <= viewportWidth + 1 && rect.left >= -1) continue
    let scroller = false
    for (let node = el.parentElement; node && node !== scope.parentElement; node = node.parentElement) {
      const cs = getComputedStyle(node)
      if (/(auto|scroll)/.test(cs.overflowX)) {
        scroller = true
        break
      }
    }
    if (scroller) continue
    offenders.push({
      selector: selectorOf(el),
      text: norm(el.innerText).slice(0, 100),
      rect: {
        x: Number(rect.x.toFixed(2)),
        y: Number(rect.y.toFixed(2)),
        right: Number(rect.right.toFixed(2)),
        width: Number(rect.width.toFixed(2)),
      },
    })
  }

  const uiCopy = []
  const content = []
  const copySeen = new Set()
  for (const run of runs) {
    if (run.isContent) {
      content.push({ text: run.text, selector: run.selector, tier: run.tier })
      continue
    }
    if (copySeen.has(run.text)) continue
    copySeen.add(run.text)
    uiCopy.push({ text: run.text, selector: run.selector, tier: run.tier, role: run.role })
  }
  for (const input of inputs) {
    const text = norm(input.placeholderText)
    if (!text || copySeen.has(text)) continue
    copySeen.add(text)
    uiCopy.push({ text, selector: input.selector, tier: 'placeholder', role: null })
  }
  const contentExtra = Array.from(scope.querySelectorAll('.home-course__title, .home-course__desc, .home-task__title, .home-task__meta, .home-task__desc'))
    .filter(isVisible)
    .map((el) => ({ text: norm(el.textContent).slice(0, 240), selector: selectorOf(el) }))
  for (const item of contentExtra) {
    if (content.length >= 30) break
    content.push(item)
  }

  const accessibleH1Count = new Set(h1Elements).size
  const h1Texts = h1Elements.map((el) => norm(el.innerText || el.textContent))
  const nativeH1Texts = nativeH1.map((el) => norm(el.innerText || el.textContent))

  return {
    scope: selectorOf(scope),
    h1: {
      accessibleCount: accessibleH1Count,
      nativeCount: new Set(nativeH1).size,
      texts: h1Texts,
      nativeTexts: nativeH1Texts,
      elements: h1Elements.map((el) => selectorOf(el)),
    },
    runs,
    truncatedRuns,
    controls,
    inputs,
    overlaps,
    controlOverlaps,
    doc: {
      docClientWidth: documentEl.clientWidth,
      docScrollWidth: documentEl.scrollWidth,
      bodyClientWidth: body ? body.clientWidth : null,
      bodyScrollWidth: body ? body.scrollWidth : null,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollingElement: document.scrollingElement ? document.scrollingElement.tagName.toLowerCase() : null,
      horizontalOverflow: documentEl.scrollWidth > documentEl.clientWidth + 1,
      bodyHorizontalOverflow: Boolean(body && body.scrollWidth > body.clientWidth + 1),
    },
    offenders,
    copy: {
      uiCopy: uiCopy.slice(0, 140),
      content: content.slice(0, 40),
    },
    counts: {
      textRuns: runs.length,
      controls: controls.length,
      inputs: inputs.length,
      overlaps: overlaps.length,
      controlOverlaps: controlOverlaps.length,
    },
  }
}

function readThemeState() {
  const root = document.documentElement
  const body = document.body
  const app = document.querySelector('#app')
  const attr = (el, name = 'data-theme') => (el ? el.getAttribute(name) : null)
  const uiLocale = (el) => (el ? el.getAttribute('data-ui-locale') : null)
  const cls = (el) => (el && typeof el.className === 'string' ? el.className : '')
  return {
    rootDataTheme: attr(root),
    bodyDataTheme: attr(body),
    appDataTheme: attr(app),
    rootDataHighContrast: attr(root, 'data-high-contrast'),
    bodyDataHighContrast: attr(body, 'data-high-contrast'),
    appDataHighContrast: attr(app, 'data-high-contrast'),
    rootDataContrast: attr(root, 'data-contrast'),
    bodyDataContrast: attr(body, 'data-contrast'),
    rootDataThemeMode: attr(root, 'data-theme-mode'),
    bodyDataThemeMode: attr(body, 'data-theme-mode'),
    appDataThemeMode: attr(app, 'data-theme-mode'),
    rootClass: cls(root),
    bodyClass: cls(body),
    appClass: cls(app),
    htmlLang: root ? root.lang : null,
    rootUiLocale: uiLocale(root),
    bodyUiLocale: uiLocale(body),
    appUiLocale: uiLocale(app),
    systemDark: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches,
    prefersLight: window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches,
    rootColorScheme: root ? getComputedStyle(root).colorScheme : null,
    rootBg: root ? getComputedStyle(root).backgroundColor : null,
    bodyBg: body ? getComputedStyle(body).backgroundColor : null,
    visualViewportScale: window.visualViewport ? window.visualViewport.scale : null,
    devicePixelRatio: window.devicePixelRatio,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
  }
}

/* ------------------------------------------------------------------------- */
/* Browser/context work. Only runs when Root executes this file with the     */
/* explicit confirmation env; import-only must not reach this section.       */
/* ------------------------------------------------------------------------- */

async function ensureTheme(page, plan, rec) {
  let before
  try {
    before = await page.evaluate(readThemeState)
  } catch (error) {
    rec.notes.push(`theme read before fallback failed: ${safeString(error.message, 300)}`)
    before = null
  }
  rec.themeRequested = {
    theme: plan.theme,
    colorScheme: plan.colorScheme,
    textScale: plan.textScale,
  }
  rec.themeBeforeFallback = before

  if (plan.theme === 'system' && before && before.systemDark !== true) {
    try {
      const client = await page.context().newCDPSession(page)
      await client.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-color-scheme', value: 'dark' }],
      })
      rec.cdpMediaClient = client
      rec.themeFallback = 'cdp Emulation.setEmulatedMedia prefers-color-scheme=dark'
      await sleep(300)
    } catch (error) {
      rec.themeFallback = `failed: ${safeString(error.message, 300)}`
    }
  }

  await sleep(150)
  try {
    rec.themeActual = await page.evaluate(readThemeState)
  } catch (error) {
    rec.themeActual = { error: safeString(error.message, 500) }
  }
  return rec.themeActual
}

async function applyCssTextScale(page, factor) {
  return page.evaluate((scaleFactor) => {
    const scope = document.querySelector('.home-page') || document.body
    const items = []
    const seen = new Set()
    const add = (el) => {
      if (!el || seen.has(el)) return
      seen.add(el)
      const cs = getComputedStyle(el)
      const fs = Number.parseFloat(cs.fontSize)
      const lh = cs.lineHeight === 'normal' ? null : Number.parseFloat(cs.lineHeight)
      if (!Number.isFinite(fs) || fs <= 0) return
      items.push({ el, fs, lh: Number.isFinite(lh) ? lh : null })
    }
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const text = walker.currentNode.nodeValue
      if (!text || !text.trim()) continue
      add(walker.currentNode.parentElement)
    }
    for (const el of Array.from(scope.querySelectorAll('input, textarea, select'))) add(el)
    for (const item of items) {
      item.el.style.setProperty('font-size', `${item.fs * scaleFactor}px`, 'important')
      if (item.lh !== null) item.el.style.setProperty('line-height', `${item.lh * scaleFactor}px`, 'important')
    }
    const root = document.documentElement
    return {
      method: 'inline CSS font-size + line-height multiplied by factor; CSS textscale, not browser layout zoom',
      factor: scaleFactor,
      elements: items.length,
      browserZoom: false,
      browserLayoutZoom: false,
      rootInlineFontSize: root.style.fontSize || null,
      rootComputedFontSize: getComputedStyle(root).fontSize,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      devicePixelRatio: window.devicePixelRatio,
      visualViewportScale: window.visualViewport ? window.visualViewport.scale : null,
    }
  }, factor)
}

async function readPlatformFonts(page) {
  const targets = [
    { name: 'h1', group: 'h1', selector: '.home-page .home-title, .home-page [role="heading"][aria-level="1"]', required: true },
    { name: 'task-title', group: 'body', selector: '.home-page .home-task__title', required: false },
    { name: 'course-title', group: 'body', selector: '.home-page .home-course__title', required: false },
    { name: 'progress-text', group: 'body', selector: '.home-page .home-progress__text', required: false },
    { name: 'task-meta', group: 'aux', selector: '.home-page .home-task__meta', required: false },
    { name: 'section-count', group: 'aux', selector: '.home-page .home-section__count', required: false },
    { name: 'course-desc', group: 'aux', selector: '.home-page .home-course__desc', required: false },
    { name: 'empty-title', group: 'body', selector: '.home-page .home-empty__title', required: false },
    { name: 'empty-desc', group: 'aux', selector: '.home-page .home-empty__desc', required: false },
    { name: 'error-title', group: 'body', selector: '.home-page .home-block__title', required: false },
    { name: 'error-desc', group: 'aux', selector: '.home-page .home-block__desc', required: false },
    { name: 'section-title', group: 'optional', selector: '.home-page .home-section__title', required: false },
    { name: 'primary', group: 'optional', selector: '.home-page .home-primary', required: false },
  ]
  const out = {
    method: 'CDP DOM.querySelector + CSS.getPlatformFontsForNode',
    status: 'not-measured',
    reason: null,
    targets: [],
    groups: {},
    actualFamilies: [],
  }

  let client
  try {
    client = await page.context().newCDPSession(page)
  } catch (error) {
    out.reason = `Chromium CDP session unavailable: ${safeString(error.message, 400)}`
    return out
  }

  try {
    await client.send('DOM.enable')
    await client.send('CSS.enable')
    const doc = await client.send('DOM.getDocument', { depth: 0 })

    const findTextNode = async (nodeId, depth = 0) => {
      if (depth > 4) return null
      const children = await client.send('DOM.getChildNodes', { nodeId })
      for (const child of (children.children || []).slice(0, 60)) {
        if (child.nodeType === 3) return child.nodeId
        if (child.nodeType === 1 && child.nodeId) {
          const found = await findTextNode(child.nodeId, depth + 1)
          if (found) return found
        }
      }
      return null
    }

    const fontsForNode = async (nodeId) => {
      try {
        const direct = await client.send('CSS.getPlatformFontsForNode', { nodeId })
        if (direct && Array.isArray(direct.fonts) && direct.fonts.length) {
          return { fonts: direct.fonts, source: 'element' }
        }
      } catch (error) {
        void error
      }
      const textNodeId = await findTextNode(nodeId)
      if (!textNodeId) return { fonts: [], source: null }
      const fromText = await client.send('CSS.getPlatformFontsForNode', { nodeId: textNodeId })
      return { fonts: fromText && Array.isArray(fromText.fonts) ? fromText.fonts : [], source: 'descendant-text-node' }
    }

    for (const target of targets) {
      const record = {
        name: target.name,
        group: target.group,
        selector: target.selector,
        required: target.required,
        status: 'not-measured',
        source: null,
        fonts: [],
        error: null,
      }
      try {
        const query = await client.send('DOM.querySelector', {
          nodeId: doc.root.nodeId,
          selector: target.selector,
        })
        if (!query || !query.nodeId) {
          record.error = 'selector not found'
          out.targets.push(record)
          continue
        }
        const fonts = await fontsForNode(query.nodeId)
        record.source = fonts.source
        record.fonts = (fonts.fonts || []).map((font) => ({
          familyName: font.familyName || null,
          glyphCount: font.glyphCount || 0,
          isCustomFont: Boolean(font.isCustomFont),
        }))
        record.status = record.fonts.length ? 'ok' : 'not-measured'
        if (!record.fonts.length) record.error = 'no platform font entries'
        out.targets.push(record)
      } catch (error) {
        record.error = safeString(error.message, 500)
        out.targets.push(record)
      }
    }

    for (const group of ['h1', 'body', 'aux']) {
      const found = out.targets.filter((target) => target.group === group && target.status === 'ok')
      out.groups[group] = {
        status: found.length ? 'ok' : 'not-measured',
        targets: found.map((target) => target.name),
      }
    }
    const optional = out.targets.filter((target) => target.group === 'optional' && target.status === 'ok')
    out.groups.optional = { status: optional.length ? 'ok' : 'not-measured', targets: optional.map((target) => target.name) }

    out.actualFamilies = Array.from(new Set(out.targets.flatMap((target) => target.fonts.map((font) => font.familyName)).filter(Boolean)))
    const requiredGroupsOk = ['h1', 'body', 'aux'].every((group) => out.groups[group].status === 'ok')
    out.status = requiredGroupsOk ? 'ok' : 'not-measured'
    if (!requiredGroupsOk) out.reason = 'one or more required text groups have no platform-font measurement'
  } catch (error) {
    out.reason = safeString(error.message, 600)
  } finally {
    try {
      if (client) await client.detach()
    } catch (error) {
      void error
    }
  }
  return out
}

function attachPageEvents(page, rec) {
  const pending = []
  const onConsole = (message) => {
    let text = ''
    try {
      text = message.text()
    } catch (error) {
      text = `[console text unavailable: ${error.message}]`
    }
    const entry = {
      type: message.type(),
      text: safeString(text, 4000),
      location: message.location ? {
        url: message.location.url,
        lineNumber: message.location.lineNumber,
        columnNumber: message.location.columnNumber,
      } : null,
    }
    rec.console.messages.push(entry)
    if (entry.type === 'warning') rec.console.warnings.push(entry)
    if (entry.type === 'error') rec.console.errors.push(entry)
  }
  const onPageError = (error) => {
    rec.pageErrors.push({
      name: error && error.name ? error.name : 'Error',
      message: safeString(error && error.message ? error.message : error, 4000),
      stack: safeString(error && error.stack ? error.stack : '', 8000),
    })
  }
  const onResponse = (response) => {
    if (response.status() !== 501) return
    let url
    try {
      url = new URL(response.url())
    } catch (error) {
      return
    }
    if (!url.pathname.includes('/api/')) return
    const entry = {
      status: 501,
      method: response.request().method(),
      path: url.pathname,
      query: url.search,
      bodySnippet: null,
    }
    rec.api501.push(entry)
    pending.push(response.text().then((body) => {
      entry.bodySnippet = safeString(body, 1200)
    }).catch(() => {
      entry.bodySnippet = '[response body unavailable]'
    }))
  }
  const onRequestFailed = (request) => {
    let url
    try {
      url = new URL(request.url())
    } catch (error) {
      return
    }
    if (!url.pathname.includes('/api/')) return
    rec.apiFailures.push({
      path: url.pathname,
      method: request.method(),
      failure: request.failure() ? request.failure().errorText : null,
    })
  }

  page.on('console', onConsole)
  page.on('pageerror', onPageError)
  page.on('response', onResponse)
  page.on('requestfailed', onRequestFailed)

  return {
    async settle() {
      await Promise.allSettled(pending)
    },
    remove() {
      try { page.off('console', onConsole) } catch (error) { void error }
      try { page.off('pageerror', onPageError) } catch (error) { void error }
      try { page.off('response', onResponse) } catch (error) { void error }
      try { page.off('requestfailed', onRequestFailed) } catch (error) { void error }
    },
  }
}

async function waitForHome(page, rec) {
  rec.homeWait = { selector: 'ok', settled: 'ok' }
  try {
    await page.waitForSelector('.home-page', { state: 'visible', timeout: 25000 })
  } catch (error) {
    rec.homeWait.selector = `timeout/error: ${safeString(error.message, 300)}`
  }
  try {
    await page.waitForFunction(() => {
      const root = document.querySelector('.home-page')
      if (!root) return false
      const h1 = root.querySelector('.home-title, [role="heading"][aria-level="1"]')
      if (!h1) return false
      return Boolean(root.querySelector('.home-progress__text, .home-task, .home-empty, .home-block, .home-line--error'))
    }, null, { timeout: 15000, polling: 100 })
  } catch (error) {
    rec.homeWait.settled = `timeout/error: ${safeString(error.message, 300)}`
  }
  try {
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) await document.fonts.ready
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    })
  } catch (error) {
    rec.notes.push(`fonts.ready wait failed: ${safeString(error.message, 300)}`)
  }
  await sleep(250)
  rec.homeWait.final = await page.evaluate(() => ({
    title: document.title,
    bodyTextLength: (document.body && document.body.innerText ? document.body.innerText : '').length,
    hasHome: Boolean(document.querySelector('.home-page')),
    hasTask: Boolean(document.querySelector('.home-task')),
    hasCourse: Boolean(document.querySelector('.home-course')),
    hasPrimary: Boolean(document.querySelector('.home-primary')),
    hasSearch: Boolean(document.querySelector('.home-search__input')),
  })).catch((error) => ({ error: safeString(error.message, 300) }))
}

async function screenshot(page, runDir, name, fullPage) {
  const file = path.join(runDir, name)
  await page.screenshot({ path: file, fullPage, animations: 'disabled', caret: 'hide' })
  return { abs: file, rel: relFromRepo(file), fullPage }
}

async function captureState(page, rec, runDir, prefix, name, action) {
  const item = { name, status: 'not-measured', screenshots: [], error: null, detail: null }
  try {
    const detail = await action()
    await sleep(200)
    item.detail = detail
    const viewport = await screenshot(page, runDir, `${prefix}-state-${name}-viewport.png`, false)
    item.screenshots.push(viewport)
    item.status = 'captured'
    rec.stateCaptures.push(item)
  } catch (error) {
    item.error = safeString(error.message, 800)
    rec.stateCaptures.push(item)
  }
}

async function captureAllVisualStates(page, rec, runDir, plan, prefix) {
  void plan
  const input = page.locator('.home-search__input')
  const inputCount = await input.count()
  if (!inputCount) {
    rec.stateCaptures.push({ name: 'search-results', status: 'not-measured', error: 'search input not found' })
    rec.stateCaptures.push({ name: 'search-nomatch', status: 'not-measured', error: 'search input not found' })
    rec.stateCaptures.push({ name: 'search-clear', status: 'not-measured', error: 'search input not found' })
    return
  }

  const baseline = await page.evaluate(() => {
    const first = document.querySelector('.home-course__title')
    return {
      firstTitle: first ? first.textContent.trim() : '',
      courseCount: document.querySelectorAll('.home-course').length,
    }
  })
  if (!baseline.firstTitle || baseline.courseCount < 1) {
    rec.stateCaptures.push({ name: 'search-results', status: 'not-measured', error: 'no course title/course row available' })
    rec.stateCaptures.push({ name: 'search-nomatch', status: 'not-measured', error: 'no course title/course row available' })
    rec.stateCaptures.push({ name: 'search-clear', status: 'not-measured', error: 'no course title/course row available' })
    return
  }

  const setQuery = async (query) => {
    await input.fill(query)
    await sleep(200)
    let changed = await page.evaluate(() => Boolean(document.querySelector('.home-search__count')) || document.querySelectorAll('.home-course').length === 0)
    if (!changed) {
      await input.evaluate((el, value) => {
        el.value = value
        el.dispatchEvent(new CustomEvent('input', { bubbles: true, detail: { value } }))
      }, query)
      await sleep(250)
      changed = await page.evaluate(() => Boolean(document.querySelector('.home-search__count')) || document.querySelectorAll('.home-course').length === 0)
    }
    return page.evaluate(() => ({
      inputValue: document.querySelector('.home-search__input') ? document.querySelector('.home-search__input').value : null,
      courseCount: document.querySelectorAll('.home-course').length,
      countText: document.querySelector('.home-search__count') ? document.querySelector('.home-search__count').textContent.trim() : null,
      emptyLine: Array.from(document.querySelectorAll('.home-line')).map((el) => el.textContent.trim()).filter(Boolean).slice(0, 4),
    }))
  }

  await captureState(page, rec, runDir, prefix, 'search-results', async () => {
    const query = baseline.firstTitle.split(/\s+/)[0].slice(0, 8)
    const detail = await setQuery(query)
    if (detail.courseCount < 1) throw new Error(`expected >=1 course for query ${query}, saw 0`)
    if (!detail.countText) throw new Error(`search result count text missing for query ${query}`)
    return { query, ...detail }
  })

  await captureState(page, rec, runDir, prefix, 'search-nomatch', async () => {
    const detail = await setQuery('__dsh_no_such_course_20261021__')
    if (detail.courseCount !== 0) throw new Error(`expected 0 courses for no-match query, saw ${detail.courseCount}`)
    return detail
  })

  await captureState(page, rec, runDir, prefix, 'search-clear', async () => {
    const clear = page.locator('.home-search__clear')
    if ((await clear.count()) < 1) throw new Error('search clear button not found after typing')
    await clear.first().click()
    await sleep(250)
    const detail = await page.evaluate(() => ({
      inputValue: document.querySelector('.home-search__input') ? document.querySelector('.home-search__input').value : null,
      courseCount: document.querySelectorAll('.home-course').length,
      countText: document.querySelector('.home-search__count') ? document.querySelector('.home-search__count').textContent.trim() : null,
    }))
    if (detail.courseCount !== baseline.courseCount) throw new Error(`clear did not restore ${baseline.courseCount} courses, saw ${detail.courseCount}`)
    if (detail.countText) throw new Error(`search count text still visible after clear: ${detail.countText}`)
    return detail
  })
}

async function measureKeyboardFocus(page, plan, opts = {}) {
  const out = {
    method: 'real page.keyboard.press(Tab) sequence; no programmatic focus',
    status: 'not-measured',
    reason: null,
    targets: [],
    screenshots: [],
  }
  const descriptors = []
  for (const item of [
    { name: 'primary', selector: '.home-primary', token: 'home-primary' },
    { name: 'search', selector: '.home-search__input', token: 'home-search__input' },
  ]) {
    if ((await page.locator(item.selector).count()) > 0) descriptors.push(item)
  }
  if (!descriptors.length) {
    const fallback = page.locator('.home-ghost, .home-text-action').first()
    if ((await fallback.count()) > 0) {
      const cls = await fallback.getAttribute('class')
      descriptors.push({ name: 'action', selector: '.home-ghost, .home-text-action', token: (cls || 'home-ghost').split(/\s+/)[0] })
    }
  }
  if (!descriptors.length) {
    out.reason = 'no primary/search/action control available for real keyboard focus'
    return out
  }

  for (const target of descriptors) {
    await page.evaluate(() => {
      if (document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur()
      window.scrollTo(0, 0)
    })
    let active = null
    let reached = false
    for (let i = 0; i < 24; i += 1) {
      await page.keyboard.press('Tab')
      await sleep(45)
      active = await page.evaluate(() => {
        const el = document.activeElement
        if (!el) return null
        const cs = getComputedStyle(el)
        let bg = cs.backgroundColor
        for (let node = el; node; node = node.parentElement) {
          const candidate = getComputedStyle(node).backgroundColor
          if (candidate && candidate !== 'rgba(0, 0, 0, 0)' && candidate !== 'transparent') {
            bg = candidate
            break
          }
        }
        return {
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          class: typeof el.className === 'string' ? el.className : null,
          text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 100),
          focusVisible: el.matches(':focus-visible'),
          outlineWidth: cs.outlineWidth,
          outlineStyle: cs.outlineStyle,
          outlineColor: cs.outlineColor,
          outlineOffset: cs.outlineOffset,
          boxShadow: cs.boxShadow,
          backgroundColor: bg,
          rect: (() => {
            const r = el.getBoundingClientRect()
            return { x: Number(r.x.toFixed(2)), y: Number(r.y.toFixed(2)), width: Number(r.width.toFixed(2)), height: Number(r.height.toFixed(2)) }
          })(),
        }
      })
      if (active && ((active.class && active.class.includes(target.token)) || (active.id && active.id === target.token))) {
        reached = true
        break
      }
    }

    const record = {
      target: target.name,
      status: reached ? 'measured' : 'not-measured',
      reached,
      active,
      visibleFocus: null,
      indicator: null,
      outlineContrast: null,
      error: null,
    }
    if (!reached) {
      record.error = `target ${target.name} not reached via Tab; last active=${JSON.stringify(active)}`
      out.targets.push(record)
      continue
    }

    const outlineWidth = Number.parseFloat(active.outlineWidth) || 0
    const shadow = active.boxShadow && active.boxShadow !== 'none'
    const outlineColor = parseCssColor(active.outlineColor)
    const bg = parseCssColor(active.backgroundColor)
    let ratio = null
    if (outlineColor && bg) ratio = contrastRatio(blendColor(outlineColor, bg), bg)
    record.outlineContrast = ratio == null ? null : Number(ratio.toFixed(2))
    record.visibleFocus = Boolean(active.focusVisible && (outlineWidth > 0 || shadow))
    record.indicator = outlineWidth > 0 ? 'outline' : (shadow ? 'box-shadow' : 'none')
    record.outline = {
      width: active.outlineWidth,
      style: active.outlineStyle,
      color: active.outlineColor,
      offset: active.outlineOffset,
      contrast: record.outlineContrast,
    }
    if (!record.visibleFocus) {
      record.error = 'focus reached but no visible outline/box-shadow or :focus-visible false'
    }
    if (opts.screenshot && opts.runDir) {
      try {
        const shot = await screenshot(page, opts.runDir, `${opts.prefix}-focus-${target.name}-viewport.png`, false)
        out.screenshots.push(shot)
      } catch (error) {
        record.error = `${record.error ? `${record.error}; ` : ''}focus screenshot failed: ${safeString(error.message, 300)}`
      }
    }
    out.targets.push(record)
  }

  if (out.targets.some((target) => target.status !== 'measured')) {
    out.status = 'not-measured'
    out.reason = 'one or more focus targets were not reached/measured'
  } else if (out.targets.some((target) => !target.visibleFocus)) {
    out.status = 'review'
    out.reason = 'focus reached but indicator is missing or not visibly distinguishable'
  } else {
    out.status = 'measured'
  }
  await page.evaluate(() => {
    if (document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur()
    window.scrollTo(0, 0)
  })
  return out
}

async function maybeCaptureCdpExtra(page, rec, runDir, prefix, plan) {
  if (plan.textScale !== 2) return
  const extra = {
    kind: 'cdp-page-scale-factor',
    factor: 2,
    status: 'not-measured',
    note: 'Extra record only. CDP Emulation.setPageScaleFactor is a visual-viewport page scale, not browser layout zoom, and does not replace the CSS textscale capture.',
    screenshots: [],
  }
  let client
  try {
    client = await page.context().newCDPSession(page)
    await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 })
    await sleep(300)
    extra.before = await page.evaluate(readThemeState)
    const shot = await screenshot(page, runDir, `${prefix}-cdp-page-scale-200-viewport.png`, false)
    extra.screenshots.push(shot)
    extra.after = await page.evaluate(() => ({
      scale: window.visualViewport ? window.visualViewport.scale : null,
      docClientWidth: document.documentElement.clientWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }))
    extra.status = 'captured'
  } catch (error) {
    extra.error = safeString(error.message, 700)
  } finally {
    try {
      if (client) await client.detach()
    } catch (error) {
      void error
    }
  }
  rec.extraCaptures.push(extra)
}

async function runScenario(app, context, plan, index, runDir) {
  const prefix = String(index + 1).padStart(2, '0')
  const slug = scenarioSlug(plan)
  const rec = {
    id: plan.id,
    index: index + 1,
    scenario: plan,
    kind: plan.kind || null,
    mode: plan.mode || 'ready',
    status: 'incomplete',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    screenshots: { viewport: null, full: null },
    dom: null,
    fixtureState: null,
    focus: null,
    allVisualExpected: false,
    themeRequested: { theme: plan.theme, colorScheme: plan.colorScheme, textScale: plan.textScale },
    themeBeforeFallback: null,
    themeActual: null,
    themeFallback: null,
    localeActual: null,
    textScale: plan.textScale === 2 ? { factor: 2, method: 'pending CSS textscale' } : { factor: 1, method: 'normal' },
    fontActual: null,
    copyDiff: null,
    checks: {},
    findings: [],
    console: { messages: [], warnings: [], errors: [] },
    pageErrors: [],
    api501: [],
    apiFailures: [],
    stateCaptures: [],
    extraCaptures: [],
    notes: [],
    error: null,
    closed: false,
  }
  let session = null
  let events = null

  try {
    const opts = {
      locale: plan.locale,
      theme: plan.theme,
      width: plan.width,
      height: plan.height,
      colorScheme: plan.colorScheme,
      mode: plan.mode || 'ready',
      caseId: plan.id,
      baseURL: BASE_URL,
      reducedMotion: 'reduce',
    }
    session = await context.fresh(opts)
    const page = session.page
    try {
      rec.fixtureState = session.state == null ? null : sanitizeValue(session.state)
    } catch (error) {
      rec.fixtureState = { error: safeString(error.message, 300) }
    }

    events = attachPageEvents(page, rec)
    await waitForHome(page, rec)
    await ensureTheme(page, plan, rec)

    if (plan.textScale === 2) {
      rec.textScale = await applyCssTextScale(page, 2)
      await sleep(250)
    }

    rec.themeActual = rec.themeActual || await page.evaluate(readThemeState)
    rec.localeActual = rec.themeActual
    rec.dom = await page.evaluate(collectPageData, {
      scopeSelector: '.home-page',
      expectedH1: EXPECTED_H1[plan.locale],
    })
    rec.fontActual = await readPlatformFonts(page)
    rec.copyDiff = buildCopyDiff(rec.dom, plan.locale)

    const viewport = await screenshot(page, runDir, `${prefix}-${slug}-viewport.png`, false)
    const full = await screenshot(page, runDir, `${prefix}-${slug}-full.png`, true)
    rec.screenshots.viewport = viewport
    rec.screenshots.full = full

    const allVisualBase = context.caseName === 'all-visual'
      && !plan.kind
      && plan.width === 390
      && ((plan.theme === 'light' && plan.locale === 'zh-CN') || (plan.theme === 'dark' && plan.locale === 'en-US'))
    rec.focus = await measureKeyboardFocus(page, plan, {
      screenshot: allVisualBase,
      runDir,
      prefix: `${prefix}-${slug}`,
    })

    if (allVisualBase) {
      rec.allVisualExpected = true
      await captureAllVisualStates(page, rec, runDir, plan, `${prefix}-${slug}`)
    }

    if (context.cdp200Extra && plan.textScale === 2) {
      await maybeCaptureCdpExtra(page, rec, runDir, `${prefix}-${slug}`, plan)
    }

    await events.settle()
    rec.status = 'measured'
  } catch (error) {
    rec.error = {
      name: error && error.name ? error.name : 'Error',
      message: safeString(error && error.message ? error.message : error, 1200),
      stack: safeString(error && error.stack ? error.stack : '', 5000),
    }
    if (error instanceof Refusal) {
      rec.setupFailure = {
        code: error.code,
        message: safeString(error.message, 1500),
        stage: 'fixture/fresh',
      }
    }
    rec.notes.push('scenario did not complete; partial DOM/screenshots may exist and are not a pass')
    if (session && session.page && !session.page.isClosed()) {
      try {
        rec.screenshots.errorViewport = await screenshot(session.page, runDir, `${prefix}-${slug}-error-viewport.png`, false)
      } catch (shotError) {
        rec.notes.push(`error screenshot failed: ${safeString(shotError.message, 400)}`)
      }
    }
  } finally {
    if (events) {
      try { await events.settle() } catch (error) { void error }
      events.remove()
    }
    if (session && session._dshMediaClient) {
      try { await session._dshMediaClient.detach() } catch (error) { void error }
    }
    if (rec.cdpMediaClient) {
      try { await rec.cdpMediaClient.detach() } catch (error) { void error }
      rec.cdpMediaClient = null
    }
    if (session && typeof session.close === 'function') {
      try {
        await session.close()
        rec.closed = true
      } catch (error) {
        rec.notes.push(`session.close() failed: ${safeString(error.message, 500)}`)
        rec.closed = false
      }
    } else {
      rec.notes.push('fixture session has no close(); cannot prove closed')
      rec.closed = false
    }
    rec.finishedAt = new Date().toISOString()
  }

  if (rec.dom) {
    try {
      rec.checks = evaluateChecks(rec, plan)
      rec.findings = collectFindings(rec, plan)
      if (rec.status === 'measured') {
        if (Object.values(rec.checks).some((check) => check.status === 'fail')) rec.status = 'fail'
        else if (Object.values(rec.checks).some((check) => check.status === 'not-measured')) rec.status = 'incomplete'
        else rec.status = 'ok'
      }
    } catch (error) {
      rec.status = 'incomplete'
      rec.notes.push(`check evaluation failed: ${safeString(error.message, 800)}`)
      rec.checks = rec.checks || {}
      rec.checks.checkEvaluation = makeCheck('not-measured', `check evaluation failed: ${safeString(error.message, 800)}`)
      rec.findings = rec.findings || []
      rec.findings.push({ code: 'CHECK_EVALUATION_FAILED', severity: 'incomplete', detail: safeString(error.message, 800), samples: null })
    }
  } else if (rec.error) {
    rec.findings = rec.findings || []
    rec.findings.push({
      code: 'SCENARIO_ERROR',
      severity: 'incomplete',
      detail: `${rec.error.name}: ${rec.error.message}`,
      samples: rec.error.stack ? [rec.error.stack] : null,
    })
  }
  return rec
}

/* ------------------------------------------------------------------------- */
/* Check evaluation. No product PASS is minted here; only measured checks.   */
/* ------------------------------------------------------------------------- */

function makeCheck(status, detail, extra = {}) {
  return { status, detail, ...extra }
}

function sampleRuns(runs, mapper, limit = 8) {
  return runs.slice(0, limit).map(mapper)
}

function evaluateChecks(rec, plan) {
  const dom = rec.dom
  const checks = {}
  const stateContext = plan.kind === 'empty' || plan.kind === 'error'
  const expectedH1 = EXPECTED_H1[plan.locale]
  const h1 = dom.h1
  const h1Text = h1.texts.length === 1 ? h1.texts[0] : null
  checks.h1 = makeCheck(
    h1.accessibleCount === 1 && h1Text === expectedH1 ? 'ok' : 'fail',
    `accessible H1 count=${h1.accessibleCount}, native h1 count=${h1.nativeCount}, text=${JSON.stringify(h1Text)}`,
    {
      expected: expectedH1,
      texts: h1.texts,
      nativeTexts: h1.nativeTexts,
      accessibleCount: h1.accessibleCount,
      nativeCount: h1.nativeCount,
      nativeH1Absent: h1.nativeCount === 0,
    },
  )

  const bodyRuns = dom.runs.filter((run) => run.tier === 'body')
  const bodyBad = bodyRuns.filter((run) => run.fontSize < 15.99 || run.lineHeight === null || run.lineHeight < 23.5)
  checks.typographyBody = bodyRuns.length
    ? makeCheck(bodyBad.length ? 'fail' : 'ok', `${bodyRuns.length} body runs; ${bodyBad.length} below 16px/24px`, {
      samples: sampleRuns(bodyBad.length ? bodyBad : bodyRuns, (run) => ({
        text: run.text, fontSize: run.fontSize, lineHeight: run.lineHeight, selector: run.selector,
      })),
    })
    : makeCheck('not-measured', 'no visible body-tier text runs found')

  const brandRuns = dom.runs.filter((run) => run.tier === 'brand')
  checks.typographyBrand = brandRuns.length
    ? makeCheck('info', `${brandRuns.length} brand wordmark run(s); recorded but not classified as auxiliary copy`, {
      samples: sampleRuns(brandRuns, (run) => ({
        text: run.text,
        fontSize: run.fontSize,
        lineHeight: run.lineHeight,
        ratio: run.lineHeightRatio,
        selector: run.selector,
        note: 'brand wordmark; 14px minimum still applies, auxiliary 1.6 typography tier does not',
      })),
    })
    : makeCheck('info', 'no brand wordmark run measured')

  const auxRuns = dom.runs.filter((run) => run.tier === 'auxiliary')
  const auxBad = auxRuns.filter((run) => run.fontSize < 13.99 || run.lineHeight === null || run.lineHeight < run.fontSize * 1.6 - 0.2)
  checks.typographyAux = auxRuns.length
    ? makeCheck(auxBad.length ? 'fail' : 'ok', `${auxRuns.length} auxiliary runs; ${auxBad.length} below 14px or 1.6 line-height`, {
      samples: sampleRuns(auxBad.length ? auxBad : auxRuns, (run) => ({
        text: run.text,
        fontSize: run.fontSize,
        lineHeight: run.lineHeight,
        ratio: run.lineHeightRatio,
        selector: run.selector,
      })),
    })
    : makeCheck('not-measured', 'no visible auxiliary-tier text runs found')

  const small = dom.runs.filter((run) => run.fontSize < 13.99)
  checks.textMin = dom.runs.length
    ? makeCheck(small.length ? 'fail' : 'ok', `${dom.runs.length} text runs; ${small.length} below 14px`, {
      samples: sampleRuns(small, (run) => ({ text: run.text, fontSize: run.fontSize, selector: run.selector })),
    })
    : makeCheck('not-measured', 'no visible text runs found')

  const targetBad = dom.controls.filter((control) => control.width < 43.5 || control.height < 43.5)
  checks.buttonTargets = dom.controls.length
    ? makeCheck(targetBad.length ? 'fail' : 'ok', `${dom.controls.length} controls; ${targetBad.length} below 44x44`, {
      samples: sampleRuns(targetBad, (control) => ({
        text: control.text, width: control.width, height: control.height, selector: control.selector, disabled: control.disabled,
      })),
    })
    : makeCheck('not-measured', 'no visible controls found')

  const primary = dom.controls.filter((control) => control.primary)
  const primaryBad = primary.filter((control) => control.height < 47.5)
  checks.primaryTarget = primary.length
    ? makeCheck(primaryBad.length ? 'fail' : 'ok', `${primary.length} primary controls; ${primaryBad.length} below 48px high`, {
      samples: sampleRuns(primaryBad.length ? primaryBad : primary, (control) => ({
        text: control.text, width: control.width, height: control.height, selector: control.selector,
      })),
    })
    : makeCheck(stateContext ? 'info' : 'not-measured', stateContext
      ? 'no primary control in this independent empty/error context'
      : 'no .home-primary / data-primary control found')

  const boundaryBad = []
  const boundaryNotMeasured = []
  const boundaryDetails = []
  for (const input of dom.inputs) {
    const boundary = input.effectiveBoundary
    if (!boundary || boundary.width < 1 || boundary.style === 'none' || boundary.style === 'hidden') {
      boundaryBad.push({
        selector: input.selector,
        nativeBorder: input.nativeBorder,
        effectiveBoundary: boundary,
        reason: 'no visible native or wrapper boundary',
      })
      continue
    }
    const border = parseCssColor(boundary.color)
    const outside = parseCssColor(boundary.outerBg)
    if (!border || !outside) {
      boundaryNotMeasured.push({ selector: input.selector, reason: 'unparsable border/background color' })
      continue
    }
    const effectiveBorder = blendColor(border, outside)
    const ratio = contrastRatio(effectiveBorder, outside)
    boundaryDetails.push({
      selector: input.selector,
      boundarySelector: boundary.selector,
      boundarySource: boundary.selector && boundary.selector.includes('home-search') ? 'outer .home-search wrapper border' : (input.nativeBorder.width >= 1 && input.nativeBorder.style !== 'none' ? 'native input border' : 'wrapper element border'),
      nativeBorderWidth: input.nativeBorder.width,
      nativeBorderStyle: input.nativeBorder.style,
      nativeBorderColor: input.nativeBorder.color,
      effectiveWidth: boundary.width,
      border: colorText(effectiveBorder),
      outside: colorText(outside),
      ratio: Number(ratio.toFixed(2)),
      threshold: 3,
    })
    if (ratio < 3) boundaryBad.push({ selector: input.selector, ratio: Number(ratio.toFixed(2)), colors: boundaryDetails[boundaryDetails.length - 1] })
  }
  checks.inputBoundary = dom.inputs.length
    ? makeCheck(
      boundaryBad.length ? 'fail' : (boundaryNotMeasured.length ? 'not-measured' : 'ok'),
      `${dom.inputs.length} inputs; ${boundaryBad.length} below 3:1; ${boundaryNotMeasured.length} unmeasured`,
      { details: boundaryDetails, failures: boundaryBad, notMeasured: boundaryNotMeasured },
    )
    : makeCheck(stateContext ? 'info' : 'not-measured', stateContext
      ? 'no input in this independent empty/error context'
      : 'no visible input found')

  const normalRuns = []
  const largeRuns = []
  const contrastNotMeasured = []
  const disabledContrast = []
  for (const run of dom.runs) {
    const fg = parseCssColor(run.color)
    const bg = parseCssColor(run.bgColor ? cssColorFromParts(run.bgColor) : null)
    if (!fg || !bg) {
      contrastNotMeasured.push({ text: run.text, selector: run.selector, reason: 'unparsable color/background' })
      continue
    }
    let effectiveFg = blendColor(fg, bg)
    if (Number.isFinite(run.opacity) && run.opacity < 0.999) {
      effectiveFg = blendColor({ ...effectiveFg, a: effectiveFg.a * run.opacity }, bg)
    }
    const ratio = contrastRatio(effectiveFg, bg)
    const item = {
      text: run.text,
      selector: run.selector,
      fontSize: run.fontSize,
      fontWeight: run.fontWeight,
      opacity: run.opacity,
      fg: colorText(effectiveFg),
      bg: colorText(bg),
      ratio: Number(ratio.toFixed(2)),
    }
    if (run.disabled) {
      disabledContrast.push({ ...item, enforced: false, note: 'disabled text listed separately; not used as a non-disabled contrast exemption' })
      continue
    }
    if (run.bgImage) {
      contrastNotMeasured.push({ text: run.text, selector: run.selector, reason: 'background image/gradient behind text' })
      continue
    }
    if (isLargeText(run.fontSize, run.fontWeight)) largeRuns.push({ ...item, threshold: 3 })
    else normalRuns.push({ ...item, threshold: 4.5 })
  }
  const normalBad = normalRuns.filter((item) => item.ratio < 4.5)
  const largeBad = largeRuns.filter((item) => item.ratio < 3)
  checks.contrastNormal = normalRuns.length
    ? makeCheck(normalBad.length ? 'fail' : (contrastNotMeasured.length ? 'not-measured' : 'ok'), `${normalRuns.length} normal text runs; ${normalBad.length} below 4.5:1`, {
      samples: (normalBad.length ? normalBad : normalRuns).slice(0, 8),
      notMeasured: contrastNotMeasured.slice(0, 8),
    })
    : makeCheck('not-measured', 'no normal-size text contrast runs measured')
  checks.contrastLarge = largeRuns.length
    ? makeCheck(largeBad.length ? 'fail' : (contrastNotMeasured.length ? 'not-measured' : 'ok'), `${largeRuns.length} large text runs; ${largeBad.length} below 3:1`, {
      samples: (largeBad.length ? largeBad : largeRuns).slice(0, 8),
      notMeasured: contrastNotMeasured.slice(0, 8),
    })
    : makeCheck('not-measured', 'no large text contrast runs measured')
  checks.contrastDisabled = makeCheck('info', `${disabledContrast.length} disabled text runs listed separately`, {
    samples: disabledContrast.slice(0, 12),
    enforced: false,
  })

  const placeholderBad = []
  const placeholderMeasured = []
  for (const input of dom.inputs) {
    if (!input.placeholder || !input.placeholder.color) continue
    const fg = parseCssColor(input.placeholder.color)
    const bg = parseCssColor(cssColorFromParts(input.inputBg))
    if (!fg || !bg) continue
    const ratio = contrastRatio(blendColor(fg, bg), bg)
    const detail = {
      selector: input.selector,
      fg: colorText(blendColor(fg, bg)),
      bg: colorText(bg),
      ratio: Number(ratio.toFixed(2)),
    }
    placeholderMeasured.push(detail)
    if (ratio < 4.5) placeholderBad.push(detail)
  }
  checks.placeholderContrast = placeholderMeasured.length
    ? makeCheck(placeholderBad.length ? 'fail' : 'ok', `${placeholderMeasured.length} placeholder(s); ${placeholderBad.length} below 4.5:1`, {
      details: placeholderMeasured,
    })
    : makeCheck('info', 'no placeholder color measured')

  const clampBad = dom.runs.filter((run) => run.clipping.lineClamp)
  const clipBad = dom.runs.filter((run) => run.clipping.clipped && !run.clipping.lineClamp)
  const glyphInk = dom.runs.filter((run) => run.clipping.overflowVisibleInk)
  checks.clamp = dom.runs.length
    ? makeCheck(clampBad.length ? 'fail' : 'ok', `${clampBad.length} clamped text run(s)`, {
      samples: sampleRuns(clampBad, (run) => ({ text: run.text, clamp: run.clipping.lineClamp, selector: run.selector })),
      glyphInkNotClipping: glyphInk.slice(0, 8).map((run) => ({
        text: run.text,
        scrollWidth: run.clipping.scrollWidth,
        selector: run.selector,
        note: 'overflow visible; glyph ink is not treated as clipping',
      })),
    })
    : makeCheck('not-measured', 'no text runs for clamp check')

  const controlOverflow = dom.controls.filter((control) => control.childOverflow || (control.hidesOverflow && control.scrollWidth > 2))
  checks.controlOverflow = dom.controls.length
    ? makeCheck(controlOverflow.length ? 'fail' : 'ok', `${controlOverflow.length} control(s) with text outside bounds`, {
      samples: sampleRuns(controlOverflow, (control) => ({
        text: control.text, width: control.width, height: control.height, scrollWidth: control.scrollWidth,
        scrollHeight: control.scrollHeight, childOverflow: control.childOverflow, selector: control.selector,
      })),
    })
    : makeCheck('not-measured', 'no controls for overflow check')

  checks.textOverlap = makeCheck(dom.overlaps.length ? 'fail' : 'ok', `${dom.overlaps.length} text overlap pair(s)`, {
    samples: dom.overlaps,
  })
  checks.controlOverlap = makeCheck(dom.controlOverlaps.length ? 'fail' : 'ok', `${dom.controlOverlaps.length} control overlap pair(s)`, {
    samples: dom.controlOverlaps,
  })

  const docOverflow = dom.doc.horizontalOverflow || dom.doc.bodyHorizontalOverflow
  checks.documentScroll = makeCheck(docOverflow ? 'fail' : 'ok', docOverflow ? 'document horizontal overflow' : 'document client/scroll width stable', {
    doc: dom.doc,
    offenders: dom.offenders,
  })

  const theme = evaluateTheme(rec.themeActual, plan)
  checks.theme = makeCheck(theme.ok ? 'ok' : 'fail', theme.detail, theme)

  const h1Ok = h1.accessibleCount === 1 && h1Text === expectedH1
  const lang = rec.localeActual && rec.localeActual.htmlLang ? rec.localeActual.htmlLang : null
  const uiLocale = rec.localeActual
    ? (rec.localeActual.rootUiLocale || rec.localeActual.bodyUiLocale || rec.localeActual.appUiLocale)
    : null
  const langPrefix = plan.locale.split('-')[0]
  const langOk = !lang || String(lang).toLowerCase().startsWith(langPrefix)
  const uiOk = !uiLocale || String(uiLocale).toLowerCase().startsWith(langPrefix)
  checks.locale = makeCheck(h1Ok && langOk && uiOk ? 'ok' : 'fail', `h1=${JSON.stringify(h1Text)}, htmlLang=${JSON.stringify(lang)}, data-ui-locale=${JSON.stringify(uiLocale)}`, {
    expectedH1,
    h1Ok,
    htmlLang: lang,
    htmlLangOk: langOk,
    uiLocale,
    uiLocaleOk: uiOk,
    note: 'H1 text is authoritative for locale; missing lang/ui-locale is recorded, not silently passed.',
  })

  const iconWarnings = [
    ...rec.console.warnings,
    ...rec.console.errors,
  ].filter((message) => /icon|图标|uni-icons/i.test(message.text)
    && /uni-?text|<\s*text\b|text component|text 组件/i.test(message.text))
  checks.iconWarning = makeCheck(iconWarnings.length ? 'fail' : 'ok', `${iconWarnings.length} uni-text/icon warning(s)`, {
    samples: iconWarnings,
  })

  checks.pageErrors = makeCheck(rec.pageErrors.length ? 'fail' : 'ok', `${rec.pageErrors.length} pageerror(s)`, {
    samples: rec.pageErrors,
  })
  checks.consoleErrors = makeCheck(rec.console.errors.length ? 'review' : 'ok', `${rec.console.errors.length} console error(s) preserved verbatim`, {
    samples: rec.console.errors,
  })

  const fontStatus = rec.fontActual && rec.fontActual.status === 'ok' ? 'ok' : 'not-measured'
  checks.fonts = makeCheck(fontStatus, fontStatus === 'ok'
    ? `CDP platform fonts measured for ${rec.fontActual.actualFamilies.length} family/families`
    : `CDP platform fonts not measured: ${rec.fontActual ? rec.fontActual.reason : 'missing result'}`, {
    groups: rec.fontActual ? rec.fontActual.groups : null,
    targets: rec.fontActual ? rec.fontActual.targets : [],
    cssFontStacksAreNotActualFonts: true,
  })

  const homeWaitBad = rec.homeWait && (rec.homeWait.selector !== 'ok' || rec.homeWait.settled !== 'ok')
  if (homeWaitBad) {
    checks.homeReady = makeCheck('not-measured', 'home page did not reach the expected settled state in time', rec.homeWait)
  } else {
    checks.homeReady = makeCheck('ok', 'home page visible and settled marker found', rec.homeWait)
  }

  if (rec.focus) {
    const focusStatus = rec.focus.status === 'measured'
      ? 'ok'
      : (rec.focus.status === 'review' ? 'review' : (stateContext ? 'info' : 'not-measured'))
    checks.focus = makeCheck(focusStatus, rec.focus.status === 'measured'
      ? 'real Tab focus reached all selected controls with visible indicator'
      : (rec.focus.reason || 'focus not measured'), {
      method: rec.focus.method,
      targets: rec.focus.targets,
      screenshots: rec.focus.screenshots,
      requiredForReadyPage: !stateContext,
    })
  } else {
    checks.focus = makeCheck(stateContext ? 'info' : 'not-measured', 'keyboard focus measurement missing')
  }

  if (rec.allVisualExpected) {
    const states = Array.isArray(rec.stateCaptures) ? rec.stateCaptures : []
    const expectedNames = ['search-results', 'search-nomatch', 'search-clear']
    const byName = Object.fromEntries(states.map((state) => [state.name, state]))
    const missing = expectedNames.filter((name) => !byName[name] || byName[name].status !== 'captured')
    checks.allVisualStates = makeCheck(missing.length ? 'not-measured' : 'ok', missing.length
      ? `all-visual search states not captured: ${missing.join(', ')}`
      : 'search-results, search-nomatch and search-clear captured via real interactions', {
      states: expectedNames.map((name) => byName[name] || { name, status: 'missing' }),
    })
  }

  return checks
}

function cssColorFromParts(parts) {
  if (!parts) return null
  if (typeof parts === 'string') return parts
  const alpha = parts.a == null ? 1 : parts.a
  return `rgba(${parts.r}, ${parts.g}, ${parts.b}, ${alpha})`
}

function evaluateTheme(actual, plan) {
  const result = {
    ok: false,
    expectedTheme: plan.theme,
    expectedColorScheme: plan.colorScheme,
    actual: actual || null,
    source: null,
    marker: null,
    detail: '',
  }
  if (!actual || actual.error) {
    result.detail = `theme state unavailable: ${actual && actual.error ? actual.error : 'null'}`
    return result
  }
  const attrs = [actual.rootDataTheme, actual.bodyDataTheme, actual.appDataTheme].filter(Boolean)
  const themeModes = [actual.rootDataThemeMode, actual.bodyDataThemeMode, actual.appDataThemeMode].filter(Boolean)
  const classes = [actual.rootClass, actual.bodyClass, actual.appClass].filter(Boolean).join(' ')
  const markers = attrs.concat(themeModes, classes ? [classes] : [])
  const hcFlag = [actual.rootDataHighContrast, actual.bodyDataHighContrast, actual.appDataHighContrast, actual.rootDataContrast, actual.bodyDataContrast]
    .filter((value) => value != null && value !== 'false' && value !== '0')
  const systemDark = actual.systemDark === true

  if (plan.theme === 'high-contrast') {
    const hc = hcFlag.length
      ? `data-high-contrast=${hcFlag[0]}`
      : markers.find((value) => /contrast|highcontrast|(^|[-_\s])hc($|[-_\s])/i.test(value))
    result.ok = Boolean(hc)
    result.source = hcFlag.length ? 'DOM data-high-contrast/data-contrast' : (hc ? 'DOM data-theme/class/theme-mode' : null)
    result.marker = hc || null
    result.detail = `high-contrast DOM marker ${hc ? `found: ${hc}` : 'MISSING'}; root data-theme=${JSON.stringify(actual.rootDataTheme)}; root data-high-contrast=${JSON.stringify(actual.rootDataHighContrast)}; root data-theme-mode=${JSON.stringify(actual.rootDataThemeMode)}`
    return result
  }

  if (plan.theme === 'system') {
    const darkMarker = markers.find((value) => /dark|system/i.test(value))
    const bg = parseCssColor(actual.bodyBg)
    const computedDark = bg ? relativeLuminance(bg) < 0.5 : false
    result.ok = systemDark && (Boolean(darkMarker) || computedDark)
    result.source = darkMarker ? 'DOM dark/system marker + prefers-color-scheme' : (computedDark ? 'prefers-color-scheme + computed dark body background' : null)
    result.marker = darkMarker || null
    result.detail = `system dark=${systemDark}; resolved dark marker=${darkMarker ? JSON.stringify(darkMarker) : 'MISSING'}; computedDarkBody=${computedDark}; root data-theme=${JSON.stringify(actual.rootDataTheme)}`
    return result
  }

  const wanted = plan.theme === 'dark' ? /dark/i : /light/i
  const marker = markers.find((value) => wanted.test(value))
  const bg = parseCssColor(actual.bodyBg)
  const bgLum = bg ? relativeLuminance(bg) : null
  const computedMatches = plan.theme === 'dark'
    ? (bgLum !== null && bgLum < 0.5)
    : (bgLum !== null && bgLum >= 0.5)
  result.ok = Boolean(marker) || computedMatches
  result.source = marker ? 'DOM data-theme/class' : (computedMatches ? 'computed body background' : null)
  result.marker = marker || null
  result.detail = `${plan.theme} marker=${marker ? JSON.stringify(marker) : 'MISSING'}; bodyBg=${JSON.stringify(actual.bodyBg)}; root data-theme=${JSON.stringify(actual.rootDataTheme)}`
  return result
}

function collectFindings(rec, plan) {
  const findings = []
  for (const [name, check] of Object.entries(rec.checks)) {
    if (check.status === 'fail') {
      findings.push({ code: name, severity: 'error', detail: check.detail, samples: check.samples || check.failures || check.details || check.doc || null })
    } else if (check.status === 'not-measured') {
      findings.push({ code: name, severity: 'incomplete', detail: check.detail, samples: check.samples || check.notMeasured || null })
    } else if (check.status === 'review') {
      findings.push({ code: name, severity: 'review', detail: check.detail, samples: check.samples || null })
    }
  }
  if (rec.dom && rec.dom.h1 && rec.dom.h1.nativeCount === 0 && rec.dom.h1.accessibleCount === 1) {
    findings.push({
      code: 'NATIVE_H1_ELEMENT_ABSENT',
      severity: 'warning',
      detail: 'No native <h1>; exactly one accessible role=heading aria-level=1 is present. Recorded for Root; accessible H1 check still applies.',
      samples: rec.dom.h1.elements,
    })
  }
  if (rec.dom && rec.dom.truncatedRuns) {
    findings.push({ code: 'TEXT_RUNS_TRUNCATED', severity: 'incomplete', detail: 'More than 260 text runs; typography/contrast sample was truncated.', samples: null })
  }
  if (rec.homeWait && (rec.homeWait.selector !== 'ok' || rec.homeWait.settled !== 'ok')) {
    findings.push({ code: 'HOME_WAIT_TIMEOUT', severity: 'incomplete', detail: 'Home did not settle within timeout; measurements are still recorded.', samples: rec.homeWait })
  }
  if (rec.themeFallback && /failed/i.test(rec.themeFallback)) {
    findings.push({ code: 'SYSTEM_DARK_FALLBACK_FAILED', severity: 'incomplete', detail: rec.themeFallback, samples: null })
  }
  if (rec.checks && rec.checks.typographyBrand && rec.checks.typographyBrand.samples
    && rec.checks.typographyBrand.samples.some((item) => item.ratio !== null && item.ratio < 1.6)) {
    findings.push({
      code: 'BRAND_WORDMARK_LINE_HEIGHT_BELOW_1_6',
      severity: 'info',
      detail: 'Brand wordmark is below the auxiliary 1.6 line-height ratio; it is classified as a brand label, not auxiliary copy. Root decides concept fidelity.',
      samples: rec.checks.typographyBrand.samples,
    })
  }
  if (plan.textScale === 2) {
    findings.push({
      code: 'TEXTSCALE_METHOD',
      severity: 'info',
      detail: '200% is inline CSS font-size/line-height textscale, not browser layout zoom. Optional CDP visual-viewport page scale is an extra record only and is not called browser 200% zoom.',
      samples: rec.textScale,
    })
  }
  return findings
}

/* ------------------------------------------------------------------------- */
/* Fixture adapter. The QA fixture is still being authored, so this is a     */
/* strict runtime adapter, never a second fixture implementation.            */
/* ------------------------------------------------------------------------- */

function describeFixtureExports(mod) {
  if (!mod || (typeof mod !== 'object' && typeof mod !== 'function')) return { type: typeof mod, keys: [] }
  return {
    type: typeof mod,
    keys: Object.keys(mod).slice(0, 40),
    types: Object.fromEntries(Object.keys(mod).slice(0, 40).map((key) => [key, typeof mod[key]])),
  }
}

async function loadFixtureModule(fixturePath) {
  if (!fs.existsSync(fixturePath)) {
    throw new Refusal(`QA fixture not found: ${fixturePath}. It is loaded only at Root runtime; this script does not probe in a loop.`, EXIT.SETUP)
  }
  let mod
  try {
    mod = require(fixturePath)
  } catch (error) {
    throw new Refusal(`Cannot require QA fixture ${fixturePath}: ${error.message}`, EXIT.SETUP)
  }
  if (mod && mod.default && !mod.init && !mod.fresh) mod = mod.default
  if (!mod || (typeof mod.init !== 'function' && typeof mod.fresh !== 'function')) {
    throw new Refusal(`QA fixture does not expose init()/fresh(): ${JSON.stringify(describeFixtureExports(mod))}`, EXIT.SETUP)
  }
  return mod
}

async function initFixture(mod) {
  let app = mod
  let initialSession = null
  let adapter = 'module'
  if (typeof mod.init === 'function') {
    let initResult
    try {
      initResult = await mod.init({ baseURL: BASE_URL })
    } catch (error) {
      throw new Refusal(`QA fixture init() failed: ${error.message}`, EXIT.SETUP)
    }
    if (initResult && typeof initResult === 'object') {
      const looksLikeRunner = typeof initResult.fresh === 'function'
        || typeof initResult.report === 'function'
        || typeof initResult.hashes === 'function'
      const looksLikeSession = Boolean(initResult.page)
      const looksLikeBrowser = typeof initResult.newContext === 'function' && !looksLikeSession && !looksLikeRunner
      if (looksLikeRunner) {
        app = initResult
        adapter = 'init-returned-runner'
      } else if (looksLikeSession) {
        initialSession = initResult
        adapter = 'init-returned-session+module-fresh'
      } else if (looksLikeBrowser) {
        app = mod
        adapter = 'module+browser-init'
      } else {
        throw new Refusal(`QA fixture init() returned an object with no fresh/report/hashes/page/newContext: ${JSON.stringify(describeFixtureExports(initResult))}`, EXIT.SETUP)
      }
    }
  }

  const fresh = typeof app.fresh === 'function' ? app.fresh.bind(app) : (typeof mod.fresh === 'function' ? mod.fresh.bind(mod) : null)
  if (typeof fresh !== 'function') {
    if (initialSession && typeof initialSession.close === 'function') {
      try { await initialSession.close() } catch (error) { void error }
    }
    throw new Refusal(`QA fixture has no callable fresh({locale,theme,width,height,...}); exports=${JSON.stringify(describeFixtureExports(mod))}`, EXIT.SETUP)
  }

  let pendingInitialSession = initialSession
  const createSession = async (opts) => {
    if (pendingInitialSession) {
      const session = pendingInitialSession
      pendingInitialSession = null
      return session
    }
    let raw
    try {
      raw = await fresh(opts)
    } catch (error) {
      throw new Refusal(`QA fixture fresh() failed: ${error.message}`, EXIT.SETUP)
    }
    let session = raw
    if (session && session.session && session.session.page) session = session.session
    if (!session || !session.page) {
      throw new Refusal(`QA fixture fresh() did not return {page,...}; got ${JSON.stringify(describeFixtureExports(raw))}`, EXIT.SETUP)
    }
    return session
  }

  const reportValue = Object.prototype.hasOwnProperty.call(app, 'report') ? app.report : mod.report
  const hashesValue = Object.prototype.hasOwnProperty.call(app, 'hashes') ? app.hashes : mod.hashes
  const reportThis = Object.prototype.hasOwnProperty.call(app, 'report') ? app : mod
  const hashesThis = Object.prototype.hasOwnProperty.call(app, 'hashes') ? app : mod

  return {
    app,
    adapter,
    createSession,
    report: typeof reportValue === 'function' ? reportValue.bind(reportThis) : reportValue,
    hashes: typeof hashesValue === 'function' ? hashesValue.bind(hashesThis) : hashesValue,
    close: typeof app.close === 'function' ? app.close.bind(app) : (typeof mod.close === 'function' ? mod.close.bind(mod) : null),
  }
}

async function callMaybe(fn, label) {
  if (fn == null) {
    return { status: 'not-measured', reason: `${label}() not exported`, value: null }
  }
  if (typeof fn !== 'function') {
    return { status: 'ok', reason: `${label} exported as a value, not a function`, value: sanitizeValue(fn) }
  }
  try {
    const value = await fn()
    return { status: 'ok', reason: null, value: sanitizeValue(value) }
  } catch (error) {
    return { status: 'not-measured', reason: `${label}() failed: ${safeString(error.message, 700)}`, value: null }
  }
}

function aggregateApi(scenarios, reportState) {
  const observed501 = []
  const failures = []
  for (const scenario of scenarios) {
    for (const item of scenario.api501) observed501.push({ scenario: scenario.id, ...item })
    for (const item of scenario.apiFailures) failures.push({ scenario: scenario.id, ...item })
  }
  const fixture = extractUnknown(reportState.value)
  let status
  if (observed501.length || fixture.count > 0) status = 'fail'
  else if (reportState.status !== 'ok' || fixture.status !== 'ok') status = 'not-measured'
  else status = 'ok'
  return {
    status,
    observed501,
    apiRequestFailures: failures,
    fixtureReport: {
      status: reportState.status,
      reason: reportState.reason,
      unknownStatus: fixture.status,
      unknownSource: fixture.source,
      unknownCount: fixture.count,
      unknownExcerpt: fixture.excerpt,
    },
    rule: 'Any unknown API path/method is non-zero. No generic 200 fallback is assumed.',
  }
}

function buildGlobalFindings(scenarios, api, hashes, closed) {
  const findings = []
  for (const scenario of scenarios) {
    for (const finding of scenario.findings) {
      findings.push({ scenario: scenario.id, ...finding })
    }
  }
  if (api.status === 'fail') {
    findings.push({ code: 'UNKNOWN_API', severity: 'error', detail: 'Observed 501/unknown API or fixture unknown report', samples: api.observed501.concat(api.fixtureReport.unknownExcerpt.map((text) => ({ text }))) })
  } else if (api.status === 'not-measured') {
    findings.push({ code: 'UNKNOWN_API_NOT_MEASURED', severity: 'incomplete', detail: api.fixtureReport.reason || 'fixture report unavailable and no 501 observed', samples: null })
  }
  if (!hashes.sourceStable) findings.push({ code: 'SOURCE_HASH_DRIFT', severity: 'incomplete', detail: 'home/i18n/store/runtime hash changed before vs after run', samples: hashes })
  if (!hashes.depsStable) findings.push({ code: 'DEPS_HASH_DRIFT', severity: 'incomplete', detail: 'package.json/pnpm-lock hash missing or changed before vs after run', samples: hashes })
  if (!hashes.evidenceStable) findings.push({ code: 'EVIDENCE_HASH_DRIFT', severity: 'incomplete', detail: 'API/session/navigation evidence snapshot missing or changed during run; Root review required, no auto-upgrade', samples: hashes })
  if (!closed) findings.push({ code: 'BROWSER_NOT_CLOSED', severity: 'incomplete', detail: 'At least one fixture session.close() failed or was absent.', samples: null })
  return findings
}

function computeSuite(results) {
  const scenarios = results.scenarios
  if (results.setupFailure) {
    return {
      status: 'NOT_PREPARED',
      exitCode: EXIT.SETUP,
      acceptance: false,
      note: `Fixture/browser setup failed before a trustworthy scenario: ${results.setupFailure.message}. This is not a product FAIL.`,
    }
  }
  if (!scenarios.length) {
    return { status: 'NOT_PREPARED', exitCode: EXIT.SETUP, acceptance: false, note: 'No scenario ran. This is not a product verdict.' }
  }
  const anyIncomplete = scenarios.some((scenario) => scenario.status === 'incomplete')
  const anyFail = scenarios.some((scenario) => scenario.status === 'fail')
  const apiUnknown = results.api.status === 'fail'
  const apiNotMeasured = results.api.status === 'not-measured'
  const incomplete = anyIncomplete || apiNotMeasured || !results.hashes.sourceStable || !results.hashes.depsStable || !results.hashes.evidenceStable || !results.closed
  let status
  let exitCode
  if (incomplete) {
    status = 'INCOMPLETE'
    exitCode = EXIT.INCOMPLETE
  } else if (apiUnknown) {
    status = 'UNKNOWN_API'
    exitCode = EXIT.UNKNOWN_API
  } else if (anyFail) {
    status = 'REDLINE_FAIL'
    exitCode = EXIT.REDLINE
  } else if (results.coverage.partial) {
    status = 'PARTIAL_CHECKS_GREEN'
    exitCode = EXIT.PARTIAL
  } else {
    status = 'CHECKS_GREEN'
    exitCode = EXIT.GREEN
  }
  return {
    status,
    exitCode,
    acceptance: false,
    note: 'Green means this script\'s measured checks are green. It is not a UI PASS, not Root acceptance, and not author sign-off.',
  }
}

function screenshotPaths(scenarios) {
  const out = []
  for (const scenario of scenarios) {
    if (scenario.screenshots.viewport) out.push(scenario.screenshots.viewport.rel)
    if (scenario.screenshots.full) out.push(scenario.screenshots.full.rel)
    if (scenario.screenshots.errorViewport) out.push(scenario.screenshots.errorViewport.rel)
    if (scenario.focus && Array.isArray(scenario.focus.screenshots)) {
      for (const shot of scenario.focus.screenshots) if (shot && shot.rel) out.push(shot.rel)
    }
    for (const state of scenario.stateCaptures) for (const shot of state.screenshots || []) out.push(shot.rel)
    for (const extra of scenario.extraCaptures) for (const shot of extra.screenshots || []) out.push(shot.rel)
  }
  return out
}

function writeResults(runDir, results) {
  const target = path.join(runDir, 'results.json')
  fs.writeFileSync(target, `${JSON.stringify(results, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
  return target
}

function printSummary(results) {
  const { suite, coverage, api, hashes, closed } = results
  console.log('')
  console.log(`[matrix] run: ${results.run.runDir}`)
  console.log(`[matrix] case=${results.run.case} planned=${coverage.plannedCount} executed=${coverage.executedCount} partial=${coverage.partial}`)
  for (const scenario of results.scenarios) {
    const failures = Object.entries(scenario.checks).filter(([, check]) => check.status === 'fail').map(([name]) => name)
    const gaps = Object.entries(scenario.checks).filter(([, check]) => check.status === 'not-measured').map(([name]) => name)
    console.log(`[matrix] ${String(scenario.index).padStart(2, '0')} ${scenario.id} ${scenario.status}${failures.length ? ` fail=${failures.join(',')}` : ''}${gaps.length ? ` gaps=${gaps.join(',')}` : ''}`)
  }
  console.log(`[matrix] sourceStable=${hashes.sourceStable} depsStable=${hashes.depsStable} evidenceStable=${hashes.evidenceStable} closed=${closed} unknownApi=${api.status}`)
  console.log(`[matrix] suite=${suite.status} exit=${suite.exitCode} acceptance=${suite.acceptance}`)
  console.log(`[matrix] ${suite.note}`)
  console.log(`[matrix] results: ${path.join(results.run.runDir, 'results.json')}`)
}

async function main() {
  const startedAt = new Date().toISOString()
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(`[matrix] REFUSED: ${error.message}`)
    console.error(usage())
    process.exit(error.code || EXIT.PRECONDITION)
  }

  if (args.help) {
    console.log(usage())
    process.exit(EXIT.GREEN)
  }

  try {
    assertBrowserConfirmed(process.env)
    const expected = readExpectedHashes(process.env)
    const beforeSources = assertFrozenSources(expected)
    const depsBefore = snapshotDeps()
    const port = await preflightService()
    const runId = safeRunId(process.env.MB007_RUN_ID || process.env.RUN_ID) || defaultRunId()
    const runDir = ensureNewRunDir(runId)
    const plan = buildPlan(args.caseName, args.limit)
    const fixturePath = process.env.MB007_FIXTURE
      ? path.resolve(process.env.MB007_FIXTURE)
      : DEFAULT_FIXTURE

    const results = {
      schema: 'mb007.dsh.matrix/v1',
      generatedAt: startedAt,
      executedAt: new Date().toISOString(),
      preparedBy: 'author (static preparation only)',
      acceptance: false,
      run: {
        case: args.caseName,
        limit: args.limit,
        cdp200Extra: args.cdp200Extra,
        runId,
        runDir,
        runDirRelative: relFromRepo(runDir),
        baseURL: BASE_URL,
        fixturePath,
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        cwd: process.cwd(),
      },
      precondition: {
        mb007ConfirmBrowser: true,
        expected,
        port,
      },
      coverage: {
        case: args.caseName,
        plannedCount: plan.planned.length,
        executedCount: 0,
        partial: plan.partial,
        limit: plan.limit,
        limitCapped: plan.limitCapped,
        plannedIds: plan.planned.map((item) => item.id),
        executedIds: [],
        skippedIds: plan.planned.slice(plan.selected.length).map((item) => item.id),
        textScaleScenarios: plan.selected.filter((item) => item.textScale === 2).map((item) => item.id),
        allVisualStatesPlanned: args.caseName === 'all-visual'
          ? ['390 zh light search-results/no-match/clear', '390 en dark search-results/no-match/clear']
          : [],
        emptyErrorContexts: {
          empty: {
            status: 'NOT_RUN',
            scenarioId: 'visual-empty-390-zh-light',
            fixtureMode: 'emptyNO_PLAN',
            note: 'Runs only in --case all-visual as an independent fixture context; never synthesized by DOM injection.',
          },
          error: {
            status: 'NOT_RUN',
            scenarioId: 'visual-error-390-en-dark',
            fixtureMode: 'home503',
            note: 'Runs only in --case all-visual as an independent fixture context; never synthesized by DOM injection.',
          },
        },
        focus: {
          status: 'NOT_RUN',
          note: 'Keyboard focus is measured inside each scenario by real Tab presses; it is not a search-state substitute.',
        },
        note: '--limit executes a prefix only; partial scope is never labelled a whole-set PASS. empty/error NOT_RUN is never written as PASS.',
      },
      fixture: {
        path: fixturePath,
        existsAtRuntime: null,
        adapter: null,
        exports: null,
        interfaceContract: 'init() and/or fresh({locale,theme,width,height,...}) -> {page,context,state,close()}; report()/hashes()/close()',
        qaAuthorFileModified: false,
        secondFixtureWritten: false,
      },
      scenarios: [],
      stateCaptures: [],
      api: null,
      hashes: {
        expected,
        before: { sources: beforeSources, deps: depsBefore, evidence: snapshotEvidence() },
        after: null,
        sourceStable: null,
        depsStable: null,
        evidenceStable: null,
        sourceStabilityRule: 'raw-byte SHA-256 before vs after for home/i18n/store/runtime; no Git, no line-ending normalization',
        evidenceRule: 'API/session/navigation are evidence-only snapshots fixed at run start; a change makes the run incomplete and requires Root review, not auto-upgrade.',
      },
      fixtureReport: null,
      fixtureHashes: null,
      closed: false,
      closeErrors: [],
      findings: [],
      limitations: [
        'The QA author fixture was still being written at preparation time; its exact export shape is adapted at Root runtime. If the shape differs, results are NOT_PREPARED, not PASS.',
        'No browser was launched and no UI was measured by the author.',
        'H1 is checked as one accessible role=heading aria-level=1; native h1 count is recorded separately. A missing native <h1> is a recorded warning, not silently converted to PASS.',
        'concept.png is zh-only; English copy has no concept baseline. Synthetic course/task titles are content, not UI translation.',
        'The global tab bar is outside .home-page and is not measured; concept copy diff may list it as concept-only.',
        '200% is CSS font-size/line-height textscale, not browser layout zoom. CDP Emulation.setPageScaleFactor is an optional visual-viewport extra record, never a replacement and never called browser 200%.',
        'High-contrast is verified through actual DOM data-theme/class markers, not only the fixture option; high-contrast token values themselves are not audited.',
        'EXPECTED_STORE_SHA is defined against apps/mobile/src/stores/learner-content.ts, and EXPECTED_RUNTIME_SHA against apps/mobile/src/platform/uni-runtime.ts. If Root intends other files, the precondition must be changed before execution.',
        'API/session/navigation hashes are evidence-only snapshots, not auto-upgraded expectations. A change makes the run incomplete for Root review.',
        'Empty/error are not synthesized in the ready-page DOM. They run only as independent fixture contexts in --case all-visual; otherwise they remain NOT_RUN and are never counted as PASS.',
        'A green suite is evidence only; Root independently reviews concept and screenshots. The author does not sign UI.',
      ],
      suite: null,
    }

    let fixtureMod
    try {
      fixtureMod = await loadFixtureModule(fixturePath)
      results.fixture.existsAtRuntime = true
      results.fixture.exports = describeFixtureExports(fixtureMod)
    } catch (error) {
      results.fixture.existsAtRuntime = fs.existsSync(fixturePath)
      results.fixture.exports = null
      results.error = { stage: 'fixture-load', message: safeString(error.message, 1500) }
      results.suite = { status: 'NOT_PREPARED', exitCode: EXIT.SETUP, acceptance: false, note: error.message }
      results.coverage.status = 'NOT_PREPARED'
      results.closed = true
      results.hashes.after = { sources: snapshotSources(), deps: snapshotDeps(), evidence: snapshotEvidence() }
      results.hashes.sourceStable = sameHashes(results.hashes.before.sources, results.hashes.after.sources)
      results.hashes.depsStable = results.hashes.before.deps.sha256 === results.hashes.after.deps.sha256 && depsExist(results.hashes.before.deps) && depsExist(results.hashes.after.deps)
      results.hashes.evidenceStable = results.hashes.before.evidence.sha256 === results.hashes.after.evidence.sha256 && depsExist(results.hashes.before.evidence) && depsExist(results.hashes.after.evidence)
      const written = writeResults(runDir, results)
      console.error(`[matrix] NOT_PREPARED: ${error.message}`)
      console.error(`[matrix] results: ${written}`)
      process.exit(EXIT.SETUP)
    }

    let fixture
    try {
      fixture = await initFixture(fixtureMod)
      results.fixture.adapter = fixture.adapter
    } catch (error) {
      results.error = { stage: 'fixture-init', message: safeString(error.message, 1500) }
      results.suite = { status: 'NOT_PREPARED', exitCode: EXIT.SETUP, acceptance: false, note: error.message }
      results.closed = true
      results.hashes.after = { sources: snapshotSources(), deps: snapshotDeps(), evidence: snapshotEvidence() }
      results.hashes.sourceStable = sameHashes(results.hashes.before.sources, results.hashes.after.sources)
      results.hashes.depsStable = results.hashes.before.deps.sha256 === results.hashes.after.deps.sha256 && depsExist(results.hashes.before.deps) && depsExist(results.hashes.after.deps)
      results.hashes.evidenceStable = results.hashes.before.evidence.sha256 === results.hashes.after.evidence.sha256 && depsExist(results.hashes.before.evidence) && depsExist(results.hashes.after.evidence)
      const written = writeResults(runDir, results)
      console.error(`[matrix] NOT_PREPARED: ${error.message}`)
      console.error(`[matrix] results: ${written}`)
      process.exit(EXIT.SETUP)
    }

    const context = {
      caseName: args.caseName,
      cdp200Extra: args.cdp200Extra,
      fresh: fixture.createSession,
    }

    try {
      for (let index = 0; index < plan.selected.length; index += 1) {
        const scenarioPlan = plan.selected[index]
        console.log(`[matrix] running ${index + 1}/${plan.selected.length}: ${scenarioPlan.id} ${scenarioPlan.width}x${scenarioPlan.height} ${scenarioPlan.locale} ${scenarioPlan.theme}${scenarioPlan.textScale === 2 ? ' text200' : ''}`)
        const rec = await runScenario(fixture, context, scenarioPlan, index, runDir)
        results.scenarios.push(rec)
        results.coverage.executedCount += 1
        results.coverage.executedIds.push(rec.id)
        if (rec.status === 'fail' || rec.status === 'incomplete') {
          console.log(`[matrix]   -> ${rec.status}${rec.error ? ` (${rec.error.message})` : ''}`)
        }
        if (rec.setupFailure) {
          results.setupFailure = rec.setupFailure
          results.error = { stage: 'fixture-fresh', message: rec.setupFailure.message }
          break
        }
      }
    } finally {
      let reportState = await callMaybe(fixture.report, 'report')
      let hashesState = await callMaybe(fixture.hashes, 'hashes')
      if (typeof fixture.close === 'function') {
        try {
          await fixture.close()
        } catch (error) {
          results.closeErrors.push(`fixture close(): ${safeString(error.message, 700)}`)
        }
      } else {
        results.closeErrors.push('fixture has no close() export')
      }
      if (reportState.status !== 'ok') {
        const retry = await callMaybe(fixture.report, 'report')
        if (retry.status === 'ok') reportState = retry
      }
      if (hashesState.status !== 'ok') {
        const retry = await callMaybe(fixture.hashes, 'hashes')
        if (retry.status === 'ok') hashesState = retry
      }
      results.fixtureReport = reportState
      results.fixtureHashes = hashesState
      results.closed = results.closeErrors.length === 0 && results.scenarios.every((scenario) => scenario.closed)
      results.hashes.after = { sources: snapshotSources(), deps: snapshotDeps(), evidence: snapshotEvidence() }
      results.hashes.sourceStable = sameHashes(results.hashes.before.sources, results.hashes.after.sources)
      results.hashes.depsStable = results.hashes.before.deps.sha256 === results.hashes.after.deps.sha256 && depsExist(results.hashes.before.deps) && depsExist(results.hashes.after.deps)
      results.hashes.evidenceStable = results.hashes.before.evidence.sha256 === results.hashes.after.evidence.sha256 && depsExist(results.hashes.before.evidence) && depsExist(results.hashes.after.evidence)
      results.api = aggregateApi(results.scenarios, reportState)
      results.findings = buildGlobalFindings(results.scenarios, results.api, results.hashes, results.closed)
      results.stateCaptures = results.scenarios.flatMap((scenario) => scenario.stateCaptures.map((state) => ({ scenario: scenario.id, ...state })))
      const executed = new Set(results.coverage.executedIds)
      for (const kind of ['empty', 'error']) {
        const entry = results.coverage.emptyErrorContexts[kind]
        const rec = results.scenarios.find((scenario) => scenario.kind === kind)
        entry.status = rec ? rec.status : 'NOT_RUN'
        entry.executed = Boolean(rec)
        entry.id = rec ? rec.id : null
      }
      results.coverage.focus.status = results.scenarios.some((scenario) => scenario.focus && scenario.focus.status === 'measured')
        ? 'MEASURED_IN_SCENARIOS'
        : 'NOT_MEASURED'
      if (args.caseName === 'all-visual') {
        const baseIds = ['full-390-light-zh', 'full-390-dark-en']
        if (!baseIds.every((baseId) => executed.has(baseId))) {
          results.coverage.allVisualStatesPlanned.push('some all-visual base scenarios excluded by --limit; states not captured')
        }
      }
      results.suite = computeSuite(results)
      results.acceptance = false
      results.finishedAt = new Date().toISOString()
      results.screenshotCount = screenshotPaths(results.scenarios).length
      results.screenshots = screenshotPaths(results.scenarios)
      let written
      try {
        written = writeResults(runDir, results)
      } catch (error) {
        console.error(`[matrix] failed to write results.json: ${error.message}`)
      }
      printSummary(results)
      if (written) console.log(`[matrix] wrote ${written}`)
      process.exit(results.suite.exitCode)
    }
  } catch (error) {
    if (error instanceof Refusal) {
      console.error(`[matrix] REFUSED (${error.code}): ${error.message}`)
      console.error(usage())
      process.exit(error.code)
    }
    console.error(`[matrix] SCRIPT/SETUP ERROR (not a product FAIL): ${error && error.stack ? error.stack : error}`)
    process.exit(EXIT.SETUP)
  }
}

function sameHashes(before, after) {
  if (!before || !after) return false
  for (const key of ['home', 'i18n', 'store', 'runtime']) {
    if (!before[key] || !after[key]) return false
    if (!before[key].exists || !after[key].exists) return false
    if (before[key].sha256 !== after[key].sha256) return false
  }
  return true
}

function depsExist(snapshot) {
  if (!snapshot || !snapshot.files) return false
  return Object.values(snapshot.files).every((file) => file && file.exists)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[matrix] SCRIPT/SETUP ERROR (not a product FAIL): ${error && error.stack ? error.stack : error}`)
    process.exit(EXIT.SETUP)
  })
}

module.exports = {
  BASE_URL,
  EXPECTED_H1,
  CONCEPT_ZH_COPY,
  buildPlan,
  parseArgs,
  parseCssColor,
  contrastRatio,
  buildCopyDiff,
  evaluateTheme,
  evaluateChecks,
  extractUnknown,
  sanitizeValue,
}

