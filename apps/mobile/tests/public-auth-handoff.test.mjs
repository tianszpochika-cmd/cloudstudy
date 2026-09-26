import test from 'node:test'
import assert from 'node:assert/strict'
import { applyMobilePublicAuthHandoff, mobilePublicAuthQuery, resolveMobilePublicAuthHandoff } from '../src/platform/public-auth-handoff.mjs'

test('mobile official hash login, register, and password reset handoffs override restored preferences and retain returnTo', () => {
  for (const pathname of ['/pages/login/login', '/pages/register/register', '/pages/reset-password/reset-password']) {
    const hash = `#${pathname}?uiLocale=en-US&theme=dark&returnTo=%2Fpages%2Fhome%2Fhome`
    const query = mobilePublicAuthQuery({ hash })
    const handoff = resolveMobilePublicAuthHandoff(pathname, query)
    const preferences = { uiLocale: 'zh-CN', theme: 'light' }
    applyMobilePublicAuthHandoff(handoff, {
      setUiLocale: (value) => { preferences.uiLocale = value },
      setTheme: (value) => { preferences.theme = value },
    })

    assert.deepEqual(preferences, { uiLocale: 'en-US', theme: 'dark' })
    assert.equal(handoff.returnTo, '/pages/home/home')
  }
})

test('invalid mobile values and protected routes leave existing preferences unchanged', () => {
  const preferences = { uiLocale: 'en-US', theme: 'dark' }
  const actions = {
    setUiLocale: (value) => { preferences.uiLocale = value },
    setTheme: (value) => { preferences.theme = value },
  }
  const handoff = resolveMobilePublicAuthHandoff('/pages/login/login', '?uiLocale=zh&theme=sepia')
  applyMobilePublicAuthHandoff(handoff, actions)

  assert.deepEqual(preferences, { uiLocale: 'en-US', theme: 'dark' })
  assert.equal(resolveMobilePublicAuthHandoff('/pages/home/home', '?uiLocale=zh-CN&theme=light'), null)
  assert.equal(resolveMobilePublicAuthHandoff('/pages/login/login', '?theme=high-contrast').theme, 'high-contrast')
})
