import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const assertions = [];

function assert(name, condition, failureDetail) {
  const passed = Boolean(condition);
  assertions.push({ name, passed, detail: passed ? 'verified' : failureDetail });
  if (!passed) errors.push(`${name}: ${failureDetail}`);
}

const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const mobilePackageJson = JSON.parse(fs.readFileSync(path.join(root, 'apps', 'mobile', 'package.json'), 'utf8'));

assert('CI handles pull requests', /^\s*pull_request:\s*$/m.test(workflow), 'missing pull_request trigger');
assert('CI handles dev branch', /branches:\s*\[[^\]]*\bdev\b[^\]]*\]/m.test(workflow), 'push.dev is not configured');
assert('CI handles master branch', /branches:\s*\[[^\]]*\bmaster\b[^\]]*\]/m.test(workflow), 'push.master is not configured');
assert('CI has no placeholder job', !/placeholder|scaffold check|echo\s+["']?CI pipeline placeholder/i.test(workflow), 'placeholder-only CI is forbidden');
assert('CI is least privilege', /permissions:\s*\r?\n\s+contents:\s*read/m.test(workflow), 'top-level contents: read permission is required');
assert('CI tests Windows', /windows-latest/.test(workflow), 'Windows runner is required');
assert('CI tests Linux', /ubuntu-latest/.test(workflow), 'Linux runner is required');
assert('CI runs frozen install', /pnpm install --frozen-lockfile/.test(workflow), 'frozen pnpm install is required');
assert('CI runs Java tests', /mvn[^\r\n]*\stest\b/.test(workflow), 'Maven test gate is required');
assert('CI runs supply-chain gate', /p1r:supply-chain:check/.test(workflow), 'supply-chain gate is required');
assert('CI runs P1R evidence gate', /p1r:evidence:check/.test(workflow), 'P1R evidence gate is required');
assert('CI validates P1R fixtures', /p1r:fixtures:validate/.test(workflow) && /p1r:fixtures:audit/.test(workflow), 'P1R fixture validation and repository audit are required');

for (const [name, command] of Object.entries(packageJson.scripts ?? {})) {
  if (!name.startsWith('test:')) continue;
  assert(`cross-platform ${name}`, !/node\s+--test\s+[^\r\n]*[*?\[\]{}]/.test(command), `shell-dependent test glob: ${command}`);
}

for (const name of ['test:b10', 'test:b11', 'test:b12']) {
  const command = mobilePackageJson.scripts?.[name];
  assert(`cross-platform mobile ${name}`, typeof command === 'string' && !/node\s+--test\s+[^\r\n]*[*?\[\]{}]/.test(command), `shell-dependent test glob: ${command ?? 'missing'}`);
}

for (const required of [
  'p1r:toolchain:check',
  'p1r:toolchain:static',
  'p1r:ci:check',
  'p1r:dependency:check',
  'p1r:supply-chain:check',
  'p1r:evidence:check',
  'p1r:fixtures:validate',
  'p1r:fixtures:audit',
  'test:p1r',
]) {
  assert(`package script ${required}`, typeof packageJson.scripts?.[required] === 'string', 'script is missing');
}

console.log(JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  result: errors.length === 0 ? 'PASS' : 'FAIL',
  assertions,
  errors
}, null, 2));
if (errors.length > 0) process.exitCode = 1;
