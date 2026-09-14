// Fails when a document contradicts the ownership file or the manifest.
//
// Eight reviews in a row found the same thing: a correction made where the review named it, with a sibling
// sentence left saying the opposite. Each was findable with one grep, and each was found by a reviewer rather
// than by the implementer, because the implementer checked the place that had been named. This script is the
// systematic version of that grep: it derives what the documents must say from the config and the manifest, then
// searches the repository for sentences that say otherwise.
//
// It is deliberately about claims that can be decided mechanically. Prose about what a test proves still needs a
// reader; who owns a requirement and how many rounds have happened do not.
//
// Usage: node scripts/audit/p1r-stale-claims-check.mjs [--json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Every tracked text file worth searching, excluding build output, the evidence of other tasks, this script
 * itself, and the two places that are dated records by design.
 *
 * A changelog and a ledger's dated entries quote the figures that were true when they were written; holding them
 * to today's numbers would be wrong, and searching this file for the patterns it defines would only find them.
 */
function documents() {
  const found = [];
  const skip = new Set(['node_modules', '.git', 'target', 'dist', 'build', '.nuxt', 'coverage', 'tmp']);
  const self = fileURLToPath(import.meta.url);
  const dated = new Set(['CHANGELOG.md']);
  // Everything from the ledger's dated entries onward is a historical record.
  const ledgerPath = path.join(root, 'requirements/backlog/v2-phase1-rebaseline/02-编号任务台账.md');
  const datedFrom = fs.existsSync(ledgerPath)
    ? fs.readFileSync(ledgerPath, 'utf8').indexOf('## 11. 日期条目')
    : -1;
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) { visit(absolute); continue; }
      if (!/\.(md|json|mjs|yaml|yml)$/u.test(entry.name)) continue;
      if (absolute.includes(`${path.sep}evidence${path.sep}`)) continue;
      // The test that proves this check can fail necessarily contains the strings it looks for, and so does this
      // file. Excluding them is not a hole: neither is evidence about the task.
      if (absolute === self || absolute.includes(`${path.sep}tests${path.sep}`) || dated.has(entry.name)) continue;
      found.push(absolute);
    }
  };
  visit(root);
  return { files: found, ledgerPath, datedFrom };
}

export function checkStaleClaims() {
  const errors = [];
  const { files, ledgerPath: ledgerFile, datedFrom } = documents();
  const read = (file) => fs.readFileSync(file, 'utf8');
  const rel = (file) => path.relative(root, file).replaceAll('\\', '/');

  // 1. A requirement the config assigns to another task must not be described anywhere as delivered by the task
  //    that asserted it.
  const ownersPath = path.join(root, 'config/p1r-m2-requirement-owners.v1.json');
  if (fs.existsSync(ownersPath)) {
    const owners = JSON.parse(fs.readFileSync(ownersPath, 'utf8'));
    const reassigned = (owners.requirements ?? []).filter((entry) => entry.ownerTask !== entry.assertedBy);
    // The sentences that asserted delivery here, kept as patterns rather than as prose.
    const deliveryClaims = [
      /已交付（本任务）/u,
      /归本任务并已实现/u,
      /owned by this task rather than reassigned/u,
      /delivered and verified here/u,
      /decided in favour of this task/u,
      /owned here, so it is verified here/u,
      /is delivered here by this task/u,
      /由本任务交付并已实现/u,
    ];
    // Per line, and the contradiction is inside the line. A file-level exemption meant any file naming an owner
    // task was immune, which covered the ledger, the execution record, the review request, the trajectory
    // registry and the changelog: exactly where these sentences live, so the rule could never fire on the shape
    // it was written for. The ninth review proved that by mutation after the implementer explained the same
    // result away as intended behaviour.
    //
    // Firing on every delivery claim is too broad in the other direction: "the tenant guard is delivered here at
    // the storage layer" is true, because that requirement is this task's. What is wrong is a line that claims
    // delivery here and names the task it was reassigned to, which is what the execution record did.
    for (const file of files) {
      const text = file === ledgerFile && datedFrom > 0 ? read(file).slice(0, datedFrom) : read(file);
      for (const [index, line] of text.split(/\r?\n/u).entries()) {
        const claim = deliveryClaims.map((pattern) => pattern.exec(line)).find((match) => match !== null);
        if (claim === undefined) continue;
        const reassignedHere = reassigned.filter((entry) => line.includes(entry.ownerTask));
        // Two shapes are contradictions: the line both claims delivery and names the owner it went to, or the
        // wording is the one that specifically denied the reassignment.
        const deniesReassignment = /owned by this task rather than reassigned|decided in favour of this task|owned here, so it is verified here|归本任务并已实现/u.test(claim[0]);
        if (reassignedHere.length === 0 && !deniesReassignment) continue;
        errors.push(`${rel(file)}:${index + 1}: claims delivery here while `
          + (reassignedHere.length > 0
            ? `naming ${reassignedHere.map((entry) => entry.ownerTask).join(', ')} as the owner`
            : 'denying the reassignment outright')
          + ` ("${claim[0]}")`);
      }
    }
  }

  // 2. Every task manifest's round count has to match the review history it embeds, and the history has to match
  //    the ledger's dated entries.
  const ledger = fs.existsSync(ledgerFile) ? read(ledgerFile) : '';
  const historyPath = path.join(root, 'evidence/p1r/m2/P1R-M2-004/review-history.json');
  if (fs.existsSync(historyPath)) {
    const history = JSON.parse(read(historyPath));
    const decided = history.rounds.filter((round) => round.verdict !== 'PENDING').length;
    // Derived from the history, and asserted against it. The count was hardcoded to seven, so a correct record
    // would have been reported wrong once the history grew; and a placeholder left behind by a later edit is
    // exactly the kind of thing this file exists to notice.
    const recordedRounds = history.rounds.length;
    const unknownVerdicts = history.rounds.filter((round) => !['REWORK', 'ACCEPTED', 'BLOCKED', 'PENDING'].includes(round.verdict));
    if (unknownVerdicts.length > 0) {
      errors.push(`review history has rounds with an unrecognised verdict: ${unknownVerdicts.map((round) => `${round.round}=${round.verdict}`).join(', ')}`);
    }
    // An enumeration that lists some of the rounds is the shape the tenth round's figures kept taking: correct at
    // the moment it was written and never extended. Counting them is mechanical, so it is checked.
    for (const file of files) {
      const text = file === ledgerFile && datedFrom > 0 ? read(file).slice(0, datedFrom) : read(file);
      for (const match of text.matchAll(/（P0\/P1\/P2 = ([^）]*)）/gu)) {
        const listed = match[1].match(/\d+\/\d+\/\d+/gu) ?? [];
        // A chain, not a single tuple: one parenthesised count describes one round, and flagging those would
        // report every sentence that mentions a verdict. The shape at issue is an enumeration joined by arrows.
        const chained = match[1].includes('→');
        if (chained && listed.length !== decided) {
          errors.push(`${rel(file)}: an enumeration of round counts is incomplete: it lists ${listed.length} where the history records ${decided} decided rounds`);
        }
      }
    }

    const tooManyPending = history.rounds.filter((round) => round.verdict === 'PENDING');
    if (tooManyPending.length > 1) {
      errors.push(`review history has ${tooManyPending.length} pending rounds (${tooManyPending.map((round) => round.round).join(', ')}): only the latest should be pending, so a placeholder was left behind`);
    }
    if (recordedRounds !== decided + tooManyPending.length) {
      errors.push(`review history records ${recordedRounds} rounds but ${decided} verdicts and ${tooManyPending.length} pending: the pending round is missing or duplicated`);
    }
    const numerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    const missing = history.rounds
      .filter((round) => round.verdict !== 'PENDING')
      .filter((round) => !ledger.includes(`**第${numerals[round.round - 1]}轮**独立评审结论`));
    if (missing.length > 0) {
      errors.push(`the ledger does not record review rounds the history records: ${missing.map((round) => round.round).join(', ')}`);
    }
    // Any document quoting a different number of reviews is stale.
    for (const file of files) {
      const text = file === ledgerFile && datedFrom > 0 ? read(file).slice(0, datedFrom) : read(file);
      const claim = /(\w+) independent reviews have returned REWORK/u.exec(text) ?? /(\d+) 轮 REWORK/u.exec(text);
      if (claim === null) continue;
      const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
      const stated = Number(claim[1]) || words[String(claim[1]).toLowerCase()];
      if (Number.isFinite(stated) && stated !== decided) {
        errors.push(`${rel(file)}: says ${stated} reviews have returned REWORK where the history records ${decided}`);
      }
    }
  }

  // 3. Figures a document quotes about the manifest have to match it.
  const manifestPath = path.join(root, 'evidence/p1r/m2/P1R-M2-004/manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(read(manifestPath));
    const artifacts = manifest.artifactDigests.length;
    const passing = manifest.results.filter((entry) => entry.status === 'PASS').length;
    const notApplicable = manifest.results.filter((entry) => entry.status === 'NOT_APPLICABLE').length;
    // Only the review request: it is the one document whose whole purpose is to describe this task's current
    // state. An execution record also mentions other tasks' manifests, so a figure inside it may legitimately
    // refer to something else, and telling which needs a reader. The ownership and round-count checks above are
    // unambiguous and run everywhere; this one admits its limit rather than guessing.
    const aboutThisTask = files.filter((file) => /REVIEW-REQUEST-P1R-M2-004/u.test(path.basename(file)));
    for (const file of aboutThisTask) {
      const text = file === ledgerFile && datedFrom > 0 ? read(file).slice(0, datedFrom) : read(file);
      for (const match of text.matchAll(/(\d+) artifacts/gu)) {
        if (Number(match[1]) !== artifacts) {
          errors.push(`${rel(file)}: says ${match[1]} artifacts where the manifest records ${artifacts}`);
        }
      }
      for (const match of text.matchAll(/(\d+) PASS \+ (\d+) NOT_APPLICABLE/gu)) {
        if (Number(match[1]) !== passing || Number(match[2]) !== notApplicable) {
          errors.push(`${rel(file)}: says ${match[1]} PASS and ${match[2]} NOT_APPLICABLE where the manifest records ${passing} and ${notApplicable}`);
        }
      }
    }
  }

  return { schema: 'platform.stale-claims-check.v1', checkedFiles: files.length, errors, result: errors.length === 0 ? 'PASS' : 'FAIL' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const report = checkStaleClaims();
  if (process.argv.includes('--json')) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    console.log(`stale-claims check: ${report.result} (${report.checkedFiles} files)`);
    for (const error of report.errors) console.log(`  - ${error}`);
  }
  process.exitCode = report.result === 'PASS' ? 0 : 1;
}
