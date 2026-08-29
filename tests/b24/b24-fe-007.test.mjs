import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

const require = createRequire(import.meta.url)
const typescript = require('typescript')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const config = JSON.parse(await readFile(join(root, 'config/b24-frontend-auth.json'), 'utf8'))
const read = (file) => readFile(join(root, file), 'utf8')

async function loadTypeScriptModule(relativePath) {
  const filename = resolve(root, relativePath)
  const source = await readFile(filename, 'utf8')
  const transpiled = typescript.transpileModule(source, {
    fileName: filename,
    compilerOptions: { target: typescript.ScriptTarget.ES2022, module: typescript.ModuleKind.ESNext, moduleResolution: typescript.ModuleResolutionKind.Bundler, isolatedModules: true },
  })
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(transpiled.outputText)}`)
}

function routeSection(source, route) {
  const index = source.indexOf(`path: '${route}'`)
  return index < 0 ? '' : source.slice(index, index + 900)
}

async function collectSourceFiles(directory, files = []) {
  const entries = await readdir(join(root, directory), { withFileTypes: true })
  for (const entry of entries) {
    if (['.nuxt', '.output', 'node_modules', 'dist', 'coverage', 'tests'].includes(entry.name)) continue
    const relativePath = join(directory, entry.name)
    if (entry.isDirectory()) await collectSourceFiles(relativePath, files)
    else if (/\.(mjs|ts|vue)$/.test(entry.name)) files.push(relativePath)
  }
  return files
}

test('B24 config is deterministic and selects the self-owned JWT login system', () => {
  assert.equal(config.taskId, 'V2-B24-FE-007')
  assert.equal(config.realLoginClaim, true)
  assert.equal(config.jwtRuntime.status, 'self-owned')
  assert.equal(config.jwtRuntime.algorithm, 'RS256')
  assert.equal(config.jwtRuntime.audience, 'yuxuexing-api')
  assert.equal(config.loginForm.submitEndpoint, '/api/v1/auth/login')
  assert.equal(config.loginForm.mustNotUseUrlToken, true)
  assert.doesNotMatch(JSON.stringify(config), /oidc|oauth|keycloak|pkce|authorization[_ -]?code/i)
})

test('learner-web and admin-web protect configured business routes without callback routes', async () => {
  const learner = await read('apps/learner-web/src/router/index.ts')
  const admin = await read('apps/admin-web/src/router/index.ts')
  for (const route of config.applications.find((app) => app.id === 'learner-web').protectedEntries) {
    const section = routeSection(learner, route)
    assert.ok(section, `learner route missing: ${route}`)
    assert.match(section, /requiresAuth\s*:\s*true/)
  }
  for (const route of config.applications.find((app) => app.id === 'admin-web').protectedEntries) {
    const section = routeSection(admin, route)
    assert.ok(section, `admin route missing: ${route}`)
    assert.match(section, /requiresAuth\s*:\s*true/)
    assert.match(section, /permission\s*:/)
  }
  assert.doesNotMatch(`${learner}\n${admin}`, /auth\/callback|authorizationCode|codeVerifier|codeChallenge|nonce/i)
  assert.match(`${learner}\n${admin}`, /forbidden/)
})

test('mobile uses the account-password form, global auth gate and native secure storage boundary', async () => {
  const mobile = config.applications.find((app) => app.id === 'mobile')
  const navigation = await read('apps/mobile/src/auth/navigation.ts')
  const app = await read('apps/mobile/src/App.vue')
  const login = await read('apps/mobile/src/pages/login/login.vue')
  const session = await read('apps/mobile/src/stores/session.ts')
  const runtime = await read('apps/mobile/src/platform/uni-runtime.ts')
  assert.match(navigation, /installMobileNavigationGuard/)
  assert.match(navigation, /ensureMobilePageAccess/)
  assert.match(navigation, /session\.restore/)
  assert.match(app, /installMobileNavigationGuard/)
  assert.match(login, /identifier|password/)
  assert.match(session, /getSecureStorage/)
  assert.match(session, /native.*refresh|refresh.*native/i)
  assert.match(runtime, /Keychain|Keystore|secure/i)
  assert.doesNotMatch(`${navigation}\n${app}\n${login}`, /auth\/callback|authorizationCode|PKCE|nonce/i)
  for (const entry of mobile.protectedEntries) assert.ok((await read(entry.source)).length > 0, `mobile entry missing: ${entry.path}`)
})

test('safe returnTo accepts internal paths and rejects open redirects', async () => {
  const learnerGateway = await loadTypeScriptModule('apps/learner-web/src/platform/gateway.ts')
  const mobileGateway = await loadTypeScriptModule('apps/mobile/src/platform/gateway.ts')
  const adminGateway = await loadTypeScriptModule('apps/admin-web/src/platform/gateway.ts')
  const officialLinks = await import(pathToFileURL(resolve(root, 'apps/official-site/utils/public-links.mjs')).href)
  assert.equal(learnerGateway.safeInternalReturnTo('/learn?unit=unit-1#practice', '/home'), '/learn?unit=unit-1#practice')
  assert.equal(mobileGateway.safeInternalReturnTo('/pages/practice/practice?source=deep-link#start', '/pages/home/home'), '/pages/practice/practice?source=deep-link#start')
  assert.equal(adminGateway.safeInternalReturnTo('/dashboard?tab=content', '/dashboard'), '/dashboard?tab=content')
  assert.equal(officialLinks.safePublicReturnTo('/home?source=official#top'), '/home?source=official#top')
  for (const value of config.returnTo.invalid) {
    assert.equal(learnerGateway.safeInternalReturnTo(value, '/home'), '/home')
    assert.equal(mobileGateway.safeInternalReturnTo(value, '/pages/home/home'), '/pages/home/home')
    assert.equal(adminGateway.safeInternalReturnTo(value, '/dashboard'), '/dashboard')
    assert.equal(officialLinks.safePublicReturnTo(value, '/home'), '/home')
  }
})

test('401 refresh and 403 forbidden semantics remain distinct across clients', async () => {
  const sources = await Promise.all([
    'apps/learner-web/src/api/client.ts', 'apps/admin-web/src/api/client.ts', 'apps/mobile/src/api/client.ts',
    'apps/learner-web/src/pages/ForbiddenPage.vue', 'apps/admin-web/src/views/AdminForbiddenView.vue', 'apps/mobile/src/pages/forbidden/forbidden.vue',
  ].map(read)).then((parts) => parts.join('\n'))
  assert.match(sources, /401/)
  assert.match(sources, /refreshSilently|onUnauthorized/)
  assert.match(sources, /403/)
  assert.match(sources, /forbidden|permission/i)
})

test('official-site is public-only and emits a controlled login link without business token state', async () => {
  const matrix = JSON.parse(await readFile(join(root, 'config/b18-frontend-test-matrix.json'), 'utf8'))
  assert.equal(matrix.applications.find((app) => app.id === 'official-site').auth, 'public-only')
  const files = await collectSourceFiles('apps/official-site')
  const source = (await Promise.all(files.map(read))).join('\n')
  const links = await read('apps/official-site/utils/public-links.mjs')
  assert.match(links, /learner.*login|\/login/i)
  assert.match(links, /safePublicReturnTo/)
  assert.doesNotMatch(source, /sessionStorage|refreshToken|accessToken|Authorization\s*:/i)
  assert.doesNotMatch(source, /auth\/callback|oidc|oauth|keycloak|PKCE/i)
})
