import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const args = new Set(process.argv.slice(2))
const staticOnly = args.has('--static-only')
const requireRuntime = args.has('--require-runtime')
const failures = []

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
    console.error(`B19 bootstrap missing required script: ${script}`)
    failures.push(label)
    return false
  }
  return run(label, process.execPath, [scriptPath, ...scriptArgs])
}

function testFiles(directory) {
  const testDirectory = path.join(root, 'tests', directory)
  if (!fs.existsSync(testDirectory)) {
    failures.push(`${directory}-tests`)
    console.error(`B19 bootstrap missing test directory: tests/${directory}`)
    return []
  }
  return fs.readdirSync(testDirectory)
    .filter((name) => name.endsWith('.test.mjs'))
    .sort()
    .map((name) => path.join(testDirectory, name))
}

// B19 is a quality batch. Static mode proves the test contracts and runner boundaries;
// it never substitutes a synthetic fixture for a real service, browser, or device run.
// Invoke the Node bootstrap directly. On Windows, nesting pnpm.cmd inside a
// pnpm lifecycle can return a null status even when the child output is green.
nodeScript('b18-static-prerequisite', 'scripts/runtime/b18-bootstrap.mjs', '--static-only')
const b19Files = testFiles('b19')
if (b19Files.length > 0) run('b19-tests', process.execPath, ['--test', ...b19Files])
nodeScript('b19-fixtures', 'scripts/runtime/validate-b19-test-fixtures.mjs')
nodeScript('b19-browser-device-matrix', 'scripts/runtime/validate-b19-browser-device-matrix.mjs')
nodeScript('b19-quality-gates', 'scripts/runtime/validate-b19-quality-gates.mjs')
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
  nodeScript('b17-runtime-preflight', 'scripts/runtime/b17-bootstrap.mjs', '--require-runtime')
  const fixture = JSON.parse(fs.readFileSync(path.join(root, 'config', 'b19-test-fixtures.json'), 'utf8'))
  const browserMatrix = JSON.parse(fs.readFileSync(path.join(root, 'config', 'b19-browser-device-matrix.json'), 'utf8'))
  const required = [
    ...(fixture.runtimeGate?.requiredEnv ?? []),
    ...(browserMatrix.execution?.requiredRuntimeEnvironment ?? []),
  ]
  const missing = required.filter((key) => !process.env[key])
  if (missing.length > 0) {
    console.error(`B19 runtime blocked: missing test runtime variables: ${missing.join(', ')}`)
    failures.push('b19-runtime-config')
  } else {
    nodeScript('b19-fixture-runtime-gate', 'scripts/runtime/validate-b19-test-fixtures.mjs', '--require-runtime')
  }
  console.log('B19 runtime does not launch browsers or devices implicitly; use the approved runner after service and fixture preflight passes.')
}

if (failures.length > 0) {
  console.error(`B19 bootstrap ${staticOnly ? 'static' : 'runtime'} failed: ${failures.join(', ')}`)
  process.exitCode = 1
} else {
  console.log(`B19 bootstrap passed (${staticOnly ? 'static' : 'runtime preflight'}); no production credentials or data were changed.`)
}
