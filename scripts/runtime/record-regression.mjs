// Writes the regression record the M2-004 evidence cites.
//
// It lived in tmp/, which is ignored, so the figures in evidence/p1r/m2/P1R-M2-004/regression.json were produced by
// a script nobody else had and the file could not be regenerated from the repository. This is the same script with
// a home in the tree: it runs the suites and writes what they reported.
//
// Usage: node scripts/runtime/record-regression.mjs [--write]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Runs a suite command and reads the TAP totals it prints. */
function suite(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', windowsHide: true,
    shell: process.platform === 'win32' });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const read = (name) => Number(new RegExp(`^# ${name} (\\d+)`, 'mu').exec(output)?.[1] ?? -1);
  return { tests: read('tests'), pass: read('pass'), fail: read('fail'), skipped: read('skipped') };
}

const p1r = suite(process.execPath, ['scripts/dev/run-node-tests.mjs', 'tests/p1r']);
// The whole suite is recorded too, and -1 stands for a suite that did not report a total rather than a zero.
const all = suite(process.execPath, ['scripts/dev/run-node-tests.mjs', 'tests']);
const record = {
  schema: 'platform.p1r-regression.v1',
  capturedAt: new Date().toISOString(),
  tests: p1r.tests,
  pass: p1r.pass,
  fail: p1r.fail,
  skipped: p1r.skipped,
  suiteTests: all.tests,
  suitePass: all.pass,
  suiteFail: all.fail,
};
console.log(JSON.stringify(record, null, 2));
if (process.argv.includes('--write')) {
  const file = path.join(root, 'evidence/p1r/m2/P1R-M2-004/regression.json');
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`written: ${path.relative(root, file).replaceAll('\\', '/')}`);
}
