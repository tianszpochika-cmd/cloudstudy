import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { compileScript, parse } from 'vue/compiler-sfc'
import * as Vue from 'vue'
import { nextTick, reactive } from 'vue'

const root = path.resolve(import.meta.dirname, '..')

function deferred() {
  let resolve
  let reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

function profile(subjectId) {
  return {
    profile: {
      version: subjectId === 'learner-a' ? 3 : 7,
      goal: { type: subjectId === 'learner-a' ? 'FOUNDATION' : 'WORKPLACE', dailyMinutes: 15 },
      preferences: { uiLocale: 'zh-CN', contentLocale: 'en-US', themeMode: 'SYSTEM' },
    },
  }
}

function harness() {
  const pending = new Map()
  const pendingSearch = new Map()
  const commands = []
  const notices = []
  const session = reactive({
    sessionId: 'session-1',
    principal: { subject: 'staff-1' },
    permissions: ['admin.learner.read', 'admin.learner.write', 'admin.learning.read', 'admin.learning.write', 'admin.assessment.read'],
    isAuthenticated: true,
    can(permission) { return this.permissions.includes(permission) },
  })
  let confirmation = Promise.resolve()
  const api = {
    searchLearners: async (query, _pageSize, cursor) => pendingSearch.get(`${query}:${cursor ?? ''}`)?.promise
      ?? { subjects: [], nextCursor: null, hasMore: false },
    getLearnerProfile: (subjectId) => pending.get(subjectId)?.promise ?? Promise.resolve(profile(subjectId)),
    getLearnerPlans: async (subjectId) => ({ subjectId }),
    getLearnerSrs: async (subjectId) => ({ subjectId, due: [{ item_id: `${subjectId}-item` }] }),
    getLearnerAssessments: async (subjectId) => ({ subjectId }),
    setLearnerGoal: async (subjectId, input) => { commands.push({ kind: 'goal', subjectId, input }); return {} },
    updateLearnerPreferences: async (subjectId, input) => { commands.push({ kind: 'preferences', subjectId, input }); return {} },
    resetSrsItem: async (subjectId, itemId) => { commands.push({ kind: 'srs', subjectId, itemId }); return {} },
  }
  const source = fs.readFileSync(path.join(root, 'src/views/AdminLearnerView.vue'), 'utf8')
  const { descriptor } = parse(source)
  const script = compileScript(descriptor, { id: 'uat-admin-learner-selection' }).content
  const code = ts.transpileModule(script, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const dependencies = {
    vue: Vue,
    '../components/AdminRecordDetails.vue': {},
    '../platform/experience': { ui: (key) => key },
    '../components/AdminPageIntro.vue': {},
    'element-plus': {
      ElMessage: { success: (value) => notices.push(value), error: (value) => notices.push(value), info: (value) => notices.push(value) },
      ElMessageBox: { confirm: () => confirmation },
    },
    '../api/learner-360': api,
    '../stores/admin': { useAdminStore: () => session },
  }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)((id) => {
    assert.ok(id in dependencies, `unexpected dependency: ${id}`)
    return dependencies[id]
  }, module, module.exports)
  const view = module.exports.default.setup({}, { expose() {} })
  return {
    view, session, commands, notices,
    delayProfile: (subjectId) => { const item = deferred(); pending.set(subjectId, item); return item },
    delaySearch: (query, cursor = '') => { const item = deferred(); pendingSearch.set(`${query}:${cursor}`, item); return item },
    setConfirmation: (value) => { confirmation = value },
  }
}

test('late learner search results cannot replace a newer query or survive permission loss', async () => {
  const h = harness()
  h.view.q.value = 'old'
  const old = h.delaySearch('old')
  const older = h.view.search()
  h.view.q.value = 'new'
  const current = h.delaySearch('new')
  const newer = h.view.search()
  current.resolve({ subjects: [{ subjectId: 'learner-b' }], nextCursor: null, hasMore: false })
  await newer
  old.resolve({ subjects: [{ subjectId: 'learner-a' }], nextCursor: null, hasMore: false })
  await older
  assert.deepEqual(h.view.subjects.value.map(({ subjectId }) => subjectId), ['learner-b'])

  const pending = h.delaySearch('new')
  const loading = h.view.search()
  h.session.permissions = []
  await nextTick()
  pending.resolve({ subjects: [{ subjectId: 'learner-a' }], nextCursor: null, hasMore: false })
  await loading
  assert.deepEqual(h.view.subjects.value, [])
  assert.equal(h.view.state.value, 'permission')
})

test('late learner A detail cannot overwrite B or send A form to B', async () => {
  const h = harness()
  const a = h.delayProfile('learner-a')
  const b = h.delayProfile('learner-b')
  const openingA = h.view.open('learner-a')
  const openingB = h.view.open('learner-b')
  b.resolve(profile('learner-b'))
  await openingB
  a.resolve(profile('learner-a'))
  await openingA
  assert.equal(h.view.current.value, 'learner-b')
  assert.equal(h.view.loadedSubject.value, 'learner-b')
  assert.equal(h.view.profile.value.profile.version, 7)
  assert.equal(h.view.goalForm.value.goalType, 'WORKPLACE')
  await h.view.saveGoal()
  assert.deepEqual(h.commands.map(({ kind, subjectId, input }) => ({ kind, subjectId, expectedVersion: input.expectedVersion })), [
    { kind: 'goal', subjectId: 'learner-b', expectedVersion: 7 },
  ])
})

test('switching learner during confirmation cancels an old SRS command', async () => {
  const h = harness()
  await h.view.open('learner-a')
  const confirmation = deferred()
  h.setConfirmation(confirmation.promise)
  const reset = h.view.resetItem('learner-a-item')
  await h.view.open('learner-b')
  confirmation.resolve()
  await reset
  assert.equal(h.view.current.value, 'learner-b')
  assert.equal(h.commands.length, 0)
})

test('losing learner permission while a detail loads clears the selection', async () => {
  const h = harness()
  const slow = h.delayProfile('learner-a')
  const loading = h.view.open('learner-a')
  h.session.permissions = []
  await nextTick()
  slow.resolve(profile('learner-a'))
  await loading
  assert.equal(h.view.state.value, 'permission')
  assert.equal(h.view.current.value, '')
  assert.equal(h.view.loadedSubject.value, '')
  assert.deepEqual(h.view.profile.value, {})
  assert.equal(h.commands.length, 0)
})
