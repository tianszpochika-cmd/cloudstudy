import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const node = process.execPath;

const steps = [
  ['verify machine-readable security and telemetry policies', ['scripts/security/verify-policies.mjs']],
  ['scan synthetic fixtures', ['scripts/security/scan-synthetic-fixtures.mjs']],
  ['run contract and integration tests', [
    '--test',
    'tests/contract/api-envelope.test.mjs',
    'tests/contract/telemetry-contract.test.mjs',
    'tests/contract/telemetry-compatibility.test.mjs',
    'tests/integration/security-boundary.test.mjs',
  ]],
];

for (const [label, args] of steps) {
  console.log(`\n[B0] ${label}`);
  const result = spawnSync(node, args, { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.error) {
    console.error(`[B0] failed to start: ${result.error.message}`);
    process.exitCode = 1;
    break;
  }
  if (result.status !== 0) {
    console.error(`[B0] failed with exit code ${result.status ?? 'unknown'}`);
    process.exitCode = result.status ?? 1;
    break;
  }
}

if (!process.exitCode) {
  console.log('\n[B0] harness passed without external services.');
}
