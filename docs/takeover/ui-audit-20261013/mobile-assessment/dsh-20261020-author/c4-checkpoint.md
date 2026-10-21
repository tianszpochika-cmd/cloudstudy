# MB006 C4 author checkpoint（3 项已确认缺陷的最小修复）

日期 2026-10-20（CST）。范围：仅 `apps/mobile/src/pages/assessment/assessment.vue`；`packages/i18n/src/mobile-experience.ts` **未改**（无需新文案）。未改 API/store/contracts/shared platform/Git/服务，未启动浏览器或探针。

## 1. 源冻结

C3 原字节先保存到 `c4-baseline/assessment.vue.c3.raw`、`mobile-experience.ts.c3.raw`（copy 字节一致）：page raw `86620ed0…` / i18n raw `6ac6800e…`，与 C3 checkpoint 一致；六源哈希 `c4-baseline/c3-six-source-hashes.json`。C4 新页 `c4-baseline/assessment.vue.c4.raw`，raw=LF=`abff80cd1d16e8d688deb9ffdc3a7e0250577f10ef2dcd31ed9a5d6849a07d8c`，33125 bytes；i18n 仍 `6ac6800e…`（LF `a0581116…`）。见 `c4-baseline/c4-source-hashes.json`。

## 2. 实际改动（仅这些声明）

- 脚本：新增 `AUTH_LANDING_PATHS`（`/pages/login/login`、`/pages/register/register`、`/pages/reset-password/reset-password`、`/pages/onboarding/onboarding`）与 `previousPagePath()`（读 `getCurrentPages().at(-2)?.route`，去掉 query/hash 并规范前导 `/`）；`navigate('back')` 仅在存在真实非 auth 前页时 `navigateBack({delta:1})`，否则 `switchTab` 到 `/pages/home/home`。未改 `onBackPress`、未加 history/popstate。
- 样式：`.assessment-page` 新增页内 `--assessment-control-border: var(--yx-text-secondary)`；`.assessment-button` 边框、`.assessment-primary` 的 `border-color`（原 `--yx-action`）、`.assessment-secondary`、`.assessment-option` 均改用该局部 token。primary 填充仍 `--yx-action`，未改共享 token / 状态色。
- 样式：`@media (max-width: 599px)` 下选中项改为 `display:grid; grid-template-columns:auto minmax(0,1fr)`，`.assessment-selected` 用 `grid-column:2 / -1; justify-content:flex-start; max-width:none` 走正常流第二行；删除旧的 ≤360 badge 列布局，保留 ≤360 页面 padding。≥600 的 inline badge 设计不变。

## 3. 执行结果

- `pnpm --filter @englishflow/mobile typecheck`（`tsc --noEmit`）：**exit 0**（本次），属源码级检查。
- `build:h5` / 模板编译：**NOT_RUN**（作者环境历史为 spawn EPERM `BLOCKED_EXECUTION_BOUNDARY`）；本会话未执行。
- 浏览器/对比度实测：**BLOCKED_BROWSER_LAUNCH / NOT_RUN**（任务禁止启动）。对比度仅为按 `packages/design-tokens` 语义值离线计算：text-secondary 在 light card/soft=5.14/4.56，dark=7.52/6.85，HC=15.23/10.93；HC action 原为 2.62/1.88（与 Root 测量一致）。

## 4. 待 Root 实测（不预签）

HC390 primary 边框 vs 页面与 soft confirmation ≥3（含 light/dark）；320×568 en dark 200% 选中 C 的 `reading` 不再拆词、badge/check 可见且整行目标；从 login 前页返回落 home，真实非 auth 前页仍 navigateBack。物理浏览器返回丢草稿、lifecycle 旧 GET 竞态不在本次范围。未签整页 PASS，未改测试脚本/矩阵。
