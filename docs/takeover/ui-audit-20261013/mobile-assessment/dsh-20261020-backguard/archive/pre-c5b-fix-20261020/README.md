# MB006 backguard suite — DSH prepared, Root executes (NOT_RUN)

Status at preparation: **DSH prepared this suite and ran only `node --check`. DSH did not
launch a browser, product app, server, or Git command. Root execution is NOT_RUN.**
This directory contains no `results.json` until Root runs it.

This is one bounded suite for the C5 H5 Vue Router public `onBeforeRouteLeave` decision on
`apps/mobile/src/pages/assessment/assessment.vue`, using the existing
`assessment-leave-confirmation` buttons. C5 was **not frozen** when this was prepared, so
**no expected C5 page hash is written here** and no C5 behavior is claimed. The suite must
refuse to start until Root supplies hashes taken from the verified C5 tree.

## Files

- `run.cjs` — the whole executable suite. It imports the reviewed sibling helpers directly:
  `../dsh-20261020-risk/fixture.cjs` (strict synthetic API transport, real login) and
  `../dsh-20261020-risk/risk-lib.cjs` (read-only DOM facts, real pointer input, error
  classification). It does not fork or copy the assessment page.
- `runs/<MB006_BACKGUARD_RUN>/` — created only by a Root execution: `results.json`,
  `manifest.json`, and per-state PNGs. An existing run directory is refused, never
  overwritten.

## Execution contract (Root only)

```powershell
$env:MB006_CONFIRM_BROWSER     = '1'
$env:MB006_BACKGUARD_RUN       = 'root-backguard-20261020-1'   # unique, [a-z0-9-], <=64
$env:MB006_BACKGUARD_EXECUTOR  = 'root-review'
$env:MB006_BACKGUARD_EXPECTED_PAGE_SHA    = '<verified C5 page sha256, 64 hex>'
$env:MB006_BACKGUARD_EXPECTED_PACKAGE_SHA = '<verified C5 package.json sha256, 64 hex>'
$env:MB006_BACKGUARD_EXPECTED_LOCK_SHA    = '<verified C5 pnpm-lock.yaml sha256, 64 hex>'

node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-backguard/run.cjs --case cancel-confirm
```

`--case` is independently selectable and accepts exactly one of
`cancel-confirm`, `busy-back`, `repeat-back`, `clean-back`. With no `--case`, all four run
sequentially, each in a fresh browser context.

Exit codes: **2** = refused before launch (bad/absent env, hash mismatch, source drift,
existing run directory, bad CLI); **1** = executed but not a scoped pass (measured FAIL,
SETUPFAILED, UX finding, or incomplete); **0** only for `PASS_SCOPED_ACTUAL`.

### Pre-launch hash gate

Before `fixture.init()` (the only place a browser is launched), `run.cjs` requires:

1. `MB006_CONFIRM_BROWSER=1`, a unique run id, and an executor label.
2. Exact 64-hex expected hashes for the C5 page, `package.json`, and `pnpm-lock.yaml`;
   actual files must match all three.
3. The five reviewed dependencies must remain byte-identical to their known hashes:
   - `packages/i18n/src/mobile-experience.ts` `6ac6800e179de0ba15ab3607918b2f8427d364e19306eaf8f2a146f016247380`
   - `apps/mobile/src/api/learner-content.ts` `43ce2ad5d6519b5fab7e38867d1349b569d08b6153b74c87e5c96f11e24e1ae6`
   - `apps/mobile/src/stores/learner-content.ts` `95cc92496db996242d91baed3301d76f985e4e3b9134e1e50c2b9ab8d41e4c61`
   - `apps/mobile/src/stores/session.ts` `d944c9e84617af5ad553d2fbc1fd0c07120ce790411dbe02603f9338333f8931`
   - `apps/mobile/src/auth/navigation.ts` `7365fec07c55857445fdb1d87b60659734e9e94dc06cfb65afabcb3e8863a4b5`
4. The expected page hash may not equal the prior reviewed page hash
   `86620ed0dbc2cb25afb4bbae35734a345b9e8066afa806684f99ccb678a5312d`; that is not a
   verified C5 hash.

The six freeze sources (assessment page, i18n, API, store, session, navigation) and the two
dependency files are re-hashed after the run. `sourceStable`, `dependenciesStable`, and
`closed` are reported; any drift is a measured FAIL.

If the current tree is still C4/pre-freeze, the actual page hash will not match the
Root-supplied C5 hash and the suite exits 2 without creating a run directory or launching a
browser. That is the intended refusal, not a bug.

## What each case measures

Every case creates a fresh context, logs in for real, starts the assessment with the real
`assessment-start` pointer press, and (except `clean-back`) selects A with a real pointer
press. It records actual `location.href`/`hash`, URL origin, route, request counts,
`aria-busy`, option `aria-pressed`/`disabled`, dialog count/visibility/buttons, and question
text. It does not read cookies, storage, tokens, request bodies, or headers, and does not
replace store/session/guard behavior or install DOM event hooks.

- **cancel-confirm**: physical back; the pending `page.goBack()` promise is held (never
  awaited before the decision). Await the visible confirmation, record the pending URL,
  cancel with the real button, then settle the traversal. Asserts assessment URL restored,
  same question, A still selected, zero `respond`/`retest`/`ensure`, no dialog. A second
  physical back + real confirm must actually leave to an app entry, with no duplicate
  prompt.
- **busy-back**: hold the `responses` request, verify it is really held (pending delay,
  `respond === 1`, `aria-busy === true`), press physical back. Asserts stay on the question,
  request count still 1, no confirmation, still busy. Release, then assert one accepted
  response (`acceptedSequence === 1`), idle question, no extra writes. If the request was
  never held, the case is **SETUPFAILED**, never PASS.
- **repeat-back**: open the confirmation, then press physical back again while it is open,
  record duplicate-dialog/route facts, and test forward when possible. An observed
  `about:blank` or external-origin document departure is preserved as a **UX finding**,
  not waived: the callback was not reached. No external page is contacted; `about:blank`
  is observation only. Otherwise cancel and assert assessment restored, A preserved, zero
  writes.
- **clean-back**: start with no selection, press physical back. Asserts no prompt and an
  actual departure to an app entry, with zero assessment writes. `about:blank`/external
  departure is recorded as a UX finding and is not a pass.

URL equality is only asserted **after** the router traversal settles. While the guard
callback is pending, URLs are recorded but not forced to an expected value, because doing
so would fabricate the result. The actual prior app entry is recorded, not guessed.

## Reporting and scope

`results.json` records the scoped checks, case outcomes, observations, screenshots,
transport facts (counts, unexpected routes/501, injected failures), before/after hashes,
`sourceStable`, `closed`, and `SETUPFAILED`/`UX_FINDING`/`NOT_RUN` entries.

- `NOT_RUN` is always recorded for native/Android back and for the real backend/IAM/DB/
  network. These are out of scope for this H5 synthetic-transport suite.
- Any scenario that cannot establish its precondition is `SETUPFAILED`; it is never an
  empty PASS.
- No 503 is injected by this suite. Console-error exclusion is allowed only for an exact
  fixture-injected status on the exact injected resource path; unknown 501, page errors, and
  other console errors remain failures.
- `PASS_SCOPED_ACTUAL` means only that the selected, actually observed scoped checks passed.
  It is **not** a whole-page, C5, design, native, or backend pass. `completion` is always
  `NOT_THE_WHOLE_PAGE`.

## Deliberate non-actions

No product launch, server start, Git command, external navigation, browser launch, or
secret use occurred during preparation. The only validation was `node --check run.cjs`.
