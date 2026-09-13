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
  const application = read('services/api-gateway/src/main/resources/application.yml')
  const local = read('services/api-gateway/src/main/resources/application-local.yml')
  const env = read('.env.example')

  assert.match(properties, /record B14Services/)
  for (const domain of ['learner', 'content', 'learning', 'assessment', 'media', 'gamification', 'social', 'commerce']) {
    assert.match(properties, new RegExp(`"${domain}"`))
    assert.match(application, new RegExp(`${domain}: \\\$\\{B14_ROUTE_MODE_${domain.toUpperCase()}:TARGET\\}`))
  }
  assert.match(properties, /LEGACY, SHADOW, TARGET, FALLBACK/)
  // The routes are no longer registered by three hand-written methods. Every Gateway route comes
  // from GatewayRouteExecutionPolicy.routeBindings(), one rule at a time, which is the stronger
  // property: no route can be hand-registered outside the policy, and each route's methods come from
  // its own binding rather than from a literal in the configuration.
  assert.match(configuration, /routeExecutionPolicy\.routeBindings\(\)/)
  assert.match(configuration, /for \(GatewayRouteExecutionPolicy\.RouteBinding binding/)
  assert.match(configuration, /\.method\(routeMethods\(binding\.methods\(\)\)\)/)
  assert.match(configuration, /private static HttpMethod\[\] routeMethods/)
  assert.match(properties, /Map<String, @NotBlank String> routeModes/)
  assert.match(properties, /public RouteMode mode\(String domain\)/)
  assert.match(properties, /return mode\(domain\) == RouteMode\.TARGET/)
  assert.match(configuration, /executionFilters\(identityFilters\(filters, binding\.routeId\(\)\), binding\)/)
  // The deprecation window is typed configuration, and it is reserved rather than active: only a
  // TARGET domain resolves to a route, so nothing reachable can be deprecated and no code emits the
  // headers. Asserting the default is off keeps the configuration from advertising a behaviour that
  // does not exist, which is what the previous default of true did.
  assert.match(properties, /deprecationHeadersEnabled/)
  assert.match(properties, /deprecationSunsetAt/)
  assert.match(application, /deprecation-headers-enabled: \$\{B14_DEPRECATION_HEADERS_ENABLED:false\}/)
  assert.match(application, /deprecation-sunset-at: \$\{B14_DEPRECATION_SUNSET_AT:/)
  const executionPolicy = read('services/api-gateway/src/main/java/com/englishflow/gateway/policy/GatewayRouteExecutionPolicy.java')
  assert.match(executionPolicy, /b14\.mode\(domain\) == GatewayProperties\.B14Services\.RouteMode\.TARGET[\s\S]{0,120}?: null/)
  assert.match(executionPolicy, /\.filter\(Resolution::isAvailable\)/)
  assert.doesNotMatch(application + configuration + executionPolicy, /"Deprecation"|SUNSET_HEADER/)
  // No core-api catch-all is registered at all, which is stricter than allowing a read-only one.
  assert.doesNotMatch(configuration, /builder\.route\("core-api-legacy-compat"/)
  assert.match(configuration, /No B12\/B13\/B14\/core-api catch-all is registered/)
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
