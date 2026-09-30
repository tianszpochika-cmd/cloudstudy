# R14 限定复核（2026-09-30）

范围：只读复核移动端静态交互原型，不改项目源文件，不跑整套历史矩阵，不涉及后端。

## 当前阶段

改动集中在 docs/06-design/v2-980plus/redesign/mockups/mobile 的 HTML/JS 原型。它用于验证 UI、mock 数据和交互，尚不代表 apps/mobile 的正式 uni-app 前端重构完成。

## 已复核

- 读取 verify-r14.cjs 和 results-r14.json：8 项断言均 pass；部分起始状态使用注入，不能视为 8 条完整用户旅程。
- 人工打开本轮 r14-continue-b4.png、r14-chapter-md.png、r14-pressed-stable.png：本批未发现此前的黑字深底问题，正文加粗正常，所示按钮及底栏无明显截断。不是全路由视觉签收。
- 在 390×844 浏览器通过真实书架入口打开四级第二章并滚动：scrollTop=744.7999877929688；刷新后同章节、同 scrollTop；控制台 error 日志为空。
- DOM 正文含 <b>abandon</b>，不含原始 **。
- 按压尺寸采用执行 Agent 的记录与 CSS 检查，本复核未独立模拟按住。
- node --check app.js、git diff --check 通过。

## 仍需一个限定修补

最近阅读仍被目录浏览状态污染（P2）。实际操作：

1. 书架 → 商务口语 100 句 → 第三章谈判。
2. 书架 → 四级词汇红宝书 → 只查看目录，不打开正文。
3. 首页卡片仍显示“商务口语 100 句 / 第三章谈判”。
4. 点“继续读”，实际打开“四级词汇红宝书 / 第三章冲刺 1000”。

根因：书架进书改变 BK.cur；resumeChapter 仍按 BK.cur/BK.ch 恢复，卡片显示 S.lastRead。建议持久化独立最近阅读 bookId/chIdx；打开正文才更新，浏览目录不更新。对首页/今日/我的入口做针对性复测并补一条回归即可。

证据：resume-after-browsing-wrong-book.png；刷新正常证据：chapter-reload-position-preserved.png。

## 文档口径

- revision-notes.md:310 仍写“33 组真实旅程”，应改为断言口径并注明范围。
- DEMO-GUIDE.md:55 仍写“已知前端问题：无”，与本轮实际遗漏不一致；历史 before/after 累计数也不应当作当前全部通过的独立业务数。
- verify-r14 的 primary 名称实际指 hero“查看今日安排”按钮；准确记录所测控件，不扩写成所有主/次按钮已覆盖。

建议：只补上述最近阅读问题和文档口径，完成后结束本轮自动原型审计，交付可浏览的原型候选基线。真机、读屏等未测事项明确记录，正式前端阶段另排；不要自动扩展为 R15 全矩阵或后端工作。
