import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const args = new Set(process.argv.slice(2))
const staticOnly = args.has('--static-only')
const requireRuntime = args.has('--require-runtime')
const failures = []

const manifests = [
  'config/b22-production-rollout.json',
  'config/b22-data-reconciliation.json',
  'config/b22-observation-acceptance.json',
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
    console.error(`B22 bootstrap missing required script: ${script}`)
    failures.push(label)
    return false
  }
  return run(label, process.execPath, [scriptPath, ...scriptArgs])
}

function testFiles(directory) {
  const testDirectory = path.join(root, 'tests', directory)
  if (!fs.existsSync(testDirectory)) {
    console.error(`B22 bootstrap missing test directory: tests/${directory}`)
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
    console.error(`B22 bootstrap missing manifest: ${manifest}`)
    failures.push(`manifest:${manifest}`)
  }
}

// B22 is the final Phase 1 release batch. Static mode proves release and
// evidence contracts only; it never changes production state.
nodeScript('b21-static-prerequisite', 'scripts/runtime/b21-bootstrap.mjs', '--static-only')
const b22Files = testFiles('b22')
if (b22Files.length > 0) run('b22-tests', process.execPath, ['--test', ...b22Files])
nodeScript('b22-production-rollout', 'scripts/runtime/validate-b22-production-rollout.mjs')
nodeScript('b22-data-reconciliation', 'scripts/runtime/validate-b22-data-reconciliation.mjs')
nodeScript('b22-observation-acceptance', 'scripts/runtime/validate-b22-observation-acceptance.mjs')
nodeScript('contracts', 'scripts/contracts/validate-contracts.mjs')
nodeScript('contract-generation', 'scripts/contracts/generate-contracts.mjs')
nodeScript('contract-compatibility', 'scripts/contracts/compatibility-diff.mjs')
nodeScript('fixed-port-registry', 'scripts/check-fixed-ports.mjs', '--registry-only')
nodeScript('runtime-config', 'scripts/check-runtime-config.mjs')
nodeScript('task-baseline', 'scripts/audit/verify-v2-b7plus-task-baseline.mjs')

if (!staticOnly || requireRuntime) {
  // Production state must never be changed before B21 has an accepted runtime Gate.
  nodeScript('b21-runtime-prerequisite', 'scripts/runtime/b21-bootstrap.mjs', '--require-runtime')
  const required = new Set()
  for (const manifest of manifests) {
    if (fs.existsSync(path.join(root, manifest))) collectRequiredEnv(readJson(manifest), '', required)
  }
  const missing = [...required].filter((key) => !process.env[key])
  if (missing.length > 0) {
    console.error(`B22 runtime blocked: missing production/observation/evidence variables: ${missing.join(', ')}`)
    failures.push('b22-runtime-config')
  } else if (required.size === 0) {
    console.error('B22 runtime blocked: manifests do not declare required runtime evidence variables')
    failures.push('b22-runtime-contract')
  } else {
    nodeScript('b22-production-rollout-runtime', 'scripts/runtime/validate-b22-production-rollout.mjs', '--require-runtime')
    nodeScript('b22-data-reconciliation-runtime', 'scripts/runtime/validate-b22-data-reconciliation.mjs', '--require-runtime')
    nodeScript('b22-observation-acceptance-runtime', 'scripts/runtime/validate-b22-observation-acceptance.mjs', '--require-runtime')
  }
  console.log('B22 runtime does not change production traffic, execute destructive migrations, approve maintenance, or close Phase 1 implicitly; use approved runners and retain immutable evidence plus rollback ownership.')
}

if (failures.length > 0) {
  console.error(`B22 bootstrap ${staticOnly ? 'static' : 'runtime preflight'} failed: ${failures.join(', ')}`)
  process.exitCode = 1
} else {
  console.log(`B22 bootstrap passed (${staticOnly ? 'static' : 'runtime preflight'}); no production state or release decision was changed.`)
}
