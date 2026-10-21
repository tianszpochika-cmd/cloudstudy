# PREP-20261021-STATES — bounded 4-case preparation

Date 2026-10-21 (CST). Scope: **DSH writes / Root audits and executes**. Test preparation only; no product source, Git, server, browser, native App, backend, IAM, DB or whole-page acceptance was touched or claimed.

## 1. Observed source state (not an approval)

[实测] `Get-FileHash` during preparation:

- page actual: `ac8fb8d2831f4d5f1f20091e09abef7cc6a1314021545ecbbb84a31d11f157fd` — **C6 in progress, NOT approved**.
- C5c old approved candidate: `719cc0cef407b492544b1bff39537324b0672126df287bf7d5644a25b6fe81c1` — historical candidate only.
- gate support values observed matching: i18n `6ac6800e…`, API `43ce2ad5…`, store `95cc9249…`, session `d944c9e8…`, nav `7365fec0…`, package `484382c7…`, lock `d57a87ca…`.

The driver has **no default page hash**. Root must pass the reviewed C6 hash through `MB006_STATES_EXPECTED_PAGE_SHA`; the observed C6-in-progress value is not adopted automatically.

## 2. Actual files (new SHA-256)

| file | bytes | lines | SHA-256 |
|---|---:|---:|---|
| `fixture.cjs` | 15517 | 166 | `ac5c55df75815a0cbfe52f4d459ffec2225f573a58528dd15dd4066fa5015caa` |
| `states-lib.cjs` | 18110 | 400 | `438dffdb4379a9d3a373663367b257802a8ba91bda445d3063411b5582c8e51d` |
| `states-verify.cjs` | 17245 | 249 | `4e2ff1a08ed0aa7d6e91b4e0215c4c7a82fdd35a5cc1a1f55711ebb02da23863` |
| `audit-shape.cjs` | 3632 | 42 | `363ca3c09539748797895a1a6a29d07cf9834d0a95de6f4cf71c4e163c561ef8` |
| `README.md` | 6326 | 73 | `97f67b9f0bbf1bcf334f05559d364919b0b2d5e5c74562ae4c2452ce63d485c1` |

Driver is 249 lines for four cases, deliberately not a generic framework.

## 3. Transport/helper diff

- `fixture.cjs` is a local copy of `dsh-20261020-risk/fixture.cjs`. Only additions: `state.refreshStatus`, `state.skippedRead`/`skippedProjection()`, `report.consoleWarnings`, `report.skippedReads`. The strict known-API list, unknown-route **501**, `targetReads` separation, exact `injectedFailures` metadata and console path-only classification are retained. No storage/cookie/token/header/session/store/guard/lifecycle-hook injection.
- `states-lib.cjs` is a trimmed local copy of `risk-lib.cjs`: env-page gate, fixed support/dependency hashes, unique run/`--case` guards, per-case DOM/routes/counts/PNG/console-error-and-warning capture, before/after source+dependency hashes, and exit 0/1/2.
- SKIPPED GET is served only after an actual start + reentry; it has `status`/`finalResult` SKIPPED, **no `reportId`**, no score/grade/level and no `currentItem`. It does not call a fake skip API, write the backend or ensure a plan.

## 4. Cases — prepared, pending Root execution

| case | status | key coverage |
|---|---|---|
| `start503-retry` | PREPARED / NOT_RUN | POST start 503; honest read-failed/retry-start; no question/report; retry is explicit second POST (counts 1→2). First-start idempotency GAP retained; retry not claimed read-only. |
| `read503-recovery` | PREPARED / NOT_RUN | actual `asess_` start; real settings + physical back with GET 503; honest read-failed/same-session reload; no POST start 2; repeated GET failure then success after real reload; no autowrite. Navigation block is a measured source-UI FAIL with route evidence, not a fixture workaround. |
| `skipped-read` | PREPARED / NOT_RUN | canonical SKIPPED GET after start+reentry; `#assessment-skipped` unverified copy; no A1/A2/score; no assessed report; no reportId/currentItem; ensure/respond/retest 0. UI fixture evidence only; quick-start contract GAP retained. |
| `restore401` | PREPARED / NOT_RUN | actual start → settings → return with explicit principal 401 + refresh 401; real guard login; no old question/report/skipped; no response/retest/ensure; no auth bypass. Only planned 401 console paths excludable; unknown 501 remains visible. Transient flash probe is NOT_RUN if full document navigation discards the observer. |

## 5. Validation actually run (no browser)

[实测]

- `node --check` on `fixture.cjs`, `states-lib.cjs`, `states-verify.cjs`, `audit-shape.cjs`: all exit 0.
- `node audit-shape.cjs` import-only: **PASS 14/14**, exit 0. Includes the unit check that a planned 401 is excluded but an unknown 501 is kept.
- Gate sanity: actual C6-in-progress page accepted only when explicitly passed; old C5c, a wrong 64-hex value, and a missing value all refused.
- Driver refusal: missing env → exit **2**; old C5c hash → exit **2**; unknown `--case` → exit **2**. No `runs/` directory was created and no browser was launched.
- NOT_RUN: all four browser cases, native App, real backend/IAM/DB/Gateway, whole-page acceptance.

## 6. Pending / NOT_RUN / GAP

- Root C6 review and explicit page-hash pass; no auto-accept.
- All four cases are **PREPARED / NOT_RUN** until Root executes them with a unique run id after C6 freeze.
- late-GET and same-store cross-owner races are **not constructed** and stay explicit **NOT_RUN**; no private hooks used.
- `start503` first-start idempotency and `skipped-read` quick-start contract are GAPs, not passes.
- `restore401` transient-flash probe may be NOT_RUN if a full document navigation discards the observer; final DOM is still asserted.
- No candidate PASS, no whole-page acceptance, no product fix.
