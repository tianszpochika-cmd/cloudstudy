import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

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

function b17TestFiles() {
  const directory = path.join(root, 'tests', 'b17');
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith('.test.mjs'))
    .sort()
    .map((name) => path.join(directory, name));
}

nodeScript('b17-runtime-manifest', 'scripts/runtime/validate-b17-runtime-services.mjs');
run('b17-tests', process.execPath, ['--test', ...b17TestFiles()]);
nodeScript('contracts', 'scripts/contracts/validate-contracts.mjs');
nodeScript('fixed-port-registry', 'scripts/check-fixed-ports.mjs', '--registry-only');
nodeScript('runtime-manifest', 'scripts/runtime/validate-v2-runtime-manifest.mjs');

if (!staticOnly || requireRuntime) {
  nodeScript('toolchain', 'scripts/toolchain/check-toolchain.mjs');
  nodeScript('infra-runtime', 'scripts/check-local-infra.mjs', '--require-healthy');
  const required = [
    'B16_TEST_IDP_ISSUER_URI',
    'B16_TEST_IDP_JWKS_URI',
    'B16_TEST_IDP_AUTHORIZATION_ENDPOINT',
    'B16_TEST_IDP_TOKEN_ENDPOINT',
    'B17_KAFKA_BOOTSTRAP_SERVERS'
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`B17 runtime blocked: missing test runtime variables: ${missing.join(', ')}`);
    failures.push('b17-runtime-config');
  }
}

if (failures.length > 0) {
  console.error(`B17 bootstrap ${staticOnly ? 'static' : 'runtime'} failed: ${failures.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(`B17 bootstrap passed (${staticOnly ? 'static' : 'runtime preflight'}); no production credentials or data were changed.`);
}
