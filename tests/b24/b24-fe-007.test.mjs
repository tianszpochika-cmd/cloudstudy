import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
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
    compilerOptions: {
      target: typescript.ScriptTarget.ES2022,
      module: typescript.ModuleKind.ESNext,
      moduleResolution: typescript.ModuleResolutionKind.Bundler,
      isolatedModules: true,
    },
  })
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(transpiled.outputText)}`)
}

function routeSection(source, path) {
  const index = source.indexOf(`path: '${path}'`)
  if (index < 0) return ''
  return source.slice(index, index + 900)
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

test('B24-FE-007 config is deterministic, four-app scoped, and contains no credential fixture', () => {
  assert.equal(config.taskId, 'V2-B24-FE-007')
  assert.equal(config.scope, 'static-and-logic-evidence-only')
  assert.equal(config.realLoginClaim, false)
  assert.deepEqual(config.applications.map((app) => app.id), ['mobile', 'learner-web', 'admin-web', 'official-site'])
  assert.deepEqual(config.i18nAndTheme.themes, ['light', 'dark', 'system', 'high-contrast'])
  assert.doesNotMatch(JSON.stringify(config), /password|clientSecret|accessToken|refreshToken|authorizationCode|privateKey/i)
})

test('learner-web and admin-web protect every configured business route and keep explicit auth states', async () => {
  const learner = await read('apps/learner-web/src/router/index.ts')
  const admin = await read('apps/admin-web/src/router/index.ts')

  for (const path of config.applications.find((app) => app.id === 'learner-web').protectedEntries) {
    const section = routeSection(learner, path)
    assert.ok(section, `learner route missing: ${path}`)
    assert.match(section, /requiresAuth\s*:\s*true/, `learner route is not protected: ${path}`)
  }
  for (const path of config.applications.find((app) => app.id === 'admin-web').protectedEntries) {
    const section = routeSection(admin, path)
    assert.ok(section, `admin route missing: ${path}`)
    assert.match(section, /requiresAuth\s*:\s*true/, `admin route is not protected: ${path}`)
    assert.match(section, /permission\s*:/, `admin route has no permission boundary: ${path}`)
  }
  for (const source of [learner, admin]) {
    assert.match(source, /auth\/callback/)
    assert.match(source, /forbidden/)
    assert.match(source, /requiresAuth/)
  }
})

test('learner-web clean root enters the login boundary', async () => {
  const learner = await read('apps/learner-web/src/router/index.ts')
  const rootEntry = config.applications.find((app) => app.id === 'learner-web').rootEntry
  const section = routeSection(learner, rootEntry.path)
  assert.match(section, /redirect\s*:\s*\{\s*name:\s*['"]login['"]\s*\}/)
})

test('Mobile H5 protected entry inventory is covered by one global navigation gate', async () => {
  const mobile = config.applications.find((app) => app.id === 'mobile')
  const navigation = await read('apps/mobile/src/auth/navigation.ts')
  const app = await read('apps/mobile/src/App.vue')
  assert.match(navigation, /installMobileNavigationGuard/)
  assert.match(navigation, /ensureMobilePageAccess/)
  assert.match(navigation, /session\.restore/)
  assert.match(navigation, /!session\.isAuthenticated/)
  assert.match(navigation, /pages\/login\/login/)
  assert.match(app, /installMobileNavigationGuard/)
  for (const entry of mobile.protectedEntries) {
    const source = await read(entry.source)
    assert.ok(source.length > 0, `mobile protected entry missing: ${entry.path}`)
  }
  assert.deepEqual(config.observedKnownGaps.mobileProtectedEntryGuards, [])
})

test('Mobile H5 protected entries have an explicit deep-link fallback', async () => {
  const navigation = await read('apps/mobile/src/auth/navigation.ts')
  assert.match(navigation, /export async function ensureMobilePageAccess/)
  assert.match(navigation, /showLogin\(normalized\)/)
})

test('Mobile H5 uses a fragment-free OIDC redirect and bridges callback query into the uni page', async () => {
  const gateway = await read('apps/mobile/src/auth/gateway-auth.ts')
  const navigation = await read('apps/mobile/src/auth/navigation.ts')
  const app = await read('apps/mobile/src/App.vue')
  assert.match(gateway, /window\.location\.origin}\/auth\/callback/)
  assert.doesNotMatch(gateway, /location\.pathname[^\n]*#\/pages\/auth-callback/)
  assert.match(navigation, /bridgeMobileH5OidcCallback/)
  assert.match(navigation, /error_description.*error_uri/)
  assert.match(app, /bridgeMobileH5OidcCallback\(\)/)
})

test('safe returnTo accepts same-origin internal paths and rejects open redirects', async () => {
  const learnerGateway = await loadTypeScriptModule('apps/learner-web/src/platform/gateway.ts')
  const mobileGateway = await loadTypeScriptModule('apps/mobile/src/platform/gateway.ts')
  const adminGateway = await loadTypeScriptModule('apps/admin-web/src/platform/gateway.ts')
  const officialLinks = await import(pathToFileURL(resolve(root, 'apps/official-site/utils/public-links.mjs')).href)

  assert.equal(learnerGateway.safeInternalReturnTo('/learn?unit=unit-1#practice', '/home'), '/learn?unit=unit-1#practice')
  assert.equal(mobileGateway.safeInternalReturnTo('/pages/practice/practice?source=deep-link#start', '/pages/home/home'), '/pages/practice/practice?source=deep-link#start')
  assert.equal(adminGateway.safeInternalReturnTo('/dashboard?tab=content', '/dashboard'), '/dashboard?tab=content')
  assert.equal(officialLinks.safePublicReturnTo('/home?source=official#top'), '/home?source=official#top')

  const invalid = config.returnTo.invalid
  for (const value of invalid) {
    assert.equal(learnerGateway.safeInternalReturnTo(value, '/home'), '/home', `learner accepted unsafe returnTo: ${value}`)
    assert.equal(mobileGateway.safeInternalReturnTo(value, '/pages/home/home'), '/pages/home/home', `mobile accepted unsafe returnTo: ${value}`)
    assert.equal(adminGateway.safeInternalReturnTo(value, '/dashboard'), '/dashboard', `admin accepted unsafe returnTo: ${value}`)
    assert.equal(officialLinks.safePublicReturnTo(value, '/home'), '/home', `official site accepted unsafe returnTo: ${value}`)
  }
})

test('OIDC callback adapters require code and state and keep verifier facts server-side', async () => {
  for (const file of config.oidcCallback.adapterSources) {
    const source = await read(file)
    assert.match(source, /if\s*\(input\.error\)/, `${file} must handle provider errors first`)
    assert.match(source, /!input\.code\s*\|\|\s*!input\.state/, `${file} must require code and state`)
    assert.doesNotMatch(source, /codeVerifier|codeChallenge|nonce/, `${file} must not accept server verifier facts from the client`)
  }
  for (const file of ['apps/learner-web/src/pages/AuthCallbackPage.vue', 'apps/admin-web/src/views/AdminAuthCallbackView.vue', 'apps/mobile/src/pages/auth-callback/auth-callback.vue']) {
    const source = await read(file)
    assert.match(source, /code:/, `${file} must forward code`)
    assert.match(source, /state:/, `${file} must forward state`)
    assert.match(source, /error_description|errorDescription/, `${file} must preserve provider error semantics`)
  }
})

test('401 and 403 retain distinct client semantics', async () => {
  const learnerClient = await read('apps/learner-web/src/api/client.ts')
  const adminClient = await read('apps/admin-web/src/api/client.ts')
  const mobileClient = await read('apps/mobile/src/api/client.ts')
  for (const source of [learnerClient, adminClient, mobileClient]) {
    assert.match(source, /status(?:Code)?\s*===\s*401/)
    assert.match(source, /refreshSilently|onUnauthorized/)
  }

  const learnerState = await read('apps/learner-web/src/stores/b18-learning.ts')
  const mobileState = await read('apps/mobile/src/api/b10.ts')
  const adminState = await read('apps/admin-web/src/views/AdminSupportView.vue')
  assert.match(learnerState, /401\s*\|\|\s*error\.status\s*===\s*403[\s\S]{0,180}permission/)
  assert.match(mobileState, /status\s*===\s*401[\s\S]{0,120}forbidden/)
  assert.match(mobileState, /status\s*===\s*403[\s\S]{0,120}forbidden/)
  assert.match(adminState, /error\.status\s*===\s*403[\s\S]{0,120}permission/)
  assert.match(await read('apps/learner-web/src/pages/ForbiddenPage.vue'), /没有访问权限|forbidden/i)
  assert.match(await read('apps/admin-web/src/views/AdminForbiddenView.vue'), /没有访问权限|forbidden/i)
  assert.match(await read('apps/mobile/src/pages/forbidden/forbidden.vue'), /forbidden/i)
})

test('adult Gate rejection is represented as REJECTED and callback cannot enter learning before the Gate', async () => {
  const learnerAuth = await read('apps/learner-web/src/auth/gateway-auth.ts')
  const learnerSession = await read('apps/learner-web/src/stores/session.ts')
  const learnerGate = await read('apps/learner-web/src/pages/AdultGatePage.vue')
  const callback = await read('apps/learner-web/src/pages/AuthCallbackPage.vue')
  const mobileAuth = await read('apps/mobile/src/auth/gateway-auth.ts')
  const mobileSession = await read('apps/mobile/src/stores/session.ts')

  for (const source of [learnerAuth, mobileAuth]) assert.match(source, /iam\/adult-gate/)
  for (const source of [learnerSession, mobileSession]) {
    assert.match(source, /adultGate\.value\s*=\s*.*REJECTED/)
    assert.match(source, /adultDeclaration:\s*true/)
    assert.match(source, /adultGate\.value\s*===\s*['"]PASSED['"]|return false/)
  }
  assert.match(learnerGate, /await session\.confirmAdultGate/)
  assert.match(learnerGate, /else error\.value/)
  assert.match(callback, /adultGate\s*===\s*['"]REQUIRED['"]/)
})

test('onboarding writes are blocked by an explicit server adult Gate rejection', async () => {
  const learnerOnboarding = await read('apps/learner-web/src/pages/OnboardingPage.vue')
  const mobileOnboarding = await read('apps/mobile/src/pages/onboarding/onboarding.vue')
  assert.match(learnerOnboarding, /confirmAdultGate/)
  assert.match(mobileOnboarding, /confirmAdultGate/)
  assert.deepEqual(config.observedKnownGaps.onboardingAdultGateWriteBoundary, [])
})

test('UI locale and contentLocale remain separate and all four themes are exposed to each frontend', async () => {
  const foundationSources = await Promise.all(config.i18nAndTheme.foundationSources.map(read))
  for (const source of foundationSources) {
    assert.match(source, /locale\s*:/)
    assert.match(source, /contentLocale\s*:/)
    assert.match(source, /createThemeController|ThemeController|themeController/i)
  }

  const i18n = await loadTypeScriptModule('packages/i18n/src/index.ts')
  const tokens = await loadTypeScriptModule('packages/design-tokens/src/index.ts')
  const instance = i18n.createI18n({
    locale: 'en-US',
    contentLocale: 'en-GB',
    messages: { 'zh-CN': { title: '学习' }, en: { title: 'Learning' } },
    fallbackLocale: ['zh-CN'],
  })
  assert.equal(instance.locale, 'en-US')
  assert.equal(instance.contentLocale, 'en-GB')
  instance.setContentLocale('ja-JP')
  assert.equal(instance.locale, 'en-US')
  assert.deepEqual(tokens.THEME_MODES, config.i18nAndTheme.themes)
  for (const mode of config.i18nAndTheme.themes) assert.ok(tokens.getThemeVariableMap(mode), `missing theme map: ${mode}`)
})

test('official site remains public-only and only emits a controlled learner login link', async () => {
  const matrix = JSON.parse(await readFile(join(root, 'config/b18-frontend-test-matrix.json'), 'utf8'))
  assert.equal(matrix.applications.find((app) => app.id === 'official-site').auth, 'public-only')
  const files = await collectSourceFiles('apps/official-site')
  const source = (await Promise.all(files.map(read))).join('\n')
  const links = await read('apps/official-site/utils/public-links.mjs')
  assert.match(links, /standard-oidc\/authorization\/start/)
  assert.match(links, /safePublicReturnTo/)
  assert.doesNotMatch(source, /sessionStorage|refreshToken|accessToken|Authorization\s*:/i)
  assert.doesNotMatch(source, /createOrder|createPayment|createEntitlement|paymentCallback|webhook/i)
  assert.doesNotMatch(source, /method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i)
})

test('real OIDC/browser evidence is explicitly pending rather than fabricated', () => {
  assert.equal(config.keycloakRuntime.status, 'blocked')
  assert.equal(config.realLoginClaim, false)
  const b23EvidencePath = join(root, config.keycloakRuntime.evidenceFile)
  assert.ok(relative(root, b23EvidencePath).startsWith('docs'))
})
