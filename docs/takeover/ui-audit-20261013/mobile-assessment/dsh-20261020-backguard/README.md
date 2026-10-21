# MB006 backguard suite — DSH prepared, Root executes (NOT_RUN)

Status at preparation: **DSH prepared this corrected suite and ran only `node --check`.
DSH did not launch a browser, product app, server, or Git command. Root execution is
NOT_RUN.** Existing `runs/codex-c5c-*` results are old evidence and are not rewritten or
upgraded; new results go only to a fresh Root run id.

This is one bounded suite for the C7b H5 Vue Router public `onBeforeRouteLeave` decision on
`apps/mobile/src/pages/assessment/assessment.vue`, using the existing
`assessment-leave-confirmation` buttons. Root approved C7b **for tests, not whole UI**.
Prior C7b `cancel-21` / `busy-18` / `clean-14` scoped PASS runs remain old-run evidence and
are not upgraded to a whole-page PASS. The first-prepared script/README and the C5b/C5c/C6b/C7b
scripts are preserved under `archive/`.

## Files

- `run.cjs` — the whole executable suite. It imports the reviewed sibling helpers directly:
  `../dsh-20261020-risk/fixture.cjs` (strict synthetic API transport, real login) and
  `../dsh-20261020-risk/risk-lib.cjs` (read-only DOM facts, real pointer input, error
  classification). It does not fork or copy the assessment page.
- `runs/<MB006_BACKGUARD_RUN>/` — created only by a Root execution: `results.json`,
  `manifest.json`, and per-state PNGs. An existing run directory is refused, never
  overwritten.
- `archive/pre-c5b-fix-20261020/` — immutable first-prepared `run.cjs` (sha256
  `1f1520f47615950ad2968641112bc869bcb47527b6ab410ac042bba052cd3d34`) and README
  (sha256 `836464c3ba61d06a2b5eee3c1401385732c026e66a2f32e2aca2e8e0bf9b22e6`), with
  `ARCHIVE-MANIFEST.json`.
- `archive/pre-c5c-fix-20261020/` — immutable C5b-gated `run.cjs` (sha256
  `dc643335ba4630178b79b70592468025bffa7d47a6b63626c6ef8d9d6b59b22d`) with
  `ARCHIVE-MANIFEST.json`. The Root refusal logs for `codex-c5c-cancel-1` / `busy-1`
  remain outside source and were not copied or modified.
- `archive/pre-repeat-native-dialog-20261021/` — immutable C5c `run.cjs` (sha256
  `752697764c021152cd8ce62c7b203d695cdd166dee1b888cae4b7b6e0bfc569b`) before the explicit
  browser-Dialog/repeat-native-accept update.
- `archive/pre-accept-secondback-20261021/` — immutable script before the first-SPA/second-back
  native-accept fix (sha256
  `24974fe06546bbdd1454473f95d85e7e3f2e2d5992b7da27b354ff44c6f8dcc8`).
- `archive/pre-repeat-confirm-20261021/` — immutable script before adding
  `repeat-back-confirm` (sha256
  `b8cccf0e0d76131230f41483555ac32c60b4b1788febc01575114a4001eb58bf`).
- `archive/pre-c6b-freeze-20261021/` — C5c final driver including `repeat-back-confirm`
  (sha256 `eeeaba129c355e5a171fd5d85cd3fd59f902be3acc36e2aeb2654079c0249001`) plus README
  and PREP freeze metadata, archived before the C6b page gate.
- `archive/pre-c7b-freeze-20261021/` — C6b final driver including `repeat-back-confirm`
  (sha256 `4b681b929636dd2b9ef253f082c857bf06e0e953e9e115f4768cc884e31e5569`) plus
  README/PREP/CHECKPOINT freeze metadata, archived before the C7b page gate.
- `archive/pre-dismiss-secondback-20261021/` — immutable script before the
  first-SPA/no-native, second-back/dismiss fix (sha256
  `d0efc37c6b9895e1ffa7c9c0c2347d719b3ef7a20beb22321de8a9b1737e273b`). Existing
  `runs/codex-c5c-busy-2`, `cancel-2`, `clean-1`, and `repeat-1` are old evidence and remain
  untouched.

## Execution contract (Root only)

```powershell
$env:MB006_CONFIRM_BROWSER     = '1'
$env:MB006_BACKGUARD_RUN       = 'root-backguard-20261020-1'   # unique, [a-z0-9-], <=64
$env:MB006_BACKGUARD_EXECUTOR  = 'root-review'
$env:MB006_BACKGUARD_EXPECTED_PAGE_SHA    = '37bad477e4239061972941c42b24468db5994b8afb89feb61f720fbe168c07e5'
$env:MB006_BACKGUARD_EXPECTED_PACKAGE_SHA = '484382c73929055cc4ecd9a83679f8bab72388dd8069f71a056b3bbc595c0078'
$env:MB006_BACKGUARD_EXPECTED_LOCK_SHA    = 'd57a87ca84985549fd53c69b1fe1d59db0b136036f2f7bf640d3b30c0a106624'

node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-backguard/run.cjs --case cancel-confirm
```

`--case` is independently selectable and accepts exactly one of
`cancel-confirm`, `busy-back`, `repeat-back`, `repeat-back-confirm`, `repeat-native-accept`,
`clean-back`. With no `--case`, all six run sequentially, each in a fresh browser context.

Exit codes: **2** = refused before launch, or setup incomplete/precondition not established
(real login/start, held request, or no observable back); **1** = measured FAIL or UX finding;
**0** only for `PASS_SCOPED_ACTUAL` with a non-empty set of actual checks.

### Pre-launch hash gate

Before `fixture.init()` (the only place a browser is launched), `run.cjs` requires:

1. `MB006_CONFIRM_BROWSER=1`, a unique run id, and an executor label.
2. The Root env hashes must equal the Root-approved C7b facts above, and the actual files
   must match them:
   - page `37bad477e4239061972941c42b24468db5994b8afb89feb61f720fbe168c07e5`
   - **`apps/mobile/package.json`** `484382c73929055cc4ecd9a83679f8bab72388dd8069f71a056b3bbc595c0078`
     (the mobile manifest C7b changed; this is what `EXPECTED_PACKAGE_SHA` means)
   - `pnpm-lock.yaml` `d57a87ca84985549fd53c69b1fe1d59db0b136036f2f7bf640d3b30c0a106624`
3. The root `package.json` is separately unchanged at
   `e2bf8a40f36d435116326383be7fff376cb5fe126420583affceca76fa2c03c4`; the suite refuses if
   the root manifest drifts. `dependencyBundle` is the mobile manifest + lock bundle;
   `rootManifest` is reported separately.
4. The five reviewed dependencies remain byte-identical:
   - `packages/i18n/src/mobile-experience.ts` `6ac6800e179de0ba15ab3607918b2f8427d364e19306eaf8f2a146f016247380`
   - `apps/mobile/src/api/learner-content.ts` `43ce2ad5d6519b5fab7e38867d1349b569d08b6153b74c87e5c96f11e24e1ae6`
   - `apps/mobile/src/stores/learner-content.ts` `95cc92496db996242d91baed3301d76f985e4e3b9134e1e50c2b9ab8d41e4c61`
   - `apps/mobile/src/stores/session.ts` `d944c9e84617af5ad553d2fbc1fd0c07120ce790411dbe02603f9338333f8931`
   - `apps/mobile/src/auth/navigation.ts` `7365fec07c55857445fdb1d87b60659734e9e94dc06cfb65afabcb3e8863a4b5`

The six freeze sources (assessment page, i18n, API, store, session, navigation), the mobile
manifest, the root manifest and the lock are re-hashed after the run. `sourceStable`,
`dependenciesStable`, `rootManifestStable`, and `closed` are reported; any drift is a
measured FAIL.

If the tree is not the approved C7b tree, the suite exits 2 before creating a run
directory or launching a browser.

## Explicit native browser dialog handling

The repeat cases install a Playwright `page.on('dialog')` listener before any real back.
Each event records **type, planned action, actual action, phase, and unexpectedness**; it
never records dialog message text, headers, tokens, or private data. `beforeunload` is
expected only in the two repeat cases: `repeat-back` dismisses it, `repeat-native-accept`
accepts it intentionally. An unexpected native `alert`/`confirm`/`prompt` is dismissed,
recorded, and fails the case; it is never broadly ignored. A browser-native warning is not
nativeApp acceptance.

## Pending-URL behavior while the guard awaits the decision

This is a required part of the measurement, not a waiver:

- After real back, the browser address bar can already read the destination (for example
  `#/pages/login/login`) while the assessment page, the current question/draft, and the
  `assessment-leave-confirmation` buttons are still the visible, interactive surface.
- While the leave callback is pending, the suite records URL/hash **raw** but asserts the
  **visible assessment root + kept A draft + prompt count**, not that the pending address
  bar still reads the assessment hash.
- Only after cancel has completed (or after the confirm decision has actually left) does
  the suite require the assessment URL. A cancel must restore the assessment URL, the same
  question, and selected A with zero `respond`/`retest`/`ensure`.
- The second back + confirm must actually leave to the prior app entry once there is no
  duplicate prompt. The actual landing route is recorded, not guessed.

## What each case measures

Every case creates a fresh context, logs in for real, starts the assessment with the real
`assessment-start` pointer press, and (except `clean-back`) selects A with a real pointer
press. It records actual `location.href`/`hash`, origin, request counts, `aria-busy`, option
`aria-pressed`/`disabled`, dialog count/visibility/buttons, and question text. It does not
read cookies, storage, tokens, request bodies, or headers, and does not replace
store/session/guard behavior or install DOM event hooks.

- **cancel-confirm**: physical back; the pending `page.goBack()` promise is held (never
  awaited before the decision). Wait for the visible confirmation, record the pending raw
  URL, cancel with the real button, settle the traversal. Asserts assessment URL restored,
  same question, A still selected, zero `respond`/`retest`/`ensure`, no dialog. A second
  physical back + real confirm must actually leave to an app entry, with no duplicate
  prompt.
- **busy-back**: hold the `responses` request, verify it is really held (pending delay,
  `respond === 1`, `aria-busy === true`), press physical back. Asserts the visible question
  and A draft remain, request count still 1, no confirmation, still busy (the pending
  address bar is recorded raw). Release, then assert one accepted response
  (`acceptedSequence === 1`), idle question, no extra writes. If the request was never
  held, the case is **SETUPFAILED**, never PASS.
- **repeat-back**: installs an explicit Playwright `page.on('dialog')` observer, sets the
  native `beforeunload` action to **dismiss**. The **first** SPA pop must show the custom
  confirmation with the visible assessment root/A and **no** native event; no native event is
  awaited there. The **second** physical back waits for and captures the actual native
  `beforeunload`, asserts **dismiss**, then a third back and forward are exercised. While
  pending, assertions are the visible assessment root, kept A draft, active focus, and
  exactly one prompt; the raw address bar may already be the destination. Missing native
  plus an actual document departure is a measured UX failure; no observed second traversal
  branch is setup-incomplete. Old pending-promise/`cannot navigate` facts are recorded; a
  genuine document/route departure or cleared choice is a measured UX failure, never waived.
  After custom cancel completes, the assessment URL must be restored, with A preserved and
  zero writes.
- **repeat-back-confirm**: reuses the dismiss/third-back/forward flow, then decides with
  **confirm** after forward. If the custom prompt is still visible, the real Confirm must
  actually leave once to a real app entry, with no prompt left behind and zero
  `respond`/`retest`/`ensure`; closing the prompt while the page remains unchanged fails. If
  the product auto-canceled the obsolete prompt when forward returned to the assessment,
  require the A choice and assessment URL to remain, then use a fresh real browser back plus
  real Confirm and require the same actual departure. Neither branch may pass from a missing
  native event or unobserved history.
- **repeat-native-accept**: independently selectable intentional-accept branch. The
  **first** physical back is the ordinary SPA pop and must show the custom confirmation with
  the assessment root and A draft; no native `beforeunload` should fire there. The **second**
  physical back crosses the document; the explicit dialog observer records the native
  `beforeunload` and chooses **accept**, then asserts actual accept, intentional document
  departure, and zero `respond`/`retest`/`ensure` writes. A first back that leaves without
  the custom prompt is a measured UX fail. If no native event occurs on the second back, the
  branch is setup-incomplete, never PASS. Browser-native warning acceptance is not nativeApp
  acceptance and is not a C7b UX failure.
- **clean-back**: start with no selection, press physical back. Asserts no prompt and an
  actual departure to an app entry, with zero assessment writes. `about:blank`/external
  departure is recorded as a UX finding and is not a pass.

### Missing prompt: measured failure vs setup incomplete

- If real back produces no prompt **and** the actual route/document left or the
  question/draft was lost, that is a **measured UX FAIL** (exit 1), not setup.
- If real back produces no prompt and there is genuinely no history/no observable back
  (still the visible assessment with the draft intact), that is **setup incomplete**
  (exit 2). It is never an empty PASS.
- A missing requirement to establish the precondition (login/start, held request) is also
  setup failed/incomplete (exit 2).

## Reporting and scope

`results.json` records scoped checks, case outcomes, observations, screenshots, transport
facts (counts, unexpected routes/501, injected failures, native-dialog events), before/after
hashes, `sourceStable`, `dependenciesStable`, `rootManifestStable`, `closed`, and
`SETUPFAILED`/`SETUPINCOMPLETE`/`UX_FINDING`/`NOT_RUN` entries.

- `NOT_RUN` is always recorded for native/Android back and for the real backend/IAM/DB/
  network. These are out of scope for this H5 synthetic-transport suite.
- Any scenario that cannot establish its precondition is setup failed/incomplete; it is
  never an empty PASS.
- No 503 is injected by this suite. Console-error exclusion is allowed only for an exact
  fixture-injected status on the exact injected resource path; unknown 501, page errors, and
  other console errors remain failures.
- `PASS_SCOPED_ACTUAL` means only that the selected, actually observed scoped checks passed.
  It is **not** a whole-page, C7b, design, native, or backend pass. `completion` is always
  `NOT_THE_WHOLE_PAGE`.

## Deliberate non-actions

No product launch, server start, Git command, external navigation, browser launch, or
secret use occurred during preparation. The only code validation was `node --check
run.cjs`; the approved hash targets were checked read-only with file hashing.
