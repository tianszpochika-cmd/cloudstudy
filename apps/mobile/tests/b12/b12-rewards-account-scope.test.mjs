import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const appRoot = path.resolve(import.meta.dirname, '..', '..')

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function loadSetupScript(relativePath, modules, exposedNames = []) {
  const source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script, `Missing script setup in ${relativePath}`)
  const exposure = exposedNames.length ? `\nmodule.exports.__fixture = { ${exposedNames.join(', ')} }\n` : ''
  const compiled = ts.transpileModule(`${script}${exposure}`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`Unexpected import ${name} in ${relativePath}`)
    return modules[name]
  }, module, module.exports)
  return module.exports.__fixture
}

class MobileApiError extends Error {
  constructor(status, message) { super(message); this.status = status; this.details = null }
}

function reward(grantId, status = 'GRANTED') {
  return { grants: [{ grantId, rewardCode: 'LEARNING_REWARD', status, probabilityVersion: 'v1' }] }
}

function probability(grantId) {
  return { grantId, probabilityVersion: 'v1', outcomes: [{ outcomeCode: 'STAR', probability: 1 }], totalProbability: 1, disclosedBeforeClaim: true }
}

function makeRewardsHarness(api, initialSubject = 'A') {
  const session = { verifiedSubject: initialSubject, identityRevision: 1, isAuthenticated: Boolean(initialSubject) }
  const watchers = []
  const modules = {
    vue: {
      ref: (value) => ({ value }),
      watch: (sources, callback) => watchers.push({ sources, callback }),
      onMounted: () => {},
    },
    '../../api/client': { MobileApiError },
    '../../api/b12': api,
    '../../platform/b12-i18n': { b12T: (key) => key },
    '../../platform/uni-runtime': { openUniPage: () => {} },
    '../../stores/session': { useSessionStore: () => session },
  }
  const view = loadSetupScript('src/components/b12/B12RewardsCard.vue', modules, [
    'chests', 'chestProbability', 'lastChestResult', 'status', 'actionKey', 'lastError', 'online',
    'loadRewards', 'loadProbability', 'openChest',
  ])
  function setIdentity(subject, authenticated = Boolean(subject)) {
    const previous = [session.verifiedSubject, session.identityRevision, session.isAuthenticated]
    session.verifiedSubject = subject
    session.identityRevision += 1
    session.isAuthenticated = authenticated
    for (const watcher of watchers) watcher.callback(watcher.sources.map((source) => source()), previous)
  }
  return { view, session, setIdentity }
}

async function settleMicrotasks() {
  await new Promise((resolve) => setImmediate(resolve))
}

test('B12 rewards reject requests without a verified authenticated owner', async () => {
  let calls = 0
  const api = {
    listB12RewardGrants: async () => { calls += 1; return reward('unexpected') },
    getB12RewardProbability: async () => { calls += 1; return probability('unexpected') },
    claimB12Reward: async () => { calls += 1; return { grantId: 'unexpected', claimed: true } },
  }
  const { view } = makeRewardsHarness(api, null)
  await view.loadRewards()
  await view.loadProbability('grant-1')
  await view.openChest('grant-1')
  assert.equal(calls, 0)
  assert.equal(view.status.value, 'unauthenticated')
  assert.deepEqual(view.chests.value, [])
})

test('late A reward-list response cannot replace B after an account switch', async () => {
  const delayedA = deferred()
  const requestedSubjects = []
  let session
  const api = {
    listB12RewardGrants: () => {
      requestedSubjects.push(session.verifiedSubject)
      return session.verifiedSubject === 'A' ? delayedA.promise : Promise.resolve(reward('B-grant', 'CLAIMED'))
    },
    getB12RewardProbability: async () => probability('unused'),
    claimB12Reward: async () => ({ grantId: 'unused', claimed: true }),
  }
  const harness = makeRewardsHarness(api)
  session = harness.session
  const oldRead = harness.view.loadRewards()
  harness.setIdentity('B')
  assert.deepEqual(harness.view.chests.value, [])
  await settleMicrotasks()
  assert.deepEqual(requestedSubjects, ['A', 'B'])
  assert.deepEqual(harness.view.chests.value.map((item) => item.grantId), ['B-grant'])
  delayedA.resolve(reward('A-grant', 'CLAIMED'))
  await oldRead
  assert.deepEqual(harness.view.chests.value.map((item) => item.grantId), ['B-grant'])
})

test('late A probability response cannot replace B probability after an account switch', async () => {
  const delayedA = deferred()
  let session
  const api = {
    listB12RewardGrants: async () => reward(`${session.verifiedSubject}-grant`),
    getB12RewardProbability: (grantId) => grantId === 'A-grant' ? delayedA.promise : Promise.resolve(probability(grantId)),
    claimB12Reward: async () => ({ grantId: 'unused', claimed: true }),
  }
  const harness = makeRewardsHarness(api)
  session = harness.session
  const oldRead = harness.view.loadRewards()
  harness.setIdentity('B')
  await settleMicrotasks()
  assert.equal(harness.view.chests.value[0]?.grantId, 'B-grant')
  assert.equal(harness.view.chestProbability.value?.grantId, 'B-grant')
  delayedA.resolve(probability('A-grant'))
  await oldRead
  assert.equal(harness.view.chests.value[0]?.grantId, 'B-grant')
  assert.equal(harness.view.chestProbability.value?.grantId, 'B-grant')
})

test('late A claim response cannot write a claim result into B state', async () => {
  const delayedA = deferred()
  let session
  const api = {
    listB12RewardGrants: async () => reward(`${session.verifiedSubject}-grant`, session.verifiedSubject === 'B' ? 'CLAIMED' : 'GRANTED'),
    getB12RewardProbability: async (grantId) => probability(grantId),
    claimB12Reward: (grantId) => grantId === 'A-grant' ? delayedA.promise : Promise.resolve({ grantId, claimed: true }),
  }
  const harness = makeRewardsHarness(api)
  session = harness.session
  await harness.view.loadRewards()
  const oldClaim = harness.view.openChest('A-grant')
  harness.setIdentity('B')
  await settleMicrotasks()
  assert.deepEqual(harness.view.chests.value.map((item) => item.grantId), ['B-grant'])
  assert.equal(harness.view.lastChestResult.value, null)
  delayedA.resolve({ grantId: 'A-grant', claimed: true, outcomeCode: 'STAR' })
  await oldClaim
  assert.deepEqual(harness.view.chests.value.map((item) => item.grantId), ['B-grant'])
  assert.equal(harness.view.lastChestResult.value, null)
})

test('reward endpoint failures clear stale data and report permission, offline, or service state', async () => {
  const listFailure = makeRewardsHarness({
    listB12RewardGrants: async () => { throw new MobileApiError(401, 'expired') },
    getB12RewardProbability: async () => probability('unused'),
    claimB12Reward: async () => ({ grantId: 'unused', claimed: true }),
  })
  await listFailure.view.loadRewards()
  assert.equal(listFailure.view.status.value, 'unauthenticated')
  assert.equal(listFailure.view.lastError.value, '请先登录后查看奖励数据。')
  assert.deepEqual(listFailure.view.chests.value, [])

  const unauthorizedProbability = makeRewardsHarness({
    listB12RewardGrants: async () => reward('A-grant', 'CLAIMED'),
    getB12RewardProbability: async () => { throw new MobileApiError(401, 'expired') },
    claimB12Reward: async () => ({ grantId: 'A-grant', claimed: true }),
  })
  await unauthorizedProbability.view.loadRewards()
  assert.equal(unauthorizedProbability.view.chests.value.length, 1)
  await unauthorizedProbability.view.loadProbability('A-grant')
  assert.equal(unauthorizedProbability.view.status.value, 'unauthenticated')
  assert.deepEqual(unauthorizedProbability.view.chests.value, [])

  const probabilityFailure = makeRewardsHarness({
    listB12RewardGrants: async () => reward('A-grant', 'CLAIMED'),
    getB12RewardProbability: async () => { throw new MobileApiError(403, 'forbidden') },
    claimB12Reward: async () => ({ grantId: 'A-grant', claimed: true }),
  })
  await probabilityFailure.view.loadRewards()
  await probabilityFailure.view.loadProbability('A-grant')
  assert.equal(probabilityFailure.view.status.value, 'permission')
  assert.equal(probabilityFailure.view.lastError.value, 'forbidden')
  assert.deepEqual(probabilityFailure.view.chests.value, [])
  assert.equal(probabilityFailure.view.chestProbability.value, null)

  const claimFailure = makeRewardsHarness({
    listB12RewardGrants: async () => reward('A-grant'),
    getB12RewardProbability: async () => probability('A-grant'),
    claimB12Reward: async () => { throw new MobileApiError(0, 'offline') },
  })
  await claimFailure.view.loadRewards()
  await claimFailure.view.openChest('A-grant')
  assert.equal(claimFailure.view.status.value, 'offline')
  assert.equal(claimFailure.view.online.value, false)
  assert.deepEqual(claimFailure.view.chests.value, [])
  assert.equal(claimFailure.view.lastChestResult.value, null)
})
