# PREP-C7B — freeze metadata/label only

- Status: **PREPARED_NOT_RUN**. C7b is Root statically approved **for tests only**, not whole-page acceptance. No browser/product/Git/assertion changes by this task.
- Only changed in matrix dir: expected page hash + this version label. i18n/package/lock/tokens remain C6b values strictly.

## Expected hashes

| file | sha256 |
|---|---|
| `apps/mobile/src/pages/assessment/assessment.vue` | `37bad477e4239061972941c42b24468db5994b8afb89feb61f720fbe168c07e5` |
| `packages/i18n/src/mobile-experience.ts` | `6ac6800e179de0ba15ab3607918b2f8427d364e19306eaf8f2a146f016247380` |
| `apps/mobile/package.json` | `484382c73929055cc4ecd9a83679f8bab72388dd8069f71a056b3bbc595c0078` |
| `pnpm-lock.yaml` | `d57a87ca84985549fd53c69b1fe1d59db0b136036f2f7bf640d3b30c0a106624` |

## Preserved / not upgraded

- `archive/pre-c7b-20261021/` archives pre-C7b C6b `coverage.cjs` + `PREP-C6B.md` with SHA256 manifest.
- 34-context matrix, measures, assertions, fixture, dedicated count extractor, clipping/200% helpers, palette/dep guards, and old runs untouched.
- C5c/C6b old results are **not upgraded** to current C7b PASS; C3 `codex-review-c3-darkhc-1` FAIL/ERROR/font200 record remains.
- No whole-page PASS claim; remaining matrix tests **NOT_RUN**.

## Check (no browser)

```text
node --check scripts/{coverage,measure,matrix}.cjs
node scripts/matrix.cjs --plan-only \
  --case-id en-US__dark__320__text200__short,zh-CN__high-contrast__390
```

Result: 2 contexts, 16 planned screenshots, selected-C probe present, expected page `37bad477…`.

## Script hashes

- `matrix.cjs` `a300896379f16ca1148c0157a9bcf38d7f7cef7fedc06dfbcba018e7e87786dc`
- `measure.cjs` `d337a0bbe0e9291a1ca3a731bbd6478d7fdadabf4bd143a795b255ae67dfc73d`
- `coverage.cjs` `221bc472212ced7c06d7d047c5dee3617cd3b399a8ca9143924c16577269554e`
