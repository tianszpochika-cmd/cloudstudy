# MB006 lifecycle GET suite — author checkpoint (repaired preparation)

Date 2026-10-20 (CST). **DSH author** wrote and repaired the test preparation; **Codex/Root independently executed run 1** and will audit/rerun. This is test preparation, not product acceptance and not whole-page sign-off. No product source, store, API, contract, service, Git, main progress, CHANGELOG or DSH configuration was changed. Latest quota stop line is **95%**, monitored by Root; DSH ran no browser and no product test.

## 1. Frozen product sources

C3 pair at task start: page raw `86620ed0dbc2cb25afb4bbae35734a345b9e8066afa806684f99ccb678a5312d`, i18n raw `6ac6800e179de0ba15ab3607918b2f8427d364e19306eaf8f2a146f016247380`. The 8-source freeze (adds learner-content API/store, session, auth/navigation, uni-runtime, uni.scss) is `source-freeze.json`; it was 0-drift at `2026-10-20T15:01:40Z`. **At the final check the page had externally drifted to `abff80cd1d16e8d688deb9ffdc3a7e0250577f10ef2dcd31ed9a5d6849a07d8c` (33125 bytes, mtime `2026-10-20T15:13:05Z`); i18n is unchanged.** DSH did not edit product source and did not update the freeze. The audit now correctly FAILs the freeze check and the suite refuses to start. See `SOURCE-DRIFT-20261020T1513Z.md`; Root must decide the freeze target.

## 2. Root run 1 (preserved, not rewritten)

`runs/codex-review-c3-lifecycle-1/` is unchanged, including 2 PNGs in `dirty-history-back/`.

- `same-owner-stale-get`: **BLOCKED_SETUP_INCOMPLETE**, 0 checks, 1 setup failure; `current.state.pending is not a function` (harness defect).
- `dirty-history-back`: **BLOCKED_SETUP_INCOMPLETE**, 1 PASS check, 1 notRun; actual `route=#/pages/login/login`, `confirmation=false`, `draftKept=false`. Root observed process **exit 1** despite the BLOCKED result — the exit-code defect documented below.
- Root reports 18183 was refreshed to the C3 module at 22:28. No stale-module assumption is used for lifecycle identity.
- `ROOT-RUN1-CLASSIFICATION.md` records the author classification without altering Root files: same-owner stays a harness BLOCKED_SETUP (not exercised); dirty-back's observed login-route/no-confirmation/draft-loss is a **measured H5 UX FAIL**, superseding the old NOT_RUN label while keeping the source-hook distinction.

Exact pre-repair scripts are archived in `archive-root-run1/` with `manifest.json`:

| script | SHA-256 | bytes |
|---|---|---|
| fixture.cjs (unchanged) | `4f9184a965367cc1baa5d8de811745a1273df404e675a8dcc44151af911d9a3e` | 13981 |
| lifecycle-lib.cjs (run 1) | `b116f0e3e2cf6e109c11b20c4cfe88bdd4187161b8f8d607dc549b3f27b0caa8` | 16438 |
| lifecycle-get.cjs (run 1) | `0dbea7b12285ea7e7e1f749a21fffaf7beaf76db00e73339d1f4ad5631a57dd6` | 18259 |

## 3. Repairs in the preparation (no product fix)

- All `current.state.pending()` calls → `current.pending()` (fixture item helper).
- `lifecycle-lib.execute` returns an `outcome` after `finally` (no return inside a nested finally); unexpected/harness errors are setup-incomplete, not product FAIL.
- Driver aggregation: `0` only executed scoped PASS with checks > 0; `1` only measured product FAIL; `2` for refusal/setup/NOT_RUN/empty/harness error. A late unhandled rejection cannot turn setup into exit 1.
- `q2Kept` positively validates the fixture's question 2 + `acceptedSequence=1` (projection item sequence/stem, DOM `aria-valuenow=1`, same stem/valuemax). Failure before releasing the old GET is **setup**, not a late-response product failure.
- `dirty-history-back` route-left is now a measured **H5 UX FAIL** (`dirty-back-unsent-draft-lost-on-browser-back`), not NOT_RUN. Detail keeps the source distinction: the browser-history path did not reach the `onBackPress` hook, so it does not prove the native/app callback is defective; the observed H5 draft loss remains C3 FAIL evidence.
- Removed the outdated stale-i18n assumption from the lifecycle verdict path.
- Added `shape-audit.cjs` (import-only, no browser) to catch helper-shape defects that `node --check` cannot.

Repaired scripts:

| script | SHA-256 | bytes |
|---|---|---|
| fixture.cjs | `4f9184a965367cc1baa5d8de811745a1273df404e675a8dcc44151af911d9a3e` | 13981 |
| lifecycle-lib.cjs | `3da70a7f0812a309a8650f7255204a3a7c9e0fac03b0cfe7988e5b29fed25e9b` | 16512 |
| lifecycle-get.cjs | `ad80d5e3d63fe8373c23e66cb69a0680acc90dd19c597f31f7bb9bf76afaafc6` | 20924 |
| shape-audit.cjs | `b06d32b1142b7c679984207c315ed2cb65e08dd656e391f3ba8bdb0e2cc0f6f5` | 4077 |

## 4. Checks DSH actually ran (no browser)

- `node --check` on `fixture.cjs`, `lifecycle-lib.cjs`, `lifecycle-get.cjs`, `shape-audit.cjs`: all exit **0**.
- `node shape-audit.cjs`: against `86620ed0` it was **PASS**, exit **0**; helper/exit/import checks still pass. At the final check it is **FAIL (exit 1) only on `source-freeze-8-and-matching`** because the page drifted to `abff80cd` externally. This is the audit doing its job, not a helper-shape regression. Output at `runs/shape-audit-result.json` (final FAIL); `SOURCE-DRIFT-20261020T1513Z.md` records the drift.
- No browser was launched; no case was executed by DSH. The repaired suite has **no DSH screenshots/results**; Root run-1 screenshots remain the only lifecycle images.

## 5. Current evidence status

- C3 `dirty-history-back`: **measured H5 FAIL evidence preserved** (login route, no confirmation, draft lost). Product fix is future work; this suite should keep failing it until fixed.
- `same-owner-stale-get`: the suspected same-owner held-GET overwrite remains **UNVERIFIED**; run 1 never reached it (harness defect). It is **not** prelabelled PASS or FAIL.
- `hidden-stale-get` / `cross-owner-late-get`: prepared, **NOT_RUN**.
- `native`, real backend/IAM/Gateway: **NOT_RUN**. Not whole-page.

## 6. Root next step

First resolve the page drift: the freeze targets `86620ed0`, the current page is `abff80cd` (external edit, unverified origin). The suite will refuse to start (exit 2) until Root either restores the frozen page or explicitly re-freezes/reviews the new hash; DSH must not update the freeze silently. Then Root reviews and reruns from `lifecycle-get.cjs` with a new run name (do not overwrite `codex-review-c3-lifecycle-1`). Expected outcomes are measured, not prewritten: same-owner should now execute; dirty-back should remain FAIL against the reviewed source. Read `README.md` for invocation and exit semantics.
