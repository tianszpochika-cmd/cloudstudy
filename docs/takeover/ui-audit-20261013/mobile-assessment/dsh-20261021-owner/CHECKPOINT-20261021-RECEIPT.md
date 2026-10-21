# OWNER test-preparation checkpoint — 2026-10-21

Status: **PREPARED / NOT RUN**. DSH launched no browser, ran no case, started no
service, did not touch Git or product source, and created no `runs/` directory.
Checkpoint time: `2026-10-21T01:00:01Z` (tool UTC).

Scope: only
`docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261021-owner/`.
All fixes below are test-preparation edits. Existing FAIL classifications and all
earlier evidence are untouched.

## 1. Archive before this edit round

Path: `archive/pre-response-receipt-20261021/` (created once; never overwritten).
`ARCHIVE-MANIFEST.json` records `createdAt 2026-10-21T00:56:09Z` and the pre-edit bytes.
Integrity was re-checked after the edits and still matches:

| file | pre-edit SHA-256 |
|---|---|
| `source-freeze.json` | `9ebea23d854666bf5537dbeac0ba7459c1f11271547d8ad36b8c4a2ef0b5df73` |
| `owner-lib.cjs` | `53d69f1c842721bba286e3adf732aea099e6e05ed2235abe308b36048cab5730` |
| `owner-late-submit.cjs` | `71aac767ab1efdc363da5f930b669b0b82b9abc5dd8465a79c74987711c42058` |
| `owner-late-read.cjs` | `b79ac324f41b468ea326a8e218270f4f28e0ad98b47d3feeead7c86a5be5bc31` |
| `README.md` | `cc350566d3eb28fd63b27a704852abcd278fcd8cbc35119e74ff679530df2dcb` |

## 2. `preparedAt` metadata correction

- Previous value: `2026-10-21T09:05:00Z`. It was **wrong**: the local UTC+08 clock
  (08:56-ish) was written with a `Z` suffix, about 8 hours ahead of the observed UTC
  instant. It was not a measured UTC timestamp.
- Corrected value: `2026-10-21T00:56:02Z`, from
  `(Get-Date).ToUniversalTime()` = `2026-10-21T00:56:02Z` (local
  `2026-10-21T08:56:02+08:00`).
- `source-freeze.json` now carries `preparedAtSource` and `preparedAtCorrection`
  stating the earlier field error explicitly. **No source or dependency hash changed**
  by this metadata fix; `verifyFreeze()` still returns `ok:true`, `drift:[]`,
  `dependencyDrift:[]`.

## 3. Real late-receipt observation (replaces queue-empty inference)

`fixture.cjs` now attaches read-only `page.on('response')` and
`page.on('requestfailed')` listeners for the known
`/api/v1/assessment/placement/` transport. Records contain only:

`{ id, method, path, status, at, atIso, requestFailed, failure? }`

No header, body, token, cookie, query string or real user data is read or stored.
`route.fulfill` now records `{ id, method, path, status, at, atIso, ok, message? }` in
`fulfillResults` in addition to `fulfillErrors`.

Each case now, for the exact old A path/method:

1. records `beforeReceipt` / `beforeFulfill` baselines before release;
2. releases the hold and waits for the matching browser HTTP response (or
   `requestfailed`) and a matching `route.fulfill` result;
3. requires a non-failed 2xx response **and** `ok:true` fulfill **and** no old-path
   `fulfillErrors` **and** no `requestfailed` before evaluating the late branch;
4. if any condition is missing, records `late-receipt-NOT_CONSTRUCTED` plus the whole
   `latePacket` fact set (old path, baselines, receipts, fulfills, hold, errors) and
   exits **2**;
5. only after a real receipt does it run the B DOM/route/focus/write product checks.

`results.json` and `manifest.json` transport now include header/body/token-free HTTP
receipts and fulfill results. An empty hold queue (`pending.remove` happens before
`route.fulfill`) is no longer used as late-packet evidence; `sleep(1000)` alone is not
a receipt.

Pre-release B guide/count assertions (owner-surface cleanup) remain executed and
recorded even when the late receipt branch is not constructed.

## 4. Validation actually performed (no browser)

- `node --check` on `owner-lib.cjs`, `fixture.cjs`, `owner-late-submit.cjs`,
  `owner-late-read.cjs`: all exit 0.
- Import-only `verifyFreeze('41e167…')`: `ok:true`, `drift:[]`,
  `dependencyDrift:[]`, `preparedAt 2026-10-21T00:56:02Z`, exit 0. No Chromium launch.
- Import-only `require('./fixture.cjs')`: loads the module, reports 6 fixture sources
  and both read-only recorders; **no `fixture.init()`/`chromium.launch()` was called**.
- `JSON.parse` on `source-freeze.json` and `ARCHIVE-MANIFEST.json`: OK.
- Archive integrity re-hash: all five files match the pre-edit manifest.
- Current line counts: case 1 = 281, case 2 = 281 (within the 200–300 target);
  helper = 546; fixture = 193; README = 203.
- `runs/` does not exist in this directory (no execution artifacts).

## 5. Current file hashes (post-edit, for Root review)

| file | SHA-256 | bytes |
|---|---|---|
| `fixture.cjs` | `63f0759084f43b8a9b11d4acee69aa38350b8ee45584b3aa7faa6a3410c83217` | 17364 |
| `owner-late-read.cjs` | `63bc860f4bd51660b34efaf402efc19100a43ced0e12192f69f0cb1a97ff3940` | 20636 |
| `owner-late-submit.cjs` | `59eda167f68707c9359c3c120d0e7badf1b0f026bd5d8e59dd07b5009c8620c0` | 19931 |
| `owner-lib.cjs` | `b4a0f6c7a1ca486d1a0f9a286cc4424206b5a7f4f30ae668d189f67e4aa54f36` | 26958 |
| `README.md` | `e9917ce6606fe555ce09df5c4a4643da71c9d8884233a3df11342c7e2de75dec` | 12625 |
| `source-freeze.json` | `6f4b5a84f52eccde5c759d0e77416e28f20541c97a7b02f464e5b668bedce024` | 3540 |

The page/support/dependency bytes are unchanged (C8 page
`41e1670146621e532921a8916b2c81ea4954d880b2373c7bcc9945d6576d7e86` and the strict
risk C8 support/lock values).

## 6. Root execution contract (unchanged)

```powershell
$env:OWNER_CONFIRM_BROWSER='1'
$env:OWNER_RUN='owner-review-20261021-1'   # unique; existing dir refused
$env:OWNER_EXECUTOR='root-review'
$env:OWNER_EXPECTED_PAGE_SHA='41e1670146621e532921a8916b2c81ea4954d880b2373c7bcc9945d6576d7e86'
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261021-owner/owner-late-submit.cjs
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261021-owner/owner-late-read.cjs
```

Exit: `0` only non-empty executed scoped PASS; `1` measured product safety FAIL; `2`
refusal/setup/NOT_CONSTRUCTED. A `late-receipt-NOT_CONSTRUCTED` result is exit 2, not a
product FAIL and not a PASS.

## 7. Explicit NOT_RUN / retained risks

- No browser, Playwright launch, validenv probe, service, Git, backend or native run
  was performed. Both cases remain unexecuted.
- The public busy/hash guard may still fail to construct the 401 login branch (for
  example it may land on onboarding or stay on assessment); that remains
  NOT_CONSTRUCTED/exit 2, not a guessed product verdict.
- The app's existing 8,000 ms client request timeout may cancel the held old request
  before release; if so, no HTTP receipt exists and the late branch is exit 2. The test
  does not modify fetch/XHR/abort behavior to force a receipt.
- The known settings `Do not nest other components in text` warning remains recorded
  verbatim (`knownSettingsTextAppIcon`), not attributed to assessment and not waived.
- All earlier FAIL classifications and old run evidence remain as recorded; no PASS is
  claimed for C8 or for these two cases.

## 8. 2026-10-21 post-run interface fix (not rerun)

Root ran both C8 owner flows: submit 22/22 and read 23/23 named checks, then the
`finally` failed with `current.releaseAll is not a function`, giving exit 2/SETUP.
Cause: closure `releaseAll()` existed but was not exported on the `item` helper.
Fix: added only `releaseAll` to the existing `item` object; `close` still calls the same
internal closure and no product/flow/assertion/version guard changed. `node --check
fixture.cjs` passed; static audit shows every fixture helper called by both drivers is
exported (`current.audited`/`current.dialogs` are driver-assigned observation fields).
No browser/probe/Git and no rerun. Old runs
`codex-20261021-c8-owner-submit-1`/`read-1` are retained; this is not an overall PASS.
Pre-edit fixture archived at `archive/fixture-releaseall-20261021/`.
