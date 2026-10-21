# C3 Root run2 审核记录（2026-10-20）

## 归属与执行

- 脚本 `c3-verify.cjs` 由 **DSH 作者准备/修正**（`preparedBy` 字段原样保留 "DSH author session; not executed by the author"）。
- 本 run 由 **Root/Codex 独立执行**：`executor="Codex independent review run2"`、`MB006_REVIEW_RUN=c3-root-run2`、exit **0**。
- 审核亦由 **Root** 完成；本文件为 DSH 依据 Root 已核事实的文档转录，不是 DSH 作者运行，也不是 DSH 自审 PASS。

## 服务与源

- 原 18183 为 PID 37496（creation 已核）；Root 仅结束自己 session 32601 后 force 重启固定 18183；当前 session **93491 / PID 40996**，Creation `2026-10-20 22:28:50.77032`，操作时 QA 无 inflight。
- 产品两源未变：page `86620ed0…`、i18n `6ac6800e…`（run2 `sourceHashesBefore/After` 一致，`sourceStable=true`）。
- 刷新后只读模块：`http://127.0.0.1:18183/node_modules/@englishflow/i18n/src/mobile-experience.ts?v=78288a10`，`sha256=85b3328be94ed1df68257b3f3e4ddc2afd3242103d0e302289197496627c62b2`，含 `completedCount`/「答题进度」/已完成数，无旧「已接收进度」（见本目录 `root-served-module-after-refresh.json`，原样复制，未覆盖 run1 probe）。
- 历史时点：刷新前的 `FILE_NEW_SERVED_OLD`（`81de3f92…`）仍保留在 `runs/c3-root-review/served-module-probe.json`，不回写成已通过。

## run2 结果

- `runs/c3-root-run2/results.json`：`at=2026-10-20T14:34:34Z`，**32/32 PASS**，`result=PASS`、`closed=true`、`sourceStable=true`、14 张截图、`pageErrors=[]`、页面 unknown 0；console 仅有明确注入的两次 503（`smoke-3`、`smoke-7`）。
- 对比 run1：run1 的 **5 FAIL / 14 图 / 退出码错误永久保留**在 `runs/c3/results.json`，**不得改写成 PASS**；run1 的失败与旧服务模块一致，run2 在刷新后复跑通过。

## H5 构建

- Root 独立构建：**exit 0，DONE Build complete**（原始日志见本目录 `root-c3-build-h5.log`，stderr 仅 Sass `@import` deprecation，见 `root-c3-build-h5.stderr.log`）。
- 作者环境此前的 `build:h5` **BLOCKED_EXECUTION_BOUNDARY**（`spawn EPERM`）保留为作者时点事实，**不抹除、不升级为产品构建失败**。

## 图像与阶段判断（Root 同次 view_image）

Root 同次查看 `mobile-assessment/concept.png` 及 run2 的 `01-progress-first-zh-light-390.png`、`21-question-css200-en-dark-320.png`、`14-assessed-after-ten-real-submits.png`，阶段判断：

1. 轻 AppIcon 导航、单一 28px H1；无重复大框、无艺术字。
2. 当前题序 + 真实已完成数，无裸 key；初始进度 0%。
3. 选项 16px 且已选可读；普通流式布局，主/次动作 48px 按钮。
4. 报告页 A2 / 70 / 7 来自合成回执，概念图的 60 / 6 未被照抄。
5. 具名差异：语义紫与生成图有差异；无硬件状态栏；fixture 题干与 before 不同；英文短标题（`Level check` / `Your result`）为既定文案。
6. **不宣称**任意长题干在首屏均可放下。

## 200% 三态

- `text200-guide-h1-readable`、`text200-question-h1-readable`、`text200-result-h1-readable` 均 PASS：每标题 2 个非空词、`h1Split=[]`、`pageOverflow=false`（320×568）；按钮实测数 **4 / 7 / 4**。
- 为 CSS 2× 文本，不是 native 缩放、不是浏览器 zoom（`textScale` 字段原文保留）。

## 边界（不签整页）

- 共享回归、全部主题/宽度、风险项**尚未跑**；真实后台/IAM/native/实体设备仍未验。
- MB006 仍 **IN_REVIEW、未提交**；本地 UI 8 页 / 远程 7 页不变；最新阈值 95% 不变。
- 本记录不把 run2 的 32 项局部 PASS 扩大为整页签收或发布完成。
