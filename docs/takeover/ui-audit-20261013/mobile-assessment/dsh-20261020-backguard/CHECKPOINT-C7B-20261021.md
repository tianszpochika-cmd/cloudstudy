# CHECKPOINT — C7b freeze update (2026-10-21)

**Named freeze scope:** `MB006_BACKGUARD_C7B_FREEZE`

Status: prepared only; no browser/product/server/Git action. No PASS is claimed. Root
continues actual execution.

## Root-approved C7b facts

- page `37bad477e4239061972941c42b24468db5994b8afb89feb61f720fbe168c07e5`
- i18n `6ac6800e179de0ba15ab3607918b2f8427d364e19306eaf8f2a146f016247380` (unchanged)
- mobile package `484382c73929055cc4ecd9a83679f8bab72388dd8069f71a056b3bbc595c0078` (unchanged)
- lock `d57a87ca84985549fd53c69b1fe1d59db0b136036f2f7bf640d3b30c0a106624` (unchanged)

## Modified files

- `run.cjs` — `APPROVED_PAGE_SHA` changed to C7b `37bad477…07e5`; version labels/error
  provenance changed to C7b. No assertion, scenario, dialog-action, fixture, support hash, or
  branch changes. `repeat-back-confirm` retains the forward-auto-cancel → fresh-back →
  confirm real-departure branch. New sha256
  `0d5d714ace43cedcc1069f5378f674bdb63e542bfba41c4d82366563c52056e8`.
- `README.md` — C7b approval/page-hash labels and archive note.
- `PREP-20261021.md` — C7b page hash, run-id prefix, current/archive hashes.
- `CHECKPOINT-C7B-20261021.md` — this checkpoint.

## Archived before the C7b edit

`archive/pre-c7b-freeze-20261021/` preserves the C6b final driver plus freeze metadata:

- `run.cjs` `4b681b929636dd2b9ef253f082c857bf06e0e953e9e115f4768cc884e31e5569`
- `README.md` `6228e7bb464992c420c94d7cb8684af03e76362164ecf05ee07ee191000914d7`
- `PREP-20261021.md` `43ca29bbec4eba4fdd0d9073d4388ddc2a422ffa5b738ed3d8b0abcfbe57593c`
- `CHECKPOINT-C6B-20261021.md` `4c376a3815a7b8fc625e0f6066640ae9be2bcf5cd0b5d914502780b0ca8b1542`

Existing `runs/` evidence was not modified. No fetch/push/permission probe was run.
