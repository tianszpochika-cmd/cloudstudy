# MB007 首页 C6 候选（2026-10-21）

状态：`PRIVATE_CANDIDATE_C6 / UI_NOT_SIGNED / BROWSER_NOT_RUN`。本轮只修 C5 唯一确凿产品 FAIL：en-dark native placeholder 未命中；不动字体、布局、入口、i18n、store、runtime、全局 token。未提交、未 fetch/push、未跑浏览器/服务/依赖，未改完成数。

## 0. C5 实际结果与证据保留

- Root 实际 C5 smoke（`matrix/runs/codex-20261021-c5-smoke-1`，source/deps/evidence stable、closed=true）：
  - zh-light390、zh-light1280 全部 ok；
  - **en-dark390 唯一真实 FAIL**：native placeholder 仍为 `rgb(117,117,117)`（暗背景 3.25:1）；
  - en320/200% 仅 normal-contrast 分类 `NOT_MEASURED`（已交脚本作者，不是产品结论）。
- Root 实际 DOM/CSS 根因（证据 `.git/codex-local-backups/dsh-dispatch-20261021/root-home-placeholder-c5.json`）：uni 将 `:deep(input::placeholder)` 编译为
  ```
  .home-search[data-v-0cd09a48] uni-input::placeholder
  ```
  命不中内部真实 `input`；overlay 已正确为 `rgb(178,183,205)`，native 仍默认灰。
- C5 四源/报告已归档 `archive/c5-20261021/`（含 `HASHES.md`）：home `920df081…`、i18n `278b9d03…`、store `c4ef9dd8…`、runtime `03b21bab…`。C1–C4 archive 与 Root 原件未覆盖。

## 1. 修复（仅 home 样式）

把 native 规则从标签选择器改为 uni 内部正式 class：

```css
/* uni compiles `input` in a deep selector to `uni-input`, which never matches
 * the real native input. Target uni's own internal input class instead. */
.home-search :deep(.uni-input-input::placeholder) {
  color: var(--yx-text-secondary);
  opacity: 1;
  font: inherit;
}
```

- 保持语义色 `var(--yx-text-secondary)`、`opacity:1`、`font:inherit`；未调低对比要求。
- overlay 规则 `.uni-input-placeholder` 与 `placeholder-style` 原样保留（C5 已正确）。
- 未改全局 CSS、未在脚本注入样式、未改字体栈、未改 token、未改布局/入口/i18n/store/runtime。
- 设置/清除 44×44、focus ring、H1/H2 均未动。

## 2. 实际 uni 编译检查（不是 browser PASS）

对 `home.vue` 执行 `@vue/compiler-sfc` 的 parse/compileScript/compileTemplate + scoped `compileStyle`，结果为 `C6_STATIC_OK`，并断言：

- 编译产物包含 `.home-search[data-v-home] .uni-input-input::placeholder`；
- 编译产物**不再包含** `uni-input::placeholder`；
- overlay 规则 `.home-search[data-v-home] .uni-input-placeholder` 仍在；
- native 规则块内 `color: var(--yx-text-secondary)`、`opacity: 1`、`font: inherit` 均在；
- 模板仍为 3 个 `role="heading"`（1×level1 + 2×level2），`placeholder-style` 仍含 `var(--yx-text-secondary)`。

这证明**编译目标**从 `uni-input` 改为 `.uni-input-input`，不证明 en-dark 实际计算色已通过；必须由 Root 在其 H5 复验 native placeholder 的 computed color/contrast，C6 不写 browser PASS。

## 3. C6 四源冻结哈希

| 文件 | 行数 | raw SHA256 | LF SHA256 |
|---|---|---|---|
| `apps/mobile/src/pages/home/home.vue` | 759 | `593994f2a6340e450b674cf492c5ed99f1cfc10f61f67b79ebb1c327ccae020d` | 同 raw |
| `packages/i18n/src/mobile-experience.ts` | 237 | `278b9d030b02532a872c502b38f62561e41dc94ffdfb7abc35585c4496967ddc` | `e59547d9892f7689e3681b853b258393b096d0745929f3df0d1fb608f589683e` |
| `apps/mobile/src/stores/learner-content.ts` | 569 | `c4ef9dd83452ea44f6deda55ac0be2dd3e49a810cd82d183d5342fa9b71cec21` | 同 raw |
| `apps/mobile/src/platform/uni-runtime.ts` | 207 | `03b21bab8c4121ec289b5633ae9fab79ba0b64c60d0431f7adbf8953115f265a` | 同 raw |

本轮只有 home 变化；i18n/store/runtime 与 C4/C5 相同，列出以便冻结。i18n 工作副本 CRLF（仓库既有），LF 为规范化哈希。

## 4. 验证汇总（如实）

| 项 | 结果 |
|---|---|
| mobile typecheck | `PASS_EXIT_0` |
| SFC script/template + scoped style compile | `C6_STATIC_OK`（含上述 selector 断言） |
| H5 build | 未跑（DSH 环境已知阻塞；Root 独立 build） |
| 浏览器/矩阵/对比度 | `NOT_RUN`；C5 `codex-20261021-c5-smoke-1` 仍是当前真实结论 |
| Git | 无写操作 |

## 5. 仍存 GAP

- en-dark native placeholder 的实际 computed color/contrast 未复验；C6 只改命中目标。
- en320/200% normal-contrast `NOT_MEASURED` 属脚本分类，待脚本作者。
- C4 入口 late、C5 四主题等仍需 Root 全矩阵/风险/共享/独审；C6 不声称 UI 完成。
- 既有 GAP 不变：`learner.home.read` 与 `learning.plan.read` 门不匹配；`planNotice` 原文精确映射；服务端内容可能中文；`openUniPage` 平台返回差异。

## 6. 边界

产品仅 `apps/mobile/src/pages/home/home.vue`；文档新增本文件、C5 archive `HASHES.md`、`DESIGN-SPEC.md` C6 注记。未动 i18n/store/runtime/MB006/56 文件/14 目录/依赖/权限/路由，未 Git。C6 四 hash 冻结交 Root；是否签收、build、browser、commit 由 Root 决定。
