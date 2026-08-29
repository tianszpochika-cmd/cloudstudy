import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = new Set(process.argv.slice(2));
const allowed = new Set(['--static-only', '--require-runtime']);
const unknown = [...args].filter((arg) => !allowed.has(arg));

function usage() {
  console.error('Usage: node scripts/runtime/b30-bootstrap.mjs [--static-only | --require-runtime]');
  console.error('  --static-only     validate the self-owned JWT contract without network calls');
  console.error('  --require-runtime run the static contract and the IAM/Gateway JWT lifecycle probe');
}

function run(script, scriptArgs = []) {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'runtime', script), ...scriptArgs], {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
    windowsHide: true,
    stdio: 'inherit',
  });
  return result.status ?? 1;
}

if (unknown.length > 0 || (args.has('--static-only') && args.has('--require-runtime')) || args.size === 0) {
  usage();
  process.exitCode = 2;
} else if (args.has('--static-only')) {
  process.exitCode = run('b30-static-check.mjs');
} else {
  const staticStatus = run('b30-static-check.mjs');
  process.exitCode = staticStatus === 0 ? run('b30-runtime-probe.mjs') : staticStatus;
}
