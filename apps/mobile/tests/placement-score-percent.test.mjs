import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const file = path.resolve(import.meta.dirname, '../src/domain/placement-score.ts')
const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { placementScorePercent } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)

test('P1 0..100 scores render as-is; legacy ratios scale to percent', () => {
  assert.equal(placementScorePercent(71), 71)
  assert.equal(placementScorePercent(0.5), 50)
  assert.equal(placementScorePercent(1), 100)
  assert.equal(placementScorePercent(100), 100)
  assert.equal(placementScorePercent(null), null)
  assert.equal(placementScorePercent(-3), null)
})
