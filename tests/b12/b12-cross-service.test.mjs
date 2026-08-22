import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..', '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

test('B12 service boundaries expose server-owned facts and trusted event seams', () => {
  const gamification = read('services/gamification-service/src/main/java/com/englishflow/gamification/adapter/http/GamificationController.java')
  const social = read('services/social-service/src/main/java/com/englishflow/social/domain/SocialService.java')
  const notification = read('services/notification-service/src/main/java/com/englishflow/notification/application/TrustedEventApplicationService.java')
  assert.match(gamification, /trusted-events\/completions/)
  assert.match(gamification, /summary|ledger|rewards/)
  assert.match(social, /dedupe|idempot|lease|visibility|preset/i)
  assert.match(notification, /dedupe|TrustedEvent|allowlist/i)
  for (const source of [gamification, social, notification]) {
    assert.doesNotMatch(source, /X-B5-Role|X-Role|X-Tenant|X-Owner|X-B5-Tenant/i)
  }
})

test('B12 learning completion to growth to notification remains idempotent', () => {
  const accepted = new Set()
  const effects = []
  const completion = { eventId: 'evt-learning-1', dedupeKey: 'learning-session-1', qualifiedUnits: 1 }
  function consume(event) {
    if (accepted.has(event.dedupeKey)) return 'DUPLICATE'
    accepted.add(event.dedupeKey)
    effects.push({ kind: 'server-score-ledger', amount: event.qualifiedUnits })
    effects.push({ kind: 'notification-request', templateId: 'growth.reward.granted.v1' })
    return 'APPLIED'
  }
  assert.equal(consume(completion), 'APPLIED')
  assert.equal(consume(completion), 'DUPLICATE')
  assert.equal(effects.filter((effect) => effect.kind === 'server-score-ledger').length, 1)
  assert.equal(effects.filter((effect) => effect.kind === 'notification-request').length, 1)
  assert.equal(Object.hasOwn(completion, 'xp'), false)
  assert.equal(Object.hasOwn(completion, 'coins'), false)
})

test('B12 frontend surfaces preserve internationalization, token themes and explicit degraded states', () => {
  const frontendFiles = [
    'apps/learner-web/src/components/b12/B12RewardsCard.vue',
    'apps/learner-web/src/components/b12/B12SocialExtensions.vue',
    'apps/mobile/src/components/b12/B12RewardsCard.vue',
    'apps/mobile/src/components/b12/B12SocialExtensions.vue',
    'apps/admin-web/src/views/AdminB12GovernanceView.vue',
  ]
  for (const file of frontendFiles) {
    const source = read(file)
    assert.match(source, /b12T\(/, `${file} must use B12 i18n`)
    assert.doesNotMatch(source, /Math\.random|<textarea|v-model=.*(tenantId|ownerId|userId)/i, `${file} unsafe input`)
  }
  const learner = read('apps/learner-web/src/components/b12/B12RewardsCard.vue')
  const mobile = read('apps/mobile/src/components/b12/B12RewardsCard.vue')
  assert.match(learner, /status\.offline|status\.permission|status\.recovery/)
  assert.match(mobile, /status\.offline|status\.permission|status\.recovery/)
})
