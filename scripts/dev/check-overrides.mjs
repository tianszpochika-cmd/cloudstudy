// Verifies the workspace overrides by reading what pnpm actually resolved, not by asking pnpm where
// it thinks the configuration lives.
//
// The previous method was `pnpm config get overrides`, which reports only the workspace-file source
// and returns undefined for overrides declared in package.json even while those overrides are in
// effect. That is how a submission came to claim the pins had been silently ignored. This check
// instead reads pnpm-lock.yaml, which is the artefact pnpm writes after it has applied the overrides,
// and asserts both halves: the lockfile records the override, and the resolved version in the
// dependency graph is the one the override asks for.
//
// Usage: node scripts/dev/check-overrides.mjs [--json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Minimal reader for the subset of YAML a pnpm lockfile uses: mappings, lists and scalars. */
function readLockfile(text) {
  const overrides = {};
  const packages = {};
  const lines = text.split(/\r?\n/u);
  let section = null;
  let currentKey = null;
  for (const line of lines) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    if (/^\S/u.test(line)) {
      section = line.replace(/:.*$/u, '').trim();
      currentKey = null;
      continue;
    }
    if (section === 'overrides') {
      const match = /^\s{2}(.+?):\s*(.*)$/u.exec(line);
      if (match) overrides[match[1].replace(/^['"]|['"]$/gu, '').trim()] = match[2].trim().replace(/^['"]|['"]$/gu, '');
      continue;
    }
    if (section === 'packages') {
      const entry = /^ {2}(\S.*?):\s*$/u.exec(line);
      if (entry) {
        currentKey = entry[1].replace(/^['"]|['"]$/gu, '');
        packages[currentKey] = {};
        continue;
      }
      const field = /^ {4}(version|resolution):\s*(.*)$/u.exec(line);
      if (field && currentKey) packages[currentKey][field[1]] = field[2].trim();
    }
  }
  return { overrides, packages };
}

/** The version pnpm resolved for a package. pnpm records it in the packages key, not in a field. */
function resolvedVersion(packages, name) {
  const candidates = Object.keys(packages).filter((key) => {
    const withoutPeer = key.split('(')[0];
    return withoutPeer === name || withoutPeer.startsWith(`${name}@`);
  });
  if (candidates.length === 0) return null;
  const versions = [...new Set(candidates.map((key) => {
    const withoutPeer = key.split('(')[0];
    if (withoutPeer === name) return packages[key].version ?? null;
    return withoutPeer.slice(name.length + 1);
  }).filter(Boolean))];
  if (versions.length === 0) return null;
  return versions.length === 1 ? versions[0] : versions;
}

/** Satisfies the small subset of range syntax the overrides use: exact, and >= with an optional bound. */
function satisfies(version, range) {
  if (version === null || version === undefined) return false;
  const clean = String(version).replace(/^['"]|['"]$/gu, '');
  if (/^\d/u.test(range)) return clean === range;
  const atLeast = /^>=\s*([\d.]+)/u.exec(range);
  if (atLeast) {
    const [wantMajor, wantMinor, wantPatch] = atLeast[1].split('.').map(Number);
    const [haveMajor, haveMinor, havePatch] = clean.split('.').map(Number);
    if (haveMajor !== wantMajor) return haveMajor > wantMajor;
    if (haveMinor !== wantMinor) return haveMinor > wantMinor;
    return havePatch >= wantPatch;
  }
  return false;
}

export function checkOverrides(root = repositoryRoot) {
  const workspace = fs.readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8');
  const lockfile = fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8');
  const declared = readLockfile(workspace).overrides;
  const { overrides: locked, packages } = readLockfile(lockfile);

  const checks = [];
  for (const [selector, range] of Object.entries(declared)) {
    const lockedRange = locked[selector];
    // A selector is either "parent>child", which scopes the pin to one parent's subtree, or a bare
    // package name, which applies everywhere that package is resolved.
    const scoped = selector.includes('>');
    const target = scoped ? selector.split('>').at(-1).trim() : selector;
    const version = resolvedVersion(packages, target);
    const instances = version === null ? [] : (Array.isArray(version) ? version : [version]);
    // A scoped pin is satisfied when the pinned version is present: without walking the dependency
    // graph the lockfile does not say which parent an instance came from, so requiring every postcss
    // copy to match a pin aimed at one parent would be wrong. A bare pin is global, so every instance
    // must satisfy it.
    const resolvedSatisfies = instances.length > 0 && (scoped
      ? instances.includes(range.replace(/^['"]|['"]$/gu, ''))
      : instances.every((entry) => satisfies(entry, range)));
    checks.push({
      selector,
      range,
      scoped,
      recordedInLockfile: lockedRange === range,
      lockedRange: lockedRange ?? null,
      target,
      resolvedVersions: instances,
      resolvedSatisfies,
    });
  }

  const errors = [];
  for (const check of checks) {
    if (!check.recordedInLockfile) {
      errors.push(`${check.selector}: pnpm-lock.yaml records ${check.lockedRange ?? '(nothing)'} rather than ${check.range}; run pnpm install`);
    }
    if (!check.resolvedSatisfies) {
      errors.push(`${check.selector}: resolved ${JSON.stringify(check.resolvedVersions)} does not satisfy ${check.range}`
        + (check.scoped ? ' (the pinned version is not present)' : ' (a global pin must hold for every instance)'));
    }
  }

  // The method this replaces would have passed on an empty result, which is exactly how a false
  // claim survived. An override set that reads as empty is a failure, not a pass.
  if (checks.length === 0) errors.push('no overrides were found in pnpm-workspace.yaml');

  return {
    schema: 'platform.overrides-check.v1',
    root: path.relative(process.cwd(), root).replaceAll('\\', '/') || '.',
    declaredCount: Object.keys(declared).length,
    checks,
    errors,
    result: errors.length === 0 ? 'PASS' : 'FAIL',
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const report = checkOverrides();
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    for (const check of report.checks) {
      const resolved = check.resolvedVersions.join(', ') || null;
      console.log(`${check.recordedInLockfile && check.resolvedSatisfies ? 'PASS' : 'FAIL'} ${check.selector.padEnd(46)} ${check.range.padEnd(12)} resolved=${resolved ?? '(not found)'}`);
    }
    console.log('');
    console.log(`overrides=${report.declaredCount} errors=${report.errors.length} result=${report.result}`);
    report.errors.forEach((error) => console.log(`  - ${error}`));
  }
  process.exitCode = report.result === 'PASS' ? 0 : 1;
}
