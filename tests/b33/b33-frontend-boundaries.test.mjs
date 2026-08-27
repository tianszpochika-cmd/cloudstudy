import assert from 'node:assert/strict'
import test from 'node:test'
import { repositoryRoot, validateB33Static } from '../../scripts/runtime/b33-static-check.mjs'

test('B33 four frontend projects use fixed ports and Gateway-only runtime boundaries', () => {
  const result = validateB33Static(repositoryRoot)
  assert.equal(result.result, 'PASS', result.errors.join('\n'))
  assert.deepEqual(result.summary.fixedPorts, ['18180', '18181', '18182', '18183'])
  assert.equal(result.summary.frontendProjects, 4)
  assert.equal(result.summary.independentWechatProject, false)
})
