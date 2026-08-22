import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..', '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

test('B14 synthetic Phase 1 chain is replayable and keeps the official site read-only', () => {
  const fixture = JSON.parse(read('tests/b14/fixtures/phase1-chain.json'))
  assert.equal(fixture.replay.delivery, 'at_least_once')
  assert.equal(fixture.replay.rawPayloadStored, false)
  assert.deepEqual(fixture.steps.slice(0, 8).map((step) => step.domain), [
    'learner', 'content', 'learning', 'assessment', 'media', 'gamification', 'social', 'commerce',
  ])
  assert.equal(fixture.steps.at(-1).domain, 'official-site')
  assert.equal(fixture.steps.at(-1).mode, 'PUBLIC_READ_ONLY')

  const official = [
    'apps/official-site/app.vue',
    ...fs.readdirSync(path.join(root, 'apps/official-site'), { recursive: true })
      .filter((file) => typeof file === 'string' && /\.(ts|vue)$/.test(file))
      .map((file) => path.join('apps/official-site', file)),
  ].filter((file, index, all) => all.indexOf(file) === index && fs.existsSync(path.join(root, file)))
    .map(read).join('\n')
  assert.doesNotMatch(official, /payment-intents|\/commerce\/orders|createOrder|submitPayment/i)
  assert.match(official, /public|catalog|projection|readonly|read.?only/i)
})

test('B14 evidence index and task baseline are present for the test-stage handoff', () => {
  const validation = read('docs/07-operations/b14-validation.md')
  const backlog = read('requirements/backlog/v2-B7plus-代码重塑与交互测试任务基线.md')
  for (const task of ['V2-B14-MIG-001', 'V2-B14-GW-002', 'V2-B14-SEC-003', 'V2-B14-CROSS-004', 'V2-B14-FE-005', 'V2-B14-TEST-006']) {
    assert.match(validation, new RegExp(task))
    assert.match(backlog, new RegExp(task))
  }
  assert.match(validation, /Phase 1|代码层|不.*生产|Java 25|Maven/i)
})
