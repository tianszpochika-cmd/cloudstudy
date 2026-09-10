import net from 'node:net'
import path from 'node:path'
import { spawn } from 'node:child_process'

import { assertSafeEvidence, safeFailure } from './m2-runtime-lib.mjs'

export const BROWSER_EVIDENCE_SCHEMA = 'm2.gateway.browser-evidence.v1'

export const BROWSER_PROFILES = Object.freeze({
  learner: { port: 18180, browserHost: '127.0.0.1' },
  official: { port: 18182, browserHost: '127.0.0.1' },
  unknown: { port: 18182, browserHost: 'localhost' },
})

export const BROWSER_CASE_IDS = Object.freeze([
  'browser-learner-jwks-and-correlation',
  'browser-learner-register-httponly-refresh-grant',
  'browser-forged-authority-headers-preflight-denied',
  'browser-principal-authority-headers-ignored',
  'browser-learner-credentialed-refresh',
  'browser-refresh-origin-referer-conflict',
  'browser-refresh-referer-fallback',
  'browser-refresh-untrusted-referer',
  'browser-official-jwks-public-read-only',
  'browser-official-business-session-blocked',
  'browser-unknown-origin-blocked',
])

export const REFRESH_REWRITE_MODES = Object.freeze([
  'KEEP_ORIGIN_UNTRUSTED_REFERER',
  'DROP_ORIGIN_TRUSTED_REFERER',
  'DROP_ORIGIN_UNTRUSTED_REFERER',
])

const UNTRUSTED_REFERER = 'https://untrusted.invalid/learner'
const LEARNER_REFERER = 'http://127.0.0.1:18180/'
const FORGED_AUTHORITY_HEADERS = Object.freeze([
  ['x-b5-role', 'admin'],
  ['x-role', 'admin'],
  ['x-tenant-id', 'forged-tenant'],
  ['x-owner-id', 'forged-owner'],
])

export function planHeaderRewrite(mode, headers) {
  if (!REFRESH_REWRITE_MODES.includes(mode) && mode !== 'FORGE_AUTHORITY') {
    throw safeFailure('BROWSER_REWRITE_MODE', 'unknown browser header rewrite mode')
  }
  const planned = (Array.isArray(headers) ? headers : [])
    .filter((header) => header && typeof header.name === 'string')
    .map((header) => ({ name: header.name, value: String(header.value ?? '') }))
  const find = (name) => planned.find((header) => header.name.toLowerCase() === name)
  const remove = (name) => {
    for (let index = planned.length - 1; index >= 0; index -= 1) {
      if (planned[index].name.toLowerCase() === name) planned.splice(index, 1)
    }
  }
  const set = (name, value) => {
    const existing = find(name)
    if (existing) existing.value = value
    else planned.push({ name, value })
  }
  if (mode === 'FORGE_AUTHORITY') {
    for (const [name, value] of FORGED_AUTHORITY_HEADERS) set(name, value)
    return planned
  }
  if (mode === 'KEEP_ORIGIN_UNTRUSTED_REFERER') {
    set('referer', UNTRUSTED_REFERER)
    return planned
  }
  remove('origin')
  set('referer', mode === 'DROP_ORIGIN_TRUSTED_REFERER' ? LEARNER_REFERER : UNTRUSTED_REFERER)
  return planned
}

function check(condition, code, message) {
  if (!condition) throw safeFailure(code, message)
}

function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.once('error', () => reject(safeFailure('BROWSER_FIXTURE_PORT', `the registered browser fixture port ${port} is occupied`)))
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => server.close(resolve))
  })
}

function waitForPort(port, child) {
  const deadline = Date.now() + 10000
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (child.exitCode !== null || child.signalCode !== null) {
        reject(safeFailure('BROWSER_FIXTURE_EXIT', 'the browser fixture server exited before readiness'))
        return
      }
      const socket = net.createConnection({ host: '127.0.0.1', port })
      socket.once('connect', () => {
        socket.destroy()
        resolve()
      })
      socket.once('error', () => {
        socket.destroy()
        if (Date.now() >= deadline) {
          reject(safeFailure('BROWSER_FIXTURE_TIMEOUT', 'the browser fixture server did not become ready'))
          return
        }
        setTimeout(attempt, 150)
      })
    }
    attempt()
  })
}

async function stopFixture(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 5000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
    child.kill('SIGTERM')
  })
}

async function openProfile({ chromium, fixtureServerPath, profile, run }) {
  const { port, browserHost } = BROWSER_PROFILES[profile]
  await assertPortFree(port)
  const child = spawn(process.execPath, [fixtureServerPath, profile], {
    cwd: path.dirname(fixtureServerPath),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  child.stdout.resume()
  child.stderr.resume()
  try {
    await waitForPort(port, child)
    const browser = await chromium.launch({ channel: 'msedge', headless: true })
    try {
      const context = await browser.newContext()
      try {
        const page = await context.newPage()
        await page.goto(`http://${browserHost}:${port}/`, { waitUntil: 'domcontentloaded' })
        return await run(page, context)
      } finally {
        await context.close()
      }
    } finally {
      await browser.close()
    }
  } finally {
    await stopFixture(child)
  }
}

async function learnerProfile(chromium, fixtureServerPath, gatewayOrigin, checks, auditRequirements) {
  return openProfile({
    chromium,
    fixtureServerPath,
    profile: 'learner',
    run: async (page, context) => {
      const jwks = await page.evaluate(async ({ gateway }) => {
        try {
          const response = await fetch(`${gateway}/api/v1/auth/jwks`, {
            headers: { 'x-request-id': crypto.randomUUID() },
          })
          return {
            status: response.status,
            requestId: response.headers.get('x-request-id'),
            traceId: response.headers.get('x-trace-id'),
          }
        } catch {
          return { status: 0, requestId: null, traceId: null }
        }
      }, { gateway: gatewayOrigin })
      check(jwks.status === 200 && jwks.requestId && jwks.traceId
        && !jwks.requestId.includes(',') && !jwks.traceId.includes(','),
      'BROWSER_JWKS', 'the learner origin did not read the public JWKS with exposed correlation headers')
      checks.push({ id: 'browser-learner-jwks-and-correlation', result: 'PASS', status: jwks.status, exposedCorrelation: true })

      const identifier = `m2-browser-${Date.now()}-${crypto.randomUUID().slice(0, 8)}@local.invalid`
      const password = `${crypto.randomUUID().replaceAll('-', '')}Aa9!`
      const registered = await page.evaluate(async ({ gateway, identifier, password }) => {
        try {
          const response = await fetch(`${gateway}/api/v1/auth/register`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'content-type': 'application/json',
              'idempotency-key': `m2-browser-register-${crypto.randomUUID()}`,
              'x-auth-transport': 'WEB_COOKIE',
            },
            body: JSON.stringify({
              identifier,
              password,
              device: { deviceType: 'WEB', deviceName: 'm2-browser', clientVersion: 'm2-browser' },
            }),
          })
          const body = await response.json().catch(() => null)
          const access = body?.data?.accessToken
          if (typeof access === 'string' && access.split('.').length === 3) {
            window.__m2Access = access
          }
          return { status: response.status, sessionIssued: typeof access === 'string' }
        } catch {
          return { status: 0, sessionIssued: false }
        }
      }, { gateway: gatewayOrigin, identifier, password })
      check(registered.status === 201 && registered.sessionIssued,
        'BROWSER_REGISTER', 'the learner origin did not complete registration')

      const grants = await context.cookies()
      const refreshGrant = grants.find((item) => item.name === 'yuxuexing_refresh')
      check(refreshGrant?.httpOnly === true,
        'BROWSER_REFRESH_GRANT', 'the refresh grant is not browser-inaccessible')
      const scriptVisible = await page.evaluate(() => document.cookie.includes('yuxuexing_refresh'))
      check(scriptVisible === false, 'BROWSER_REFRESH_GRANT_SCRIPT', 'page script could read the refresh grant')
      checks.push({ id: 'browser-learner-register-httponly-refresh-grant', result: 'PASS', status: registered.status, refreshGrantHttpOnly: true, scriptReadable: false })

      const forgedBlocked = await page.evaluate(async ({ gateway }) => {
        try {
          await fetch(`${gateway}/api/v1/iam/principal/me`, {
            headers: {
              'x-b5-role': 'admin',
              'x-role': 'admin',
              'x-tenant-id': 'forged-tenant',
              'x-owner-id': 'forged-owner',
            },
          })
          return false
        } catch {
          return true
        }
      }, { gateway: gatewayOrigin })
      check(forgedBlocked === true,
        'BROWSER_FORGED_AUTHORITY_PREFLIGHT', 'forged authority headers were transportable from a browser origin')
      checks.push({ id: 'browser-forged-authority-headers-preflight-denied', result: 'PASS', transportDenied: true })

      const client = await context.newCDPSession(page)
      const interception = { principal: 'FORGE_AUTHORITY', refresh: null }
      const wireRefreshStatuses = []
      await client.send('Fetch.enable', {
        patterns: [
          { urlPattern: '*iam/principal/me*', requestStage: 'Request' },
          { urlPattern: '*token/refresh*', requestStage: 'Request' },
          { urlPattern: '*token/refresh*', requestStage: 'Response' },
        ],
      })
      client.on('Fetch.requestPaused', async (event) => {
        try {
          if (event.responseStatusCode !== undefined) {
            if (event.request?.method === 'POST') wireRefreshStatuses.push(event.responseStatusCode)
            try {
              await client.send('Fetch.continueResponse', { requestId: event.requestId })
            } catch {
              await client.send('Fetch.continueRequest', { requestId: event.requestId })
            }
            return
          }
          const url = event.request.url
          const originalHeaders = Object.entries(event.request.headers ?? {})
            .map(([name, value]) => ({ name, value: String(value) }))
          if (interception.principal && event.request.method === 'GET' && url.includes('/iam/principal/me')) {
            const headers = planHeaderRewrite(interception.principal, originalHeaders)
            await client.send('Fetch.continueRequest', { requestId: event.requestId, headers })
            return
          }
          if (interception.refresh && event.request.method === 'POST' && url.includes('/token/refresh')) {
            const headers = planHeaderRewrite(interception.refresh, originalHeaders)
            await client.send('Fetch.continueRequest', { requestId: event.requestId, headers })
            return
          }
          await client.send('Fetch.continueRequest', { requestId: event.requestId })
        } catch {
          // The paused request is released when the page or session closes.
        }
      })

      const principal = await page.evaluate(async ({ gateway }) => {
        try {
          const response = await fetch(`${gateway}/api/v1/iam/principal/me`, {
            headers: { authorization: `Bearer ${window.__m2Access ?? ''}` },
          })
          const body = await response.json().catch(() => null)
          const data = body?.data ?? body
          return {
            status: response.status,
            serverDerivedRoles: Array.isArray(data?.roles) ? data.roles : [],
            serverDerivedTenant: typeof data?.tenantId === 'string' ? data.tenantId : null,
          }
        } catch {
          return { status: 0, serverDerivedRoles: [], serverDerivedTenant: null }
        }
      }, { gateway: gatewayOrigin })
      check(principal.status === 200 && principal.serverDerivedTenant === 'platform'
        && principal.serverDerivedRoles.length > 0 && !principal.serverDerivedRoles.includes('admin'),
      'BROWSER_AUTHORITY_BOUNDARY', 'forged authority headers changed the server-derived principal')
      checks.push({ id: 'browser-principal-authority-headers-ignored', result: 'PASS', status: principal.status, serverDerived: true })

      const refresh = async () => {
        const result = await page.evaluate(async ({ gateway }) => {
          try {
            const response = await fetch(`${gateway}/api/v1/auth/token/refresh`, {
              method: 'POST',
              credentials: 'include',
              headers: {
                'content-type': 'application/json',
                'idempotency-key': `m2-browser-refresh-${crypto.randomUUID()}`,
                'x-auth-transport': 'WEB_COOKIE',
              },
              body: JSON.stringify({}),
            })
            return { status: response.status }
          } catch {
            return { status: 0 }
          }
        }, { gateway: gatewayOrigin })
        await page.waitForTimeout(250)
        return {
          status: result.status,
          wireStatus: wireRefreshStatuses.length > 0 ? wireRefreshStatuses[wireRefreshStatuses.length - 1] : null,
        }
      }

      const natural = await refresh()
      check(natural.status === 200, 'BROWSER_REFRESH', 'a browser-origin credentialed refresh did not succeed')
      checks.push({ id: 'browser-learner-credentialed-refresh', result: 'PASS', status: natural.status })

      interception.refresh = 'KEEP_ORIGIN_UNTRUSTED_REFERER'
      const conflict = await refresh()
      check(conflict.status === 403 && conflict.wireStatus === 403,
        'BROWSER_ORIGIN_REFERER_CONFLICT', 'origin/referer conflict was not denied')
      checks.push({ id: 'browser-refresh-origin-referer-conflict', result: 'PASS', status: conflict.status, wireStatus: conflict.wireStatus })
      auditRequirements.push({ checkId: 'browser-refresh-origin-referer-conflict', status: conflict.wireStatus, reasonCode: 'origin_referer_conflict' })

      interception.refresh = 'DROP_ORIGIN_TRUSTED_REFERER'
      const fallback = await refresh()
      check(fallback.wireStatus === 200, 'BROWSER_REFERER_FALLBACK', 'the trusted Referer fallback was not accepted')
      checks.push({
        id: 'browser-refresh-referer-fallback',
        result: 'PASS',
        status: fallback.status,
        wireStatus: fallback.wireStatus,
        browserVisible: fallback.status === 200 ? 'RESPONSE_VISIBLE' : 'BROWSER_BLOCKED_WITHOUT_ORIGIN',
      })

      interception.refresh = 'DROP_ORIGIN_UNTRUSTED_REFERER'
      const untrusted = await refresh()
      check(untrusted.wireStatus === 403, 'BROWSER_UNTRUSTED_REFERER', 'an untrusted Referer without Origin was not denied')
      checks.push({ id: 'browser-refresh-untrusted-referer', result: 'PASS', status: untrusted.status, wireStatus: untrusted.wireStatus })
      auditRequirements.push({ checkId: 'browser-refresh-untrusted-referer', status: untrusted.wireStatus, reasonCode: 'credentialed_referer_untrusted' })
      interception.refresh = null
      await client.send('Fetch.disable')
    },
  })
}

async function officialProfile(chromium, fixtureServerPath, gatewayOrigin, checks) {
  return openProfile({
    chromium,
    fixtureServerPath,
    profile: 'official',
    run: async (page, context) => {
      const jwks = await page.evaluate(async ({ gateway }) => {
        try {
          const response = await fetch(`${gateway}/api/v1/auth/jwks`, {
            headers: { 'x-request-id': crypto.randomUUID() },
          })
          return { status: response.status }
        } catch {
          return { status: 0 }
        }
      }, { gateway: gatewayOrigin })
      check(jwks.status === 200, 'BROWSER_OFFICIAL_JWKS', 'the official origin could not read the public JWKS')
      checks.push({ id: 'browser-official-jwks-public-read-only', result: 'PASS', status: jwks.status })

      const businessBlocked = await page.evaluate(async ({ gateway }) => {
        try {
          await fetch(`${gateway}/api/v1/auth/register`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'content-type': 'application/json',
              'idempotency-key': `m2-browser-official-${crypto.randomUUID()}`,
              'x-auth-transport': 'WEB_COOKIE',
            },
            body: JSON.stringify({
              identifier: 'm2-official-blocked@local.invalid',
              password: `${crypto.randomUUID().replaceAll('-', '')}Aa9!`,
              device: { deviceType: 'WEB', clientVersion: 'm2-browser' },
            }),
          })
          return false
        } catch {
          return true
        }
      }, { gateway: gatewayOrigin })
      check(businessBlocked === true, 'BROWSER_OFFICIAL_SESSION', 'the official origin completed a business-session request')
      const grants = await context.cookies()
      check(!grants.some((item) => item.name === 'yuxuexing_refresh'),
        'BROWSER_OFFICIAL_GRANT', 'the official origin received a business refresh grant')
      checks.push({ id: 'browser-official-business-session-blocked', result: 'PASS', transportDenied: true, refreshGrantIssued: false })
    },
  })
}

async function unknownProfile(chromium, fixtureServerPath, gatewayOrigin, checks, auditRequirements) {
  return openProfile({
    chromium,
    fixtureServerPath,
    profile: 'unknown',
    run: async (page) => {
      const blocked = await page.evaluate(async ({ gateway }) => {
        try {
          await fetch(`${gateway}/api/v1/auth/jwks`, {
            headers: { 'x-request-id': crypto.randomUUID() },
          })
          return false
        } catch {
          return true
        }
      }, { gateway: gatewayOrigin })
      check(blocked === true, 'BROWSER_UNKNOWN_ORIGIN', 'an unregistered literal origin was able to read the gateway')
      checks.push({ id: 'browser-unknown-origin-blocked', result: 'PASS', transportDenied: true })
      auditRequirements.push({ checkId: 'browser-unknown-origin-blocked', status: 403, reasonCode: 'cors_origin_forbidden' })
    },
  })
}

export async function runBrowserChecks({ gatewayOrigin, fixtureServerPath, checks, auditRequirements }) {
  let chromium
  try {
    ({ chromium } = await import('playwright'))
  } catch {
    throw safeFailure('BROWSER_RUNNER_UNAVAILABLE', 'the Playwright browser runner is not installed')
  }
  await learnerProfile(chromium, fixtureServerPath, gatewayOrigin, checks, auditRequirements)
  await officialProfile(chromium, fixtureServerPath, gatewayOrigin, checks)
  await unknownProfile(chromium, fixtureServerPath, gatewayOrigin, checks, auditRequirements)
  const executed = checks.filter((item) => item.id.startsWith('browser-')).map((item) => item.id)
  for (const id of BROWSER_CASE_IDS) {
    check(executed.includes(id), 'BROWSER_CASE_MISSING', `the browser batch did not execute ${id}`)
  }
  assertSafeEvidence({ checks: checks.filter((item) => item.id.startsWith('browser-')), auditRequirements })
  return Object.freeze({
    schema: BROWSER_EVIDENCE_SCHEMA,
    executable: 'PLAYWRIGHT_SYSTEM_EDGE_CDP',
    fixture: 'browser-fixture-server.mjs',
    caseCount: BROWSER_CASE_IDS.length,
    cases: BROWSER_CASE_IDS,
  })
}
