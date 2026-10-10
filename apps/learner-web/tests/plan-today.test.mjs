import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

function load(path) {
  const source = readFileSync(resolve(path), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(() => {
    throw new Error('plan-today must stay dependency free')
  }, module, module.exports)
  return module.exports
}

const web = load('apps/learner-web/src/domain/plan-today.ts')
const mobile = load('apps/mobile/src/domain/plan-today.ts')

for (const [name, api] of [['web', web], ['mobile', mobile]]) {
  test(`${name} ensures only a formal report and keeps a stable key`, () => {
    assert.equal(api.shouldEnsurePlan(null), false)
    assert.equal(api.shouldEnsurePlan({ reportId: 'rpt_1', resultKind: 'SKIPPED' }), false)
    assert.equal(api.shouldEnsurePlan({ reportId: 'rpt_1' }), true)
    assert.equal(api.shouldEnsurePlan({ reportId: 'rpt_1', resultKind: 'ASSESSED' }), true)
    assert.equal(api.ensureIdempotencyKey('rpt_1'), 'plan-ensure-rpt_1')
    assert.equal(api.replanIdempotencyKey(3, 'event-1234'), 'plan-replan-3-event-1234')
  })

  test(`${name} maps the five empty states and keeps the server explanation`, () => {
    const parsed = api.parsePlanTodayQueue({
      data: {
        planId: 'plan-9',
        status: 'ACTIVE',
        planVersion: 4,
        targetMinutes: 15,
        emptyReason: 'NO_PLAN',
        explanation: '根据目标「零基础」和每日 15 分钟，安排今天的练习。',
        explanationPinVersion: 2,
        firstLearning: { guideVisible: true, reason: 'INCOMPLETE' },
        items: [],
      },
    })
    assert.equal(parsed.explanation, '根据目标「零基础」和每日 15 分钟，安排今天的练习。')
    assert.equal(parsed.planVersion, 4)
    assert.equal(api.emptyStateView({ failed: false, reason: 'NO_PLAN', hasTasks: false }).action, '开始设置')
    assert.equal(api.emptyStateView({ failed: false, reason: 'COMPLETED', hasTasks: false }).action, '结束学习')
    assert.equal(api.emptyStateView({ failed: false, reason: 'NO_CONTENT', hasTasks: false }).action, '看可用内容')
    assert.equal(api.emptyStateView({ failed: false, reason: 'NO_DUE_REVIEW', hasTasks: false }).action, '新学或结束')
    assert.equal(api.emptyStateView({ failed: true, reason: 'READY', hasTasks: false }).action, '重试')
    assert.equal(api.emptyStateView({ failed: false, reason: 'READY', hasTasks: true }), null)
    assert.equal(api.firstLearningGuideCopy('COMPLETED'), null)
    assert.equal(api.firstLearningGuideCopy('INCOMPLETE'), '继续完成第一次学习')
  })

  test(`${name} shelf search and cross-end readback stay distinct`, () => {
    const items = [
      { status: 'PUBLISHED', title: 'Cafe' },
      { availability: 'WITHDRAWN', title: 'Hidden' },
      { status: 'UNAVAILABLE', title: 'Closed' },
    ]
    const accessible = items.filter(api.isAccessibleContent)
    assert.deepEqual(accessible.map((item) => item.title), ['Cafe'])
    assert.equal(api.shelfSearchState(0, 0, true), 'error')
    assert.equal(api.shelfSearchState(0, 0, false), 'catalog-empty')
    assert.equal(api.shelfSearchState(2, 0, false), 'no-matches')
    assert.equal(api.shelfSearchState(2, 1, false), 'results')
    assert.equal(api.samePlanReadback({ planId: 'plan-9', planVersion: 4 }, { planId: 'plan-9', planVersion: 4 }), true)
    assert.equal(api.samePlanReadback({ planId: 'plan-9', planVersion: 4 }, { planId: 'plan-9', planVersion: 5 }), false)
    assert.deepEqual(api.continueCheckpoint({ status: 'ACTIVE', lessonId: 'lesson-1', stepIndex: 2 }), { contentId: 'lesson-1', step: '2' })
    assert.equal(api.continueCheckpoint({ status: 'EXPIRED', lessonId: 'lesson-1', stepIndex: 2 }), null)
  })
}

test('both stores ensure from a formal report and replan with the read version', () => {
  const web = readFileSync(resolve('apps/learner-web/src/stores/learner-content.ts'), 'utf8')
  const mobile = readFileSync(resolve('apps/mobile/src/stores/learner-content.ts'), 'utf8')
  const webApi = readFileSync(resolve('apps/learner-web/src/api/plan-today.ts'), 'utf8')
  const mobileApi = readFileSync(resolve('apps/mobile/src/api/plan-today.ts'), 'utf8')
  for (const source of [web, mobile]) {
    assert.match(source, /shouldEnsurePlan/)
    assert.match(source, /replanLearningPlan/)
    assert.match(source, /eventId\('plan-replan'\)/)
    assert.match(source, /httpStatus\(error\) === 409/)
  }
  assert.match(webApi, /'If-Match': String\(planVersion\)/)
  assert.match(mobileApi, /'If-Match': String\(planVersion\)/)
  assert.match(webApi, /ensureIdempotencyKey\(placementReportId\)/)
  assert.match(mobileApi, /ensureIdempotencyKey\(placementReportId\)/)
})
