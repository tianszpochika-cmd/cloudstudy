import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const matrixPath = path.join(repoRoot, 'config', 'b6-platform-matrix.json')
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'))
const expectedTargets = new Set(['WEB', 'H5', 'ANDROID', 'IOS', 'IPAD', 'WECHAT_MINI_PROGRAM', 'WINDOWS_PWA'])
const actualTargets = new Set(matrix.targets.map((target) => target.code))
const failures = []

if (matrix.version !== 'b6-platform-v1') failures.push('config version must be b6-platform-v1')
if (actualTargets.size !== expectedTargets.size || [...expectedTargets].some((target) => !actualTargets.has(target))) failures.push('platform target matrix is incomplete')
if (matrix.performance.autoDegrade !== true || matrix.performance.autoUpgrade !== false) failures.push('performance engine must degrade automatically and never auto-upgrade')
if (matrix.releaseGate.failClosed !== true) failures.push('release gate must fail closed')
for (const relativePath of [
  'apps/mobile/package.json',
  'apps/mobile/src/manifest.json',
  'apps/miniapp-wechat/README.md',
  'apps/learner-web/package.json',
  'apps/learner-web/public/manifest.webmanifest',
  'apps/learner-web/public/sw.js',
  'packages/performance/src/index.ts',
]) {
  if (!fs.existsSync(path.join(repoRoot, relativePath))) failures.push(`missing release asset: ${relativePath}`)
}

const result = { ok: failures.length === 0, version: matrix.version, targets: [...actualTargets], failures }
if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2))
else console.log(`${result.ok ? 'B6 platform matrix passed' : 'B6 platform matrix failed'}: ${result.targets.join(', ')}${failures.length ? `; ${failures.join('; ')}` : ''}`)
if (!result.ok) process.exitCode = 1
