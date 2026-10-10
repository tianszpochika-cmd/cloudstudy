# R14 独立复核证据（independent-r14）

复核时点：2026-09-30。本目录归档**对移动端静态交互原型的独立只读复核**证据。

## 范围与限制

复核范围仅限只读检查，**不改动项目源文件、不跑整套历史矩阵、不涉及后端**。本目录内容不能替代全路由视觉签收或完整用户旅程验收。

## 文件索引

| 文件 | 说明 |
|---|---|
| [`review-findings.md`](review-findings.md) | 复核原文：已复核项、逐条结论与仍需修补项 |
| [`chapter-reload-position-preserved.png`](chapter-reload-position-preserved.png) | 章节刷新后阅读位置保持的界面证据 |
| [`resume-after-browsing-wrong-book.png`](resume-after-browsing-wrong-book.png) | 浏览目录后「继续读」打开错误书籍的缺陷复现证据 |

## 复核结论摘要

- 读取 `verify-r14.cjs` 与 `results-r14.json`：8 项断言均 pass；**部分起始状态使用注入，不能视为 8 条完整用户旅程**。
- 人工打开本轮 `r14-continue-b4.png`、`r14-chapter-md.png`、`r14-pressed-stable.png`：本批未发现此前的黑字深底问题，正文加粗正常，所示按钮及底栏无明显截断。**不是全路由视觉签收**。
- 在 390×844 浏览器通过真实书架入口打开四级第二章并滚动，`scrollTop=744.7999877929688`；刷新后同章节、同 `scrollTop`；控制台 error 日志为空。
- 按压尺寸采用执行 Agent 的记录与 CSS 检查，本复核**未独立模拟按住**。

## 后续状态

复核中记录的「最近阅读被目录浏览状态污染」（P2）缺陷，**已在六能力改造中修正**；修复后的操作证据见 [`../README.md`](../README.md) 指向的最新批次。

本目录截图**保留复核时点原文，不被覆盖**，因此其中的 `resume-after-browsing-wrong-book.png` 描述的是**修复前**状态，不代表当前缺陷状态。
