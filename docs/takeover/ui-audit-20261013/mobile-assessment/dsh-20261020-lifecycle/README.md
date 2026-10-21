# MB006 lifecycle GET suite — repaired preparation (Root executes, DSH authored)

Status: **PREPARED / NOT RUN by DSH**. This directory is test-preparation only. It does not modify product source, store, API, contracts, services, Git or DSH configuration. The freeze targets page `86620ed0…` / i18n `6ac6800e…`. **At the final check the page had externally drifted to `abff80cd…` (33125 bytes, mtime `2026-10-20T15:13:05Z`), i18n unchanged; DSH did not edit it and did not update the freeze. The suite will therefore refuse to start until Root resolves the freeze target.** See `SOURCE-DRIFT-20261020T1513Z.md`.

## Role split and run history

- **DSH author**: wrote/fixed these scripts. DSH launched **zero browsers** for this suite. Only `node --check` and the import-only shape audit were run.
- **Root / Codex independent review**: executed the earlier version in `runs/codex-review-c3-lifecycle-1/`.
  - `same-owner-stale-get`: **BLOCKED_SETUP_INCOMPLETE**, 0 checks; harness defect `current.state.pending is not a function`.
  - `dirty-history-back`: **BLOCKED_SETUP_INCOMPLETE**, 1 check; actual route `#/pages/login/login`, `confirmation=false`, `draftKept=false`.
  - Root observed process exit **1** for both although the written result was BLOCKED. That was a harness exit-code defect.
- The exact scripts Root ran are preserved in `archive-root-run1/` with SHA-256 in `archive-root-run1/manifest.json`; Root's results/screenshots are unchanged.
- `ROOT-RUN1-CLASSIFICATION.md` reclassifies the measured dirty-back H5 draft loss as a FAIL without rewriting Root's JSON (which still carries the old NOT_RUN label); same-owner remains a harness BLOCKED_SETUP.
- Root reports 18183 was refreshed to the C3 module at 22:28. This suite does **not** rely on copy-string freshness for its identity assertions.

## Repairs after Root run 1

1. `current.state.pending()` → `current.pending()` (fixture exposes `pending()` on the item, not on `state`).
2. `lifecycle-lib.execute` now assigns `outcome` and returns it after `finally` (no return inside a nested `finally`); the driver catches runner rejection and sets:
   - `0` only when checks actually executed and all passed (`PASS_EXECUTED_CHECKS` with checks > 0);
   - `1` only for a measured product assertion failure;
   - `2` for refusal, setup incomplete, NOT_RUN, empty checks, or harness error.
   A late unhandled rejection cannot silently turn setup into exit 1.
3. `q2Kept` positively validates the fixture's own question 2 and `acceptedSequence=1` (projection item sequence/stem, DOM `aria-valuenow=1`, same stem, same `aria-valuemax`). A failure before release is recorded as **setup**, not as a late-response product failure.
4. `dirty-history-back` route-left is now a **measured H5 UX FAIL** (`dirty-back-unsent-draft-lost-on-browser-back`), not NOT_RUN. The detail keeps the distinction: this browser-history path did not reach the `onBackPress` source hook, so it does not prove the native/app callback is defective. The observed H5 behavior (login route, no confirmation, draft lost) is preserved as C3 FAIL evidence.
5. Removed the outdated "server may serve stale i18n" assumption from the lifecycle verdict path. Lifecycle identity is validated from fixture projection + DOM aria, not copy strings.

`shape-audit.cjs` is an **import-only** audit (no browser). It checks fixture exports/item helpers, that every `current.<helper>()` call exists on the fixture item, that `state.pending(` is absent, that the 8-source freeze matches, and that the lib/driver exit mapping is present.

## Cases and safe invocation

Each case is independently selectable and writes only `runs/<run>/<case>/` (never overwrites; `runs/` is inside this directory).

```powershell
$env:MB006_CONFIRM_BROWSER='1'
$env:MB006_LIFECYCLE_RUN='root-review-lifecycle-2'
$env:MB006_LIFECYCLE_EXECUTOR='codex-review'
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-lifecycle/lifecycle-get.cjs --case same-owner-stale-get
```

Cases: `same-owner-stale-get`, `hidden-stale-get`, `cross-owner-late-get`, `dirty-history-back`; omit `--case` to run all four.

## What each case actually does

- `same-owner-stale-get`: real login/guard → guide start → real settings header navigation (no draft) → hold GET1 → physical `page.goBack()` to assessment (GET1 held at Q1) → `page.goForward()` to settings → set `getDelay=0` → `page.goBack()` (GET2 completes) → real pointer select A + submit to Q2 → release old GET1 → assert Q2 question/accepted=1/session remain.
- `hidden-stale-get`: same first half; release old GET1 while settings is the real visible route; assert no page error and return still reads Q1/0.
- `cross-owner-late-get`: hold owner1 GET1 → real profile logout UI → real login fields for synthetic owner2 → release old GET1 → assert owner1's session/stem does not drive owner2's page. Only the fixture's synthetic server subject changes; no app store/token/storage assignment.
- `dirty-history-back`: unsent selection → physical browser back; expected source hook recorded, actual route/dialog/draft measured. Route-left with draft lost is a measured H5 FAIL.

## Preconditions / limits

- Requires Root-managed `http://127.0.0.1:18183` and Playwright Chromium. The suite does not start, stop or restart services and does not change ports.
- Synthetic API transport only; real login form/guard/browser history/pointer. No cookies/storage/headers/bodies/tokens read.
- `native` and `realBackend` remain **NOT_RUN**; this is not whole-page sign-off.
- Latest quota stop line is **95%**, monitored by Root. DSH does not run the suite or monitor quota.

## Files

- `fixture.cjs`, `lifecycle-lib.cjs`, `lifecycle-get.cjs`, `shape-audit.cjs`, `source-freeze.json`
- `archive-root-run1/` — exact pre-repair scripts + manifest
- `runs/codex-review-c3-lifecycle-1/` — Root run 1 (unchanged)
- `runs/shape-audit-result.json` — import-only audit output (PASS, exit 0)
