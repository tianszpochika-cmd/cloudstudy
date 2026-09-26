import test from 'node:test'
import assert from 'node:assert/strict'
import {
  collectMessageKeys,
  createI18n,
  findMissingKeys,
  pseudoLocalize,
} from '../src/index.ts'
import { createElementPlusI18nAdapter, createNuxtI18nAdapter, createUniAppI18nAdapter, createVueWebI18nAdapter } from '../src/adapters.ts'
import { adminStarterMessages, learnerStarterMessages } from '../src/starter-locales.ts'

const ADMIN_SOURCE_KEYS = collectMessageKeys(adminStarterMessages['zh-CN'])
const LEARNER_SOURCE_KEYS = collectMessageKeys(learnerStarterMessages['zh-CN'])

test('skeleton source locales are complete', () => {
  assert.ok(ADMIN_SOURCE_KEYS.length > 0)
  assert.ok(LEARNER_SOURCE_KEYS.length > 0)
  assert.ok(ADMIN_SOURCE_KEYS.every((key) => key.startsWith('admin.')))
  assert.ok(LEARNER_SOURCE_KEYS.every((key) => key.startsWith('learner.')))
})

test('missing fr/de keys fall back without throwing', () => {
  const i18n = createI18n({ locale: 'fr', messages: { ...adminStarterMessages, ...learnerStarterMessages } })
  for (const key of [...ADMIN_SOURCE_KEYS, ...LEARNER_SOURCE_KEYS]) {
    const value = i18n.t(key)
    assert.equal(typeof value, 'string')
    assert.notEqual(value, '', `key must resolve: ${key}`)
  }
  const german = createI18n({ locale: 'de', messages: { ...adminStarterMessages, ...learnerStarterMessages } })
  for (const key of [...ADMIN_SOURCE_KEYS, ...LEARNER_SOURCE_KEYS]) {
    assert.notEqual(german.t(key), '', `key must resolve: ${key}`)
  }
})

test('fr/de resolve their own translations where provided', () => {
  const i18n = createI18n({ locale: 'fr', messages: adminStarterMessages })
  assert.equal(i18n.t('admin.common.loading'), 'Chargement')
  assert.equal(i18n.t('admin.language.label'), "Langue de l'interface")
  const german = createI18n({ locale: 'de', messages: adminStarterMessages })
  assert.equal(german.t('admin.common.save'), 'Speichern')
})

test('unknown keys return the key and never throw', () => {
  const i18n = createI18n({ locale: 'de', messages: adminStarterMessages })
  assert.equal(i18n.t('admin.nope.missing'), 'admin.nope.missing')
})

test('pseudo-localization expands every skeleton string', () => {
  for (const key of [...ADMIN_SOURCE_KEYS, ...LEARNER_SOURCE_KEYS]) {
    const expanded = pseudoLocalize(key)
    assert.equal(typeof expanded, 'string')
    assert.ok(expanded.length >= key.length)
  }
  const i18n = createI18n({ locale: 'en-XA', messages: adminStarterMessages })
  assert.notEqual(i18n.t('admin.common.loading'), 'Loading')
})

test('missing-key scan documents the skeleton status', () => {
  const reports = findMissingKeys({ ...adminStarterMessages, ...learnerStarterMessages })
  const locales = reports.map((report) => report.locale)
  assert.ok(locales.includes('fr'))
  assert.ok(locales.includes('de'))
  const english = reports.find((report) => report.locale === 'en-US')
  assert.equal(english, undefined)
})

test('UI locale switches without touching contentLocale', () => {
  const i18n = createI18n({ locale: 'zh-CN', contentLocale: 'en-US', messages: adminStarterMessages })
  i18n.setLocale('fr')
  assert.equal(i18n.locale, 'fr')
  assert.equal(i18n.contentLocale, 'en-US')
  assert.equal(i18n.t('admin.common.loading'), 'Chargement')
})

for (const createAdapter of [createVueWebI18nAdapter, createNuxtI18nAdapter, createUniAppI18nAdapter, createElementPlusI18nAdapter]) {
  test(`${createAdapter.name} restores UI and content locales without overwriting saved values on construction`, () => {
    const values = new Map([['ef.ui-locale', 'en-US'], ['ef.content-locale', 'zh-CN']])
    const storage = {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    }
    const i18n = createI18n({ locale: 'zh-CN', contentLocale: 'en-US' })
    const adapter = createAdapter(i18n, { localeStorage: storage })
    assert.equal(values.get('ef.ui-locale'), 'en-US')
    assert.equal(values.get('ef.content-locale'), 'zh-CN')
    assert.deepEqual(adapter.restore(), { locale: 'en-US', contentLocale: 'zh-CN' })
    adapter.setLocale('zh-CN')
    assert.equal(values.get('ef.ui-locale'), 'zh-CN')
    assert.equal(values.get('ef.content-locale'), 'zh-CN')
    adapter.setContentLocale('en-US')
    assert.equal(values.get('ef.ui-locale'), 'zh-CN')
    assert.equal(values.get('ef.content-locale'), 'en-US')
    adapter.dispose()
  })
}
