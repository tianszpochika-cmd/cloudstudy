import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const args = new Set(process.argv.slice(2))
const staticOnly = args.has('--static-only')
const requireRuntime = args.has('--require-runtime')
const failures = []

const manifests = [
  'config/b27-device-platform.json',
  'config/b27-quality-release.json',
  'config/b27-handoff.json',
]

function run(label, command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
    windowsHide: true,
  })
  if (result.status !== 0) failures.push(label)
  return result.status === 0
}

function nodeScript(label, relativeScript, ...scriptArgs) {
  const script = path.join(root, relativeScript)
  if (!fs.existsSync(script)) {
    console.error(`B27 bootstrap missing ${label}: ${relativeScript}`)
    failures.push(label)
    return false
  }
  return run(label, process.execPath, [script, ...scriptArgs])
}

function testFiles() {
  const directory = path.join(root, 'tests', 'b27')
  if (!fs.existsSync(directory)) {
    console.error('B27 bootstrap missing tests/b27 directory')
    failures.push('b27-tests')
    return []
  }
  const files = fs.readdirSync(directory)
    .filter((name) => name.endsWith('.test.mjs'))
    .sort()
    .map((name) => path.join(directory, name))
  if (files.length === 0) {
    console.error('B27 bootstrap found no test files')
    failures.push('b27-tests')
  }
  return files
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
    console.error(`B27 bootstrap missing manifest: ${manifest}`)
    failures.push(`manifest:${manifest}`)
  }
}

// B27 is a release/test handoff batch. Static mode validates contracts only;
// it must not create devices, deploy staging, promote artifacts or approve GO.
nodeScript('b26-static-prerequisite', 'scripts/runtime/b26-bootstrap.mjs', '--static-only')
nodeScript('b22-static-prerequisite', 'scripts/runtime/b22-bootstrap.mjs', '--static-only')
nodeScript('g-static-prerequisite', 'scripts/runtime/g-bootstrap.mjs', '--static-only')
nodeScript('device-platform', 'scripts/runtime/validate-b27-device-platform.mjs')
nodeScript('quality-release', 'scripts/runtime/validate-b27-quality-release.mjs')
nodeScript('handoff', 'scripts/runtime/validate-b27-handoff.mjs')

const files = testFiles()
if (files.length > 0) run('b27-tests', process.execPath, ['--test', ...files])
nodeScript('contracts', 'scripts/contracts/validate-contracts.mjs')
nodeScript('contract-generation', 'scripts/contracts/generate-contracts.mjs')
nodeScript('fixed-port-registry', 'scripts/check-fixed-ports.mjs', '--registry-only')
nodeScript('runtime-config', 'scripts/check-runtime-config.mjs')
nodeScript('infra-static', 'scripts/check-local-infra.mjs', '--static-only')

if (!staticOnly || requireRuntime) {
  const required = new Set()
  for (const manifest of manifests) {
    if (fs.existsSync(path.join(root, manifest))) collectRequiredEnv(readJson(manifest), '', required)
  }
  const missing = [...required].filter((name) => !process.env[name])
  if (missing.length > 0) {
    console.error(`B27 runtime blocked: missing evidence variables: ${missing.join(', ')}`)
    failures.push('b27-runtime-config')
  } else if (required.size === 0) {
    console.error('B27 runtime blocked: manifests declare no runtime evidence variables')
    failures.push('b27-runtime-contract')
  } else {
    nodeScript('device-platform-runtime', 'scripts/runtime/validate-b27-device-platform.mjs', '--require-runtime')
    nodeScript('quality-release-runtime', 'scripts/runtime/validate-b27-quality-release.mjs', '--require-runtime')
    nodeScript('handoff-runtime', 'scripts/runtime/validate-b27-handoff.mjs', '--require-runtime')
  }
  console.log('B27 runtime does not install software, access real devices, deploy staging, promote an RC, or approve Go/No-Go implicitly.')
}

if (failures.length > 0) {
  console.error(`B27 bootstrap ${staticOnly ? 'static' : 'runtime preflight'} failed: ${failures.join(', ')}`)
  process.exitCode = 1
} else {
  console.log(`B27 bootstrap passed (${staticOnly ? 'static' : 'runtime preflight'}); device, staging, RC and handoff runtime evidence remains explicit.`)
}
