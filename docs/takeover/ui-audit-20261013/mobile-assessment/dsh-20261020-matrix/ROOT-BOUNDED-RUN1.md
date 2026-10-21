# ROOT-BOUNDED-RUN1 — C5c dark/HC helper correction

- Scope: **test helper correction only**, matrix dir. No product/browser/Git/server/source or measurement/contrast change.
- Root actual run: `codex-20261021-c5c-darkhc-1` — HC390 **MEASURED**; en dark 320 text200 **FAILED only** `report-from-real-submits`; 16 PNG, page/console errors 0. Root viewed the actual report and HC confirmation.
- This is a **harness-only** classification, not a product conclusion and not a whole-page PASS.

## Confirmed cause

`reportRaw.report.counted` used the whole `.assessment-result-facts` textContent, flattening sibling `<text>` nodes into `A2` + `70 points` + `7 correct out of 10 questions.` → `A270 points7 correct out of 10 questions.`; `/\b7\b/` cannot see the `7` after `points`. The actual UI has A2 / 70 / 7 correct out of 10 from the 10 real POSTs.

## Fix (only this assertion/evidence)

- `measure.cjs` now extracts the dedicated count paragraph: last `.assessment-description` inside `.assessment-result-facts` (template line 380, `v-if="countedReport"`), verifies visible + non-empty, and parses the exact localized sentence:
  - en `7 correct out of 10 questions.`
  - zh `答对 7 题，共 10 题。`
- Matrix asserts `count.visible === true`, `count.matched === true`, `count.parsed.full === 7`, `count.parsed.total === 10`; missing/unparsable/empty node → FAIL, not empty PASS. No broad `contains 7` (cannot match 70).
- Whole facts text is retained separately as `factsRaw` for trace; no API report/store injection. Existing fixture’s 10 real UI responses unchanged.

## Archive / hashes

Pre-correction bytes: `archive/pre-c5c-run1-helper-20261021/` + `archive-manifest.json`.

| file | correct hash | bytes |
|---|---|---|
| `scripts/matrix.cjs` | `a300896379f16ca1148c0157a9bcf38d7f7cef7fedc06dfbcba018e7e87786dc` | 53,063 |
| `scripts/measure.cjs` | `d337a0bbe0e9291a1ca3a731bbd6478d7fdadabf4bd143a795b255ae67dfc73d` | 33,063 |
| `scripts/coverage.cjs` | `2823bfc2c99d96dbd8d4b4796e3b76ee16d27a7649ac318c72f3ff04bbdea249` | 7,566 |

Preserved: `runs/codex-review-c3-darkhc-1/` (C3 FAIL/ERROR + old font200 harness record), `archive/pre-review-20261021/`, `archive/pre-c5c-20261021/`; `percent200→factor2`, restore/baseline/sanity, actual-clip vs viewport info, `text-outside-box`/`glyph-overflow` info, overlap/overflow/contrast thresholds unchanged.

`node --check` only. Remaining matrix tests NOT_RUN; Root reruns a unique id. No PASS claim for the planned matrix.
