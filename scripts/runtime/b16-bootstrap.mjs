import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const staticOnly = args.has('--static-only');
const requireRuntime = args.has('--require-runtime');
const failures = [];

function run(label, command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    stdio: 'inherit'
  });
  if (result.status !== 0) failures.push(label);
  return result.status === 0;
}

function nodeScript(label, script, ...scriptArgs) {
  return run(label, process.execPath, [path.join(root, script), ...scriptArgs]);
}

nodeScript('b16-security-manifest', 'scripts/runtime/validate-b16-security-manifest.mjs');
run('b16-static-tests', process.execPath, ['--test', path.join(root, 'tests/b16/b16-platform.test.mjs')]);
nodeScript('contracts', 'scripts/contracts/validate-contracts.mjs');
nodeScript('fixed-port-registry', 'scripts/check-fixed-ports.mjs', '--registry-only');
nodeScript('runtime-manifest', 'scripts/runtime/validate-v2-runtime-manifest.mjs');

if (!staticOnly || requireRuntime) {
  nodeScript('toolchain', 'scripts/toolchain/check-toolchain.mjs');
  nodeScript('infra-runtime', 'scripts/check-local-infra.mjs', '--require-healthy');
  const required = [
    'B16_JWT_ISSUER_URI',
    'B16_JWT_JWKS_URI',
    'B16_JWT_AUDIENCE'
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`B16 runtime blocked: missing IAM JWT variables: ${missing.join(', ')}`);
    failures.push('jwt-runtime-config');
  }
}

if (failures.length > 0) {
  console.error(`B16 bootstrap ${staticOnly ? 'static' : 'runtime'} failed: ${failures.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(`B16 bootstrap passed (${staticOnly ? 'static' : 'runtime preflight'}); no production credentials or data were changed.`);
}
