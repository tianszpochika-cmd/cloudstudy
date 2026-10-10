import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

const apiSource = readFileSync(resolve(import.meta.dirname, '../src/api/b1.ts'), 'utf8')
const compiled = ts.transpileModule(apiSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function apiFor(owner) {
  const module = { exports: {} }
  let sequence = 0
  const require = name => {
    if (name === './client') return { apiClient: owner }
    if (name === '../platform/client-id') return { createClientId: () => `profile-target-${++sequence}` }
    if (name === './unavailable') return { unavailableOperation: () => Promise.reject(new Error('unavailable')) }
    throw new Error(`unexpected module ${name}`)
  }
  new Function('require', 'module', 'exports', compiled)(require, module, module.exports)
  return module.exports
}

function b9Owner({ goalCode = 'WORKPLACE_DAILY', quota = 30, level = 'B2', version = 4,
  applyWrite = true, targetMissing = false, targetVersion = version } = {}) {
  const calls = []
  const state = { goalCode, quota, level, version, targetVersion }
  const owner = {
    calls,
    get: async path => {
      calls.push({ method: 'GET', path })
      if (path === '/learner/profile') return { data: { stateVersion: state.version,
        targetGoal: state.goalCode, status: 'ACTIVE' } }
      if (path === '/learner/targets') {
        if (targetMissing) throw new Error('HTTP 404')
        return { data: { goalCode: state.goalCode, targetLevel: state.level,
          dailyQuotaMinutes: state.quota, stateVersion: state.targetVersion,
          status: 'ACTIVE', targetDate: '2027-06-30' } }
      }
      throw new Error(`unexpected GET ${path}`)
    },
    put: async (path, body, options) => {
      calls.push({ method: 'PUT', path, body, options })
      if (applyWrite) {
        state.goalCode = body.goalCode
        state.quota = body.dailyQuotaMinutes
        state.level = body.targetLevel
        state.version += 1
        state.targetVersion = state.version
      }
      return { data: { ok: true } }
    },
  }
  return owner
}

test('reads public B9 target without inventing nickname, accent or a default goal', async () => {
  const owner = b9Owner()
  const snapshot = await apiFor(owner).fetchProfile()
  assert.equal(snapshot.goalCode, 'WORKPLACE_DAILY')
  assert.equal(snapshot.targetGoal, 'WORKPLACE_DAILY')
  assert.equal(snapshot.dailyQuotaMinutes, 30)
  assert.equal(snapshot.stateVersion, 4)
  assert.equal(Object.hasOwn(snapshot, 'nickname'), false)
  assert.equal(Object.hasOwn(snapshot, 'accentPref'), false)
  assert.equal(owner.calls.filter(call => call.method !== 'GET').length, 0)
})

test('reads B25 snake_case profile and target facts if routed there', async () => {
  const owner = {
    get: async path => path === '/learner/profile'
      ? { data: { state_version: 7, goal: { goal_code: 'WORKPLACE', daily_quota_minutes: 30 } } }
      : { data: { goal_code: 'WORKPLACE', target_level: 'B2', daily_quota_minutes: 30,
        status: 'ACTIVE' } },
  }
  const snapshot = await apiFor(owner).fetchProfile()
  assert.equal(snapshot.goalCode, 'WORKPLACE_DAILY')
  assert.equal(snapshot.dailyQuotaMinutes, 30)
  assert.equal(snapshot.stateVersion, 7)
})

test('missing target or inconsistent versions block any write', async () => {
  for (const config of [{ targetMissing: true }, { targetVersion: 3 }]) {
    const owner = b9Owner(config)
    await assert.rejects(apiFor(owner).putDailyQuota(45))
    assert.equal(owner.calls.filter(call => call.method === 'PUT').length, 0)
  }
})

test('daily target save preserves owner goal and level, then verifies the real readback', async () => {
  const owner = b9Owner({ goalCode: 'COLLEGE_CET', level: 'B1' })
  const result = await apiFor(owner).putDailyQuota(45)
  const writes = owner.calls.filter(call => call.method === 'PUT')
  assert.equal(writes.length, 1)
  assert.equal(writes[0].path, '/learner/targets')
  assert.deepEqual(writes[0].body, { expectedStateVersion: 4, goalCode: 'COLLEGE_CET',
    targetLevel: 'B1', dailyQuotaMinutes: 45, targetDate: '2027-06-30' })
  assert.equal(typeof writes[0].options.headers['Idempotency-Key'], 'string')
  assert.equal(result.dailyQuotaMinutes, 45)
  assert.equal(result.stateVersion, 5)
})

test('a 200 response without durable target change does not count as saved', async () => {
  const owner = b9Owner({ applyWrite: false })
  await assert.rejects(apiFor(owner).putDailyQuota(45), /保存结果未确认/)
  assert.equal(owner.calls.filter(call => call.method === 'PUT').length, 1)
})
