# CHECKPOINT-20261021-STATES-STATIC-FIX

Date 2026-10-21 (CST). Scope: **new `dsh-20261021-states/` only**. Static repair only; Root has not executed the browser cases.

## 1. Root static finding

Root's static audit found a TDZ self-shadow in `states-lib.cjs` inside `snapshot(page, name)`:

```js
const facts = await facts(page);
```

The local `const facts` binding shadows the `facts()` collector for the whole block, so the initializer would throw before any DOM evidence was captured.

## 2. Fix applied

- Renamed only the local snapshot variable to `domFacts`; the `facts()` collector itself is unchanged.
- All DOM fields (`route`, `root`, `busy`, `bodyLen`, `present`, `options`) still come from the same collector, and `snapshot()` still returns the captured facts.
- No case, assertion, selector, fixture transport flag, gate, exit semantic, product file, other test directory, Git state, server or browser was changed.
- `PREP-20261021-STATES.md` remains the preparation-time record. Its `states-lib.cjs` hash `438dffdb…` is historical; after the first static fix it was `04a1594e…`; after the second static repair in section 6 the current value is `26a7f7ba…` below.

## 3. Same-directory self-shadow scan

A static scan of all four new scripts for same-name initializers (`const/let/var X = [await] X(...)`) returns **zero hits**:

- `fixture.cjs`: none
- `states-lib.cjs`: none (the single previous hit is fixed)
- `states-verify.cjs`: none
- `audit-shape.cjs`: none

## 4. Validation actually run

- `node --check` on `fixture.cjs`, `states-lib.cjs`, `states-verify.cjs`, `audit-shape.cjs`: **all exit 0**.
- `node audit-shape.cjs` (import-only, no browser): **PASS**, exit **0**.
- Same-name-initializer scan: **0 hits**, exit 0.
- **NOT_RUN**: all four browser cases, native App, real backend/IAM/DB/Gateway, whole-page acceptance. No `runs/` directory was created.

## 5. Current files / source status

| item | value |
|---|---|
| `states-lib.cjs` | `26a7f7ba5784ea9090b6373095e8b21597471afd70f5149d16023e9449f25572` (19454 bytes) |
| current page | `ac8fb8d2831f4d5f1f20091e09abef7cc6a1314021545ecbbb84a31d11f157fd` (C6b) |
| C5c old candidate | `719cc0cef407b492544b1bff39537324b0672126df287bf7d5644a25b6fe81c1` |

The current C6b page hash `ac8fb8d2…` has been **Root statically approved for testing only**. It is not a UI signoff, not a candidate PASS and not an automatic gate default. Root will still pass it explicitly through `MB006_STATES_EXPECTED_PAGE_SHA` when executing; the gate continues to refuse missing, wrong and old C5c values.

Root executes the reviewed cases later with a unique run id. This checkpoint does not predeclare any case result.

## 6. Second static repair (Root follow-up)

Root found three further script errors; all were fixed in this directory only.

1. **`attachFixture` argument mismatch.** All 10 call sites in `states-verify.cjs` passed the fixture module `f`, while `attachFixture` reads `fixtureReport.requests`, `.pageErrors`, etc. They now go through one `finishCase(reporter, fixtureModule, current)` helper that passes `fixtureModule.report`. The fixture module itself is unchanged.
2. **FAIL misclassified as SETUP.** `execute` previously set `measuredFail = true` for a FAIL and then also set `setup = true` because `report.result !== 'PASS'`. It is now an explicit two-way split: `if FAIL measuredFail; else if !== PASS setup`. A small exported `classifyRun()` gives executed FAIL → `FAIL`/exit **1**, real setup or empty → `SETUP_INCOMPLETE`/exit **2**, non-empty PASS → `PASS_EXECUTED_CHECKS`/exit **0**. `run.json` keeps `measuredFail` and `setupIncomplete`; a mixed run keeps result `FAIL` and flags the setup, so neither is concealed.
3. **Generic transport audit was missing on the first three cases.** A shared `finishCase()` now calls `reporter.auditTransport()` for every case, including the first three. Each case fails on any unexpected API, page error, or console error not exactly matched by an injected method/path/status. Planned 401/503 lines are excluded only by exact path and status; there is no Object/blanket 503 exclusion. Warnings remain named under `consoleWarnings` with `warningsStatus: RECORDED_NAMED|NONE`.

The `snapshot()` TDZ fix from section 2 remains in place.

### Second-round validation (static only)

- `node --check` on all four scripts: exit 0.
- `node audit-shape.cjs` (import-only, no browser): **PASS**, exit 0. It now covers `classifyRun()` FAIL/SETUP/PASS/empty outcomes and the `attachFixture(fixtureModule.report)` wiring.
- No browser, no `runs/` directory, no product/Git/server change.

| file | bytes | SHA-256 |
|---|---:|---|
| `states-lib.cjs` | 19454 | `26a7f7ba5784ea9090b6373095e8b21597471afd70f5149d16023e9449f25572` |
| `states-verify.cjs` | 17153 | `8dedbb973fd4d8d986eb2acfe95b689543bbff0c8a3736d3e8fdafbb3fbea275` |
| `audit-shape.cjs` | 4777 | `096c6520a9f91815e41f3b8fcc69a1c3a230e77968208dde822df149733a6ab9` |
| `fixture.cjs` | 15517 | `ac5c55df75815a0cbfe52f4d459ffec2225f573a58528dd15dd4066fa5015caa` |

The current C6b page `ac8fb8d2…` remains **Root statically approved for testing only**, not a UI signoff or candidate PASS. PREP keeps its preparation-time state; this checkpoint records the later static repairs and hash supersessions.
