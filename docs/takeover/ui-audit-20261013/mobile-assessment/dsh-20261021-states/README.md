# MB006 STATES — bounded 4-case preparation

Date 2026-10-21 (CST). **DSH writes / Root audits and executes.** This directory is test preparation only. DSH did not launch a browser, touch product source, run Git, start a server, or claim a candidate PASS.

## Files

| file | purpose |
|---|---|
| `states-verify.cjs` | four readable cases; one browser run, unique output per run/case |
| `states-lib.cjs` | local copy/trim of the risk helper: gate, reporter, DOM/routes/counters/PNG, exit 0/1/2 |
| `fixture.cjs` | local copy of the risk fixture with only the transport additions below |
| `audit-shape.cjs` | import-only, no-browser shape audit |
| `runs/` | created only by Root execution; never pre-created by DSH |

## Gate — Root must pass the reviewed hash

`MB006_STATES_EXPECTED_PAGE_SHA` is required and must be exactly 64 hex characters. There is **no default page hash** and **no auto-accept**: the driver refuses with exit 2 before importing Playwright or creating a run directory when the env hash is missing, malformed, or does not match the current page.

Fixed support values (must match exactly):

- i18n `6ac6800e179de0ba15ab3607918b2f8427d364e19306eaf8f2a146f016247380`
- API `43ce2ad5d6519b5fab7e38867d1349b569d08b6153b74c87e5c96f11e24e1ae6`
- store `95cc92496db996242d91baed3301d76f985e4e3b9134e1e50c2b9ab8d41e4c61`
- session `d944c9e84617af5ad553d2fbc1fd0c07120ce790411dbe02603f9338333f8931`
- nav `7365fec07c55857445fdb1d87b60659734e9e94dc06cfb65afabcb3e8863a4b5`
- mobile package `484382c73929055cc4ecd9a83679f8bab72388dd8069f71a056b3bbc595c0078`
- lock `d57a87ca84985549fd53c69b1fe1d59db0b136036f2f7bf640d3b30c0a106624`

The current C5c page `719cc0ce…` is the approved old candidate, not a default. Root will pass the reviewed C6 hash only after C6 freeze.

Observed during preparation (2026-10-21): the actual page had already moved to `ac8fb8d2831f4d5f1f20091e09abef7cc6a1314021545ecbbb84a31d11f157fd` (C6 in progress, **not approved**). The gate accepted that value only when it was explicitly passed as `MB006_STATES_EXPECTED_PAGE_SHA`; it refused the old C5c value, a wrong value, and a missing value. No hash is adopted automatically.

## Run (Root only)

```powershell
$env:MB006_CONFIRM_BROWSER='1'
$env:MB006_STATES_EXPECTED_PAGE_SHA='<reviewed 64-hex page hash>'
$env:MB006_STATES_RUN='states-c6-review-1'      # unique; existing dir is refused
$env:MB006_STATES_EXECUTOR='root-review'
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261021-states/states-verify.cjs --case start503-retry
```

`--case` accepts exactly one of `start503-retry`, `read503-recovery`, `skipped-read`, `restore401`, or `all`. Unknown/duplicate/missing values refuse with exit 2. Each case writes `runs/<run>/<case>/results.json`, `manifest`-equivalent run summary `runs/<run>/run.json`, PNGs, routes, counts, DOM snapshots, console errors **and warnings**, injected-failure metadata, and before/after source+dependency hashes.

Exit codes: **0** only for a non-empty executed PASS; **1** only for a measured FAIL; **2** for refusal/setup/NOT_RUN/empty/drift. `finally` closes every context.

## Cases

1. **`start503-retry`** — normal guide; deliberate POST start 503; honest visible read-failed + `重试开始` retry, no question/report and no infinite busy box. Real retry click is a second POST start (counts 1 then 2) and may succeed. The unknown first-start idempotency/session GAP is recorded; retry is not claimed read-only.
2. **`read503-recovery`** — actual `asess_` start; normal settings button; physical `page.goBack()` with GET 503; honest read-failed + same-session reload, no second POST start. A repeated real reload remains failed; after clearing the flag a real reload recovers the question with no automatic write. Uses actual C6 nav controls; a navigation block is recorded as measured source-UI FAIL, not worked around.
3. **`skipped-read`** — actual start + settings reentry; fixture serves a canonical historical SKIPPED GET (`status`/`finalResult` SKIPPED, no `reportId`, no score/grade/level, no `currentItem`). Asserts `#assessment-skipped` unverified copy, no A1/A2/score, no assessed report, ensure 0. This is UI fixture evidence, not real backend business PASS; quick-start contract remains a GAP.
4. **`restore401`** — actual start; settings; return with explicit `principalStatus=401` and `refreshStatus=401`; real guard lands on the normal login screen. No old question/report/skipped, no response/retest/ensure write, no auth bypass. A DOM observer checks for transient question/report; if a full document navigation discards it, that probe is recorded NOT_RUN, not PASS. Only planned 401 resource failures are excludable by path/status; unknown statuses remain visible.

## Local fixture diff vs `dsh-20261020-risk/fixture.cjs`

Only transport additions; the risk fixture remains unchanged as history:

1. `state.refreshStatus` makes a planned refresh 401 an explicit flag and records `injectedFailures` metadata.
2. `state.skippedRead` + `skippedProjection()` serve the SKIPPED GET only after an actual start/reentry; no fake skip API call and no invented `reportId`/grade/score.
3. `report.consoleWarnings` (errors already existed) and `report.skippedReads` audit metadata.

The strict known-API list, unknown-route **501**, `targetReads` separation, exact injected metadata, and console path-only resource classification are retained. No storage, cookie, token, authorization-header, session, store, guard or lifecycle-hook injection was added.

## Helper diff vs `dsh-20261020-risk/risk-lib.cjs`

Trimmed local copy: env-page gate, fixed support/dependency hashes, unique run/`--case` guards, per-case reporter with DOM/routes/counts/PNG/console warnings, before/after source+dependency capture, and 0/1/2 exit semantics. No product code is imported except the real H5 app under the Root-managed server.

## Explicit NOT_RUN / GAP

- late-GET and same-store cross-owner races are **not constructed** here; they remain explicit NOT_RUN.
- Native App, real backend/IAM/DB/Gateway, whole-page acceptance and C6 product PASS are NOT_RUN.
- `start503` first-start idempotency and the skipped quick-start contract are GAPs, not passes.
- DSH did not execute any browser case. Root reviews this driver and executes after C6 freeze with a unique run id.
