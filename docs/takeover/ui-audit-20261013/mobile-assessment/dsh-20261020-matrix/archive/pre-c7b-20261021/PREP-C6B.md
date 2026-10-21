# PREP-C6B — matrix guard update only

- Status: **PREPARED_NOT_RUN**. C6b is Root-approved **for tests only**, not whole-page acceptance. No browser/product/Git/server changes by this task.
- C5c full matrix **34/226**, keyboard/pointer/busy remain **OLD scope**; they are not upgraded to C6b PASS.
- C6b change scope: page UI own navigation permit op/rev/exact target to fix C5c clean-back self-block; CSS unchanged.

## Expected hashes (strict)

| file | sha256 |
|---|---|
| `apps/mobile/src/pages/assessment/assessment.vue` | `ac8fb8d2831f4d5f1f20091e09abef7cc6a1314021545ecbbb84a31d11f157fd` |
| `packages/i18n/src/mobile-experience.ts` | `6ac6800e179de0ba15ab3607918b2f8427d364e19306eaf8f2a146f016247380` |
| `apps/mobile/package.json` | `484382c73929055cc4ecd9a83679f8bab72388dd8069f71a056b3bbc595c0078` |
| `pnpm-lock.yaml` | `d57a87ca84985549fd53c69b1fe1d59db0b136036f2f7bf640d3b30c0a106624` |

Root snapshot: `dsh-20261021-c6/baseline/c6b-source-hashes.json`. i18n/package/lock guards remain strict; only page expected changed from C5c `719cc0ce…` to C6b `ac8fb8d2…`.

## Preserved

- `archive/pre-c6b-20261021/` (pre-C6b C5c guard/helper/metadata + manifest).
- `archive/pre-c5c-run1-helper-20261021/` and C3 `codex-review-c3-darkhc-1` FAIL/ERROR/font200 record.
- Dedicated visible count extractor (7/10 exact), `percent200→factor2`, baseline/sanity, actual-clip vs viewport info, palette/source/dep guards, all other measures/assertions/contrast thresholds unchanged.

## Check (no browser)

```text
node --check scripts/{coverage,measure,matrix}.cjs
node scripts/matrix.cjs --plan-only \
  --case-id en-US__dark__320__text200__short,zh-CN__high-contrast__390
```

Result: 2 contexts, 16 planned screenshots, selected-C probe present, expected page `ac8fb8d2…`. No PASS written.

## Scripts

- `matrix.cjs` `a300896379f16ca1148c0157a9bcf38d7f7cef7fedc06dfbcba018e7e87786dc`
- `measure.cjs` `d337a0bbe0e9291a1ca3a731bbd6478d7fdadabf4bd143a795b255ae67dfc73d`
- `coverage.cjs` `7a98e4625dbb633779f563a2007a11da1994cafd63d53f1306062eb77c87cbcd`

Root runs the new full matrix after clean-nav smoke passes; remaining matrix tests NOT_RUN.
