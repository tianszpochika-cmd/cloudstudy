import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { compareContracts } from './compatibility-diff.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const contractPaths = {
  openapi: 'packages/contracts/openapi/v1/openapi.json',
  events: 'packages/contracts/events/v1/catalog.json',
  schema: 'packages/contracts/schemas/v1/registry.json',
};

function parseArgs(argv) {
  const args = { kind: 'all', json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--json') args.json = true;
    else if (value === '--help') args.help = true;
    else if (value === '--kind') args.kind = argv[++index];
    else if (value === '--ref') args.ref = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function defaultGit(args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  }).trimEnd();
}

function normalizeKind(kind) {
  if (kind === 'all') return Object.keys(contractPaths);
  if (kind in contractPaths) return [kind];
  throw new Error(`Unsupported contract kind: ${kind}`);
}

export function runGitBaselineCompatibility({
  ref,
  kind = 'all',
  git = defaultGit,
  readFile = (filePath) => fs.readFileSync(filePath, 'utf8'),
} = {}) {
  if (typeof ref !== 'string' || ref.trim().length === 0) {
    throw new Error('Compatibility --ref is required; use an accepted commit older than the current implementation commit.');
  }

  const baselineCommit = git(['rev-parse', '--verify', `${ref}^{commit}`]).trim();
  const currentCommit = git(['rev-parse', '--verify', 'HEAD^{commit}']).trim();
  const comparisons = normalizeKind(kind).map((contractKind) => {
    const relativePath = contractPaths[contractKind];
    const currentPath = path.join(repoRoot, ...relativePath.split('/'));
    const baselineText = git(['show', `${baselineCommit}:${relativePath}`]);
    const currentText = readFile(currentPath);

    const previous = JSON.parse(baselineText);
    const current = JSON.parse(currentText);
    const breakingChanges = compareContracts(contractKind, previous, current);
    return {
      identical: baselineText.trim() === currentText.trim(),
      result: {
      kind: contractKind,
      baseline: `git:${baselineCommit}:${relativePath}`,
      current: currentPath,
      breakingChanges,
      compatible: breakingChanges.length === 0,
      },
    };
  });

  if (baselineCommit === currentCommit && comparisons.every((comparison) => comparison.identical)) {
    throw new Error(
      `Compatibility baseline ${ref} resolves to the current HEAD and every selected contract is identical; choose an older accepted commit.`,
    );
  }
  const results = comparisons.map((comparison) => comparison.result);

  return {
    ref,
    baselineCommit,
    currentCommit,
    results,
    compatible: results.every((result) => result.compatible),
  };
}

function printHelp() {
  console.log('Usage: node scripts/contracts/compatibility-git-baseline.mjs --ref <older-commit> [--kind all|openapi|events|schema] [--json]');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      printHelp();
      process.exit(0);
    }
    const result = runGitBaselineCompatibility(args);
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else {
      for (const item of result.results) {
        console.log(`Git-baseline compatibility ${item.compatible ? 'passed' : 'failed'}: ${item.kind}, ${item.breakingChanges.length} breaking change(s).`);
      }
    }
    if (!result.compatible) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
