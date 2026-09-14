import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkStaleClaims } from '../../scripts/audit/p1r-stale-claims-check.mjs';

// The check is a gate rule now, so its own guarantee has to be tested rather than demonstrated once by hand. Each
// case mutates a file, runs the check and restores the file; a check that cannot fail is decoration, which is what
// the tenth review called the version that ran only when someone typed it.

const root = process.cwd();
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
    mutate: (text) => text.replace(/\*\*第九轮\*\*独立评审结论/u, '**第十一轮**独立评审结论'),
    expect: /does not record review rounds/u,
  },
];

test('the stale-claims check passes on the repository as it stands', () => {
  const result = checkStaleClaims();
  assert.equal(result.result, 'PASS', result.errors.join('; '));
});

for (const scenario of cases) {
  test(`the stale-claims check fails on ${scenario.name}`, () => {
    const absolute = path.join(root, scenario.file);
    const original = fs.readFileSync(absolute, 'utf8');
    try {
      fs.writeFileSync(absolute, scenario.mutate(original));
      const result = checkStaleClaims();
      assert.equal(result.result, 'FAIL', 'the mutation was not detected');
      assert.ok(result.errors.some((message) => scenario.expect.test(message)),
        `no error matched ${scenario.expect}: ${result.errors.join('; ')}`);
    } finally {
      fs.writeFileSync(absolute, original);
    }
  });
}
