// Derives the round counts that appear in prose from the review history.
//
// These figures were corrected by one-off scripts kept in tmp/, which is ignored, so the derivation was not in the
// repository and the sentences could drift again the moment a round was recorded. The check catches the drift — it
// fired on "says 11 reviews where the history records 12" — but catching it is not the same as not writing it.
//
// Usage: node scripts/runtime/sync-review-figures.mjs [--write]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');

const historyPath = 'evidence/p1r/m2/P1R-M2-004/review-history.json';
const history = JSON.parse(fs.readFileSync(path.join(root, historyPath), 'utf8'));
const decided = history.rounds.filter((round) => round.verdict !== 'PENDING');
const rework = decided.filter((round) => round.verdict === 'REWORK').length;
const tuples = decided.map((round) => `${round.counts.P0}/${round.counts.P1}/${round.counts.P2}`);
const words = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
const numerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];

if (decided.length > words.length) {
  console.error(`the history has ${decided.length} decided rounds; the word lists cover ${words.length} and need extending`);
  process.exit(1);
}

/** Every sentence that states a round count, replaced with the value the history holds. */
const edits = [
  {
    file: 'requirements/backlog/v2-phase1-rebaseline/execution/status-trajectories.json',
    apply: (text) => text.replace(
      /(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty) independent reviews have returned REWORK[^"]*/u,
      `${words[rework - 1]} independent reviews have returned REWORK (${tuples.join(', then ')}); all ${decided.length} are recorded in ${historyPath}`),
  },
  {
    file: 'requirements/backlog/v2-phase1-rebaseline/execution/REVIEW-REQUEST-P1R-M2-004.md',
    apply: (text) => {
      let next = text;
      for (const match of [...next.matchAll(/（P0\/P1\/P2 = ([^）]*)）/gu)]) {
        if (!match[1].includes('→')) continue;
        next = next.replace(match[0], `（P0/P1/P2 = ${tuples.join(' → ')}）`);
      }
      next = next.replace(/\d+ 轮 P0 全部为 0/gu, `${decided.length} 轮 P0 全部为 0`);
      next = next.replace(/\d+ 轮判定与计数/gu, `${decided.length} 轮判定与计数`);
      next = next.replace(/前 ?\d+ ?轮/gu, `前 ${decided.length} 轮`);
      return next;
    },
  },
  {
    file: 'requirements/backlog/v2-phase1-rebaseline/02-编号任务台账.md',
    apply: (text) => {
      let next = text;
      const anchor = '## 12. 任务卡执行模板';
      for (const round of decided) {
        const heading = `**第${numerals[round.round - 1]}轮**独立评审结论`;
        if (next.includes(heading) || !next.includes(anchor)) continue;
        next = next.replace(anchor, [
          `### 2026-09-14 —— \`P1R-M2-004\` ${heading}：**${round.verdict}**（P0/P1/P2 = ${round.counts.P0}/${round.counts.P1}/${round.counts.P2}）`,
          '', '> **补记**：`review-history.json` 已记录本轮而台账缺失。台账是验收基准，两者必须一致。', '',
          `**评审提交**：\`${round.reviewedCommit}\`。`, '', '---', '', anchor,
        ].join('\n'));
      }
      return next;
    },
  },
];

let changed = 0;
for (const edit of edits) {
  const absolute = path.join(root, edit.file);
  const before = fs.readFileSync(absolute, 'utf8');
  const after = edit.apply(before);
  if (before === after) { console.log(`unchanged  ${edit.file}`); continue; }
  changed += 1;
  if (write) fs.writeFileSync(absolute, after);
  console.log(`${write ? 'updated  ' : 'would update'} ${edit.file}`);
}
console.log(`\n${decided.length} decided rounds, ${rework} rework verdicts, ${tuples.length} tuples; ${changed} file(s) ${write ? 'written' : 'to write'}`);
if (!write) console.log('nothing written; pass --write to apply');
