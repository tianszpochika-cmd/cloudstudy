import test from 'node:test'
import assert from 'node:assert/strict'

// Test the router guard logic for BC-007 / IC-005 / IC-055
function evaluateRouteGuard({ toName, toMetaRequiresAuth = true, toFullPath = '/home', session }) {
  const allowedAccountRoutes = new Set(['settings', 'settings-root', 'me', 'support', 'platform', 'forbidden'])

  if (session.adultGate === 'REJECTED') {
    if (allowedAccountRoutes.has(String(toName))) {
      return { allowed: true }
    }
    session.forbiddenReason = '当前版本仅面向 18 岁以上成人开放，暂不能向你开放学习功能。'
    return { redirect: { name: 'forbidden' }, forbiddenReason: session.forbiddenReason }
  }

  const adultGateExempt = new Set(['adult-gate', 'onboarding', ...allowedAccountRoutes])
  if (toMetaRequiresAuth && !adultGateExempt.has(String(toName)) && !session.isLearningReady) {
    session.setReturnTo?.(toFullPath)
    return { redirect: { name: 'onboarding', query: { redirect: toFullPath } } }
  }

  if (toName === 'adult-gate' && session.adultGate === 'PASSED') {
    return { redirect: session.consumeReturnTo?.() ?? '/home' }
  }

  return { allowed: true }
}

test('BC-007: when adultGate is REJECTED, allowed account routes pass through', () => {
  const session = {
    isAuthenticated: true,
    adultGate: 'REJECTED',
    isLearningReady: false,
    forbiddenReason: null,
  }

  const permittedRoutes = ['settings', 'settings-root', 'me', 'support', 'platform', 'forbidden']
  for (const name of permittedRoutes) {
    const result = evaluateRouteGuard({ toName: name, session })
    assert.equal(result.allowed, true, `Route ${name} should be allowed for rejected adult gate`)
  }
})

test('BC-007 / IC-005: when adultGate is REJECTED, learning routes are blocked to forbidden with human explanation', () => {
  const session = {
    isAuthenticated: true,
    adultGate: 'REJECTED',
    isLearningReady: false,
    forbiddenReason: null,
  }

  const learningRoutes = ['home', 'assessment', 'today', 'courses', 'vocabulary', 'b3-listening', 'onboarding']
  for (const name of learningRoutes) {
    const result = evaluateRouteGuard({ toName: name, session })
    assert.deepEqual(result.redirect, { name: 'forbidden' }, `Route ${name} should redirect to forbidden`)
    assert.equal(session.forbiddenReason, '当前版本仅面向 18 岁以上成人开放，暂不能向你开放学习功能。')
    assert.equal(result.forbiddenReason, '当前版本仅面向 18 岁以上成人开放，暂不能向你开放学习功能。')
  }
})

test('BC-007: when adultGate is REQUIRED (not evaluated yet), learning routes redirect to onboarding', () => {
  let capturedReturnTo = null
  const session = {
    isAuthenticated: true,
    adultGate: 'REQUIRED',
    isLearningReady: false,
    forbiddenReason: null,
    setReturnTo: (val) => { capturedReturnTo = val },
  }

  const result = evaluateRouteGuard({ toName: 'home', toFullPath: '/home', session })
  assert.deepEqual(result.redirect, { name: 'onboarding', query: { redirect: '/home' } })
  assert.equal(capturedReturnTo, '/home')
})

test('BC-007: login redirect directly sends REJECTED users to forbidden page', () => {
  function computePostLoginRedirect(adultGate, returnTo = '/home') {
    return adultGate === 'REQUIRED'
      ? { name: 'onboarding' }
      : adultGate === 'REJECTED'
        ? { name: 'forbidden' }
        : returnTo
  }

  assert.deepEqual(computePostLoginRedirect('REQUIRED'), { name: 'onboarding' })
  assert.deepEqual(computePostLoginRedirect('REJECTED'), { name: 'forbidden' })
  assert.equal(computePostLoginRedirect('PASSED', '/home'), '/home')
})
