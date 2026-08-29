import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const outputDirectory = path.join(root, 'evidence', 'p1r', 'm0', 'devex');

function runNode(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
    maxBuffer: 16 * 1024 * 1024
  });
  return {
    command: `node ${args.join(' ')}`,
    exitCode: result.status,
    stdout: String(result.stdout ?? '').trim(),
    stderr: String(result.stderr ?? '').trim()
  };
}

function parseJson(command) {
  try { return JSON.parse(command.stdout); } catch { return null; }
}

const staticToolchainCommand = runNode(['scripts/dev/p1r-toolchain-check.mjs', '--static-only']);
const runtimeToolchainCommand = runNode(['scripts/dev/p1r-toolchain-check.mjs']);
const ciGuardCommand = runNode(['scripts/audit/p1r-ci-guard.mjs']);
const portsCommand = runNode(['scripts/check-fixed-ports.mjs']);
const crossPlatformTestCommand = runNode(['scripts/dev/run-node-tests.mjs', 'tests/b2/integration-b2.test.mjs']);
const dependencyPath = path.join(outputDirectory, 'dependency-governance.json');
const dependency = fs.existsSync(dependencyPath) ? JSON.parse(fs.readFileSync(dependencyPath, 'utf8')) : null;

const staticToolchain = parseJson(staticToolchainCommand);
const runtimeToolchain = parseJson(runtimeToolchainCommand);
const ciGuard = parseJson(ciGuardCommand);
const sourceCommitCommand = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true });
const sourceCommit = sourceCommitCommand.status === 0 ? sourceCommitCommand.stdout.trim() : 'unknown';

const tasks = {
  'P1R-M0-003': {
    implementationResult: staticToolchainCommand.exitCode === 0 && portsCommand.exitCode === 0 ? 'PASS' : 'FAIL',
    gateResult: runtimeToolchainCommand.exitCode === 0 ? 'PASS' : 'BLOCKED',
    staticToolchain: staticToolchain?.result ?? 'INVALID_OUTPUT',
    runtimeToolchain: runtimeToolchain?.result ?? 'INVALID_OUTPUT',
    runtimeErrors: runtimeToolchain?.errors ?? [],
    fixedPorts: portsCommand.exitCode === 0 ? 'PASS' : 'FAIL'
  },
  'P1R-M0-005': {
    implementationResult: ciGuardCommand.exitCode === 0 && crossPlatformTestCommand.exitCode === 0 ? 'PASS' : 'FAIL',
    gateResult: ciGuardCommand.exitCode === 0 && crossPlatformTestCommand.exitCode === 0 ? 'PASS' : 'BLOCKED',
    ciGuard: ciGuard?.result ?? 'INVALID_OUTPUT',
    crossPlatformNodeTest: crossPlatformTestCommand.exitCode === 0 ? 'PASS' : 'FAIL'
  },
  'P1R-M0-006': {
    implementationResult: dependency && fs.existsSync(path.join(outputDirectory, 'sbom-node.cdx.json')) && fs.existsSync(path.join(outputDirectory, 'sbom-maven.cdx.json')) ? 'PASS' : 'FAIL',
    gateResult: dependency?.result === 'PASS' ? 'PASS' : 'BLOCKED',
    dependencyAudit: dependency?.result ?? 'MISSING',
    licenses: dependency?.licenses ?? null,
    vulnerability: dependency?.vulnerability ?? null,
    mavenSbom: dependency?.mavenSbom ?? null
  }
};

const blocked = Object.values(tasks).some((task) => task.gateResult !== 'PASS');
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceCommit,
  decision: blocked ? 'BLOCKED' : 'PASS',
  scope: ['P1R-M0-003', 'P1R-M0-005', 'P1R-M0-006'],
  tasks,
  commands: {
    staticToolchain: { command: staticToolchainCommand.command, exitCode: staticToolchainCommand.exitCode },
    runtimeToolchain: { command: runtimeToolchainCommand.command, exitCode: runtimeToolchainCommand.exitCode },
    ciGuard: { command: ciGuardCommand.command, exitCode: ciGuardCommand.exitCode },
    ports: { command: portsCommand.command, exitCode: portsCommand.exitCode },
    crossPlatformNodeTest: {
      command: crossPlatformTestCommand.command,
      exitCode: crossPlatformTestCommand.exitCode,
      outputTail: crossPlatformTestCommand.stdout.split(/\r?\n/).slice(-12)
    }
  },
  blockers: [
    ...(runtimeToolchain?.errors ?? []),
    ...(dependency?.errors ?? [])
  ],
  notes: [
    'PASS here records executable evidence only; it does not update the P1R task ledger or replace independent review.',
    'Runtime checks intentionally return non-zero when a required toolchain or high-risk dependency condition is not satisfied.'
  ]
};

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, 'devex-verification.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (blocked) process.exitCode = 1;
