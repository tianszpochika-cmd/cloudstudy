import test from 'node:test'
import assert from 'node:assert/strict'
import { applyPublicAuthHandoff, resolvePublicAuthHandoff } from '../src/platform/public-auth-handoff.mjs'

test('learner login, register, and password reset handoffs apply allowlisted values over restored preferences', () => {
  for (const pathname of ['/login', '/register', '/reset-password']) {
    const query = '?uiLocale=en-US&theme=dark&returnTo=%2Fhome'
    const handoff = resolvePublicAuthHandoff(pathname, query)
    const preferences = { uiLocale: 'zh-CN', theme: 'light' }

    applyPublicAuthHandoff(handoff, {
      setUiLocale: (value) => { preferences.uiLocale = value },
      setTheme: (value) => { preferences.theme = value },
    })

    assert.deepEqual(preferences, { uiLocale: 'en-US', theme: 'dark' })
    assert.equal(handoff.returnTo, '/home')
    assert.equal(query, '?uiLocale=en-US&theme=dark&returnTo=%2Fhome')
  }
})

test('invalid values and non-auth routes leave existing preferences unchanged', () => {
  const preferences = { uiLocale: 'en-US', theme: 'dark' }
  const actions = {
    setUiLocale: (value) => { preferences.uiLocale = value },
    setTheme: (value) => { preferences.theme = value },
  }
  const invalid = resolvePublicAuthHandoff('/register', '?uiLocale=fr-FR&theme=sepia&returnTo=%2Fhome')
  applyPublicAuthHandoff(invalid, actions)

  assert.deepEqual(preferences, { uiLocale: 'en-US', theme: 'dark' })
  assert.deepEqual(invalid, { returnTo: '/home' })
  assert.equal(resolvePublicAuthHandoff('/home', '?uiLocale=zh-CN&theme=light'), null)
  assert.equal(resolvePublicAuthHandoff('/login', '?theme=high-contrast').theme, 'high-contrast')
})
