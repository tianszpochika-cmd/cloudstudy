import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = new Set(process.argv.slice(2));
const allowed = new Set(['--static-only', '--require-runtime']);
const unknown = [...args].filter((arg) => !allowed.has(arg));

if (unknown.length > 0 || (args.has('--static-only') && args.has('--require-runtime'))) {
  console.error('Usage: node scripts/runtime/b29-bootstrap.mjs [--static-only | --require-runtime]');
  process.exitCode = 2;
} else {
  const validatorArgs = args.has('--static-only') ? ['--static-only'] : ['--require-runtime'];
  const result = spawnSync(process.execPath, [
    path.join(repositoryRoot, 'scripts', 'runtime', 'validate-b29-backend-runtime.mjs'),
    ...validatorArgs,
  ], {
    cwd: repositoryRoot,
    env: process.env,
    encoding: 'utf8',
    windowsHide: true,
    stdio: 'inherit',
  });
  process.exitCode = result.status ?? 1;
}
