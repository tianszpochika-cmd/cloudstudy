# C5b matrix freeze (PREPARED_NOT_RUN)

- Prepared by: DSH. Scope: `mobile-assessment/dsh-20261020-matrix/` only.
- Root C5b build: 0. Root actual scope: normal cancel/confirm scoped PASS, 0 writes (`root-c5b-cancel-confirm.json`, outside this directory, not re-run here).
- Remaining matrix tests: **NOT_RUN**. No browser, server, product, Git or dependency writes by this task.
- No PASS is written or implied for the planned matrix.
- **Observed drift after freeze:** at 2026-10-20T23:34:07 the page was changed by an external process to 719cc0cef407b492544b1bff39537324b0672126df287bf7d5644a25b6fe81c1 (37,049 bytes), not the approved C5b 24281df0…c529a (36,084). This task did not write the page. Expected stays C5b; preflight will refuse (exit 2) until Root resolves the newer change/refreezes.

## Approved C5b hashes (expected; preflight refuses mismatch)

| file | sha256 | bytes |
|---|---|---|
| `apps/mobile/src/pages/assessment/assessment.vue` | `24281df07efb4a8553cfb605eab8d22eb3e16f83076805b141818021948c529a` | 36,084 |
| `packages/i18n/src/mobile-experience.ts` | `6ac6800e179de0ba15ab3607918b2f8427d364e19306eaf8f2a146f016247380` | 32,760 |
| `apps/mobile/package.json` | `484382c73929055cc4ecd9a83679f8bab72388dd8069f71a056b3bbc595c0078` | 1,734 |
| `pnpm-lock.yaml` | `d57a87ca84985549fd53c69b1fe1d59db0b136036f2f7bf640d3b30c0a106624` | 397,670 |
| `packages/design-tokens/src/mobile.ts` | `5b3aac642d103e998ae723c6af1c72fd3d47c7929a609d47aee1e003ad2281d9` | 2,789 |
| `packages/design-tokens/src/official-site.ts` | `9d6af42d7ff255154d579729105c46fe15e2e4792ac64a4eab591108a7d03d62` | 5,762 |

`matrix.cjs` computes page/i18n/supporting package+lock+tokens before launch and after each case; mismatch exits 2 and is recorded in `freezeCheck`.

## Updated helper hashes

| script | sha256 | bytes |
|---|---|---|
| `scripts/matrix.cjs` | `bfe57ec55ada68232c77a0d73b249865b54afa5e380b597d2e770e0e336cc69a` | 52,872 |
| `scripts/measure.cjs` | `2a6fcfffe011b3faac2008c297cae4339bc79edb0a97eb72f8fdae3f2a83245a` | 31,662 |
| `scripts/coverage.cjs` | `7cfa70d7419f1110184490078b36a55e87af215a56ca16b55c8661897a700d1c` | 7,566 |

## Preserved C3 evidence

- `runs/codex-review-c3-darkhc-1/` retained unchanged: HC390 FAILED (actual 2.62:1 / 1.88:1 border, product issue accepted), text200 ERROR (old `applyTextScale` treated 200 as multiplier: 3200/5600px; harness invalid, not product).
- Pre-review bytes: `archive/pre-review-20261021/archive-manifest.json` retained.
- Corrected helpers retained: `percent 200 => factor 2`, restore→read baselines→apply, `text-scale-sanity` 28→56/16→32/14→28; raw clipping classification with actual hidden/clip vs `viewport-offscreen` info; `text-outside-box`/`glyph-overflow` info; `overlap`/horizontal overflow still fail.
- API/store/session/nav checks unchanged; no contrast or expected-behavior weakening.

## Bounded check run

```text
node --check scripts/coverage.cjs
node --check scripts/measure.cjs
node --check scripts/matrix.cjs
node scripts/matrix.cjs --plan-only \
  --case-id en-US__dark__320__text200__short,zh-CN__high-contrast__390
```

Result: 2 contexts, 16 planned screenshots, selected-C probe present; no browser. Root should run a unique C5b case group after review.
