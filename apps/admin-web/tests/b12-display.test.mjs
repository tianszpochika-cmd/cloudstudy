import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')
const contract = JSON.parse(fs.readFileSync(path.resolve(appRoot, '../../packages/contracts/fragments/b12/b12-gamification-social-notification.openapi.json'), 'utf8'))

function loadModule(relativePath, dependencies) {
  const source = fs.readFileSync(path.resolve(appRoot, relativePath), 'utf8')
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', output)((id) => {
    assert.ok(id in dependencies, `unexpected dependency: ${id}`)
    return dependencies[id]
  }, module, module.exports)
  return module.exports
}

function displayHarness() {
  const messages = {}
  const subscribers = []
  const adminI18n = {
    locale: 'zh-CN',
    registerMessages: (locale, value) => { messages[locale] = value.b12 },
    subscribe: (callback) => { subscribers.push(callback) },
    t(key) { return messages[this.locale]?.[key.replace(/^b12\./, '')] ?? key },
  }
  const display = loadModule('src/platform/b12-i18n.ts', {
    vue: { ref: (value) => ({ value }) },
    './v2-foundation': { adminI18n },
  })
  return {
    display,
    setLocale: (locale) => {
      adminI18n.locale = locale
      subscribers.forEach((subscriber) => subscriber({ locale }))
    },
  }
}

test('every contracted report status and reason has a readable Chinese and English label', () => {
  const { display, setLocale } = displayHarness()
  const statuses = [
    ...contract.components.schemas.B12Report.properties.status.enum,
    ...contract.components.schemas.M1014Report.properties.state.enum,
  ]
  const reasons = [
    ...contract.components.schemas.B12ReportCommand.properties.reasonCode.enum,
    ...contract.components.schemas.M1014ReportCommand.properties.reasonCode.enum,
  ]
  for (const locale of ['zh-CN', 'en-US']) {
    setLocale(locale)
    for (const code of statuses) {
      const label = display.b12StatusLabel(code)
      assert.ok(label && label !== code && !label.startsWith('b12.'), `${locale}: status ${code}`)
    }
    for (const code of reasons) {
      const label = display.b12ReasonLabel(code)
      assert.ok(label && label !== code && !label.startsWith('b12.'), `${locale}: reason ${code}`)
    }
    assert.ok(display.b12ModeLabel('MANUAL') !== 'MANUAL')
    assert.ok(display.b12T('reportId') !== 'b12.reportId')
  }
  setLocale('zh-CN')
  assert.equal(display.b12StatusLabel('RECEIVED'), '待受理')
  assert.equal(display.b12ReasonLabel('HARASSMENT'), '骚扰')
  assert.equal(display.b12ModeLabel('MANUAL'), '人工审核')
  setLocale('en-US')
  assert.equal(display.b12StatusLabel('RECEIVED'), 'Awaiting review')
  assert.equal(display.b12ReasonLabel('HARASSMENT'), 'Harassment')
  assert.equal(display.b12ModeLabel('MANUAL'), 'Human review')
})

test('unknown, missing and hostile codes never appear raw in the table', () => {
  const { display, setLocale } = displayHarness()
  for (const locale of ['zh-CN', 'en-US']) {
    setLocale(locale)
    const outputs = [
      display.b12StatusLabel('UNKNOWN'),
      display.b12StatusLabel('<script>alert(1)</script>'),
      display.b12ReasonLabel('UNRECOGNIZED_REASON'),
      display.b12ReasonLabel(null),
      display.b12ModeLabel('AUTOMATED_BY_UNKNOWN'),
      display.b12ModeLabel(undefined),
    ]
    for (const label of outputs) {
      assert.ok(label && !label.includes('<script>') && !label.includes('UNKNOWN') && !label.startsWith('b12.'))
    }
  }
  const domain = loadModule('src/domain/b12.ts', {
    '../platform/admin-i18n': { adminT: () => '脱敏对象' },
  })
  const report = domain.parseModerationReport({ reportId: 'report-1' })
  assert.equal(report.reviewMode, 'UNKNOWN')
  assert.equal(report.status, 'UNKNOWN')
  assert.equal(report.reasonCode, 'UNKNOWN')
  assert.equal(domain.parseModerationReport({ reportId: 'report-1', updatedAt: '2026-09-23T10:00:00Z' }).createdAt, null)
  assert.equal(domain.parseModerationReport({ reportId: 'report-1', createdAt: '2026-09-22T10:00:00Z' }).createdAt, '2026-09-22T10:00:00Z')
})
