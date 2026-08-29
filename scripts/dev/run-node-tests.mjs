import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const inputs = process.argv.slice(2);

if (inputs.length === 0) {
  console.error('Usage: node scripts/dev/run-node-tests.mjs <test-file-or-directory> [...]');
  process.exit(2);
}

if (inputs.some((input) => /[*?\[\]{}]/.test(input))) {
  console.error('Shell globs are not accepted. Pass files or directories so discovery is identical on Windows and Linux.');
  process.exit(2);
}

function collect(candidate, files) {
  const absolute = path.resolve(root, candidate);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Test path does not exist: ${candidate}`);
  }
  const stat = fs.statSync(absolute);
  if (stat.isFile()) {
    if (!absolute.endsWith('.test.mjs')) throw new Error(`Test file must end with .test.mjs: ${candidate}`);
    files.add(absolute);
    return;
  }
  if (!stat.isDirectory()) throw new Error(`Unsupported test path: ${candidate}`);
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const child = path.join(absolute, entry.name);
    if (entry.isDirectory()) collect(child, files);
    else if (entry.isFile() && entry.name.endsWith('.test.mjs')) files.add(child);
  }
}

try {
  const files = new Set();
  for (const input of inputs) collect(input, files);
  const ordered = [...files].sort((left, right) => left.localeCompare(right, 'en'));
  if (ordered.length === 0) throw new Error(`No .test.mjs files found under: ${inputs.join(', ')}`);
  console.log(`[node-test] discovered ${ordered.length} test file(s)`);
  const result = spawnSync(process.execPath, ['--test', ...ordered], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true
  });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
} catch (error) {
  console.error(`[node-test] ${error.message}`);
  process.exit(2);
}
