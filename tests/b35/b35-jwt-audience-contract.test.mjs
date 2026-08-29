import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')

const resourceServers = [
  ['learner', 'services/learner-service/src/main/java/com/englishflow/learner/security/SecurityConfiguration.java', 'services/learner-service/src/main/resources/application.yml'],
  ['learning', 'services/learning-service/src/main/java/com/englishflow/learning/security/SecurityConfiguration.java', 'services/learning-service/src/main/resources/application.yml'],
  ['assessment', 'services/assessment-service/src/main/java/com/englishflow/assessment/security/AssessmentSecurityConfiguration.java', 'services/assessment-service/src/main/resources/application.yml'],
  ['content', 'services/content-service/src/main/java/com/englishflow/content/security/ContentSecurityConfiguration.java', 'services/content-service/src/main/resources/application.yml'],
  ['media', 'services/media-service/src/main/java/com/englishflow/media/security/MediaSecurityConfiguration.java', 'services/media-service/src/main/resources/application.yml'],
  ['notification', 'services/notification-service/src/main/java/com/englishflow/notification/config/NotificationSecurityConfiguration.java', 'services/notification-service/src/main/resources/application.yml'],
  ['gamification', 'services/gamification-service/src/main/java/com/englishflow/gamification/adapter/http/GamificationSecurityConfiguration.java', 'services/gamification-service/src/main/resources/application.yml'],
  ['social', 'services/social-service/src/main/java/com/englishflow/social/security/SocialSecurityConfiguration.java', 'services/social-service/src/main/resources/application.yml'],
  ['commerce', 'services/commerce-service/src/main/java/com/englishflow/commerce/adapter/http/CommerceSecurityConfiguration.java', 'services/commerce-service/src/main/resources/application.yaml'],
  ['admin-ops', 'services/admin-ops-service/src/main/java/com/englishflow/adminops/security/AdminOpsSecurityConfiguration.java', 'services/admin-ops-service/src/main/resources/application.yml'],
  ['analytics', 'services/analytics-service/src/main/java/com/englishflow/analytics/security/AnalyticsSecurityConfiguration.java', 'services/analytics-service/src/main/resources/application.yml'],
  ['service-template', 'services/service-template/src/main/java/com/englishflow/platform/template/security/SecurityConfiguration.java', 'services/service-template/src/main/resources/application.yml'],
]

test('B35 JWT audience contract protects every Resource Server', () => {
  for (const [service, securityPath, configPath] of resourceServers) {
    const security = readFileSync(path.join(root, securityPath), 'utf8')
    const config = readFileSync(path.join(root, configPath), 'utf8')
    assert.match(security, /JwtAudienceValidator/, `${service} must validate the API audience`)
    assert.match(config, /audience/, `${service} must declare an audience configuration`)
    assert.match(config, /yuxuexing-api/, `${service} must default to the shared API audience`)
  }
})
