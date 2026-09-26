import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import vm from 'node:vm'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const { parse } = require('vue/compiler-sfc')
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8')

test('inline void click handlers invoke their action rather than discard the function', async () => {
  for (const file of await readdir(new URL('../src/pages/', import.meta.url))) {
    if (!file.endsWith('.vue')) continue
    const template = parse(await read('src/pages/' + file)).descriptor.template?.content ?? ''
    assert.doesNotMatch(template, /@click="void [\w.]+"/, file)
  }
  const handlers = [['B11ReadingPage.vue', 'store.loadReading'], ['B11ListeningPage.vue', 'cacheMedia'], ['B11SpeakingPage.vue', 'startRecording']]
  for (const [file, action] of handlers) {
    const source = await read('src/pages/' + file)
    const expr = [...source.matchAll(/@click="([^"]+)"/g)].map(m => m[1]).find(s => s === `void ${action}()`)
    assert.ok(expr, action)
    let calls = 0
    const stub = () => { calls++ }
    const [owner, method] = action.split('.')
    new Function(owner, expr)(method ? { [method]: stub } : stub)
    assert.equal(calls, 1)
  }
})

test('design review isolates storage and rejects writes and unknown network calls', async () => {
  const originalStorage = new Map([['real-session-hint', 'keep']])
  const context = { exports: {}, window: { localStorage: originalStorage, sessionStorage: originalStorage }, location: { search: '', href: 'http://127.0.0.1:18180/design-review.html' }, URL, URLSearchParams, Response, Request }
  const source = ts.transpileModule(await read('dev/review-fixtures.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(source, context)
  context.exports.installReviewTransport()
  const fetch = context.window.fetch
  assert.equal((await fetch('http://127.0.0.1:18070/api/v1/learner/home')).status, 200)
  assert.equal((await fetch('http://127.0.0.1:18070/api/v1/learner/profile', { method: 'PATCH', body: '{}' })).status, 503)
  assert.equal((await fetch('https://example.com/private')).status, 503)
  context.window.localStorage.setItem('preview-record', 'local')
  assert.equal(originalStorage.get('real-session-hint'), 'keep')
  assert.equal(originalStorage.size, 1)
  assert.equal(context.window.localStorage.getItem('real-session-hint'), null)
})

test('production bootstrap does not import the design-review entry or fixtures', async () => {
  const entry = await read('index.html')
  const main = await read('src/main.ts')
  const router = await read('src/router/index.ts')
  assert.doesNotMatch(entry + main + router, /review-fixtures|design-review|installReviewTransport/)
  assert.match(router, /await session\.restore\(\)/)
  assert.match(router, /to\.meta\.requiresAuth && !session\.isAuthenticated/)
  assert.match(router, /!session\.isLearningReady/)
})
