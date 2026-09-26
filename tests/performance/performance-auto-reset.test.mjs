import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const sourcePath = path.resolve(import.meta.dirname, '../../packages/performance/src/index.ts')
const source = fs.readFileSync(sourcePath, 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const module = { exports: {} }
new Function('module', 'exports', compiled)(module, module.exports)
const { createAdaptivePerformanceEngine } = module.exports

test('restoring automatic quality removes the saved manual override across restarts', () => {
  const values = new Map()
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  }
  const options = { storage, deviceMemoryGb: 8, hardwareConcurrency: 8, reducedMotion: false }
  const engine = createAdaptivePerformanceEngine(options)
  engine.setLevel('Ultra')
  assert.equal(values.get('yx.performance.level'), 'Ultra')

  const reset = engine.resetLevelToAutomatic()
  assert.equal(reset.level, 'High')
  assert.equal(reset.source, 'auto')
  assert.equal(values.has('yx.performance.level'), false)

  const restarted = createAdaptivePerformanceEngine(options)
  assert.equal(restarted.restore().level, 'High')
  assert.equal(restarted.state.source, 'auto')
})

test('automatic reset refuses storage that cannot remove a saved override', () => {
  const storage = { getItem: () => 'Ultra', setItem: () => {} }
  const engine = createAdaptivePerformanceEngine({ storage, deviceMemoryGb: 8, hardwareConcurrency: 8 })
  engine.restore()
  assert.throws(() => engine.resetLevelToAutomatic(), /cannot clear a saved level/)
  assert.equal(engine.state.level, 'Ultra')
})
