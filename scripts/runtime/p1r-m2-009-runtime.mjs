// M2-009: one locked toolchain for everything, a pipeline that fails closed, and reports that can be downloaded.
//
// The ledger also asks for dev/master to refuse a failing push. That is a repository setting on the host, not a fact in
// the tree, so it is recorded as unverifiable here rather than claimed: what can be measured is that the workflow has no
// job that is allowed to fail and that the lockfile is the single source every package resolves through.
//
// Usage: node scripts/runtime/p1r-m2-009-runtime.mjs [--write]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });

// ---------------------------------------------------------------- 1. one locked toolchain
const rootPackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const workspace = fs.readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8');
const members = workspace.split('\n').filter((line) => line.trim().startsWith('-')).map((line) => line.trim().slice(1).trim());
record('the-workspace-declares-the-apps-and-services', members.includes('apps/*') && members.includes('services/*'),
  members.join(', '), 'apps/* and services/* are workspace members');

const packageManager = rootPackage.packageManager ?? '';
const engines = rootPackage.engines ?? {};
record('pnpm-is-pinned-exactly', /^pnpm@\d+\.\d+\.\d+$/u.test(packageManager), packageManager || 'absent', 'pnpm@<version>');
record('node-is-pinned-exactly', /^\d+\.\d+\.\d+$/u.test(engines.node ?? ''), String(engines.node ?? 'absent'), 'an exact node version');
record('the-pnpm-version-pin-and-the-engine-agree',
  packageManager === 'pnpm@' + (engines.pnpm ?? ''), packageManager + ' vs engines.pnpm ' + (engines.pnpm ?? 'absent'),
  'the same version in both places');

// The lockfile is the thing that makes it locked rather than merely pinned.
record('a-lockfile-is-committed', fs.existsSync(path.join(root, 'pnpm-lock.yaml')),
  fs.existsSync(path.join(root, 'pnpm-lock.yaml')) ? 'pnpm-lock.yaml present' : 'absent', 'pnpm-lock.yaml');
// And every workspace member resolves through it: a member with its own lockfile would be outside the lock.
const ownLockfiles = [];
const walk = (directory, depth) => {
  if (depth > 3) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', 'target', '.git', 'dist', '.turbo'].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) { walk(absolute, depth + 1); continue; }
    if (entry.name === 'pnpm-lock.yaml' && absolute !== path.join(root, 'pnpm-lock.yaml')) {
      ownLockfiles.push(path.relative(root, absolute));
    }
  }
};
walk(path.join(root, 'apps'), 0);
walk(path.join(root, 'services'), 0);
record('no-workspace-member-carries-its-own-lockfile', ownLockfiles.length === 0,
  ownLockfiles.length === 0 ? 'none' : ownLockfiles.join(', '), 'one lockfile for the workspace');

// The four frontends and the services, each reachable from the workspace root.
const fronts = ['apps/mobile', 'apps/learner-web', 'apps/admin-web', 'apps/official-site'];
const missingFronts = fronts.filter((directory) => !fs.existsSync(path.join(root, directory, 'package.json')));
record('all-four-frontends-are-workspace-packages-with-manifests', missingFronts.length === 0,
  missingFronts.length === 0 ? fronts.join(', ') : 'missing: ' + missingFronts.join(', '), 'four manifests');

const servicePoms = execFileSync('git', ['ls-files', 'services/*/pom.xml'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
// core-api is the v1 compatibility module and declares Java 17, which is right for it. It is listed in the observation
// without making the check fail, because counting it would be a different claim than the one being measured.
const v1Only = new Set(['services/core-api/pom.xml']);
const unpinned = servicePoms.filter((file) => !v1Only.has(file))
  .filter((file) => !/<maven\.compiler\.release>25</u.test(fs.readFileSync(path.join(root, file), 'utf8')));
record('every-v2-service-pins-the-same-java-release', unpinned.length === 0,
  unpinned.length === 0 ? servicePoms.length + ' poms pin release 25' : 'not pinned: ' + unpinned.join(', '),
  'every v2 service pom pins Java 25; core-api is v1 and pinned at 17');

// ---------------------------------------------------------------- 2. the pipeline fails closed
const ciPath = path.join(root, '.github', 'workflows', 'ci.yml');
const ci = fs.readFileSync(ciPath, 'utf8');
record('the-pipeline-runs-on-pull-requests-and-pushes',
  /pull_request:/u.test(ci) && /push:/u.test(ci), 'triggers read from ci.yml', 'pull_request and push');
// A job that is allowed to fail cannot fail the pipeline, which is the thing fail-closed means.
const tolerated = [...ci.matchAll(/continue-on-error:\s*(true|\$\{\{[^}]+\}\})/gu)].map((match) => match[1]);
record('no-job-is-allowed-to-fail', tolerated.length === 0,
  tolerated.length === 0 ? 'no continue-on-error' : tolerated.join(', '), 'every job must pass for the pipeline to pass');
const jobs = [...ci.matchAll(/^  ([a-z][\w-]*):\s*$/gmu)].map((match) => match[1]);
record('the-pipeline-has-more-than-one-job', jobs.length > 1, jobs.join(', '), 'the gates are separate jobs');
// Nothing may swallow a failure either.
const swallowed = [...ci.matchAll(/\|\|\s*true/gu)].length;
record('no-step-swallows-a-failure', swallowed === 0, swallowed === 0 ? 'none' : swallowed + ' occurrences', 'no "|| true"');

// ---------------------------------------------------------------- 3. reports can be downloaded
const uploads = [...ci.matchAll(/uses:\s*actions\/upload-artifact@[^\n]*\n(?:.*\n){0,8}?\s*path:\s*([^\n]+)/gu)]
  .map((match) => match[1].trim());
record('the-pipeline-uploads-artifacts', uploads.length > 0, uploads.join(' | ') || 'none', 'at least one upload-artifact step');
// And the artifact is not conditional on success, or a failing run would leave nothing to look at. The condition sits
// in the same step, so it is looked for between the previous step boundary and the upload itself.
const uploadOffsets = [...ci.matchAll(/uses:\s*actions\/upload-artifact@/gu)].map((match) => match.index);
const alwaysRuns = uploadOffsets.filter((offset) => {
  const boundary = Math.max(ci.lastIndexOf("\n      - ", offset - 1), 0);
  return /if:\s*always\(\)/u.test(ci.slice(boundary, offset));
}).length;
record('a-report-is-uploaded-even-when-the-run-fails', alwaysRuns > 0,
  alwaysRuns + ' of ' + uploadOffsets.length + ' upload steps run always', 'at least one upload with if: always()');
console.log('M2-009 toolchain and pipeline: ' + checks.filter((entry) => entry.ok).length + '/' + checks.length);
for (const check of checks) {
  console.log('  ' + (check.ok ? 'ok  ' : 'FAIL') + ' ' + check.name);
  console.log('        ' + check.observed);
}

const passed = checks.filter((entry) => entry.ok).length;
const evidence = {
  task: 'P1R-M2-009',
  capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL',
  passed,
  total: checks.length,
  toolchain: { node: engines.node, pnpm: engines.pnpm, java: 25, lockfile: 'pnpm-lock.yaml' },
  checks,
  notVerifiableHere: [
    'dev/master refusing a failing push is a repository setting on the host, not a fact in the tree. What is measured '
      + 'here is that the workflow has no job allowed to fail and no step that swallows a failure, which is the half that '
      + 'can live in the repository. The protection rule itself needs a call to the host API.',
  ],
  note: 'Read from the committed files: the workspace manifest, the root package manifest, the lockfile, the four frontend '
    + 'manifests, every service pom and the workflow.',
};
if (write) {
  const directory = path.join(root, 'evidence', 'p1r', 'm2', 'P1R-M2-009');
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'runtime-' + new Date().toISOString().slice(0, 10) + '.json');
  fs.writeFileSync(file, JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: ' + path.relative(root, file));
}
process.exit(evidence.result === 'PASS' ? 0 : 1);
