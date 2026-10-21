# MB007 首页 C5 候选（2026-10-21）

状态：`PRIVATE_CANDIDATE_C5 / UI_NOT_SIGNED / MATRIX_NOT_RUN`。本轮只修 Root C4 matrix 确凿的产品 finding：搜索 placeholder 对比度 + 两个 section heading 语义；不改字体栈、布局、入口 token、i18n 文案、store/runtime。未提交、未 fetch/push、未跑浏览器/服务器/依赖，未改全局进度。C5 后四源冻结交 Root。

## 0. C4 结果与证据保留

- Root 实际 C4 matrix smoke4（source/deps/evidence stable、closed=true）判定 `REDLINE_FAIL`，原件保留：
  - `docs/takeover/ui-audit-20261013/mobile-home/dsh-20261021-matrix/runs/codex-20261021-c4-smoke-1/results.json`
  - 同目录 8 张 PNG。
- C4 四源/报告已归档到 `archive/c4-20261021/`（含 `HASHES.md`）：home `e249159d…`、i18n `278b9d03…`、store `c4ef9dd8…`、runtime `03b21bab…`；C1/C2/C3 archive 与 before 均未覆盖。
- Root 已 `view_image` 概念/实图；“任务 5 vs 概念 3”是数据差异，开放列表/主 CTA/次出口方向匹配，未据此改版。

## 1. 真实 finding：搜索 placeholder 对比不足（已修）

Root 实测（C4）：

- uni overlay `.uni-input-placeholder`：`#808080`；浅白背景 3.95:1、暗 `#222638` 背景 3.79:1；
- 内部 native `::placeholder`：`#757575`；暗背景 3.25:1。

**修法（home 样式 + input 属性，不动全局 token）**：

1. 输入框增加：
   ```
   placeholder-style="color: var(--yx-text-secondary); opacity: 1;
                      font-family: inherit; font-size: inherit; font-weight: inherit;"
   ```
   `--yx-text-secondary` 是现有语义文本色（四主题随 token），overlay 内联色不再用平台默认灰。
2. H5 scoped deep 规则，覆盖 overlay 与 native 伪元素，防止只改 host/aria 时内部仍灰：
   ```
   .home-search :deep(.uni-input-placeholder) {
     color: var(--yx-text-secondary);
     opacity: 1;
     font: inherit;
   }
   .home-search :deep(input::placeholder) {
     color: var(--yx-text-secondary);
     opacity: 1;
     font: inherit;
   }
   ```
3. 未改任何全局 token、未改字体栈、未用 `overflow:hidden` 遮字。
4. `.home-search` 的边框/焦点仍为 C4 语义（`--yx-text-secondary` / `--yx-focus`）；边界 ≥3:1 的既有结论不变。

**验证范围**：C5 只静态确认 scoped 编译产物包含上述两条规则、语义色、`opacity:1`、`font:inherit`，以及 `placeholder-style` 属性存在；真实四主题/中英/200% 对比度由 Root 复验，C5 不声称已达标。

## 2. 辅助导航：section heading（已修）

- 今日任务标题：`<text class="home-section__title" role="heading" aria-level="2">`。
- 课程内容标题：`<text id="course-heading" class="home-section__title" role="heading" aria-level="2" tabindex="-1">`。
- H1 仍唯一：`role="heading" aria-level="1"` 只在页面标题。
- 未改 copy、布局、字号、间距；仅两个属性。

## 3. 未改动项（明确）

- 字体：Root 实际 CDP 确认品牌/标题/任务/按钮/说明为 Microsoft YaHei（Bold/Regular），28/39.2、16/24、14/22.4 符合；证据 `.git/codex-local-backups/dsh-dispatch-20261021/root-home-font-inspection-c3.json`。未改 `--v2-font`。
- 焦点：Root 实际 Tab 第 4 步到 native INPUT（aria-label 搜索课程），`.home-search:focus-within` 为 true、2px 紫 ring；证据 `root-home-focus-inspection-c4.json`。未改焦点实现。
- matrix 对“搜索未识别/overlap”的判定是脚本缺陷，未改产品绕测试。
- C4 的入口 token、reading、retryPlan 谓词、i18n `mobile.home` 全部保持；i18n/store/runtime 本轮无 diff。

## 4. C5 四源冻结哈希

| 文件 | 行数 | raw SHA256 | LF SHA256 |
|---|---|---|---|
| `apps/mobile/src/pages/home/home.vue` | 757 | `920df081a81e96b940c286e72821a0ecbd7300ee97ddaa66d4cd5ef5651548d9` | 同 raw |
| `packages/i18n/src/mobile-experience.ts` | 237 | `278b9d030b02532a872c502b38f62561e41dc94ffdfb7abc35585c4496967ddc` | `e59547d9892f7689e3681b853b258393b096d0745929f3df0d1fb608f589683e` |
| `apps/mobile/src/stores/learner-content.ts` | 569 | `c4ef9dd83452ea44f6deda55ac0be2dd3e49a810cd82d183d5342fa9b71cec21` | 同 raw |
| `apps/mobile/src/platform/uni-runtime.ts` | 207 | `03b21bab8c4121ec289b5633ae9fab79ba0b64c60d0431f7adbf8953115f265a` | 同 raw |

说明：本轮仅有 home 变化；i18n/store/runtime 哈希与 C4 相同，列出以便冻结。i18n 工作副本 CRLF（仓库既有），LF 为规范化哈希。

`git diff --stat`（四源）：home 827 行变动、i18n 121、store 33、runtime 6；总 836 insertions / 151 deletions。`git status` 仅四源 `M` + `mobile-home/` 未跟踪目录。

## 5. 静态验证（如实）

| 项 | 结果 |
|---|---|
| `pnpm --filter @englishflow/mobile typecheck` | `PASS_EXIT_0` |
| SFC parse/script/template + scoped style compile | `C5_STATIC_OK`：模板 3 个 `role="heading"`（1×level1 + 2×level2），`placeholder-style` 含 `var(--yx-text-secondary)`；CSS 含 `.uni-input-placeholder` 与 `input::placeholder` 两条语义色/`opacity:1`/`font:inherit` 规则 |
| H5 build | 未跑（DSH 环境已知阻塞；Root 独立 build） |
| 浏览器/矩阵/四主题/200% | `NOT_RUN`；C4 `REDLINE_FAIL` 原件仍是当前唯一真实结论 |
| Git | 无写操作 |

## 6. 仍存 GAP / 限制

- placeholder 对比度是否达到 ≥4.5:1 必须以 Root 实际计算/截图为准；C5 只保证使用语义 `text-secondary` 且覆盖 overlay/native，不预填测量值。
- `learner.home.read` 与客户端 `learning.plan.read` 门不匹配（未改权限）。
- `planNotice` 仍按 store 两条原文精确映射；未知原文原样显示。
- 服务端 `explanation/title/description/unavailableReason/summary` 可能中文。
- `openUniPage` 部分平台可能返回 void；await 确认有限。
- C3/C4 入口 late、C4 ready/search 的修复需 Root 复跑；C5 无 browser 结论。

## 7. 边界

仅改 `apps/mobile/src/pages/home/home.vue`（样式 + 两个 heading 属性）；文档新增本文件、C4 archive `HASHES.md`、`DESIGN-SPEC.md` C5 注记。未动 i18n/store/runtime、未动 MB006、未动 56 文件/14 目录保护、未改依赖/权限/路由、未 Git。C5 四 hash 冻结后交 Root；签收/构建/浏览器/提交由 Root 决定。
