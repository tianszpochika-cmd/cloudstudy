import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

test('login only honors return paths that resolve to a learner route', () => {
  const router = read('src/router/index.ts')
  assert.match(router, /export function learnerReturnTo/)
  assert.match(router, /NON_RETURN_ROUTES = new Set\(\['not-found', 'login', 'register', 'reset-password'\]\)/)
  assert.match(router, /!resolved\.matched\.length/)
  assert.match(router, /return learnerReturnTo\(session\.consumeReturnTo\(\)\)/)
  const login = read('src/pages/LoginPage.vue')
  assert.match(login, /learnerReturnTo\(route\.query\.redirect \?\? session\.peekReturnTo\(\)\)/)
  assert.match(login, /learnerReturnTo\(session\.consumeReturnTo\(\)\)/)
})

test('404 and forbidden pages do not render inside the login AuthLayout', () => {
  for (const page of ['src/pages/EmptyPage.vue', 'src/pages/ForbiddenPage.vue']) {
    assert.doesNotMatch(read(page), /AuthLayout/, page)
  }
  const router = read('src/router/index.ts')
  assert.match(router, /name: 'not-found'[\s\S]*?meta: \{ statusPage: true/)
  assert.match(router, /name: 'forbidden'[^\n]*statusPage: true/)
  const app = read('src/App.vue')
  assert.match(app, /route\.meta\.statusPage && session\.isAuthenticated/)
  assert.match(app, /<StatusLayout v-else-if="route\.meta\.statusPage">/)
})
