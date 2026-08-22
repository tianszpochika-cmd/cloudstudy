import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const require = createRequire(import.meta.url)
const typescript = require('typescript')
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

async function loadTypeScriptModule(relativePath) {
  const filename = resolve(repositoryRoot, relativePath)
  const source = await readFile(filename, 'utf8')
  const transpiled = typescript.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      target: typescript.ScriptTarget.ES2022,
      module: typescript.ModuleKind.ESNext,
      moduleResolution: typescript.ModuleResolutionKind.Bundler,
      isolatedModules: true,
    },
  })
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(transpiled.outputText)}`)
}

const i18n = await loadTypeScriptModule('packages/i18n/src/index.ts')
const tokens = await loadTypeScriptModule('packages/design-tokens/src/index.ts')

test('i18n keeps UI locale and contentLocale independent with controlled fallback', () => {
  const instance = i18n.createI18n({
    locale: 'en-US',
    contentLocale: 'en-GB',
    messages: {
      'zh-CN': {
        dashboard: { title: '学习中心' },
        welcome: '你好，{{name}}',
      },
      en: {
        dashboard: { title: 'Learning hub' },
        welcome: 'Welcome, {{name}}',
      },
    },
    fallbackLocale: ['zh-CN'],
  })

  assert.equal(instance.locale, 'en-US')
  assert.equal(instance.contentLocale, 'en-GB')
  assert.equal(instance.t('welcome', { name: 'Mina' }), 'Welcome, Mina')

  instance.setContentLocale('ja-JP')
  assert.equal(instance.locale, 'en-US')
  assert.equal(instance.contentLocale, 'ja-JP')

  instance.setLocale('fr-FR')
  assert.equal(instance.t('dashboard.title'), '学习中心')
  assert.deepEqual(instance.getLocaleChain(), ['fr-FR', 'fr', 'zh-CN'])

  const noFallback = i18n.createI18n({
    locale: 'fr-FR',
    messages: { 'zh-CN': { greeting: '你好' } },
    fallbackLocale: false,
  })
  assert.equal(noFallback.t('greeting'), 'greeting')
})

test('i18n supports interpolation, Intl formatting, plural variants and missing-key diagnostics', () => {
  const missing = []
  const instance = i18n.createI18n({
    locale: 'en-US',
    messages: {
      'en-US': {
        items: { one: '# item', other: '# items' },
        dateLabel: 'Updated on {date}',
      },
    },
    onMissingKey: (context) => missing.push(context),
  })

  assert.equal(instance.tp('items', 1), '1 item')
  assert.equal(instance.tp('items', 3), '3 items')
  assert.equal(instance.t('dateLabel', { date: '2026-08-22' }), 'Updated on 2026-08-22')
  assert.equal(instance.formatNumber(1234567.5, { maximumFractionDigits: 1 }, 'en-US'), '1,234,567.5')
  assert.equal(instance.formatPlural(1, {}, 'en-US'), 'one')
  assert.equal(
    instance.formatDate('2026-08-22T00:00:00.000Z', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }, 'en-US'),
    '08/22/2026',
  )

  assert.equal(instance.t('missing.label'), 'missing.label')
  assert.deepEqual(instance.getMissingKeys(), ['missing.label'])
  assert.equal(missing.length, 1)
  assert.deepEqual(missing[0].fallbackChain, ['en-US', 'en', 'zh-CN'])
  instance.clearMissingKeys()
  assert.deepEqual(instance.getMissingKeys(), [])
})

test('i18n provides pseudo-localization without mutating interpolation placeholders and scans missing keys', () => {
  assert.equal(i18n.pseudoLocalize('Hello {{name}}'), '[!! Hëëllõõ {{name}} !!]')
  assert.equal(i18n.pseudoLocalize('<strong>Hello</strong>'), '[!! <strong>Hëëllõõ</strong> !!]')

  const pseudoMessages = i18n.pseudoLocalizeMessages({
    welcome: 'Welcome',
    nested: { label: 'Start' },
  })
  assert.match(pseudoMessages.welcome, /^\[!! .+ !!\]$/)
  assert.match(pseudoMessages.nested.label, /^\[!! .+ !!\]$/)

  const pseudo = i18n.createI18n({
    locale: 'en-XA',
    messages: { 'zh-CN': { welcome: 'Welcome, {{name}}' } },
  })
  assert.equal(pseudo.t('welcome', { name: 'Mina' }), '[!! Wëëlçõõmëë, Mina !!]')

  const report = i18n.findMissingKeys({
    'zh-CN': { common: { save: '保存', cancel: '取消' } },
    en_US: { common: { save: 'Save' } },
  })
  assert.deepEqual(report, [{ locale: 'en-US', sourceLocale: 'zh-CN', keys: ['common.cancel'] }])
  assert.equal(i18n.hasMissingKeys({ 'zh-CN': { save: '保存' }, 'en-US': {} }), true)
})

test('design tokens preserve legacy API and expose atomic, semantic and four-mode theme APIs', () => {
  assert.equal(tokens.designTokens.color.brandPrimary, '#596BFF')
  assert.equal(tokens.designTokens.radius.card, '16px')
  assert.deepEqual(tokens.THEME_MODES, ['light', 'dark', 'system', 'high-contrast'])
  assert.equal(tokens.atomicTokens.spacing[4], '16px')

  const light = tokens.getThemeVariableMap('light')
  const dark = tokens.getThemeVariableMap('dark')
  const highContrast = tokens.getThemeVariableMap('high-contrast')
  assert.equal(light['--ef-color-background-canvas'], '#F7F8FC')
  assert.equal(dark['--ef-color-background-canvas'], '#11131C')
  assert.equal(highContrast['--ef-color-border-focus'], '#FFFF00')
  assert.notEqual(light['--ef-color-text-primary'], dark['--ef-color-text-primary'])
  assert.match(tokens.getThemeCss('dark', { selector: '[data-theme="dark"]' }), /^\[data-theme="dark"\] \{/)
  assert.equal(tokens.resolveTheme('system', true), 'dark')
  assert.equal(tokens.resolveTheme('system', false), 'light')

  const atomicVariables = tokens.toCssVariableMap(tokens.atomicTokens, { prefix: 'yx-atomic' })
  assert.equal(atomicVariables['--yx-atomic-color-brand-primary'], '#596BFF')
  const combined = tokens.getThemeVariableMap('light', { includeAtomic: true })
  assert.equal(combined['--ef-atomic-color-brand-primary'], '#596BFF')
})

test('theme controller persists mode, resolves system preference and remains DOM-free', () => {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  const controller = tokens.createThemeController({
    initialTheme: 'system',
    storage,
    systemPreference: () => true,
    prefix: 'study',
  })

  assert.equal(controller.theme, 'system')
  assert.equal(controller.resolvedTheme, 'dark')
  assert.match(controller.getCss(), /--study-color-background-canvas: #11131C;/)

  const seen = []
  const unsubscribe = controller.subscribe((state) => seen.push(`${state.theme}:${state.resolvedTheme}`))
  controller.setTheme('high-contrast')
  assert.equal(values.get('ef.theme'), 'high-contrast')
  assert.equal(controller.resolvedTheme, 'high-contrast')
  unsubscribe()

  const restored = tokens.createThemeController({
    initialTheme: 'light',
    storage,
    systemPreference: () => false,
  })
  restored.restore()
  assert.equal(restored.theme, 'high-contrast')
  assert.equal(seen[0], 'system:dark')
  assert.equal(seen.at(-1), 'high-contrast:high-contrast')
  controller.dispose()
  restored.dispose()
})
