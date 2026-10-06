import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { parseArgs, REQUIRED_CI_CONTRACT_BASELINE_REF, REQUIRED_EVENT_GOVERNANCE_BASELINE_REF } from '../../scripts/contracts/compatibility-git-baseline.mjs';

const flags = ['--ref', REQUIRED_CI_CONTRACT_BASELINE_REF, '--governance-ref', REQUIRED_EVENT_GOVERNANCE_BASELINE_REF, '--kind', 'all', '--json'];

test('pnpm separator preserves the exact immutable compatibility flags', () => {
  assert.deepEqual(parseArgs(['--', ...flags]), parseArgs(flags));
  assert.throws(() => parseArgs(['--', ...flags, '--ignore-drift']), /Unknown argument/);
  assert.throws(() => parseArgs(['--', '--', ...flags]), /Unknown argument/);
});

test('compatibility CLI accepts the pnpm separator and still rejects missing baseline', () => {
  const help = spawnSync(process.execPath, ['scripts/contracts/compatibility-git-baseline.mjs', '--', '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /--ref <older-commit>/);
  const missing = spawnSync(process.execPath, ['scripts/contracts/compatibility-git-baseline.mjs', '--', '--json'], { encoding: 'utf8' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /--ref/);
});
