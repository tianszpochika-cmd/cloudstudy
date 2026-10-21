# CHECKPOINT-20261021-C7B-GUARD

Date 2026-10-21 (CST). Scope: guard metadata only — `dsh-20261020-risk/source-freeze.json`, `dsh-20261020-lifecycle/source-freeze.json`, `dsh-20261020-author/scripts/c3-verify.cjs`, and the C6b raw archives below. No browser, product, fixture, `risk-leave.cjs`, Git, server or old run evidence was changed.

## 1. Root static input

Root statically approved **C7b** as the page for testing only:

`37bad477e4239061972941c42b24468db5994b8afb89feb61f720fbe168c07e5`

[实测] The actual page hash during this update was exactly `37bad477…`. All other tested-source and dependency hashes were byte-identical to C6b:

- i18n `6ac6800e…`
- API `43ce2ad5…`
- store `95cc9249…`
- session `d944c9e8…`
- nav `7365fec0…`
- uni-runtime `fcbeba86…`
- uni.scss `0bd56842…`
- package `484382c7…`
- lock `d57a87ca…`

No other drift was adopted. C7b is **expected-only**: Root’s static approval is not a UI signoff, not a candidate PASS, and does not upgrade the old C5c PASS.

## 2. C6b guard archive (written before edits)

| file | old bytes | old SHA-256 | archive |
|---|---:|---|---|
| risk `source-freeze.json` | 3474 | `8edcdc7e4b416133f52ea4639fa4ebb22475f74a2c41524d4ef1a63e16a63bd0` | `dsh-20261020-risk/20261021-C6B-guard-archive/source-freeze.json.c6b.raw` |
| lifecycle `source-freeze.json` | 3892 | `d97949cfe80d94f53eb2b6032f49f2a333d1abd68b34355238b9035315882576` | `dsh-20261020-lifecycle/20261021-C6B-guard-archive/source-freeze.json.c6b.raw` |
| author `c3-verify.cjs` | 27617 | `9373ed9c2ae04c414c2a21341e5406005f38282f523d11898a0b45988b7610d5` | `dsh-20261020-author/scripts/20261021-C6B-guard-archive/c3-verify.cjs.c6b.raw` |

Each archive directory also contains `ARCHIVE-MANIFEST.json` with the same hashes/bytes.

## 3. Updated files (new SHA-256)

| file | bytes | SHA-256 |
|---|---:|---|
| `dsh-20261020-risk/source-freeze.json` | 4821 | `cd232d81fd79a96177561197bcbb097a282ff14c3ee5f162c6a6441e5d383e69` |
| `dsh-20261020-lifecycle/source-freeze.json` | 5179 | `3653e3a1a4f82c643463fcd23cca7de7c6cee5d6bb589297708c34cdfcd40e89` |
| `dsh-20261020-author/scripts/c3-verify.cjs` | 27768 | `204814d0da2fd84d4af6b29c4d34718752a09ee2e71fd3222a152a672a70b5a5` |

Metadata changes only:

- Both freezes now label/point to **CURRENT C7b** page `37bad477…`; C3, C5c and C6b are retained as historical only.
- The 8 source entries and 2 dependency entries keep their C6b values; only the page entry changed.
- `c3-verify.cjs` keeps its historical filename, but its header/scope/label/expected page now say **C7b**. `C6B_PAGE_LEGACY` is retained only to refuse the prior page; no bare C6b expected value remains.
- The source guard still refuses any page other than the explicitly declared C7b value, plus any i18n/package/lock drift.
- Behavioral checks are unchanged except the explicitly approved expected-page constant/label. No check was weakened.

## 4. Evidence retention

- All old runs, screenshots, manifests and FAIL results are retained untouched.
- The old recovery/back **FAIL cause is not determined**; it is not rewritten, waived or relabeled.
- `dsh-20261020-risk/risk-leave.cjs` was not modified this round.
- The C3 file name is historical only. No C5c PASS, C6b preparation or prior result is upgraded to C7b.

## 5. Validation actually run (no browser)

- `node --check` on `risk-lib.cjs`, `lifecycle-lib.cjs`, `c3-verify.cjs`: all exit 0.
- `risk-lib.verifyFreeze()` import-only: `ok=true`, 8 sources, 2 deps, zero drift, page `37bad477…`.
- `lifecycle-lib.verifyFreeze()` import-only: `ok=true`, 8 sources, 2 deps, zero drift, page `37bad477…`.
- `c3-verify.cjs` static check: declared `C7B_PAGE` equals actual; no bare C6b expected; C7b scope/label present.
- **NOT_RUN**: browser suites, native App, real backend/IAM/DB/Gateway, UI acceptance.

Root may now execute the reviewed suites against C7b with a unique run id. This checkpoint does not predeclare any result.
