import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const appRoot = path.resolve(import.meta.dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), 'utf8')

test('governance remains permission-gated and its legacy command paths are not presented', () => {
  const router = read('src/router/index.ts')
  const view = read('src/views/AdminB12GovernanceView.vue')
  const store = read('src/stores/b12.ts')
  assert.match(router, /path: "\/governance"[\s\S]*?permission: "admin\.moderation\.read"/)
  assert.match(store, /session\.can\('admin\.moderation\.read'\)/)
  assert.doesNotMatch(store, /runB12(?:Moderation|Recovery)Command|listB12RecoveryTasks|lastSuccess|runModerationCommand|runRecoveryCommand/)
  assert.doesNotMatch(view, /runModeration|runRecovery|moderationCommands|recoveryCommands|admin\.(?:moderation|recovery)\.command/)
  assert.match(view, /session\.can\('admin\.recovery\.read'\).*?\$router\.push\('\/recovery'\)/s)
  assert.match(view, /store\.viewState === 'ready'/)
  assert.match(view, /store\.viewState === 'error'/)
  assert.match(view, /store\.viewState === 'permission'/)
  assert.match(view, /@click="store\.load"/)
})

test('the existing recovery workspace keeps its independent permission gate', () => {
  const router = read('src/router/index.ts')
  const recovery = read('src/views/AdminRecoveryView.vue')
  assert.match(router, /path: "\/recovery"[\s\S]*?permission: "admin\.recovery\.read"/)
  assert.match(recovery, /requestRecovery/)
  assert.match(recovery, /approveRecovery/)
  assert.match(recovery, /executeRecovery/)
})
