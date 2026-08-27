import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const args = new Set(process.argv.slice(2))
const staticOnly = args.has('--static-only')
const requireRuntime = args.has('--require-runtime')
const failures = []

const manifests = [
  'config/b20-security-gates.json',
  'config/b20-privacy-content-gates.json',
  'config/b20-commerce-dr-evidence.json',
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
    console.error(`B20 bootstrap missing required script: ${script}`)
    failures.push(label)
    return false
  }
  return run(label, process.execPath, [scriptPath, ...scriptArgs])
}

function testFiles(directory) {
  const testDirectory = path.join(root, 'tests', directory)
  if (!fs.existsSync(testDirectory)) {
    console.error(`B20 bootstrap missing test directory: tests/${directory}`)
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
    const keyName = String(key ?? '').toLowerCase()
    if (keyName.includes('env')) {
      for (const item of value) {
        if (typeof item === 'string' && /^[A-Z][A-Z0-9_]+$/.test(item)) result.add(item)
      }
    }
    for (const item of value) collectRequiredEnv(item, key, result)
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [childKey, childValue] of Object.entries(value)) {
    collectRequiredEnv(childValue, childKey, result)
  }
}

for (const manifest of manifests) {
  if (!fs.existsSync(path.join(root, manifest))) {
    console.error(`B20 bootstrap missing manifest: ${manifest}`)
    failures.push(`manifest:${manifest}`)
  }
}

// B20 is a release Gate batch. Static mode proves the manifests, validators,
// and test boundaries; it never turns synthetic evidence into a production pass.
nodeScript('b19-static-prerequisite', 'scripts/runtime/b19-bootstrap.mjs', '--static-only')
const b20Files = testFiles('b20')
if (b20Files.length > 0) run('b20-tests', process.execPath, ['--test', ...b20Files])
nodeScript('b20-security-gates', 'scripts/runtime/validate-b20-security-gates.mjs')
nodeScript('b20-privacy-content-gates', 'scripts/runtime/validate-b20-privacy-content-gates.mjs')
nodeScript('b20-commerce-dr-evidence', 'scripts/runtime/validate-b20-commerce-dr-evidence.mjs')
nodeScript('contracts', 'scripts/contracts/validate-contracts.mjs')
nodeScript('contract-generation', 'scripts/contracts/generate-contracts.mjs')
nodeScript('contract-compatibility', 'scripts/contracts/compatibility-diff.mjs')
nodeScript('fixed-port-registry', 'scripts/check-fixed-ports.mjs', '--registry-only')
nodeScript('runtime-config', 'scripts/check-runtime-config.mjs')
nodeScript('task-baseline', 'scripts/audit/verify-v2-b7plus-task-baseline.mjs')

if (!staticOnly || requireRuntime) {
  // Keep the prior system-test Gate visible: B20 cannot claim release readiness
  // while its B19 runtime prerequisite is still blocked.
  nodeScript('b19-runtime-prerequisite', 'scripts/runtime/b19-bootstrap.mjs', '--require-runtime')

  const required = new Set()
  for (const manifest of manifests) {
    if (!fs.existsSync(path.join(root, manifest))) continue
    collectRequiredEnv(readJson(manifest), '', required)
  }
  const missing = [...required].filter((key) => !process.env[key])
  if (missing.length > 0) {
    console.error(`B20 runtime blocked: missing security/privacy/content/commerce/DR evidence variables: ${missing.join(', ')}`)
    failures.push('b20-runtime-config')
  } else if (required.size === 0) {
    console.error('B20 runtime blocked: manifests do not declare required environment evidence variables')
    failures.push('b20-runtime-contract')
  } else {
    nodeScript('b20-security-runtime', 'scripts/runtime/validate-b20-security-gates.mjs', '--require-runtime')
    nodeScript('b20-privacy-content-runtime', 'scripts/runtime/validate-b20-privacy-content-gates.mjs', '--require-runtime')
    nodeScript('b20-commerce-dr-runtime', 'scripts/runtime/validate-b20-commerce-dr-evidence.mjs', '--require-runtime')
  }
  console.log('B20 runtime does not execute live payment, destructive deletion, or restore operations implicitly; use approved isolated runners and retain evidence artifacts.')
}

if (failures.length > 0) {
  console.error(`B20 bootstrap ${staticOnly ? 'static' : 'runtime'} failed: ${failures.join(', ')}`)
  process.exitCode = 1
} else {
  console.log(`B20 bootstrap passed (${staticOnly ? 'static' : 'runtime preflight'}); no production credentials, payment calls, or destructive recovery actions were performed.`)
}
