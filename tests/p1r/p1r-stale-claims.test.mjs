import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkStaleClaims } from '../../scripts/audit/p1r-stale-claims-check.mjs';

// The check is a gate rule, so its own guarantee has to be tested rather than demonstrated once by hand. Each case
// mutates a COPY: the first version mutated the real repository, so a concurrently running gate read the test's
// intermediate state and reported failures that were not there, and a killed run left a file modified. The check takes
// a root now, so the mutations happen in a temporary directory holding copies at the same relative paths.
//
// A check that cannot fail is decoration, which is what the tenth review called the version that ran only when someone
// typed it.

const repositoryRoot = process.cwd();

/** The files the check reads, copied to a temporary root so nothing in the working tree is written. */
const copied = [
  'config/p1r-m2-requirement-owners.v1.json',
  'config/p1r-data-ownership.v1.json',
  'requirements/backlog/v2-phase1-rebaseline/02-编号任务台账.md',
  'requirements/backlog/v2-phase1-rebaseline/execution/REVIEW-REQUEST-P1R-M2-004.md',
  'requirements/backlog/v2-phase1-rebaseline/execution/status-trajectories.json',
  'evidence/p1r/m2/P1R-M2-004/review-history.json',
  'evidence/p1r/m2/P1R-M2-004/manifest.json',
];

function temporaryRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p1r-stale-claims-'));
  for (const relative of copied) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(repositoryRoot, relative), target);
  }
  return root;
}

/** Runs a case against a fresh copy and discards it, so there is nothing to restore. */
function runCase(mutate) {
  const root = temporaryRoot();
  try {
    mutate(root);
    return checkStaleClaims({ root });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const cases = [
  {
    name: 'a delivery claim for a requirement that was reassigned away',
    file: 'requirements/backlog/v2-phase1-rebaseline/execution/REVIEW-REQUEST-P1R-M2-004.md',
    mutate: (text) => `${text}\n\n| x | 已交付（本任务） | 改判 \`P1R-M2-006\` |\n`,
    expect: /claims delivery here/u,
  },
  {
    name: 'a stale artifact count',
    file: 'requirements/backlog/v2-phase1-rebaseline/execution/REVIEW-REQUEST-P1R-M2-004.md',
    mutate: (text) => text.replace(/\d+ artifacts/u, '7 artifacts'),
    expect: /says 7 artifacts/u,
  },
  {
    name: 'a review round the ledger does not record',
    file: 'requirements/backlog/v2-phase1-rebaseline/02-编号任务台账.md',
    mutate: (text) => text.replace(/\*\*第十二轮\*\*独立评审结论/u, '**第十五轮**独立评审结论'),
    expect: /does not record review rounds/u,
  },
  {
    name: 'an enumeration of round counts that stops short',
    file: 'requirements/backlog/v2-phase1-rebaseline/execution/REVIEW-REQUEST-P1R-M2-004.md',
    mutate: (text) => {
      const match = /（P0\/P1\/P2 = ([^）]*)）/u.exec(text);
      if (match === null) return text;
      const shortened = match[1].split('→').slice(0, 4).join('→');
      return text.replace(match[0], `（P0/P1/P2 = ${shortened}）`);
    },
    expect: /enumeration of round counts is incomplete/u,
  },
  {
    name: 'a round count written as an English word that is too small',
    file: 'requirements/backlog/v2-phase1-rebaseline/execution/status-trajectories.json',
    // Appended rather than substituted. The sentence this used to replace disappeared when delivering a task rewrote
    // the trajectory reason wholesale, so the substitution became a no-op — and the guard below is what reported that
    // rather than letting the case pass while testing nothing. Adding a line with the wrong numeral is a mutation
    // whether or not such a line is already there.
    mutate: (text) => `${text}\n  "probe": "Two independent reviews have returned REWORK",`,
    assertMutationTookEffect: true,
    expect: /have returned REWORK where the history/u,
  },
];

test('the stale-claims check passes on the repository as it stands', () => {
  const result = checkStaleClaims();
  assert.equal(result.result, 'PASS', result.errors.join('; '));
});

for (const scenario of cases) {
  test(`the stale-claims check fails on ${scenario.name}`, () => {
    let mutatedSomething = false;
    const result = runCase((root) => {
      const target = path.join(root, scenario.file);
      const before = fs.readFileSync(target, 'utf8');
      const after = scenario.mutate(before);
      mutatedSomething = after !== before;
      fs.writeFileSync(target, after);
    });
    if (scenario.assertMutationTookEffect === true) {
      // A mutation that changes nothing cannot be detected, and reporting that as a missing check would be wrong.
      assert.ok(result.errors.length > 0 || mutatedSomething, `${scenario.name}: the mutation changed nothing`);
    }
    assert.equal(result.result, 'FAIL', 'the mutation was not detected');
    assert.ok(result.errors.some((message) => scenario.expect.test(message)),
      `no error matched ${scenario.expect}: ${result.errors.join('; ')}`);
  });
}

test('the check leaves the working tree untouched', () => {
  const ledger = copied[2];
  const before = fs.readFileSync(path.join(repositoryRoot, ledger), 'utf8');
  runCase((root) => {
    fs.writeFileSync(path.join(root, ledger), 'mutated');
  });
  const after = fs.readFileSync(path.join(repositoryRoot, ledger), 'utf8');
  assert.equal(after, before, 'the repository was written to');
});
