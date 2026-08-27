import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const args = new Set(process.argv.slice(2))
const staticOnly = args.has('--static-only')
const requireRuntime = args.has('--require-runtime') || process.env.G_REQUIRE_RUNTIME === '1'
const failures = []

const gates = [
  {
    id: 'G0',
    manifest: 'config/g0-scope-governance.json',
    validator: 'scripts/runtime/validate-g0-scope-governance.mjs',
  },
  {
    id: 'G1',
    manifest: 'config/g1-contract-data.json',
    validator: 'scripts/runtime/validate-g1-contract-data.mjs',
  },
  {
    id: 'G2',
    manifest: 'config/g2-implementation-interaction.json',
    validator: 'scripts/runtime/validate-g2-implementation-interaction.mjs',
  },
  {
    id: 'G3',
    manifest: 'config/g3-test-security-observability.json',
    validator: 'scripts/runtime/validate-g3-test-security-observability.mjs',
  },
  {
    id: 'G4',
    manifest: 'config/g4-release-rollback.json',
    validator: 'scripts/runtime/validate-g4-release-rollback.mjs',
  },
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
    console.error(`G bootstrap missing required script: ${script}`)
    failures.push(label)
    return false
  }
  return run(label, process.execPath, [scriptPath, ...scriptArgs])
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

for (const gate of gates) {
  if (!fs.existsSync(path.join(root, gate.manifest))) {
    console.error(`G bootstrap missing manifest: ${gate.manifest}`)
    failures.push(`${gate.id}-manifest`)
  }
  if (!fs.existsSync(path.join(root, gate.validator))) {
    console.error(`G bootstrap missing validator: ${gate.validator}`)
    failures.push(`${gate.id}-validator`)
  }
}

// The G gates are governance over the current Phase 1 baseline. Their static
// runner never changes traffic, data, credentials, or a release decision.
nodeScript('dod-check', 'scripts/check-dod.mjs', '--strict')
nodeScript('b22-static-prerequisite', 'scripts/runtime/b22-bootstrap.mjs', '--static-only')

const gateTests = path.join(root, 'tests', 'g')
if (!fs.existsSync(gateTests)) {
  console.error('G bootstrap missing test directory: tests/g')
  failures.push('g-tests')
} else {
  const testFiles = fs.readdirSync(gateTests)
    .filter((name) => name.endsWith('.test.mjs'))
    .sort()
    .map((name) => path.join(gateTests, name))
  if (testFiles.length < gates.length) {
    console.error(`G bootstrap expected at least ${gates.length} test files, found ${testFiles.length}`)
    failures.push('g-test-count')
  } else {
    run('g-tests', process.execPath, ['--test', ...testFiles])
  }
}

for (const gate of gates) nodeScript(`${gate.id}-validator`, gate.validator)
// B22 static prerequisite already runs contract validation, generation and
// compatibility as one serialized step; G1 additionally checks generated
// parity and ownership semantics without regenerating files a second time.
nodeScript('fixed-port-registry', 'scripts/check-fixed-ports.mjs', '--registry-only')
nodeScript('runtime-config', 'scripts/check-runtime-config.mjs')
nodeScript('task-baseline', 'scripts/audit/verify-v2-b7plus-task-baseline.mjs')

if (!staticOnly || requireRuntime) {
  // Runtime promotion is deliberately fail-closed and delegated to the
  // approved B22 prerequisite plus externally captured evidence references.
  nodeScript('b22-runtime-prerequisite', 'scripts/runtime/b22-bootstrap.mjs', '--require-runtime')
  const required = new Set()
  for (const gate of gates) {
    if (fs.existsSync(path.join(root, gate.manifest))) collectRequiredEnv(readJson(gate.manifest), '', required)
  }
  const missing = [...required].filter((key) => !process.env[key])
  if (missing.length > 0) {
    console.error(`G runtime blocked: missing external evidence variables: ${missing.join(', ')}`)
    failures.push('g-runtime-config')
  } else if (required.size === 0) {
    console.error('G runtime blocked: manifests do not declare required external evidence variables')
    failures.push('g-runtime-contract')
  } else {
    for (const gate of gates) nodeScript(`${gate.id}-runtime`, gate.validator, '--require-runtime')
  }
  console.log('G runtime never changes production traffic/data or approves Phase 1 implicitly; use approved runners with immutable evidence and named rollback owners.')
}

if (failures.length > 0) {
  console.error(`G bootstrap ${staticOnly ? 'static' : 'runtime preflight'} failed: ${failures.join(', ')}`)
  process.exitCode = 1
} else {
  console.log(`G bootstrap passed (${staticOnly ? 'static' : 'runtime preflight'}); no production state or Gate decision was changed.`)
}
