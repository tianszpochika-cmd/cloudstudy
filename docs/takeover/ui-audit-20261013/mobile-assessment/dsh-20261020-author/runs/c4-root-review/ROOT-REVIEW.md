# MB006 C4 Root 审核记录（2026-10-20）

归属：C4 脚本/实现由 **DSH 作者**准备；本组证据由 **Root 独立执行与审核**，文件原样复制自 Root 侧 `.git/codex-local-backups/dsh-dispatch-20261020/`。本文件是 DSH 的文档转录，**不构成 DSH 浏览器 PASS**，也不构成整页签收。

## 源与范围

- C4 页面：`apps/mobile/src/pages/assessment/assessment.vue` = `abff80cd1d16e8d688deb9ffdc3a7e0250577f10ef2dcd31ed9a5d6849a07d8c`；i18n = `6ac6800e179de0ba15ab3607918b2f8427d364e19306eaf8f2a146f016247380`。Root 已核前后一致，`closed=true`。
- 范围仅 selected-C 文本 200% 与 high-contrast guide 边界；**不是**全主题/全宽度/报告/重测的整页结论。

## selected-C 文本 200%（en / dark / 320×568）

- 证据：`root-c4-selected-c-text200.json` / `.png`（本目录，原件未改）。
- 实际：`textScale` 为**既有 DSH 缩放/采集方式**（对 `#assessment-page` 子树 computed font-size ×2；非浏览器 zoom、非 native）；`h1="Level check"` 为 56px；`overflow=false`、`overlay=false`；`splitWords=[]`；`rawKey=false`。
- 选定态：option C `pressed=true`、`Selected` 可见，其余 A/B/D 未选。
- Root 实际读图确认 `Level`/`check` 等词**未被拆断**；与 JSON 的 `splitWords=[]` 一致。

## high-contrast 边界（zh-CN / HC / 390×844，guide）

- 证据：`root-c4-hc-boundary.json`（本目录）。
- 实际：按钮 `assessment-start`（primary）边框 `rgb(226,230,241)`，`vsParentBackground=15.23`、`vsOwnBackground=5.82`；`assessment-home`（secondary）边框 `vsParent=15.23`、`vsOwn=15.23`；`borderViolations=[]`、`textViolations=[]`、`sizeViolations=[]`、`wordSplits=[]`。
- **范围限定：guide 页 only**，不等于全部主题/全部页面通过；C3 的 HC `2.62 / 1.88` FAIL 仍原样保留，不被本组覆盖。

## H5 build

- Root 独立执行 `pnpm --filter @mobile build:h5`：**exit 0 / DONE Build complete**；日志 `root-c4-build-h5.log`，stderr 仅既有 Sass `@import` deprecation（`root-c4-build-h5.stderr.log`）。
- DSH 作者侧 C4 `typecheck` 为 0，按其 checkpoint 记录（非本文件实测）。**构建通过不等于整页 UI/business PASS。**

## C3 同项证据（保留原时点）

- 原 `root-c3-selected-c-text200.json/.png` 仍保留在 `.git/codex-local-backups/dsh-dispatch-20261020/`，本任务另复制到 `runs/c3-root-review/c3-selected-c-text200/`（不覆盖任何既有文件）。C3 当时的实际读数（如标题拆 2 行）保持原样，不因 C4 改动回写。

## C5 现状（另一 DSH 作者并行，未纳入本组结论）

- C5 public H5 leave guard 正由另一 DSH 作者实现：页面 + 复用既有、精确的 `vue-router@4.4.4` 直接依赖。
- 源码静态审查尚待修正（busy 顺序 / owner 旧 promise / focus），浏览器 **NOT_RUN**。
- **不得**把 C4 的局部结果外推为 C5 整页结论。

## 状态边界

- MB006 仍 **IN_REVIEW**，未提交、未整页签收；本地 UI 8 页 / 远程 7 页不变；DSH 发布 blocker（Git 子进程）仍在。
- 额度：Root 23:26 实读 81%（primary）；95% 停止线与 2026-10-21 02:50 CST 定时不变。
- 本目录仅含 Root 证据副本与本文档，无 auth/token 等敏感内容。
