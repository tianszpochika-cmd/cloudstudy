import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { verifyB14Boundaries } from '../../scripts/security/verify-b14-boundaries.mjs'

const root = path.resolve(import.meta.dirname, '..', '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

test('B14 Gateway has an explicit Phase 1 strangler route matrix and safe deprecation window', () => {
  const properties = read('services/api-gateway/src/main/java/com/englishflow/gateway/config/GatewayProperties.java')
  const configuration = read('services/api-gateway/src/main/java/com/englishflow/gateway/config/GatewayConfiguration.java')
  const guard = read('services/api-gateway/src/main/java/com/englishflow/gateway/filter/B14RouteModeGuardGlobalFilter.java')
  const application = read('services/api-gateway/src/main/resources/application.yaml')
  const local = read('services/api-gateway/src/main/resources/application-local.yaml')
  const env = read('.env.example')

  assert.match(properties, /record B14Services/)
  for (const domain of ['learner', 'content', 'learning', 'assessment', 'media', 'gamification', 'social', 'commerce']) {
    assert.match(properties, new RegExp(`"${domain}"`))
    assert.match(application, new RegExp(`${domain}: \\\$\\{B14_ROUTE_MODE_${domain.toUpperCase()}:TARGET\\}`))
  }
  assert.match(properties, /LEGACY, SHADOW, TARGET, FALLBACK/)
  assert.match(configuration, /registerB14Routes/)
  assert.match(configuration, /registerB14TargetRoutes/)
  assert.match(configuration, /registerB14LegacyReadRoute/)
  assert.match(configuration, /RouteMode\.SHADOW/)
  assert.match(configuration, /targetFilters/)
  assert.match(configuration, /Deprecation/)
  assert.match(configuration, /Sunset/)
  const legacyRoute = configuration.match(/builder\.route\("core-api-legacy-compat"[\s\S]*?\.uri\(coreApiUri\)\);/i)?.[0] ?? ''
  assert.match(legacyRoute, /method\(HttpMethod\.GET, HttpMethod\.HEAD\)/)
  assert.doesNotMatch(legacyRoute, /method\(HttpMethod\.(?:POST|PUT|PATCH|DELETE)/)
  assert.match(guard, /SERVICE_UNAVAILABLE/)
  assert.match(guard, /READ_METHODS/)
  assert.match(guard, /B14Services\.DOMAINS/)
  assert.match(local, /B14_STRANGLER_ENABLED/)
  assert.match(env, /B14_DEPRECATION_SUNSET_AT/)
})

test('B14 static security scan passes owner, PEP, secret, event and schema-boundary checks', () => {
  const result = verifyB14Boundaries()
  assert.equal(result.ok, true, result.failures.join('\n'))
  assert.ok(result.inspected.services >= 12)
  assert.ok(result.inspected.eventFragments >= 13)
})
