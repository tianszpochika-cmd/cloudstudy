# CHECKPOINT — C6b freeze update (2026-10-21)

Status: prepared only; no browser/product/server/Git action. Root continues actual execution.

## Root-approved C6b facts

- page `ac8fb8d2831f4d5f1f20091e09abef7cc6a1314021545ecbbb84a31d11f157fd`
- i18n `6ac6800e179de0ba15ab3607918b2f8427d364e19306eaf8f2a146f016247380` (unchanged)
- mobile package `484382c73929055cc4ecd9a83679f8bab72388dd8069f71a056b3bbc595c0078` (unchanged)
- lock `d57a87ca84985549fd53c69b1fe1d59db0b136036f2f7bf640d3b30c0a106624` (unchanged)

## Modified files

- `run.cjs` — `APPROVED_PAGE_SHA` changed to C6b `ac8f…57fd`; C5c version labels/error
  provenance changed to C6b. No assertion, scenario, dialog-action, fixture, or other hash
  changes. New sha256 `4b681b929636dd2b9ef253f082c857bf06e0e953e9e115f4768cc884e31e5569`.
- `README.md` — C6b approval/page-hash labels and archive note.
- `PREP-20261021.md` — C6b page hash, run-id prefix, current/archive hashes.
- `CHECKPOINT-C6B-20261021.md` — this file.

## Archived before the C6b edit

`archive/pre-c6b-freeze-20261021/` preserves the C5c final driver including
`repeat-back-confirm` plus freeze metadata:

- `run.cjs` sha256 `eeeaba129c355e5a171fd5d85cd3fd59f902be3acc36e2aeb2654079c0249001`
- `README.md` sha256 `1e802b99aefac4f0067f5193066f35615c63ed5f7d1a21d02560c577faa57c5b`
- `PREP-20261021.md` sha256 `70cd48017aabc0c16ac6d1a556268155164847cff4e64671f93a0c43bed12ccb`

Existing `runs/` evidence was not modified. No fetch/push/permission probe was run.
