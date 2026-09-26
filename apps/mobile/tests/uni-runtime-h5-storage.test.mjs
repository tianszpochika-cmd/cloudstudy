import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), '../src/platform/uni-runtime.ts')
const source = await readFile(sourcePath, 'utf8')
const compiled = ts.transpileModule(source, {
  fileName: sourcePath,
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const runtime = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

function withGlobals(values, run) {
  const names = ['window', 'document', 'uni', 'plus']
  const original = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
  for (const name of names) {
    if (name in values) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: values[name] })
    else Reflect.deleteProperty(globalThis, name)
  }
  try { run() } finally {
    for (const name of names) {
      const descriptor = original.get(name)
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else Reflect.deleteProperty(globalThis, name)
    }
  }
}

test('production H5 can navigate and keep non-secret UI state with a partial uni runtime', () => {
  const values = new Map()
  const localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
  const uni = {
    context: 'uni',
    getSystemInfoSync: () => ({ platform: 'ios' }),
    switchTab({ url }) { assert.equal(this.context, 'uni'); assert.equal(url, '/pages/home/home') },
  }
  const location = { protocol: 'https:', hash: '#/' }
  withGlobals({ window: { location, localStorage }, document: {}, uni }, () => {
    assert.equal(runtime.isNativeAppRuntime(), false, 'iPhone H5 is a browser session')
    assert.equal(runtime.getUniRuntime(), runtime.getUniRuntime(), 'adapter identity is stable')
    assert.equal(runtime.getUniRuntime().getSecureStorage, undefined, 'ordinary browser storage is not a token vault')
    runtime.openUniPage('/pages/home/home?from=welcome')
    assert.deepEqual(runtime.consumePendingNavigationQuery('/pages/home/home'), { from: 'welcome' })
    assert.deepEqual(runtime.consumePendingNavigationQuery('/pages/home/home'), {})
    runtime.openUniPage('/pages/login/login?returnTo=%2Fpages%2Fhome%2Fhome')
    assert.equal(location.hash, '#/pages/login/login?returnTo=%2Fpages%2Fhome%2Fhome')
  })
})

test('production H5 uses its hash router when tab navigation is also absent', () => {
  const location = { protocol: 'https:', hash: '#/' }
  withGlobals({ window: { location, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } }, document: {}, uni: {} }, () => {
    runtime.openUniPage('/pages/home/home')
    assert.equal(location.hash, '#/pages/home/home')
    assert.throws(() => runtime.getUniRuntime().navigateTo({ url: '//outside.example/' }), /页面地址无效/)
  })
})

test('native runtime with missing storage stays native and never receives browser storage fallback', () => {
  const uni = { getSystemInfoSync: () => ({ platform: 'ios' }) }
  withGlobals({ window: { location: { protocol: 'https:' }, localStorage: {} }, document: {}, uni, plus: {} }, () => {
    assert.equal(runtime.isNativeAppRuntime(), true)
    assert.equal(runtime.getUniRuntime(), uni)
    assert.equal(runtime.getUniRuntime().setStorageSync, undefined)
  })
})

test('browser storage denial does not crash UI startup', () => {
  const browserWindow = { location: { protocol: 'https:' } }
  Object.defineProperty(browserWindow, 'localStorage', { get() { throw new Error('denied') } })
  withGlobals({ window: browserWindow, document: {}, uni: {} }, () => {
    const adapter = runtime.getUniRuntime()
    assert.equal(adapter.getStorageSync('ui.preference'), '')
    assert.doesNotThrow(() => adapter.setStorageSync('ui.preference', 'dark'))
    assert.doesNotThrow(() => adapter.removeStorageSync('ui.preference'))
  })
})
