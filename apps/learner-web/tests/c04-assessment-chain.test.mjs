import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..', '..')
const read = (path) => readFile(join(root, path), 'utf8')

test('learner-web assessment chain uses the real placement owner and idempotent mutations', async () => {
  const api = await read('apps/learner-web/src/api/learner-content.ts')
  const store = await read('apps/learner-web/src/stores/learner-content.ts')
  const contract = await read('packages/contracts/fragments/b25/b25-phase1-real-data.openapi.json')
  const gateway = await read('services/api-gateway/src/main/java/com/englishflow/gateway/policy/GatewayRouteExecutionPolicy.java')
  assert.match(contract, /\/internal\/v1\/assessment\/placement\/start/)
  assert.match(contract, /\/internal\/v1\/assessment\/placement\/submit-step/)
  assert.match(contract, /\/internal\/v1\/assessment\/placement\/skip/)
  // Policy-driven gateway: explicit placement projections to the assessment owner
  // (replaces the retired "/api/v1/" + domain + "/**" public-path builder).
  assert.match(gateway, /rewrite\("placement-start", "\/api\/v1\/assessment\/placement\/start", "\/internal\/v1\/assessment\/placement\/start", ASSESSMENT_B25/)
  assert.match(gateway, /rewrite\("placement-submit-step", "\/api\/v1\/assessment\/placement\/submit-step"/)
  assert.match(gateway, /rewrite\("placement-skip", "\/api\/v1\/assessment\/placement\/skip"/)
  assert.match(api, /READ_MODEL_PATHS\.placementAnswerCommand/)
  assert.match(api, /READ_MODEL_PATHS\.placementSkipCommand/)
  assert.match(api, /withIdempotency\(`placement-answer-/)
  assert.match(api, /withIdempotency\(input\.clientEventId\)/)
  assert.match(api, /rawScore >= 0 && rawScore <= 1 \? rawScore \* 100 : rawScore/)
  assert.match(store, /LOCAL_REAL_RUNTIME = import\.meta\.env\.VITE_RUNTIME_MODE !== 'preview'/)
  assert.match(store, /assessment\.value\.status === 'completed'/)
  assert.match(store, /learnerContentPort\.submitPlacementAnswer/)
  assert.match(store, /learnerContentPort\.skipPlacement/)
  assert.match(store, /async function restartAssessment\(\)/)
  assert.match(store, /placement-restart/)
})

test('learner-web exposes explicit loading, error, retry, and server daily/weekly report states', async () => {
  const assessment = await read('apps/learner-web/src/pages/AssessmentPage.vue')
  const report = await read('apps/learner-web/src/pages/B2ReportPage.vue')
  assert.match(assessment, /正在准备测评/)
  assert.match(assessment, /测评暂时不可用/)
  assert.match(assessment, /@click="retry"/)
  assert.match(assessment, /重新开始测评/)
  assert.match(report, /useB10Store/)
  assert.match(report, /loadReport\(reportType\.value\)/)
  assert.match(report, /reportType === 'WEEKLY'/)
  assert.match(report, /assessment\/learning 服务端生成的快照/)
  assert.match(report, /已确认的学习结果/)
})

test('assessment service maps public fast-track values and returns real question progress metadata', async () => {
  const service = await read('services/assessment-service/src/main/java/com/englishflow/assessment/web/B25AssessmentJdbcController.java')
  const b10 = await read('services/assessment-service/src/main/java/com/englishflow/assessment/web/B10AssessmentJdbcController.java')
  assert.match(service, /case "ZERO_A1" -> "A1"/)
  assert.match(service, /case "CET4_B1" -> "B1"/)
  assert.match(service, /case "CET6_B2", "POSTGRAD_B2_PLUS" -> "B2"/)
  assert.match(service, /result\.put\("stepIndex"/)
  assert.match(service, /result\.put\("totalSteps"/)
  assert.match(service, /answer_rule_json/)
  assert.match(service, /Idempotency-Key was reused with a different assessment request/)
  assert.match(service, /source", "assessment-service"/)
  assert.match(b10, /claimAttemptIdempotency/)
  assert.match(b10, /INSERT IGNORE INTO assessment_idempotency/)
  assert.match(b10, /submissionId was reused with a different answer/)
})
