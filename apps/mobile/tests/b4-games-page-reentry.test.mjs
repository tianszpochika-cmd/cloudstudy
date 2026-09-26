import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')

function loadPageSetup(modules) {
  const relativePath = 'src/pages/b4-games/b4-games.vue'
  const source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script, 'Missing B4 games page script setup')
  const compiled = ts.transpileModule(script, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`Unexpected import ${name} in ${relativePath}`)
    return modules[name]
  }, module, module.exports)
  return source
}

test('B4 games reloads the protected world each time the page is shown again', async () => {
  let show
  let restoreCalls = 0
  let worldRestoreCalls = 0
  let worldLoadCalls = 0
  const session = { isAuthenticated: true, async restore() { restoreCalls += 1 } }
  const b4 = {
    games: [{ gameCode: 'WORD_MATCH', enabled: false }],
    restore() { worldRestoreCalls += 1 },
    loadWorld() { worldLoadCalls += 1; return Promise.resolve() },
    setPerformance() {},
  }
  const source = loadPageSetup({
    '../../components/MobilePageHeader': {},
    '../../platform/experience': { useMobileExperience: () => ({ experienceStyle: {}, experienceMotion: 'enabled' }) },
    '@dcloudio/uni-app': { onShow(callback) { show = callback } },
    '../../components/b4/B4StatusPanel': {},
    '../../domain/b4': { B4_PERFORMANCE_LEVELS: [], gameLabel: (code) => code },
    '../../platform/uni-runtime': { getUniRuntime: () => ({ navigateTo() {} }) },
    '../../stores/session': { useSessionStore: () => session },
    '../../stores/b4': { useB4Store: () => b4 },
  })
  assert.equal(typeof show, 'function')
  await show()
  await show()
  assert.equal(restoreCalls, 2)
  assert.equal(worldRestoreCalls, 2)
  assert.equal(worldLoadCalls, 2)
  assert.ok(source.includes('void b4.loadWorld()'))
})

test('B4 game start remains disabled while no playable question content exists', () => {
  const source = fs.readFileSync(path.join(appRoot, 'src/pages/b4-games/b4-games.vue'), 'utf8')
  const template = source.match(/<template>([\s\S]*?)<\/template>/)?.[1]
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(template, 'Missing B4 games page template')
  assert.ok(script, 'Missing B4 games page script setup')
  assert.match(template, /class="game-card game-card--disabled"/)
  assert.match(template, /disabled>暂未开放<\/button>/)
  assert.match(template, /当前还没有可操作的题目/)
  assert.doesNotMatch(template, /@click="b4\.startGame/)
  assert.doesNotMatch(script, /function start\(|startGame\(/)
})

