import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const args = new Set(process.argv.slice(2))
const staticOnly = args.has('--static-only')
const requireRuntime = args.has('--require-runtime')
const failures = []
const requiredRuntimeEnv = [
  'B26_GATEWAY_ORIGIN',
  'B26_TEST_IDP_ISSUER',
  'B26_TEST_ACCESS_TOKEN',
  'B26_BROWSER_EVIDENCE_DIR',
  'B26_DB_RECONCILIATION_FILE',
  'B26_KAFKA_EVIDENCE_FILE',
]

function runNode(label, relativeScript, ...scriptArgs) {
  const script = path.join(root, relativeScript)
  if (!fs.existsSync(script)) {
    console.error(`B26 missing ${label}: ${relativeScript}`)
    failures.push(label)
    return false
  }
  const result = spawnSync(process.execPath, [script, ...scriptArgs], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
    windowsHide: true,
  })
  if (result.status !== 0) failures.push(label)
  return result.status === 0
}

function runTests() {
  const directory = path.join(root, 'tests', 'b26')
  if (!fs.existsSync(directory)) {
    failures.push('b26-tests')
    console.error('B26 missing tests/b26 directory')
    return false
  }
  const files = fs.readdirSync(directory)
    .filter((name) => name.endsWith('.test.mjs'))
    .sort()
    .map((name) => path.join(directory, name))
  if (files.length === 0) {
    failures.push('b26-tests')
    console.error('B26 has no test files')
    return false
  }
  const result = spawnSync(process.execPath, ['--test', ...files], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
    windowsHide: true,
  })
  if (result.status !== 0) failures.push('b26-tests')
  return result.status === 0
}

runNode('browser-matrix', 'scripts/runtime/validate-b26-browser-test.mjs')
runNode('event-runtime', 'scripts/runtime/validate-b26-event-runtime.mjs')
runNode('journey', 'scripts/runtime/replay-b26-journey.mjs', '--mode=preview', '--summary')
runTests()
runNode('contract-merge', 'scripts/contracts/merge-b1-fragments.mjs', '--write')
runNode('contract-validation', 'scripts/contracts/validate-contracts.mjs')
runNode('contract-generation', 'scripts/contracts/generate-contracts.mjs')
runNode('fixed-port-registry', 'scripts/check-fixed-ports.mjs', '--registry-only')
runNode('b25-static-prerequisite', 'scripts/database/validate-b25-data.mjs', '--mode', 'static')
runNode('infra-static', 'scripts/check-local-infra.mjs', '--static-only')

if (!staticOnly || requireRuntime) {
  const missing = requiredRuntimeEnv.filter((name) => !process.env[name])
  if (missing.length > 0) {
    console.error(`B26 runtime blocked: missing runtime variables: ${missing.join(', ')}`)
    failures.push('b26-runtime-config')
  } else {
    runNode('infra-runtime', 'scripts/check-local-infra.mjs', '--require-healthy')
  }
}

if (failures.length > 0) {
  console.error(`B26 bootstrap ${staticOnly ? 'static' : 'runtime preflight'} failed: ${failures.join(', ')}`)
  process.exitCode = 1
} else {
  console.log(`B26 bootstrap passed (${staticOnly ? 'static' : 'runtime preflight'}); runtime browser/DB/Kafka evidence is not implicitly approved.`)
}
