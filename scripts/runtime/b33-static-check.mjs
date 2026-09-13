import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

function read(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function required(condition, message, errors) {
  if (!condition) errors.push(message)
}

function packageJson(root, relativePath) {
  return JSON.parse(read(root, relativePath))
}

export function validateB33Static(root = repositoryRoot) {
  const errors = []
  const projects = [
    { id: 'learner-web', packagePath: 'apps/learner-web/package.json', devPort: '18180', build: 'build' },
    { id: 'admin-web', packagePath: 'apps/admin-web/package.json', devPort: '18181', build: 'build' },
    { id: 'official-site', packagePath: 'apps/official-site/package.json', devPort: '18182', build: 'build' },
    { id: 'mobile-h5', packagePath: 'apps/mobile/package.json', devPort: '18183', build: 'build:h5' },
  ]

  for (const project of projects) {
    required(fs.existsSync(path.join(root, project.packagePath)), `missing frontend project: ${project.id}`, errors)
    if (!fs.existsSync(path.join(root, project.packagePath))) continue
    const pkg = packageJson(root, project.packagePath)
    const scripts = pkg.scripts ?? {}
    const devScript = project.id === 'mobile-h5' ? scripts['dev:h5'] : scripts.dev
    required(typeof devScript === 'string' && devScript.includes(project.devPort) && devScript.includes('--strictPort'), `${project.id} must use fixed strict port ${project.devPort}`, errors)
    required(typeof scripts[project.build] === 'string', `${project.id} build script missing: ${project.build}`, errors)
  }

  const learnerGateway = read(root, 'apps/learner-web/src/platform/gateway.ts')
  const mobileGateway = read(root, 'apps/mobile/src/platform/gateway.ts')
  const adminGateway = read(root, 'apps/admin-web/src/platform/gateway.ts')
  const learnerClient = read(root, 'apps/learner-web/src/api/client.ts')
  const adminClient = read(root, 'apps/admin-web/src/api/client.ts')
  const learnerStore = read(root, 'apps/learner-web/src/stores/learner-content.ts')
  const mobileStore = read(root, 'apps/mobile/src/stores/learner-content.ts')
  const officialConfig = read(root, 'apps/official-site/nuxt.config.ts')
  const officialProjection = read(root, 'apps/official-site/server/api/public-projection.get.ts')
  const gatewayConfig = read(root, 'services/api-gateway/src/main/java/com/englishflow/gateway/config/GatewayConfiguration.java')
  const gatewayPolicy = read(root, 'services/api-gateway/src/main/java/com/englishflow/gateway/policy/GatewayRoutePolicy.java')
  const gatewayExecution = read(root, 'services/api-gateway/src/main/java/com/englishflow/gateway/policy/GatewayRouteExecutionPolicy.java')
  const contentController = read(root, 'services/content-service/src/main/java/com/englishflow/content/web/ContentHttpController.java')
  const contentSecurity = read(root, 'services/content-service/src/main/java/com/englishflow/content/security/ContentSecurityConfiguration.java')

  for (const [id, source] of [['learner-web', learnerGateway], ['mobile-h5', mobileGateway], ['admin-web', adminGateway]]) {
    required(source.includes('VITE_GATEWAY_BASE_URL') && source.includes('18070/api/v1'), `${id} must resolve the fixed API Gateway base URL`, errors)
  }
  required(learnerClient.includes('Authorization') && learnerClient.includes('getGatewayBaseUrl'), 'learner-web requests must carry the session token to Gateway', errors)
  required(adminClient.includes('Authorization') && adminClient.includes('forbiddenHeaderNames') && adminClient.includes('x-role'), 'admin-web must use verified Gateway sessions and strip client authority headers', errors)
  required(learnerStore.includes("VITE_RUNTIME_MODE !== 'preview'") && learnerStore.includes('submitAnswerAgainstServer') && learnerStore.includes('completeTaskAgainstServer'), 'learner-web real mode must use server writes and explicit preview fallback', errors)
  required(mobileStore.includes("VITE_RUNTIME_MODE !== 'preview'") && mobileStore.includes('if (!LOCAL_REAL_RUNTIME)') && mobileStore.includes('学习服务没有确认任务完成'), 'Mobile H5 real mode must not promote cached or optimistic task facts', errors)
  required(officialConfig.includes('NUXT_PUBLIC_GATEWAY_BASE_URL') && officialConfig.includes('18070/api/v1'), 'official-site must configure its SSR Gateway endpoint', errors)
  required(officialProjection.includes('/public/site/projection') && officialProjection.includes('source: \'gateway\''), 'official-site must consume the public projection through Gateway', errors)
  // The route is meant to reach the controller through the Gateway, but the canonical rule assigns
  // /api/v1/public/site to admin-ops-service while the controller that serves it lives in
  // content-service, so GatewayRouteExecutionPolicy refuses to register it and names the conflict
  // rather than routing to a service that does not implement the path. Either state is acceptable:
  // registered, or withheld with the conflict recorded. What must never happen is the route
  // disappearing with nothing saying why, which is what this asserts. See P1R-M3-008.
  const projectionRegistered = gatewayPolicy.includes('"public-site"')
    && gatewayExecution.includes('add(definitions, "public-site"');
  const conflictRecorded = gatewayExecution.includes('canonical_owner_admin_ops_conflicts_with_current_content_controller');
  required(projectionRegistered || conflictRecorded,
    'the public site projection route must either be registered or have its owner conflict recorded', errors)
  required(gatewayPolicy.includes('"/api/v1/public/site"'), 'the canonical public site rule must stay declared', errors)
  required(contentController.includes('@GetMapping("/api/v1/public/site/projection")') && contentController.includes('catalogEntries'), 'content-service must assemble the public site projection from published owner facts', errors)
  required(contentSecurity.includes('/api/v1/public/site/projection') && contentSecurity.includes('permitAll'), 'public site projection must be public read-only without weakening learner/admin PEP', errors)

  const runtimeSourceFiles = [
    'apps/learner-web/src',
    'apps/mobile/src',
    'apps/admin-web/src',
    'apps/official-site/server',
    'apps/official-site/composables',
    'apps/official-site/utils',
  ]
  const forbiddenRuntimePatterns = [
    /from\s+['"][^'"]*gateway-test-double['"]/,
    /https?:\/\/127\.0\.0\.1:(?:18080|18087|18088|18089|18090|18091|18092|18093|18094|18095|18096|18097|18098)(?:\D|$)/,
  ]
  function walk(directory) {
    const absolute = path.join(root, directory)
    if (!fs.existsSync(absolute)) return []
    const files = []
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      const child = path.join(absolute, entry.name)
      if (entry.isDirectory()) files.push(...walk(path.relative(root, child)))
      else if (/\.(?:ts|vue|mjs|js|css|scss)$/.test(entry.name)) files.push(child)
    }
    return files
  }
  const violations = []
  for (const directory of runtimeSourceFiles) {
    for (const file of walk(directory)) {
      const source = fs.readFileSync(file, 'utf8')
      for (const pattern of forbiddenRuntimePatterns) {
        if (pattern.test(source)) violations.push(path.relative(root, file))
      }
    }
  }
  required(violations.length === 0, `frontend runtime directly imports test doubles or calls owner services: ${[...new Set(violations)].join(', ')}`, errors)

  const miniappPath = path.join(root, 'apps/miniapp-wechat/package.json')
  required(!fs.existsSync(miniappPath), 'apps/miniapp-wechat must not become a fifth independent business project', errors)

  return {
    result: errors.length ? 'FAIL' : 'PASS',
    errors,
    summary: {
      frontendProjects: projects.length,
      fixedPorts: projects.map((project) => project.devPort),
      gatewayOnly: violations.length === 0,
      mobileRealCacheBoundary: mobileStore.includes('if (!LOCAL_REAL_RUNTIME)'),
      independentWechatProject: fs.existsSync(miniappPath),
    },
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const result = validateB33Static()
  console.log(JSON.stringify(result, null, 2))
  process.exitCode = result.result === 'PASS' ? 0 : 1
}
