# Shared MB007 narrow regression — PREPARED (NOT_RUN)

Status: **NOT_RUN**. DSH prepared these files only. No browser, no 18183 access, no service, no
install, no Git/fetch/push/SSH. Nothing here is a PASS or a completion-count change. Local UI 9 /
remote 7 remains unpushed; the release-helper block is untouched. The earlier auth3 C8 15/15 belongs
to the old source and is **not** upgraded, reused or re-signed here; the 15 checks are unchanged.

## Files

| file | lines | sha256 |
|---|---:|---|
| `auth3-shared-i18n-narrow.cjs` | 148 | `3b76b044cabcb11e39aaca17f0aee2a87f9a6d8b2dea0048b360a749d2e176e9` |
| `assessment-home.cjs` | 96 | `79472186fa66f6636b171b60b6ee91f4e4fabc2f655f96ff4a402e9adc258ea0` |
| `archive/auth3-shared-i18n-narrow.cjs.signed.raw` | 120 | `0fa3c8877beb04e9338ddc1124f2ce2d7eeef5ddc3d2cf4ace51651251a11991` |

The signed auth3 original at `mobile-assessment/dsh-20261021-auth3/` was copied and left unchanged.
The QA fixture (`../dsh-20261021-qa/fixture.cjs`) is reused by relative require and was **not**
copied or modified; its exports `COPY` / `SYNTHETIC` were read and confirmed.

## Five candidate sources — wait for Root after L1

Both scripts now take **five** explicit env values. The C7 home four and the learn raw below are
**observed prefixes only, not pins**; Root must review the five raw sources after the L1 learn freeze
and pass all five explicitly. The scripts refuse exit 2 on missing/invalid/mismatched values and
print the actual hashes; no candidate is auto-adopted.

| env | file | observed now (not final) |
|---|---|---|
| `EXPECTED_HOME_SHA` | `apps/mobile/src/pages/home/home.vue` | `044948af…` (C7) |
| `EXPECTED_I18N_SHA` | `packages/i18n/src/mobile-experience.ts` | `7e2ef7b5…` (C7) |
| `EXPECTED_STORE_SHA` | `apps/mobile/src/stores/learner-content.ts` | `c4ef9dd8…` (C7) |
| `EXPECTED_RUNTIME_SHA` | `apps/mobile/src/platform/uni-runtime.ts` | `03b21bab…` (C7) |
| `EXPECTED_LEARN_SHA` | `apps/mobile/src/pages/learn/learn.vue` | `83b0756b…` original raw; L1 narrow fix pending |

Context: the C7 four are the current home candidates (Root's prior 34-visual green is separate
evidence, not this suite). The second-course navigation FAIL was traced to `learn.vue` `onShow` not
consuming the pending intent; the product author is narrow-fixing learn. This suite adds learn only
as a frozen fifth source; it does not redesign or retest that page's full scope.

Fixed (both scripts): login `0c5fb5cd…`, register `9258cb03…`, reset `c9a6da86…`, pointer-helper
`24a1f9b2…`, session `d944c9e8…`, assessment `41e16701…`; assessment-home also fixes API
`43ce2ad5…`, navigation `7365fec0…`; deps package `484382c7…`, lock `d57a87ca…`. These original
hashes did not change and were not re-pinned from the C7 candidates.

## Root commands (fill all five after L1; unique RUN, never overwritten)

```powershell
$env:CONFIRM='1'
$env:EXPECTED_HOME_SHA='<Root L1 reviewed home>'
$env:EXPECTED_I18N_SHA='<Root L1 reviewed i18n>'
$env:EXPECTED_STORE_SHA='<Root L1 reviewed store>'
$env:EXPECTED_RUNTIME_SHA='<Root L1 reviewed runtime>'
$env:EXPECTED_LEARN_SHA='<Root L1 reviewed learn>'
$env:RUN='auth3-shared-20261021-1'
node docs/takeover/ui-audit-20261013/mobile-home/dsh-20261021-shared/auth3-shared-i18n-narrow.cjs
```

```powershell
$env:RUN='home-assess-shared-20261021-1'
node docs/takeover/ui-audit-20261013/mobile-home/dsh-20261021-shared/assessment-home.cjs
```

Do not reuse the observed prefixes above as final pins. Root freezes L1 first, then supplies the
five full 64-hex values; both scripts re-read all five before and after and require them stable.

## assessment-home local gate (read-only review)

`enterPage` → `store.loadOnboardingResume()` → `readOnboardingResume()` uses only GET
`/api/v1/iam/principal/me` and GET `/api/v1/learner/targets`; the QA fixture already serves both, so
no new business write or fixture extension is needed. The guide renders without a placement session
(no start/respond/retest). If either necessary GET is absent/501, the round fails for real; the
script never bypasses the guard and never invokes page functions. The QA fixture keeps unknown 501.

## What each script checks

`auth3-shared-i18n-narrow.cjs` — the signed auth3 narrow scope, 3 pages x 5 named checks (15,
unchanged): 390/en-US/light copy + H1/fields; empty native pointer-160 required/focus with 0 submit;
held real submit with exactly 1 request and primary button disabled; named `401` login / `409`
register / `401` reset-confirm alert with button restored; same `#/pages/...` route, no extra write,
zero pageerror/unknown/unnamed console error. Transport: OPTIONS 204, refresh POST 401, only the
current mode's submit POST; any other route 501 + FAIL. Reset enters confirm via the existing code
button.

`assessment-home.cjs` — real H5 via the QA fixture: home ready (390/zh/light; `.home-page`,
`.home-title` = 今日学习, home+catalog+today 200) → real click `进入测评` → signed C8
`#assessment-guide` DOM (`#assessment-title` non-bare, `#assessment-start`, `#assessment-home`, two
guide points; necessary reads, no 501) → real click `#assessment-home` → canonical `#/` **and** fresh
`.home-page`/`.home-title`/task DOM and new home+catalog+today GETs. Zero start/respond/retest/
ensure/replan or any non-GET domain write; unknown 501/pageerror/console error FAIL. Console warnings
are kept raw. No report, plan, legal signoff or guard bypass is produced.

Both write `runs/<RUN>/results.json` with raw console, sources/deps before+after and
`sourceStable`/`depsStable`/`closed`; exit 0 = non-empty fixture pass, 1 = measured fail, 2 =
refusal/freeze/setup/close. This is not a backend/native/whole-page claim.

## Static work actually done (author)

- `node --check` both scripts: exit **0** (148 / 96 lines).
- `node -e "require('../dsh-20261021-qa/fixture.cjs')"`: import-only OK, no launch.
- `EXPECTED_LEARN_SHA` present in both scripts; learn file added to assessment-home's before/after
  snapshot. No driver, no 18183, no product/QA changes, no spawn attempts.
