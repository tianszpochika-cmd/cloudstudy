# MB007 Matrix — POST-C7 5-SOURCE GUARD / NOT_RUN

- **Current status**: fifth guard added; this five-source script is `NOT_RUN`. Root’s C7 four-source full run is preserved at `dsh-20261021-matrix/runs/codex-20261021-c7-full-1/` and is **not** overwritten.
- **C7 four-source result**: complete 34 contexts, `CHECKS_GREEN`. This signs only the old named four-source scope; it is **not** upgraded to the final five-source combo.
- **C7 four-source prefixes**: `044948af` (home), `7e2ef7b5` (i18n), `c4ef9dd8` (store), `03b21bab` (runtime). Prefixes are Root facts only; matrix still requires full 64-hex values and does not accept prefixes.
- **New guard**: `EXPECTED_LEARN_SHA` for `apps/mobile/src/pages/learn/learn.vue` is mandatory raw, included in before/after source stability and evidence stability. No auto-accept, no fallback.
- **Product context**: real second-course new-code navigation FAIL; C7/L1 product author is narrowly fixing `learn.vue` onShow pending/owner. Home is not being changed.
- **C7 integrity facts**: `sourceStable=true`, `depsStable=true`, `evidenceStable=true`, `closed=true` are scope facts only, not acceptance.
- **Archived pre-fix script**: `mobile-home/archive/dsh-20261021-matrix-pre-c4-fix-1/matrix.cjs`.
- **Files changed this round**: only `matrix.cjs` and this `PREPARED.md`. No product, fixture, old result, Git, server, or browser change.

## Root must re-run after L1 freezes the fifth hash

```powershell
$env:MB007_CONFIRM_BROWSER = '1'
$env:EXPECTED_HOME_SHA = '<C7 frozen home.vue full 64-hex>'
$env:EXPECTED_I18N_SHA = '<C7 frozen mobile-experience.ts full 64-hex>'
$env:EXPECTED_STORE_SHA = '<C7 frozen learner-content.ts full 64-hex>'
$env:EXPECTED_RUNTIME_SHA = '<C7 frozen uni-runtime.ts full 64-hex>'
$env:EXPECTED_LEARN_SHA = '<L1 frozen learn.vue full 64-hex>'
$env:MB007_RUN_ID = 'mb007-matrix-l1-root-full-1'

node docs/takeover/ui-audit-20261013/mobile-home/dsh-20261021-matrix/matrix.cjs --case full
```

All five raw hash envs are mandatory; no fallback/auto-accept. Do not derive env values from the 8-character prefixes and do not reuse C7’s four-source scope as final acceptance. New run directories are mandatory; existing results are refused, never overwritten/deleted.

## Fixture reference

For the C4 smoke Root explicitly used:

`MB007_FIXTURE=docs/takeover/ui-audit-20261013/mobile-home/archive/qa-c3-before-reviewqueue-planlate-20261021/fixture.cjs`

Matrix default remains the current sibling QA fixture; it does **not** auto-switch references. The next QA-author-finished version must be supplied by Root via `MB007_FIXTURE` after Root verifies its hash. Confirmed API used: `init()` returns Browser; module `fresh({mode,...}) -> {page,context,state,close()}`, `report` object, `hashes()`/`close()` functions.

## Corrections made after Root C4 smoke

1. **controlOverlap false positives**
   - `rectOf` now returns serialized plain numbers `{x,y,width,height,top,right,bottom,left}`.
   - Pair intersection validates every rect field with `Number.isFinite`; missing/non-finite pairs are recorded as `controlOverlapNotMeasured` and the check becomes `NOT_MEASURED`, never NaN → product FAIL.
   - Nested control parent/child pairs are skipped; no parent-child containment counted as overlap.
   - Old C4 `12 pairs / overlapArea:null` is therefore a script artifact, not a product finding.

2. **focus.search false negative**
   - Real `Tab` is still used; no programmatic focus.
   - Target match is now `activeElement.matches(selector) || activeElement.closest(selector)`, so native `INPUT.uni-input-input` inside the `.home-search__input` host is recognised.
   - Native input has no own outline; focus ring is read from the `.home-search` wrapper (`:focus-within`, 2px purple), with the **adjacent outer background** (not the button/wrapper fill) used for contrast.
   - This matches Root's real sequence: settings → primary → secondary → search input; wrapper focus ring is the measured indicator.

3. **200% typography and contrast classification**
   - Text tier classification now divides computed font size by `plan.textScale`, so 32px is body (base 16), 28px auxiliary (base 14), 56px heading.
   - Body thresholds are `16*scale / 24*scale`; auxiliary `14*scale / 14*1.6*scale`; text minimum `14*scale`.
   - Contrast class uses `baselineFontSize = actual fontSize / plan.textScale`, not the enlarged actual px. Therefore a 32px body at 200% still counts as normal body and must meet **4.5:1**; an original H1 at 56px still counts as large and must meet **3:1**. Actual colors are unchanged; this does not lower body contrast.
   - Every sample records both `fontSize` (actual) and `baselineFontSize`, plus `textScale` and classification method.
   - If no normal-semantic body exists after baseline classification, the check is explicitly `not-applicable`; `not-measured` is reserved for unparsable colors/backgrounds, not for an empty classification bucket.
   - C5 en 320 200% previously returned `contrastNormal NOT_MEASURED` because all enlarged px were treated as large. That is fixed by the baseline classification; a re-run must still measure real colors and will retain any real failure.

4. **Placeholder and warnings**
   - Placeholder normal-text contrast remains strict `< 4.5` → FAIL until C6 changes it and a new run proves otherwise.
   - Console warnings/errors, pageerrors, 501/unknown API bodies/names remain verbatim; no broad whitelist.
   - 200% is CSS textscale, not browser layout zoom. Optional CDP page-scale is extra evidence only.

## Coverage / limits

- `smoke` 4; `full` 34 (32 normal + zh/en 200% short screens, one each); `all-visual` also adds independent fixture contexts `emptyNO_PLAN` and `home503`.
- Empty/error are never synthesized in the ready DOM. If `--limit` excludes them they stay `NOT_RUN`, never `PASS`.
- `--limit` produces `PARTIAL`; it cannot be labelled a whole-set pass.
- Screenshots per run: full page + first viewport; state/focus shots where measured. New directory only.

## Integrity gate

- Required raw hashes (5): `home.vue`, `mobile-experience.ts`, `learner-content.ts`, `uni-runtime.ts`, `learn.vue`.
- Evidence-only before/after snapshots: API, session, navigation, package/lock; `learn.vue` is also included in evidence stability because it is the fifth frozen target. Drift makes suite `INCOMPLETE` for Root review, no auto-upgrade.
- Exit codes: `0` checks green (not UI PASS); `1` setup/NOT_PREPARED; `2` hash/precondition refusal; `3` unknown API; `4` redline; `5` incomplete/NOT_MEASURED/drift/close failure; `6` partial.

## Explicitly not claimed

- The five-source post-C7 matrix has not been run; no screenshot, contrast, focus, or UI PASS claim from this author session.
- C7’s 34 contexts `CHECKS_GREEN` is a four-source named-scope result only; it is not the final five-source acceptance and is not relabeled by this guard change.
- Final check only: `node --check matrix.cjs` passed. No browser, no fixture execution, no Git, no product change.
- Root must independently review actual images, concept, font/focus facts, the L1 learn fix, and the final five-source run. The author does not sign UI.
