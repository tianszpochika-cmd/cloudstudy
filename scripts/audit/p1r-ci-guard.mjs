import fs from 'node:fs';
import path from 'node:path';
import {
  hasRequiredCiContractBaseline,
  inspectRequiredCiContractGate,
  REQUIRED_CI_CONTRACT_COMMANDS,
  REQUIRED_CI_CONTRACT_BASELINE_REF,
  REQUIRED_EVENT_GOVERNANCE_BASELINE_REF,
} from '../contracts/compatibility-git-baseline.mjs';

const root = process.cwd();
const errors = [];
const assertions = [];
const EXPECTED_EVENT_GOVERNANCE_BASELINE_REF = '868c2177f62b6d2cf613bed702686dddcfe6943f';

function assert(name, condition, failureDetail) {
  const passed = Boolean(condition);
  assertions.push({ name, passed, detail: passed ? 'verified' : failureDetail });
  if (!passed) errors.push(`${name}: ${failureDetail}`);
}

const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const mobilePackageJson = JSON.parse(fs.readFileSync(path.join(root, 'apps', 'mobile', 'package.json'), 'utf8'));

const contractGate = inspectRequiredCiContractGate(workflow);

assert('CI handles pull requests', /^\s*pull_request:\s*$/m.test(workflow), 'missing pull_request trigger');
assert('CI handles dev branch', /branches:\s*\[[^\]]*\bdev\b[^\]]*\]/m.test(workflow), 'push.dev is not configured');
assert('CI handles master branch', /branches:\s*\[[^\]]*\bmaster\b[^\]]*\]/m.test(workflow), 'push.master is not configured');
assert('CI has no placeholder job', !/placeholder|scaffold check|echo\s+["']?CI pipeline placeholder/i.test(workflow), 'placeholder-only CI is forbidden');
assert('CI is least privilege', /permissions:\s*\r?\n\s+contents:\s*read/m.test(workflow), 'top-level contents: read permission is required');
assert('CI tests Windows', /windows-latest/.test(workflow), 'Windows runner is required');
assert('CI tests Linux', /ubuntu-latest/.test(workflow), 'Linux runner is required');
assert('CI tests macOS frontend', /macos-latest/.test(workflow), 'macOS frontend runner is required');
assert('CI bootstraps fresh local infrastructure', /^\s*local-infrastructure:\s*$/m.test(workflow)
  && /pnpm infra:up/.test(workflow) && /check-local-infra.mjs --require-healthy/.test(workflow), 'fresh-volume infrastructure gate is required');
assert('CI runs workspace unit tests', /run:\s*pnpm test\s*$/m.test(workflow), 'workspace unit tests are required');
assert('CI tests mobile unavailable transport boundary', /run:\s*pnpm --filter @englishflow\/mobile test:b11\s*$/m.test(workflow), 'Mobile B11 transport regression is required');
assert('CI builds Mobile H5', /run:\s*pnpm --filter @englishflow\/mobile build:h5\s*$/m.test(workflow), 'Mobile H5 build gate is required');
assert('CI runs frozen install', /pnpm install --frozen-lockfile/.test(workflow), 'frozen pnpm install is required');
assert('CI runs Java tests', /mvn[^\r\n]*\stest\b/.test(workflow), 'Maven test gate is required');
assert('CI runs supply-chain gate', /p1r:supply-chain:check/.test(workflow), 'supply-chain gate is required');
assert('CI runs P1R evidence gate', /p1r:evidence:check/.test(workflow), 'P1R evidence gate is required');
assert('CI validates P1R fixtures', /p1r:fixtures:validate/.test(workflow) && /p1r:fixtures:audit/.test(workflow), 'P1R fixture validation and repository audit are required');
assert(
  'CI freezes the accepted contract baseline',
  hasRequiredCiContractBaseline(workflow),
  `contract baseline must remain ${REQUIRED_CI_CONTRACT_BASELINE_REF} until a separately accepted task advances it`,
);
assert(
  'CI freezes the immutable event governance baseline',
  REQUIRED_EVENT_GOVERNANCE_BASELINE_REF === EXPECTED_EVENT_GOVERNANCE_BASELINE_REF
    && hasRequiredCiContractBaseline(workflow),
  `event governance baseline must remain literal ${EXPECTED_EVENT_GOVERNANCE_BASELINE_REF} until separately accepted governance supersedes it`,
);
assert('CI has contracts-and-data job', contractGate.hasContractsAndDataJob, 'contracts-and-data job is required');
assert('CI fetches contract baseline history', contractGate.hasFullHistoryCheckout, 'contracts-and-data checkout must fetch full history for its Git baseline');
assert('CI contract job shape is frozen', contractGate.hasExactJobShape, 'contracts-and-data direct keys must remain the exact accepted name, runner, timeout, dependency, and steps shape');
for (const command of REQUIRED_CI_CONTRACT_COMMANDS) {
  assert(
    `CI runs exact contract gate: ${command}`,
    contractGate.commands[command],
    `contracts-and-data must run exactly once without comments, continuations, conditions, or continue-on-error: ${command}`,
  );
}
assert('CI has no parameterless compatibility command', !/^\s*- run:\s*pnpm contracts:compatibility\s*$/m.test(workflow), 'parameterless compatibility always fails closed');

for (const [name, command] of Object.entries({
  'contracts:merge:check': 'node scripts/contracts/merge-b1-fragments.mjs',
  'contracts:generate:check': 'node scripts/contracts/generate-contracts.mjs --check',
  'contracts:validate': 'node scripts/contracts/validate-contracts.mjs',
  'contracts:compatibility:git': 'node scripts/contracts/compatibility-git-baseline.mjs',
})) {
  assert(`package script ${name}`, packageJson.scripts?.[name] === command, `script must remain exactly: ${command}`);
}

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
