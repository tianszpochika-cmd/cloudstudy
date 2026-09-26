import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')
const requirePackage = createRequire(import.meta.url)
const vue = requirePackage('vue')

function loadApi(client) {
  const source = fs.readFileSync(path.join(appRoot, 'src/api/notifications.ts'), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  let id = 0
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (name === './client') return { apiClient: client }
    if (name === '../platform/client-id') return { createClientId: (prefix) => `${prefix}-${++id}` }
    throw new Error(`unexpected import: ${name}`)
  }, module, module.exports)
  return module.exports
}

function mountPanel(api, identity = { accessToken: 'A-token', subject: 'A', generation: 1, authenticated: true },
  session = vue.reactive({ authGeneration: 1, status: 'authenticated', principal: { subject: 'A' },
    permissions: ['notification.preference.read.self', 'notification.preference.write.self'] })) {
  const source = fs.readFileSync(path.join(appRoot, 'src/components/NotificationPreferencesPanel.vue'), 'utf8')
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script)
  const compiled = ts.transpileModule(script, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const mounted = []
  const scope = vue.effectScope()
  const runtimeVue = { ...vue, onMounted: (callback) => mounted.push(callback) }
  const module = { exports: {} }
  scope.run(() => {
    new Function('require', 'module', 'exports', `${compiled}\nmodule.exports.__test = { preferences, state, savingKey, notice, noticeTone, startLocalTime, endLocalTime, dndEnabled, dndMixed, dndDirty, activeRows, options, isEnabled, isNoDnd, savePreference, saveDnd };`)(name => {
      if (name === 'vue') return runtimeVue
      if (name === '../api/notifications') return api
      if (name === '../platform/experience-ui') return { useExperienceText: () => key => `experience.${key}` }
      if (name === '../auth/access-token') return { getInMemoryAuthSnapshot: () => ({ ...identity }) }
      if (name === '../stores/session') return { useSessionStore: () => session }
      throw new Error(`unexpected import: ${name}`)
    }, module, module.exports)
  })
  return {
    state: module.exports.__test,
    session,
    mount: async () => { for (const callback of mounted) await callback() },
    dispose: () => scope.stop(),
  }
}

function preference(overrides = {}) {
  return {
    category: 'LEARNING',
    channel: 'IN_APP',
    enabled: true,
    locale: 'zh-CN',
    consentVersion: 1,
    dndWindow: { startLocalTime: '22:00', endLocalTime: '07:00', timezone: 'Asia/Shanghai' },
    frequencyPolicy: 'IMMEDIATE',
    version: 4,
    updatedAt: '2026-09-25T10:00:00Z',
    ...overrides,
  }
}

test('preference list follows cursor pages and reads canonical data/meta rows', async () => {
  const paths = []
  const client = {
    get: async (url) => {
      paths.push(url)
      if (paths.length === 1) return { data: [preference()], meta: { hasMore: true, nextCursor: 'cursor-2' } }
      return { data: [preference({ category: 'REVIEW', channel: 'PUSH', version: 1 })], meta: { hasMore: false, nextCursor: null } }
    },
  }
  const api = loadApi(client)

  const rows = await api.listNotificationPreferences()

  assert.equal(paths.length, 2)
  assert.match(paths[0], /pageSize=100/)
  assert.match(paths[1], /cursor=cursor-2/)
  assert.deepEqual(rows.map((row) => `${row.category}:${row.channel}`), ['LEARNING:IN_APP', 'REVIEW:PUSH'])
})

test('preference update sends the owner CAS shape and preserves an existing quiet window', async () => {
  let request
  const client = {
    put: async (url, body, options) => {
      request = { url, body, options }
      return { data: preference({ enabled: false, frequencyPolicy: 'DISABLED', version: 8 }) }
    },
  }
  const api = loadApi(client)
  const existing = preference({ version: 7 })

  const saved = await api.setNotificationPreference({ category: 'LEARNING', channel: 'PUSH', enabled: false, existing })

  assert.equal(request.url, '/notifications/preferences/LEARNING/PUSH')
  assert.deepEqual(request.body, {
    category: 'LEARNING',
    enabled: false,
    locale: 'zh-CN',
    consentVersion: 1,
    dndWindow: { startLocalTime: '22:00', endLocalTime: '07:00' },
    frequencyPolicy: 'DISABLED',
    expectedVersion: 7,
  })
  assert.equal(request.options.headers['Idempotency-Key'], 'notif-pref-1')
  assert.equal(saved.version, 8)
})

test('new SMS preferences use an allow-listed purpose, default off-sentinel, and immediate delivery only after opt-in', async () => {
  let request
  const api = loadApi({
    put: async (url, body, options) => {
      request = { url, body, options }
      return { data: preference({ category: 'ACCOUNT', channel: 'SMS', enabled: true, version: 1 }) }
    },
  })

  await api.setNotificationPreference({ category: 'ACCOUNT', channel: 'SMS', enabled: true })

  assert.equal(request.url, '/notifications/preferences/ACCOUNT_VERIFICATION/SMS')
  assert.deepEqual(request.body.dndWindow, { startLocalTime: '00:00', endLocalTime: '00:00' })
  assert.equal(request.body.frequencyPolicy, 'IMMEDIATE')
  assert.equal(request.body.expectedVersion, 0)
  assert.equal(request.body.consentVersion, 1)
  assert.notEqual(request.body.consentVersion, undefined, 'version is required metadata, not proof of consent')
})

test('SMS preferences reject categories without a purpose mapping before sending a request', async () => {
  let writes = 0
  const api = loadApi({ put: async () => { writes += 1; throw new Error('unexpected request') } })

  await assert.rejects(api.setNotificationPreference({ category: 'MARKETING', channel: 'SMS', enabled: true }))
  assert.equal(writes, 0)
})

test('settings panel defaults every absent choice off and keeps DND as a separate explicit action', async () => {
  const rows = []
  const writes = []
  const client = {
    get: async () => ({ data: rows, meta: { hasMore: false, nextCursor: null } }),
    put: async (url, body) => {
      writes.push({ url, body })
      const channel = url.split('/').at(-1)
      const current = rows.find((row) => row.category === body.category && row.channel === channel)
      const next = preference({
        category: body.category,
        channel,
        enabled: body.enabled,
        consentVersion: body.consentVersion,
        dndWindow: { ...body.dndWindow, timezone: 'Asia/Shanghai' },
        frequencyPolicy: body.frequencyPolicy,
        version: (current?.version ?? 0) + 1,
      })
      const index = rows.findIndex((row) => row.category === next.category && row.channel === next.channel)
      if (index < 0) rows.push(next)
      else rows[index] = next
      return { data: next }
    },
  }
  const api = loadApi(client)
  const panel = mountPanel(api)
  await panel.mount()

  assert.equal(panel.state.isEnabled('LEARNING', 'IN_APP'), false)
  assert.equal(panel.state.options.value.length, 14)
  assert.deepEqual(panel.state.options.value.find((item) => item.code === 'LEARNING').channels.map((channel) => channel.code), ['IN_APP'])
  assert.equal(panel.state.options.value.find((item) => item.code === 'LEARNING').label, 'experience.notificationPreferences.categories.learning')
  assert.equal(panel.state.isNoDnd({ startLocalTime: '21:15', endLocalTime: '21:15', timezone: 'Asia/Shanghai' }), true)

  await panel.state.savePreference('LEARNING', 'IN_APP', true)
  assert.equal(rows[0].enabled, true)
  assert.equal(writes[0].body.dndWindow.startLocalTime, '00:00')
  assert.equal(writes[0].body.dndWindow.endLocalTime, '00:00')
  assert.equal(writes[0].body.frequencyPolicy, 'IMMEDIATE')
  assert.equal(panel.state.dndEnabled.value, false)

  panel.state.dndEnabled.value = true
  await panel.state.saveDnd()
  assert.equal(writes[1].body.dndWindow.startLocalTime, '22:00')
  assert.equal(writes[1].body.dndWindow.endLocalTime, '07:00')
  assert.equal(panel.state.dndEnabled.value, true)
  panel.dispose()
})

test('notification settings route stays in the exclusive SettingsPage section chain', () => {
  const settings = fs.readFileSync(path.join(appRoot, 'src/pages/SettingsPage.vue'), 'utf8')
  assert.match(settings, /<article v-if="section === 'notifications'/)
  assert.match(settings, /<article v-else-if="section === 'profile'/)
  assert.match(settings, /<article v-else-if="section === 'privacy'/)
  assert.match(settings, /<article v-else class="form-card"/)
})

test('a lost save response confirms the owner state and reloads its version before the next edit', async () => {
  const rows = [preference({ enabled: false, frequencyPolicy: 'DISABLED', version: 1 })]
  const versions = []
  let first = true
  const api = loadApi({
    get: async () => ({ data: rows, meta: { hasMore: false, nextCursor: null } }),
    put: async (_url, body) => {
      versions.push(body.expectedVersion)
      rows[0] = preference({ enabled: body.enabled, frequencyPolicy: body.frequencyPolicy,
        dndWindow: { ...body.dndWindow, timezone: 'Asia/Shanghai' }, version: rows[0].version + 1 })
      if (first) { first = false; throw new Error('response lost after commit') }
      return { data: rows[0] }
    },
  })
  const panel = mountPanel(api)
  await panel.mount()
  await panel.state.savePreference('LEARNING', 'IN_APP', true)
  assert.equal(panel.state.state.value, 'ready')
  assert.equal(panel.state.preferences.value[0].version, 2)
  assert.equal(panel.state.noticeTone.value, 'success')
  await panel.state.savePreference('LEARNING', 'IN_APP', false)
  assert.deepEqual(versions, [1, 2])
  panel.dispose()
})

test('an uncertain save stays uncertain when the owner row does not match the intended state', async () => {
  const rows = [preference({ enabled: false, frequencyPolicy: 'DISABLED', version: 1 })]
  const api = loadApi({
    get: async () => ({ data: rows, meta: { hasMore: false, nextCursor: null } }),
    put: async () => { throw new Error('request failed before commit') },
  })
  const panel = mountPanel(api)
  await panel.mount()
  await panel.state.savePreference('LEARNING', 'IN_APP', true)
  assert.equal(panel.state.noticeTone.value, 'error')
  assert.equal(panel.state.preferences.value[0].version, 1)
  assert.equal(panel.state.isEnabled('LEARNING', 'IN_APP'), false)
  panel.dispose()
})

test('quiet hours do not modify hidden external-channel preferences', async () => {
  const rows = [
    preference({ channel: 'IN_APP', dndWindow: { ...apiOffWindow(), timezone: 'Asia/Shanghai' } }),
    preference({ channel: 'PUSH', version: 9, dndWindow: { startLocalTime: '20:00', endLocalTime: '05:00', timezone: 'Asia/Shanghai' } }),
  ]
  const writes = []
  const api = loadApi({
    get: async () => ({ data: rows, meta: { hasMore: false, nextCursor: null } }),
    put: async (url, body) => {
      writes.push(url)
      rows[0] = preference({ ...rows[0], version: rows[0].version + 1, dndWindow: { ...body.dndWindow, timezone: 'Asia/Shanghai' } })
      return { data: rows[0] }
    },
  })
  const panel = mountPanel(api)
  await panel.mount()
  assert.deepEqual(panel.state.activeRows.value.map((row) => row.channel), ['IN_APP'])
  assert.equal(panel.state.dndEnabled.value, false)
  assert.equal(panel.state.dndMixed.value, false)
  panel.state.dndEnabled.value = true
  await panel.state.saveDnd()
  assert.deepEqual(writes, ['/notifications/preferences/LEARNING/IN_APP'])
  assert.equal(rows[1].version, 9)
  panel.dispose()
})

test('quiet-hours batch stops before writing another account after an identity switch', async () => {
  const identity = { accessToken: 'A-token', subject: 'A', generation: 1, authenticated: true }
  const rows = [preference({ category: 'LEARNING' }), preference({ category: 'REVIEW' })]
  let writes = 0
  const api = loadApi({
    get: async () => ({ data: rows, meta: { hasMore: false, nextCursor: null } }),
    put: async () => {
      writes += 1
      identity.subject = 'B'
      identity.generation += 1
      return { data: rows[0] }
    },
  })
  const panel = mountPanel(api, identity)
  await panel.mount()
  panel.state.dndEnabled.value = false
  await panel.state.saveDnd()
  assert.equal(writes, 1)
  assert.equal(panel.state.state.value, 'error')
  assert.deepEqual(panel.state.preferences.value, [])
  panel.dispose()
})

test('idle notification preferences clear as soon as logout invalidates the session', async () => {
  const identity = { accessToken: 'A-token', subject: 'A', generation: 1, authenticated: true }
  const api = loadApi({ get: async () => ({ data: [preference()], meta: { hasMore: false, nextCursor: null } }) })
  const panel = mountPanel(api, identity)
  await panel.mount()
  assert.equal(panel.state.preferences.value.length, 1)
  identity.authenticated = false
  identity.subject = null
  panel.session.status = 'revoking'
  panel.session.principal = null
  panel.session.permissions = []
  panel.session.authGeneration += 1
  await vue.nextTick()
  assert.deepEqual(panel.state.preferences.value, [])
  assert.equal(panel.state.state.value, 'error')
  panel.dispose()
})

test('revoking preference read permission clears an idle settings panel', async () => {
  const api = loadApi({ get: async () => ({ data: [preference()], meta: { hasMore: false, nextCursor: null } }) })
  const panel = mountPanel(api)
  await panel.mount()
  assert.equal(panel.state.preferences.value.length, 1)
  panel.session.permissions = ['notification.preference.write.self']
  await vue.nextTick()
  assert.deepEqual(panel.state.preferences.value, [])
  assert.equal(panel.state.state.value, 'error')
  panel.dispose()
})

test('quiet-hours save does not report success when owner readback still has the old hours', async () => {
  const rows = [preference({ dndWindow: { ...apiOffWindow(), timezone: 'Asia/Shanghai' } })]
  const api = loadApi({
    get: async () => ({ data: rows, meta: { hasMore: false, nextCursor: null } }),
    put: async (_url, body) => ({ data: preference({ version: 5, dndWindow: { ...body.dndWindow, timezone: 'Asia/Shanghai' } }) }),
  })
  const panel = mountPanel(api)
  await panel.mount()
  panel.state.dndEnabled.value = true
  await panel.state.saveDnd()
  assert.equal(panel.state.noticeTone.value, 'error')
  assert.equal(panel.state.dndDirty.value, true)
  assert.equal(panel.state.state.value, 'ready')
  panel.dispose()
})

test('a partial quiet-hours save retains the requested hours for a direct retry', async () => {
  const rows = [
    preference({ category: 'LEARNING', version: 1, dndWindow: { ...apiOffWindow(), timezone: 'Asia/Shanghai' } }),
    preference({ category: 'REVIEW', version: 1, dndWindow: { ...apiOffWindow(), timezone: 'Asia/Shanghai' } }),
  ]
  let failFirst = true
  const writes = []
  const api = loadApi({
    get: async () => ({ data: rows, meta: { hasMore: false, nextCursor: null } }),
    put: async (_url, body) => {
      writes.push(body.dndWindow)
      if (failFirst) { failFirst = false; throw new Error('temporary failure') }
      const index = rows.findIndex(row => row.category === body.category)
      rows[index] = preference({ ...rows[index], dndWindow: { ...body.dndWindow, timezone: 'Asia/Shanghai' }, version: rows[index].version + 1 })
      return { data: rows[index] }
    },
  })
  const panel = mountPanel(api)
  await panel.mount()
  panel.state.dndEnabled.value = true
  panel.state.startLocalTime.value = '21:30'
  panel.state.endLocalTime.value = '06:45'
  await panel.state.saveDnd()
  assert.equal(panel.state.state.value, 'ready')
  assert.equal(panel.state.dndEnabled.value, true)
  assert.equal(panel.state.startLocalTime.value, '21:30')
  assert.equal(panel.state.endLocalTime.value, '06:45')
  assert.equal(panel.state.dndDirty.value, true)
  await panel.state.saveDnd()
  assert.equal(panel.state.dndDirty.value, false)
  assert.ok(writes.every(window => window.startLocalTime === '21:30' && window.endLocalTime === '06:45'))
  panel.dispose()
})

function apiOffWindow() { return { startLocalTime: '00:00', endLocalTime: '00:00' } }
