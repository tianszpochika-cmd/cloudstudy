import { spawnSync } from 'node:child_process'
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
  return run(label, process.execPath, [path.join(root, script), ...scriptArgs])
}

function pnpmScript(label, ...commandArgs) {
  return run(label, process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', commandArgs)
}

nodeScript('b18-cross-app-tests', 'tests/b18/b18-cross-app.test.mjs')
nodeScript('b18-frontend-matrix-tests', 'tests/b18/b18-frontend-matrix.test.mjs')
nodeScript('contracts', 'scripts/contracts/validate-contracts.mjs')
nodeScript(
  'contract-compatibility',
  'scripts/contracts/compatibility-git-baseline.mjs',
  '--ref', '463c4b238caceb1592bff6c61327c00ab9bac922',
  '--governance-ref', '868c2177f62b6d2cf613bed702686dddcfe6943f',
  '--kind', 'all',
)
nodeScript('fixed-port-registry', 'scripts/check-fixed-ports.mjs', '--registry-only')
nodeScript('runtime-config', 'scripts/check-runtime-config.mjs')
nodeScript('frontend-test-matrix', 'scripts/runtime/validate-b18-frontend-matrix.mjs')

if (!staticOnly || requireRuntime) {
  pnpmScript('b17-runtime-preflight', 'b17:bootstrap', '--require-runtime')
  const required = [
    'B18_LEARNER_TEST_ORIGIN',
    'B18_ADMIN_TEST_ORIGIN',
    'B18_OFFICIAL_SITE_TEST_ORIGIN',
    'B18_MOBILE_TEST_ORIGIN',
    'B18_TEST_ACCOUNT_MATRIX',
  ]
  const missing = required.filter((key) => !process.env[key])
  if (missing.length > 0) {
    console.error(`B18 runtime blocked: missing frontend test matrix variables: ${missing.join(', ')}`)
    failures.push('frontend-test-matrix')
  }
  console.log('B18 runtime does not launch browsers implicitly; use the approved browser/fixture runner after runtime preflight passes.')
}

if (failures.length > 0) {
  console.error(`B18 bootstrap ${staticOnly ? 'static' : 'runtime'} failed: ${failures.join(', ')}`)
  process.exitCode = 1
} else {
  console.log(`B18 bootstrap passed (${staticOnly ? 'static' : 'runtime preflight'}); no production credentials or data were changed.`)
}
