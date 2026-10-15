# MB006 私有实现候选 checkpoint

2026-10-16 04:35 CST。状态：完整候选已落盘，类型检查通过，尚未浏览器或独立验收。停止在可 review 的候选，不宣称页面完成或业务 PASS。

## 范围与冻结原始 SHA256

仅修改以下两个实现文件；未改 store、API、共享 Header、其他页面、主进度文档、Git 或运行服务。

| 文件 | 修改前 raw SHA256 | 当前 raw SHA256 |
|---|---|---|
| apps/mobile/src/pages/assessment/assessment.vue | 30cfa42c97c3fcd3923ac1309f3786fd2a1cf57c9e0d996bd897073429a86598 | d1b501e33b313679bd5c90dd8fcda8e9a5a6b790856a444b01e915523827366a |
| packages/i18n/src/mobile-experience.ts | cb47a78d810e2c2b08fc280f237cae726ee7a66cc2c0bf2dccf7c1112baaca83 | d55f74003bdbe9eae58858ab51bc52d806d2b07e5b06a05e68a183768291249d |

共享文案只新增 assessmentCopy 的中英文以及 mobile.assessment 注册，既有键值不变。

## 已实现但未运行签收

- 已读取本目录设计规格、skip-plan 输入边界、相关 owner/store/uni-runtime；已 view_image 核对 concept.png 和改前答题截图。使用 frontend-app-builder 与 frontend-testing-debugging 的设计及验收规则；浏览器独审由 Root 后续执行，此候选未签视觉一致性。
- 全新自然文流布局、单一 H1、轻返回/设置 AppIcon、560px 内容上限、24/20px 窄屏留白、正常无衬线字号；完全移除旧 v2-assess 套框 CSS。颜色只消费现有语义 token，主题效果待运行核对。
- 引导、答题、真实结果、SKIPPED、待加载/空/错误态均使用共享中英文；没有复制概念图虚构的难度/建议承诺，未硬编码示意 A2/60，也未加入硬件状态栏。
- 接收进度用 acceptedSequence 实数 clamp 到 totalSteps，首题不提前充进度。选项整行可点，选中边界、勾、文字及 aria-pressed 共存；pending 时禁选项和冲突动作，无重复键盘 click handler。
- 仅保留单页单题选择；同题提交未确认或重新读取同题保留选择，新题、owner 换代及 hide 清除。根据当前 question 身份与报告事实判断提交变化，不将 store Promise resolved 视为成功。
- 所有本页导航使用 getUniRuntime；本页 busy、4 秒有限导航等待、owner/hide 代际防迟到局部反馈。onReady 后设置 meta 标题，再在已 ready 的 show/locale/状态变化同步。
- 未提交选择离开需确认；重测需明确确认，取消不调用写入，失败时原报告继续显示且错误 role=alert。
- 保留原 access guard/resume mark/store restore 和自动正式 ASSESSED→ensure 路径；新增计划 pending/失败的人话提示，没有改成点击才 ensure。
- 快速开始契约 GAP 原样保留；本页无新增 skip 写入口。既有 SKIPPED 读态不显示正式等级或分数。

## 验证

最终候选运行 `pnpm --filter @englishflow/mobile typecheck`，exit 0，`tsc --noEmit -p tsconfig.json` 通过。补窄 lifecycle/文案修改后重跑最终相同检查通过；这不是 Vue 模板编译、浏览器、后台或 native PASS。

未运行浏览器、未运行长测试、未重启服务。18183/session94632/PID32992 由 Root 保持管理；新增共享 i18n 如需依赖重新加载，由 Root 在确认 owner 无 inflight 后处理。

## 后续独审与已知边界

- Root 使用冻结 hash 后再做真实 H5 中英、亮/暗/系统/高对比、320/390/宽屏、200% 文字及短屏；核对 loading/empty/error/恢复、FULL/ZERO、缺失与零分、真实计数、SKIPPED、planNotice。
- 重点跑同题 submit 失败后 read 保选择、新题/owner 清除、hide 晚响应、返回/设置离开确认与取消零写、重测取消零写及失败报告不消失、导航 reject/hang 四秒恢复。
- 0/160ms pointer、drag/cancel、全局 uni-button 键盘 polyfill、实际 host 对比/命中仍待独审；全局 active translateY(1px) 未改，不能宣称按压零位移。
- 必须将最后实际截图与 concept.png 同次 view_image 至少比对五点，具名说明语义配色/短屏自然流/无硬件栏/不承诺缺失计划能力的差异。
- 已有 unknown-start 边界未扩改：无 asess_ pointer 的重试仍可能调用原 startPlacement（新 eventId），因此本页此时按钮为“重试开始 / Retry start”；有 pointer 才标“重新读取 / Read again”。不能宣称无 pointer 的 unknown start 一定是只读或一定不开新套题。
- `GAP_CONTRACT_OWNER_WIRING`：SKIPPED 无 reportId，现 plans:ensure 仅核验 ASSESSED report；仍需 assessment/learning/contract owner 扩权威契约。未私改 backend、开关、幂等策略或 retest API body。

## 稳定选择器

页面/状态：`#assessment-page`、`#assessment-guide`、`#assessment-question`、`#assessment-report`、`#assessment-skipped`、`#assessment-pending`。

动作：`#assessment-start`、`#assessment-submit`、`#assessment-option-A` 等、`#assessment-reload-answer`、`#assessment-reload`、`#assessment-retest`、`#assessment-retest-confirm`、`#assessment-retest-cancel`、`#assessment-back`、`#assessment-settings`、`#assessment-leave-confirm`、`#assessment-leave-cancel`、`#assessment-today`。

消息/确认：`#assessment-error`、`#assessment-retest-confirmation`、`#assessment-leave-confirmation`；进度 `[role=progressbar]`；所有选项 `[aria-pressed]`。

## 官方额度

开始实读 70% / 周42%；最终 04:35 实读 primary80% / secondary43%，ordinaryUsageAllowed=true，reset1792111380。未使用 reset credit。候选已停止修改，给 Root 留独审余量。
