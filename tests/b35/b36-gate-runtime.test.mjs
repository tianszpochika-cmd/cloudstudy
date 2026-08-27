import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const source = readFileSync(path.resolve(import.meta.dirname, '../../scripts/runtime/b36-gate-runtime.mjs'), 'utf8')

test('B36 gate runner requires two readiness rounds and four fixed frontend ports', () => {
  assert.match(source, /round\(1\)/)
  assert.match(source, /round\(2\)/)
  assert.match(source, /18180/)
  assert.match(source, /18181/)
  assert.match(source, /18182/)
  assert.match(source, /18183/)
  assert.match(source, /WAITING_USER_CONFIRMATION/)
})
