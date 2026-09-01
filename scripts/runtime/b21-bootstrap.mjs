import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const args = new Set(process.argv.slice(2))
const staticOnly = args.has('--static-only')
const requireRuntime = args.has('--require-runtime')
const failures = []

const manifests = [
  'config/b21-deployment-staging.json',
  'config/b21-observability-rc.json',
  'config/b21-release-gate-evidence.json',
]

function run(label, command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    stdio: 'inherit',
  })
  if (result.status !== 0) failures.push(label)
  return result.status === 0
}

function nodeScript(label, script, ...scriptArgs) {
  const scriptPath = path.join(root, script)
  if (!fs.existsSync(scriptPath)) {
    console.error(`B21 bootstrap missing required script: ${script}`)
    failures.push(label)
    return false
  }
  return run(label, process.execPath, [scriptPath, ...scriptArgs])
}

function testFiles(directory) {
  const testDirectory = path.join(root, 'tests', directory)
  if (!fs.existsSync(testDirectory)) {
    console.error(`B21 bootstrap missing test directory: tests/${directory}`)
    failures.push(`${directory}-tests`)
    return []
  }
  return fs.readdirSync(testDirectory)
    .filter((name) => name.endsWith('.test.mjs'))
    .sort()
    .map((name) => path.join(testDirectory, name))
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'))
}

function collectRequiredEnv(value, key, result) {
  if (Array.isArray(value)) {
    if (String(key ?? '').toLowerCase().includes('env')) {
      for (const item of value) {
        if (typeof item === 'string' && /^[A-Z][A-Z0-9_]+$/.test(item)) result.add(item)
      }
    }
    for (const item of value) collectRequiredEnv(item, key, result)
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [childKey, childValue] of Object.entries(value)) collectRequiredEnv(childValue, childKey, result)
}

for (const manifest of manifests) {
  if (!fs.existsSync(path.join(root, manifest))) {
    console.error(`B21 bootstrap missing manifest: ${manifest}`)
    failures.push(`manifest:${manifest}`)
  }
}

// B21 is a release-governance batch. Static mode proves source/config/report
// contracts only; it never creates a staging cluster, signs an image, or marks RC go.
nodeScript('b20-static-prerequisite', 'scripts/runtime/b20-bootstrap.mjs', '--static-only')
const b21Files = testFiles('b21')
if (b21Files.length > 0) run('b21-tests', process.execPath, ['--test', ...b21Files])
nodeScript('b21-deployment-staging', 'scripts/runtime/validate-b21-deployment-staging.mjs')
nodeScript('b21-observability-rc', 'scripts/runtime/validate-b21-observability-rc.mjs')
nodeScript('b21-release-gate-evidence', 'scripts/runtime/validate-b21-release-gate-evidence.mjs')
nodeScript('contracts', 'scripts/contracts/validate-contracts.mjs')
nodeScript('contract-generation', 'scripts/contracts/generate-contracts.mjs')
nodeScript(
  'contract-compatibility',
  'scripts/contracts/compatibility-git-baseline.mjs',
  '--ref', '463c4b238caceb1592bff6c61327c00ab9bac922',
  '--governance-ref', '868c2177f62b6d2cf613bed702686dddcfe6943f',
  '--kind', 'all',
)
nodeScript('fixed-port-registry', 'scripts/check-fixed-ports.mjs', '--registry-only')
nodeScript('runtime-config', 'scripts/check-runtime-config.mjs')
nodeScript('task-baseline', 'scripts/audit/verify-v2-b7plus-task-baseline.mjs')

if (!staticOnly || requireRuntime) {
  // B20 must be a real accepted Gate before B21 can produce an RC decision.
  nodeScript('b20-runtime-prerequisite', 'scripts/runtime/b20-bootstrap.mjs', '--require-runtime')
  const required = new Set()
  for (const manifest of manifests) {
    if (fs.existsSync(path.join(root, manifest))) collectRequiredEnv(readJson(manifest), '', required)
  }
  const missing = [...required].filter((key) => !process.env[key])
  if (missing.length > 0) {
    console.error(`B21 runtime blocked: missing staging/observability/RC evidence variables: ${missing.join(', ')}`)
    failures.push('b21-runtime-config')
  } else if (required.size === 0) {
    console.error('B21 runtime blocked: manifests do not declare required runtime evidence variables')
    failures.push('b21-runtime-contract')
  } else {
    nodeScript('b21-deployment-staging-runtime', 'scripts/runtime/validate-b21-deployment-staging.mjs', '--require-runtime')
    nodeScript('b21-observability-rc-runtime', 'scripts/runtime/validate-b21-observability-rc.mjs', '--require-runtime')
    nodeScript('b21-release-gate-runtime', 'scripts/runtime/validate-b21-release-gate-evidence.mjs', '--require-runtime')
  }
  console.log('B21 runtime does not create clusters, publish images, change traffic, or approve Go implicitly; use the approved staging/RC runner and retain signed artifacts plus multi-party review records.')
}

if (failures.length > 0) {
  console.error(`B21 bootstrap ${staticOnly ? 'static' : 'runtime'} failed: ${failures.join(', ')}`)
  process.exitCode = 1
} else {
  console.log(`B21 bootstrap passed (${staticOnly ? 'static' : 'runtime preflight'}); no staging/production state or release decision was changed.`)
}
