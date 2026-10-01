# 移动端静态交互原型证据索引

更新时间：2026-10-01。原型使用静态演示数据；本目录归档批次证据，不能据文件数、截图数或机器零发现宣布完整业务通过。

## 最新修整

### 六类学习能力与产品评审修正

[本轮证据索引](learning-upgrade-20260930/README.md)归档真实界面点击、纯模型规则检查、25 页×4 场景布局采样、高对比 12 次抽查和 15 张已目检截图。跨书续读等五项 P1 在静态原型修正，六能力实现说明见[改造记录](../../../mobile-learning-upgrade-20260930.md)。历史 R12/R14 不覆盖，也不把它们的通过数字算入本轮。

### 交互审计 A01–A19

[审计报告](interaction-audit-20261001/README.md)记录移动端十九项交互缺陷的修复与验证：任务切换/刷新续做、SRS 撤销隔离、重练轮次、跨日串任务、复习累计撤销、刷词锁定去重、写作草稿分离、阅读幂等同步、听力两题交卷、口语稳定轮次、首学引导、限时暂停、成人边界/同意/深链守卫、订单绑定、客服草稿转义、账号文案去虚、缺数据明示、无障碍持久化与 3D 本机降级、测评样例材料。新增 4 个模型回归脚本（audit 41/41、shell 23 组、aux 35/35、review-reconcile 10 组）+ 原有 learning-model 28/28 + 91 屏路由检查 + 194 次路由布局扫描。未生成 `verification-results.json` / `verification-output.txt`，以各脚本当次输出为准。本轮没有反推业务/交互规格或开发计划。

### 管理端静态原型（新建）

[管理端演示指南](../admin/DEMO-GUIDE.md)。`mockups/admin/` 16 屏覆盖 L8/L9/客服/商城/审计，对应 BC-071…084/085…094/168/171…175/185…187/200/204…208，IC-040…051；入口 `http://127.0.0.1:18283/admin/#/dash`，存储键 `yxx-admin-v1` 与学习端隔离；检查 `scripts/check-admin-mockups.mjs` 16 屏 0 缺失。正式 `apps/admin-web` 实现阶段照此真相编写。

### 修复前产品评审

[2026-09-30 产品评审](../../../mobile-product-review-20260930.md)抽样读取 20 个路由，实际完成语法/阅读两题组，复现续读、目标/预算、错题变式、自评掌握与今日回顾问题。11 张截图保存在 `product-review-20260930/`；该批保留修复前评审时点，实施后证据另列在上一节，不与历史回归或全量矩阵互换。

主要证据：[变式不匹配](product-review-20260930/mistake-variant-mismatch.jpg)、[五分钟任务仍为八分钟](product-review-20260930/goal-five-minutes-unchanged-tasks.jpg)、[续读错书](product-review-20260930/resume-opens-wrong-book.jpg)、[自评记掌握](product-review-20260930/self-rating-counted-as-mastered.jpg)、[今日完成显示共零分钟](product-review-20260930/today-complete-zero-minutes.jpg)、[今日回顾进入复习](product-review-20260930/today-recap-opens-srs.jpg)、[320px 世界页](product-review-20260930/world-320-current.jpg)。

### 界面修整证据

| 内容 | 文件 | 范围 |
|---|---|---|
| 打卡箭头与卡片布局 | [世界页](ui-polish-20260930/world-dark-390.png) | 390px 深色；箭头 14px、点击区 44px、中心对齐 |
| 刷词模式与词汇层级 | [刷词](ui-polish-20260930/drill-zhan-dark-390.png)、[展开中文](ui-polish-20260930/drill-revealed-dark-390.png) | 模式四列、详情独立、音标/释义分层；同页操作无整页进场 |
| 菜单与说明/动作布局 | [我的](ui-polish-20260930/me-dark-390.png) | 文本与箭头对齐，说明与按钮分组 |
| 窄屏特大字号 | [刷词 XL](ui-polish-20260930/drill-dark-xl-320.png) | 320×740 深色特大字号 |
| 续读按钮间距 | [今日续读卡片](ui-polish-20260930/today-reading-button-gap.png) | 390px/320px 实测说明与按钮间隔 12px，按钮高 44px |
| 本轮测量记录 | [checks.json](ui-polish-20260930/checks.json) | 深浅色 320px 六类页面、深色 XL 四类页面、原位更新/下一词及图标测量；不是全路由或完整旅程矩阵 |

以上截图已实际开图复核。最新续读按钮间距测量记在[修订记录 §15](../../../revision-notes.md)，不冒称包含在较早保存的 `checks.json` 中。

## 历史批次与独立复核

| 批次 | 入口 | 如何使用 |
|---|---|---|
| R3 演示旅程 | [23 项断言](results.json)、[10 项补充断言](results-extra.json)及本目录根截图 | 对应执行 Agent 的保存结果；断言数不是完整旅程数，本次归档没有重新执行 |
| 主题修复 | [颜色记录](theme-fix-20260930/contrast-results.json) | 有采样方法及限制；只覆盖当时指定页面与状态 |
| R12/R13 视觉矩阵 | [before](visual-r12/before/audit.json)、[before-xl](visual-r12/before-xl/audit.json)、[after](visual-r12/after/audit.json)、[after-xl](visual-r12/after-xl/audit.json) | 历史 before/after 与截图；部分 setup 注入状态，证明可渲染，不能替代真实可达性或人眼目检；归档后不覆盖 |
| R13 缺陷配对 | `visual-r13/before/`、`visual-r13/after/` | 特大字号底栏、刷新正文、空态、未建计划等当时修补证据 |
| R14 阅读/按压 | [8 项断言](visual-r13/after/results-r14.json)及同目录 3 张 `r14-*` 截图 | 部分起始状态注入；按压测试只证明其实际采样控件 |
| R14 独立复核 | [复核原文](independent-r14/review-findings.md)、[错书目的地](independent-r14/resume-after-browsing-wrong-book.png)、[刷新位置恢复](independent-r14/chapter-reload-position-preserved.png) | 保留复核时点原文；最近阅读目的地缺陷已在六能力改造修正，修复后操作见最新证据，旧截图不覆盖 |

## 当前未关闭事项

- 读屏、软键盘、iOS/Android 真机、TTS 真实语音、3D 联网，以及全部横屏和高对比按住态尚未完成验证。
- 本批局部截图目检不代表历史全部截图或全路由签收；原型基线仍不宣布整体冻结。

五项产品评审 P1 已在原型修正，见[实施说明](../../../mobile-learning-upgrade-20260930.md)。上述未测事项与历史缺陷分别记录，不把修复前截图当作当前缺陷状态。

脚本说明见[演示指南](../DEMO-GUIDE.md)。从当前代码重跑历史 before 脚本只会得到当前界面，不能重建过去缺陷；验证新的修改应存入新的证据目录。
