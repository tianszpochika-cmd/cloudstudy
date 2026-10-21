# C8 TEST-FREEZE — source gate, TEST PREPARATION ONLY

Status: Root has **statically approved C8 for tests** (source-gate freeze for test
preparation). This is **not** whole-page sign-off, **not** a product PASS, and it does
**not** upgrade any earlier C3 / C5c / C6b / C7b evidence.

- Frozen page: `apps/mobile/src/pages/assessment/assessment.vue`
- C8 page SHA-256: `41e1670146621e532921a8916b2c81ea4954d880b2373c7bcc9945d6576d7e86` (44989 bytes)
- Previous C7b page SHA-256: `37bad477e4239061972941c42b24468db5994b8afb89feb61f720fbe168c07e5` (historical)
- Measurement time: 2026-10-21T00:38:29Z (UTC), `Get-FileHash -Algorithm SHA256` (lowercased)
- Branch: `dev-redesign`; no Git command was run; `headAtPreparation` is not re-resolved.

## Unchanged support (strict values, no drift adopted)

`verifyFreeze()` in both risk and lifecycle libs re-hashed these and reported
`ok:true`, `drift:[]`, `dependencyDrift:[]`.

| File | SHA-256 |
|---|---|
| `packages/i18n/src/mobile-experience.ts` | `6ac6800e179de0ba15ab3607918b2f8427d364e19306eaf8f2a146f016247380` |
| `apps/mobile/src/api/learner-content.ts` | `43ce2ad5d6519b5fab7e38867d1349b569d08b6153b74c87e5c96f11e24e1ae6` |
| `apps/mobile/src/stores/learner-content.ts` | `95cc92496db996242d91baed3301d76f985e4e3b9134e1e50c2b9ab8d41e4c61` |
| `apps/mobile/src/stores/session.ts` | `d944c9e84617af5ad553d2fbc1fd0c07120ce790411dbe02603f9338333f8931` |
| `apps/mobile/src/auth/navigation.ts` | `7365fec07c55857445fdb1d87b60659734e9e94dc06cfb65afabcb3e8863a4b5` |
| `apps/mobile/src/platform/uni-runtime.ts` | `fcbeba8626d8364af0ae96db64a05fcff9a3bb2b46a7d8fbcba21507ef609751` |
| `apps/mobile/src/uni.scss` | `0bd56842fc5baebd8767e721f2d938986e293d1d87bfc74bb087b3c228f638d7` |
| `apps/mobile/package.json` | `484382c73929055cc4ecd9a83679f8bab72388dd8069f71a056b3bbc595c0078` |
| `pnpm-lock.yaml` | `d57a87ca84985549fd53c69b1fe1d59db0b136036f2f7bf640d3b30c0a106624` |
| root `package.json` (backguard only) | `e2bf8a40f36d435116326383be7fff376cb5fe126420583affceca76fa2c03c4` |

## Five updated guard/metadata files

Pre-edit bytes were copied byte-for-byte into each project's
`archive/pre-c8-freeze-20261021/` (created once, never overwritten; verified by SHA-256).
All five archive at project level under `<project>/archive/pre-c8-freeze-20261021/`.

| File | Pre-edit archive | Pre-edit SHA-256 | Current SHA-256 |
|---|---|---|---|
| `dsh-20261020-risk/source-freeze.json` | `dsh-20261020-risk/archive/pre-c8-freeze-20261021/source-freeze.json` | `cd232d81fd79a96177561197bcbb097a282ff14c3ee5f162c6a6441e5d383e69` | `7915ca9c39b04407bfb4a5cd39078e824d6c9735485aac14ce9fa970b080ee4e` |
| `dsh-20261020-lifecycle/source-freeze.json` | `dsh-20261020-lifecycle/archive/pre-c8-freeze-20261021/source-freeze.json` | `3653e3a1a4f82c643463fcd23cca7de7c6cee5d6bb589297708c34cdfcd40e89` | `fdff37b9eb0ebdb218c85cee0ae7764d1fff23beea43f80930dda7961626f296` |
| `dsh-20261020-author/scripts/c3-verify.cjs` | `dsh-20261020-author/archive/pre-c8-freeze-20261021/c3-verify.cjs` | `204814d0da2fd84d4af6b29c4d34718752a09ee2e71fd3222a152a672a70b5a5` | `239b15b4fbe2551c0a75bcc0b557f1addfd2274fd0f04b92966804846da55230` |
| `dsh-20261020-backguard/run.cjs` | `dsh-20261020-backguard/archive/pre-c8-freeze-20261021/run.cjs` | `672c4b82fcb8ffe5b74f50d66acb6f336dd84d2b2aab64d4a2158536f32015fd` | `6c530d0e43937da1b97f7a4d37c73544dc5d814dec49d4c673bb8d2b4bca01c3` |
| `dsh-20261020-matrix/scripts/coverage.cjs` | `dsh-20261020-matrix/archive/pre-c8-freeze-20261021/coverage.cjs` | `221bc472212ced7c06d7d047c5dee3617cd3b399a8ca9143924c16577269554e` | `f70e15c4f4a88652049b464290743df6f933ad1bed26babe75d4e56c217a167a` |

What changed in each file — current expected page hash and current version
label/metadata only:

- `risk/source-freeze.json`: `label` → CURRENT C8; `currentCandidate` → `C8`;
  `currentPage` → C8; `sources[assessment.vue]` → C8; `note` re-measured and reworded to
  C8 (test-only approval, support unchanged); added `c8Preparation`; added C7b to
  `priorCandidates`. Full prior `c7bPreparation` block kept as history.
- `lifecycle/source-freeze.json`: same C8 updates; `pendingNote`, `c6bPreparationHistory`,
  `priorCandidates` C3/C5c/C6b, and `c7bPreparation` retained verbatim.
- `author/scripts/c3-verify.cjs`: `C7B_PAGE` → `C8_PAGE` (C8 hash) plus
  `C7B_PAGE_LEGACY`; guard, refusal message, `scope`, `label`, `previousC7bPage`, and the
  pre-run assert now name C8. No check, count, event handler, or fixture logic touched.
- `backguard/run.cjs`: `APPROVED_PAGE_SHA` → C8 plus `PREVIOUS_C7B_PAGE_SHA`; comments,
  refusal messages, report `approved.previousC7bPage`, and metadata now name C8. No case,
  check, traversal, or fixture logic touched.
- `matrix/scripts/coverage.cjs`: `EXPECTED_PAGE_SHA256` → C8 only. Plan/contexts,
  palette, copy, screenshot math and exports unchanged.

Historical prior-hash fields were **not** mass-replaced: C3 `86620ed0…`, C5c `719cc0ce…`,
C6b `ac8fb8d2…` and C7b `37bad477…` remain as historical values.

## Verification actually performed

- `node --check` on all three scripts → exit 0 each.
- `JSON.parse` on both `source-freeze.json` files → OK; `currentCandidate=C8`,
  `currentPage=41e167…`, source-map page `41e167…`, `pnpm-lock` still `d57a87…`.
- Import-only `verifyFreeze()` (no browser, no driver launch):
  - `risk-lib.cjs` → `{"ok":true,"drift":[],"dependencyDrift":[]}`
  - `lifecycle-lib.cjs` → `{"ok":true,"drift":[],"dependencyDrift":[]}`
- Matrix plan-only summary (module require, no run): page `41e167…`, `PLAN.length=34`,
  planned screenshots `226`.
- Product/support re-hash after the edits: page still `41e167…`; all support values above
  unchanged.
- Archive integrity: all five archived files match their pre-edit SHA-256.

## Not run / not claimed

- No browser, Playwright launch, probe, product server, Git, backend, native runner, or
  global config was touched. The known DSH sandbox `EPERM` on browser launch was never
  attempted.
- No PASS is claimed for C8. All old C3/C5c/C6b/C7b runs and FAILs remain as recorded;
  the old recovery/back FAIL cause is still undetermined and is not rewritten.
