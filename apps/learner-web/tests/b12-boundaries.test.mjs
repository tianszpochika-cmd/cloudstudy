import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
const requirePackage = createRequire(import.meta.url)
const vue = requirePackage('vue')

class TestApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

function mountRewardsCard(session, api) {
  const component = read('src/components/b12/B12RewardsCard.vue')
  const script = component.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script, 'B12 reward component must keep a script setup block')
  const compiled = ts.transpileModule(script, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const mounted = []
  const unmounted = []
  const runtimeVue = {
    ...vue,
    onMounted: callback => mounted.push(callback),
    onUnmounted: callback => unmounted.push(callback),
  }
  const dependencies = {
    vue: runtimeVue,
    '../../api/client': { ApiError: TestApiError },
    '../../api/b12': api,
    '../../platform/b12-i18n': { b12T: key => key },
    '../../stores/session': { useSessionStore: () => session },
  }
  const module = { exports: {} }
  const exportsForTest = `
    module.exports.__test = {
      chests, chestProbability, lastChestResult, status, actionKey,
      hasRewardClaimPermission, loadRewards, loadProbability, openChest,
    };
  `
  const scope = vue.effectScope()
  scope.run(() => {
    new Function('require', 'module', 'exports', `${compiled}\n${exportsForTest}`)(name => {
      if (Object.hasOwn(dependencies, name)) return dependencies[name]
      throw new Error(`unexpected dependency: ${name}`)
    }, module, module.exports)
  })
  return {
    state: module.exports.__test,
    mount: () => mounted.forEach(callback => callback()),
    unmount: () => { unmounted.forEach(callback => callback()); scope.stop() },
  }
}

function authenticatedSession(subject = 'A', permissions = ['gamification.read', 'gamification.rewards.claim']) {
  return vue.reactive({
    accessToken: `token-${subject}`,
    userId: subject,
    principal: { subject },
    permissions,
    status: 'authenticated',
    authGeneration: 0,
  })
}

async function flushPromises() {
  for (let turn = 0; turn < 8; turn += 1) await Promise.resolve()
}

test('B12 learner API uses server-owned chest, leaderboard and preset report endpoints', () => {
  const api = read('src/api/b12.ts')
  assert.match(api, /gamification\/me\/rewards/)
  assert.match(api, /social\/leaderboards\?kind=FOCUS_MINUTES/)
  assert.match(api, /social\/rooms.*reports/)
  assert.match(api, /Idempotency-Key/)
  assert.doesNotMatch(api, /notifications\/preferences/)
})

test('B12 learner rewards disclose free non-cash rules and server probability', () => {
  const component = read('src/components/b12/B12RewardsCard.vue')
  assert.match(component, /freeNotice/)
  assert.match(component, /chestProbability/)
  assert.match(component, /probabilitySnapshotHash/)
  assert.doesNotMatch(component, /Math\.random|抽奖概率由客户端/) 
})

test('B12 learner report UI only uses preset reasons and server returned member references', () => {
  const component = read('src/components/b12/B12SocialExtensions.vue')
  assert.match(component, /B12_REPORT_REASONS/)
  assert.match(component, /reportUser\(/)
  assert.doesNotMatch(component, /<textarea|v-model=".*userId|placeholder=.*userId/i)
})

test('B12 social extension routes notification settings to the canonical category and channel screen', () => {
  const component = read('src/components/b12/B12SocialExtensions.vue')
  assert.match(component, /to="\/settings\/notifications"/)
  assert.doesNotMatch(component, /DO_NOT_DISTURB|ROOM_INTERACTIONS|FOCUS_REMINDERS/)
})

test('B12 reward card scopes requests to a verified owner and drops A responses after an A to B switch', async () => {
  const session = authenticatedSession()
  const requestOwners = []
  const pendingA = deferred()
  const pendingB = deferred()
  const component = mountRewardsCard(session, {
    listB12RewardGrants: () => {
      const subject = session.principal?.subject ?? null
      requestOwners.push(subject)
      return subject === 'A' ? pendingA.promise : pendingB.promise
    },
    getB12RewardProbability: async () => { throw new Error('claimed fixtures do not request probability') },
    claimB12Reward: async () => { throw new Error('claim is outside this test') },
  })

  component.mount()
  assert.deepEqual(requestOwners, ['A'])

  session.accessToken = null
  session.userId = null
  session.principal = null
  session.permissions = []
  session.status = 'unauthenticated'
  session.authGeneration += 1
  await component.state.loadRewards()
  assert.deepEqual(requestOwners, ['A'], 'logged-out state must not start a protected reward request')
  assert.deepEqual(component.state.chests.value, [])

  session.accessToken = 'token-B'
  session.userId = 'B'
  session.principal = { subject: 'B' }
  session.permissions = ['gamification.read', 'gamification.rewards.claim']
  session.status = 'authenticated'
  assert.deepEqual(requestOwners, ['A', 'B'])
  assert.deepEqual(component.state.chests.value, [], 'A personal data stays cleared while B is loading')

  pendingB.resolve({ items: [{ grantId: 'grant-B', status: 'CLAIMED' }] })
  await pendingB.promise
  await flushPromises()
  pendingA.resolve({ items: [{ grantId: 'grant-A', status: 'CLAIMED' }] })
  await pendingA.promise
  await flushPromises()

  assert.deepEqual(component.state.chests.value.map(grant => grant.grantId), ['grant-B'])
  assert.equal(component.state.status.value, 'success')
  component.unmount()
})

test('B12 reward card clears private data and blocks reads when reward read permission is revoked', async () => {
  const session = authenticatedSession()
  let listCalls = 0
  let probabilityCalls = 0
  let claimCalls = 0
  const component = mountRewardsCard(session, {
    listB12RewardGrants: async () => {
      listCalls += 1
      return { items: [{ grantId: 'grant-A', status: 'GRANTED' }] }
    },
    getB12RewardProbability: async grantId => {
      probabilityCalls += 1
      return { data: { grantId, outcomes: [{ outcomeCode: 'SMALL', probability: 1 }] } }
    },
    claimB12Reward: async () => { claimCalls += 1; throw new TestApiError('forbidden', 403) },
  })

  component.mount()
  await flushPromises()
  assert.deepEqual(component.state.chests.value.map(grant => grant.grantId), ['grant-A'])
  assert.equal(component.state.chestProbability.value.grantId, 'grant-A')
  assert.equal(probabilityCalls, 1)

  session.permissions = []
  assert.deepEqual(component.state.chests.value, [])
  assert.equal(component.state.chestProbability.value, null)
  assert.equal(component.state.lastChestResult.value, null)
  assert.equal(component.state.status.value, 'permission')
  await component.state.loadRewards()
  assert.equal(listCalls, 1, 'revoked read permission must block another protected request')
  assert.equal(probabilityCalls, 1)

  session.permissions = ['gamification.read']
  await flushPromises()
  assert.deepEqual(component.state.chests.value.map(grant => grant.grantId), ['grant-A'])
  assert.equal(listCalls, 2)
  assert.equal(probabilityCalls, 2)
  assert.equal(component.state.hasRewardClaimPermission.value, false)
  await component.state.openChest('grant-A')
  assert.equal(claimCalls, 0, 'revoked claim permission must block the protected claim request')

  session.permissions = ['gamification.read', 'gamification.rewards.claim']
  await flushPromises()
  assert.equal(listCalls, 3)
  assert.equal(probabilityCalls, 3)
  await component.state.openChest('grant-A')
  assert.equal(claimCalls, 1)
  assert.deepEqual(component.state.chests.value, [], 'a server 403 clears previously loaded personal rewards')
  assert.equal(component.state.chestProbability.value, null)
  assert.equal(component.state.lastChestResult.value, null)
  assert.equal(component.state.status.value, 'permission')
  component.unmount()
})
